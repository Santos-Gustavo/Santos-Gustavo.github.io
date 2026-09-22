// js/projects/project-work-items-ui.js
//
// PROJECT-MASTER-SHEET-001 — "Ver Estado da Obra" screen: a single mobile-first page
// consolidating a project's Pendentes / Em curso / Concluídas / Incidentes from its
// reports, with a quick-tap status control per work item.

import { appState } from "#state/app-state.js";
import { getProjectById } from "#projects/project-list.js";
import { goToStepId } from "#navigation/navigation.js";
import { canEditProject, canCreateWeeklyReport } from "#projects/project-status-rules.js";
import { loadProjectIntoForm } from "#projects/project-form.js";
import { JOB_TYPES, AREAS } from "#config/app-options.js";
import {
  loadProjectWorkState,
  setWorkItemStatus,
  addWorkItem,
  loadSavedProjectStatus,
  saveEditableProjectStatus,
} from "#projects/project-work-items.js";

// One action per item, not a 3-way picker — an open item (Pendente or Em curso)
// only ever offers "Marcar como concluída"; a completed item only ever offers
// "Reabrir" (back to Em curso — a reopened item is being worked on again, not
// back to untouched). Keeps the tap surface to a single obvious choice instead
// of asking the contractor to pick from three states every time.
const REOPEN_STATUS = "progress";
const COMPLETE_STATUS = "done";

// Same 8 phase labels as the weekly report's own step 3 (app.html #phasePicker)
// — deliberately a separate, self-contained picker here (own class names, own
// data attribute) rather than reusing .phase-option/[data-phase]: those are
// wired to a *global* delegated handler (js/ui/ui-controls.js) that writes
// straight to appState.phase, the live report-draft field. Estado da Obra's
// phase is a local, unsaved draft until "Guardar alterações" — sharing the
// element would either overwrite the in-progress report draft or get silently
// overwritten by it.
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

// PROJECT-HUB-INTEGRATION-001 — explicit manual save, no autosave (dirty
// state / debounce / partial-save-error complexity isn't worth it for this
// MVP). `saved` is the last value known to be persisted (or the report-derived
// fallback, treated as already "saved" — there's nothing to lose by leaving
// without touching it); `draft` is what's currently on screen. The two are
// compared to decide whether "Guardar alterações" is enabled and whether
// leaving the screen should warn.
let saved = { phase: "", progressPct: 0, summary: "" };
let draft = { phase: "", progressPct: 0, summary: "" };

// PROJECT-HUB-INTEGRATION-001 — "+ Adicionar trabalho" opens the same fields
// as adding a work item on a weekly report (js/projects/sections/works.js's
// renderWorkCard: Tipo de trabalho / Área / Descrição / Estado) instead of a
// bare free-text prompt. This is its own local draft, submitted immediately
// on "Adicionar" (not part of the Guardar alterações draft above).
const NEW_WORK_ITEM_STATUS_OPTIONS = [
  { value: "blocked", label: "Pendente / Bloqueado" },
  { value: "progress", label: "Em curso" },
  { value: "done", label: "Concluído" },
];

let addWorkItemFormOpen = false;
let newWorkItemDraft = { type: "", area: "", desc: "", status: "blocked" };

let initialized = false;

export function initProjectWorkItemsUi() {
  if (initialized) return;
  initialized = true;

  document.addEventListener("click", handleWorkStatusClick);
  document.addEventListener("input", handleWorkStatusInput);
  document.addEventListener("change", handleWorkStatusInput);
}

export async function openProjectMasterSheet(projectId) {
  const project = getProjectById(projectId);

  if (!project) {
    alert("Projeto não encontrado na base de dados.");
    return;
  }

  appState.currentWorkStatusProjectId = project.id;
  // The "Gerar relatório semanal" shortcut on this screen calls the same
  // selectMode("weekly") every other entry point uses, which reads these —
  // set them here too so opening Estado da Obra straight from a project card
  // (skipping selectProject()) still lets that shortcut work. currentCompanyId
  // / currentClientId matter just as much as currentProjectId: report-save.js
  // only attaches a new report to this project when all three are set —
  // without them it silently falls through to its "no project selected"
  // branch and creates a brand-new client + project instead. loadProjectIntoForm
  // fills the #clientName/#projectName/... DOM fields report-document-builder.js
  // reads from, same as selectProject() does for the "Mais opções" path.
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

  await renderMasterSheet(project);
}

// Exported for navigation.js — guards the "Voltar às obras" / "Gerar
// relatório semanal" actions on this screen with a confirm dialog when there
// are edits that were never saved. Gated on currentStepId so a stale draft
// left over from a previous visit can never misfire once the user has moved
// on to an unrelated screen.
export function hasUnsavedWorkStatusChanges() {
  if (appState.currentStepId !== "estado-obra") return false;

  return (
    draft.phase !== saved.phase ||
    draft.progressPct !== saved.progressPct ||
    draft.summary !== saved.summary
  );
}

function renderHeader(project) {
  const nameEl = document.getElementById("workStatusProjectLabel");
  const clientEl = document.getElementById("workStatusClientLabel");
  const moreOptionsBtn = document.getElementById("workStatusMoreOptionsBtn");

  if (nameEl) {
    nameEl.textContent = project.name || "";
  }

  if (clientEl) {
    clientEl.textContent = project.clientName ? `Cliente: ${project.clientName}` : "";
  }

  // "Mais opções" (Tipo de Relatório / histórico / ações do projeto) now
  // lives on Estado da Obra itself, not the project list card — the card's
  // own click already opens Estado da Obra directly. handleProjectClick in
  // project-index.js reads this same data-project-id off the button.
  if (moreOptionsBtn) {
    moreOptionsBtn.dataset.projectId = project.id;
  }
}

async function renderMasterSheet(project) {
  const editable = canEditProject(project);

  addWorkItemFormOpen = false;
  newWorkItemDraft = { type: "", area: "", desc: "", status: "blocked" };

  setListLoading("workStatusPendingList");
  setListLoading("workStatusProgressList");
  setListLoading("workStatusDoneList");
  setListLoading("workStatusIncidentsList");
  setListLoading("workStatusNextStepsList");

  try {
    const [state, savedStatus] = await Promise.all([
      loadProjectWorkState(project.id),
      loadSavedProjectStatus(project.id),
    ]);

    saved = savedStatus || { phase: state.phase, progressPct: state.progressPct, summary: "" };
    draft = { ...saved };

    renderEditablePanel(editable);

    renderWorkList({
      containerId: "workStatusPendingList",
      headingId: "workStatusPendingHeading",
      headingLabel: "Pendentes",
      items: state.pendentes,
      accent: "pending",
      editable,
      emptyMessage: "Sem trabalhos pendentes registados.",
    });

    renderWorkList({
      containerId: "workStatusProgressList",
      headingId: "workStatusProgressHeading",
      headingLabel: "Em curso",
      items: state.emCurso,
      accent: "progress",
      editable,
      emptyMessage: "Sem trabalhos em curso registados.",
    });

    renderWorkList({
      containerId: "workStatusDoneList",
      headingId: "workStatusDoneHeading",
      headingLabel: "Concluídas",
      items: state.concluidas,
      accent: "done",
      editable,
      emptyMessage: "Sem trabalhos concluídos registados.",
    });

    renderIncidentsList(state.incidentes);
    renderNextStepsList(state.proximosPassos);
  } catch (error) {
    console.error("Error loading Estado da Obra:", error);

    const message = `Erro ao carregar estado da obra: ${escapeHtml(error.message)}`;

    setListError("workStatusPendingList", message);
    setListError("workStatusProgressList", message);
    setListError("workStatusDoneList", message);
    setListError("workStatusIncidentsList", message);
    setListError("workStatusNextStepsList", message);
  }
}

function renderEditablePanel(editable) {
  renderPhasePicker(editable);
  renderProgressSlider();
  renderSummaryField(editable);

  const slider = document.getElementById("workStatusProgressSlider");
  if (slider) {
    slider.disabled = !editable;
  }

  if (!editable) {
    addWorkItemFormOpen = false;
  }

  const addWorkItemBtn = document.getElementById("workStatusAddWorkItemBtn");
  if (addWorkItemBtn) {
    addWorkItemBtn.hidden = !editable || addWorkItemFormOpen;
  }

  renderAddWorkItemForm();

  const saveBtn = document.getElementById("workStatusSaveBtn");
  if (saveBtn) {
    saveBtn.hidden = !editable;
  }

  updateSaveButtonState();
}

function renderAddWorkItemForm() {
  const container = document.getElementById("workStatusAddWorkItemForm");
  if (!container) return;

  container.hidden = !addWorkItemFormOpen;

  if (!addWorkItemFormOpen) {
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
        data-add-work-field="desc"
        placeholder="Ex: Aplicação de primário nas paredes da sala"
      >${escapeHtml(newWorkItemDraft.desc)}</textarea>
    </div>

    <div class="field">
      <label>Estado</label>
      <select data-add-work-field="status">
        ${NEW_WORK_ITEM_STATUS_OPTIONS.map(
          (option) =>
            `<option value="${option.value}"${option.value === newWorkItemDraft.status ? " selected" : ""}>${option.label}</option>`
        ).join("")}
      </select>
    </div>

    <div class="work-status-add-form-actions">
      <button type="button" class="btn-add" data-work-status-action="submit-add-work-item">Adicionar</button>
      <button type="button" class="btn-cancel-work-item" data-work-status-action="cancel-add-work-item">Cancelar</button>
    </div>
  `;
}

function renderSelectOptions(options, selectedValue) {
  return options
    .map((option) => {
      const selected = option === selectedValue ? " selected" : "";
      return `<option value="${escapeHtml(option)}"${selected}>${escapeHtml(option)}</option>`;
    })
    .join("");
}

function renderPhasePicker(editable) {
  const el = document.getElementById("workStatusPhasePicker");
  if (!el) return;

  el.innerHTML = PHASE_OPTIONS.map((phase) => `
    <div
      class="work-status-phase-option${phase === draft.phase ? " selected" : ""}"
      data-work-status-phase="${escapeHtml(phase)}"
    >${escapeHtml(phase)}</div>
  `).join("");

  el.classList.toggle("is-readonly", !editable);
}

function renderProgressSlider() {
  const slider = document.getElementById("workStatusProgressSlider");
  const fill = document.getElementById("workStatusProgressFill");
  const pct = document.getElementById("workStatusProgressPct");

  if (slider) {
    slider.value = String(draft.progressPct);
  }

  if (fill) {
    fill.style.width = `${draft.progressPct}%`;
  }

  if (pct) {
    pct.textContent = `${draft.progressPct}%`;
  }
}

function renderSummaryField(editable) {
  const textarea = document.getElementById("workStatusSummary");
  if (!textarea) return;

  textarea.value = draft.summary;
  textarea.disabled = !editable;
}

function updateSaveButtonState() {
  const btn = document.getElementById("workStatusSaveBtn");
  const hint = document.getElementById("workStatusSaveHint");
  const dirty = hasUnsavedWorkStatusChanges();

  if (btn) {
    btn.disabled = !dirty;
  }

  if (hint) {
    hint.textContent = dirty ? "Existem alterações por guardar." : "";
  }
}

function renderWorkList({ containerId, headingId, headingLabel, items, accent, editable, emptyMessage }) {
  const heading = document.getElementById(headingId);
  if (heading) {
    heading.textContent = `${headingLabel} (${items.length})`;
  }

  const el = document.getElementById(containerId);
  if (!el) return;

  if (items.length === 0) {
    el.innerHTML = `<p class="empty-hint">${escapeHtml(emptyMessage)}</p>`;
    return;
  }

  el.innerHTML = items.map((item) => renderWorkItemCard(item, accent, editable)).join("");
}

function renderWorkItemCard(item, accent, editable) {
  const title = [item.type, item.area].filter(Boolean).join(" · ") || "Trabalho";
  const meta = item.sourceReportNum
    ? `Relatório #${escapeHtml(item.sourceReportNum)} · ${escapeHtml(formatShortDate(item.sourceReportDate))}`
    : "";

  const isDone = item.status === COMPLETE_STATUS;
  const actionLabel = isDone ? "Reabrir" : "Marcar como concluída";
  const actionStatus = isDone ? REOPEN_STATUS : COMPLETE_STATUS;
  const actionClass = isDone ? "work-status-item-action--reopen" : "work-status-item-action--complete";

  return `
    <div class="work-status-item-card work-status-item-card--${accent}">
      <div class="work-status-item-title">${escapeHtml(title)}</div>
      ${item.desc ? `<div class="work-status-item-desc">${escapeHtml(item.desc)}</div>` : ""}
      ${meta ? `<div class="work-status-item-meta">${meta}</div>` : ""}

      <button
        type="button"
        class="work-status-item-action ${actionClass}"
        data-work-status-action="set-status"
        data-item-id="${escapeHtml(item.id)}"
        data-status="${escapeHtml(actionStatus)}"
        data-source-report-id="${escapeHtml(item.sourceReportId || "")}"
        ${editable ? "" : "disabled"}
      >
        ${escapeHtml(actionLabel)}
      </button>
    </div>
  `;
}

function renderIncidentsList(incidents) {
  const heading = document.getElementById("workStatusIncidentsHeading");
  if (heading) {
    heading.textContent = `Incidentes (${incidents.length})`;
  }

  const el = document.getElementById("workStatusIncidentsList");
  if (!el) return;

  if (incidents.length === 0) {
    el.innerHTML = `<p class="empty-hint">Sem incidentes registados.</p>`;
    return;
  }

  el.innerHTML = incidents
    .map((incident) => {
      const meta = incident.sourceReportNum
        ? `Relatório #${escapeHtml(incident.sourceReportNum)} · ${escapeHtml(formatShortDate(incident.sourceReportDate))}`
        : "";

      return `
        <div class="work-status-item-card work-status-incident-card">
          <div class="work-status-item-desc">${escapeHtml(incident.desc)}</div>
          ${meta ? `<div class="work-status-item-meta">${meta}</div>` : ""}
        </div>
      `;
    })
    .join("");
}

function renderNextStepsList(nextSteps) {
  const heading = document.getElementById("workStatusNextStepsHeading");
  if (heading) {
    heading.textContent = `Próximos Passos (${nextSteps.length})`;
  }

  const el = document.getElementById("workStatusNextStepsList");
  if (!el) return;

  if (nextSteps.length === 0) {
    el.innerHTML = `<p class="empty-hint">Sem próximos passos registados.</p>`;
    return;
  }

  el.innerHTML = nextSteps
    .map((nextStep) => {
      const meta = nextStep.sourceReportNum
        ? `Relatório #${escapeHtml(nextStep.sourceReportNum)} · ${escapeHtml(formatShortDate(nextStep.sourceReportDate))}`
        : "";

      return `
        <div class="work-status-item-card work-status-nextstep-card">
          <div class="work-status-item-desc">${escapeHtml(nextStep.desc)}</div>
          ${nextStep.date ? `<div class="work-status-item-meta">Data prevista: ${escapeHtml(formatShortDate(nextStep.date))}</div>` : ""}
          ${meta ? `<div class="work-status-item-meta">${meta}</div>` : ""}
        </div>
      `;
    })
    .join("");
}

async function handleWorkStatusClick(event) {
  const phaseOption = event.target.closest("[data-work-status-phase]");
  if (phaseOption) {
    handlePhaseOptionClick(phaseOption);
    return;
  }

  const saveBtn = event.target.closest('[data-work-status-action="save"]');
  if (saveBtn) {
    event.preventDefault();
    await handleSaveClick(saveBtn);
    return;
  }

  const addWorkItemBtn = event.target.closest('[data-work-status-action="add-work-item"]');
  if (addWorkItemBtn) {
    event.preventDefault();
    handleOpenAddWorkItemForm();
    return;
  }

  const cancelAddWorkItemBtn = event.target.closest(
    '[data-work-status-action="cancel-add-work-item"]'
  );
  if (cancelAddWorkItemBtn) {
    event.preventDefault();
    handleCancelAddWorkItem();
    return;
  }

  const submitAddWorkItemBtn = event.target.closest(
    '[data-work-status-action="submit-add-work-item"]'
  );
  if (submitAddWorkItemBtn) {
    event.preventDefault();
    await handleSubmitAddWorkItem(submitAddWorkItemBtn);
    return;
  }

  const statusBtn = event.target.closest('[data-work-status-action="set-status"]');
  if (statusBtn) {
    event.preventDefault();
    await handleSetStatusClick(statusBtn);
  }
}

function requireEditableProject() {
  const projectId = appState.currentWorkStatusProjectId;
  const project = projectId ? getProjectById(projectId) : null;

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

function handlePhaseOptionClick(phaseOption) {
  if (!requireEditableProject()) return;

  draft.phase = phaseOption.dataset.workStatusPhase;
  renderPhasePicker(true);
  updateSaveButtonState();
}

function handleWorkStatusInput(event) {
  const target = event.target;

  if (target?.id === "workStatusProgressSlider") {
    draft.progressPct = Math.max(0, Math.min(100, Number(target.value) || 0));
    renderProgressSlider();
    updateSaveButtonState();
    return;
  }

  if (target?.id === "workStatusSummary") {
    draft.summary = target.value;
    updateSaveButtonState();
    return;
  }

  const addWorkField = target?.closest?.("[data-add-work-field]");
  if (addWorkField) {
    const key = addWorkField.dataset.addWorkField;
    if (key === "type" || key === "area" || key === "desc" || key === "status") {
      newWorkItemDraft[key] = addWorkField.value;
    }
  }
}

async function handleSaveClick(button) {
  const project = requireEditableProject();
  if (!project) return;

  button.disabled = true;

  try {
    await saveEditableProjectStatus({
      projectId: project.id,
      companyId: project.companyId,
      phase: draft.phase,
      progressPct: draft.progressPct,
      summary: draft.summary,
    });

    saved = { ...draft };
    updateSaveButtonState();
    alert("Alterações guardadas.");
  } catch (error) {
    console.error("Error saving Estado da Obra:", error);
    alert("Erro ao guardar alterações: " + error.message);
    button.disabled = false;
  }
}

function handleOpenAddWorkItemForm() {
  if (!requireEditableProject()) return;

  addWorkItemFormOpen = true;
  newWorkItemDraft = { type: "", area: "", desc: "", status: "blocked" };

  const addWorkItemBtn = document.getElementById("workStatusAddWorkItemBtn");
  if (addWorkItemBtn) {
    addWorkItemBtn.hidden = true;
  }

  renderAddWorkItemForm();
}

function handleCancelAddWorkItem() {
  addWorkItemFormOpen = false;
  newWorkItemDraft = { type: "", area: "", desc: "", status: "blocked" };

  const addWorkItemBtn = document.getElementById("workStatusAddWorkItemBtn");
  if (addWorkItemBtn) {
    addWorkItemBtn.hidden = false;
  }

  renderAddWorkItemForm();
}

async function handleSubmitAddWorkItem(button) {
  const project = requireEditableProject();
  if (!project) return;

  if (!newWorkItemDraft.desc.trim()) {
    alert("Descreva o trabalho antes de adicionar.");
    return;
  }

  button.disabled = true;

  try {
    await addWorkItem({
      projectId: project.id,
      type: newWorkItemDraft.type,
      area: newWorkItemDraft.area,
      desc: newWorkItemDraft.desc,
      status: newWorkItemDraft.status,
    });

    await renderMasterSheet(project);
  } catch (error) {
    console.error("Error adding work item:", error);
    alert("Erro ao adicionar trabalho: " + error.message);
    button.disabled = false;
  }
}

async function handleSetStatusClick(button) {
  const project = requireEditableProject();
  if (!project) return;

  const itemId = button.dataset.itemId;
  const status = button.dataset.status;
  const sourceReportId = button.dataset.sourceReportId || null;

  button.disabled = true;

  try {
    await setWorkItemStatus({ projectId: project.id, itemId, status, sourceReportId });
    await renderMasterSheet(project);
  } catch (error) {
    console.error("Error saving work item status:", error);
    alert("Erro ao guardar alteração: " + error.message);

    button.disabled = false;
  }
}

function setListLoading(containerId) {
  const el = document.getElementById(containerId);
  if (el) {
    el.innerHTML = `<p class="empty-hint">A carregar...</p>`;
  }
}

function setListError(containerId, message) {
  const el = document.getElementById(containerId);
  if (el) {
    el.innerHTML = `<p class="empty-hint">${message}</p>`;
  }
}

function formatShortDate(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("pt-PT");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
