// ── PROJECT SAVE ────────────────────────────────────────────────────

async function saveCurrentProjectFromForm() {
  const v = getV();

  console.log("saveCurrentProjectFromForm values:", v);
  console.log("Editing mode:", S.isEditingProject);
  console.log("Current IDs:", {
    companyId: S.currentCompanyId,
    clientId: S.currentClientId,
    projectId: S.currentProjectId
  });

  try {
    let company;
    let client;
    let project;

    if (S.isEditingProject) {
      if (!S.currentCompanyId || !S.currentClientId || !S.currentProjectId) {
        throw new Error("Modo edição ativo, mas faltam IDs da empresa, cliente ou obra.");
      }

      company = await updateCompanyById(S.currentCompanyId, v);
      console.log("Company updated:", company);

      client = await updateClientById(S.currentClientId, company.id, v);
      console.log("Client updated:", client);

      project = await updateProjectById(S.currentProjectId, company.id, client.id, v);
      console.log("Project updated:", project);

    } else {
      company = await findOrCreateCompany(v);
      console.log("Company saved:", company);

      client = await findOrCreateClient(company.id, v);
      console.log("Client saved:", client);

      project = await findOrCreateProject(company.id, client.id, v);
      console.log("Project saved:", project);
    }

    S.currentCompanyId = company.id;
    S.currentClientId = client.id;
    S.currentProjectId = project.id;
    S.isNewProject = false;

    applyDefaultReportFields({
      reportNum: "1",
      distributedTo: v.distributedTo || "",
      sentVia: v.sentVia || "WhatsApp"
    });

    if (typeof renderProjectList === "function") {
      await renderProjectList();
    }

    return {
      company,
      client,
      project
    };

  } catch (error) {
    console.error("Error saving project:", error);
    alert("Erro ao guardar obra: " + error.message);
    return null;
  }
}