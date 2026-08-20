// js/projects/sections/incidents.js

import { appState } from "#state/app-state.js";

let initialized = false;

export function initIncidentsSection() {
  if (initialized) return;
  initialized = true;

  document.addEventListener("click", handleIncidentClick);
  document.addEventListener("input", handleIncidentInput);

  installTemporaryIncidentsBridge();
}

export function addIncident() {
  const incidents = getIncidentsState();

  incidents.push({
    id: crypto.randomUUID(),
    desc: "",
  });

  syncIncidentsState(incidents);
  renderIncidents();
}

export function removeIncident(incidentId) {
  const incidents = getIncidentsState().filter(
    (incident) => String(incident.id) !== String(incidentId),
  );

  syncIncidentsState(incidents);
  renderIncidents();
}

export function setIncidentValue(incidentId, key, value) {
  if (key !== "desc") return;

  const incidents = getIncidentsState();
  const incident = incidents.find((item) => String(item.id) === String(incidentId));

  if (!incident) return;

  incident.desc = value;
  syncIncidentsState(incidents);
}

export function renderIncidents() {
  const el = document.getElementById("incidentList");
  if (!el) return;

  const incidents = getIncidentsState();

  if (incidents.length === 0) {
    el.innerHTML = `<p class="empty-hint">Sem incidentes registados.</p>`;
    return;
  }

  el.innerHTML = incidents.map(renderIncidentCard).join("");
}

function renderIncidentCard(incident, index) {
  const incidentId = escapeHtml(incident.id);

  return `
    <div class="item-card" data-incident-id="${incidentId}">
      <div class="item-card-header">
        <div class="item-card-title">Incidente ${index + 1}</div>

        <button
          type="button"
          class="btn-remove"
          data-incident-action="remove"
          data-incident-id="${incidentId}"
        >
          Remover
        </button>
      </div>

      <div class="field">
        <label>Descrição</label>
        <textarea
          data-incident-field="desc"
          data-incident-id="${incidentId}"
          placeholder="Ex: Atraso na entrega de material"
        >${escapeHtml(incident.desc || "")}</textarea>
      </div>
    </div>
  `;
}

function handleIncidentClick(event) {
  const actionEl = event.target.closest("[data-incident-action]");
  if (!actionEl) return;

  event.preventDefault();

  const action = actionEl.dataset.incidentAction;
  const incidentId = actionEl.dataset.incidentId;

  if (action === "add") {
    addIncident();
    return;
  }

  if (action === "remove") {
    removeIncident(incidentId);
  }
}

function handleIncidentInput(event) {
  const input = event.target.closest("[data-incident-field]");
  if (!input) return;

  setIncidentValue(
    input.dataset.incidentId,
    input.dataset.incidentField,
    input.value,
  );
}

function getIncidentsState() {
  if (window.S && Array.isArray(window.S.incidents)) return window.S.incidents;

  if (!Array.isArray(appState.incidents)) appState.incidents = [];
  return appState.incidents;
}

function syncIncidentsState(incidents) {
  appState.incidents = incidents;

  if (window.S) {
    window.S.incidents = incidents;
  }
}

function installTemporaryIncidentsBridge() {
  window.addIncident = addIncident;
  window.removeIncident = removeIncident;
  window.renderIncidents = renderIncidents;
  window.setInc = setIncidentValue;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}