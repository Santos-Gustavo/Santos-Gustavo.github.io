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

const WORK_STATUS_VALUES = new Set(["done", "progress", "blocked"]);

function emptyProjectWorkState() {
  return {
    progressPct: 0,
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

  const progressPct = reports.length > 0 ? Number(reports[0].progressPct) || 0 : 0;

  return {
    progressPct,
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
