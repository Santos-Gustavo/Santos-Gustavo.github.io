# Pre-Launch Compliance Quick Wins

Audit date: 2026-10-09 · Updated 2026-10-09 after the technical cleanup · Branch `marketing_updates` · Repo-only audit; live dashboards not inspected. No Privacy Policy, Terms, DPA, retention, legal-basis, RoPA, breach, banner or deletion work was done (next phase). Advisory engineering evidence only, not legal advice or independent approval.

| # | Item | Status | Evidence | Action | Next phase |
|---|---|---|---|---|---|
| 1 | Third parties / subprocessors | PARTIAL | [THIRD-PARTIES.md](THIRD-PARTIES.md): Supabase, GitHub Pages, WhatsApp (link only), EuPago (dormant); jsDelivr and Google Fonts **removed** (incl. v1 reports); request sweep found nothing unexpected | Owner: Supabase region/DPA, email sender, hosting, EuPago deployment | Subprocessor list + transfer review in Privacy Policy |
| 2 | Browser storage / cookies | DONE | [STORAGE-INVENTORY.md](STORAGE-INVENTORY.md): only Supabase session in localStorage | Optional live DevTools check | Disclose in Privacy Policy |
| 3 | Licences / assets | DONE | [ASSET-LICENSES.md](ASSET-LICENSES.md): Inter OFL, Paged.js MIT, supabase-js 2.117.3 MIT — licence files present | Owner: decide project licence (`package.json` says ISC) | — |
| 4 | Forms / consents | DONE | [FORM-AUDIT.md](FORM-AUDIT.md) | None now | Legal-basis decisions; Privacy link at sign-up |
| 5 | Dark patterns | DONE (no fixes) | [DARK-PATTERN-AUDIT.md](DARK-PATTERN-AUDIT.md) | Product decision on "Ocultar", "Remover", mandatory reason | — |
| 6 | Data minimisation | PARTIAL | [DATA-MINIMISATION.md](DATA-MINIMISATION.md): sample PDF **replaced**; test fixtures/goldens/artifacts **synthetic**; EuPago logs/raw storage **minimised** and webhook auth enforced (repo, not deployed); old data still in public Git history and old PDF live until merge | Owner: history-cleanup decision; product decisions on candidates | Retention policy |
| 7 | Unsupported claims | DONE | [CLAIMS-AUDIT.md](CLAIMS-AUDIT.md) | None | Keep guardrails |
| 8 | Business details | NEED USER INPUT | [BUSINESS-DETAILS.md](BUSINESS-DETAILS.md) | Owner to supply | Footer + Privacy/Terms |
| 9 | Privacy / rights intake | NEED USER INPUT | [RIGHTS-INTAKE.md](RIGHTS-INTAKE.md) | Owner to supply a contact address | Rights-request procedure |

## Technical cleanup done (2026-10-09)
- **Sample report:** `examples/relatorio-exemplo.pdf` (v2 renderer, fictional data, placeholder images) replaces `examples/report_example.pdf`; landing link + spec updated.
- **Fonts:** self-hosted Inter 400/600 via `@font-face` in `styles.css` (landing, app) and inline in `share.html`; Google Fonts links removed from `index.html`, `app.html`, `share.html` and the v2 report renderer. `reset-password.html` never loaded web fonts.
- **Supabase client:** jsDelivr (`@2` UMD + unversioned `+esm`, both resolving to 2.117.3) replaced by vendored 2.117.3 UMD (`vendor/supabase-js/`) + a 2-line ESM adapter mapped by the existing importmap. No version change; `supabase-client.js` unchanged.
- **EuPago:** personal data and the API key no longer logged; `raw_create_response` / `raw_webhook_payload` / browser echo keep an allowlist of non-personal fields for new requests. Not deployed; payments still disabled.
- **Guard tests:** `landing-page.spec.js` fails on any Google Fonts / jsDelivr request from `/`, `/app.html`, `/share.html`, `/reset-password.html`, checks Inter loads locally, Supabase initialises, and the sample PDF is served.

## Second cleanup (2026-10-09)
- **v1 report fonts:** `report-renderer-v1.js` now loads the **same** Inter 400/600 it always used from `vendor/fonts/inter/` (the task brief named IBM Plex / Space Grotesk, but those are `main`'s renderer, not this branch's v1 — see REPORT-LAYOUT-V2.md Option A). Before/after (Chromium, legacy + canonical fixtures, 1280 and 390 px): identical element geometry (max 0.1 px), identical document heights (1626/1625 px), same 2-page PDFs with the same words; pixel diff ≤ 0.023 % (anti-aliasing). PDFs now embed real Inter fonts instead of Type 3 outlines. The golden test now compares everything except the font-loading block, and a browser test pins loaded fonts, height and page count.
- **Synthetic test data:** realistic phone, email, NIF, person names and street addresses in `tests/e2e/fixtures/report-layout-cases.js`, the canonical v1 golden (text-only, 8 lines), `report-layout-v2.spec.js`, a code comment in `report-renderer-v2.js` and the whole `artifacts/report-layout-v2/` evidence set (regenerated in Chrome + Edge; same page counts, footers, fonts and "(cont.)" placement) replaced with obviously synthetic values. Generic placeholders (`912345678`, `cliente@empresa.pt`, `@example.com`) left as they are.
- **EuPago:** webhook requires a valid `chave_api` (missing/wrong → 401); no stack traces, internal error text or secret names in responses. See DATA-MINIMISATION.md. Not deployed; payments stay disabled.
- **Sweep:** no Google Fonts or CDN references remain in production-facing HTML/CSS/JS or report renderers; only Supabase, own host and user-initiated `wa.me`.

## Release note
- The old example PDF (`examples/report_example.pdf`) stays reachable in public Git history (commit `2d846c4`) and on the live site until this branch is deployed. **If the owner confirms its data is real, history cleanup (rewrite + force-push of all branches) and a GitHub cache/ref purge via GitHub Support become a separate incident-response task** — not part of this cleanup. The same applies to the test values replaced on 2026-10-09 (history from `34b37e2`).
- Edge Function changes (EuPago) take effect only when deployed; deployment is a human-owner action.

## Remaining blockers needing owner / Product / legal
1. **Git history** — decide per the release note above once the data's status is known.
2. **EuPago deployment status** — not knowable from the repo (`supabase/config.toml` is local CLI config). Check the Supabase dashboard / `supabase functions list`; if the old webhook was ever live, inspect `payments.raw_webhook_payload` for a stored API key and rotate it. Confirm EuPago's webhook delivery method (POST body vs query string) and version before activation.
3. **Option A** — if `main`'s renderer is restored as v1, its IBM Plex / Space Grotesk must be self-hosted to keep the "no Google Fonts" result.
4. **Sample PDF shows the v2 layout**, which is not live yet — Product call.

## Cookie-banner verdict
Based on the current implementation, a cookie-consent banner does **not** appear to be required today: the only device storage is the Supabase sign-in session, and there is no analytics, advertising or tracking. Re-check before adding any analytics or embed.

## Recommended next 5 tasks
1. **Owner:** merge/deploy the cleanup so the old PDF and Google/jsDelivr requests disappear from the live site; then decide on Git-history cleanup (incident-response task if the data is real).
2. **Owner:** provide operator legal name, address, NIF and a privacy/support email → add to landing footer.
3. **Owner + Engineering:** resolve Option A; if `main`'s renderer is restored, self-host its fonts.
4. **Owner:** confirm Supabase region/DPA, auth email sender and hosting → finalise subprocessor list.
5. **Next compliance phase:** Privacy Policy + Terms from these inventories (controller/processor decision for client data; manual rights-request procedure).
