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

  // PROJECT-MASTER-SHEET-001 — project currently open on the "Estado da Obra"
  // screen. Separate from currentProjectId because that screen can be opened
  // straight from a project card without going through selectProject().
  currentWorkStatusProjectId: null,

  projectsCache: [],
  clientsCache: [],
  editingClientId: null,

};
