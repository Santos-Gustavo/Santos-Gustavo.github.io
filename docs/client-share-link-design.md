# Client Share-Link Architecture — Design Document

Status: **design only — nothing in this document is implemented.**
No app code, RLS policy, table, or Edge Function described here exists yet.

## 1. Current state

Confirmed by direct inspection of the codebase (see prior investigation):

- **No client/public view exists.** [index.html](../index.html) has exactly two screens: `#authScreen` and `#appScreen`. Every step, including project lifecycle controls (Editar, Arquivar/Ocultar, Pausar, Marcar como concluído, Reabrir — [js/projects/project-list.js](../js/projects/project-list.js), [js/projects/project-mode-page.js](../js/projects/project-mode-page.js)), lives inside the one authenticated screen.
- **Reports are generated as local blob URLs, not links.** [js/reports/report-generator.js](../js/reports/report-generator.js) builds a self-contained HTML string via `renderReportHtml()` ([js/reports/report-renderer.js](../js/reports/report-renderer.js)) and opens it with `URL.createObjectURL()` in a new tab ([js/reports/report-preview.js](../js/reports/report-preview.js)). A `blob:` URL only resolves inside the browser session/tab that created it — it cannot be sent to another device and cannot function as a share link.
- **WhatsApp is only a delivery-metadata field today.** `SENT_VIA.WHATSAPP` ([js/database/db-codes.js](../js/database/db-codes.js)) and the `sentVia` form field ([js/mappers/report-mapper.js](../js/mappers/report-mapper.js)) just record how the contractor says they delivered a report. No code sends anything or builds a `wa.me` link.
- **Photos are always served via short-lived signed URLs.** [js/database/storage-service.js](../js/database/storage-service.js) creates signed URLs against the private `project-photos` bucket with a 1-hour expiry (`SIGNED_URL_EXPIRES_SECONDS`), cached client-side and refreshed after 55 minutes. The bucket has never been public.
- **The authenticated app is fully governed by Supabase RLS.** Every policy on `projects`, `reports`, `photos`, `clients`, `payments` in [supabase/manual/live_schema_rls_baseline.sql](../supabase/manual/live_schema_rls_baseline.sql) is scoped `to authenticated` with an `owner_id = auth.uid()` (or company/client join) check. There is no `anon` policy anywhere in the schema today.
- **Existing Edge Functions establish a house style** worth reusing rather than reinventing: [supabase/functions/delete-photo/index.ts](../supabase/functions/delete-photo/index.ts) and `delete-project` take a bearer JWT, resolve the user with an anon-key client, then use a **service-role client to call a `SECURITY DEFINER` Postgres RPC** (`get_authorized_photo_storage_path`, `delete_authorized_photo`) that does the actual authorization + row access. Authorization logic lives in SQL; the Edge Function is a thin, typed gatekeeper with CORS headers and structured JSON responses. `eupago-webhook` shows the pattern for a function that must trust no caller identity at all and instead validates a shared secret from the payload.

## 2. Product goal

| Requirement | Source constraint |
|---|---|
| Contractor can hand a client a link to one report | current flow has no shareable artifact at all |
| Client needs no account/login | client is external, has no Supabase Auth user |
| Client cannot see any other report or project | must not be a "logged in as a limited client role" model — must be scoped per-link |
| Client cannot edit/archive/create anything | link must be strictly read-only, no admin UI reachable |
| Link can expire and can be revoked | contractor needs to shut off access after the fact |
| Photos stay private except via short-lived signed URLs | never make `project-photos` public |

The shape of the solution follows directly: a **capability link** (possession of an unguessable token is the only credential) that resolves, server-side, to a narrow, read-only, time-boxed view of exactly one report.

## 3. Proposed data model

```sql
create table public.report_share_links (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,

  token_hash text not null unique,   -- sha256(raw token), hex or base64 — never the raw token

  expires_at timestamptz not null,
  revoked_at timestamptz,

  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),

  last_accessed_at timestamptz,
  access_count integer not null default 0,

  constraint report_share_links_expires_after_created check (expires_at > created_at)
);

create index idx_report_share_links_report_id on public.report_share_links(report_id);
create index idx_report_share_links_token_hash on public.report_share_links(token_hash);
create index idx_report_share_links_expires_at on public.report_share_links(expires_at)
  where revoked_at is null;
```

Notes:

- **`token_hash`, never the raw token.** The raw token is generated once, returned to the contractor's browser exactly once (in the "create link" response), and then discarded server-side. Postgres/logs/backups only ever see `sha256(token)`. This mirrors the general rule "hash what you store, never store what you can leak" and means a database dump or `pg_dump` alone can never reproduce a working link.
- `report_id` cascades on delete: deleting a report kills every link to it, no orphaned tokens.
- `expires_at` is required (no "forever" links). A default TTL (e.g. 7 days) is applied by whatever creates the row (see §6), not baked into the table.
- `revoked_at` is a separate, independently-settable field so "the contractor turned it off early" is distinguishable from "it just timed out" in the audit trail, even though both should look identical (a generic "unavailable") to the client.
- `access_count` / `last_accessed_at` are **telemetry, not a security control.** They're useful for a contractor to see "yes, the client opened it," but must never be relied on for rate limiting or replay prevention (a retried request can double-increment them; that's an accepted, harmless inaccuracy — see §7).
- RLS on this table itself: `select/insert/update` scoped `to authenticated` where the caller owns the parent report (same ownership chain already used by `reports_select_own`). **No `anon` policy is added to this table** — the public flow never reads it directly; it only goes through the `SECURITY DEFINER` RPC in §4, which runs with elevated privilege and bypasses RLS deliberately and narrowly.

## 4. Access model: RPC vs. Edge Function

### Option A — `SECURITY DEFINER` Postgres RPC called directly from the browser

The public page calls `supabase.rpc("get_shared_report", { token_hash })` with the anon key, and a `SECURITY DEFINER` function does the validity check and returns report data.

- ✅ One network hop, minimal infra.
- ✅ Consistent with `get_authorized_photo_storage_path` already existing as a definer function.
- ❌ **Cannot mint photo signed URLs.** `storage.objects` policies on `project-photos` are `to authenticated` only (§1). An anonymous caller has no way to get a signed URL for a photo without either (a) opening up bucket policies to `anon` — explicitly disallowed by this task — or (b) some component running with elevated privilege calling the Storage API on the caller's behalf. A plain SQL function cannot call the Storage REST API. So Option A alone cannot deliver a complete report (report text yes, photos no) without still needing an elevated component bolted on the side anyway.
- ❌ Weaker error shaping. The RPC's return value is whatever PostgREST serializes; distinguishing "give the same generic error for expired/revoked/not-found" (§7) from the client's perspective means doing that normalization in JS running in the *public* page, which is a worse place for it than a controlled server boundary.
- ❌ No natural place to add abuse controls (basic rate limiting, structured logging, method restrictions) later without introducing an Edge Function anyway.

### Option B — Supabase Edge Function fronting a `SECURITY DEFINER` RPC

The public page calls a new Edge Function (`get-shared-report`) with the raw token. The function hashes it, calls a `SECURITY DEFINER` RPC to validate + fetch the report row, and — only if valid — uses its service-role client to mint short-lived signed URLs for the report's photos, then returns one deliberately-shaped JSON object.

- ✅ Solves the photo problem: the function already needs a service-role client (same pattern as `delete-photo`), so minting signed URLs server-side is free.
- ✅ Matches existing project conventions exactly (JWT-optional variant of the same `serve()` + CORS + service-role + definer-RPC shape used by `delete-photo`/`delete-project`). No new pattern for future maintainers to learn.
- ✅ One hard perimeter: only this function's environment holds `SUPABASE_SERVICE_ROLE_KEY`; the RPC underneath still independently enforces `revoked_at is null and expires_at > now()`. Two layers, not one.
- ✅ Full control over the response shape — the function can allowlist fields explicitly (see §7) instead of trusting whatever a raw table/view returns.
- ✅ Full control over error responses — every failure mode (expired, revoked, bad token, malformed token) can collapse to the same generic 404-shaped body, closing the "which reason did it fail for" oracle that a raw RPC error would otherwise expose.
- ❌ One more deploy target, marginally more latency (function → RPC → Storage API), Deno cold starts.

### Recommendation: **Option B, Edge Function**

The deciding factor is that this codebase's constraints (`project-photos` stays private, no `anon` storage policies) make an elevated, server-side component **mandatory** for photos regardless of which option is chosen for the report metadata. Given that a service-role component must exist anyway, it should also own request shaping, error normalization, and be the single reviewable perimeter — which is exactly what the existing `delete-photo`/`delete-project` functions already do for their own concerns. The `SECURITY DEFINER` RPC is still the right place for the actual "is this token valid" authorization check (kept in SQL, next to the table it guards, consistent with `get_authorized_photo_storage_path`), it's just invoked *from* the Edge Function rather than *by* the browser.

## 5. Public client page

```
share.html                     — new, standalone static entry point
js/share/share-client.js       — its only JS file
```

Hard constraint, enforced by code review / lint, not just convention: `js/share/share-client.js` **must not import** anything under `js/projects/`, `js/navigation/`, `js/auth/`, or `js/database/db-projects.js` / `db-reports.js` / `db-photos.js` / `supabase-client.js`. None of the admin/lifecycle code should even be reachable from this page's dependency graph — not hidden by an `if`, physically absent from the bundle the client's browser loads.

The one deliberate exception: **`js/reports/report-renderer.js` may be imported directly.** It was already read in full during the investigation — it has zero imports and is a pure function (`renderReportHtml(report) -> string`) with no DOM, auth, or navigation coupling. Reusing it avoids re-implementing ~700 lines of report HTML/CSS templating for the client view, and keeps the two views (contractor preview, client share) pixel-identical by construction.

`share.html` layout:

- Its own minimal `<head>` — no `importmap` entries for `#projects/`, `#navigation/`, `#auth/`, `#config/`, `#state/`; only what `report-renderer.js` needs (nothing — it has no imports).
- `<meta name="referrer" content="no-referrer">` (see §7 on token placement).
- A single mount point, rendered as a **sandboxed same-document iframe** (`<iframe sandbox srcdoc="...">`) rather than `document.write`-ing the report HTML straight into the host page. `renderReportHtml()` already returns a complete standalone `<html>` document (it's designed to be opened as its own tab today); feeding it into a sandboxed iframe keeps it isolated from `share-client.js`'s own runtime even though, by design, that runtime has nothing sensitive in it — defense in depth costs nothing here.

`js/share/share-client.js` responsibilities, in order:

1. Read the token from `location.hash` (`#token=...`), **not** `location.search` (see §7).
2. If missing/malformed, render the same generic "Este link não está disponível." state used for every other failure mode — never a different message for "no token" vs "bad token" vs "expired."
3. `fetch(SHARE_FUNCTION_URL, { method: "POST", headers: { apikey: PUBLIC_ANON_KEY, "content-type": "application/json" }, body: JSON.stringify({ token }) })`. The anon key is not a secret (it's already shipped in `index.html` today); it identifies the calling project to Supabase's gateway, it does not grant data access — RLS/the definer RPC does that.
4. Non-200 → generic unavailable state, no further detail rendered or logged to the console.
5. 200 → response body is a report-document shape (the same shape `buildCurrentReportDocument()` produces, with `photos[].displayUrl` already populated with freshly-minted signed URLs) minus every id field (see §7). Pass it straight to `renderReportHtml()` and inject the resulting HTML string as the iframe's `srcdoc`.

No build step, no bundler changes: `share.html` can load `share-client.js` as a plain `<script type="module">` with a relative import (`import { renderReportHtml } from "./js/reports/report-renderer.js";`), sidestepping the need to touch the existing `#reports/` import-map alias at all.

## 6. WhatsApp flow

Contractor-side (inside the existing authenticated app):

1. A **"Criar link para cliente"** action (`data-report-action="create-share-link"`) appears next to a saved report — natural home is [js/reports/report-history.js](../js/reports/report-history.js), where past reports and their `sentVia` metadata already live.
2. Click handler (new module, e.g. `js/reports/report-share.js`) calls a new, **authenticated** Edge Function `create-report-share-link` with `{ report_id }`, following the exact `delete-photo` pattern: bearer JWT → anon-key client resolves the user → service-role client calls a `SECURITY DEFINER` RPC.
3. The RPC, e.g. `create_report_share_link(p_report_id uuid, p_user_id uuid, p_ttl_hours int default 168)`:
   - Confirms `p_report_id` belongs to a project owned (directly or via company) by `p_user_id`, using the same ownership chain as `reports_select_own` — otherwise returns nothing / raises.
   - Generates the raw token itself (e.g. `encode(gen_random_bytes(32), 'base64')`) and inserts a row storing only `digest(token, 'sha256')`, so token generation and hashing happen atomically in one place and the raw value is never written to a table, only returned once as an `out` value.
   - Returns `{ token, expires_at }` to the Edge Function, which returns it to the browser.
4. Browser builds `https://<site-origin>/share.html#token=<token>` (fragment, not query — see §7).
5. Browser opens `https://wa.me/?text=<url-encoded message containing the link>` in a new tab, using the same `window.open` pattern already used by [report-preview.js](../js/reports/report-preview.js). No phone number is hardcoded — `wa.me/?text=` opens WhatsApp's own chat picker so the contractor chooses the client.
6. UI also shows the raw link with a "Copiar link" button as a fallback for when WhatsApp Web/desktop isn't available.
7. Optionally, once the link is created, set `sentVia = WhatsApp` on the report automatically (today this is a manual dropdown; this flow makes it accurate by construction).

## 7. Security rules

- **Service role key lives only in Edge Function environments.** It is never sent to, or reachable from, browser code — same as today's `delete-photo`/`delete-project`.
- **The public key is never `project_id`/`report_id`.** The only credential the client-facing function accepts is the opaque token; UUIDs are never accepted as an alternate lookup key on the public endpoint.
- **`project-photos` bucket stays private.** Shared-view photos are served exclusively through signed URLs minted server-side, per request, by the Edge Function's service-role client — never by loosening bucket policy for `anon`.
- **Token strength.** Generated server-side with `gen_random_bytes(32)` (256 bits) — not derived from any predictable value (not a UUID, not report/project id, not a timestamp). Brute-forcing the token space is not a practical concern; the design does not rely on rate limiting for this property, though basic abuse protection (e.g. platform-level request throttling) is a reasonable Phase 6 addition.
- **Only the hash is stored** (`token_hash`), as detailed in §3 — a database leak alone cannot reproduce a working link.
- **One generic failure response.** Expired, revoked, not-found, and malformed-token all return the same status/body from `get-shared-report`. Distinguishing them server-side (for the contractor's own tooling later, if ever needed) is fine; leaking the distinction to the anonymous caller is not — it turns the endpoint into an oracle for guessing valid-but-expired vs. never-existed tokens.
- **Token goes in the URL fragment, not the query string.** `share.html#token=...` rather than `?token=...`. Fragments are never sent to the server in the HTTP request line, so they don't appear in static-hosting access logs, CDN logs, or `Referer` headers sent to third-party resources the page happens to load (this app already `preconnect`s to Google Fonts in `index.html`; `share.html` will likely do the same). `share.html` also sets `Referrer-Policy: no-referrer` as defense in depth. The token is still visible in browser history and inside the WhatsApp message itself — an accepted, inherent trade-off of link-based sharing, mitigated by short expiry and revocation, not eliminated.
- **The shared response is an explicit allowlist, not a filtered table row.** `get-shared-report` returns a report-document-shaped object with every internal id field stripped or nulled — no `report_id`, `project_id`, `company_id`, `client_id`, `owner_id`, or `created_by`. `renderReportHtml()` was confirmed (during the investigation) to only use `meta.reportId`/etc. to build a display-only slug (`buildReportId()` → `PROJ-CLIENTE-001`), never the underlying UUIDs — so nothing user-visible is lost by omitting them.
- **No lifecycle/admin affordances reach this page**, enforced structurally per §5 (the import boundary), not just visually — there is no CSS to "hide" a button that was never shipped to this page's JS in the first place.
- **`access_count`/`last_accessed_at` are informational only** (§3) — never used as a security gate (e.g. "only allow N views"); that would need its own explicit, documented product decision, not an implicit side effect of telemetry.

## 8. Testing plan

New Playwright specs under `tests/e2e/`, following the two existing testing styles in this repo — page-driven UI assertions (à la `payments-readonly-boundary.spec.js`) and direct API/DB assertions via `@supabase/supabase-js` with the anon key (à la `rls-security.spec.js`):

- **`tests/e2e/client-share-link-readonly-boundary.spec.js`**
  Seed a valid share link (via a test-only helper hitting `create-report-share-link` with a real logged-in test user, or a direct RPC call), then `page.goto("/share.html#token=...")` with **no login step at all**, and assert:
  - the report content (works, photos, incidents, financials as applicable) renders;
  - zero elements match `[data-project-action]`, `[data-report-action]`, `[data-nav-action]`, `[data-auth-action]`, `[data-payment-action]`;
  - no button/text matches Editar, Arquivar, Ocultar, Reabrir, Pausar, Marcar como concluído, Novo relatório, Novo projeto (same assertion style as `payments-readonly-boundary.spec.js`);
  - `#authScreen`/`#appScreen` are absent from the DOM entirely (different document, not just hidden).

- **`tests/e2e/client-share-link-expiry.spec.js`**
  Seed a link with `expires_at` in the past (directly via test DB access, bypassing the normal 7-day-default RPC) → `page.goto` it → assert the generic "unavailable" state, and assert the response status from `get-shared-report` is the same generic shape used for other failure modes (no distinguishing detail in the body).

- **`tests/e2e/client-share-link-revoked.spec.js`**
  Create a valid link, call the revoke path (RPC or a future `revoke-report-share-link` function) to set `revoked_at`, then confirm it behaves identically to the expired case from the outside.

- **`tests/e2e/client-share-link-invalid-token.spec.js`**
  `page.goto("/share.html#token=" + <random 32-byte value that was never issued>)` → same generic unavailable state; also directly POST a handful of malformed tokens (empty, too short, wrong charset) straight to `get-shared-report` and assert consistent 4xx shape.

- **`tests/e2e/client-share-link-isolation.spec.js`**
  With two seeded reports/links, confirm token A's response never contains any field identifying report B (no cross-report leakage), and confirm the response body contains none of `report_id`, `project_id`, `company_id`, `client_id`, `owner_id` — i.e. assert the field allowlist from §7 by inspecting the actual JSON, not just the rendered HTML.

All new specs should reuse the existing `.env`-driven credential pattern (`E2E_EMAIL`/`E2E_PASSWORD`, `SUPABASE_URL`/`SUPABASE_ANON_KEY`) already established in `rls-security.spec.js` and `payments-readonly-boundary.spec.js`, so no new test infrastructure is needed beyond a small helper for "create a share link for a given report as the test user."

## 9. Rollout plan

- **Phase 1 — Design (this document).** No code. ✅ current phase.
- **Phase 2 — Data + access layer.** `report_share_links` table + its `authenticated`-only RLS policies; `create_report_share_link` and `get_shared_report` `SECURITY DEFINER` RPCs; `create-report-share-link` and `get-shared-report` Edge Functions. No UI changes yet — testable directly via `supabase-js`/`curl` against the deployed functions.
- **Phase 3 — Read-only renderer.** `share.html` + `js/share/share-client.js`, wired to the Phase 2 `get-shared-report` function using a manually-created token (no UI to create one yet). Verifies the render/import-boundary/photo-signing path end to end.
- **Phase 4 — WhatsApp link generation.** The "Criar link para cliente" action in the authenticated app (`js/reports/report-share.js`), calling `create-report-share-link` and building the `wa.me` deep link. This is the first phase a contractor can use unassisted.
- **Phase 5 — Tests.** The five specs in §8, plus updating any existing suite that enumerates all `data-*-action` attributes if one exists, so it stays honest about the new surface.
- **Phase 6 — Polish.** Revoke-link UI/action, "copiar link" fallback, nicer expired/revoked messaging, optional access-log table for the contractor's own visibility, basic abuse-rate protection — none of it security-load-bearing, all of it deferred without weakening §7.
