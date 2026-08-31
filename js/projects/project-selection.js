import { appState } from "#state/app-state.js";
import { clearProjectForm, loadProjectIntoForm } from "#projects/project-form.js";
import { getProjectById } from "#projects/project-list.js";
import { goToStepId } from "#navigation/navigation.js";
import { renderReportHistory } from "#reports/report-history.js";
import { renderProjectModePage } from "#projects/project-mode-page.js";
import { canEditProject } from "#projects/project-status-rules.js";
import { populateCompanyForm, resolvePrimaryCompanyId } from "#company/company-profile.js";
import { openCompanyProfilePage } from "#company/company-index.js";
import { populateClientNameOptions } from "#clients/client-list.js";

export async function newProject() {
  // One primary company per user (COMPANY-PROFILE-001) — a brand new user has
  // none yet, so route through the one-time setup screen first instead of
  // creating a company as a side effect of project creation. Resolved async
  // (not a plain appState.primaryCompanyId read) because the company load
  // kicked off at login may still be in flight the moment this runs — reading
  // the flag synchronously here would race it and misfire the "no company"
  // branch even though one exists.
  const primaryCompanyId = await resolvePrimaryCompanyId();

  if (!primaryCompanyId) {
    appState.pendingNewProjectAfterCompanySetup = true;
    openCompanyProfilePage();
    return;
  }

  appState.isNewProject = true;
  appState.isEditingProject = false;
  // Always the primary — never whatever currentCompanyId was left pointing at
  // by a previous selectProject()/editProject() on a (possibly legacy,
  // pre-fix) project under a different company row.
  appState.currentCompanyId = primaryCompanyId;
  appState.currentClientId = null;
  appState.currentProjectId = null;
  appState.flow = null;
  appState.currentProject = null;

  clearProjectForm();
  populateCompanyForm(appState.currentCompany);

  populateClientNameOptions().catch((error) => {
    console.warn("Could not load client name suggestions:", error);
  });

  goToStepId(2);
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
  appState.currentProject = project;

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

  if (!canEditProject(project)) {
    alert("Este projeto está arquivado. Não é possível editar os dados do projeto.");
    return;
  }

  appState.isNewProject = false;
  appState.isEditingProject = true;
  appState.currentCompanyId = project.companyId;
  appState.currentClientId = project.clientId;
  appState.currentProjectId = project.id;
  appState.currentProject = project;

  loadProjectIntoForm(project);

  populateClientNameOptions().catch((error) => {
    console.warn("Could not load client name suggestions:", error);
  });

  goToStepId(2);
}
