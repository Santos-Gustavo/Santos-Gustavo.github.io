// js/projects/sections/next-steps.js

import { appState } from "#state/app-state.js";

let initialized = false;

export function initNextStepsSection() {
  if (initialized) return;
  initialized = true;

  document.addEventListener("click", handleNextStepClick);
  document.addEventListener("input", handleNextStepInput);

}

export function addNextStep() {
  const nextSteps = getNextStepsState();

  nextSteps.push({
    id: crypto.randomUUID(),
    desc: "",
    date: "",
  });

  syncNextStepsState(nextSteps);
  renderNextSteps();
}

export function removeNextStep(nextStepId) {
  const nextSteps = getNextStepsState().filter(
    (step) => String(step.id) !== String(nextStepId),
  );

  syncNextStepsState(nextSteps);
  renderNextSteps();
}

export function setNextStepValue(nextStepId, key, value) {
  const allowedKeys = new Set(["desc", "date"]);
  if (!allowedKeys.has(key)) return;

  const nextSteps = getNextStepsState();
  const nextStep = nextSteps.find((item) => String(item.id) === String(nextStepId));

  if (!nextStep) return;

  nextStep[key] = value;
  syncNextStepsState(nextSteps);
}

export function renderNextSteps() {
  const el = document.getElementById("nextStepsList");
  if (!el) return;

  const nextSteps = getNextStepsState();

  if (nextSteps.length === 0) {
    el.innerHTML = `<p class="empty-hint">Ainda sem próximos passos registados.</p>`;
    return;
  }

  el.innerHTML = nextSteps.map(renderNextStepCard).join("");
}

function renderNextStepCard(nextStep, index) {
  const nextStepId = escapeHtml(nextStep.id);

  return `
    <div class="item-card" data-next-step-id="${nextStepId}">
      <div class="item-card-header">
        <div class="item-card-title">Próximo passo ${index + 1}</div>

        <button
          type="button"
          class="btn-remove"
          data-next-step-action="remove"
          data-next-step-id="${nextStepId}"
        >
          Remover
        </button>
      </div>

      <div class="field">
        <label>Descrição</label>
        <textarea
          data-next-step-field="desc"
          data-next-step-id="${nextStepId}"
          placeholder="Ex: Aplicar segunda demão de tinta"
        >${escapeHtml(nextStep.desc || "")}</textarea>
      </div>

      <div class="field">
        <label>Data prevista</label>
        <input
          type="date"
          value="${escapeHtml(nextStep.date || "")}"
          data-next-step-field="date"
          data-next-step-id="${nextStepId}"
        />
      </div>
    </div>
  `;
}

function handleNextStepClick(event) {
  const actionEl = event.target.closest("[data-next-step-action]");
  if (!actionEl) return;

  event.preventDefault();

  const action = actionEl.dataset.nextStepAction;
  const nextStepId = actionEl.dataset.nextStepId;

  if (action === "add") {
    addNextStep();
    return;
  }

  if (action === "remove") {
    removeNextStep(nextStepId);
  }
}

function handleNextStepInput(event) {
  const input = event.target.closest("[data-next-step-field]");
  if (!input) return;

  setNextStepValue(
    input.dataset.nextStepId,
    input.dataset.nextStepField,
    input.value,
  );
}

function getNextStepsState() {

  if (!Array.isArray(appState.nextSteps)) appState.nextSteps = [];
  return appState.nextSteps;
}

function syncNextStepsState(nextSteps) {
  appState.nextSteps = nextSteps;
}



function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}