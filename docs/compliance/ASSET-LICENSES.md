# Asset / Licence Register

Audit date: 2026-10-09 · Scope: everything shipped to browsers from this repo or loaded at runtime. Third-party licence files were not modified. Updated 2026-10-09 after the technical cleanup.

| Asset / library | Source / package | Licence | Licence file present? | Attribution requirement | Status |
|---|---|---|---|---|---|
| Inter 400/600 latin (woff2) — landing, app, share page (`styles.css` / inline `@font-face`), report v1 and v2 | Vendored `vendor/fonts/inter/` (from rsms/inter) | SIL OFL 1.1 | Yes — `vendor/fonts/inter/LICENSE` | Licence + copyright must accompany redistributed font files (satisfied by the LICENSE next to the files). No visible credit needed. Do not sell the font alone; renamed modified versions must not use the Reserved Font Name | OK |
| Paged.js v0.4.3 polyfill | Vendored `vendor/pagedjs/paged.polyfill.min.js` | MIT | Yes — `vendor/pagedjs/LICENSE.md`; `@license` header retained in the minified file | Keep copyright + licence notice with copies (satisfied) | OK |
| Paged.js bundled dependencies | Inside the minified polyfill | Not enumerated in the vendored `LICENSE.md` | No separate notices | Minified bundles may contain other MIT/BSD code whose notices were stripped by the upstream build | REVIEW (low) — check upstream `pagedjs` 0.4.3 dist for third-party notices |
| `@supabase/supabase-js` 2.117.3 (browser, UMD build incl. auth-js, postgrest-js, realtime-js, storage-js, functions-js) | Vendored `vendor/supabase-js/supabase.js` (verbatim `dist/umd/supabase.js` from npm 2.117.3, sha256 `d6a5c441…354a3`) + our ESM adapter `supabase-esm.js` | MIT | Yes — `vendor/supabase-js/LICENSE` (copied from the 2.117.3 package) | Keep copyright + licence notice with copies (satisfied) | OK |
| `@supabase/supabase-js` (Edge Functions) | `esm.sh` / `npm:` imports in `supabase/functions/*` | MIT | N/A (server-side) | None | OK |
| Deno std | `deno.land/std` | MIT | N/A (server-side) | None | OK |
| UI icons | Unicode emoji (👁 🙈 👤 🏢 ✓) rendered by the user's system font; inline SVG drawn in our own code (`report-renderer-v1.js`) | N/A — no icon files or icon font shipped | — | None | OK |
| Images / illustrations | None shipped. Landing "phone" and "A4 report" mocks are HTML/CSS. Company logos and photos are user uploads (user content, not our assets) | — | — | — | OK |
| `examples/relatorio-exemplo.pdf` (replaces `report_example.pdf`, removed from the working tree) | Generated 2026-10-09 by our v2 renderer from fully fictional data; placeholder SVG images, no real photos | Our own output | — | — | OK |
| Project code | This repo; `package.json` says `"license": "ISC"`, no root LICENSE file | ISC (declared) | No | — | REVIEW — confirm intended licence for a commercial product (an ISC declaration is permissive; probably not what is intended). NEED USER INPUT |
| Dev-only (Playwright, dotenv, http-server, serve) | npm devDependencies | Apache-2.0 / BSD-2 / MIT | In `node_modules` | Not shipped | OK |
