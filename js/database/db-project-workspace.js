// js/database/db-project-workspace.js
//
// ESTADO-DA-OBRA-WORKSPACE-001 — the canonical project workspace. Estado da
// Obra reads ONLY from project_status_state / project_work_items /
// project_incidents / project_photos, and writes ONLY through the
// save_project_workspace RPC (one transaction, see
// supabase/migrations/20261006130000_save_project_workspace_rpc.sql) plus
// the explicit, immediate "Adicionar foto" upload below. Nothing here reads
// or writes reports.* or project_work_item_status.

import { supabaseClient } from "#database/supabase-client.js";
import { throwIfDbError } from "#database/db-helpers.js";
import { optimizeImageForUpload } from "#utils/image-processing.js";
import { uploadWorkspacePhoto, getSignedPhotoUrls } from "#database/storage-service.js";

export async function loadProjectWorkspace(projectId) {
  if (!projectId) throw new Error("projectId é obrigatório.");

  const [statusRes, worksRes, incidentsRes, photosRes] = await Promise.all([
    supabaseClient.from("project_status_state").select("*").eq("project_id", projectId).maybeSingle(),
    supabaseClient
      .from("project_work_items")
      .select("*")
      .eq("project_id", projectId)
      .is("deactivated_at", null)
      .order("created_at", { ascending: true }),
    supabaseClient
      .from("project_incidents")
      .select("*")
      .eq("project_id", projectId)
      .is("deactivated_at", null)
      .order("created_at", { ascending: true }),
    supabaseClient
      .from("project_photos")
      .select("*")
      .eq("project_id", projectId)
      .is("deactivated_at", null)
      .order("created_at", { ascending: true }),
  ]);

  throwIfDbError(statusRes.error, "Erro ao carregar estado da obra.");
  throwIfDbError(worksRes.error, "Erro ao carregar trabalhos.");
  throwIfDbError(incidentsRes.error, "Erro ao carregar incidentes.");
  throwIfDbError(photosRes.error, "Erro ao carregar fotografias.");

  const photoRows = photosRes.data || [];

  // A storage hiccup must not take down the whole workspace — photos just
  // render without a preview.
  let signedUrls = new Map();
  try {
    signedUrls = await getSignedPhotoUrls(photoRows.map((row) => row.storage_path).filter(Boolean));
  } catch (error) {
    console.warn("Could not sign Estado da Obra photo URLs:", error);
  }

  const status = statusRes.data;

  return {
    phase: status?.phase || "",
    progressPct: Number(status?.progress_pct) || 0,
    summary: status?.summary || "",
    nextSteps: status?.next_steps || "",
    workItems: (worksRes.data || []).map(mapWorkItemRow),
    incidents: (incidentsRes.data || []).map(mapIncidentRow),
    photos: photoRows.map((row) => mapPhotoRow(row, signedUrls.get(row.storage_path) || null)),
  };
}

export async function saveProjectWorkspace({ projectId, status, workItems, incidents, photos }) {
  const { error } = await supabaseClient.rpc("save_project_workspace", {
    p_project_id: projectId,
    p_status: {
      phase: status.phase || "",
      progress_pct: Math.max(0, Math.min(100, Number(status.progressPct) || 0)),
      summary: status.summary || "",
      next_steps: status.nextSteps || "",
    },
    p_work_items: workItems.map((item) => ({
      id: item.id,
      type: item.type || "",
      area: item.area || "",
      description: item.description || "",
      status: item.status,
      include_in_reports: item.includeInReports !== false,
      deactivated: Boolean(item.deactivated),
    })),
    p_incidents: incidents.map((incident) => ({
      id: incident.id,
      description: incident.description || "",
      status: incident.status,
      include_in_reports: incident.includeInReports !== false,
      deactivated: Boolean(incident.deactivated),
    })),
    p_photos: photos.map((photo) => ({
      id: photo.id,
      area: photo.area || "",
      description: photo.description || "",
      worker: photo.worker || "",
      stage: photo.stage || "during",
      include_in_reports: photo.includeInReports !== false,
      deactivated: Boolean(photo.deactivated),
    })),
  });

  throwIfDbError(error, "Erro ao guardar alterações.");
}

// "Adicionar foto" — an explicit user action, persisted immediately (storage
// object + project_photos row). Not part of the draft/save transaction.
export async function addWorkspacePhoto({ projectId, companyId, file }) {
  if (!projectId || !companyId) throw new Error("Projeto inválido para adicionar fotografia.");

  const optimized = await optimizeImageForUpload(file, {
    maxWidth: 1600,
    quality: 0.82,
    outputType: "image/jpeg",
  });

  const { storagePath } = await uploadWorkspacePhoto({
    blob: optimized.blob,
    companyId,
    projectId,
    fileName: `${crypto.randomUUID()}.jpg`,
    contentType: optimized.contentType,
  });

  const { data, error } = await supabaseClient
    .from("project_photos")
    .insert({ project_id: projectId, storage_path: storagePath })
    .select()
    .single();

  throwIfDbError(error, "Erro ao guardar fotografia.");

  let signedUrl = null;
  try {
    signedUrl = (await getSignedPhotoUrls([storagePath])).get(storagePath) || null;
  } catch (error) {
    console.warn("Could not sign uploaded photo URL:", error);
  }

  return mapPhotoRow(data, signedUrl);
}

function mapWorkItemRow(row) {
  return {
    id: row.id,
    type: row.type || "",
    area: row.area || "",
    description: row.description || "",
    status: row.status,
    includeInReports: row.include_in_reports !== false,
    firstReportId: row.first_report_id || null,
    deactivated: false,
  };
}

function mapIncidentRow(row) {
  return {
    id: row.id,
    description: row.description || "",
    status: row.status,
    includeInReports: row.include_in_reports !== false,
    deactivated: false,
  };
}

function mapPhotoRow(row, signedUrl) {
  return {
    id: row.id,
    storagePath: row.storage_path,
    signedUrl,
    area: row.area || "",
    description: row.description || "",
    worker: row.worker || "",
    stage: row.stage || "during",
    includeInReports: row.include_in_reports !== false,
    deactivated: false,
  };
}
