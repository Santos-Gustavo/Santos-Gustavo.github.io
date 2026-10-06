// scripts/backfill-estado-da-obra-workspace.js
//
// ESTADO-DA-OBRA-WORKSPACE-001 Phase 2 — one-time backfill of the canonical
// workspace tables (project_work_items, project_incidents, project_photos,
// project_status_state.next_steps) from existing legacy report data. The
// consolidation logic here is a faithful port of
// js/projects/project-work-items.js's loadProjectWorkState, verified against
// the live Estado da Obra UI before this script was written (see the Phase 2
// preflight report).
//
// Idempotent by design: rerunning this script only fills in canonical rows
// that are missing. It never duplicates rows, never overwrites or reactivates
// an existing project_work_items / project_incidents / project_photos row,
// and never clobbers a next_steps value a contractor may have already edited
// directly (empty string is the only value this script will ever overwrite).
// Canonical Estado da Obra always wins over legacy report data.
//
// Never writes to: reports, photos, project_work_item_status. Those remain
// legacy/historical sources only — see decision log in
// supabase/migrations/20261005120000_estado_da_obra_workspace_tables.sql.
//
// Usage:
//   node scripts/backfill-estado-da-obra-workspace.js            # dry run (default, no writes)
//   node scripts/backfill-estado-da-obra-workspace.js --apply    # writes to production

require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in environment.");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const WORK_STATUS_VALUES = new Set(["done", "progress", "blocked"]);
const STATUS_MAP = { blocked: "pending", progress: "in_progress", done: "done" };
const STAGE_MAP = { 0: "during", 1: "before", 2: "after" };

// Baseline from the approved Phase 2 preflight dry run. Any mismatch at
// write time means the source data has moved since that dry run was
// reviewed — abort rather than silently backfilling against stale
// assumptions (rerun the preflight script first in that case).
const EXPECTED = {
  projects: 5,
  workItems: 18,
  incidents: 4,
  nextStepsProjects: 2,
  photos: 1,
};

async function fetchAll(table, select, filterFn) {
  const pageSize = 1000;
  let from = 0;
  let rows = [];
  for (;;) {
    let q = db.from(table).select(select).range(from, from + pageSize - 1);
    if (filterFn) q = filterFn(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows = rows.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

function sortReportsNewestFirst(reports) {
  return [...reports].sort((a, b) => {
    const dateDiff = String(b.report_date).localeCompare(String(a.report_date));
    if (dateDiff !== 0) return dateDiff;
    return String(b.created_at).localeCompare(String(a.created_at));
  });
}

// Faithful port of loadProjectWorkState's pure consolidation logic
// (js/projects/project-work-items.js:41-181).
function consolidate(reportsNewestFirst, overrides) {
  const overrideByItemId = new Map(overrides.map((row) => [row.item_id, row]));

  const creationReportByWorkId = new Map();
  for (let i = reportsNewestFirst.length - 1; i >= 0; i -= 1) {
    const report = reportsNewestFirst[i];
    for (const work of Array.isArray(report.works) ? report.works : []) {
      if (!work?.id || creationReportByWorkId.has(work.id)) continue;
      creationReportByWorkId.set(work.id, report);
    }
  }

  const seenWorkIds = new Set();
  const consolidatedWorks = [];

  for (const report of reportsNewestFirst) {
    for (const work of Array.isArray(report.works) ? report.works : []) {
      if (!work?.id || seenWorkIds.has(work.id)) continue;
      seenWorkIds.add(work.id);

      const override = overrideByItemId.get(work.id);
      const overrideStatus = override?.status;
      const legacyStatus = WORK_STATUS_VALUES.has(overrideStatus)
        ? overrideStatus
        : WORK_STATUS_VALUES.has(work.status)
          ? work.status
          : "blocked";

      const creationReport = creationReportByWorkId.get(work.id) || report;

      consolidatedWorks.push({
        id: work.id,
        type: work.type || "",
        area: work.area || "",
        desc: work.desc || "",
        canonicalStatus: STATUS_MAP[legacyStatus],
        firstReportId: creationReport.id,
      });
    }
  }

  for (const override of overrides) {
    if (seenWorkIds.has(override.item_id)) continue;
    seenWorkIds.add(override.item_id);

    const legacyStatus = WORK_STATUS_VALUES.has(override.status) ? override.status : "blocked";

    consolidatedWorks.push({
      id: override.item_id,
      type: override.type || "",
      area: override.area || "",
      desc: override.desc || "",
      canonicalStatus: STATUS_MAP[legacyStatus],
      firstReportId: null,
    });
  }

  const seenIncidentIds = new Set();
  const consolidatedIncidents = [];
  for (const report of reportsNewestFirst) {
    for (const incident of Array.isArray(report.incidents) ? report.incidents : []) {
      if (!incident?.id || seenIncidentIds.has(incident.id)) continue;
      if (!incident.desc) continue;
      seenIncidentIds.add(incident.id);
      consolidatedIncidents.push({ id: incident.id, desc: incident.desc || "" });
    }
  }

  const seenNextStepIds = new Set();
  const consolidatedNextSteps = [];
  for (const report of reportsNewestFirst) {
    for (const nextStep of Array.isArray(report.next_steps) ? report.next_steps : []) {
      if (!nextStep?.id || seenNextStepIds.has(nextStep.id)) continue;
      if (!nextStep.desc) continue;
      seenNextStepIds.add(nextStep.id);
      consolidatedNextSteps.push({ id: nextStep.id, desc: nextStep.desc || "" });
    }
  }

  return { consolidatedWorks, consolidatedIncidents, consolidatedNextSteps };
}

async function insertMissing(table, rows) {
  if (rows.length === 0) return;
  const existingIds = new Set();
  for (let i = 0; i < rows.length; i += 200) {
    const ids = rows.slice(i, i + 200).map((r) => r.id);
    const { data, error } = await db.from(table).select("id").in("id", ids);
    if (error) throw new Error(`${table} read failed: ${error.message}`);
    for (const r of data || []) existingIds.add(r.id);
  }
  const toInsert = rows.filter((r) => !existingIds.has(r.id));
  if (toInsert.length > 0) {
    const { error } = await db.from(table).insert(toInsert);
    if (error) throw new Error(`${table} insert failed: ${error.message}`);
  }
  console.log(`${table}: inserted ${toInsert.length}, skipped ${existingIds.size} already canonical.`);
}

async function main() {
  const projects = await fetchAll("projects", "id,company_id,deleted_at", (q) => q.is("deleted_at", null));
  // Only legacy reports are a backfill source. Reports produced by
  // generate_report (Phase 4) are derived FROM the canonical tables — feeding
  // them back in would shift the verified counts and point "latest report
  // photos" at a report that has no `photos` rows.
  const reports = (
    await fetchAll(
      "reports",
      "id,project_id,report_num,report_date,created_at,works,incidents,next_steps,deleted_at,source:snapshot_json->>source",
      (q) => q.is("deleted_at", null)
    )
  ).filter((r) => r.source !== "canonical");
  const overrides = await fetchAll(
    "project_work_item_status",
    "id,project_id,item_id,status,source_report_id,type,area,desc"
  );
  const photos = await fetchAll(
    "photos",
    "id,report_id,storage_path,area,description,worker,stage,is_client_visible,created_at"
  );

  const reportsByProject = new Map();
  for (const r of reports) {
    if (!reportsByProject.has(r.project_id)) reportsByProject.set(r.project_id, []);
    reportsByProject.get(r.project_id).push(r);
  }
  for (const [pid, list] of reportsByProject) reportsByProject.set(pid, sortReportsNewestFirst(list));

  const overridesByProject = new Map();
  for (const o of overrides) {
    if (!overridesByProject.has(o.project_id)) overridesByProject.set(o.project_id, []);
    overridesByProject.get(o.project_id).push(o);
  }

  const photosByReport = new Map();
  for (const p of photos) {
    if (!photosByReport.has(p.report_id)) photosByReport.set(p.report_id, []);
    photosByReport.get(p.report_id).push(p);
  }

  const workItemRows = [];
  const incidentRows = [];
  const nextStepsWrites = []; // { projectId, companyId, text }
  const photoRows = [];

  let projectsWithNextSteps = 0;

  for (const project of projects) {
    const reportsForProject = reportsByProject.get(project.id) || [];
    const overridesForProject = overridesByProject.get(project.id) || [];

    const { consolidatedWorks, consolidatedIncidents, consolidatedNextSteps } = consolidate(
      reportsForProject,
      overridesForProject
    );

    for (const w of consolidatedWorks) {
      workItemRows.push({
        id: w.id,
        project_id: project.id,
        type: w.type,
        area: w.area,
        description: w.desc,
        status: w.canonicalStatus,
        include_in_reports: true,
        first_report_id: w.firstReportId,
        deactivated_at: null,
      });
    }

    for (const inc of consolidatedIncidents) {
      incidentRows.push({
        id: inc.id,
        project_id: project.id,
        description: inc.desc,
        status: "open",
        include_in_reports: true,
        resolved_at: null,
        deactivated_at: null,
      });
    }

    if (consolidatedNextSteps.length > 0) {
      projectsWithNextSteps += 1;
      nextStepsWrites.push({
        projectId: project.id,
        companyId: project.company_id,
        text: consolidatedNextSteps.map((ns) => ns.desc).join("\n"),
      });
    }

    const latestReport = reportsForProject[0] || null;
    const latestPhotos = latestReport ? photosByReport.get(latestReport.id) || [] : [];
    for (const photo of latestPhotos) {
      photoRows.push({
        id: photo.id,
        project_id: project.id,
        storage_path: photo.storage_path,
        area: photo.area,
        description: photo.description,
        worker: photo.worker,
        stage: STAGE_MAP[photo.stage] ?? "during",
        include_in_reports: true,
        is_client_visible: photo.is_client_visible ?? true,
        deactivated_at: null,
      });
    }
  }

  const actual = {
    projects: projects.length,
    workItems: workItemRows.length,
    incidents: incidentRows.length,
    nextStepsProjects: projectsWithNextSteps,
    photos: photoRows.length,
  };

  console.log("=== SOURCE COUNTS (write-time) ===");
  console.log(actual);

  const mismatches = Object.keys(EXPECTED).filter((k) => EXPECTED[k] !== actual[k]);
  if (mismatches.length > 0) {
    console.error("\nABORT: write-time source counts differ from the verified dry run.");
    console.error("Expected:", EXPECTED);
    console.error("Actual:  ", actual);
    console.error("Mismatched fields:", mismatches);
    console.error("Rerun the preflight script and get it re-approved before backfilling — not applying.");
    process.exit(1);
  }

  console.log("\nSource counts match the approved dry run exactly. Safe to proceed.");

  if (!APPLY) {
    console.log("\nDry run only (no --apply flag) — no writes performed.");
    console.log(`Would insert (missing ids only) up to: ${workItemRows.length} work items, ${incidentRows.length} incidents, ${photoRows.length} photos, next_steps for ${nextStepsWrites.length} projects.`);
    return;
  }

  console.log("\n--apply set — writing to production...");

  // Canonical Estado da Obra always wins over legacy report data: work items,
  // incidents and photos are insert-only. A row that already exists (active,
  // edited, hidden or deactivated) is never overwritten or reactivated.
  // Missing photos are re-created at their legacy .../reports/{report_id}/...
  // path, which trg_project_photos_storage_path (20261006140000) accepts
  // because the source `photos` row still references it.
  await insertMissing("project_work_items", workItemRows);
  await insertMissing("project_incidents", incidentRows);
  await insertMissing("project_photos", photoRows);

  let nextStepsWritten = 0;
  let nextStepsSkippedNonEmpty = 0;
  for (const { projectId, companyId, text } of nextStepsWrites) {
    const { data: existing, error: readError } = await db
      .from("project_status_state")
      .select("project_id, next_steps")
      .eq("project_id", projectId)
      .maybeSingle();
    if (readError) throw new Error(`project_status_state read failed for ${projectId}: ${readError.message}`);

    if (!existing) {
      const { error: insertError } = await db
        .from("project_status_state")
        .insert({ project_id: projectId, company_id: companyId, next_steps: text });
      if (insertError) throw new Error(`project_status_state insert failed for ${projectId}: ${insertError.message}`);
      nextStepsWritten += 1;
      continue;
    }

    if ((existing.next_steps || "") !== "") {
      nextStepsSkippedNonEmpty += 1;
      continue;
    }

    const { error: updateError } = await db
      .from("project_status_state")
      .update({ next_steps: text })
      .eq("project_id", projectId);
    if (updateError) throw new Error(`project_status_state update failed for ${projectId}: ${updateError.message}`);
    nextStepsWritten += 1;
  }

  console.log(`project_status_state.next_steps: written for ${nextStepsWritten} project(s), skipped ${nextStepsSkippedNonEmpty} already-non-empty.`);
  console.log("\nBackfill complete.");
}

main().catch((err) => {
  console.error("BACKFILL FAILED:", err);
  process.exit(1);
});
