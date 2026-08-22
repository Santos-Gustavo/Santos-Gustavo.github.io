# Feature Catalog — What's Actually Shipped

Gemini checks new ideas against this before evaluating them, to catch duplication, conflicts, or drift from the real product — not just the vision statement. This describes the product **as it exists in production today**, not what's planned (`roadmap.md`) or why it exists (`vision.md`).

Update this file whenever a feature's `INDEX.md` row moves to **Released**. One short block per feature — link to the `FEATURE-ID.md` for detail, don't duplicate it here. Delete/rewrite an entry if the underlying capability is removed or materially changed (don't leave stale entries).

---

## Auth & Companies
- Email/password auth (Supabase Auth), password reset flow (`reset-password.html`).
- Multi-tenant: every contractor's data (`projects`, `clients`, `reports`, `photos`, `payments`) is scoped to their own `company`/`owner_id` under RLS — `to authenticated` policies only, no cross-tenant access.

## Projects (`projeto` — renamed from `obra`)
- Create, edit, and manage renovation projects for a client.
- Lifecycle states: **Em curso (active) → Pausada (paused) → Concluída (completed) → Arquivada (archived)**, plus an independent **hidden** visibility flag. Transitions are rule-gated (`js/projects/project-status-rules.js`) — e.g. only an active project can be paused, only certain states allow archiving.
- Closure reasons on completion/archive: completed, cancelled, abandoned, disputed, transferred, other.
- Archived projects are **read-only**: no new photos, no edits, evidence stays visible but frozen (see `tests/e2e/project-archived-*.spec.js`).

## Reports
- Two report types per project: **weekly progress report** and **legal/financial report** (gated by project state — see `canCreateWeeklyReport`/`canCreateLegalFinancialReport`).
- Report content covers: work performed in the period, photo evidence, incidents/non-conformities, and financial/payment status.
- Reports are generated client-side as a self-contained HTML document (`js/reports/report-renderer.js`) and opened as a local blob URL — **not currently a shareable link** (see `CLIENT-SHARE-LINK-001`, in design, which addresses this gap).
- Report history per project (`js/reports/report-history.js`), with a `sentVia` field recording how the contractor says they delivered it (WhatsApp today is metadata only — no link is actually sent by the app yet).

## Photos / Project Evidence
- Photo upload per project, stored in a private Supabase Storage bucket (`project-photos`), served only via short-lived (1hr) signed URLs — never public.
- Photo evidence remains attached and visible on archived (read-only) projects.

## Clients
- Create/find/update clients per company (`js/database/db-clients.js`); reports and projects are linked to a client.

## Payments
- Eupago payment integration (`js/payments/payment.js`, `eupago-webhook` Edge Function) for recording/processing payments against a project.

## Client-Facing Sharing — *in design, not shipped*
- No public/client-facing view exists yet. See `docs/features/CLIENT-SHARE-LINK-001.md` for the design of a token-based, read-only, expiring share link for a single report — the planned fix for "reports can't leave the browser tab that generated them."

---

## Explicitly NOT in the product
- No client login/account (by design intent — WhatsApp-first, no-friction target user, per `vision.md`).
- No mobile app — responsive web only.
- No multi-user-per-company / team roles yet — one owner per company.
