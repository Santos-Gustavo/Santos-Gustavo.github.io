// js/reports/report-save.js

import { appState } from "#state/app-state.js";
import { getReportFormValues } from "#forms/form-values.js";
import { findOrCreateCompany } from "#database/db-companies.js";
import { findOrCreateClient } from "#database/db-clients.js";
import { createProjectInDb } from "#database/db-projects.js";
import { createReport } from "#database/db-reports.js";
import { savePhotosForReport } from "#database/db-photos.js";
import { renderProjectList } from "#projects/project-list.js";

export async function saveReportToSupabase() {
  const values = getReportFormValues();

  try {
    let company;
    let client;
    let project;

    if (appState.currentCompanyId && appState.currentClientId && appState.currentProjectId) {
      company = { id: appState.currentCompanyId };
      client = { id: appState.currentClientId };
      project = { id: appState.currentProjectId };
    } else if (window.S?.currentCompanyId && window.S?.currentClientId && window.S?.currentProjectId) {
      company = { id: window.S.currentCompanyId };
      client = { id: window.S.currentClientId };
      project = { id: window.S.currentProjectId };

      appState.currentCompanyId = company.id;
      appState.currentClientId = client.id;
      appState.currentProjectId = project.id;
    } else {
      company = await findOrCreateCompany(values);
      client = await findOrCreateClient(company.id, values);

      project = await createProjectInDb({
        companyId: company.id,
        clientId: client.id,
        values,
      });

      appState.currentCompanyId = company.id;
      appState.currentClientId = client.id;
      appState.currentProjectId = project.id;

      syncLegacySelection();
    }

    const report = await createReport({
      projectId: project.id,
      values,
      state: getCurrentReportState(),
    });

    const photos = await savePhotosForReport({
      reportId: report.id,
      companyId: company.id,
      projectId: project.id,
      photos: getCurrentReportState().photos,
    });

    console.log("Saved normalized report:", {
      company,
      client,
      project,
      report,
      photos,
    });

    alert("Relatório guardado com sucesso.");

    await renderProjectList();

    return {
      company,
      client,
      project,
      report,
      photos,
    };
  } catch (error) {
    console.error("Supabase save error:", error);
    alert("Erro ao guardar relatório: " + error.message);
    return null;
  }
}

function getCurrentReportState() {
  if (window.S) {
    return window.S;
  }

  return appState;
}

function syncLegacySelection() {
  if (!window.S) return;

  window.S.currentCompanyId = appState.currentCompanyId;
  window.S.currentClientId = appState.currentClientId;
  window.S.currentProjectId = appState.currentProjectId;
}