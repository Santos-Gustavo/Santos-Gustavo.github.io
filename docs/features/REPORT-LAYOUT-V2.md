# REPORT-LAYOUT-V2 — client report text, template and A4 layout

Status: Implemented, Tested (not committed) · Risk: Medium · Owner decisions: old reports (b), PDF (ii) — 2026-10-09

## Why
Client report wording/layout fixes (A1–A9, B1–B6, new content order). Saved reports store data (`snapshot_json`), not HTML, and every open/share re-renders them, so a plain renderer edit would have silently restyled every historical report. PDF was browser Print-to-PDF only, with a hard-coded "Página 1 de 1".

## Design
- **Version routing** — `js/reports/report-renderer.js` is now a router. `meta.generatedAt < REPORT_LAYOUT_V2_CUTOVER` (or missing/invalid) → `report-renderer-v1.js`; otherwise → `report-renderer-v2.js`. `schemaVersion` is not used. Legal-mode snapshots always → v1 (v2 has no legal template; that mode came only from the removed wizard). Callers (generator, history, share client) are unchanged, so new/history/share all follow one rule.
- **v1 is frozen**: a verbatim copy of the pre-change renderer, sharing nothing with v2. Golden files `tests/e2e/fixtures/report-v1-golden-*.html` were rendered by the HEAD renderer and are compared byte-for-byte.
- **Cutover constant**: `2026-10-09T00:00:00.000Z`. ⚠ Any production report generated between that instant and the actual deploy will flip to v2 on next open. Move the constant to the deploy moment if that matters.
- **Print/PDF** — vendored Paged.js 0.4.3 (`vendor/pagedjs/`, MIT) is loaded only when the reader presses "Imprimir / PDF" or Ctrl/Cmd+P. It paginates into A4, then `window.print()`. The screen view stays a responsive document. "Voltar" reloads the normal view.
  - `@page` A4, margins 18/18/20 mm; footer in the `@bottom-left` (company · N.º + generation date / contact) and `@bottom-right` ("Página X de Y") margin boxes. This is the only page counter. The HTML footer is screen-only.
  - Unbreakable: `.item` (task/ocorrência/step), `.photo-row`/`.photo-card`, `.legal-strip`, status grid, metadata grid. Each list section wraps heading + first item in `.keep`, so a heading never ends a page.
  - "(cont.)": a continued `.section` gets Paged.js's `data-split-from`; CSS reserves `padding-top` and draws `attr(data-cont-title)` in `::before` (both `!important` because Paged.js unsets them on split elements).
  - Paged.js drops every non-`print` `@media` block and hoists `@media print`, so mobile rules live in `@media screen` and print rules in `@media print`.
  - Browser-menu print (not intercepted) falls back to the same `@page` CSS natively: Chrome/Edge 131+ give a correct counter, but there are no "(cont.)" headings.
- **Fonts**: static Inter 400/600 latin woff2 vendored (`vendor/fonts/inter/`, OFL), with Google's Inter kept as fallback. Google's variable Inter only embeds as Type 3 glyphs without a ToUnicode map, which is unreliable for search; the static files embed as real `Inter-Regular`/`Inter-SemiBold`. Asset URLs are resolved at render time from the host page's `location` (no `import.meta`, which Playwright's CJS transform can't load). The cross-origin font load inside the sandboxed share iframe relies on GitHub Pages' `Access-Control-Allow-Origin: *`; locally (`serve`, no CORS) it falls back to Google Inter.
- **Share iframe** sandbox gained `allow-modals`: Chrome silently ignores `window.print()` in a sandboxed frame without it (so the old share-view print button never worked).

## Text/template (v2 only)
Single status map (Pendente / Em curso / Concluída / Em aberto / Resolvido). "Outro" → description only. "Relatório de obra / N.º 072" with PROJ-… as a secondary ref; no "semanal"; same-day period shows one date. Empty fields are not rendered (no "—"). Wording: Ponto da situação, Estado da obra, Progresso da obra, Responsável da obra, Obra, Ocorrências, "Sem ocorrências registadas neste período.", `<title>` "Relatório de Obra — <obra>". PT phones → `+351 935 121 546`. Separate "Fase atual" and "Progresso da obra" lines plus a bar (#A84B2A on #ECEEF1). Photo heading "Área · Antes/Durante/Depois" from the frozen `stage`. A9: summary textarea placeholder only (`app.html`).

Content order: header (brand, N.º, obra name, date · período) → Ponto da situação + phase/progress → Estado da obra counts → Registo fotográfico → Trabalhos concluídos → Em curso e pendentes → (alert, legacy only) → Ocorrências → Próximos passos → Obra/Cliente/Localização/Responsável/N.º Contrato/NIF/INCI → disclaimer → footer.

Deviations to note: the obra name is also kept in the header (the metadata block is at the end, and without it page 1 doesn't say which obra it is). NIF/INCI moved from the old footer into the metadata block. The "LOGO" placeholder is no longer rendered when there's no logo.

## Disclaimer
Text byte-identical to v1 (asserted in the spec). Only the left bar changed: terracotta → neutral grey #8F8B83. **Open for the text owner:** it says "Livro de Projeto" — confirm whether "Livro de Obra" was intended. It also contains "projeto" three more times; that is the reason the spec's no-"projeto" check excludes the disclaimer.

## Evidence
`tests/e2e/report-layout-v2.spec.js` (9 tests: routing rule, v1 golden byte-equality, v2 wording/order, Paged.js pagination A4 + counters + no splits + "(cont.)" + top-half, print button, share-view v1/v2 selection via stubbed `get-shared-report`, 390px first screen). Before/after PDFs and screenshots for the four cases are in `artifacts/report-layout-v2/` (untracked), produced in Chrome and Edge.

## Known gaps
- `company-profile.spec.js` "company logo" fails at the share-frame logo step **with v1 too**: the deployed `get-shared-report` returns no signed `logoUrl`. This is existing behaviour, not caused by this feature; the edge function likely needs redeploying.
- iOS Safari "Share → Print" bypasses the button: native CSS fallback only, and Safari doesn't support `@page` margin boxes, so there's no footer/counter on that path.
- Paged.js and the static fonts load only on print, so the first print takes ~1 s longer.
