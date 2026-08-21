import { appState } from "#state/app-state.js";
import {
  archiveProject,
  hideArchivedProject,
} from "#projects/project-status-transitions.js";
import {
  canArchiveProject,
  canHideProject,
  getProjectStatusLabel,
  isProjectActive,
  isProjectArchived,
} from "#projects/project-status-rules.js";
import {
  getProjectById,
  renderProjectList,
} from "#projects/project-list.js";

export async function deleteProject(projectId) {
  const project = getProjectById(projectId);

  if (!project) {
    alert("Projeto não encontrado.");
    return;
  }

  if (canHideProject(project)) {
    await hideProjectFlow(project);
    return;
  }

  if (canArchiveProject(project)) {
    await archiveProjectFlow(project);
    return;
  }

  if (isProjectActive(project)) {
    alert(
      `A projeto "${project.name}" está em curso.\n\n` +
        "Uma projeto em curso não pode ser arquivada diretamente. " +
        "Primeiro pause ou conclua a projeto."
    );
    return;
  }

  alert(
    `Não é possível arquivar esta projeto no estado atual: ${getProjectStatusLabel(
      project.status
    )}.`
  );
}

async function archiveProjectFlow(project) {
  const reason = prompt(
    `Indique o motivo para arquivar a projeto "${project.name}":`
  );

  if (!reason || !reason.trim()) {
    return;
  }

  const confirmed = confirm(
    `Arquivar a projeto "${project.name}"?\n\n` +
      "A projeto deixará de aparecer na lista principal, mas os relatórios, fotografias e registos serão preservados."
  );

  if (!confirmed) return;

  try {
    await archiveProject(project, {
      reason: reason.trim(),
    });

    clearSelectedProjectStateIfNeeded(project.id);

    await renderProjectList();

    alert("Projeto arquivada com sucesso.");
  } catch (error) {
    console.error("Error archiving project:", error);
    alert("Erro ao arquivar projeto: " + error.message);
  }
}

async function hideProjectFlow(project) {
  const reason = prompt(
    `Indique o motivo para ocultar a projeto arquivada "${project.name}":`
  );

  if (!reason || !reason.trim()) {
    return;
  }

  const confirmed = confirm(
    `Ocultar a projeto arquivada "${project.name}"?\n\n` +
      "A projeto deixará de aparecer nas listas normais, mas os registos serão preservados."
  );

  if (!confirmed) return;

  try {
    await hideArchivedProject(project, {
      reason: reason.trim(),
    });

    clearSelectedProjectStateIfNeeded(project.id);

    await renderProjectList();

    alert("Projeto ocultada com sucesso.");
  } catch (error) {
    console.error("Error hiding archived project:", error);
    alert("Erro ao ocultar projeto: " + error.message);
  }
}

function clearSelectedProjectStateIfNeeded(projectId) {
  if (appState.currentProjectId !== projectId) {
    return;
  }
  appState.currentProjectId = null;
  appState.currentClientId = null;
  appState.currentCompanyId = null;
  appState.mode = "";
  appState.flow = null;
  appState.isEditingProject = false;
  appState.isNewProject = false;
  appState.currentProject = null;
}