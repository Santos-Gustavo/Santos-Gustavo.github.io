# CLIENT-SHARE-LINK-001

Status: Built, not deployed. Code for Phases 2-5 (§3.9) is written — data/access layer, all three Edge Functions, the public share page, contractor-side create/copy/revoke UI, and the five Playwright specs. Nothing has been applied to the live Supabase project or run against it yet — see §3.10. CEO gave GO on 2026-08-28 without a formal Gemini Value Gate / ChatGPT Definition Gate pass — see §6.
Risk: High — new public/unauthenticated surface, RLS-adjacent (per `docs/brain/context/architecture.md` — public routes use token-based access, never RLS relaxation)
Evidence Level: 0 — Not yet externally validated (no traceable entry in `docs/product/evidence.md`; see §1 Evidence)
Execution Path: Full Gate (public access + auth-adjacent surface both trigger Full Gate per `docs/brain/OPERATION-MODEL.md` §9)

This document originated as a standalone engineering investigation/design before the feature-file structure existed; Sections 1 and 2 were drafted afterward. Section 3 (Engineering) is complete and implementation-ready. Sections 4, 5, and 6 have not been produced yet. Nothing in this document is approved — Sections 1–3 are drafted proposals awaiting Gemini's Value Gate, ChatGPT's Definition Gate, and Gustavo's Full Gate release decision.

## 1. Product Rationale — Gemini

* **Problem:** Contractors currently generate report previews as temporary local browser blob URLs that cannot be shared. They are forced to screenshot reports or send raw files over WhatsApp, resulting in messy, unformatted communication where clients miss progress updates and dispute extra work.
* **Target User:** Micro-contractors and small renovation teams (1–4 workers) communicating progress and evidence directly to homeowners via WhatsApp.
* **Observed Pain:** Contractors lack a simple, professional, 1-click way to hand a client an immutable proof-of-work summary without forcing the client to create an account or download an app.
* **Evidence:** Level 0 — not yet externally validated. The discovery-call observations this rationale draws on are not logged in `docs/product/evidence.md`; add a traceable entry there (source, date, what was observed) before raising this above Level 0.
* **Expected Business Outcome:** High share-link creation rate per project → higher client engagement → contractor perceives app as an essential professional communication tool → drives conversion to a paid subscription.
* **Success Metrics:**
  * % of generated reports shared via link.
  * % of share links opened by clients within 48 hours.
  * Zero security/isolation breaches (cross-report data leakage or unauthorized project access).
* **Priority:** Critical. Client share links are required before reports can be delivered professionally through WhatsApp without manual PDF export.
* **Value Gate Pass:** YES —
  * Prevents payment disputes by creating a clean, professional evidence trail for delivered work.
  * Replaces messy chat screenshots with a polished, branded client-facing report.
  * Increases client trust and visibility into documented project progress.
  * (This is Claude's read of the stated rationale, carried over while cleaning this document — it is not a substitute for Gemini's own Value Gate sign-off, which is still outstanding.)

## 2. PM Specification — ChatGPT

*Drafted below following the Gate 2 template (`docs/chatgpt/CHATGPT.md`). Not yet reviewed or signed off by ChatGPT.*

### User Story

As a contractor, I want to hand my client a single link to their project report so they can review documented progress and photos on WhatsApp, without me exporting a PDF or screenshotting the report by hand.

### Scope

* Tokenized, read-only, expiring link to exactly one saved report.
* Contractor-initiated link creation from the report history view.
* WhatsApp deep-link generation, plus a "Copiar link" fallback.
* Revocation of an active link by the contractor.
* Print-friendly layout so the client can use their own browser's print/save-to-PDF.

### Out of Scope

* Client accounts or login of any kind.
* Client-side approval/sign-off workflow — no "aprovar"/"aprovação" language in v1 (see AC-02.7).
* Per-photo client visibility selection is out of scope for v1. All photos already attached to the saved report are shared as-is.
* Custom server-side PDF generation/export.
* Rate limiting or abuse protection beyond token strength (deferred — see Section 3.9 Phase 6).

### Requirements & Acceptance Criteria

* **REQ-01: Tokenized Unauthenticated Client View**
  * **AC-01.1:** An unauthenticated user accessing `share.html#token=<RAW_TOKEN>` shall see a client-safe, read-only report payload.
  * **AC-01.2:** The shared report payload shall be built strictly from an explicit allowlist of client-safe fields.
  * **AC-01.3:** The shared view shall omit all internal database UUIDs, including `report_id`, `project_id`, `client_id`, `company_id`, and `owner_id`.
  * **AC-01.4:** The shared report shall include the photos already attached to the saved report, rendered through fresh short-lived signed URLs.
  * **AC-01.5:** The raw token shall be generated server-side using cryptographically secure randomness, at least 32 bytes before encoding.
  * **AC-01.6:** Only `token_hash` shall be stored in the database. The raw token shall never be stored in plaintext.
  * **AC-01.7:** `share.html` shall read the token strictly from `location.hash`, never `location.search`.
  * **AC-01.8:** Invalid, unknown, expired, and revoked tokens shall all return the same generic unavailable response: `"Este link não está disponível."`
  * **AC-01.9:** The shared page shall include a print-friendly layout CSS. Custom PDF generation binaries are out of scope for v1 (handled via browser print/save-to-PDF).

* **REQ-02: Link Generation & WhatsApp Action**
  * **AC-02.1:** A logged-in contractor can click "Criar link para cliente" on a saved report.
  * **AC-02.2:** A share link cannot be created for an unsaved report without a persisted report id.
  * **AC-02.3:** The created link shall have a default TTL of 7 days (`p_ttl_hours = 168`).
  * **AC-02.4:** The app shall generate `share.html#token=<RAW_TOKEN>`.
  * **AC-02.5:** The app shall provide a "Copiar link" fallback button to copy the URL to the clipboard.
  * **AC-02.6:** The app shall provide a WhatsApp action using an encoded `wa.me` text message:
    `"Olá! Aqui está o relatório do projeto [Nome do Projeto]: [LINK]. Por favor, aceda ao link para rever o progresso documentado."`
  * **AC-02.7:** The WhatsApp message shall not use "aprovar", "aprovação", or equivalent sign-off language in v1.

* **REQ-03: Link Lifecycle & Revocation**
  * **AC-03.1:** If `expires_at` is in the past or `revoked_at` is populated, `get-shared-report` shall return `"Este link não está disponível."`
  * **AC-03.2:** Revoking a link shall immediately block client access.
  * **AC-03.3:** The contractor can generate a new active share link for the same report after revocation or expiry.
  * **AC-03.4:** Access tracking such as `last_accessed_at` and `access_count` may be updated, but failure to update tracking shall not expose data or break the client view.

* **REQ-04: Strict Isolation & Read-Only Boundary**
  * **AC-04.1:** `share.html` shall be a standalone public entrypoint.
  * **AC-04.2:** `js/share/*` shall not import `#projects/`, `#navigation/`, `#auth/`, `#database/`, or admin app modules.
  * **AC-04.3:** No project controls shall exist or be reachable in `share.html`: Editar, Arquivar, Ocultar, Reabrir, Pausar, Marcar como concluído, Novo relatório, Novo projeto.
  * **AC-04.4:** The `project-photos` bucket shall remain private.
  * **AC-04.5:** No service-role key shall be exposed to browser code.
  * **AC-04.6:** The shared endpoint shall return only one report. It shall never return a project report list, other projects, other clients, or owner/company internals.

### Task Breakdown

1. DB data layer: migration for `report_share_links` table + `authenticated`-only RLS policies, no public policies — covers REQ-01, REQ-03.
2. Edge Function `create-report-share-link`: authenticated, verifies report ownership, generates token, stores only its hash — covers REQ-02, REQ-01.
3. Edge Function `get-shared-report`: accepts token, validates hash/TTL/revocation, returns client-safe allowlisted JSON payload with fresh signed photo URLs — covers REQ-01, REQ-03, REQ-04.
4. Client standalone page: `share.html` + `js/share/share-client.js`, pure rendering via `report-renderer.js`, print-friendly CSS, zero admin module imports — covers REQ-01, REQ-04.
5. Contractor app integration: "Criar link para cliente" and "Copiar link" UI actions in `report-history.js`, `wa.me` deep link generator with the non-approval wording — covers REQ-02.
6. Automated security & boundary test suite: unauthenticated token access, invalid/expired/revoked generic response, no-UUID-leakage assertions, static import-boundary check for `js/share/*` — covers REQ-01, REQ-03, REQ-04.

### Required Tests

* **Automated (Playwright):** the five specs scoped in Section 3.8 — `client-share-link-readonly-boundary`, `-expiry`, `-revoked`, `-invalid-token`, `-isolation`.
* **Automated (static):** import-boundary check verifying `js/share/*` never imports admin/auth/db modules (AC-04.2).
* **Manual:** WhatsApp deep link opens the chat picker with the correct message copy, on both mobile and desktop (AC-02.6/AC-02.7).
* **Manual:** browser print/save-to-PDF from the shared page renders legibly (AC-01.9).
* **Regression:** existing authenticated report-history/report-preview flows are unaffected — no `js/share/*` code pulled into the admin bundle.

### Edge Cases

* Report is deleted after a share link was created → cascading delete removes the link row (Section 3.2); client sees the generic unavailable state, not an error.
* Contractor revokes a link the client currently has open → next load/reload shows the generic unavailable state immediately (AC-03.2).
* Token is well-formed but never existed (guessed) → same generic unavailable response as expired/revoked (AC-01.8/AC-03.1).
* Report has zero photos → shared view renders the report content with an empty photos section, not an error.
* Contractor creates a new link for a report that still has a live, unexpired link — whether the old link keeps working or is implicitly superseded is not yet specified (see Unresolved Open Questions).

### Dependencies

* `report-renderer.js` (`renderReportHtml()`) must remain a pure, import-free function — the zero-admin-import guarantee in AC-04.2 depends on this staying true.
* Existing `delete-photo`/`delete-project` Edge Function pattern (bearer JWT → anon-key client resolves caller → service-role client → `SECURITY DEFINER` RPC) is the template for both new Edge Functions.
* `storage-service.js`'s signed-URL issuance pattern is reused server-side (in the Edge Function) for the shared view's photos.

### Non-Functional Requirements

* Token generation must use cryptographically secure randomness (`gen_random_bytes(32)`, AC-01.5).
* No service-role key is ever reachable from browser code (AC-04.5).
* Public endpoint responses must not distinguish failure reasons — consistent shape across expired/revoked/not-found/malformed tokens (AC-01.8/AC-03.1).
* `share.html` must load with no build step and no bundler changes, consistent with the rest of the app.

### QA Risk

**High** — public, unauthenticated, RLS-adjacent surface serving real client data (report content, photos). Per `docs/chatgpt/CHATGPT.md`'s High-risk bar: automated tests + adversarial edge cases + permission/state testing, not just a happy-path smoke test.

### Definition of Done

* [ ] Every REQ-01…REQ-04 acceptance criterion PASS
* [ ] All five Required Tests specs (Task 6) written and passing
* [ ] Static import-boundary check for `js/share/*` passing
* [ ] No new regressions in existing report-history/report-preview flows
* [ ] Section 3 (Engineering) updated to reflect anything that changed during implementation
* [ ] Section 4 (Verification) completed by ChatGPT
* [ ] `docs/product/evidence.md` gains a traceable entry if real client usage data becomes available post-release
* [ ] `docs/product/features-catalog.md` updated to move client-facing sharing from "in design" to shipped

## 3. Engineering — Claude

Status: **design only — nothing in this section is implemented.** No app code, RLS policy, table, or Edge Function described here exists yet.

### 3.1 Current state

Confirmed by direct inspection of the codebase (see prior investigation):

- **No client/public view exists.** [index.html](../../index.html) has exactly two screens: `#authScreen` and `#appScreen`. Every step, including project lifecycle controls (Editar, Arquivar/Ocultar, Pausar, Marcar como concluído, Reabrir — [js/projects/project-list.js](../../js/projects/project-list.js), [js/projects/project-mode-page.js](../../js/projects/project-mode-page.js)), lives inside the one authenticated screen.
- **Reports are generated as local blob URLs, not links.** [js/reports/report-generator.js](../../js/reports/report-generator.js) builds a self-contained HTML string via `renderReportHtml()` ([js/reports/report-renderer.js](../../js/reports/report-renderer.js)) and opens it with `URL.createObjectURL()` in a new tab ([js/reports/report-preview.js](../../js/reports/report-preview.js)). A `blob:` URL only resolves inside the browser session/tab that created it — it cannot be sent to another device and cannot function as a share link.
- **WhatsApp is only a delivery-metadata field today.** `SENT_VIA.WHATSAPP` ([js/database/db-codes.js](../../js/database/db-codes.js)) and the `sentVia` form field ([js/mappers/report-mapper.js](../../js/mappers/report-mapper.js)) just record how the contractor says they delivered a report. No code sends anything or builds a `wa.me` link.
- **Photos are always served via short-lived signed URLs.** [js/database/storage-service.js](../../js/database/storage-service.js) creates signed URLs against the private `project-photos` bucket with a 1-hour expiry (`SIGNED_URL_EXPIRES_SECONDS`), cached client-side and refreshed after 55 minutes. The bucket has never been public.
- **The authenticated app is fully governed by Supabase RLS.** Every policy on `projects`, `reports`, `photos`, `clients`, `payments` in [supabase/manual/live_schema_rls_baseline.sql](../../supabase/manual/live_schema_rls_baseline.sql) is scoped `to authenticated` with an `owner_id = auth.uid()` (or company/client join) check. There is no `anon` policy anywhere in the schema today.
- **Existing Edge Functions establish a house style** worth reusing rather than reinventing: [supabase/functions/delete-photo/index.ts](../../supabase/functions/delete-photo/index.ts) and `delete-project` take a bearer JWT, resolve the user with an anon-key client, then use a **service-role client to call a `SECURITY DEFINER` Postgres RPC** (`get_authorized_photo_storage_path`, `delete_authorized_photo`) that does the actual authorization + row access. Authorization logic lives in SQL; the Edge Function is a thin, typed gatekeeper with CORS headers and structured JSON responses. `eupago-webhook` shows the pattern for a function that must trust no caller identity at all and instead validates a shared secret from the payload.

The shape of the solution follows directly from §2's constraints: a **capability link** (possession of an unguessable token is the only credential) that resolves, server-side, to a narrow, read-only, time-boxed view of exactly one report.

### 3.2 Proposed data model

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
- `expires_at` is required (no "forever" links). A default TTL (e.g. 7 days) is applied by whatever creates the row (see §3.6), not baked into the table.
- `revoked_at` is a separate, independently-settable field so "the contractor turned it off early" is distinguishable from "it just timed out" in the audit trail, even though both should look identical (a generic "unavailable") to the client.
- `access_count` / `last_accessed_at` are **telemetry, not a security control.** They're useful for a contractor to see "yes, the client opened it," but must never be relied on for rate limiting or replay prevention (a retried request can double-increment them; that's an accepted, harmless inaccuracy — see §3.7).
- RLS on this table itself: `select/insert/update` scoped `to authenticated` where the caller owns the parent report (same ownership chain already used by `reports_select_own`). **No `anon` policy is added to this table** — the public flow never reads it directly; it only goes through the `SECURITY DEFINER` RPC in §3.4, which runs with elevated privilege and bypasses RLS deliberately and narrowly.

### 3.3 Access model: RPC vs. Edge Function

#### Option A — `SECURITY DEFINER` Postgres RPC called directly from the browser

The public page calls `supabase.rpc("get_shared_report", { token_hash })` with the anon key, and a `SECURITY DEFINER` function does the validity check and returns report data.

- One network hop, minimal infra.
- Consistent with `get_authorized_photo_storage_path` already existing as a definer function.
- **Cannot mint photo signed URLs.** `storage.objects` policies on `project-photos` are `to authenticated` only (§3.1). An anonymous caller has no way to get a signed URL for a photo without either (a) opening up bucket policies to `anon` — explicitly disallowed by this task — or (b) some component running with elevated privilege calling the Storage API on the caller's behalf. A plain SQL function cannot call the Storage REST API. So Option A alone cannot deliver a complete report (report text yes, photos no) without still needing an elevated component bolted on the side anyway.
- Weaker error shaping. The RPC's return value is whatever PostgREST serializes; distinguishing "give the same generic error for expired/revoked/not-found" (§3.7) from the client's perspective means doing that normalization in JS running in the *public* page, which is a worse place for it than a controlled server boundary.
- No natural place to add abuse controls (basic rate limiting, structured logging, method restrictions) later without introducing an Edge Function anyway.

#### Option B — Supabase Edge Function fronting a `SECURITY DEFINER` RPC

The public page calls a new Edge Function (`get-shared-report`) with the raw token. The function hashes it, calls a `SECURITY DEFINER` RPC to validate + fetch the report row, and — only if valid — uses its service-role client to mint short-lived signed URLs for the report's photos, then returns one deliberately-shaped JSON object.

- Solves the photo problem: the function already needs a service-role client (same pattern as `delete-photo`), so minting signed URLs server-side is free.
- Matches existing project conventions exactly (JWT-optional variant of the same `serve()` + CORS + service-role + definer-RPC shape used by `delete-photo`/`delete-project`). No new pattern for future maintainers to learn.
- One hard perimeter: only this function's environment holds `SUPABASE_SERVICE_ROLE_KEY`; the RPC underneath still independently enforces `revoked_at is null and expires_at > now()`. Two layers, not one.
- Full control over the response shape — the function can allowlist fields explicitly (see §3.7) instead of trusting whatever a raw table/view returns.
- Full control over error responses — every failure mode (expired, revoked, bad token, malformed token) can collapse to the same generic 404-shaped body, closing the "which reason did it fail for" oracle that a raw RPC error would otherwise expose.
- One more deploy target, marginally more latency (function → RPC → Storage API), Deno cold starts.

#### Recommendation: Option B, Edge Function

The deciding factor is that this codebase's constraints (`project-photos` stays private, no `anon` storage policies) make an elevated, server-side component **mandatory** for photos regardless of which option is chosen for the report metadata. Given that a service-role component must exist anyway, it should also own request shaping, error normalization, and be the single reviewable perimeter — which is exactly what the existing `delete-photo`/`delete-project` functions already do for their own concerns. The `SECURITY DEFINER` RPC is still the right place for the actual "is this token valid" authorization check (kept in SQL, next to the table it guards, consistent with `get_authorized_photo_storage_path`), it's just invoked *from* the Edge Function rather than *by* the browser.

### 3.4 Public client page

```
share.html                     — new, standalone static entry point
js/share/share-client.js       — its only JS file
```

Hard constraint, enforced by code review / lint, not just convention: `js/share/share-client.js` **must not import** anything under `js/projects/`, `js/navigation/`, `js/auth/`, or `js/database/db-projects.js` / `db-reports.js` / `db-photos.js` / `supabase-client.js`. None of the admin/lifecycle code should even be reachable from this page's dependency graph — not hidden by an `if`, physically absent from the bundle the client's browser loads.

The one deliberate exception: **`js/reports/report-renderer.js` may be imported directly.** It was already read in full during the investigation — it has zero imports and is a pure function (`renderReportHtml(report) -> string`) with no DOM, auth, or navigation coupling. Reusing it avoids re-implementing ~700 lines of report HTML/CSS templating for the client view, and keeps the two views (contractor preview, client share) pixel-identical by construction.

`share.html` layout:

- Its own minimal `<head>` — no `importmap` entries for `#projects/`, `#navigation/`, `#auth/`, `#config/`, `#state/`; only what `report-renderer.js` needs (nothing — it has no imports).
- `<meta name="referrer" content="no-referrer">` (see §3.7 on token placement).
- A single mount point, rendered as a **sandboxed same-document iframe** (`<iframe sandbox srcdoc="...">`) rather than `document.write`-ing the report HTML straight into the host page. `renderReportHtml()` already returns a complete standalone `<html>` document (it's designed to be opened as its own tab today); feeding it into a sandboxed iframe keeps it isolated from `share-client.js`'s own runtime even though, by design, that runtime has nothing sensitive in it — defense in depth costs nothing here.

`js/share/share-client.js` responsibilities, in order:

1. Read the token from `location.hash` (`#token=...`), **not** `location.search` (see §3.7).
2. If missing/malformed, render the same generic "Este link não está disponível." state used for every other failure mode — never a different message for "no token" vs "bad token" vs "expired."
3. `fetch(SHARE_FUNCTION_URL, { method: "POST", headers: { apikey: PUBLIC_ANON_KEY, "content-type": "application/json" }, body: JSON.stringify({ token }) })`. The anon key is not a secret (it's already shipped in `index.html` today); it identifies the calling project to Supabase's gateway, it does not grant data access — RLS/the definer RPC does that.
4. Non-200 → generic unavailable state, no further detail rendered or logged to the console.
5. 200 → response body is a report-document shape (the same shape `buildCurrentReportDocument()` produces, with `photos[].displayUrl` already populated with freshly-minted signed URLs) minus every id field (see §3.7). Pass it straight to `renderReportHtml()` and inject the resulting HTML string as the iframe's `srcdoc`.

No build step, no bundler changes: `share.html` can load `share-client.js` as a plain `<script type="module">` with a relative import (`import { renderReportHtml } from "./js/reports/report-renderer.js";`), sidestepping the need to touch the existing `#reports/` import-map alias at all.

### 3.5 WhatsApp flow

Contractor-side (inside the existing authenticated app):

1. A **"Criar link para cliente"** action (`data-report-action="create-share-link"`) appears next to a saved report — natural home is [js/reports/report-history.js](../../js/reports/report-history.js), where past reports and their `sentVia` metadata already live.
2. Click handler (new module, e.g. `js/reports/report-share.js`) calls a new, **authenticated** Edge Function `create-report-share-link` with `{ report_id }`, following the exact `delete-photo` pattern: bearer JWT → anon-key client resolves the user → service-role client calls a `SECURITY DEFINER` RPC.
3. The RPC, e.g. `create_report_share_link(p_report_id uuid, p_user_id uuid, p_ttl_hours int default 168)`:
   - Confirms `p_report_id` belongs to a project owned (directly or via company) by `p_user_id`, using the same ownership chain as `reports_select_own` — otherwise returns nothing / raises.
   - Generates the raw token itself (e.g. `encode(gen_random_bytes(32), 'base64')`) and inserts a row storing only `digest(token, 'sha256')`, so token generation and hashing happen atomically in one place and the raw value is never written to a table, only returned once as an `out` value.
   - Returns `{ token, expires_at }` to the Edge Function, which returns it to the browser.
4. Browser builds `https://<site-origin>/share.html#token=<token>` (fragment, not query — see §3.7).
5. Browser opens `https://wa.me/?text=<url-encoded message containing the link>` in a new tab, using the same `window.open` pattern already used by [report-preview.js](../../js/reports/report-preview.js). No phone number is hardcoded — `wa.me/?text=` opens WhatsApp's own chat picker so the contractor chooses the client.
6. UI also shows the raw link with a "Copiar link" button as a fallback for when WhatsApp Web/desktop isn't available.
7. Optionally, once the link is created, set `sentVia = WhatsApp` on the report automatically (today this is a manual dropdown; this flow makes it accurate by construction).

### 3.6 Default TTL

A default TTL (e.g. 7 days / `p_ttl_hours default 168`) is applied by the `create_report_share_link` RPC, per §3.5 step 3.

### 3.7 Security rules

- **Service role key lives only in Edge Function environments.** It is never sent to, or reachable from, browser code — same as today's `delete-photo`/`delete-project`.
- **The public key is never `project_id`/`report_id`.** The only credential the client-facing function accepts is the opaque token; UUIDs are never accepted as an alternate lookup key on the public endpoint.
- **`project-photos` bucket stays private.** Shared-view photos are served exclusively through signed URLs minted server-side, per request, by the Edge Function's service-role client — never by loosening bucket policy for `anon`.
- **Token strength.** Generated server-side with `gen_random_bytes(32)` (256 bits) — not derived from any predictable value (not a UUID, not report/project id, not a timestamp). Brute-forcing the token space is not a practical concern; the design does not rely on rate limiting for this property, though basic abuse protection (e.g. platform-level request throttling) is a reasonable Phase 6 addition.
- **Only the hash is stored** (`token_hash`), as detailed in §3.2 — a database leak alone cannot reproduce a working link.
- **One generic failure response.** Expired, revoked, not-found, and malformed-token all return the same status/body from `get-shared-report`. Distinguishing them server-side (for the contractor's own tooling later, if ever needed) is fine; leaking the distinction to the anonymous caller is not — it turns the endpoint into an oracle for guessing valid-but-expired vs. never-existed tokens.
- **Token goes in the URL fragment, not the query string.** `share.html#token=...` rather than `?token=...`. Fragments are never sent to the server in the HTTP request line, so they don't appear in static-hosting access logs, CDN logs, or `Referer` headers sent to third-party resources the page happens to load (this app already `preconnect`s to Google Fonts in `index.html`; `share.html` will likely do the same). `share.html` also sets `Referrer-Policy: no-referrer` as defense in depth. The token is still visible in browser history and inside the WhatsApp message itself — an accepted, inherent trade-off of link-based sharing, mitigated by short expiry and revocation, not eliminated.
- **The shared response is an explicit allowlist, not a filtered table row.** `get-shared-report` returns a report-document-shaped object with every internal id field stripped or nulled — no `report_id`, `project_id`, `company_id`, `client_id`, `owner_id`, or `created_by`. `renderReportHtml()` was confirmed (during the investigation) to only use `meta.reportId`/etc. to build a display-only slug (`buildReportId()` → `PROJ-CLIENTE-001`), never the underlying UUIDs — so nothing user-visible is lost by omitting them.
- **No lifecycle/admin affordances reach this page**, enforced structurally per §3.4 (the import boundary), not just visually — there is no CSS to "hide" a button that was never shipped to this page's JS in the first place.
- **`access_count`/`last_accessed_at` are informational only** (§3.2) — never used as a security gate (e.g. "only allow N views"); that would need its own explicit, documented product decision, not an implicit side effect of telemetry.

### 3.8 Testing plan

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
  With two seeded reports/links, confirm token A's response never contains any field identifying report B (no cross-report leakage), and confirm the response body contains none of `report_id`, `project_id`, `company_id`, `client_id`, `owner_id` — i.e. assert the field allowlist from §3.7 by inspecting the actual JSON, not just the rendered HTML.

All new specs should reuse the existing `.env`-driven credential pattern (`E2E_EMAIL`/`E2E_PASSWORD`, `SUPABASE_URL`/`SUPABASE_ANON_KEY`) already established in `rls-security.spec.js` and `payments-readonly-boundary.spec.js`, so no new test infrastructure is needed beyond a small helper for "create a share link for a given report as the test user."

### 3.9 Rollout plan

- **Phase 1 — Design (this document).** No code. Current phase.
- **Phase 2 — Data + access layer.** `report_share_links` table + its `authenticated`-only RLS policies; `create_report_share_link` and `get_shared_report` `SECURITY DEFINER` RPCs; `create-report-share-link` and `get-shared-report` Edge Functions. No UI changes yet — testable directly via `supabase-js`/`curl` against the deployed functions.
- **Phase 3 — Read-only renderer.** `share.html` + `js/share/share-client.js`, wired to the Phase 2 `get-shared-report` function using a manually-created token (no UI to create one yet). Verifies the render/import-boundary/photo-signing path end to end.
- **Phase 4 — WhatsApp link generation.** The "Criar link para cliente" action in the authenticated app (`js/reports/report-share.js`), calling `create-report-share-link` and building the `wa.me` deep link. This is the first phase a contractor can use unassisted.
- **Phase 5 — Tests.** The five specs in §3.8, plus updating any existing suite that enumerates all `data-*-action` attributes if one exists, so it stays honest about the new surface.
- **Phase 6 — Polish.** Revoke-link UI/action, "copiar link" fallback, nicer expired/revoked messaging, optional access-log table for the contractor's own visibility, basic abuse-rate protection — none of it security-load-bearing, all of it deferred without weakening §3.7.

### 3.10 Implementation notes (2026-08-28)

Built per §3.9 Phases 2-5, with two deliberate deviations from that plan and one open item before this is genuinely shippable:

**What was built:**
- **Phase 2:** [supabase/migrations/20260828120000_report_share_links.sql](../../supabase/migrations/20260828120000_report_share_links.sql) — `report_share_links` table, `select`-only RLS policy for authenticated owners (no insert/update/delete policy — all mutation goes through the two RPCs below), `create_report_share_link`, `get_report_by_share_token`, `revoke_report_share_link` (all `SECURITY DEFINER`, execute granted to `service_role` only). [supabase/functions/create-report-share-link/index.ts](../../supabase/functions/create-report-share-link/index.ts), [.../get-shared-report/index.ts](../../supabase/functions/get-shared-report/index.ts), [.../revoke-report-share-link/index.ts](../../supabase/functions/revoke-report-share-link/index.ts) — same bearer-JWT-then-service-role-then-RPC shape as `delete-photo`/`delete-project`.
- **Phase 3:** [share.html](../../share.html) + [js/share/share-client.js](../../js/share/share-client.js) — reads `#token=`, calls `get-shared-report`, renders into a sandboxed (`allow-scripts` only, no `allow-same-origin`) iframe via `renderReportHtml()`.
- **Phase 4:** [js/reports/report-share.js](../../js/reports/report-share.js) + UI in [js/reports/report-history.js](../../js/reports/report-history.js) — "Criar link para cliente" button per saved report, revealing a panel with the link, "Copiar link", a `wa.me` deep link, and "Revogar link". The optional step 7 in §3.5 (auto-setting `sentVia = WhatsApp`) was **not** implemented — it was marked optional, not an AC.
- **Phase 5:** all five specs from §3.8 under `tests/e2e/client-share-link-*.spec.js`, plus a seeding helper at `tests/e2e/helpers/report-share-test-helper.js`, plus the AC-04.2 static import-boundary check at [scripts/check-share-import-boundary.js](../../scripts/check-share-import-boundary.js) (wired as `npm run check:share-boundary`).

**Deviations from §3.9:**
1. **Revocation and "Copiar link" were built now, not deferred to Phase 6.** §3.9 listed "Revoke-link UI/action" and "copiar link fallback" under Phase 6 (Polish), but Section 2's own Scope and AC-02.5/AC-03.2 require both for v1. Treated Section 2 as authoritative over the older Phase 6 note.
2. **Token encoding uses base64url, not §3.5's literal example.** §3.5 said `encode(gen_random_bytes(32), 'base64')` as an "e.g."; standard base64 can contain `+`, `/`, `=`, which are valid but needless friction in a URL fragment / `wa.me` text param. The migration base64url-encodes instead (`translate` + strip padding) — same 256 bits of entropy, satisfies AC-01.5 unchanged.

**Not done — required before this can move past Claude's Engineering Gate:**
- **Nothing has been deployed or run.** No `supabase db push` / migration apply, no `supabase functions deploy` for the three new functions, no execution of the Playwright specs. This environment has no Docker and no Supabase CLI session — deploying is Gustavo's action to take (or explicitly hand back to Claude with deploy access).
- The five Playwright specs need env vars that don't exist in `.env` yet: `SUPABASE_SERVICE_ROLE_KEY`, `E2E_USER_ID`, `E2E_REPORT_ID` (a saved report with `snapshot_json` owned by that user), `E2E_SECOND_REPORT_ID` (optional, only the isolation spec needs it). Until those are set, all five specs report `skip`, not `pass`.
- The static import-boundary check **was** run locally and passes today (`node scripts/check-share-import-boundary.js`), as does the existing `check:migration` guard — neither needed deployment.
- Definition of Done in §2 is therefore **not** met yet: written ≠ passing. Do not mark this Released or update `features-catalog.md` until the specs have actually run green against a deployed environment.

## 4. Verification — ChatGPT

*Pending.* No implementation has been deployed or exercised yet — see §3.10.

## 5. Product Validation — Gemini

*Pending.*

## 6. CEO Decision — Gustavo

Decision: GO — proceed to Phase 2 implementation now.
Reason: Sections 1-3 are sound; Gustavo made the call directly rather than waiting for a formal Gemini Value Gate / ChatGPT Definition Gate pass. No real-role sign-off is on record — this is a CEO override of the Full Gate Path sequencing, not a substitute for those reviews.
Date: 2026-08-28
Next action: Build per §3.9 Phase 2 onward. Real Gemini/ChatGPT gate passes remain open — see carry items in `CLAUDE.md` Project State.

## Decision Log

* **2026-08-28** — Gustavo: skip formal Value Gate / Definition Gate sign-off, proceed straight to implementation. Recorded here so the gap is traceable rather than silently absent.
