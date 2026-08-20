// js/mappers/report-mapper.js

import { mapSentViaLabelToCode } from "#database/db-codes.js";

export function buildReportInsertPayload({
  projectId,
  values,
  state,
  reportNum,
}) {
  if (!projectId) {
    throw new Error("projectId é obrigatório para criar relatório.");
  }

  return {
    project_id: projectId,

    report_num: reportNum,
    report_date: values.reportDate || new Date().toISOString().slice(0, 10),

    period_start: values.periodStart || null,
    period_end: values.periodEnd || null,

    distributed_to: cleanText(values.distributedTo) || null,
    sent_via: mapSentViaLabelToCode(values.sentVia),

    phase: cleanText(state.phase) || null,
    progress_pct: values.progressPct ? Number(values.progressPct) : 0,

    week_summary: cleanText(values.weekSummary) || null,

    alert_on: Boolean(state.alertOn),
    alert_title: cleanText(values.alertTitle) || null,
    alert_desc: cleanText(values.alertDesc) || null,
    alert_deadline: values.alertDeadline || null,
    alert_consequence: cleanText(values.alertConsequence) || null,

    incidents_on: Boolean(state.incidentsOn),

    financial_note: cleanText(values.financialNote) || null,

    works: Array.isArray(state.works) ? state.works : [],
    incidents: Array.isArray(state.incidents) ? state.incidents : [],
    extras: Array.isArray(state.extras) ? state.extras : [],
    next_steps: Array.isArray(state.nextSteps) ? state.nextSteps : [],

    status: 0,
  };
}

export function mapReportRowToAppReport(row) {
  if (!row) return null;

  return {
    id: row.id,
    reportId: row.id,
    projectId: row.project_id,

    reportNum: row.report_num,
    reportDate: row.report_date,

    periodStart: row.period_start,
    periodEnd: row.period_end,

    distributedTo: row.distributed_to,
    sentVia: row.sent_via,

    phase: row.phase,
    progressPct: row.progress_pct,

    weekSummary: row.week_summary,

    alertOn: row.alert_on,
    alertTitle: row.alert_title,
    alertDesc: row.alert_desc,
    alertDeadline: row.alert_deadline,
    alertConsequence: row.alert_consequence,

    incidentsOn: row.incidents_on,

    financialNote: row.financial_note,

    works: row.works || [],
    incidents: row.incidents || [],
    extras: row.extras || [],
    nextSteps: row.next_steps || [],

    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function cleanText(value) {
  const text = String(value ?? "").trim();
  return text || "";
}