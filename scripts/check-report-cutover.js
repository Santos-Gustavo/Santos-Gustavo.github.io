// scripts/check-report-cutover.js
//
// Release gate for REPORT-LAYOUT-V2. REPORT_LAYOUT_V2_CUTOVER must be set to
// the agreed production rollout timestamp before release; while it still
// points at the REPORT_LAYOUT_V2_UNRELEASED sentinel, v2 is dark and this
// check fails. Run it as part of the release checklist, not on every commit.

const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), "js", "reports", "report-renderer.js");
const source = fs.readFileSync(FILE, "utf8");

const match = source.match(/export const REPORT_LAYOUT_V2_CUTOVER = ([^;]+);/);

if (!match) {
  console.error("FAIL: REPORT_LAYOUT_V2_CUTOVER not found in js/reports/report-renderer.js");
  process.exit(1);
}

const value = match[1].trim();

if (value === "REPORT_LAYOUT_V2_UNRELEASED") {
  console.error("FAIL: REPORT_LAYOUT_V2_CUTOVER is still the unreleased sentinel.");
  console.error('Set it to the agreed rollout timestamp, e.g. "2026-10-12T07:00:00.000Z".');
  process.exit(1);
}

const literal = value.match(/^"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)"$/);

if (!literal || !Number.isFinite(Date.parse(literal[1]))) {
  console.error(`FAIL: REPORT_LAYOUT_V2_CUTOVER must be a UTC ISO string literal, got ${value}`);
  process.exit(1);
}

console.log(`OK: REPORT_LAYOUT_V2_CUTOVER = ${literal[1]}`);
