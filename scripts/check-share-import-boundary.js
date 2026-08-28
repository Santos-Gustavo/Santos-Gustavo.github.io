// scripts/check-share-import-boundary.js
//
// Static check for CLIENT-SHARE-LINK-001 AC-04.2: js/share/* must never import
// anything under js/projects/, js/navigation/, js/auth/, or the admin-facing
// js/database/* modules — not hidden by an `if`, physically absent from the
// dependency graph share.html ships to an anonymous browser.

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const SHARE_DIR = path.join(ROOT, "js", "share");

const FORBIDDEN_PATH_SEGMENTS = [
  "js/projects/",
  "js/navigation/",
  "js/auth/",
  "js/database/db-projects.js",
  "js/database/db-reports.js",
  "js/database/db-photos.js",
  "js/database/supabase-client.js",
];

const FORBIDDEN_ALIASES = [
  "#projects/",
  "#navigation/",
  "#auth/",
  "#database/db-projects.js",
  "#database/db-reports.js",
  "#database/db-photos.js",
  "#database/supabase-client.js",
];

const IMPORT_PATTERN = /import\s+(?:[^'"]*?\bfrom\s+)?["']([^"']+)["']/g;

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath, files);
    } else if (entry.name.endsWith(".js")) {
      files.push(fullPath);
    }
  }

  return files;
}

function resolveRelativeImport(fileDir, importPath) {
  if (!importPath.startsWith(".")) return null;

  return path.relative(ROOT, path.resolve(fileDir, importPath)).replaceAll("\\", "/");
}

const failures = [];

for (const file of walk(SHARE_DIR)) {
  const relativeFile = path.relative(ROOT, file).replaceAll("\\", "/");
  const content = fs.readFileSync(file, "utf8");

  let match;
  while ((match = IMPORT_PATTERN.exec(content))) {
    const spec = match[1];

    for (const alias of FORBIDDEN_ALIASES) {
      if (spec.startsWith(alias)) {
        failures.push(`${relativeFile}: forbidden aliased import "${spec}"`);
      }
    }

    const resolved = resolveRelativeImport(path.dirname(file), spec);

    if (resolved) {
      for (const segment of FORBIDDEN_PATH_SEGMENTS) {
        if (resolved === segment || resolved.startsWith(segment)) {
          failures.push(`${relativeFile}: forbidden import "${spec}" (resolves to ${resolved})`);
        }
      }
    }
  }
}

if (failures.length > 0) {
  console.error("\njs/share/* import boundary check failed:\n");

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  console.error("");
  process.exit(1);
}

console.log("js/share/* import boundary check passed.");
