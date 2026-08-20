// js/navigation/navigation.js

import { appState } from "#state/app-state.js";
import { CONTENT_STEPS, STEP_NAMES } from "#config/app-options.js";
import { saveCurrentProjectFromForm } from "#projects/project-save.js";
import { renderProjectList } from "#projects/project-list.js";
import { getLatestReportForProject } from "#database/db-reports.js";
import { setValue } from "#forms/form-values.js";

let initialized = false;

export function initNavigation() {
  if (initialized) return;
  initialized = true;

  document.addEventListener("click", handleNavigationClick);

  installTemporaryNavigationBridge();
}

export function getStepEl(id) {
  if (typeof id === "string" && Number.isNaN(Number(id))) {
    return document.getElementById(`step-${id}`);
  }

  return document.getElementById(`step${id}`);
}

export function goToStepId(id) {
  const state = getRuntimeState();

  const currentStep = getStepEl(state.currentStepId);

  if (currentStep) {
    currentStep.classList.remove("active");
    currentStep.style.display = "";
  }

  state.currentStepId = id;
  appState.currentStepId = id;

  const nextStep = getStepEl(id);

  if (!nextStep) {
    console.error("Step not found:", id);
    return;
  }

  document.querySelectorAll(".step").forEach((step) => {
    step.style.display = "";
  });

  nextStep.classList.add("active");

  updateTopBar(id);
  window.scrollTo(0, 0);
}

export function updateTopBar(id) {
  const state = getRuntimeState();

  const fill = document.getElementById("progressFill");
  const label = document.getElementById("stepLabel");

  if (!fill || !label) return;

  if (id === "projects") {
    fill.style.width = "0%";
    label.textContent = "Obras";
    return;
  }

  if (id === "mode") {
    fill.style.width = "3%";
    label.textContent = "Tipo de Relatório";
    return;
  }

  if (!state.flow) {
    const pos = id === 1 ? 1 : 2;
    fill.style.width = `${Math.round((pos / 2) * 100)}%`;
    label.textContent = `Configuração ${pos} de 2 — ${id === 1 ? "Empresa" : "Obra"}`;
    return;
  }

  const idx = state.flow.indexOf(id);
  const pos = idx + 1;
  const total = state.flow.length;

  fill.style.width = `${Math.round((pos / total) * 100)}%`;
  label.textContent = `Passo ${pos} de ${total} — ${STEP_NAMES[id] || String(id)}`;
}

export async function selectMode(mode) {
  const state = getRuntimeState();

  state.mode = mode;
  appState.mode = mode;

  if (mode === "weekly") {
    await prepareWeeklyReportFromPrevious();
  }

  if (mode === "weekly") {
    state.flow = CONTENT_STEPS.weekly || [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  }

  if (mode === "final") {
    state.flow = CONTENT_STEPS.weekly || [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  }

  if (mode === "legal") {
    state.flow = CONTENT_STEPS.legal || [10, 11, 12];
  }

  appState.flow = state.flow;

  goToStepId(state.flow[0]);
}

export async function goNext() {
  const state = getRuntimeState();
  const cur = state.currentStepId;

  if (cur === 1) {
    const companyName = document.getElementById("companyName")?.value.trim();

    if (!companyName) {
      alert("Preencha o nome da empresa antes de continuar.");
      document.getElementById("companyName")?.focus();
      return;
    }

    goToStepId(2);
    return;
  }

  if (cur === 2) {
    console.log("Saving project data...");

    const saved = await saveCurrentProjectFromForm();

    if (!saved) {
      console.warn("Project was not saved. Staying on step 2.");
      return;
    }

    if (state.isEditingProject || appState.isEditingProject) {
      state.isEditingProject = false;
      appState.isEditingProject = false;

      alert("Dados da obra atualizados com sucesso.");

      await renderProjectList();

      goHome();
      return;
    }

    const projectName =
      document.getElementById("projectName")?.value || "Nova Obra";

    const modeProjectLabel = document.getElementById("modeProjectLabel");
    if (modeProjectLabel) {
      modeProjectLabel.textContent = projectName;
    }

    goToStepId("mode");
    return;
  }

  if (!state.flow) {
    console.warn("No flow selected yet.");
    return;
  }

  const idx = state.flow.indexOf(cur);

  if (idx === -1) {
    console.warn("Current step not found in flow:", cur, state.flow);
    return;
  }

  if (cur === 10 && typeof window.updateFinancialPreview === "function") {
    window.updateFinancialPreview();
  }

  if (idx === state.flow.length - 2 && typeof window.buildReview === "function") {
    window.buildReview();
  }

  if (idx < state.flow.length - 1) {
    goToStepId(state.flow[idx + 1]);
  }
}

export function goBack() {
  const state = getRuntimeState();
  const cur = state.currentStepId;

  if (cur === 1) {
    goToStepId("projects");
    renderProjectList();
    return;
  }

  if (cur === 2) {
    goToStepId(1);
    return;
  }

  if (cur === "mode") {
    goToStepId("projects");
    renderProjectList();
    return;
  }

  if (!state.flow) return;

  const idx = state.flow.indexOf(cur);

  if (idx <= 0) {
    goToStepId("mode");
  } else {
    goToStepId(state.flow[idx - 1]);
  }
}

export function goHome() {
  const state = getRuntimeState();

  state.currentStepId = "projects";
  state.mode = "";
  state.flow = null;

  appState.currentStepId = "projects";
  appState.mode = "";
  appState.flow = null;

  document.querySelectorAll(".step").forEach((step) => {
    step.classList.remove("active");
    step.style.display = "";
  });

  const projectsStep = document.getElementById("step-projects");

  if (projectsStep) {
    projectsStep.classList.add("active");
  }

  const stepLabel = document.getElementById("stepLabel");
  if (stepLabel) {
    stepLabel.textContent = "Obras";
  }

  const progressFill = document.getElementById("progressFill");
  if (progressFill) {
    progressFill.style.width = "0%";
  }

  const modeProjectLabel = document.getElementById("modeProjectLabel");
  if (modeProjectLabel) {
    modeProjectLabel.textContent = "";
  }

  renderProjectList();

  window.scrollTo(0, 0);
}

export async function prepareWeeklyReportFromPrevious() {
  const state = getRuntimeState();
  const currentProjectId = state.currentProjectId || appState.currentProjectId;

  if (!currentProjectId) {
    console.warn("No current project selected. Cannot load previous report.");
    return;
  }

  try {
    const previousReport = await getLatestReportForProject(currentProjectId);

    if (!previousReport) {
      console.log("No previous report found. Starting blank weekly report.");
      prepareBlankWeeklyReport();
      return;
    }

    console.log("Previous report loaded:", previousReport);

    if (typeof window.applyPreviousReportToForm === "function") {
      window.applyPreviousReportToForm(previousReport);
    } else {
      console.warn("applyPreviousReportToForm() is not available. Starting blank report.");
      prepareBlankWeeklyReport();
      return;
    }

    showPrefillNotice();
  } catch (error) {
    console.error("Error preparing weekly report:", error);
    alert("Não foi possível carregar o relatório anterior: " + error.message);

    prepareBlankWeeklyReport();
  }
}

export function prepareBlankWeeklyReport() {
  const state = getRuntimeState();
  const today = new Date().toISOString().split("T")[0];

  setValue("p-reportNum", "1");
  setValue("p-reportDate", today);
  setValue("p-periodStart", "");
  setValue("p-periodEnd", "");

  state.periodStart = null;
  state.periodEnd = null;

  state.works = [];
  state.photos = [];
  state.incidents = [];
  state.extras = [];
  state.nextSteps = [];

  appState.works = [];
  appState.photos = [];
  appState.incidents = [];
  appState.extras = [];
  appState.nextSteps = [];

  rerenderLegacySections();
}

function showPrefillNotice() {
  alert("Último relatório encontrado. Os dados foram pré-preenchidos. Atualize apenas o que mudou esta semana.");
}

function handleNavigationClick(event) {
  const actionEl = event.target.closest("[data-nav-action]");
  if (!actionEl) return;

  const action = actionEl.dataset.navAction;

  event.preventDefault();

  if (action === "next") {
    goNext();
    return;
  }

  if (action === "back") {
    goBack();
    return;
  }

  if (action === "home") {
    goHome();
    return;
  }

  if (action === "select-mode") {
    selectMode(actionEl.dataset.reportMode);
  }
}

function rerenderLegacySections() {
  if (typeof window.renderWorks === "function") window.renderWorks();
  if (typeof window.renderPhotos === "function") window.renderPhotos();
  if (typeof window.renderIncidents === "function") window.renderIncidents();
  if (typeof window.renderExtras === "function") window.renderExtras();
  if (typeof window.renderNextSteps === "function") window.renderNextSteps();
}

function getRuntimeState() {
  return window.S || appState;
}

function installTemporaryNavigationBridge() {
  // Temporary bridge for old inline HTML onclick handlers.
  // Remove after index.html is fully migrated to data-nav-action.
  window.getStepEl = getStepEl;
  window.goToStepId = goToStepId;
  window.updateTopBar = updateTopBar;
  window.selectMode = selectMode;
  window.goNext = goNext;
  window.goBack = goBack;
  window.goHome = goHome;
  window.prepareWeeklyReportFromPrevious = prepareWeeklyReportFromPrevious;
}