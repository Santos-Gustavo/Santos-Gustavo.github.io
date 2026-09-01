// js/clients/client-actions.js

import {
  createClient,
  updateClientRecord,
  archiveClientById,
  unarchiveClientById,
  deleteClientById,
} from "#database/db-clients.js";
import { appState } from "#state/app-state.js";
import { resolveActiveCompanyId, renderClientList, getClientById } from "#clients/client-list.js";
import { closeClientForm, getClientFormValues } from "#clients/client-form.js";

// Deliberately loose — "something@something.something" — so real Portuguese
// client domains (.pt, .com.pt, etc.) are never blocked. Only catches
// obviously malformed input (no "@", no domain, no TLD, more than one "@").
const CLIENT_EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function saveClientFromForm() {
  const values = getClientFormValues();

  if (values.email && !CLIENT_EMAIL_PATTERN.test(values.email)) {
    alert("O email do cliente é inválido.");
    return false;
  }

  try {
    const companyId = await resolveActiveCompanyId();

    if (!companyId) {
      alert(
        "Ainda não existe uma empresa registada. Crie o primeiro projeto para configurar os dados da empresa."
      );
      return false;
    }

    if (appState.editingClientId) {
      await updateClientRecord(appState.editingClientId, companyId, values);
    } else {
      await createClient(companyId, values);
    }

    closeClientForm();
    await renderClientList();

    return true;
  } catch (error) {
    console.error("Error saving client:", error);
    alert("Erro ao guardar cliente: " + error.message);
    return false;
  }
}

export async function archiveClientFlow(clientId) {
  const client = getClientById(clientId);

  if (!client) {
    alert("Cliente não encontrado.");
    return;
  }

  const confirmed = confirm(
    `Arquivar o cliente "${client.name}"?\n\n` +
      "O cliente deixará de aparecer na lista principal e no seletor de clientes de novos projetos, " +
      "mas os projetos, relatórios e links de partilha existentes serão preservados."
  );

  if (!confirmed) return;

  try {
    const companyId = await resolveActiveCompanyId();
    await archiveClientById(clientId, companyId);

    await renderClientList();
  } catch (error) {
    console.error("Error archiving client:", error);
    alert("Erro ao arquivar cliente: " + error.message);
  }
}

export async function unarchiveClientFlow(clientId) {
  const client = getClientById(clientId);

  if (!client) {
    alert("Cliente não encontrado.");
    return;
  }

  try {
    const companyId = await resolveActiveCompanyId();
    await unarchiveClientById(clientId, companyId);

    await renderClientList();
  } catch (error) {
    console.error("Error reactivating client:", error);
    alert("Erro ao reativar cliente: " + error.message);
  }
}

export async function deleteClientFlow(clientId) {
  const client = getClientById(clientId);

  if (!client) {
    alert("Cliente não encontrado.");
    return;
  }

  if (client.projectCount > 0) {
    alert(
      "Não é possível eliminar um cliente com obras associadas. Utilize a opção Arquivar."
    );
    return;
  }

  const confirmed = confirm(
    `Eliminar definitivamente o cliente "${client.name}"?\n\nEsta ação não pode ser revertida.`
  );

  if (!confirmed) return;

  try {
    const companyId = await resolveActiveCompanyId();
    await deleteClientById(clientId, companyId);

    await renderClientList();
  } catch (error) {
    console.error("Error deleting client:", error);
    alert("Erro ao eliminar cliente: " + error.message);
  }
}
