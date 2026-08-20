import { renderProjectList } from "#projects/project-list.js";
import { saveCurrentProjectFromForm } from "#projects/project-save.js";
import { deleteProject } from "#projects/project-delete.js";
import {
  newProject,
  selectProject,
  editProject,
} from "#projects/project-selection.js";
import {
  clearProjectForm,
  loadProjectIntoForm,
  applyDefaultReportFields,
} from "#projects/project-form.js";

let initialized = false;

export function initProjects() {
  if (initialized) return;
  initialized = true;

  document.addEventListener("click", handleProjectClick);

}

async function handleProjectClick(event) {
  const actionEl = event.target.closest("[data-project-action]");
  if (!actionEl) return;

  const action = actionEl.dataset.projectAction;
  const projectId = actionEl.dataset.projectId;

  event.preventDefault();
  event.stopPropagation();

  if (action === "new-project") {
    newProject();
    return;
  }

  if (action === "select") {
    selectProject(projectId);
    return;
  }

  if (action === "edit") {
    editProject(projectId);
    return;
  }

  if (action === "delete") {
    await deleteProject(projectId);
  }
}
