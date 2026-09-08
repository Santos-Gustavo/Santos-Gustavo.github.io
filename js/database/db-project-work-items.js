// js/database/db-project-work-items.js
//
// PROJECT-MASTER-SHEET-001 — persistence for the quick-tap status overrides on
// project_work_item_status. This never touches reports.works — see the migration
// file (supabase/migrations/20260907120000_project_work_item_status.sql) for why.

import { supabaseClient } from "#database/supabase-client.js";
import { throwIfDbError } from "#database/db-helpers.js";

// Surfaces if the migration for this feature hasn't been applied to this
// environment yet. Treated as "no overrides exist" on read so the rest of Estado
// da Obra (consolidated straight from report data) still works without it;
// surfaced as a clear error on write, since a status change genuinely cannot be
// saved without the table. Two different codes show up for the same underlying
// "table doesn't exist" cause: "42P01" is Postgres's own undefined_table code
// (e.g. if ever queried directly), but going through PostgREST — what
// supabaseClient actually does — a table missing from its schema cache surfaces
// as "PGRST205" instead, without ever reaching Postgres.
const TABLE_MISSING_ERROR_CODES = new Set(["42P01", "PGRST205"]);

export async function loadWorkItemStatusOverrides(projectId) {
  if (!projectId) return [];

  const { data, error } = await supabaseClient
    .from("project_work_item_status")
    .select("*")
    .eq("project_id", projectId);

  if (error) {
    if (TABLE_MISSING_ERROR_CODES.has(error.code)) {
      console.warn(
        "project_work_item_status does not exist yet (pending migration) — Estado da Obra will show report data without quick-tap overrides."
      );
      return [];
    }

    throwIfDbError(error, "Erro ao carregar estado dos trabalhos.");
  }

  return data || [];
}

export async function upsertWorkItemStatus({
  projectId,
  itemId,
  status,
  sourceReportId = null,
  desc,
}) {
  if (!projectId) {
    throw new Error("projectId é obrigatório para guardar o estado do trabalho.");
  }

  if (!itemId) {
    throw new Error("itemId é obrigatório para guardar o estado do trabalho.");
  }

  const payload = {
    project_id: projectId,
    item_id: itemId,
    status,
    source_report_id: sourceReportId,
    updated_at: new Date().toISOString(),
  };

  // Only sent when explicitly provided (adding a new manual item) — leaving
  // this key out of a plain status change (mark done/reopen on a
  // report-derived item) means PostgREST's upsert leaves the existing `desc`
  // column untouched instead of overwriting it with null.
  if (desc !== undefined) {
    payload.desc = desc;
  }

  const { data, error } = await supabaseClient
    .from("project_work_item_status")
    .upsert(payload, { onConflict: "project_id,item_id" })
    .select()
    .single();

  if (error) {
    if (TABLE_MISSING_ERROR_CODES.has(error.code)) {
      throw new Error(
        "A tabela de estado dos trabalhos ainda não foi criada na base de dados. Peça para aplicar a migração pendente."
      );
    }

    throwIfDbError(error, "Erro ao guardar estado do trabalho.");
  }

  return data;
}
