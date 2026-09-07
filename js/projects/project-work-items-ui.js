// js/projects/project-work-items-ui.js
//
// PROJECT-MASTER-SHEET-001 — "Ver Estado da Obra" screen: a single mobile-first page
// consolidating a project's Pendentes / Em curso / Concluídas / Incidentes from its
// reports, with a quick-tap status control per work item.

import { appState } from "#state/app-state.js";
import { getProjectById } from "#projects/project-list.js";
import { goToStepId } from "#navigation/navigation.js";
import { canEditProject } from "#projects/project-status-rules.js";
import { loadProjectWorkState, setWorkItemStatus } from "#projects/project-work-items.js";

const STATUS_OPTIONS = [
  { value: "blocked", label: "Pendente" },
  { value: "progress", label: "Em curso" },
  { value: "done", label: "Concluída" },
];

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

  renderHeader(project);
  goToStepId("estado-obra");

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
      items: state.pendentes,
      editable,
      emptyMessage: "Sem trabalhos pendentes registados.",
    });

    renderWorkList({
      containerId: "workStatusProgressList",
      items: state.emCurso,
      editable,
      emptyMessage: "Sem trabalhos em curso registados.",
    });

    renderWorkList({
      containerId: "workStatusDoneList",
      items: state.concluidas,
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

function renderWorkList({ containerId, items, editable, emptyMessage }) {
  const el = document.getElementById(containerId);
  if (!el) return;

  if (items.length === 0) {
    el.innerHTML = `<p class="empty-hint">${escapeHtml(emptyMessage)}</p>`;
    return;
  }

  el.innerHTML = items.map((item) => renderWorkItemCard(item, editable)).join("");
}

function renderWorkItemCard(item, editable) {
  const title = [item.type, item.area].filter(Boolean).join(" · ") || "Trabalho";
  const meta = item.sourceReportNum
    ? `Relatório #${escapeHtml(item.sourceReportNum)} · ${escapeHtml(formatShortDate(item.sourceReportDate))}`
    : "";

  return `
    <div class="work-status-item-card">
      <div class="work-status-item-title">${escapeHtml(title)}</div>
      ${item.desc ? `<div class="work-status-item-desc">${escapeHtml(item.desc)}</div>` : ""}
      ${meta ? `<div class="work-status-item-meta">${meta}</div>` : ""}

      <div class="work-status-segmented" role="group" aria-label="Estado do trabalho">
        ${STATUS_OPTIONS.map((option) => renderStatusButton(item, option, editable)).join("")}
      </div>
    </div>
  `;
}

function renderStatusButton(item, option, editable) {
  const isActive = item.status === option.value;
  const stateClass = isActive ? ` is-active is-${option.value}` : "";

  return `
    <button
      type="button"
      class="work-status-seg-btn${stateClass}"
      data-work-status-action="set-status"
      data-item-id="${escapeHtml(item.id)}"
      data-status="${escapeHtml(option.value)}"
      data-source-report-id="${escapeHtml(item.sourceReportId || "")}"
      ${!editable || isActive ? "disabled" : ""}
    >
      ${escapeHtml(option.label)}
    </button>
  `;
}

function renderIncidentsList(incidents) {
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

  const segmentedGroup = button.closest(".work-status-segmented");
  segmentedGroup?.querySelectorAll("button").forEach((btn) => {
    btn.disabled = true;
  });

  try {
    await setWorkItemStatus({ projectId, itemId, status, sourceReportId });
    await renderMasterSheet(project);
  } catch (error) {
    console.error("Error saving work item status:", error);
    alert("Erro ao guardar alteração: " + error.message);

    segmentedGroup?.querySelectorAll("button").forEach((btn) => {
      btn.disabled = false;
    });
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
