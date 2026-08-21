export const appState = {
  currentStepId: "projects",
  mode: "",
  phase: "",
  alertOn: false,
  incidentsOn: false,
  projectListFilter: "active",

  works: [],
  photos: [],
  incidents: [],
  extras: [],
  nextSteps: [],

  flow: null,

  isNewProject: false,
  isEditingProject: false,

  currentCompanyId: null,
  currentClientId: null,
  currentProjectId: null,
  currentReportId: null,

  projectsCache: [],
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

  appState.currentCompanyId = null;
  appState.currentClientId = null;
  appState.currentProjectId = null;
  appState.currentReportId = null;
}

export function resetAllAppState() {
  appState.currentStepId = "projects";

  resetReportDraftState();
  resetProjectSelectionState();

  appState.projectsCache = [];
}