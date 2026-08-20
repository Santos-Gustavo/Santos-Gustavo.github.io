// js/ui/ui-controls.js

import { appState } from "#state/app-state.js";

let initialized = false;

export function initUiControls() {
  if (initialized) return;
  initialized = true;

  document.addEventListener("click", handleUiControlClick, true);
  document.addEventListener("input", handleUiInput, true);

  installTemporaryUiBridge();
}

export function selectPhase(el, phase) {
  document.querySelectorAll(".phase-option").forEach((option) => {
    option.classList.remove("selected");
  });

  if (el) {
    el.classList.add("selected");
  }

  appState.phase = phase;

}

export function toggleAlert() {
  const state = getRuntimeState();

  state.alertOn = !state.alertOn;
  appState.alertOn = state.alertOn;

  updateAlertUI();
}

export function toggleIncidents() {
  const state = getRuntimeState();

  state.incidentsOn = !state.incidentsOn;
  appState.incidentsOn = state.incidentsOn;

  updateIncidentsUI();
}

export function updatePhaseUI() {
  const state = getRuntimeState();

  document.querySelectorAll(".phase-option").forEach((option) => {
    const phase =
      option.dataset.phase ||
      option.getAttribute("data-phase") ||
      option.textContent.trim();

    option.classList.toggle("selected", phase === state.phase);
  });
}

export function updateAlertUI() {
  const state = getRuntimeState();

  const alertToggle = document.getElementById("alertToggle");
  const alertFields = document.getElementById("alertFields");

  if (alertToggle) {
    alertToggle.classList.toggle("on", Boolean(state.alertOn));
  }

  if (alertFields) {
    alertFields.classList.toggle("hidden", !state.alertOn);
  }
}

export function updateIncidentsUI() {
  const state = getRuntimeState();

  const incidentsToggle = document.getElementById("incidentsToggle");
  const incidentFields = document.getElementById("incidentFields");

  if (incidentsToggle) {
    incidentsToggle.classList.toggle("on", Boolean(state.incidentsOn));
  }

  if (incidentFields) {
    incidentFields.classList.toggle("hidden", !state.incidentsOn);
  }
}

function handleUiControlClick(event) {
  const phaseEl = event.target.closest("[data-phase]");
  if (phaseEl && phaseEl.classList.contains("phase-option")) {
    event.preventDefault();
    selectPhase(phaseEl, phaseEl.dataset.phase);
    return;
  }

  const actionEl = event.target.closest("[data-ui-action]");
  if (!actionEl) return;

  const action = actionEl.dataset.uiAction;

  event.preventDefault();

  if (action === "toggle-alert") {
    toggleAlert();
    return;
  }

  if (action === "toggle-incidents") {
    toggleIncidents();
  }
}

function getRuntimeState() {
  return appState;
}

function installTemporaryUiBridge() {
  // Temporary bridge for old inline HTML onclick handlers.
  window.selectPhase = selectPhase;
  window.toggleAlert = toggleAlert;
  window.toggleIncidents = toggleIncidents;

  window.updatePhaseUI = updatePhaseUI;
  window.updateAlertUI = updateAlertUI;
  window.updateIncidentsUI = updateIncidentsUI;
}



function handleUiInput(event) {
  const target = event.target;

  if (!target?.matches("[data-ui-action='progress-slider']")) {
    return;
  }

  const progressPct = document.getElementById("progressPct");

  if (progressPct) {
    progressPct.textContent = `${target.value}%`;
  }
}