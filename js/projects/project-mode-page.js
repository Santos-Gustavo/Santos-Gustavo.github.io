import {
  canArchiveProject,
  canCompleteProject,
  canHideProject,
  canPauseProject,
  canReopenProject,
  canResumeProject,
  getProjectStatusLabel,
} from "#projects/project-status-rules.js";

export function renderProjectModePage(project) {
  renderProjectModeHeader(project);
  renderProjectLifecycleActions(project);
}

function renderProjectModeHeader(project) {
  const modeProjectLabel = document.getElementById("modeProjectLabel");

  if (modeProjectLabel) {
    modeProjectLabel.textContent = project?.name || "";
  }

  const modeProjectStatus = document.getElementById("modeProjectStatus");

  if (modeProjectStatus) {
    modeProjectStatus.textContent = getProjectStatusLabel(project?.status);
  }
}

function renderProjectLifecycleActions(project) {
  const container = document.getElementById("projectLifecycleActions");

  if (!container || !project?.id) {
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