// scripts/check-esm-migration.js

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

const BLOCKED_PATTERNS = [
  {
    label: "Legacy window.S state",
    pattern: /window\.S\b/,
  },
  {
    label: "App-owned window global export",
    pattern: /window\.(goNext|goBack|goHome|selectMode|renderProjectList|saveAndGenerateReport|setWork|setPhoto|setExtra|setInc|setStep|buildReview|selectPhase|toggleAlert|toggleIncidents)\b/,
  },
  {
    label: "Legacy inline handler in index.html",
    pattern: /\s(onclick|oninput|onchange)=/i,
    filesOnly: ["index.html"],
  },
  {
    label: "Legacy bridge reference",
    pattern: /legacy-bridge|installLegacyBridge|#legacy\/|js\/legacy/i,
  },
  {
    label: "Old numbered script reference",
    pattern: /js\/(?:0[2-9]|1[0-9])-|js\/02-database|js\/04-projects/i,
    filesOnly: ["index.html"],
  },
];

const ALLOWED_WINDOW_PATTERNS = [
  /window\.scrollTo\b/,
  /window\.open\b/,
  /window\.print\b/,
  /window\.addEventListener\b/,
  /window\.removeEventListener\b/,
  /window\.location\b/,
  /window\.history\b/,
];

const INCLUDE_EXTENSIONS = new Set([".js", ".html"]);
const IGNORE_DIRS = new Set([
  ".git",
  "node_modules",
  "playwright-report",
  "test-results",
  "coverage",
]);

const IGNORE_FILES = new Set([
  "scripts/check-esm-migration.js",
]);

let failures = [];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(ROOT, fullPath).replaceAll("\\", "/");

    if (IGNORE_FILES.has(relativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) {
        walk(fullPath);
      }
      continue;
    }

    if (!INCLUDE_EXTENSIONS.has(path.extname(entry.name))) {
      continue;
    }

    checkFile(fullPath, relativePath);
  }
}

function checkFile(fullPath, relativePath) {
  const content = fs.readFileSync(fullPath, "utf8");
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const rule of BLOCKED_PATTERNS) {
      if (rule.filesOnly && !rule.filesOnly.includes(relativePath)) {
        continue;
      }

      if (!rule.pattern.test(line)) {
        continue;
      }

      if (isAllowedWindowLine(line)) {
        continue;
      }

      failures.push({
        rule: rule.label,
        file: relativePath,
        line: index + 1,
        text: line.trim(),
      });
    }
  });
}

function isAllowedWindowLine(line) {
  return ALLOWED_WINDOW_PATTERNS.some((pattern) => pattern.test(line));
}

walk(ROOT);

if (failures.length > 0) {
  console.error("\nESM migration guard failed:\n");

  for (const failure of failures) {
    console.error(
      `- ${failure.rule}: ${failure.file}:${failure.line}\n  ${failure.text}`,
    );
  }

  console.error("");
  process.exit(1);
}

console.log("ESM migration guard passed.");