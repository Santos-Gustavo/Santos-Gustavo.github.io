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

  setFormTitle("Editar Cliente");
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

function showFormPanel() {
  const panel = document.getElementById("clientFormPanel");
  if (panel) panel.classList.add("active");

  document.getElementById("clientFormName")?.focus();
}

function hideFormPanel() {
  const panel = document.getElementById("clientFormPanel");
  if (panel) panel.classList.remove("active");
}

function getValue(id) {
  return document.getElementById(id)?.value || "";
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? "";
}
