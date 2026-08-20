// js/projects/sections/extras.js

import { appState } from "#state/app-state.js";

let initialized = false;

export function initExtrasSection() {
  if (initialized) return;
  initialized = true;

  document.addEventListener("click", handleExtraClick);
  document.addEventListener("input", handleExtraInput);
  document.addEventListener("change", handleExtraInput);

  installTemporaryExtrasBridge();
}

export function addExtra() {
  const extras = getExtrasState();

  extras.push({
    id: crypto.randomUUID(),
    ref: "",
    title: "",
    desc: "",
    cost: "",
    status: "pending",
    approvedBy: "",
    approvalMethod: "",
    approvalDate: "",
    deadline: "",
  });

  syncExtrasState(extras);
  renderExtras();
}

export function removeExtra(extraId) {
  const extras = getExtrasState().filter((extra) => String(extra.id) !== String(extraId));

  syncExtrasState(extras);
  renderExtras();
}

export function setExtraValue(extraId, key, value) {
  const allowedKeys = new Set([
    "ref",
    "title",
    "desc",
    "cost",
    "status",
    "approvedBy",
    "approvalMethod",
    "approvalDate",
    "deadline",
  ]);

  if (!allowedKeys.has(key)) return;

  const extras = getExtrasState();
  const extra = extras.find((item) => String(item.id) === String(extraId));

  if (!extra) return;

  extra[key] = value;
  syncExtrasState(extras);
}

export function renderExtras() {
  const el = document.getElementById("extrasList");
  if (!el) return;

  const extras = getExtrasState();

  if (extras.length === 0) {
    el.innerHTML = `<p class="empty-hint">Ainda sem trabalhos extra registados.</p>`;
    return;
  }

  el.innerHTML = extras.map(renderExtraCard).join("");
}

function renderExtraCard(extra, index) {
  const extraId = escapeHtml(extra.id);

  return `
    <div class="item-card" data-extra-id="${extraId}">
      <div class="item-card-header">
        <div class="item-card-title">Extra ${index + 1}</div>

        <button
          type="button"
          class="btn-remove"
          data-extra-action="remove"
          data-extra-id="${extraId}"
        >
          Remover
        </button>
      </div>

      <div class="field">
        <label>Referência</label>
        <input
          type="text"
          value="${escapeHtml(extra.ref || "")}"
          placeholder="Ex: EXT-001"
          data-extra-field="ref"
          data-extra-id="${extraId}"
        />
      </div>

      <div class="field">
        <label>Título</label>
        <input
          type="text"
          value="${escapeHtml(extra.title || "")}"
          placeholder="Ex: Substituição de canalização adicional"
          data-extra-field="title"
          data-extra-id="${extraId}"
        />
      </div>

      <div class="field">
        <label>Descrição</label>
        <textarea
          data-extra-field="desc"
          data-extra-id="${extraId}"
          placeholder="Descreva o trabalho extra"
        >${escapeHtml(extra.desc || "")}</textarea>
      </div>

      <div class="field">
        <label>Custo estimado / aprovado (€)</label>
        <input
          type="number"
          step="0.01"
          value="${escapeHtml(extra.cost || "")}"
          data-extra-field="cost"
          data-extra-id="${extraId}"
        />
      </div>

      <div class="field">
        <label>Estado</label>
        <select data-extra-field="status" data-extra-id="${extraId}">
          <option value="pending"${extra.status === "pending" ? " selected" : ""}>Pendente</option>
          <option value="approved"${extra.status === "approved" ? " selected" : ""}>Aprovado</option>
        </select>
      </div>

      <div class="field">
        <label>Aprovado por</label>
        <input
          type="text"
          value="${escapeHtml(extra.approvedBy || "")}"
          data-extra-field="approvedBy"
          data-extra-id="${extraId}"
        />
      </div>

      <div class="field">
        <label>Método de aprovação</label>
        <input
          type="text"
          value="${escapeHtml(extra.approvalMethod || "")}"
          placeholder="Ex: WhatsApp, email, assinatura"
          data-extra-field="approvalMethod"
          data-extra-id="${extraId}"
        />
      </div>

      <div class="field">
        <label>Data de aprovação</label>
        <input
          type="date"
          value="${escapeHtml(extra.approvalDate || "")}"
          data-extra-field="approvalDate"
          data-extra-id="${extraId}"
        />
      </div>

      <div class="field">
        <label>Prazo de resposta</label>
        <input
          type="date"
          value="${escapeHtml(extra.deadline || "")}"
          data-extra-field="deadline"
          data-extra-id="${extraId}"
        />
      </div>
    </div>
  `;
}

function handleExtraClick(event) {
  const actionEl = event.target.closest("[data-extra-action]");
  if (!actionEl) return;

  event.preventDefault();

  const action = actionEl.dataset.extraAction;
  const extraId = actionEl.dataset.extraId;

  if (action === "add") {
    addExtra();
    return;
  }

  if (action === "remove") {
    removeExtra(extraId);
  }
}

function handleExtraInput(event) {
  const input = event.target.closest("[data-extra-field]");
  if (!input) return;

  setExtraValue(
    input.dataset.extraId,
    input.dataset.extraField,
    input.value,
  );
}

function getExtrasState() {
  if (!Array.isArray(appState.extras)) appState.extras = [];
  return appState.extras;
}

function syncExtrasState(extras) {
  appState.extras = extras;

}

function installTemporaryExtrasBridge() {
  window.addExtra = addExtra;
  window.removeExtra = removeExtra;
  window.renderExtras = renderExtras;
  window.setExtra = setExtraValue;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}