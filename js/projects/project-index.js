import {
  bindProjectListFilters,
  getProjectById,
  renderProjectList,
} from "#projects/project-list.js";

import { saveCurrentProjectFromForm } from "#projects/project-save.js";

import { deleteProject } from "#projects/project-delete.js";

import {
  newProject,
  selectProject,
  editProject,
} from "#projects/project-selection.js";

import {
  clearProjectForm,
  loadProjectIntoForm,
  applyDefaultReportFields,
} from "#projects/project-form.js";

import {
  archiveProject,
  completeProject,
  hideArchivedProject,
  pauseProject,
  reopenProject,
  resumeProject,
} from "#projects/project-status-transitions.js";

let initialized = false;

export function initProjects() {
  if (initialized) return;

  initialized = true;

  bindProjectListFilters();

  document.addEventListener("click", handleProjectClick);
  document.addEventListener("click", handleProjectLifecycleClick);
}

async function handleProjectClick(event) {
  const actionEl = event.target.closest("[data-project-action]");

  if (!actionEl) return;

  const action = actionEl.dataset.projectAction;
  const projectId = actionEl.dataset.projectId;

  event.preventDefault();
  event.stopPropagation();

  if (action === "new-project") {
    newProject();
    return;
  }

  if (action === "select") {
    selectProject(projectId);
    return;
  }

  if (action === "edit") {
    editProject(projectId);
    return;
  }

  if (action === "delete") {
    await deleteProject(projectId);
  }
}

async function handleProjectLifecycleClick(event) {
  const actionEl = event.target.closest("[data-project-lifecycle-action]");

  if (!actionEl) return;

  const action = actionEl.dataset.projectLifecycleAction;
  const projectId = actionEl.dataset.projectId;
  const project = getProjectById(projectId);

  event.preventDefault();
  event.stopPropagation();

  if (!project) {
    alert("Projeto não encontrado.");
    return;
  }

  try {
    const reason = prompt(getLifecycleReasonPrompt(action, project));

    if (!reason || !reason.trim()) {
      return;
    }

    const trimmedReason = reason.trim();

    if (action === "pause") {
      await pauseProject(project, { reason: trimmedReason });
    }

    if (action === "resume") {
      await resumeProject(project, { reason: trimmedReason });
    }

    if (action === "complete") {
      await completeProject(project, { reason: trimmedReason });
    }

    if (action === "archive") {
      await archiveProject(project, { reason: trimmedReason });
    }

    if (action === "hide") {
      await hideArchivedProject(project, { reason: trimmedReason });
    }

    if (action === "reopen") {
      await reopenProject(project, { reason: trimmedReason });
    }

    await renderProjectList();

    const updatedProject = getProjectById(projectId);

    if (updatedProject) {
      selectProject(projectId);
    }
  } catch (error) {
    console.error("Error changing project lifecycle:", error);
    alert("Erro ao alterar estado da obra: " + error.message);
  }
}

function getLifecycleReasonPrompt(action, project) {
  const projectName = project?.name || "esta obra";

  if (action === "pause") {
    return `Indique o motivo para pausar a obra "${projectName}":`;
  }

  if (action === "resume") {
    return `Indique o motivo para retomar a obra "${projectName}":`;
  }

  if (action === "complete") {
    return `Indique o motivo para marcar a obra "${projectName}" como concluída:`;
  }

  if (action === "archive") {
    return `Indique o motivo para arquivar a obra "${projectName}":`;
  }

  if (action === "hide") {
    return `Indique o motivo para ocultar a obra "${projectName}":`;
  }

  if (action === "reopen") {
    return `Indique o motivo para reabrir a obra "${projectName}":`;
  }

  return `Indique o motivo para alterar o estado da obra "${projectName}":`;
}