// js/projects/sections/works.js

import { appState } from "#state/app-state.js";
import { JOB_TYPES, AREAS } from "#config/app-options.js";

let initialized = false;

export function initWorksSection() {
  if (initialized) return;
  initialized = true;

  document.addEventListener("click", handleWorksClick);
  document.addEventListener("input", handleWorksInput);
  document.addEventListener("change", handleWorksInput);

}

export function addWorkItem() {
  const works = getWorksState();

  works.push({
    id: crypto.randomUUID(),
    type: "",
    area: "",
    desc: "",
    status: "done",
  });

  syncWorksState(works);
  renderWorks();
}

export function removeWork(workId) {
  const works = getWorksState().filter((work) => String(work.id) !== String(workId));

  syncWorksState(works);
  renderWorks();
}

export function setWorkValue(workId, key, value) {
  const allowedKeys = new Set(["type", "area", "desc", "status"]);
  if (!allowedKeys.has(key)) return;

  const works = getWorksState();
  const work = works.find((item) => String(item.id) === String(workId));

  if (!work) return;

  work[key] = value;
  syncWorksState(works);
}

export function renderWorks() {
  const el =
    document.getElementById("workList") ||
    document.getElementById("worksList");

  if (!el) {
    console.error("Works list container not found. Expected #workList.");
    return;
  }

  const works = getWorksState();

  if (works.length === 0) {
    el.innerHTML = `<p class="empty-hint">Ainda sem trabalhos registados.</p>`;
    return;
  }

  el.innerHTML = works.map(renderWorkCard).join("");
}

function renderWorkCard(work, index) {
  const workId = escapeHtml(work.id);

  return `
    <div class="item-card" data-work-id="${workId}">
      <div class="item-card-header">
        <div class="item-card-title">Trabalho ${index + 1}</div>

        <button
          type="button"
          class="btn-remove"
          data-work-action="remove"
          data-work-id="${workId}"
        >
          Remover
        </button>
      </div>

      <div class="field">
        <label>Tipo de trabalho</label>
        <select data-work-field="type" data-work-id="${workId}">
          <option value="">— Selecionar —</option>
          ${renderOptions(JOB_TYPES, work.type)}
        </select>
      </div>

      <div class="field">
        <label>Área</label>
        <select data-work-field="area" data-work-id="${workId}">
          <option value="">— Selecionar —</option>
          ${renderOptions(AREAS, work.area)}
        </select>
      </div>

      <div class="field">
        <label>Descrição</label>
        <textarea
          data-work-field="desc"
          data-work-id="${workId}"
          placeholder="Ex: Aplicação de primário nas paredes da sala"
        >${escapeHtml(work.desc || "")}</textarea>
      </div>

      <div class="field">
        <label>Estado</label>
        <select data-work-field="status" data-work-id="${workId}">
          <option value="done"${work.status === "done" ? " selected" : ""}>Concluído</option>
          <option value="progress"${work.status === "progress" ? " selected" : ""}>Em curso</option>
          <option value="blocked"${work.status === "blocked" ? " selected" : ""}>Pendente / Bloqueado</option>
        </select>
      </div>
    </div>
  `;
}

function handleWorksClick(event) {
  const actionEl = event.target.closest("[data-work-action]");
  if (!actionEl) return;

  event.preventDefault();

  const action = actionEl.dataset.workAction;
  const workId = actionEl.dataset.workId;

  if (action === "add") {
    addWorkItem();
    return;
  }

  if (action === "remove") {
    removeWork(workId);
  }
}

function handleWorksInput(event) {
  const input = event.target.closest("[data-work-field]");
  if (!input) return;

  const workId = input.dataset.workId;
  const key = input.dataset.workField;

  setWorkValue(workId, key, input.value);
}

function getWorksState() {

  if (!Array.isArray(appState.works)) appState.works = [];
  return appState.works;
}

function syncWorksState(works) {
  appState.works = works;

}

function renderOptions(options, selectedValue) {
  return options
    .map((option) => {
      const selected = option === selectedValue ? " selected" : "";
      return `<option value="${escapeHtml(option)}"${selected}>${escapeHtml(option)}</option>`;
    })
    .join("");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}