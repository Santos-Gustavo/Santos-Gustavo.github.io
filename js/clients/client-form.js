// js/clients/client-form.js

import { appState } from "#state/app-state.js";

const FORM_FIELD_IDS = [
  "clientFormName",
  "clientFormPhone",
  "clientFormEmail",
  "clientFormNif",
  "clientFormAddress",
];

export function openNewClientForm() {
  appState.editingClientId = null;
  clearClientForm();
  setFormTitle("Novo Cliente");
  setSaveButtonLabel("Guardar");
  showFormPanel();
}

export function openEditClientForm(client) {
  if (!client) return;

  appState.editingClientId = client.id;

  setValue("clientFormName", client.name || "");
  setValue("clientFormPhone", client.phone || "");
  setValue("clientFormEmail", client.email || "");
  setValue("clientFormNif", client.nif || "");
  setValue("clientFormAddress", client.address || "");

  setFormTitle(`Editar cliente: ${client.name}`);
  setSaveButtonLabel("Guardar alterações");
  showFormPanel();
}

export function closeClientForm() {
  appState.editingClientId = null;
  clearClientForm();
  hideFormPanel();
}

export function getClientFormValues() {
  return {
    name: getValue("clientFormName"),
    phone: getValue("clientFormPhone"),
    email: getValue("clientFormEmail"),
    nif: getValue("clientFormNif"),
    address: getValue("clientFormAddress"),
  };
}

function clearClientForm() {
  FORM_FIELD_IDS.forEach((id) => setValue(id, ""));
}

function setFormTitle(title) {
  const el = document.getElementById("clientFormTitle");
  if (el) el.textContent = title;
}

function setSaveButtonLabel(label) {
  const btn = document.querySelector('#clientFormPanel [data-client-action="save"]');
  if (btn) btn.textContent = label;
}

function showFormPanel() {
  const panel = document.getElementById("clientFormPanel");
  if (panel) panel.classList.add("active");

  document.getElementById("step-clients")?.classList.add("client-form-open");

  document.getElementById("clientFormName")?.focus();
}

function hideFormPanel() {
  const panel = document.getElementById("clientFormPanel");
  if (panel) panel.classList.remove("active");

  document.getElementById("step-clients")?.classList.remove("client-form-open");
}

function getValue(id) {
  return document.getElementById(id)?.value || "";
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? "";
}
