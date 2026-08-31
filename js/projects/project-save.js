import { appState } from "#state/app-state.js";
import { getProjectFormValues } from "#forms/form-values.js";
import {
  findOrCreateClient,
  updateClientById,
} from "#database/db-clients.js";
import {
  createProjectInDb,
  updateProjectInDb,
} from "#database/db-projects.js";
import { applyDefaultReportFields } from "#projects/project-form.js";
import { renderProjectList } from "#projects/project-list.js";

// Company creation/editing is fully decoupled from project creation
// (COMPANY-PROFILE-001) — this only ever attaches to the already-loaded
// primary company (appState.primaryCompanyId/currentCompanyId), never
// creates or updates a company row itself.
export async function saveCurrentProjectFromForm() {

  const values = getProjectFormValues();

  try {
    let client;
    let project;

    const companyId = appState.isEditingProject
      ? appState.currentCompanyId
      : appState.primaryCompanyId;

    if (!companyId) {
      throw new Error(
        "Nenhuma empresa configurada. Guarde os Dados da Empresa antes de criar um projeto."
      );
    }

    if (appState.isEditingProject) {
      if (!appState.currentClientId || !appState.currentProjectId) {
        throw new Error(
          "Modo edição ativo, mas faltam IDs do cliente ou do projeto."
        );
      }

      client = await updateClientById(
        appState.currentClientId,
        companyId,
        values
      );

      project = await updateProjectInDb(
        appState.currentProjectId,
        companyId,
        client.id,
        values
      );

    } else {
      client = await findOrCreateClient(companyId, values);

      project = await createProjectInDb({
        companyId,
        clientId: client.id,
        values,
      });
    }

    const company = { id: companyId };

    if (!client?.id) {
      throw new Error("Cliente não foi guardado corretamente.");
    }

    if (!project?.id) {
      throw new Error("Projeto não foi guardada corretamente.");
    }

    appState.currentCompanyId = company.id;
    appState.currentClientId = client.id;
    appState.currentProjectId = project.id;
    appState.isNewProject = false;

    applyDefaultReportFields({
      reportNum: "1",
      distributedTo: values.distributedTo || "",
      sentVia: values.sentVia || "WhatsApp",
    });

    renderProjectList().catch((error) => {
      console.warn("Project list refresh failed after saving project:", error);
    });


    console.groupEnd();

    return {
      company,
      client,
      project,
    };
  } catch (error) {
    console.error("Error saving project:", error);
    console.groupEnd();

    alert("Erro ao guardar projeto: " + error.message);

    return null;
  }
}