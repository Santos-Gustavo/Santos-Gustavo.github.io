import { appState } from "#state/app-state.js";
import { deleteProjectViaFunction } from "#database/db-projects.js";
import {
  getProjectById,
  renderProjectList,
} from "#projects/project-list.js";

export async function deleteProject(projectId) {
  const project = getProjectById(projectId);

  if (!project) {
    alert("Obra não encontrada.");
    return;
  }

  const confirmed = confirm(
    `Tem a certeza que quer apagar a obra "${project.name}"?\n\nEsta ação apaga os relatórios e fotografias associados.`
  );

  if (!confirmed) return;

  try {
    await deleteProjectViaFunction(projectId);

    if (appState.currentProjectId === projectId) {
      clearSelectedProjectState();
    }

    if (appState.currentProjectId === projectId) {
      appState.currentProjectId = null;
      appState.currentClientId = null;
      appState.currentCompanyId = null;
      appState.mode = ""; 
      appState.flow = null;
      appState.isEditingProject = false;
      appState.isNewProject = false;
    }

    await renderProjectList();

    alert("Obra apagada com sucesso.");
  } catch (error) {
    console.error("Error deleting project:", error);
    alert("Erro ao apagar obra: " + error.message);
  }
}

function clearSelectedProjectState() {
  appState.currentProjectId = null;
  appState.currentClientId = null;
  appState.currentCompanyId = null;
  appState.mode = "";
  appState.flow = null;
  appState.isEditingProject = false;
  appState.isNewProject = false;
}   