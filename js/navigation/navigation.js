// js/navigation/navigation.js
import { appState } from "#state/app-state.js";
import { CONTENT_STEPS, STEP_NAMES } from "#config/app-options.js";
import { saveCurrentProjectFromForm } from "#projects/project-save.js";
import { renderProjectList, upsertProjectInCache } from "#projects/project-list.js";
import { mapProjectRowToAppProject } from "#mappers/project-mapper.js";
import { updateFinancialPreview } from "#projects/sections/financial.js";
import { buildReview } from "#projects/sections/review.js";
import {
  hasUnsavedWorkStatusChanges,
  confirmLeaveEstadoObraIfDirty,
  openProjectMasterSheet,
} from "#projects/project-work-items-ui.js";
import { canCreateLegalFinancialReport } from "#projects/project-status-rules.js";
import { openClientsPage } from "#clients/client-index.js";
import { openCompanyProfilePage } from "#company/company-index.js";
import { confirmAction } from "#ui/confirm-dialog.js";

let initialized = false;

export function initNavigation() {
  if (initialized) return;
  initialized = true;

  document.addEventListener("click", handleNavigationClick);
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
    label.textContent = "Projetos";
    return;
  }

  if (id === "clients") {
    fill.style.width = "0%";
    label.textContent = "Clientes";
    return;
  }

  if (id === "estado-obra") {
    fill.style.width = "0%";
    label.textContent = "Estado da Obra";
    return;
  }

  if (id === "company") {
    fill.style.width = "0%";
    label.textContent = "Dados da Empresa";
    return;
  }

  if (!state.flow) {
    fill.style.width = "50%";
    label.textContent = "Dados do Projeto";
    return;
  }

  const idx = state.flow.indexOf(id);
  const pos = idx + 1;
  const total = state.flow.length;

  fill.style.width = `${Math.round((pos / total) * 100)}%`;
  label.textContent = `Passo ${pos} de ${total} — ${STEP_NAMES[id] || String(id)}`;
}

// The legal/financial wizard is the only step-by-step report flow left —
// weekly reports are generated from Estado da Obra ("Gerar relatório").
export function openLegalWizard() {
  const state = getRuntimeState();

  if (!canCreateLegalFinancialReport(appState.currentProject)) {
    alert(
      "Este projeto está arquivado. Não é possível criar novos relatórios legais/financeiros."
    );
    return;
  }

  state.mode = "legal";
  state.flow = CONTENT_STEPS.legal;

  goToStepId(state.flow[0]);
}
export async function goNext() {
  const state = getRuntimeState();
  const cur = state.currentStepId;

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

      alert("Dados do projeto atualizados com sucesso.");

      await renderProjectList();

      goHome();
      return;
    }

    // A new project lands in Estado da Obra, the project hub (there is no
    // "Tipo de Relatório" page any more).
    // saved.project is a raw DB row; cache the app-shaped project (companyId,
    // clientName, …) so Estado da Obra doesn't depend on the background
    // project-list refresh winning the race.
    const project = mapProjectRowToAppProject(saved.project, {
      client: saved.client,
      company: appState.currentCompany,
    });
    appState.currentProject = project;
    upsertProjectInCache(project);
    await openProjectMasterSheet(saved.project.id);
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

  if (cur === 10) {
    updateFinancialPreview();
  }

  if (idx === state.flow.length - 2) {
    buildReview();
  }
  if (idx < state.flow.length - 1) {
    goToStepId(state.flow[idx + 1]);
  }
}

export function goBack() {
  const state = getRuntimeState();
  const cur = state.currentStepId;

  if (cur === 2) {
    goToStepId("projects");
    renderProjectList();
    return;
  }

  if (cur === "estado-obra") {
    goToStepId("projects");
    renderProjectList();
    return;
  }

  if (cur === "clients") {
    goToStepId("projects");
    renderProjectList();
    return;
  }

  if (cur === "company") {
    appState.pendingNewProjectAfterCompanySetup = false;
    goToStepId("projects");
    renderProjectList();
    return;
  }

  if (!state.flow) return;

  const idx = state.flow.indexOf(cur);

  if (idx <= 0) {
    // Leaving the legal/financial wizard from its first step: back to the
    // project's Estado da Obra, where it was started.
    state.mode = "";
    state.flow = null;
    if (appState.currentProjectId) {
      openProjectMasterSheet(appState.currentProjectId);
    } else {
      goHome();
    }
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
    stepLabel.textContent = "Projetos";
  }

  const progressFill = document.getElementById("progressFill");
  if (progressFill) {
    progressFill.style.width = "0%";
  }

  renderProjectList();

  window.scrollTo(0, 0);
}

async function handleNavigationClick(event) {
  const trigger = event.target.closest("[data-nav-action]");

  if (!trigger) {
    return;
  }

  const action = trigger.dataset.navAction;

  if (!action) {
    return;
  }

  event.preventDefault();

  // POST-RELEASE-POLISH-001 — Estado da Obra's "Legal / Financeiro" button
  // goes straight into the legal/financial wizard.
  if (action === "open-legal") {
    if (!(await confirmLeaveEstadoObraIfDirty())) return;
    openLegalWizard();
    return;
  }

  if (action === "next") {
    goNext();
    return;
  }

  if (action === "back") {
    if (!(await confirmLeaveEstadoObraIfDirty())) return;

    goBack();
    return;
  }

  if (action === "home") {
    if (hasUnsavedWorkStatusChanges()) {
      if (await confirmLeaveEstadoObraIfDirty()) goHome();
      return;
    }

    const confirmed = await confirmAction({
      title: "Voltar ao início?",
      message: "Pode perder alterações que ainda não foram guardadas. Quer continuar?",
      confirmLabel: "Voltar ao início",
      cancelLabel: "Cancelar",
    });

    if (confirmed) goHome();
    return;
  }

  if (action === "open-clients") {
    goToStepId("clients");
    openClientsPage();
    return;
  }

  if (action === "open-company-profile") {
    openCompanyProfilePage();
    return;
  }

  console.warn("Unknown navigation action:", action, trigger);
}

function getRuntimeState() {
  return appState;
}