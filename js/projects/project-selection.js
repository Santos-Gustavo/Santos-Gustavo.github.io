import { appState } from "#state/app-state.js";
import {
  clearProjectForm,
  loadProjectIntoForm,
} from "#projects/project-form.js";
import { getProjectById } from "#projects/project-list.js";

export function newProject() {
  appState.isNewProject = true;
  appState.isEditingProject = false;

  appState.currentCompanyId = null;
  appState.currentClientId = null;
  appState.currentProjectId = null;
  appState.flow = null;

  syncLegacyState();

  clearProjectForm();
  window.goToStepId?.(1);
}

export function selectProject(projectId) {
  const project = getProjectById(projectId);

  if (!project) {
    alert("Obra não encontrada na base de dados.");
    return;
  }

  appState.isNewProject = false;
  appState.isEditingProject = false;

  appState.currentCompanyId = project.companyId;
  appState.currentClientId = project.clientId;
  appState.currentProjectId = project.id;

  if (typeof window.renderReportHistory === "function") {
    window.renderReportHistory(appState.currentProjectId).catch(console.error);
  }

  syncLegacyState();

  loadProjectIntoForm(project);

  const modeProjectLabel = document.getElementById("modeProjectLabel");
  if (modeProjectLabel) {
    modeProjectLabel.textContent = project.name || "";
  }

  window.goToStepId?.("mode");
}

export function editProject(projectId) {
  const project = getProjectById(projectId);

  if (!project) {
    alert("Obra não encontrada.");
    return;
  }

  appState.isNewProject = false;
  appState.isEditingProject = true;

  appState.currentCompanyId = project.companyId;
  appState.currentClientId = project.clientId;
  appState.currentProjectId = project.id;

  syncLegacyState();

  loadProjectIntoForm(project);
  window.goToStepId?.(1);
}

function syncLegacyState() {
  if (!window.S) return;

  window.S.isNewProject = appState.isNewProject;
  window.S.isEditingProject = appState.isEditingProject;
  window.S.currentCompanyId = appState.currentCompanyId;
  window.S.currentClientId = appState.currentClientId;
  window.S.currentProjectId = appState.currentProjectId;
  window.S.flow = appState.flow;
}