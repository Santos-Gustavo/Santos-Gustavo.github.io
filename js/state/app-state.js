export const appState = {
  currentStepId: "projects",
  mode: "",
  phase: "",
  alertOn: false,
  incidentsOn: false,
  projectListFilter: "active",
  clientListFilter: "active",

  works: [],
  photos: [],
  incidents: [],
  extras: [],
  nextSteps: [],

  flow: null,

  isNewProject: false,
  isEditingProject: false,

  // The user's one primary company for this MVP — loaded once at boot, stable
  // for the whole session. primaryCompanyId/currentCompany are never mutated
  // by project selection/edit/archive; new-project creation always attaches
  // to primaryCompanyId specifically (never to whatever currentCompanyId
  // happens to hold, which selectProject/editProject may point at a legacy
  // project's own — possibly different, pre-fix — company for display).
  // See docs/features/COMPANY-PROFILE-001.md.
  primaryCompanyId: null,
  currentCompanyId: null,
  currentCompany: null,
  pendingNewProjectAfterCompanySetup: false,

  currentClientId: null,
  currentProjectId: null,
  currentReportId: null,
  currentProject: null,

  projectsCache: [],
  clientsCache: [],
  editingClientId: null,

};

export function resetReportDraftState() {
  appState.mode = "";
  appState.phase = "";
  appState.alertOn = false;
  appState.incidentsOn = false;

  appState.works = [];
  appState.photos = [];
  appState.incidents = [];
  appState.extras = [];
  appState.nextSteps = [];

  appState.flow = null;
  appState.currentReportId = null;
}

export function resetProjectSelectionState() {
  appState.isNewProject = false;
  appState.isEditingProject = false;

  // currentCompanyId/currentCompany deliberately survive this reset — the
  // primary company is a session-durable profile, not per-project state.
  appState.currentClientId = null;
  appState.currentProjectId = null;
  appState.currentReportId = null;
  appState.currentProject = null;
}

export function resetAllAppState() {
  appState.currentStepId = "projects";

  resetReportDraftState();
  resetProjectSelectionState();

  appState.projectsCache = [];
}