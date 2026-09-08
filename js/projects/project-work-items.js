// js/projects/project-work-items.js
//
// PROJECT-MASTER-SHEET-001 — consolidates project work items (Pendentes / Em curso /
// Concluídas) and incidents from existing report data, for the "Ver Estado da Obra"
// screen. No new task-management model: everything here is derived from
// reports.works / reports.incidents jsonb, plus an optional thin status-override
// layer (project_work_item_status) for quick-tap changes made outside a report.
//
// Identity across reports: a work item keeps its `id` (client-generated uuid) when
// carried forward by the weekly-report prefill (see getOpenWorkItemsForPrefill below
// and js/navigation/navigation.js's prepareWeeklyReportFromMasterSheet). Reports are
// walked newest-first (loadReportsForProject's own ordering) and the first occurrence
// of each item id wins — this is what "prefer latest known status for a repeated item"
// means here. Older reports' items with no match anywhere else just show up as their
// own separate entries; no fuzzy/text-based deduplication is attempted.

import { loadReportsForProject } from "#database/db-reports.js";
import {
  loadWorkItemStatusOverrides,
  upsertWorkItemStatus,
} from "#database/db-project-work-items.js";
import {
  loadProjectStatusState,
  upsertProjectStatusState,
} from "#database/db-project-status-state.js";

const WORK_STATUS_VALUES = new Set(["done", "progress", "blocked"]);

function emptyProjectWorkState() {
  return {
    progressPct: 0,
    phase: "",
    pendentes: [],
    emCurso: [],
    concluidas: [],
    incidentes: [],
  };
}

export async function loadProjectWorkState(projectId) {
  if (!projectId) {
    return emptyProjectWorkState();
  }

  const [reports, overrides] = await Promise.all([
    loadReportsForProject(projectId),
    loadWorkItemStatusOverrides(projectId),
  ]);

  const overrideByItemId = new Map(overrides.map((row) => [row.item_id, row]));

  const seenWorkIds = new Set();
  const consolidatedWorks = [];

  for (const report of reports) {
    for (const work of Array.isArray(report.works) ? report.works : []) {
      if (!work?.id || seenWorkIds.has(work.id)) continue;
      seenWorkIds.add(work.id);

      const override = overrideByItemId.get(work.id);
      const overrideStatus = override?.status;
      const status = WORK_STATUS_VALUES.has(overrideStatus)
        ? overrideStatus
        : WORK_STATUS_VALUES.has(work.status)
          ? work.status
          : "blocked";

      consolidatedWorks.push({
        id: work.id,
        type: work.type || "",
        area: work.area || "",
        desc: work.desc || "",
        status,
        sourceReportId: report.id,
        sourceReportNum: report.reportNum,
        sourceReportDate: report.reportDate,
      });
    }
  }

  // Manually-added items (no source report) — an override row whose item_id
  // never showed up in any report is a work item created directly on Estado
  // da Obra, not a status change to an existing one. Its own `desc` column is
  // the only place its description lives.
  for (const override of overrides) {
    if (seenWorkIds.has(override.item_id)) continue;
    seenWorkIds.add(override.item_id);

    const status = WORK_STATUS_VALUES.has(override.status) ? override.status : "blocked";

    consolidatedWorks.push({
      id: override.item_id,
      type: "",
      area: "",
      desc: override.desc || "",
      status,
      sourceReportId: null,
      sourceReportNum: null,
      sourceReportDate: null,
    });
  }

  const seenIncidentIds = new Set();
  const consolidatedIncidents = [];

  for (const report of reports) {
    for (const incident of Array.isArray(report.incidents) ? report.incidents : []) {
      if (!incident?.id || seenIncidentIds.has(incident.id)) continue;
      if (!incident.desc) continue;
      seenIncidentIds.add(incident.id);

      consolidatedIncidents.push({
        id: incident.id,
        desc: incident.desc || "",
        sourceReportNum: report.reportNum,
        sourceReportDate: report.reportDate,
      });
    }
  }

  // Fallback defaults for the editable Estado da Obra fields, used only until
  // the contractor saves their own value to project_status_state (see
  // loadSavedProjectStatus below) — the latest report's own progress/phase
  // are the closest thing to "current state" that already existed.
  const progressPct = reports.length > 0 ? Number(reports[0].progressPct) || 0 : 0;
  const phase = reports.length > 0 ? reports[0].phase || "" : "";

  return {
    progressPct,
    phase,
    pendentes: consolidatedWorks.filter((work) => work.status === "blocked"),
    emCurso: consolidatedWorks.filter((work) => work.status === "progress"),
    concluidas: consolidatedWorks.filter((work) => work.status === "done"),
    incidentes: consolidatedIncidents,
  };
}

export async function setWorkItemStatus({ projectId, itemId, status, sourceReportId }) {
  if (!WORK_STATUS_VALUES.has(status)) {
    throw new Error("Estado inválido.");
  }

  return upsertWorkItemStatus({ projectId, itemId, status, sourceReportId });
}

export async function addWorkItem({ projectId, desc }) {
  const trimmedDesc = String(desc || "").trim();

  if (!trimmedDesc) {
    throw new Error("Descreva o trabalho antes de adicionar.");
  }

  return upsertWorkItemStatus({
    projectId,
    itemId: crypto.randomUUID(),
    status: "blocked",
    desc: trimmedDesc,
  });
}

// PROJECT-HUB-INTEGRATION-001 — the editable Fase atual / Progresso geral /
// Resumo da obra fields, saved explicitly via "Guardar alterações" (never
// autosaved — see the migration file for why). Returns null when nothing has
// ever been saved yet, so the UI can fall back to the report-derived
// phase/progressPct already returned by loadProjectWorkState above.
export async function loadSavedProjectStatus(projectId) {
  const saved = await loadProjectStatusState(projectId);
  if (!saved) return null;

  return {
    phase: saved.phase || "",
    progressPct: Number(saved.progress_pct) || 0,
    summary: saved.summary || "",
  };
}

export async function saveEditableProjectStatus({ projectId, companyId, phase, progressPct, summary }) {
  return upsertProjectStatusState({ projectId, companyId, phase, progressPct, summary });
}

// Priority-0 prefill source for "Criar Relatório Semanal" phase/progress/resumo
// — the contractor's last saved Estado da Obra state, when one exists. Returns
// null when nothing has ever been saved, so callers fall back to the latest
// report's own values instead (see prepareWeeklyReportFromMasterSheet).
export async function getSavedProjectStatusForPrefill(projectId) {
  if (!projectId) return null;

  return loadSavedProjectStatus(projectId);
}

// Priority-2 prefill source for "Criar Relatório Semanal" — Pendentes + Em curso
// only. Concluídas and incidents are deliberately excluded (see
// js/navigation/navigation.js's prepareWeeklyReportFromMasterSheet for the full
// pre-fill rule).
export async function getOpenWorkItemsForPrefill(projectId) {
  const state = await loadProjectWorkState(projectId);

  return [...state.pendentes, ...state.emCurso].map((item) => ({
    id: item.id,
    type: item.type,
    area: item.area,
    desc: item.desc,
    status: item.status,
  }));
}
