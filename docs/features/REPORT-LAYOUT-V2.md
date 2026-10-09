# REPORT-LAYOUT-V2 — client report text, template and A4 layout

Status: Implemented, Tested — v2 dark until the release step sets the cutover · Risk: Medium · Owner decisions: old reports (b), PDF (ii) — 2026-10-09

## Why
Client report wording/layout fixes (A1–A9, B1–B6, new content order). Saved reports store data (`snapshot_json`), not HTML, and every open/share re-renders them, so a plain renderer edit would have silently restyled every historical report. PDF was browser Print-to-PDF only, with a hard-coded "Página 1 de 1".

## Design
- **Version routing** — `js/reports/report-renderer.js` is now a router. `meta.generatedAt < REPORT_LAYOUT_V2_CUTOVER` (or missing/invalid) → `report-renderer-v1.js`; `>=` → `report-renderer-v2.js`. `schemaVersion` is not used. Legal-mode snapshots always → v1 (v2 has no legal template; that mode came only from the removed wizard). Callers (generator, history, share client) are unchanged, so new/history/share all follow one rule.
- **v1 is frozen**: a verbatim copy of the pre-change renderer, sharing nothing with v2. Golden files `tests/e2e/fixtures/report-v1-golden-*.html` were rendered by the HEAD renderer and are compared byte-for-byte **except the font-loading block**: since 2026-10-09 (docs/compliance) v1 loads the same Inter 400/600 from `vendor/fonts/inter/` instead of Google Fonts (measured: no element moved > 0.1 px, same page count). The canonical golden's personal-looking fixture values were swapped for synthetic ones (text-only edit). A browser test pins the loaded fonts, document height and printed page count.
- **Cutover constant**: holds `REPORT_LAYOUT_V2_UNRELEASED` (`9999-12-31T00:00:00.000Z`) until release, so every real report stays on v1 (fail-safe). Test fixtures take their post-cutover date from the constant, and live-report assertions in `canonical-report-generation.spec.js` follow `selectReportLayout`, so the suite is green on either side of the release. See **Release** below.
- **Print/PDF** — vendored Paged.js 0.4.3 (`vendor/pagedjs/`, MIT) is loaded only when the reader presses "Imprimir / PDF" or Ctrl/Cmd+P. It paginates into A4, then `window.print()`. The screen view stays a responsive document. "Voltar" reloads the normal view.
  - `@page` A4, margins 18/18/20 mm; footer in the `@bottom-left` (company · N.º + generation date / contact) and `@bottom-right` ("Página X de Y") margin boxes. This is the only page counter. The HTML footer is screen-only.
  - Unbreakable: `.item` (task/ocorrência/step), `.photo-row`/`.photo-card`, `.legal-strip`, status grid, metadata grid. Each list section wraps heading + first item in `.keep`, so a heading never ends a page.
  - "(cont.)": a continued `.section` gets Paged.js's `data-split-from`; CSS reserves `padding-top` and draws `attr(data-cont-title)` in `::before` (both `!important` because Paged.js unsets them on split elements).
  - Paged.js drops every non-`print` `@media` block and hoists `@media print`, so mobile rules live in `@media screen` and print rules in `@media print`.
  - Browser-menu print (not intercepted) falls back to the same `@page` CSS natively: Chrome/Edge 131+ give a correct counter, but there are no "(cont.)" headings.
- **Fonts**: static Inter 400/600 latin woff2 vendored (`vendor/fonts/inter/`, OFL); the Google Fonts fallback link was removed on 2026-10-09 (docs/compliance — no runtime Google Fonts requests). Google's variable Inter only embeds as Type 3 glyphs without a ToUnicode map, which is unreliable for search; the static files embed as real `Inter-Regular`/`Inter-SemiBold`. Asset URLs are resolved at render time from the host page's `location` (no `import.meta`, which Playwright's CJS transform can't load). The cross-origin font load inside the sandboxed share iframe relies on GitHub Pages' `Access-Control-Allow-Origin: *`; locally (`serve`, no CORS) it falls back to Google Inter.
- **Share iframe** sandbox gained `allow-modals`: Chrome silently ignores `window.print()` in a sandboxed frame without it (so the old share-view print button never worked).

## Release — REQUIRED STEP

1. Agree the production rollout moment.
2. Immediately before release, in `js/reports/report-renderer.js` set
   `export const REPORT_LAYOUT_V2_CUTOVER = "<YYYY-MM-DDTHH:MM:SS.000Z>";` (UTC string literal, at or after the moment the new frontend goes live, never earlier — any report generated between the cutover and the actual deploy would flip to v2 on next open).
3. `node scripts/check-report-cutover.js` must print `OK` (it fails while the sentinel is in place).
4. Run `npx playwright test tests/e2e/report-layout-v2.spec.js tests/e2e/canonical-report-generation.spec.js`.
5. Deploy. No DB migration, no snapshot change.

Rule (unchanged): `generatedAt < cutover` → v1; `>=` → v2; missing/invalid → v1; `meta.mode === "legal"` → v1.

## Print paths

| Path | Pagination | Footer + "Página X de Y" | "(cont.)" |
|---|---|---|---|
| In-report "Imprimir / PDF" button or Ctrl/Cmd+P | Paged.js (deterministic) | Yes, every page | Yes |
| Native browser print menu, Chrome/Edge 131+ | Native, same `@page` fallback CSS | Yes (native margin boxes) | No |
| Native browser print, Safari / iOS Share → Print | Native, fallback CSS | **Not guaranteed** (no `@page` margin-box support) | No |

The Safari/iOS limitation is accepted; no further PDF library or workaround.

## Text/template (v2 only)
Single status map (Pendente / Em curso / Concluída / Em aberto / Resolvido). "Outro" → description only. "Relatório de obra / N.º 072" with PROJ-… as a secondary ref; no "semanal"; same-day period shows one date. Empty fields are not rendered (no "—"). Wording: Ponto da situação, Estado da obra, Progresso da obra, Responsável da obra, Obra, Ocorrências, "Sem ocorrências registadas neste período.", `<title>` "Relatório de Obra — <obra>". PT phones → `+351 900 000 001`. Separate "Fase atual" and "Progresso da obra" lines plus a bar (#A84B2A on #ECEEF1). Photo heading "Área · Antes/Durante/Depois" from the frozen `stage`. A9: summary textarea placeholder only (`app.html`).

Content order: header (brand, N.º, obra name, date · período) → Ponto da situação + phase/progress → Estado da obra counts → Registo fotográfico → Trabalhos concluídos → Em curso e pendentes → (alert, legacy only) → Ocorrências → Próximos passos → Obra/Cliente/Localização/Responsável/N.º Contrato/NIF/INCI → disclaimer → footer.

Deviations to note: the obra name is also kept in the header (the metadata block is at the end, and without it page 1 doesn't say which obra it is). NIF/INCI moved from the old footer into the metadata block. The "LOGO" placeholder is no longer rendered when there's no logo.

## Disclaimer
Text byte-identical to v1 (asserted in the spec). Only the left bar changed: terracotta → neutral grey #8F8B83. **OPEN content/legal question (not resolved in code):** the wording says "Livro de Projeto" — confirm separately whether "Livro de Obra" is intended. Until answered, v1 and v2 keep it byte-for-byte identical. It also contains "projeto" three more times; that is the reason the spec's no-"projeto" check excludes the disclaimer.

## Evidence
`tests/e2e/report-layout-v2.spec.js` (9 tests: routing rule, v1 golden byte-equality, v2 wording/order, Paged.js pagination A4 + counters + no splits + "(cont.)" + top-half, print button, share-view v1/v2 selection via stubbed `get-shared-report`, 390px first screen). Before/after PDFs and screenshots for the four cases are in `artifacts/report-layout-v2/` (untracked), produced in Chrome and Edge.

## Known gaps
- ~~Share-view logo~~ (resolved): the repo's `get-shared-report` already signs `company.logoPath` into `logoUrl` (added in a7af2b8, 2026-10-06), but the deployed function is version 1 from 2026-08-28, so share links showed no contractor logo. Fixed 2026-10-09 by redeploying, no code change: `npx supabase functions deploy get-shared-report` (now version 2); the company-profile logo test passes.
- iOS Safari "Share → Print": see Print paths.
- Paged.js and the static fonts load only on print, so the first print takes ~1 s longer.

## Release blocker — v1 baseline is not production's presentation (correction plan, NOT YET AUTHORIZED)

**Finding (2026-10-09).** `report-renderer-v1.js` is a verbatim copy of the renderer at `34b37e2^`, i.e. *after* this branch's Tijolo e Cal restyle (`91897ad`) — not of `main`'s renderer, which is what production (GitHub Pages, `main` = `origin/main` = `4c5768d`) has rendered every real report with. Rendering both fixtures (`legacyPreCutover`, `canonicalPreCutover`) through `main:js/reports/report-renderer.js` and `report-renderer-v1.js`: visible text identical; output not byte-identical (191 differing lines: Google Fonts link IBM Plex/Space Grotesk → Inter, every colour token, print CSS, and "Em aberto" `work-tag blocked` → `work-tag open` with an icon). The golden files match v1, not `main`. Merging as-is restyles every historical report on next open/share, violating `docs/brain/decisions.md` "Client-facing documents are versioned by their own generation time".

**Decision status:** Option A (restore `main`'s presentation as v1) recommended; implementation awaits owner authorization. Option B (accept a one-time retroactive restyle and amend the decision) not chosen.

### Required source changes (Option A)
1. `js/reports/report-renderer-v1.js` = `git show main:js/reports/report-renderer.js` with exactly two edits: the FROZEN header comment, and `export function renderReportHtml(` → `export function renderReportHtmlV1(`. Nothing else. Verify: `diff <(git show main:js/reports/report-renderer.js) js/reports/report-renderer-v1.js` shows only those lines.
2. The Tijolo e Cal report styling (and the `open` class for "Em aberto") then reaches clients only through v2 at cutover. v2 already carries its own copy; confirm it needs nothing from the dropped v1 CSS.
3. No change to `report-renderer.js` (router), `REPORT_LAYOUT_V2_UNRELEASED`/`REPORT_LAYOUT_V2_CUTOVER` (sentinel stays), `report-renderer-v2.js`, callers, `share-client.js`, Edge Functions or DB.

### Golden-fixture regeneration
1. Generate from the source of truth, not the new v1: a throwaway ESM script (scratch dir, `{"type":"module"}`) imports `git show main:js/reports/report-renderer.js` and renders `legacyPreCutover` and `canonicalPreCutover` from `tests/e2e/fixtures/report-layout-cases.js`.
2. Write `tests/e2e/fixtures/report-v1-golden-legacy.html` and `report-v1-golden-canonical.html` with LF endings (the spec normalizes CRLF).
3. Record `main`'s commit SHA in the spec comment / this doc as the golden provenance. Do not commit the script.

### Tests
- **Legacy equivalence (update `report-layout-v2.spec.js`):** for both fixtures, `renderReportHtml(x) === renderReportHtmlV1(x) === golden`, and goldens were produced by `main`'s renderer (step above). Add an assertion that v1 output contains the `IBM+Plex+Sans` font link and `work-tag blocked` for an "Em aberto" incident, so a future silent restyle fails loudly.
- **Routing and cutover (keep existing):** missing/invalid/non-string `generatedAt` → v1; `mode: "legal"` → v1; `schemaVersion` ignored; `cutover − 1 ms` → v1 and `cutover` → v2 rendered output (tested against an injected timestamp, since the real constant is the sentinel); far-future sentinel keeps a "now" report on v1.
- **Share view:** pre-cutover snapshot in `share.html` renders v1 markup (existing test) — extend to assert the v1 font link/colour token so the share path proves the same baseline.
- **Unchanged expectations:** `canonical-report-generation.spec.js` assertions that follow "whichever layout the router picks now" still hold (v1 text is unchanged). Run focused: `report-layout-v2`, `canonical-report-generation`, `client-share-link-status`, `report-persistence`, `company-profile`; plus `npm run check:share-boundary` and `npm run check:migration`.

### Security and behavioural regression risks
- **Escaping:** `main`'s renderer and current v1 differ only in CSS, the font link and one class name; `escapeHtml` and all interpolation paths are identical, so no new XSS surface. QA should still confirm with a diff restricted to non-`<style>` lines.
- **Share iframe:** sandbox stays `allow-scripts allow-modals` (no `allow-same-origin`). v1's own inline `onclick="window.print()"` button, which Chrome silently ignored in production's `allow-scripts`-only frame, will now open the print dialog — a behavioural change for v1 in the share view (beneficial, but a change; v1 has no Paged.js, so it prints with its native `@media print` CSS and no page counter).
- **Third-party request:** `main`'s renderer loads IBM Plex/Space Grotesk from `fonts.googleapis.com`. Since 2026-10-09 production-facing pages make no Google Fonts requests (docs/compliance), so restoring it must self-host those fonts (OFL) the same way the current v1 self-hosts Inter — otherwise Option A reintroduces the request.
- **Branch-only reports:** any report generated by this branch (assumed local/dev only: the client renderer ships via GitHub Pages from `main`, though `get-shared-report` was deployed from this branch) currently shows the restyle and would revert to `main`'s look. If that assumption holds, no production report was ever rendered with the restyle — QA to confirm Pages serves only `main`.

### Compatibility implications
- Historical reports keep exactly the presentation clients have already seen, including PDFs they may have saved.
- The app UI (`styles.css`, `app.html`) stays Tijolo e Cal; only report documents generated before the cutover keep the old style. The in-app preview of an old report will therefore look different from the app shell — intended.
- Legal-mode snapshots keep rendering through v1 (they did on `main`).

### Independent QA acceptance criteria (ChatGPT)
1. `diff` of `main:js/reports/report-renderer.js` vs `js/reports/report-renderer-v1.js` shows only the header comment and the export rename.
2. Both goldens are byte-identical to `main`'s renderer output for the two fixtures, with provenance SHA recorded.
3. `report-layout-v2.spec.js` passes, including the new baseline assertions; the focused specs and both static checks above pass, with output attached.
4. `REPORT_LAYOUT_V2_CUTOVER` still equals `REPORT_LAYOUT_V2_UNRELEASED`; `node scripts/check-report-cutover.js` still fails (exit 1).
5. No files changed outside `report-renderer-v1.js`, the two goldens, `report-layout-v2.spec.js` and this doc.
6. Owner (human) authorization for the change is recorded before merge.
