import {
  bindProjectListFilters,
  getProjectById,
  renderProjectList,
} from "#projects/project-list.js";

import { saveCurrentProjectFromForm } from "#projects/project-save.js";

import { archiveOrHideProject } from "#projects/project-archive.js";

import {
  newProject,
  editProject,
} from "#projects/project-selection.js";

import {
  openProjectMasterSheet,
  hasUnsavedWorkStatusChanges,
} from "#projects/project-work-items-ui.js";

import { goHome } from "#navigation/navigation.js";
import { confirmAction } from "#ui/confirm-dialog.js";

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

import { appState } from "#state/app-state.js";


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
    await newProject();
    return;
  }

  if (action === "select") {
    // PROJECT-HUB-INTEGRATION-001 / POST-RELEASE-POLISH-001 — Estado da Obra
    // is the project hub: report generation, Legal / Financeiro, saved
    // reports and lifecycle actions all live there.
    await openProjectMasterSheet(projectId);
    return;
  }

  if (action === "edit") {
    await editProject(projectId);
    return;
  }

  if (action === "archive-hide") {
    await archiveOrHideProject(projectId);
  }
}

async function handleProjectLifecycleClick(event) {
  const actionEl = event.target.closest("[data-project-lifecycle-action]");

  if (!actionEl) return;

  const action = actionEl.dataset.projectLifecycleAction;
  const projectId = actionEl.dataset.projectId;
  const project =
    getProjectById(projectId) ||
    (appState.currentProjectId === projectId ? appState.currentProject : null);

  event.preventDefault();
  event.stopPropagation();

  if (!project) {
    alert("Projeto não encontrado.");
    return;
  }

  // A status change reloads Estado da Obra (and can make it read-only), which
  // would drop an unsaved draft — never silently.
  if (hasUnsavedWorkStatusChanges()) {
    await confirmAction({
      title: "Alterações por guardar",
      message: "Existem alterações por guardar. Guarde as alterações antes de alterar o estado do projeto.",
      confirmLabel: "OK",
      cancelLabel: null,
    });
    return;
  }

  try {
    const reason = prompt(getLifecycleReasonPrompt(action, project));

    if (!reason || !reason.trim()) {
      return;
    }

    const trimmedReason = reason.trim();

    let updatedProject = null;

    if (action === "pause") {
      updatedProject = await pauseProject(project, { reason: trimmedReason });
    }

    if (action === "resume") {
      updatedProject = await resumeProject(project, { reason: trimmedReason });
    }

    if (action === "complete") {
      updatedProject = await completeProject(project, { reason: trimmedReason });
    }

    if (action === "archive") {
      updatedProject = await archiveProject(project, { reason: trimmedReason });
    }

    if (action === "hide") {
      updatedProject = await hideArchivedProject(project, { reason: trimmedReason });
    }

    if (action === "reopen") {
      updatedProject = await reopenProject(project, { reason: trimmedReason });
    }

    if (!updatedProject) return;

    // Refreshes appState.projectsCache with the new status.
    await renderProjectList();

    // A hidden project leaves the normal views; everything else stays in its
    // Estado da Obra, re-rendered for the new status (actions, read-only, …).
    if (action === "hide") {
      goHome();
      return;
    }

    await openProjectMasterSheet(projectId);
  } catch (error) {
    console.error("Error changing project lifecycle:", error);
    alert("Erro ao alterar estado do projeto: " + error.message);
  }
}

function getLifecycleReasonPrompt(action, project) {
  const projectName = project?.name || "este projeto";

  if (action === "pause") {
    return `Indique o motivo para pausar o projeto "${projectName}":`;
  }

  if (action === "resume") {
    return `Indique o motivo para retomar o projeto "${projectName}":`;
  }

  if (action === "complete") {
    return `Indique o motivo para marcar o projeto "${projectName}" como concluído:`;
  }

  if (action === "archive") {
    return `Indique o motivo para arquivar o projeto "${projectName}":`;
  }

  if (action === "hide") {
    return `Indique o motivo para ocultar o projeto "${projectName}":`;
  }

  if (action === "reopen") {
    return `Indique o motivo para reabrir o projeto "${projectName}":`;
  }

  return `Indique o motivo para alterar o estado do projeto "${projectName}":`;
}