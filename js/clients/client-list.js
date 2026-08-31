// js/clients/client-list.js

import { loadClientDirectoryForCompany, loadClientsForCompany } from "#database/db-clients.js";
import { mapClientRowToAppClient } from "#mappers/client-mapper.js";
import { appState } from "#state/app-state.js";
import { resolvePrimaryCompanyId } from "#company/company-profile.js";

// Delegates to the single primary-company resolver (COMPANY-PROFILE-001) —
// kept as a re-export here so client-actions.js/client-index.js don't need
// to know the client directory and the company profile now share one source
// of truth for "which company".
export async function resolveActiveCompanyId() {
  return resolvePrimaryCompanyId();
}

function shouldShowClientForCurrentFilter(client) {
  const filter = appState.clientListFilter || "active";

  if (filter === "archived") {
    return Boolean(client.archivedAt);
  }

  return !client.archivedAt;
}

function matchesClientSearch(client, searchTerm) {
  const term = (searchTerm || "").trim().toLowerCase();
  if (!term) return true;

  const name = (client.name || "").toLowerCase();
  const phone = (client.phone || "").toLowerCase();

  return name.includes(term) || phone.includes(term);
}

function getEmptyMessageForCurrentFilter(searchTerm) {
  if (searchTerm && searchTerm.trim()) {
    return "Nenhum cliente encontrado para essa pesquisa.";
  }

  if ((appState.clientListFilter || "active") === "archived") {
    return "Ainda não existem clientes arquivados.";
  }

  return `Ainda sem clientes guardados.<br>
Clique em "+ Novo Cliente" para começar.`;
}

// Full reload from the DB — call after entering the Clientes page and after
// any mutation (create/edit/archive/delete), so project counts stay correct.
export async function renderClientList() {
  const el = document.getElementById("clientList");
  if (!el) return;

  el.innerHTML = '<p class="empty-hint">A carregar clientes...</p>';

  try {
    const companyId = await resolveActiveCompanyId();

    if (!companyId) {
      appState.clientsCache = [];
      el.innerHTML = `
        <p class="empty-hint">
          Ainda sem empresa registada.<br>
          Crie o primeiro projeto para configurar os dados da empresa antes de adicionar clientes.
        </p>
      `;
      return;
    }

    const rows = await loadClientDirectoryForCompany(companyId);
    appState.clientsCache = rows.map(mapClientRowToAppClient);

    renderClientListFromCache();
  } catch (error) {
    console.error("Error rendering client list:", error);
    el.innerHTML = `
      <p class="empty-hint">
        Erro ao carregar clientes: ${escapeHtml(error.message)}
      </p>
    `;
  }
}

// Cheap re-render from the already-loaded cache — used for search-as-you-type
// and filter tab switches, so those don't trigger a network round trip.
export function renderClientListFromCache() {
  const el = document.getElementById("clientList");
  if (!el) return;

  const searchTerm = document.getElementById("clientSearchInput")?.value || "";

  const visibleClients = appState.clientsCache
    .filter(shouldShowClientForCurrentFilter)
    .filter((client) => matchesClientSearch(client, searchTerm));

  if (visibleClients.length === 0) {
    el.innerHTML = `<p class="empty-hint">${getEmptyMessageForCurrentFilter(searchTerm)}</p>`;
    return;
  }

  el.innerHTML = visibleClients.map(renderClientCard).join("");
}

function renderClientCard(client) {
  const isArchived = Boolean(client.archivedAt);

  return `
    <div class="project-card" data-client-id="${escapeHtml(client.id)}">
      <div class="project-card-main">
        <div class="project-card-title-row">
          <div class="project-card-name">${escapeHtml(client.name || "—")}</div>
          ${
            isArchived
              ? '<span class="client-status-badge client-status-badge--archived">Arquivado</span>'
              : ""
          }
        </div>

        <div class="project-card-sub">
          ${escapeHtml(client.phone || "Sem telefone")}
          ${client.email ? " · " + escapeHtml(client.email) : ""}
        </div>

        <div class="project-card-meta">
          ${client.projectCount} ${client.projectCount === 1 ? "obra associada" : "obras associadas"}
        </div>
      </div>

      <div class="project-card-actions">
        <button
          type="button"
          class="btn-project-edit"
          data-client-action="edit"
          data-client-id="${escapeHtml(client.id)}"
        >
          Editar
        </button>

        ${
          isArchived
            ? `
              <button
                type="button"
                class="btn-project-edit"
                data-client-action="unarchive"
                data-client-id="${escapeHtml(client.id)}"
              >
                Reativar
              </button>
            `
            : `
              <button
                type="button"
                class="btn-project-archive"
                data-client-action="archive"
                data-client-id="${escapeHtml(client.id)}"
              >
                Arquivar Cliente
              </button>
            `
        }

        <button
          type="button"
          class="btn-project-archive"
          data-client-action="delete"
          data-client-id="${escapeHtml(client.id)}"
        >
          Eliminar
        </button>
      </div>
    </div>
  `;
}

export function bindClientListFilters() {
  const filterButtons = document.querySelectorAll("[data-client-filter]");

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextFilter = button.dataset.clientFilter || "active";

      appState.clientListFilter = nextFilter;

      filterButtons.forEach((otherButton) => {
        otherButton.classList.toggle(
          "is-active",
          otherButton.dataset.clientFilter === nextFilter
        );
      });

      renderClientListFromCache();
    });
  });
}

export function bindClientSearch() {
  const input = document.getElementById("clientSearchInput");
  if (!input) return;

  input.addEventListener("input", () => {
    renderClientListFromCache();
  });
}

// Populates the <datalist> the project-creation "Cliente" field autocompletes
// against (index.html #clientNameOptions). Text input stays the source of
// truth (findOrCreateClient matches by name) — this only surfaces active
// clients as suggestions so picking an existing one doesn't require retyping
// it exactly, and archived clients don't show up as a suggestion.
export async function populateClientNameOptions() {
  const datalist = document.getElementById("clientNameOptions");
  if (!datalist) return;

  try {
    const companyId = await resolveActiveCompanyId();
    if (!companyId) {
      datalist.innerHTML = "";
      return;
    }

    const activeClients = await loadClientsForCompany(companyId, { includeArchived: false });

    datalist.innerHTML = activeClients
      .map((client) => `<option value="${escapeHtml(client.name)}"></option>`)
      .join("");
  } catch (error) {
    console.warn("Could not load client name suggestions:", error);
  }
}

export function getClientById(clientId) {
  return appState.clientsCache.find((client) => client.id === clientId) || null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
