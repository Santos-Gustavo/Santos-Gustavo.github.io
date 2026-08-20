// js/reports/report-document-builder.js

import { appState } from "#state/app-state.js";
import { getReportFormValues } from "#forms/form-values.js";

export function buildCurrentReportDocument() {
  const values = getReportFormValues();
  const state = getRuntimeState();

  return deepFreeze({
    meta: {
      mode: normalizeMode(state.mode),
      reportNumber: values.reportNum || "1",
      reportDate: values.reportDate || new Date().toISOString().slice(0, 10),
      periodStart: values.periodStart || null,
      periodEnd: values.periodEnd || null,
      generatedAt: new Date().toISOString(),
    },

    company: {
      name: values.companyName || "",
      tagline: values.companyTagline || "",
      nif: values.companyNif || "",
      impic: values.companyInci || "",
      responsible: values.responsible || "",
      phone: values.companyPhone || "",
      email: values.companyEmail || "",
    },

    project: {
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
      area: photo.area || "",
      description: photo.desc || photo.description || "",
      worker: photo.worker || "",
      stage: photo.type || photo.stage || "during",

      // Preview-only. Do not treat this as immutable report storage.
      displayUrl: photo.dataUrl || photo.signedUrl || photo.fileUrl || "",
      storagePath: photo.storagePath || "",
    })),

    extras: normalizeArray(state.extras).map((extra) => ({
      ref: extra.ref || "",
      title: extra.title || "",
      description: extra.desc || extra.description || "",
      cost: toNumber(extra.cost),
      status: extra.status === "approved" ? "approved" : "pending",
      approvedBy: extra.approvedBy || "",
      approvalMethod: extra.approvalMethod || "",
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
  // Dirty migration seam isolated here only.
  // Renderer must never read window.S or appState directly.
  return window.S || appState;
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