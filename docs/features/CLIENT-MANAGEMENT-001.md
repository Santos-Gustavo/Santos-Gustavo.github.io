# CLIENT-MANAGEMENT-001

Status: **Implemented, Tested.** Trial-readiness scope only — a client directory with search, create/edit, archive, and zero-history hard delete, plus a non-breaking upgrade to the project-creation client field. This is explicitly **not a CRM**: no notes, messaging, contact history, invoicing, tagging, merge, or import/export. All 10 required Playwright specs pass, plus the full pre-existing suite (35/35).

Risk: Low. No new public/unauthenticated surface, no RLS changes, no service-role use in browser code. The riskiest part of this feature — a client being hard-deleted while projects/reports/photos/share-links still reference it — was already closed at the DB level before this feature existed (`projects_client_company_fkey` is `ON DELETE RESTRICT`); this feature adds the app-layer guardrail and UI on top of that existing backstop.

Preservation rule: deleting or archiving a client must never destroy project, report, photo, or share-link evidence. Hard delete is only reachable for a client with zero linked projects; everything else is archive (`archived_at`), never cascade-delete.

### Key Files

| Path | What it owns |
|---|---|
| `js/database/db-clients.js` | All client DB access: `loadClientsForCompany`, `loadClientDirectoryForCompany` (clients + per-client project count), `createClient`, `updateClientRecord`, `archiveClientById`/`unarchiveClientById`, `deleteClientById` (zero-history pre-check + Postgres `23503` FK-violation fallback, both raising the exact Portuguese guardrail message), `countActiveProjectsForClient`. Also still owns `findOrCreateClient`/`updateClientById`, the project-creation-flow functions from before this feature (now excluding archived clients from the name-match). |
| `js/mappers/client-mapper.js` | Snake_case DB row → camelCase app client object, mirrors `project-mapper.js`. |
| `js/clients/client-list.js` | Renders the Clientes directory (`renderClientList` = full DB reload, `renderClientListFromCache` = cheap re-render for search/filter), the Ativos/Arquivados tabs, and `populateClientNameOptions()` (fills the project-creation `<datalist>` with active clients only). |
| `js/clients/client-form.js` | Show/hide + populate the in-page create/edit form panel (`#clientFormPanel`). |
| `js/clients/client-actions.js` | Save (create vs. update), archive, unarchive, delete flows — each resolves the active company, confirms destructive actions, and surfaces DB errors via `alert`. |
| `js/clients/client-index.js` | `initClients()` — single delegated click handler for all `[data-client-action]` buttons; `openClientsPage()` called on nav into the Clientes step. |
| `index.html` | `#step-clients` (new sibling step to `#step-projects`/`#step-mode`), the "👤 Clientes" nav button on the Projetos home step, and the `<datalist id="clientNameOptions">` wired to the existing `#clientName` project-creation input via `list=`. |
| `js/navigation/navigation.js` | `data-nav-action="open-clients"` handler, `"clients"` cases in `updateTopBar`/`goBack`, and the `populateClientNameOptions()` call right before advancing from step 1 to step 2. |
| `styles.css` | `.client-status-badge`/`--archived`, `.client-form-panel`/`.active`, `.client-form-actions`. Everything else (cards, filter tabs, buttons, fields) reuses the existing `.project-card`/`.project-filter-btn`/`.btn-project-edit`/`.btn-project-archive`/`.field` classes verbatim — no new visual language was introduced. |
| `tests/e2e/client-directory.spec.js` | Directory req. tests 1–6: logged-out visibility, open Clientes, create, edit, search-by-name/phone, linked-project-count display. |
| `tests/e2e/client-guardrails.spec.js` | Guardrail req. tests 7–9: blocked hard-delete + exact Portuguese message on a client with a project, zero-history delete, archived client hidden from the active list and the new-project `<datalist>`. |

## 1. Why this exists

Contractors already had `clients` and `projects.client_id` in the schema (built for CLIENT-SHARE-LINK-001's report delivery flow) but no UI to manage clients directly — client records could only be created/updated as a side effect of typing a name into the project-creation form. Before field trials, contractors need to see who their clients are, fix a typo'd phone number, and retire a client who's no longer active — without any risk of that action silently destroying the project/report history tied to them.

## 2. What was already in place (schema investigation, before any code was written)

The live schema (`supabase/manual/live_schema_rls_baseline.sql`) already had everything this feature needed:

- `clients.archived_at` and `clients.deleted_at` — both nullable, already present. No `is_archived` boolean was added; archived state is `archived_at IS NOT NULL`, the same convention already used for `projects.archived_at`.
- `clients.nif` and `clients.address` — already present, already wired into `findOrCreateClient`/`updateClientById`.
- `projects_client_company_fkey`: `projects(client_id, company_id)` → `clients(id, company_id)` `ON DELETE RESTRICT`. The database itself already refuses to hard-delete a client with a project attached — this feature's delete guard is a friendlier app-layer message in front of that existing backstop, not a new safety mechanism.
- RLS: `clients_select_own`/`insert_own`/`update_own`/`delete_own`, all scoped to `companies.owner_id = auth.uid()`. Unchanged by this feature.

**No migration was written.** Phase 1 (schema inspection) concluded no schema changes were required.

## 3. What this feature added

- **Directory** (`#step-clients`, reached via a "👤 Clientes" button on the Projetos home screen — the app has no separate top-level nav bar, so the home screen is where a new top-level destination lives): searchable list (name/phone, instant client-side filtering), Ativos/Arquivados tabs, linked-project count per card.
- **Create/edit**: an in-page form panel (no modal exists anywhere in this app; this follows that precedent) with name (required), phone, email, NIF, address.
- **Archive**: sets `archived_at`; hidden from the active list and from the project-creation client suggestions; a `Reativar` action clears it back to `null`. Never touches `deleted_at`, never cascades.
- **Delete**: always offered per client, but blocked with the exact required message when `projectCount > 0` — the button is deliberately not hidden in that case, so the guardrail is a real, testable code path rather than a UI omission. Zero-history clients delete for real (`DELETE FROM clients ...`), which is fine because they have nothing depending on them; a would-be race (a project attached between the count-check and the delete) is caught by the existing FK `RESTRICT` and re-surfaced as the same message.
- **Project creation** (`#clientName` in step 2): still a plain text input — kept that way deliberately (see §4) — now backed by a `<datalist>` of the current company's *active* clients, refreshed each time step 1 → step 2 advances. Typing an existing active client's name still resolves to that client (`findOrCreateClient`, unchanged); typing a new name still quick-creates one. Typing an *archived* client's exact name no longer silently reactivates it — `findOrCreateClient` now also filters on `archived_at IS NULL`, so that creates a fresh client record instead.

## 4. Why `#clientName` stayed a text input

`findOrCreateClient` matches purely by `(company_id, name)` — there was never a real `client_id` selector anywhere in the project-creation flow, and 12 existing Playwright specs (`project-lifecycle`, `project-edit`, `project-persistence`, `weekly-happy-path`, `project-hide-archived`, `project-complete-archive`, `project-archived-*`, `rls-isolation`, `report-persistence`) all do `page.locator("#clientName").fill(...)` against that exact element id. Swapping it for a `<select>` would have broken every one of them for a requirement ("replace/augment... whichever matches existing app patterns best") that explicitly allows augmenting instead of replacing. A `<datalist>` gives real autocomplete/selection of active clients, degrades to nothing if JS hasn't populated it yet, and is fully backward-compatible with `.fill()` — all 35 tests (25 pre-existing + 10 new) pass unmodified.

The one real limitation this trade-off leaves: the datalist suggestions come from whichever company is currently resolved (`appState.currentCompanyId`, falling back to the user's first company) rather than the not-yet-saved company being typed into step 1. For the overwhelming majority of users — one contractor, one company — this is a non-issue; it's called out here rather than silently glossed over.

## 5. Guardrail test evidence (§ "Tests required" in the original brief)

All 10 map directly onto `tests/e2e/client-directory.spec.js` and `tests/e2e/client-guardrails.spec.js`; item 10 ("existing project/report/share-link tests still pass") was verified by running the entire suite, not just the new specs — `npx playwright test` → **35 passed**, zero regressions.

## 6. Explicitly out of scope (per the original brief, and worth restating so nobody "helpfully" adds it later)

CRM notes, client messaging, client portal/login, contact history, invoice/payment history, duplicate merge, bulk import/export, tags. If any of these get requested later, they're a new feature, not an extension of this one.
