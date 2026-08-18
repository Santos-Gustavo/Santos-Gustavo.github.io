async function saveReportToSupabase() {
  const v = getV();

  try {
    let company;
    let client;
    let project;

    if (S.currentCompanyId && S.currentClientId && S.currentProjectId) {
      company = { id: S.currentCompanyId };
      client = { id: S.currentClientId };
      project = { id: S.currentProjectId };
    } else {
      company = await findOrCreateCompany(v);
      client = await findOrCreateClient(company.id, v);
      project = await findOrCreateProject(company.id, client.id, v);

      S.currentCompanyId = company.id;
      S.currentClientId = client.id;
      S.currentProjectId = project.id;
    }

    // Normalized DB: reports only need project_id
    const report = await createReport(project.id, v);

    // Normalized DB: photos only need report_id
    const photos = await savePhotosForReport({
      reportId: report.id
    });

    console.log("Saved normalized report:", {
      company,
      client,
      project,
      report,
      photos
    });

    alert("Relatório guardado com sucesso.");

    await renderProjectList();

    return {
      company,
      client,
      project,
      report,
      photos
    };

  } catch (error) {
    console.error("Supabase save error:", error);
    alert("Erro ao guardar relatório: " + error.message);
    return null;
  }
}

window.createEupagoPayment = createEupagoPayment;