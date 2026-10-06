// js/projects/project-work-items-ui.js
//
// ESTADO-DA-OBRA-WORKSPACE-001 — Estado da Obra is the canonical project
// workspace. It reads ONLY project_status_state / project_work_items /
// project_incidents / project_photos (js/database/db-project-workspace.js)
// and never derives current state from reports.* or project_work_item_status.
//
// Editing model: one local workspace draft. Every edit (phase, progress,
// summary, next steps, work items, incidents, photo metadata, hide/show,
// remove) only changes the draft and marks the screen dirty. Nothing is
// persisted until "Guardar alterações", which sends the changes through the
// single transactional save_project_workspace RPC. The one deliberate
// exception is "Adicionar foto": an explicit upload action that stores the
// file and inserts its project_photos row immediately.
//
// Phase 4 — "Gerar relatório" is a pure export of the SAVED workspace: it
// only ever sends the project id to generate_report, which reads canonical
// state server-side. It never runs while the draft is dirty.

import { appState } from "#state/app-state.js";
import { getProjectById } from "#projects/project-list.js";
import { goToStepId } from "#navigation/navigation.js";
import { canEditProject, canCreateWeeklyReport } from "#projects/project-status-rules.js";
import { loadProjectIntoForm } from "#projects/project-form.js";
import { JOB_TYPES, AREAS } from "#config/app-options.js";
import { confirmAction } from "#ui/confirm-dialog.js";
import {
  loadProjectWorkspace,
  saveProjectWorkspace,
  addWorkspacePhoto,
} from "#database/db-project-workspace.js";
import { generateCanonicalReport, getLatestReportDate } from "#database/db-reports.js";
import {
  initReportGenerationPanel,
  clearGeneratedReportPanel,
  showReportGenerating,
  showReportGenerationError,
  showGeneratedReport,
  openPendingReportTab,
  announceGeneratedReport,
  closePendingReportTab,
} from "#reports/report-generation-panel.js";

// Same 8 phase labels as the weekly report's own step 3 — deliberately a
// separate, self-contained picker (own class names/data attribute) so it never
// touches the global .phase-option handler that writes appState.phase, the
// live report-draft field.
const PHASE_OPTIONS = [
  "Fundações",
  "Estrutura e Alvenaria",
  "Impermeabilização",
  "Cobertura",
  "Instalações",
  "Acabamentos",
  "Arranjos Exteriores",
  "Concluído",
];

const WORK_STATUS_OPTIONS = [
  { value: "pending", label: "Pendente" },
  { value: "in_progress", label: "Em curso" },
  { value: "done", label: "Concluída" },
];

const INCIDENT_STATUS_LABELS = { open: "Em aberto", resolved: "Resolvido" };

const PHOTO_STAGE_OPTIONS = [
  { value: "before", label: "Antes" },
  { value: "during", label: "Durante" },
  { value: "after", label: "Depois" },
];

const HIDDEN_FROM_REPORTS_LABEL = "Oculto dos próximos relatórios";

// `baseline` is the last state known to be persisted; `draft` is what's on
// screen. Removed items stay in the draft with deactivated = true (that's
// what tells the RPC "the user explicitly removed this") and are simply not
// rendered.
let baseline = emptyWorkspace();
let draft = emptyWorkspace();
let editable = false;
let saving = false;
let generating = false;
let uploadingPhoto = false;
let statusMessage = { text: "", tone: "" };

let editingWorkItemId = null;
let editingIncidentId = null;
let addWorkItemFormOpen = false;
let newWorkItemDraft = emptyNewWorkItem();
let addIncidentFormOpen = false;
let newIncidentDescription = "";

let initialized = false;

function emptyWorkspace() {
  return {
    phase: "",
    progressPct: 0,
    summary: "",
    nextSteps: "",
    workItems: [],
    incidents: [],
    photos: [],
  };
}

function emptyNewWorkItem() {
  return { type: "", area: "", description: "", status: "pending" };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function initProjectWorkItemsUi() {
  if (initialized) return;
  initialized = true;

  initReportGenerationPanel();

  document.addEventListener("click", handleWorkStatusClick);
  document.addEventListener("input", handleWorkStatusInput);
  document.addEventListener("change", handleWorkStatusChange);

  // Tab close / reload with unsaved edits — the in-app navigation guard
  // (confirmLeaveEstadoObraIfDirty) can't cover these.
  window.addEventListener("beforeunload", (event) => {
    if (!hasUnsavedWorkStatusChanges()) return;
    event.preventDefault();
    event.returnValue = "";
  });
}

export async function openProjectMasterSheet(projectId) {
  const project = getProjectById(projectId);

  if (!project) {
    alert("Projeto não encontrado na base de dados.");
    return;
  }

  appState.currentWorkStatusProjectId = project.id;
  // Shared "current project" context — "Mais opções" (mode page, legal
  // report, history) reads these.
  appState.currentCompanyId = project.companyId;
  appState.currentClientId = project.clientId;
  appState.currentProjectId = project.id;
  appState.currentProject = project;

  loadProjectIntoForm(project);

  renderHeader(project);
  goToStepId("estado-obra");

  const generateReportBtn = document.getElementById("workStatusGenerateReportBtn");
  if (generateReportBtn) {
    generateReportBtn.hidden = !canCreateWeeklyReport(project);
  }

  await loadAndRender(project);
}

// Exported for navigation.js / project-index.js. Gated on currentStepId so a
// stale draft from a previous visit can never misfire on an unrelated screen.
export function hasUnsavedWorkStatusChanges() {
  if (appState.currentStepId !== "estado-obra") return false;
  return isDirty();
}

// Resolves true when it's safe to leave Estado da Obra (nothing unsaved, or
// the user explicitly chose to discard). Never saves or discards silently.
export async function confirmLeaveEstadoObraIfDirty() {
  if (!hasUnsavedWorkStatusChanges()) return true;

  return confirmAction({
    title: "Sair sem guardar?",
    message: "Existem alterações por guardar. Quer sair sem guardar?",
    confirmLabel: "Sair sem guardar",
    cancelLabel: "Cancelar",
  });
}

// "Gerar relatório" — never from draft data. A dirty workspace must be saved
// first, and only when the user explicitly picks "Guardar alterações"; the
// report is then generated from what was just persisted.
async function handleGenerateReport() {
  if (generating || saving) return;

  const projectId = appState.currentWorkStatusProjectId;
  const project = projectId ? getProjectById(projectId) : null;
  if (!project) return;

  if (!canCreateWeeklyReport(project)) {
    alert("Só é possível gerar relatórios para obras em curso ou pausadas.");
    return;
  }

  // Still loading: there is no saved state on screen to export yet.
  if (document.getElementById("step-estado-obra")?.dataset.workspaceState !== "ready") return;

  // Checked before the save prompt, so nobody saves only to hit a date error.
  const period = readReportPeriod();
  if (period.error) {
    showReportGenerationError(period.error);
    return;
  }

  if (isDirty()) {
    const wantsSave = await confirmAction({
      title: "Alterações por guardar",
      message: "Existem alterações por guardar. Guarde as alterações antes de gerar o relatório.",
      confirmLabel: "Guardar alterações",
      cancelLabel: "Cancelar",
    });

    if (!wantsSave) return;
    if (!(await handleSave())) return;
    if (isDirty()) return;
  }

  // Must run synchronously in the click (before any await on the clean path)
  // or the browser blocks the new tab. After the "Guardar alterações" detour
  // it may be blocked; announceGeneratedReport then offers a button instead.
  const reportTab = openPendingReportTab();

  generating = true;
  editable = false;
  renderAll();
  showReportGenerating();

  try {
    const report = await generateCanonicalReport(project.id, {
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
    });
    // Generated and saved even if the user has since left this project:
    // still open it and confirm.
    void announceGeneratedReport({ report, tab: reportTab });
    if (appState.currentWorkStatusProjectId !== project.id) return;
    showGeneratedReport({ report, projectName: project.name });
    // The next report's automatic period now starts after this one.
    void prefillReportPeriod(project, loadToken);
  } catch (error) {
    console.error("Error generating report:", error);
    closePendingReportTab(reportTab);
    if (appState.currentWorkStatusProjectId !== project.id) return;
    showReportGenerationError(error.message);
  } finally {
    generating = false;
    if (appState.currentWorkStatusProjectId === project.id) {
      editable = canEditProject(project);
      renderAll();
    }
  }
}

function renderHeader(project) {
  const nameEl = document.getElementById("workStatusProjectLabel");
  const clientEl = document.getElementById("workStatusClientLabel");
  const moreOptionsBtn = document.getElementById("workStatusMoreOptionsBtn");

  if (nameEl) nameEl.textContent = project.name || "";
  if (clientEl) clientEl.textContent = project.clientName ? `Cliente: ${project.clientName}` : "";
  if (moreOptionsBtn) moreOptionsBtn.dataset.projectId = project.id;
}

// The screen stays read-only until the workspace has loaded: an edit made
// against the empty placeholder draft would otherwise be silently replaced
// when the load resolves. loadToken drops a slow load for a project the user
// has already navigated away from.
let loadToken = 0;

async function loadAndRender(project) {
  const token = ++loadToken;

  editable = false;
  resetTransientUiState();
  statusMessage = { text: "", tone: "" };
  clearGeneratedReportPanel();

  baseline = emptyWorkspace();
  draft = emptyWorkspace();

  setReportPeriodFields("", "");
  void prefillReportPeriod(project, token);

  setWorkspaceState("loading");
  renderAll();
  setListsMessage("A carregar...");

  try {
    const workspace = await loadProjectWorkspace(project.id);
    if (token !== loadToken) return;

    baseline = workspace;
    draft = clone(workspace);
    editable = canEditProject(project);
    renderAll();
    setWorkspaceState("ready");
  } catch (error) {
    if (token !== loadToken) return;
    console.error("Error loading Estado da Obra:", error);
    setListsMessage(`Erro ao carregar estado da obra: ${escapeHtml(error.message)}`);
    setWorkspaceState("error");
  }
}

function setWorkspaceState(state) {
  const step = document.getElementById("step-estado-obra");
  if (step) step.dataset.workspaceState = state;
  renderReportPeriodFields();
}

// --- report period ("Período do relatório") ---------------------------------
//
// Prefilled with the automatic period generate_report would pick (day after
// the latest non-deleted report → today, or the last 7 days for a first
// report; "today" in Europe/Lisbon). Whatever the fields show is what gets
// sent; the server validates it again.

function lisbonToday() {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date());
}

function shiftIsoDate(isoDate, days) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function setReportPeriodFields(start, end) {
  const startEl = document.getElementById("workStatusPeriodStart");
  const endEl = document.getElementById("workStatusPeriodEnd");
  const today = lisbonToday();
  if (startEl) {
    startEl.value = start;
    startEl.max = today;
  }
  if (endEl) {
    endEl.value = end;
    endEl.max = today;
  }
}

async function prefillReportPeriod(project, token) {
  const today = lisbonToday();
  let previous = null;

  try {
    previous = await getLatestReportDate(project.id);
  } catch (error) {
    console.error("Error loading latest report date:", error);
  }

  if (token !== loadToken) return;

  const start = previous ? [shiftIsoDate(previous, 1), today].sort()[0] : shiftIsoDate(today, -7);
  setReportPeriodFields(start, today);
}

function readReportPeriod() {
  const periodStart = document.getElementById("workStatusPeriodStart")?.value || "";
  const periodEnd = document.getElementById("workStatusPeriodEnd")?.value || "";

  if (!periodStart || !periodEnd) {
    return { error: "Indique as duas datas do período do relatório." };
  }
  if (periodStart > periodEnd) {
    return { error: "A data de início do período não pode ser posterior à data de fim." };
  }
  if (periodEnd > lisbonToday()) {
    return { error: "O período do relatório não pode terminar depois de hoje." };
  }

  return { periodStart, periodEnd };
}

function renderReportPeriodFields() {
  const project = getProjectById(appState.currentWorkStatusProjectId);
  const card = document.getElementById("workStatusPeriodCard");
  const canGenerate = Boolean(project && canCreateWeeklyReport(project));
  const ready = document.getElementById("step-estado-obra")?.dataset.workspaceState === "ready";

  if (card) card.hidden = !canGenerate;

  for (const id of ["workStatusPeriodStart", "workStatusPeriodEnd"]) {
    const input = document.getElementById(id);
    if (input) input.disabled = !canGenerate || !ready || generating;
  }
}

function resetTransientUiState() {
  editingWorkItemId = null;
  editingIncidentId = null;
  addWorkItemFormOpen = false;
  newWorkItemDraft = emptyNewWorkItem();
  addIncidentFormOpen = false;
  newIncidentDescription = "";
}

// --- dirty tracking ---------------------------------------------------------

function workItemSignature(item) {
  return JSON.stringify([item.type, item.area, item.description, item.status, item.includeInReports, item.deactivated]);
}

function incidentSignature(incident) {
  return JSON.stringify([incident.description, incident.status, incident.includeInReports, incident.deactivated]);
}

function photoSignature(photo) {
  return JSON.stringify([photo.area, photo.description, photo.worker, photo.stage, photo.includeInReports, photo.deactivated]);
}

// Only items that are new, changed, or explicitly removed relative to the
// baseline. Unchanged rows are never sent, so a save can't overwrite them
// with stale values; rows missing from the payload are never deactivated.
function changedEntries(draftList, baselineList, signature) {
  const baselineById = new Map(baselineList.map((entry) => [entry.id, entry]));

  return draftList.filter((entry) => {
    const original = baselineById.get(entry.id);
    if (!original) return !entry.deactivated;
    return signature(entry) !== signature(original);
  });
}

function buildChanges() {
  return {
    status:
      draft.phase !== baseline.phase ||
      draft.progressPct !== baseline.progressPct ||
      draft.summary !== baseline.summary ||
      draft.nextSteps !== baseline.nextSteps,
    workItems: changedEntries(draft.workItems, baseline.workItems, workItemSignature),
    incidents: changedEntries(draft.incidents, baseline.incidents, incidentSignature),
    photos: changedEntries(draft.photos, baseline.photos, photoSignature),
  };
}

function isDirty() {
  const changes = buildChanges();
  return (
    changes.status ||
    changes.workItems.length > 0 ||
    changes.incidents.length > 0 ||
    changes.photos.length > 0
  );
}

// --- rendering --------------------------------------------------------------

function renderAll() {
  renderPhasePicker();
  renderProgressSlider();
  renderTextFields();
  renderWorkLists();
  renderAddWorkItemForm();
  renderIncidents();
  renderPhotos();
  updateSaveButtonState();
  renderReportPeriodFields();
}

function renderPhasePicker() {
  const el = document.getElementById("workStatusPhasePicker");
  if (!el) return;

  el.innerHTML = PHASE_OPTIONS.map(
    (phase) => `
    <div
      class="work-status-phase-option${phase === draft.phase ? " selected" : ""}"
      data-work-status-phase="${escapeHtml(phase)}"
    >${escapeHtml(phase)}</div>
  `
  ).join("");

  el.classList.toggle("is-readonly", !editable);
}

function renderProgressSlider() {
  const slider = document.getElementById("workStatusProgressSlider");
  const fill = document.getElementById("workStatusProgressFill");
  const pct = document.getElementById("workStatusProgressPct");

  if (slider) {
    slider.value = String(draft.progressPct);
    slider.disabled = !editable;
  }
  if (fill) fill.style.width = `${draft.progressPct}%`;
  if (pct) pct.textContent = `${draft.progressPct}%`;
}

function renderTextFields() {
  const summary = document.getElementById("workStatusSummary");
  if (summary) {
    summary.value = draft.summary;
    summary.disabled = !editable;
  }

  const nextSteps = document.getElementById("workStatusNextSteps");
  if (nextSteps) {
    nextSteps.value = draft.nextSteps;
    nextSteps.disabled = !editable;
  }
}

function liveWorkItems() {
  return draft.workItems.filter((item) => !item.deactivated);
}

function renderWorkLists() {
  const items = liveWorkItems();

  renderWorkList({
    containerId: "workStatusPendingList",
    headingId: "workStatusPendingHeading",
    headingLabel: "Pendentes",
    items: items.filter((item) => item.status === "pending"),
    accent: "pending",
    emptyMessage: "Sem trabalhos pendentes registados.",
  });

  renderWorkList({
    containerId: "workStatusProgressList",
    headingId: "workStatusProgressHeading",
    headingLabel: "Em curso",
    items: items.filter((item) => item.status === "in_progress"),
    accent: "progress",
    emptyMessage: "Sem trabalhos em curso registados.",
  });

  renderWorkList({
    containerId: "workStatusDoneList",
    headingId: "workStatusDoneHeading",
    headingLabel: "Concluídas",
    items: items.filter((item) => item.status === "done"),
    accent: "done",
    emptyMessage: "Sem trabalhos concluídos registados.",
  });

  const addBtn = document.getElementById("workStatusAddWorkItemBtn");
  if (addBtn) addBtn.hidden = !editable || addWorkItemFormOpen;
}

function renderWorkList({ containerId, headingId, headingLabel, items, accent, emptyMessage }) {
  const heading = document.getElementById(headingId);
  if (heading) heading.textContent = `${headingLabel} (${items.length})`;

  const el = document.getElementById(containerId);
  if (!el) return;

  if (items.length === 0) {
    el.innerHTML = `<p class="empty-hint">${escapeHtml(emptyMessage)}</p>`;
    return;
  }

  el.innerHTML = items.map((item) => renderWorkItemCard(item, accent)).join("");
}

function renderWorkItemCard(item, accent) {
  const id = escapeHtml(item.id);
  const title = [item.type, item.area].filter(Boolean).join(" · ") || "Trabalho";
  const isEditing = editable && editingWorkItemId === item.id;
  const disabled = editable ? "" : "disabled";

  const body = isEditing
    ? `
      <div class="field">
        <label>Tipo de trabalho</label>
        <select data-ws-kind="work" data-ws-id="${id}" data-ws-field="type">
          <option value="">— Selecionar —</option>
          ${renderSelectOptions(JOB_TYPES, item.type)}
        </select>
      </div>
      <div class="field">
        <label>Área</label>
        <select data-ws-kind="work" data-ws-id="${id}" data-ws-field="area">
          <option value="">— Selecionar —</option>
          ${renderSelectOptions(AREAS, item.area)}
        </select>
      </div>
      <div class="field">
        <label>Descrição</label>
        <textarea data-ws-kind="work" data-ws-id="${id}" data-ws-field="description">${escapeHtml(item.description)}</textarea>
      </div>
    `
    : `
      <div class="work-status-item-title">${escapeHtml(title)}</div>
      ${item.description ? `<div class="work-status-item-desc">${escapeHtml(item.description)}</div>` : ""}
    `;

  return `
    <div class="work-status-item-card work-status-item-card--${accent}${item.includeInReports ? "" : " is-hidden-from-reports"}" data-work-item-id="${id}">
      ${body}
      ${item.includeInReports ? "" : `<div class="work-status-hidden-badge">${HIDDEN_FROM_REPORTS_LABEL}</div>`}

      <div class="field work-status-inline-field">
        <label>Estado</label>
        <select data-ws-kind="work" data-ws-id="${id}" data-ws-field="status" ${disabled}>
          ${WORK_STATUS_OPTIONS.map(
            (option) =>
              `<option value="${option.value}"${option.value === item.status ? " selected" : ""}>${option.label}</option>`
          ).join("")}
        </select>
      </div>

      ${
        editable
          ? `<div class="work-status-item-actions">
              <button type="button" class="work-status-item-btn" data-ws-action="toggle-edit-work" data-ws-id="${id}">${isEditing ? "Concluir edição" : "Editar"}</button>
              <button type="button" class="work-status-item-btn" data-ws-action="toggle-report-work" data-ws-id="${id}">${item.includeInReports ? "Ocultar do relatório" : "Mostrar no relatório"}</button>
              <button type="button" class="work-status-item-btn work-status-item-btn--danger" data-ws-action="remove-work" data-ws-id="${id}">Remover</button>
            </div>`
          : ""
      }
    </div>
  `;
}

function renderAddWorkItemForm() {
  const container = document.getElementById("workStatusAddWorkItemForm");
  if (!container) return;

  const open = editable && addWorkItemFormOpen;
  container.hidden = !open;

  if (!open) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <div class="field">
      <label>Tipo de trabalho</label>
      <select data-add-work-field="type">
        <option value="">— Selecionar —</option>
        ${renderSelectOptions(JOB_TYPES, newWorkItemDraft.type)}
      </select>
    </div>

    <div class="field">
      <label>Área</label>
      <select data-add-work-field="area">
        <option value="">— Selecionar —</option>
        ${renderSelectOptions(AREAS, newWorkItemDraft.area)}
      </select>
    </div>

    <div class="field">
      <label>Descrição</label>
      <textarea
        data-add-work-field="description"
        placeholder="Ex: Aplicação de primário nas paredes da sala"
      >${escapeHtml(newWorkItemDraft.description)}</textarea>
    </div>

    <div class="field">
      <label>Estado</label>
      <select data-add-work-field="status">
        ${WORK_STATUS_OPTIONS.map(
          (option) =>
            `<option value="${option.value}"${option.value === newWorkItemDraft.status ? " selected" : ""}>${option.label}</option>`
        ).join("")}
      </select>
    </div>

    <div class="work-status-add-form-actions">
      <button type="button" class="btn-add" data-ws-action="submit-add-work-item">Adicionar</button>
      <button type="button" class="btn-cancel-work-item" data-ws-action="cancel-add-work-item">Cancelar</button>
    </div>
  `;
}

function renderIncidents() {
  const incidents = draft.incidents.filter((incident) => !incident.deactivated);

  const heading = document.getElementById("workStatusIncidentsHeading");
  if (heading) heading.textContent = `Incidentes (${incidents.length})`;

  const el = document.getElementById("workStatusIncidentsList");
  if (el) {
    el.innerHTML =
      incidents.length === 0
        ? `<p class="empty-hint">Sem incidentes registados.</p>`
        : incidents.map(renderIncidentCard).join("");
  }

  const addBtn = document.getElementById("workStatusAddIncidentBtn");
  if (addBtn) addBtn.hidden = !editable || addIncidentFormOpen;

  const form = document.getElementById("workStatusAddIncidentForm");
  if (form) {
    const open = editable && addIncidentFormOpen;
    form.hidden = !open;
    form.innerHTML = open
      ? `
        <div class="field">
          <label>Descrição do incidente</label>
          <textarea data-add-incident-field="description" placeholder="Ex: Atraso na entrega de material">${escapeHtml(newIncidentDescription)}</textarea>
        </div>
        <div class="work-status-add-form-actions">
          <button type="button" class="btn-add" data-ws-action="submit-add-incident">Adicionar</button>
          <button type="button" class="btn-cancel-work-item" data-ws-action="cancel-add-incident">Cancelar</button>
        </div>
      `
      : "";
  }
}

function renderIncidentCard(incident) {
  const id = escapeHtml(incident.id);
  const isEditing = editable && editingIncidentId === incident.id;
  const resolved = incident.status === "resolved";

  const body = isEditing
    ? `<div class="field">
        <label>Descrição</label>
        <textarea data-ws-kind="incident" data-ws-id="${id}" data-ws-field="description">${escapeHtml(incident.description)}</textarea>
      </div>`
    : `<div class="work-status-item-desc">${escapeHtml(incident.description)}</div>`;

  return `
    <div class="work-status-item-card work-status-incident-card${resolved ? " is-resolved" : ""}${incident.includeInReports ? "" : " is-hidden-from-reports"}" data-incident-id="${id}">
      ${body}
      <div class="work-status-item-meta" data-incident-status>${INCIDENT_STATUS_LABELS[incident.status] || incident.status}</div>
      ${incident.includeInReports ? "" : `<div class="work-status-hidden-badge">${HIDDEN_FROM_REPORTS_LABEL}</div>`}
      ${
        editable
          ? `<div class="work-status-item-actions">
              <button type="button" class="work-status-item-btn" data-ws-action="toggle-edit-incident" data-ws-id="${id}">${isEditing ? "Concluir edição" : "Editar"}</button>
              <button type="button" class="work-status-item-btn" data-ws-action="toggle-resolve-incident" data-ws-id="${id}">${resolved ? "Reabrir" : "Resolver"}</button>
              <button type="button" class="work-status-item-btn" data-ws-action="toggle-report-incident" data-ws-id="${id}">${incident.includeInReports ? "Ocultar do relatório" : "Mostrar no relatório"}</button>
              <button type="button" class="work-status-item-btn work-status-item-btn--danger" data-ws-action="remove-incident" data-ws-id="${id}">Remover</button>
            </div>`
          : ""
      }
    </div>
  `;
}

function renderPhotos() {
  const photos = draft.photos.filter((photo) => !photo.deactivated);

  const heading = document.getElementById("workStatusPhotosHeading");
  if (heading) heading.textContent = `Fotografias (${photos.length})`;

  const el = document.getElementById("workStatusPhotosList");
  if (el) {
    el.innerHTML =
      photos.length === 0
        ? `<p class="empty-hint">Sem fotografias registadas.</p>`
        : photos.map(renderPhotoCard).join("");
  }

  const addBtn = document.getElementById("workStatusAddPhotoBtn");
  if (addBtn) {
    addBtn.hidden = !editable;
    addBtn.disabled = uploadingPhoto;
    addBtn.textContent = uploadingPhoto ? "A carregar fotografia..." : "+ Adicionar foto";
  }
}

function renderPhotoCard(photo) {
  const id = escapeHtml(photo.id);
  const disabled = editable ? "" : "disabled";

  return `
    <div class="work-status-item-card work-status-photo-card${photo.includeInReports ? "" : " is-hidden-from-reports"}" data-photo-id="${id}">
      ${photo.signedUrl ? `<img class="work-status-photo-img" src="${escapeHtml(photo.signedUrl)}" alt="${escapeHtml(photo.description || "Fotografia da obra")}" />` : ""}
      ${photo.includeInReports ? "" : `<div class="work-status-hidden-badge">${HIDDEN_FROM_REPORTS_LABEL}</div>`}

      <div class="field">
        <label>Legenda</label>
        <input type="text" data-ws-kind="photo" data-ws-id="${id}" data-ws-field="description" value="${escapeHtml(photo.description)}" ${disabled} />
      </div>
      <div class="field">
        <label>Área</label>
        <select data-ws-kind="photo" data-ws-id="${id}" data-ws-field="area" ${disabled}>
          <option value="">— Selecionar —</option>
          ${renderSelectOptions(AREAS, photo.area)}
        </select>
      </div>
      <div class="field">
        <label>Trabalhador</label>
        <input type="text" data-ws-kind="photo" data-ws-id="${id}" data-ws-field="worker" value="${escapeHtml(photo.worker)}" ${disabled} />
      </div>
      <div class="field">
        <label>Fase da fotografia</label>
        <select data-ws-kind="photo" data-ws-id="${id}" data-ws-field="stage" ${disabled}>
          ${PHOTO_STAGE_OPTIONS.map(
            (option) =>
              `<option value="${option.value}"${option.value === photo.stage ? " selected" : ""}>${option.label}</option>`
          ).join("")}
        </select>
      </div>

      ${
        editable
          ? `<div class="work-status-item-actions">
              <button type="button" class="work-status-item-btn" data-ws-action="toggle-report-photo" data-ws-id="${id}">${photo.includeInReports ? "Ocultar do relatório" : "Mostrar no relatório"}</button>
              <button type="button" class="work-status-item-btn work-status-item-btn--danger" data-ws-action="remove-photo" data-ws-id="${id}">Remover</button>
            </div>`
          : ""
      }
    </div>
  `;
}

function updateSaveButtonState() {
  const bar = document.getElementById("workStatusSaveBar");
  const btn = document.getElementById("workStatusSaveBtn");
  const hint = document.getElementById("workStatusSaveHint");
  const dirty = isDirty();

  if (btn) {
    btn.disabled = !dirty || saving || generating;
    btn.textContent = saving ? "A guardar..." : "Guardar alterações";
  }

  const generateBtn = document.getElementById("workStatusGenerateReportBtn");
  if (generateBtn) {
    generateBtn.disabled = saving || generating;
    generateBtn.textContent = generating ? "A gerar relatório..." : "Gerar relatório";
  }

  if (hint) {
    if (saving) {
      hint.textContent = "";
    } else if (statusMessage.text && (statusMessage.tone === "error" || !dirty)) {
      hint.textContent = statusMessage.text;
    } else {
      hint.textContent = dirty ? "Existem alterações por guardar." : "";
    }
    hint.classList.toggle("is-success", !saving && !dirty && statusMessage.tone === "success");
  }

  // The sticky save bar only takes footer space while there is something to
  // save, a save in flight, or a save result to read.
  if (bar) bar.hidden = !editable || (!dirty && !saving && !hint?.textContent);
}

function setListsMessage(message) {
  for (const id of [
    "workStatusPendingList",
    "workStatusProgressList",
    "workStatusDoneList",
    "workStatusIncidentsList",
    "workStatusPhotosList",
  ]) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<p class="empty-hint">${message}</p>`;
  }
}

// --- event handling ---------------------------------------------------------

function findEntry(kind, id) {
  const list = kind === "work" ? draft.workItems : kind === "incident" ? draft.incidents : draft.photos;
  return list.find((entry) => entry.id === id) || null;
}

// Any draft edit: a new edit supersedes the last save/error message.
function markEdited() {
  statusMessage = { text: "", tone: "" };
}

async function handleWorkStatusClick(event) {
  const phaseOption = event.target.closest("[data-work-status-phase]");
  if (phaseOption) {
    if (!requireEditableProject()) return;
    draft.phase = phaseOption.dataset.workStatusPhase;
    markEdited();
    renderPhasePicker();
    updateSaveButtonState();
    return;
  }

  const saveBtn = event.target.closest('[data-work-status-action="save"]');
  if (saveBtn) {
    event.preventDefault();
    await handleSave();
    return;
  }

  const generateBtn = event.target.closest('[data-work-status-action="generate-report"]');
  if (generateBtn) {
    event.preventDefault();
    await handleGenerateReport();
    return;
  }

  const addWorkBtn = event.target.closest('[data-work-status-action="add-work-item"]');
  if (addWorkBtn) {
    event.preventDefault();
    if (!requireEditableProject()) return;
    addWorkItemFormOpen = true;
    newWorkItemDraft = emptyNewWorkItem();
    renderWorkLists();
    renderAddWorkItemForm();
    return;
  }

  const addIncidentBtn = event.target.closest('[data-work-status-action="add-incident"]');
  if (addIncidentBtn) {
    event.preventDefault();
    if (!requireEditableProject()) return;
    addIncidentFormOpen = true;
    newIncidentDescription = "";
    renderIncidents();
    return;
  }

  const addPhotoBtn = event.target.closest('[data-work-status-action="add-photo"]');
  if (addPhotoBtn) {
    event.preventDefault();
    if (!requireEditableProject()) return;
    document.getElementById("workStatusPhotoInput")?.click();
    return;
  }

  const actionEl = event.target.closest("[data-ws-action]");
  if (!actionEl) return;

  event.preventDefault();
  handleDraftAction(actionEl.dataset.wsAction, actionEl.dataset.wsId);
}

function handleDraftAction(action, id) {
  if (!requireEditableProject()) return;

  switch (action) {
    case "submit-add-work-item": {
      if (!newWorkItemDraft.description.trim()) {
        alert("Descreva o trabalho antes de adicionar.");
        return;
      }
      draft.workItems.push({
        id: crypto.randomUUID(),
        type: newWorkItemDraft.type,
        area: newWorkItemDraft.area,
        description: newWorkItemDraft.description.trim(),
        status: newWorkItemDraft.status,
        includeInReports: true,
        firstReportId: null,
        deactivated: false,
      });
      addWorkItemFormOpen = false;
      newWorkItemDraft = emptyNewWorkItem();
      break;
    }
    case "cancel-add-work-item":
      addWorkItemFormOpen = false;
      newWorkItemDraft = emptyNewWorkItem();
      break;
    case "toggle-edit-work":
      editingWorkItemId = editingWorkItemId === id ? null : id;
      break;
    case "toggle-report-work": {
      const item = findEntry("work", id);
      if (item) item.includeInReports = !item.includeInReports;
      break;
    }
    case "remove-work": {
      removeEntry("work", id);
      if (editingWorkItemId === id) editingWorkItemId = null;
      break;
    }
    case "submit-add-incident": {
      if (!newIncidentDescription.trim()) {
        alert("Descreva o incidente antes de adicionar.");
        return;
      }
      draft.incidents.push({
        id: crypto.randomUUID(),
        description: newIncidentDescription.trim(),
        status: "open",
        includeInReports: true,
        deactivated: false,
      });
      addIncidentFormOpen = false;
      newIncidentDescription = "";
      break;
    }
    case "cancel-add-incident":
      addIncidentFormOpen = false;
      newIncidentDescription = "";
      break;
    case "toggle-edit-incident":
      editingIncidentId = editingIncidentId === id ? null : id;
      break;
    case "toggle-resolve-incident": {
      const incident = findEntry("incident", id);
      if (incident) incident.status = incident.status === "resolved" ? "open" : "resolved";
      break;
    }
    case "toggle-report-incident": {
      const incident = findEntry("incident", id);
      if (incident) incident.includeInReports = !incident.includeInReports;
      break;
    }
    case "remove-incident":
      removeEntry("incident", id);
      if (editingIncidentId === id) editingIncidentId = null;
      break;
    case "toggle-report-photo": {
      const photo = findEntry("photo", id);
      if (photo) photo.includeInReports = !photo.includeInReports;
      break;
    }
    case "remove-photo":
      removeEntry("photo", id);
      break;
    default:
      return;
  }

  markEdited();
  renderAll();
}

// Removal of a persisted row = explicit deactivation in the draft (sent to
// the RPC as deactivated: true). A row that was never saved is just dropped.
function removeEntry(kind, id) {
  const list = kind === "work" ? draft.workItems : kind === "incident" ? draft.incidents : draft.photos;
  const baselineList = kind === "work" ? baseline.workItems : kind === "incident" ? baseline.incidents : baseline.photos;
  const index = list.findIndex((entry) => entry.id === id);
  if (index === -1) return;

  if (baselineList.some((entry) => entry.id === id)) {
    list[index].deactivated = true;
  } else {
    list.splice(index, 1);
  }
}

// Text-like inputs: update the draft without re-rendering, so focus/caret
// aren't lost mid-typing.
function handleWorkStatusInput(event) {
  const target = event.target;
  if (!target?.closest?.("#step-estado-obra")) return;

  if (target.id === "workStatusProgressSlider") {
    if (!editable) return;
    draft.progressPct = Math.max(0, Math.min(100, Number(target.value) || 0));
    markEdited();
    renderProgressSlider();
    updateSaveButtonState();
    return;
  }

  if (target.id === "workStatusSummary") {
    if (!editable) return;
    draft.summary = target.value;
    markEdited();
    updateSaveButtonState();
    return;
  }

  if (target.id === "workStatusNextSteps") {
    if (!editable) return;
    draft.nextSteps = target.value;
    markEdited();
    updateSaveButtonState();
    return;
  }

  const addWorkField = target.closest("[data-add-work-field]");
  if (addWorkField) {
    newWorkItemDraft[addWorkField.dataset.addWorkField] = addWorkField.value;
    return;
  }

  const addIncidentField = target.closest("[data-add-incident-field]");
  if (addIncidentField) {
    newIncidentDescription = addIncidentField.value;
    return;
  }

  const field = target.closest("[data-ws-field]");
  if (field && field.tagName !== "SELECT") {
    if (!editable) return;
    const entry = findEntry(field.dataset.wsKind, field.dataset.wsId);
    if (!entry) return;
    entry[field.dataset.wsField] = field.value;
    markEdited();
    updateSaveButtonState();
  }
}

// Selects: a status change moves a work item between lists, so re-render.
function handleWorkStatusChange(event) {
  const target = event.target;
  if (!target?.closest?.("#step-estado-obra")) return;

  if (target.id === "workStatusPhotoInput") {
    handlePhotoFileSelected(target);
    return;
  }

  const field = target.closest("[data-ws-field]");
  if (!field || field.tagName !== "SELECT") return;
  if (!requireEditableProject()) return;

  const entry = findEntry(field.dataset.wsKind, field.dataset.wsId);
  if (!entry) return;

  entry[field.dataset.wsField] = field.value;
  markEdited();

  if (field.dataset.wsKind === "work" && field.dataset.wsField === "status") {
    renderWorkLists();
  }

  updateSaveButtonState();
}

function requireEditableProject() {
  const projectId = appState.currentWorkStatusProjectId;
  const project = projectId ? getProjectById(projectId) : null;

  // Still loading (or load failed): controls are already rendered disabled,
  // this just makes sure a stray event can't edit the placeholder draft.
  if (project && canEditProject(project) && !editable) {
    return null;
  }

  if (!project) {
    alert("Projeto não encontrado.");
    return null;
  }

  if (!canEditProject(project)) {
    alert("Este projeto está arquivado. Não é possível alterar o estado da obra.");
    return null;
  }

  return project;
}

// Resolves true when the draft is persisted (or there was nothing to save).
async function handleSave() {
  if (saving || generating) return false;
  if (!isDirty()) return true;

  const project = requireEditableProject();
  if (!project) return false;

  const changes = buildChanges();
  saving = true;
  updateSaveButtonState();

  try {
    await saveProjectWorkspace({
      projectId: project.id,
      status: draft,
      workItems: changes.workItems,
      incidents: changes.incidents,
      photos: changes.photos,
    });
  } catch (error) {
    console.error("Error saving Estado da Obra:", error);
    saving = false;
    // The draft is left exactly as it was so nothing typed is lost.
    statusMessage = { text: `Erro ao guardar alterações: ${error.message}`, tone: "error" };
    updateSaveButtonState();
    return false;
  }

  saving = false;

  try {
    const fresh = await loadProjectWorkspace(project.id);
    baseline = fresh;
    draft = clone(fresh);
  } catch (error) {
    // Saved, but the re-read failed: the draft we sent is what's persisted.
    console.error("Error reloading Estado da Obra after save:", error);
    draft.workItems = draft.workItems.filter((item) => !item.deactivated);
    draft.incidents = draft.incidents.filter((incident) => !incident.deactivated);
    draft.photos = draft.photos.filter((photo) => !photo.deactivated);
    baseline = clone(draft);
  }

  resetTransientUiState();
  statusMessage = { text: "Alterações guardadas.", tone: "success" };
  renderAll();
  return true;
}

async function handlePhotoFileSelected(input) {
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;

  const project = requireEditableProject();
  if (!project) return;

  uploadingPhoto = true;
  renderPhotos();

  try {
    const photo = await addWorkspacePhoto({
      projectId: project.id,
      companyId: project.companyId,
      file,
    });

    // Already persisted — it joins the baseline too, so it doesn't count as
    // an unsaved change, and any other pending draft edits stay untouched.
    baseline.photos.push(clone(photo));
    draft.photos.push(photo);
  } catch (error) {
    console.error("Error uploading photo:", error);
    alert("Erro ao adicionar fotografia: " + error.message);
  } finally {
    uploadingPhoto = false;
    renderPhotos();
    updateSaveButtonState();
  }
}

// A value saved before the option list changed (or backfilled from a legacy
// report) still shows as selected instead of silently reading as blank.
function renderSelectOptions(options, selectedValue) {
  const all = selectedValue && !options.includes(selectedValue) ? [selectedValue, ...options] : options;

  return all
    .map((option) => {
      const selected = option === selectedValue ? " selected" : "";
      return `<option value="${escapeHtml(option)}"${selected}>${escapeHtml(option)}</option>`;
    })
    .join("");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
