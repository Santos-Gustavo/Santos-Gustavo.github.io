// js/reports/report-save.js

import { appState } from "#state/app-state.js";
import { getReportFormValues } from "#forms/form-values.js";
import { findOrCreateCompany } from "#database/db-companies.js";
import { findOrCreateClient } from "#database/db-clients.js";
import { createProjectInDb } from "#database/db-projects.js";
import {
  createReport,
  updateReportSnapshot,
} from "#database/db-reports.js";
import { savePhotosForReport } from "#database/db-photos.js";
import { renderProjectList } from "#projects/project-list.js";
import { buildCurrentReportDocument } from "#reports/report-document-builder.js";

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

    }

    const report = await createReport({
      projectId: project.id,
      values,
      state: getCurrentReportState(),
      snapshotJson: null,
    });

    const photos = await savePhotosForReport({
      reportId: report.id,
      companyId: company.id,
      projectId: project.id,
      photos: getCurrentReportState().photos,
    });

    applySavedPhotosToRuntimeState(photos);

    const snapshotJson = buildCurrentReportDocument({
      report,
      includePhotoDisplayUrls: false,
    });

    const reportWithSnapshot = await updateReportSnapshot({
      reportId: report.id,
      snapshotJson,
    });

    console.log("Saved normalized report with immutable snapshot:", {
      company,
      client,
      project,
      report: reportWithSnapshot,
      photos,
      snapshotJson,
    });

    alert("Relatório guardado com sucesso.");

    await renderProjectList();

    return {
      company,
      client,
      project,
      report: reportWithSnapshot,
      photos,
      snapshotJson,
    };
  } catch (error) {
    console.error("Supabase save error:", error);
    alert("Erro ao guardar relatório: " + error.message);
    return null;
  }
}

function getCurrentReportState() {
  return appState;
}

function applySavedPhotosToRuntimeState(savedPhotos) {
  if (!Array.isArray(savedPhotos) || savedPhotos.length === 0) return;

  const state = getCurrentReportState();

  if (!Array.isArray(state.photos)) return;

  state.photos = state.photos.map((photo, index) => {
    const savedPhoto = savedPhotos[index];

    if (!savedPhoto) return photo;

    return {
      ...photo,
      photoId: savedPhoto.photoId || savedPhoto.id || null,
      storagePath: savedPhoto.storagePath || photo.storagePath || "",
      signedUrl: savedPhoto.signedUrl || photo.signedUrl || "",
      fileUrl: savedPhoto.fileUrl || photo.fileUrl || "",
    };
  });

  appState.photos = state.photos;

}