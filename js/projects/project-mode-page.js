import {
  canArchiveProject,
  canCompleteProject,
  canHideProject,
  canPauseProject,
  canReopenProject,
  canResumeProject,
  getProjectStatusLabel,
} from "#projects/project-status-rules.js";

// POST-RELEASE-POLISH-001 — the old "Tipo de Relatório" page is gone; the
// project's status line and lifecycle actions (pausar, retomar, concluir,
// arquivar, ocultar, reabrir — whichever the status rules allow) now render
// in Estado da Obra's header.
export function renderProjectHubActions(project) {
  const status = document.getElementById("workStatusProjectStatus");

  if (status) {
    status.textContent = project ? getProjectStatusLabel(project.status) : "";
  }

  renderProjectLifecycleActions(project);
}

function renderProjectLifecycleActions(project) {
  const container = document.getElementById("projectLifecycleActions");

  if (!container) {
    return;
  }

  if (!project?.id) {
    container.innerHTML = "";
    return;
  }

  const actions = [];

  if (canPauseProject(project)) {
    actions.push(`
      <button
        type="button"
        class="btn-secondary"
        data-project-lifecycle-action="pause"
        data-project-id="${escapeHtml(project.id)}"
      >
        Pausar projeto
      </button>
    `);
  }

  if (canResumeProject(project)) {
    actions.push(`
      <button
        type="button"
        class="btn-secondary"
        data-project-lifecycle-action="resume"
        data-project-id="${escapeHtml(project.id)}"
      >
        Retomar projeto
      </button>
    `);
  }

  if (canCompleteProject(project)) {
    actions.push(`
      <button
        type="button"
        class="btn-secondary"
        data-project-lifecycle-action="complete"
        data-project-id="${escapeHtml(project.id)}"
      >
        Marcar como concluído
      </button>
    `);
  }

  if (canArchiveProject(project)) {
    actions.push(`
      <button
        type="button"
        class="btn-secondary"
        data-project-lifecycle-action="archive"
        data-project-id="${escapeHtml(project.id)}"
      >
        Arquivar projeto
      </button>
    `);
  }

  if (canHideProject(project)) {
    actions.push(`
      <button
        type="button"
        class="btn-secondary"
        data-project-lifecycle-action="hide"
        data-project-id="${escapeHtml(project.id)}"
      >
        Ocultar projeto
      </button>
    `);
  }

  if (canReopenProject(project)) {
    actions.push(`
      <button
        type="button"
        class="btn-secondary"
        data-project-lifecycle-action="reopen"
        data-project-id="${escapeHtml(project.id)}"
      >
        Reabrir projeto
      </button>
    `);
  }

  container.innerHTML = actions.join("");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}