import { appState } from "#state/app-state.js";

export function getCachedProjects() {
  return appState.projectsCache;
}

export function setCachedProjects(projects) {
  appState.projectsCache = Array.isArray(projects) ? projects : [];
  return appState.projectsCache;
}

export function clearProjectsCache() {
  appState.projectsCache = [];
}

export function getSelectedProjectId() {
  return appState.currentProjectId;
}

export function setSelectedProjectId(projectId) {
  appState.currentProjectId = projectId || null;
}

export function clearAppCache() {
  clearProjectsCache();
  setSelectedProjectId(null);
}