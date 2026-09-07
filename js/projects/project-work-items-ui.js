// js/projects/project-work-items-ui.js
//
// PROJECT-MASTER-SHEET-001 — "Ver Estado da Obra" screen: a single mobile-first page
// consolidating a project's Pendentes / Em curso / Concluídas / Incidentes from its
// reports, with a quick-tap status control per work item.

import { appState } from "#state/app-state.js";
import { getProjectById } from "#projects/project-list.js";
import { goToStepId } from "#navigation/navigation.js";
import { canEditProject, canCreateWeeklyReport } from "#projects/project-status-rules.js";
import { loadProjectWorkState, setWorkItemStatus } from "#projects/project-work-items.js";

// One action per item, not a 3-way picker — an open item (Pendente or Em curso)
// only ever offers "Marcar como concluída"; a completed item only ever offers
// "Reabrir" (back to Em curso — a reopened item is being worked on again, not
// back to untouched). Keeps the tap surface to a single obvious choice instead
// of asking the contractor to pick from three states every time.
const REOPEN_STATUS = "progress";
const COMPLETE_STATUS = "done";

let initialized = false;

export function initProjectWorkItemsUi() {
  if (initialized) return;
  initialized = true;

  document.addEventListener("click", handleWorkStatusClick);
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
  // (skipping selectProject()) still lets that shortcut work.
  appState.currentProjectId = project.id;
  appState.currentProject = project;

  renderHeader(project);
  goToStepId("estado-obra");

  const generateReportBtn = document.getElementById("workStatusGenerateReportBtn");
  if (generateReportBtn) {
    generateReportBtn.hidden = !canCreateWeeklyReport(project);
  }

  await renderMasterSheet(project);
}

function renderHeader(project) {
  const nameEl = document.getElementById("workStatusProjectLabel");
  const clientEl = document.getElementById("workStatusClientLabel");

  if (nameEl) {
    nameEl.textContent = project.name || "";
  }

  if (clientEl) {
    clientEl.textContent = project.clientName ? `Cliente: ${project.clientName}` : "";
  }
}

async function renderMasterSheet(project) {
  const editable = canEditProject(project);

  setListLoading("workStatusPendingList");
  setListLoading("workStatusProgressList");
  setListLoading("workStatusDoneList");
  setListLoading("workStatusIncidentsList");

  try {
    const state = await loadProjectWorkState(project.id);

    renderProgress(state.progressPct);

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
  } catch (error) {
    console.error("Error loading Estado da Obra:", error);

    const message = `Erro ao carregar estado da obra: ${escapeHtml(error.message)}`;

    setListError("workStatusPendingList", message);
    setListError("workStatusProgressList", message);
    setListError("workStatusDoneList", message);
    setListError("workStatusIncidentsList", message);
  }
}

function renderProgress(progressPct) {
  const fill = document.getElementById("workStatusProgressFill");
  const pct = document.getElementById("workStatusProgressPct");

  const clamped = Math.max(0, Math.min(100, Number(progressPct) || 0));

  if (fill) {
    fill.style.width = `${clamped}%`;
  }

  if (pct) {
    pct.textContent = `${clamped}%`;
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

async function handleWorkStatusClick(event) {
  const button = event.target.closest('[data-work-status-action="set-status"]');
  if (!button) return;

  event.preventDefault();

  const projectId = appState.currentWorkStatusProjectId;
  const project = projectId ? getProjectById(projectId) : null;

  if (!project) {
    alert("Projeto não encontrado.");
    return;
  }

  if (!canEditProject(project)) {
    alert("Este projeto está arquivado. Não é possível alterar o estado dos trabalhos.");
    return;
  }

  const itemId = button.dataset.itemId;
  const status = button.dataset.status;
  const sourceReportId = button.dataset.sourceReportId || null;

  button.disabled = true;

  try {
    await setWorkItemStatus({ projectId, itemId, status, sourceReportId });
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
