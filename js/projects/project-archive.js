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

export async function archiveOrHideProject(projectId) {
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
      `O projeto "${project.name}" está em curso.\n\n` +
        "Um projeto em curso não pode ser arquivado diretamente. " +
        "Primeiro pause ou conclua o projeto."
    );
    return;
  }

  alert(
    `Não é possível arquivar este projeto no estado atual: ${getProjectStatusLabel(
      project.status
    )}.`
  );
}

async function archiveProjectFlow(project) {
  const reason = prompt(
    `Indique o motivo para arquivar o projeto "${project.name}":`
  );

  if (!reason || !reason.trim()) {
    return;
  }

  const confirmed = confirm(
    `Arquivar o projeto "${project.name}"?\n\n` +
      "O projeto deixará de aparecer na lista principal, mas os relatórios, fotografias e registos serão preservados."
  );

  if (!confirmed) return;

  try {
    await archiveProject(project, {
      reason: reason.trim(),
    });

    clearSelectedProjectStateIfNeeded(project.id);

    await renderProjectList();

    alert("Projeto arquivado com sucesso.");
  } catch (error) {
    console.error("Error archiving project:", error);
    alert("Erro ao arquivar projeto: " + error.message);
  }
}

async function hideProjectFlow(project) {
  const reason = prompt(
    `Indique o motivo para ocultar o projeto arquivado "${project.name}":`
  );

  if (!reason || !reason.trim()) {
    return;
  }

  const confirmed = confirm(
    `Ocultar o projeto arquivado "${project.name}"?\n\n` +
      "O projeto deixará de aparecer nas listas normais, mas os registos serão preservados."
  );

  if (!confirmed) return;

  try {
    await hideArchivedProject(project, {
      reason: reason.trim(),
    });

    clearSelectedProjectStateIfNeeded(project.id);

    await renderProjectList();

    alert("Projeto ocultado com sucesso.");
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
  // currentCompanyId deliberately left alone — it's the session-durable
  // primary company (COMPANY-PROFILE-001), not per-project selection state.
  appState.mode = "";
  appState.flow = null;
  appState.isEditingProject = false;
  appState.isNewProject = false;
  appState.currentProject = null;
}