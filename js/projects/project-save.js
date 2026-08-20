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

  console.log("appState before save:", JSON.parse(JSON.stringify(appState)));

  console.log("form values before save:", {
    companyName: values.companyName || "",
    companyTagline: values.companyTagline || "",
    companyNif: values.companyNif || "",
    companyInci: values.companyInci || "",
    responsible: values.responsible || "",
    companyPhone: values.companyPhone || "",
    companyEmail: values.companyEmail || "",
    projectName: values.projectName || "",
    clientName: values.clientName || "",
    location: values.location || "",
    contractNum: values.contractNum || "",
    distributedTo: values.distributedTo || "",
    sentVia: values.sentVia || "",
  });

  try {
    let company;
    let client;
    let project;

    if (appState.isEditingProject) {
      if (
        !appState.currentCompanyId ||
        !appState.currentClientId ||
        !appState.currentProjectId
      ) {
        throw new Error(
          "Modo edição ativo, mas faltam IDs da empresa, cliente ou obra."
        );
      }

      company = await updateCompanyById(appState.currentCompanyId, values);

      client = await updateClientById(
        appState.currentClientId,
        company.id,
        values
      );

      
      project = await updateProjectInDb(
        appState.currentProjectId,
        company.id,
        client.id,
        values
      );

    } else {
      company = await findOrCreateCompany(values);

      client = await findOrCreateClient(company.id, values);

      project = await createProjectInDb({
        companyId: company.id,
        clientId: client.id,
        values,
      });
    }

    if (!company?.id) {
      throw new Error("Empresa não foi guardada corretamente.");
    }

    if (!client?.id) {
      throw new Error("Cliente não foi guardado corretamente.");
    }

    if (!project?.id) {
      throw new Error("Obra não foi guardada corretamente.");
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

    alert("Erro ao guardar obra: " + error.message);

    return null;
  }
}