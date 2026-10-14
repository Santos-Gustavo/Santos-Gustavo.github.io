# Third-Party / Subprocessor Inventory

Audit date: 2026-10-09 · Updated 2026-10-09 after the technical cleanups (Google Fonts removed everywhere incl. v1 reports, supabase-js vendored, EuPago logging/storage minimised and webhook auth enforced). Source: repository only (branch `marketing_updates`). Live dashboard settings (Supabase project, GitHub Pages, email provider) were **not** inspected — anything that depends on them is marked REVIEW.
No legal conclusions are drawn here. "Processor relevance" means "this service may receive personal data of our users or their clients", nothing more.

| # | Name | Purpose | Data potentially involved | Side | Status | Processor / subprocessor relevance | Privacy / DPA / transfer review |
|---|---|---|---|---|---|---|---|
| 1 | **Supabase** (project `haiwrmwpltzhdnrqzxep`) — Postgres, Auth, Storage, Edge Functions | Whole backend: accounts, all business data, photos/logos, report snapshots, share links | Account email + password hash; company data (name, NIF, IMPIC, responsible person, phone, email, address, logo); client data (name, phone, email, NIF, address, notes); project/site addresses; photos (+ worker name); reports; share-link access counts/timestamps; Edge Function logs; auth logs (IP, user agent — Supabase platform default, not verified) | Server (+ browser SDK) | Production | YES | YES — DPA, hosting region, transfer mechanism all unknown (OPEN) |
| 2 | **Supabase Auth email** (confirmation, password reset) | Sends sign-up confirmation and reset emails (`js/auth/auth.js` `signUp`, `resetPasswordForEmail`) | User email address | Server | Production | YES | REVIEW — whether Supabase's built-in SMTP or a custom SMTP provider is used is not in the repo (OPEN) |
| 3 | **GitHub Pages** (`santos-gustavo.github.io`) | Static hosting of `index.html`, `app.html`, `share.html`, `reset-password.html`, assets | Visitor IP, user agent, request URL in server logs (share-link token is in the URL **fragment**, not sent to the host) | Server | Production (assumed from hard-coded URLs in `auth.js`, `reset-password.html`, `create-eupago-payment`) | YES | REVIEW — also confirm whether GitHub Pages is the intended production host |
| 4 | ~~Google Fonts~~ | **Removed 2026-10-09** from every page and both report renderers (v1 now self-hosts the same Inter 400/600) | — | — | Removed | NO | NO — re-check if Option A restores `main`'s renderer (IBM Plex/Space Grotesk) |
| 5 | ~~jsDelivr CDN~~ | **Removed 2026-10-09.** `@supabase/supabase-js` 2.117.3 (the version jsDelivr resolved) is vendored at `vendor/supabase-js/` | — | — | Removed | NO | NO |
| 6 | **WhatsApp** (`wa.me` link, `js/reports/report-share.js:89`) | User-initiated "share via WhatsApp" — opens WhatsApp with prefilled text | Project name + share URL (contains the report access token) — sent only when the user taps the link and sends it | Client (navigation only, no SDK) | Production | NO (user's own choice of channel; no data sent by us) | REVIEW — the share token travels through WhatsApp/Meta; privacy notice should mention it |
| 7 | **EuPago** (`create-eupago-payment`, `eupago-webhook` Edge Functions, `js/payments/payment.js`) | Multibanco / MB WAY subscription payments | Company id, amount, **MB WAY phone number** and payment description (company name) sent to EuPago; EuPago refs. Since 2026-10-09 (repo code, not deployed) logs and `raw_create_response` / `raw_webhook_payload` keep only an allowlist of non-personal provider fields | Server (+ client trigger) | **Dormant**: UI buttons commented out (`app.html`), `initPayments()` still runs, functions configured in `supabase/config.toml`, live `payments` table exists. Deployment status unknown | YES if activated | YES before activation. Security notes in DATA-MINIMISATION.md (webhook auth) |
| 8 | **Deno std / esm.sh** (`deno.land/std`, `esm.sh`) | Edge Function imports (`create-report-share-link/index.ts`) | None at runtime beyond module fetch at deploy/boot | Server | Production | NO | NO |
| 9 | **Paged.js** (vendored, `vendor/pagedjs/`) | Print pagination for v2 reports | None — self-hosted, no network calls | Client | Production (behind v2 cutover) | NO | NO |
| 10 | **Inter font** (vendored, `vendor/fonts/inter/`) | Report v2 font | None — self-hosted | Client | Production (v2) | NO | NO |
| 11 | Playwright, dotenv, http-server, serve (devDependencies) | Testing / local dev | E2E test account data only | Dev only | Not shipped | NO | NO |

Not found in the repo: analytics, error tracking (Sentry etc.), tracking pixels, chat widgets, maps, video/social embeds, Stripe or any other payment SDK, any other external API.

## Open items
- Supabase region / DPA / transfer mechanism — NEED USER INPUT.
- Auth email sender (Supabase default SMTP vs custom provider) — NEED USER INPUT.
- Production hosting: confirm GitHub Pages and whether a custom domain is planned — NEED USER INPUT.
- Whether the EuPago Edge Functions are deployed live — NEED USER INPUT.

## External runtime request sweep (2026-10-09, after cleanup)

Method: grep of `index.html`, `app.html`, `share.html`, `reset-password.html`, `styles.css`, `js/**`, `vendor/**` for absolute URLs, `fetch`, WebSocket, beacons and iframes; plus Playwright guard tests (`tests/e2e/landing-page.spec.js` "no third-party font/CDN requests") that fail on any Google Fonts or jsDelivr request from `/`, `/app.html`, `/share.html`, `/reset-password.html`.

| Destination | Where | Classification |
|---|---|---|
| `haiwrmwpltzhdnrqzxep.supabase.co` (REST, Auth, Storage, Edge Functions, signed photo URLs) | `js/config/env.js`, `reset-password.html`, `share-client.js` | Required product backend |
| `santos-gustavo.github.io` | Hard-coded reset-password redirect (`auth.js`, `reset-password.html`) | First-party (own host) |
| `wa.me` | `report-share.js` | User-initiated navigation |
| URLs inside `vendor/pagedjs/…min.js` and `vendor/supabase-js/supabase.js` (MDN, W3C, GitHub, etc.) | Comments / error-message strings | Not runtime requests |

Re-swept after the v1 font patch: no Google Fonts or CDN reference left in production-facing HTML/CSS/JS; Playwright guards cover the pages and v1 report rendering. Nothing unexpected found.
