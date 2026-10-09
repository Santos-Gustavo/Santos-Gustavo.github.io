# Data-Minimisation Audit

Audit date: 2026-10-09 · Sources: `supabase/manual/live_schema_rls_baseline.sql` (live table snapshot), `supabase/migrations/*`, `app.html`, `js/**`, report RPCs and renderers. **No schema or data changed.** "Candidate" = consider removing/limiting later; needs a product decision.

## Sample report and repo exposure (updated 2026-10-09)

| Item | Observation | Status / action |
|---|---|---|
| Old `examples/report_example.pdf` | Contained personal-looking email, Portuguese mobile number, street address and person names. Whether they are real was **not** decided | **Replaced** on this branch by `examples/relatorio-exemplo.pdf` (fully fictional: `.example` email domain, no phone/NIF/IMPIC, "Cliente de Demonstração", "Rua Fictícia", placeholder images); landing link updated; old file removed from the working tree. **Still live** at `santos-gustavo.github.io/examples/report_example.pdf` until this branch reaches `main` |
| Git history | Repo is **public** (GitHub API: `"visibility": "public"`). Old PDF was added in `2d846c4` (2026-10-05), reachable from `origin/main`, `origin/marketing_updates`, `origin/turn_estado_da_obra_pm_tool`; downloadable via raw.githubusercontent.com at that commit (HTTP 200 checked) | History **not** rewritten. Cleanup recommended **only if the owner confirms the data is real**: a rewrite (e.g. `git filter-repo`) + force-push of all branches, plus a GitHub Support request to purge cached views/PR refs. Even then forks/clones/caches may keep it — so treat a rewrite as damage limitation, not erasure |
| Same phone number in tests | The old sample's mobile number also appeared in `tests/e2e/fixtures/report-layout-cases.js`, `tests/e2e/report-layout-v2.spec.js`, the canonical v1 golden and the `artifacts/report-layout-v2/` evidence set (added in `34b37e2`), with a real-looking company email domain, NIF, person names and real street addresses | **Replaced 2026-10-09** with synthetic values (`900000001`, `geral@construcoes-exemplo.example`, NIF `999999999` (fails the NIF check digit), "Cliente Exemplo", "Rua Exemplo"); golden updated text-only; artifacts regenerated (same page counts/footers/fonts). Old values remain in Git history at `34b37e2` and later commits |

## By category

| Data | Why the product needs it now | Req / opt / REVIEW | Possible excess | Sensitive / high-risk note |
|---|---|---|---|---|
| **Account**: email, password (Supabase Auth) | Login, password reset | Required | — | Supabase also logs IP / user agent in auth logs (platform default, not verified) |
| **Company**: name | Report header | Required | — | — |
| Company: slogan, NIF, IMPIC/Alvará, responsible, phone, email, address, logo | Printed on reports (v2 prints responsible, NIF, IMPIC, email, phone) | Optional | — | `responsible` / phone / email are usually a natural person's data |
| Company: `default_vat_rate`, `notes` | Not used by the current UI (`notes` not in the form) | REVIEW | Candidate | — |
| Company: `subscription_status`, `subscription_plan`, `current_period_*` | Payments (dormant) | REVIEW | Unused until billing launches | — |
| **Client**: name | Report header, client picker | Required | — | Often a private individual |
| Client: phone | Client list search ("Pesquisar por nome ou telefone") | Optional | Low | Private individual's phone |
| Client: email, NIF, address | **Not used by any report, share or feature** (the report snapshot only takes `clientName`) | Optional | **Candidate** — collected without a current use | NIF is a national tax ID of a private individual → higher risk |
| Client: `notes` | Not in the UI | REVIEW | Candidate | Free text |
| **Project**: name, site address | Report header | Required | — | Site address is often a private home address |
| Project: contract no., contract value, distributed to, sent via, type_of_work, dates, `internal_notes` | Legal/Financeiro flow and report metadata; `internal_notes` / `type_of_work` mapped in DB layer only | Optional | `internal_notes` REVIEW | Contract value = commercial info |
| Project: closure_type/reason, archive/hide reason (`project_status_events.reason`, `note`, `snapshot_json`) | Lifecycle history | Reason is **mandatory** in UI | **Candidate** — mandatory free-text reason; `snapshot_json` copies project state into each event | Free text may contain anything (e.g. dispute details about a person) |
| **Estado da Obra**: phase, progress, summary, next steps, work items, incidents | Core product | Optional | — | Free text; incidents may describe disputes or damage |
| **Photos** (`project_photos`, legacy `photos`; bucket `project-photos`, private) | Core product | Optional | Removed photos are only soft-deleted (`deactivated_at`) — file and row stay forever | Photos of private homes, possibly people/vehicles/plates. EXIF (incl. GPS) **is stripped** — uploads are re-encoded via canvas (`js/utils/image-processing.js`); logo too (`company-logo.js`) |
| Photo `worker` | Printed on client report as "Responsável: …" | Optional | Low | Names an employee/subcontractor to the end client |
| **Reports** (`reports.snapshot_json`, `works`/`incidents`/`extras` jsonb, `pdf_url`, `alert_*`) | Immutable history (product promise "O que foi enviado fica como foi enviado") | Required by design | Old reports retain client name/site address/photos paths indefinitely — retention decision for next phase | Copies personal data into frozen snapshots; deleting a client/photo does not touch past snapshots |
| Extras: approved by (name), method, date | Legal/Financeiro record | Optional | — | Third-party names |
| **Share links**: token hash, expiry (7 days), revoked_at, `access_count`, `last_accessed_at`, `created_by` | Viewed / not-viewed status | Required | — | Access metadata about end clients. Token is stored hashed (good). IP / user agent of viewers are **not** stored by our code (Supabase platform logs not verified) |
| **Payments** (dormant): EuPago ids/refs, amount, `raw_create_response`, `raw_webhook_payload` jsonb | Billing (not live) | REVIEW | Since 2026-10-09 (repo code, **not deployed**) new requests store only an allowlist of non-personal provider fields; see "EuPago" below. Historical rows unchanged | Payment data |
| **Telemetry / analytics** | None exists | — | — | — |
| **Logs** | Edge Functions `console.error` on failure. EuPago functions now log ids, method, HTTP status and allowlisted provider fields only (fixed 2026-10-09, not deployed) | REVIEW | — | Logs retained by Supabase (period unknown) |
| Browser storage | Supabase session in localStorage only | Essential | — | See STORAGE-INVENTORY.md |

## Candidates for later removal / limitation (no change made)
1. Client `email`, `nif`, `address`, `notes` — no current product use.
2. Company `notes`, `default_vat_rate` — no current UI use.
3. Mandatory archive/hide reason → make optional or explain.
4. Physical deletion of "Removed" photos (storage objects) after a defined period.
5. ~~`payments.raw_*` payloads and payment debug logs~~ — minimised for new requests in repo code (2026-10-09); deploy only with payments activation. Existing rows untouched.
6. Retention rules for reports/snapshots, share-link metadata and status events (next phase — no periods are proposed here).

## EuPago cleanup (2026-10-09 — repo code only, not deployed, payments still disabled)

**Logging removed:** user email, full request body (MB WAY phone), full company row (name, email, owner id), full payment row, outgoing EuPago payload (phone `alias`, description with company name), full EuPago response, and in the webhook the full payload — which included `chave_api` (the EuPago API key, i.e. a secret in logs). Kept: user id, method, company/payment ids, error messages, HTTP status, allowlisted provider fields.

**Storage (`payments` table), what is written for new requests:**

| Field | Operationally necessary? | Note |
|---|---|---|
| company_id, provider, method, status, amount, currency, period_days, expires_at, paid_at | Yes | Billing state |
| eupago_transaction_id, eupago_reference, eupago_entity, eupago_identifier, eupago_payment_method_code | Yes | Reconciliation / webhook matching |
| raw_create_response | Partly | Now an allowlist: sucesso/success, estado/status, resposta/message, referencia/reference/ref, entidade/entity, valor/amount, transaction ids, identificador, data_inicio/data_fim, valor_minimo/maximo, codigo/code, erro/error. Dropped: everything else incl. any phone/alias, nested objects, non-JSON raw text |
| raw_webhook_payload | Partly | Now an allowlist: valor, canal, referencia, transacao, identificador/id/order_id, mp, data, entidade, comissao, local, estado/status. Dropped: `chave_api`, anything else |

The browser response's `eupago` field now carries the same allowlisted summary (the frontend only reads `entity`, `reference`, `amount`, `expiresAt`; `payment.js` logs the response to the console). **Historical rows** may still contain full payloads (incl. the API key in `raw_webhook_payload` if any webhook ever ran) — owner to check and decide; nothing was modified.

**Security fixes (2026-10-09, repo code only, not deployed):** the webhook now requires `chave_api` (constant-time match against `EUPAGO_API_KEY`; missing/empty/wrong → 401, malformed body → 400, key not configured → 503) before any payment lookup; the legacy `chave` fallback is no longer accepted. Error responses no longer carry `details`, `code`, `stack`, raw `error.message`, missing-secret names or the EuPago echo — the browser gets the existing Portuguese `error` text or "Pagamentos temporariamente indisponíveis."; causes are logged server-side. Verified by running the handler with stubbed Deno/Supabase. **Still owner actions:** deployment status is not knowable from the repo; if the old webhook was ever deployed, check historical `payments.raw_webhook_payload` for the stored API key and rotate it. Not handled: EuPago webhook 2.0 signatures, and query-string (GET) notifications — confirm the provider's delivery method before activation.
