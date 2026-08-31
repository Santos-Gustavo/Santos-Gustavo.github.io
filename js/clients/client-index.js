// js/clients/client-index.js

import {
  bindClientListFilters,
  bindClientSearch,
  renderClientList,
  getClientById,
} from "#clients/client-list.js";
import { openNewClientForm, openEditClientForm, closeClientForm } from "#clients/client-form.js";
import {
  saveClientFromForm,
  archiveClientFlow,
  unarchiveClientFlow,
  deleteClientFlow,
} from "#clients/client-actions.js";

let initialized = false;

export function initClients() {
  if (initialized) return;
  initialized = true;

  bindClientListFilters();
  bindClientSearch();

  document.addEventListener("click", handleClientClick);
}

export async function openClientsPage() {
  closeClientForm();
  await renderClientList();
}

async function handleClientClick(event) {
  const actionEl = event.target.closest("[data-client-action]");
  if (!actionEl) return;

  const action = actionEl.dataset.clientAction;
  const clientId = actionEl.dataset.clientId;

  event.preventDefault();
  event.stopPropagation();

  if (action === "new") {
    openNewClientForm();
    return;
  }

  if (action === "cancel-form") {
    closeClientForm();
    return;
  }

  if (action === "save") {
    await saveClientFromForm();
    return;
  }

  if (action === "edit") {
    const client = getClientById(clientId);
    openEditClientForm(client);
    return;
  }

  if (action === "archive") {
    await archiveClientFlow(clientId);
    return;
  }

  if (action === "unarchive") {
    await unarchiveClientFlow(clientId);
    return;
  }

  if (action === "delete") {
    await deleteClientFlow(clientId);
  }
}
