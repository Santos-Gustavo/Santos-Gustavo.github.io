// js/reports/report-document-builder.js

import { appState } from "#state/app-state.js";
import { getReportFormValues } from "#forms/form-values.js";

export function buildCurrentReportDocument(options = {}) {
  const values = getReportFormValues();
  const state = getRuntimeState();

  const reportRow = options.report || null;
  const includePhotoDisplayUrls = Boolean(options.includePhotoDisplayUrls);

  return deepFreeze({
    schemaVersion: 1,

    meta: {
      reportId: reportRow?.id || options.reportId || null,
      projectId: reportRow?.project_id || state.currentProjectId || null,
      mode: normalizeMode(state.mode),
      reportNumber: reportRow?.report_num || values.reportNum || "1",
      reportDate: reportRow?.report_date || values.reportDate || new Date().toISOString().slice(0, 10),
      periodStart: reportRow?.period_start || values.periodStart || null,
      periodEnd: reportRow?.period_end || values.periodEnd || null,
      generatedAt: new Date().toISOString(),
    },

    // Sourced from the live company profile (COMPANY-PROFILE-001) so an edit
    // to company data shows up in the next report generated, not from
    // whatever happens to sit in the DOM form fields. tagline is the one
    // exception — it was never persisted to the company row, it's a
    // per-report free-text field read straight from the form.
    company: {
      id: state.currentCompanyId || null,
      name: state.currentCompany?.name || values.companyName || "",
      tagline: values.companyTagline || "",
      nif: state.currentCompany?.nif || values.companyNif || "",
      impic: state.currentCompany?.impic || values.companyInci || "",
      responsible: state.currentCompany?.responsible || values.responsible || "",
      phone: state.currentCompany?.phone || values.companyPhone || "",
      email: state.currentCompany?.email || values.companyEmail || "",
    },

    project: {
      id: state.currentProjectId || null,
      clientId: state.currentClientId || null,
      name: values.projectName || "",
      clientName: values.clientName || "",
      location: values.location || "",
      contractNumber: values.contractNum || "",
      contractValue: toNumber(values.contractValue),
    },

    progress: {
      phase: state.phase || "",
      percentage: clampPercent(values.progressPct),
      weekSummary: values.weekSummary || "",
    },

    alert: {
      enabled: Boolean(state.alertOn),
      title: values.alertTitle || "",
      description: values.alertDesc || "",
      deadline: values.alertDeadline || null,
      consequence: values.alertConsequence || "",
    },

    incidents: {
      enabled: Boolean(state.incidentsOn),
      items: normalizeArray(state.incidents).map((incident) => ({
        description: incident.desc || incident.description || "",
      })),
    },

    works: normalizeArray(state.works).map((work) => ({
      type: work.type || "",
      area: work.area || "",
      description: work.desc || work.description || "",
      status: normalizeWorkStatus(work.status),
    })),

    photos: normalizeArray(state.photos).map((photo) => ({
      id: photo.photoId || photo.id || null,
      area: photo.area || "",
      description: photo.desc || photo.description || "",
      worker: photo.worker || "",
      stage: photo.type || photo.stage || "during",

      // Persist storagePath. Hydrate displayUrl at render time.
      storagePath: photo.storagePath || "",

      // Only for unsaved preview. Never use this when writing snapshot_json.
      displayUrl: includePhotoDisplayUrls
        ? photo.dataUrl || photo.signedUrl || photo.fileUrl || ""
        : "",
    })),

    extras: normalizeArray(state.extras).map((extra) => ({
      ref: extra.ref || "",
      title: extra.title || "",
      description: extra.desc || extra.description || "",
      cost: toNumber(extra.cost),
      status: extra.status === "approved" ? "approved" : "pending",
      approvedBy: extra.approvedBy || "",
      approvalMethod: extra.apvalMethod || extra.approvalMethod || "",
      approvalDate: extra.approvalDate || null,
      deadline: extra.deadline || null,
    })),

    nextSteps: normalizeArray(state.nextSteps).map((step) => ({
      description: step.desc || step.description || "",
      date: step.date || null,
    })),

    financialNote: values.financialNote || "",
  });
}

function getRuntimeState() {
  return appState;
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function clampPercent(value) {
  const number = toNumber(value);
  return Math.max(0, Math.min(100, number));
}

function normalizeWorkStatus(status) {
  if (status === "done") return "done";
  if (status === "progress") return "progress";
  if (status === "blocked") return "blocked";
  return "progress";
}

function normalizeMode(mode) {
  if (mode === "legal") return "legal";
  if (mode === "final") return "final";
  return "weekly";
}

function deepFreeze(value) {
  if (!value || typeof value !== "object") {
    return value;
  }

  Object.freeze(value);

  for (const key of Object.keys(value)) {
    deepFreeze(value[key]);
  }

  return value;
}