// js/reports/report-renderer.js
//
// Report presentation router (REPORT-LAYOUT-V2). Saved reports store data
// (snapshot_json), not HTML, so every open/share re-renders them. To keep
// historical reports looking exactly as they did when generated, the layout
// is chosen from the snapshot's own meta.generatedAt:
//
//   generatedAt <  REPORT_LAYOUT_V2_CUTOVER → report-renderer-v1.js (frozen)
//   generatedAt >= REPORT_LAYOUT_V2_CUTOVER → report-renderer-v2.js
//   generatedAt missing / invalid           → v1
//   meta.mode === "legal"                   → v1
//
// REQUIRED RELEASE STEP: replace REPORT_LAYOUT_V2_CUTOVER with the agreed
// production rollout timestamp (UTC ISO string) immediately before release.
// Until then it holds REPORT_LAYOUT_V2_UNRELEASED, a far-future sentinel that
// keeps every real report on v1 (fail-safe: forgetting the step never
// restyles history). `node scripts/check-report-cutover.js` fails while the
// sentinel is in place. See docs/features/REPORT-LAYOUT-V2.md "Release".
//
// schemaVersion is a data-format marker and is deliberately NOT used here.
// Stays import-free apart from the two pure renderers, so share.html can use
// it (CLIENT-SHARE-LINK-001 AC-04.2).

import { renderReportHtmlV1 } from "./report-renderer-v1.js";
import { renderReportHtmlV2 } from "./report-renderer-v2.js";

export const REPORT_LAYOUT_V2_UNRELEASED = "9999-12-31T00:00:00.000Z";
export const REPORT_LAYOUT_V2_CUTOVER = REPORT_LAYOUT_V2_UNRELEASED;

const CUTOVER_MS = Date.parse(REPORT_LAYOUT_V2_CUTOVER);

export function selectReportLayout(report) {
  // v2 has no legal/financial template — that mode only came from the
  // removed weekly wizard, so any such snapshot is archival by definition.
  if (report?.meta?.mode === "legal") return "v1";

  const generatedAt = report?.meta?.generatedAt;
  const generatedMs = typeof generatedAt === "string" ? Date.parse(generatedAt) : NaN;

  if (!Number.isFinite(generatedMs)) return "v1";

  return generatedMs >= CUTOVER_MS ? "v2" : "v1";
}

export function renderReportHtml(report) {
  return selectReportLayout(report) === "v2"
    ? renderReportHtmlV2(report)
    : renderReportHtmlV1(report);
}
