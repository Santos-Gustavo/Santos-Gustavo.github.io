// js/database/db-project-status-state.js
//
// PROJECT-HUB-INTEGRATION-001 — persistence for the editable Estado da Obra
// fields (Fase atual, Progresso geral, Resumo da obra). One row per project,
// replaced wholesale on explicit "Guardar alterações" — no autosave, see the
// migration file (supabase/migrations/20260908120000_project_status_state.sql).

import { supabaseClient } from "#database/supabase-client.js";
import { throwIfDbError } from "#database/db-helpers.js";

// Same "table not migrated yet" degrade-gracefully rule as
// db-project-work-items.js — see that file's comment for why both codes.
const TABLE_MISSING_ERROR_CODES = new Set(["42P01", "PGRST205"]);

export async function loadProjectStatusState(projectId) {
  if (!projectId) return null;

  const { data, error } = await supabaseClient
    .from("project_status_state")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    if (TABLE_MISSING_ERROR_CODES.has(error.code)) {
      console.warn(
        "project_status_state does not exist yet (pending migration) — Estado da Obra will fall back to report-derived defaults."
      );
      return null;
    }

    throwIfDbError(error, "Erro ao carregar estado guardado da obra.");
  }

  return data || null;
}

export async function upsertProjectStatusState({
  projectId,
  companyId,
  phase,
  progressPct,
  summary,
}) {
  if (!projectId) {
    throw new Error("projectId é obrigatório para guardar o estado da obra.");
  }

  if (!companyId) {
    throw new Error("companyId é obrigatório para guardar o estado da obra.");
  }

  const { data, error } = await supabaseClient
    .from("project_status_state")
    .upsert(
      {
        project_id: projectId,
        company_id: companyId,
        phase: phase || "",
        progress_pct: Math.max(0, Math.min(100, Number(progressPct) || 0)),
        summary: summary || "",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id" }
    )
    .select()
    .single();

  if (error) {
    if (TABLE_MISSING_ERROR_CODES.has(error.code)) {
      throw new Error(
        "A tabela de estado da obra ainda não foi criada na base de dados. Peça para aplicar a migração pendente."
      );
    }

    throwIfDbError(error, "Erro ao guardar estado da obra.");
  }

  return data;
}
