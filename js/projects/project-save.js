import { appState } from "#state/app-state.js";
import { getProjectFormValues } from "#forms/form-values.js";
import {
  findOrCreateCompany,
  updateCompanyById,
} from "#database/db-companies.js";
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

export async function saveCurrentProjectFromForm() {
  const values = getProjectFormValues();

  try {
    let company;
    let client;
    let project;

    if (appState.isEditingProject) {
      if (!appState.currentCompanyId || !appState.currentClientId || !appState.currentProjectId) {
        throw new Error("Modo edição ativo, mas faltam IDs da empresa, cliente ou obra.");
      }

      company = await updateCompanyById(appState.currentCompanyId, values);
      client = await updateClientById(appState.currentClientId, company.id, values);
      project = await updateProjectInDb(appState.currentProjectId, company.id, client.id, values);
    } else {
      company = await findOrCreateCompany(values);
      client = await findOrCreateClient(company.id, values);
      project = await createProjectInDb({
        companyId: company.id,
        clientId: client.id,
        values,
      });
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

    await renderProjectList();

    return {
      company,
      client,
      project,
    };
  } catch (error) {
    console.error("Error saving project:", error);
    alert("Erro ao guardar obra: " + error.message);
    return null;
  }
}
