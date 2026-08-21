// js/database/db-reports.js

import { supabaseClient } from "#database/supabase-client.js";
import { throwIfDbError } from "#database/db-helpers.js";
import {
  buildReportInsertPayload,
  mapReportRowToAppReport,
} from "#mappers/report-mapper.js";

export async function createReport({
  projectId,
  values,
  state,
  snapshotJson = null,
}) {
  const reportNum = await getNextReportNum(projectId);

  const payload = buildReportInsertPayload({
    projectId,
    values,
    state,
    reportNum,
    snapshotJson,
  });

  const { data, error } = await supabaseClient
    .from("reports")
    .insert(payload)
    .select()
    .single();

  throwIfDbError(error, "Erro ao criar relatório.");

  return data;
}

export async function updateReportSnapshot({
  reportId,
  snapshotJson,
}) {
  if (!reportId) {
    throw new Error("reportId é obrigatório para atualizar snapshot.");
  }

  if (!snapshotJson || typeof snapshotJson !== "object") {
    throw new Error("snapshotJson inválido.");
  }

  const { data, error } = await supabaseClient
    .from("reports")
    .update({
      snapshot_json: snapshotJson,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reportId)
    .is("deleted_at", null)
    .select()
    .single();

  throwIfDbError(error, "Erro ao atualizar snapshot do relatório.");

  return data;
}

export async function getLatestReportForProject(projectId) {
  if (!projectId) return null;

  const { data, error } = await supabaseClient
    .from("reports")
    .select("*")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("report_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  throwIfDbError(error, "Erro ao carregar último relatório.");

  return data;
}

export async function getReportById(reportId) {
  if (!reportId) return null;

  const { data, error } = await supabaseClient
    .from("reports")
    .select("*")
    .eq("id", reportId)
    .is("deleted_at", null)
    .maybeSingle();

  throwIfDbError(error, "Erro ao carregar relatório.");

  return data ? mapReportRowToAppReport(data) : null;
}

export async function getNextReportNum(projectId) {
  if (!projectId) {
    throw new Error("projectId é obrigatório para calcular número do relatório.");
  }

  const { data, error } = await supabaseClient
    .from("reports")
    .select("report_num")
    .eq("project_id", projectId)
    .is("deleted_at", null);

  throwIfDbError(error, "Erro ao calcular número do relatório.");

  const maxReportNum = (data || []).reduce((max, report) => {
    const candidate = Number(report.report_num || 0);
    return candidate > max ? candidate : max;
  }, 0);

  return maxReportNum + 1;
}

export async function loadReportsForProject(projectId) {
  if (!projectId) return [];

  const { data, error } = await supabaseClient
    .from("reports")
    .select("*")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("report_date", { ascending: false })
    .order("created_at", { ascending: false });

  throwIfDbError(error, "Erro ao carregar relatórios.");

  return (data || [])
    .map(mapReportRowToAppReport)
    .filter(Boolean);
}