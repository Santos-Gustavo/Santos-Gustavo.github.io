import { loadProjectsFromDb } from "#database/db-projects.js";
import { appState } from "#state/app-state.js";
import {
  canEditProject,
  canShowInArchivedProjectList,
  canShowInDefaultProjectList,
  canShowInHiddenProjectList,
  getProjectStatusLabel,
  isProjectCompleted,
} from "#projects/project-status-rules.js";

function shouldShowProjectForCurrentFilter(project) {
  const filter = appState.projectListFilter || "active";

  if (filter === "all") {
    return !canShowInHiddenProjectList(project);
  }

  if (filter === "active") {
    return canShowInDefaultProjectList(project);
  }

  if (filter === "completed") {
    return isProjectCompleted(project) && !project.hidden_at && !project.hiddenAt;
  }

  if (filter === "archived") {
    return canShowInArchivedProjectList(project);
  }

  if (filter === "hidden") {
    return canShowInHiddenProjectList(project);
  }

  return canShowInDefaultProjectList(project);
}

function getEmptyMessageForCurrentFilter() {
  const filter = appState.projectListFilter || "active";

  if (filter === "completed") {
    return "Ainda não existem projetos concluídas.";
  }

  if (filter === "archived") {
    return "Ainda não existem projetos arquivadas.";
  }

  if (filter === "hidden") {
    return "Ainda não existem projetos ocultas.";
  }

  return `Ainda sem projetos guardadas na base de dados.<br>
Clique em "+ Novo Projeto" para começar.`;
}

export async function renderProjectList() {
  const el = document.getElementById("projectList");
  if (!el) return;

  el.innerHTML = '<p class="empty-hint">A carregar projetos...</p>';

  try {
    const projects = await loadProjectsFromDb();
    appState.projectsCache = projects;

    const visibleProjects = projects.filter(shouldShowProjectForCurrentFilter);

    if (visibleProjects.length === 0) {
      el.innerHTML = `
        <p class="empty-hint">
          ${getEmptyMessageForCurrentFilter()}
        </p>
      `;
      return;
    }

    el.innerHTML = visibleProjects.map(renderProjectCard).join("");
  } catch (error) {
    console.error("Error rendering project list:", error);
    el.innerHTML = `
      <p class="empty-hint">
        Erro ao carregar projetos: ${escapeHtml(error.message)}
      </p>
    `;
  }
}

function renderProjectCard(project) {
  const statusLabel = getProjectStatusLabel(project.status);
  const canEdit = canEditProject(project);

  return `
    <div class="project-card" data-project-action="select" data-project-id="${escapeHtml(project.id)}">
      <div class="project-card-main">
        <div class="project-card-title-row">
          <div class="project-card-name">${escapeHtml(project.name || "—")}</div>
          <span class="project-status-badge">${escapeHtml(statusLabel)}</span>
        </div>

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
        ${
          canEdit
            ? `
              <button
                type="button"
                class="btn-project-edit"
                data-project-action="edit"
                data-project-id="${escapeHtml(project.id)}"
              >
                Editar
              </button>
            `
            : ""
        }

        <button
          type="button"
          class="btn-project-delete"
          data-project-action="delete"
          data-project-id="${escapeHtml(project.id)}"
        >
          Arquivar/Ocultar
        </button>
      </div>
    </div>
  `;
}

export function bindProjectListFilters() {
  const filterButtons = document.querySelectorAll("[data-project-filter]");

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextFilter = button.dataset.projectFilter || "active";

      appState.projectListFilter = nextFilter;

      filterButtons.forEach((otherButton) => {
        otherButton.classList.toggle(
          "is-active",
          otherButton.dataset.projectFilter === nextFilter
        );
      });

      renderProjectList();
    });
  });
}

export function upsertProjectInCache(project) {
  if (!project?.id) {
    return;
  }

  const existingIndex = appState.projectsCache.findIndex(
    (cachedProject) => cachedProject.id === project.id
  );

  if (existingIndex >= 0) {
    appState.projectsCache[existingIndex] = project;
    return;
  }

  appState.projectsCache.unshift(project);
}

export function getProjectById(projectId) {
  return (
    appState.projectsCache.find((project) => project.id === projectId) || null
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}