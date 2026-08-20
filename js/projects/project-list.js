import { loadProjectsFromDb } from "#database/db-projects.js";
import { appState } from "#state/app-state.js";

export async function renderProjectList() {
  const el = document.getElementById("projectList");
  if (!el) return;

  el.innerHTML = '<p class="empty-hint">A carregar obras...</p>';

  try {
    const projects = await loadProjectsFromDb();
    appState.projectsCache = projects;

    if (projects.length === 0) {
      el.innerHTML = `
        <p class="empty-hint">
          Ainda sem obras guardadas na base de dados.<br>
          Clique em "+ Nova Obra" para começar.
        </p>
      `;
      return;
    }

    el.innerHTML = projects.map(renderProjectCard).join("");
  } catch (error) {
    console.error("Error rendering project list:", error);
    el.innerHTML = `
      <p class="empty-hint">
        Erro ao carregar obras: ${escapeHtml(error.message)}
      </p>
    `;
  }
}

function renderProjectCard(project) {
  return `
    <div class="project-card" data-project-action="select" data-project-id="${escapeHtml(project.id)}">
      <div class="project-card-main">
        <div class="project-card-name">${escapeHtml(project.name || "—")}</div>

        <div class="project-card-sub">
          ${escapeHtml(project.clientName || "")}
          ${project.location ? " · " + escapeHtml(project.location) : ""}
        </div>

        <div class="project-card-meta">
          Relatório #${project.lastReportNum || 0}
          ${project.contractNum ? " · " + escapeHtml(project.contractNum) : ""}
        </div>
      </div>

      <div class="project-card-actions">
        <button
          type="button"
          class="btn-project-edit"
          data-project-action="edit"
          data-project-id="${escapeHtml(project.id)}"
        >
          Editar
        </button>

        <button
          type="button"
          class="btn-project-delete"
          data-project-action="delete"
          data-project-id="${escapeHtml(project.id)}"
        >
          Apagar
        </button>
      </div>
    </div>
  `;
}

export function getProjectById(projectId) {
  return appState.projectsCache.find((project) => project.id === projectId) || null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}