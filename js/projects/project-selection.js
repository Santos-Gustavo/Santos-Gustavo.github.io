import { appState } from "#state/app-state.js";

import {
  clearProjectForm,
  loadProjectIntoForm,
} from "#projects/project-form.js";

import { getProjectById } from "#projects/project-list.js";

import { goToStepId } from "#navigation/navigation.js";

import { renderReportHistory } from "#reports/report-history.js";

import { renderProjectModePage } from "#projects/project-mode-page.js";

export function newProject() {
  appState.isNewProject = true;
  appState.isEditingProject = false;
  appState.currentCompanyId = null;
  appState.currentClientId = null;
  appState.currentProjectId = null;
  appState.flow = null;

  clearProjectForm();

  goToStepId(1);
}

export function selectProject(projectId) {
  const project = getProjectById(projectId);

  if (!project) {
    alert("Projeto não encontrado na base de dados.");
    return;
  }

  appState.isNewProject = false;
  appState.isEditingProject = false;
  appState.currentCompanyId = project.companyId;
  appState.currentClientId = project.clientId;
  appState.currentProjectId = project.id;

  renderReportHistory(appState.currentProjectId).catch(console.error);

  loadProjectIntoForm(project);

  goToStepId("mode");

  renderProjectModePage(project);
}

export function editProject(projectId) {
  const project = getProjectById(projectId);

  if (!project) {
    alert("Projeto não encontrado.");
    return;
  }

  appState.isNewProject = false;
  appState.isEditingProject = true;
  appState.currentCompanyId = project.companyId;
  appState.currentClientId = project.clientId;
  appState.currentProjectId = project.id;

  loadProjectIntoForm(project);

  goToStepId(1);
}
