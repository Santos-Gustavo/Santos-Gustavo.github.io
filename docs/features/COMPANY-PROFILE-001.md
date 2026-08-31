# COMPANY-PROFILE-001

Status: **Implemented, Tested.** Trial-readiness / data-model correction — this is a bugfix, not a feature build. It removes company creation from the project-creation flow and gives the user one editable company profile instead. All 5 new Playwright specs pass, plus the full pre-existing suite (40/40 total).

Risk: Low, but the bug it fixes was live and active — see §2. No RLS change, no service-role use in browser code, no schema change (every field this needed already existed on `companies`).

**The rule this feature enforces:** One primary company per user for MVP validation. Project creation must not duplicate companies.

### Key Files

| Path | What it owns |
|---|---|
| `js/company/company-profile.js` | The canonical "one company" resolver and mutator: `loadPrimaryCompanyIntoState()` (boot-time load into `appState`), `resolvePrimaryCompanyId()` (async-safe accessor — see §3's race-condition note), `populateCompanyForm`/`getCompanyFormValues`, `saveCompanyProfileFromForm()` (create-once-if-none, update-in-place otherwise — never a name/nif match). |
| `js/company/company-index.js` | `initCompanyProfile()` — click delegation for `[data-company-action]` (save/cancel) and `openCompanyProfilePage()` (nav entry + the one-time first-run setup gate). |
| `js/database/db-companies.js` | `loadPrimaryCompany()`, `createCompanyProfile()` (straight insert, replaces the old `findOrCreateCompany` — deleted, see §2), `updateCompanyById()` (now also writes `address`). `loadCurrentUserCompanies()` unchanged. |
| `index.html` | `#step1` renamed and repurposed to `#step-company` ("Dados da Empresa") — fully removed from the project-creation step chain. Added `#companyAddress` field and `#companyFirstTimeNotice`. Added the "🏢 Dados da Empresa" button on the Projetos home step next to "+ Novo Projeto"/"👤 Clientes". `#step2` ("Dados do Projeto") is now reached directly — no more two-step "Configuração 1/2 de 2" framing. |
| `js/navigation/navigation.js` | Removed the old `cur === 1` step entirely from `goNext()`/`goBack()`; added the `"company"` step id to `updateTopBar`/`goBack`; added the `open-company-profile` nav action. |
| `js/projects/project-selection.js` | `newProject()` now `await`s `resolvePrimaryCompanyId()` before proceeding — gates into the one-time company-setup screen if none exists yet (`appState.pendingNewProjectAfterCompanySetup`), otherwise goes straight to the project-fields step, always attaching to `appState.primaryCompanyId` (never a possibly-stale `currentCompanyId`). `editProject()` also now goes straight to the project-fields step instead of the old company step. |
| `js/projects/project-save.js` | No longer calls `findOrCreateCompany`/`updateCompanyById` at all. Uses `appState.primaryCompanyId` for new projects, `appState.currentCompanyId` (set by `editProject()`) for edits. |
| `js/reports/report-save.js` | Its legacy fallback path (used only when `appState` has no project/client/company id at all) now attaches to `appState.primaryCompanyId` instead of calling the deleted `findOrCreateCompany`. |
| `js/reports/report-document-builder.js` | The report snapshot's `company` block now prefers `appState.currentCompany` (the live cached profile) over DOM-scraped form values, so an edit to company data shows up in the next report generated (REQ-04) even if the user never re-visits the "Dados da Empresa" screen that session. |
| `js/state/app-state.js` | Added `primaryCompanyId` (session-durable, set once at boot, never reset by project selection/edit/archive), `currentCompany` (cached full row), `pendingNewProjectAfterCompanySetup`. `currentCompanyId` stays as a per-selection display value (see §3). |
| `js/clients/client-list.js` | `resolveActiveCompanyId()` now delegates to `resolvePrimaryCompanyId()` instead of duplicating the "which company" resolution logic that CLIENT-MANAGEMENT-001 had built independently. |
| `js/auth/auth.js` | `showLoggedInUI()` now calls `loadPrimaryCompanyIntoState()` right after login (REQ-01: load on boot). |
| `tests/e2e/company-profile.spec.js` | New — the 5 REQ-06 specs, using the service-role client (`tests/e2e/helpers/supabase-admin.js`) to assert on actual `companies` row counts and `company_id` values, not just UI state. |
| `tests/e2e/{project,client,report}-*.spec.js` | 13 existing specs updated: removed the "fill 7 company fields, click next" block that used to sit between clicking "Novo Projeto" and filling project fields — that step no longer exists. |

## 1. Why this exists

The app already had a proper relational company/project schema (`projects.company_id → companies.id`) — but the project-creation UI never used it as a foreign-key relationship in practice. Every "Novo Projeto" re-asked for the full company profile from a blank form and ran it through a name-or-nif match that was supposed to find the existing row. It didn't reliably do that.

## 2. Root cause (schema findings + duplicate evidence)

`companies` already has every field REQ-02 needed (`name, nif, impic, responsible, phone, email, address, ...`) — **no migration was required**.

The bug was entirely in `db-companies.js`'s old `findOrCreateCompany(values)`:

```js
let query = supabaseClient.from("companies").select("*").eq("owner_id", user.id).limit(1);
if (nif) { query = query.eq("nif", nif); } else { query = query.eq("name", name); }
const { data: existing } = await query.maybeSingle();
// ... update if existing, else insert
```

This is a read-then-write with no uniqueness constraint backing it and no transaction — a classic TOCTOU (time-of-check to time-of-use) bug. Any of the following silently produced a brand-new company row instead of reusing the real one: leaving NIF blank on one project when it was filled on another (switches the match from nif to name), a retyped name with different case/whitespace, or two calls racing each other (the read on call B happens before call A's write commits).

**Live evidence, read directly from the DB before any fix was applied:** one real test-owner account had **9 company rows**, 7 of them sharing the identical NIF `509123456` — proof the nif-match path itself was failing to reconcile rows that should have been one company. `appState.currentCompanyId` also confirmed the diagnosis independently: it was never loaded at boot, only ever set as a side effect of a project already having been created or selected.

```
Owner 62daa10f-...: 9 companies (7 share nif 509123456, 2 more with no nif)
```

## 3. The fix, and the race condition it surfaced

`findOrCreateCompany` is deleted. In its place: `loadPrimaryCompany()` (oldest company row by `created_at` — deterministic, no matching heuristic) loaded once at login into `appState.primaryCompanyId`/`appState.currentCompany`; `createCompanyProfile()` is a straight insert, only ever called once, when `loadPrimaryCompany()` has already confirmed zero companies exist. Editing goes through `updateCompanyById()` only — never insert.

Project creation (`newProject()`) attaches new projects to `appState.primaryCompanyId` exclusively, never to whatever `appState.currentCompanyId` happens to hold — that field is left as the per-session "company relevant to whatever's currently loaded" value (e.g. `selectProject()`/`editProject()` still set it to that specific project's own `companyId`, which matters if any of the pre-existing duplicate/legacy projects get edited — editing one does **not** silently reassign its `company_id`; only new project creation is guaranteed to hit the primary).

**A genuine bug was caught during implementation, not just a stale test:** `showLoggedInUI()` flips `#appShell` to visible synchronously, then kicks off `loadPrimaryCompanyIntoState()` asynchronously. A user (or a fast test) clicking "Novo Projeto" immediately after the login screen disappears could see `appState.primaryCompanyId` still `null` — not because no company exists, but because the load hadn't resolved yet — incorrectly triggering the "first company setup" screen for an existing user. Fixed by making `newProject()` `await resolvePrimaryCompanyId()` (which loads-and-caches if not already resolved) rather than reading a synchronous flag. This was caught by the first real test run against the live app, not by inspection.

## 4. What "Dados da Empresa" looks like

The old step-1 "Empresa" screen (already had every needed field) was repurposed wholesale into `#step-company`, fully removed from the project-creation chain — reached only via the "🏢 Dados da Empresa" button on the Projetos home screen, or automatically (once) the first time a brand-new user clicks "Novo Projeto" with no company yet (`appState.pendingNewProjectAfterCompanySetup` chains straight into project creation after that one-time save). Project creation (`#step2`, "Dados do Projeto") no longer shows or asks for any company field at all — company data there is display-only, surfacing through the existing read-only review-step rows (`js/projects/sections/review.js`'s "Empresa" section), which already existed and needed no change.

## 5. Reports (REQ-04)

`report-document-builder.js`'s snapshot now sources `company.name/nif/impic/responsible/phone/email` from `appState.currentCompany` first, DOM values as fallback. Verified end-to-end by `company-profile.spec.js`'s last test: edit the company name → create a project → generate a weekly report → the review screen shows the **new** name. Existing saved report snapshots are untouched — nothing in this change touches `reports.snapshot_json` after the fact, so past reports/share links keep showing whatever company data was live at the time they were generated, unchanged, exactly per REQ-04.

## 6. Duplicate-company cleanup (REQ-05 — reported, not executed)

No automatic cleanup was run, and none should be from app code. For the one owner with 9 rows (7 sharing NIF `509123456`, plus `Fixture Contractor Lda` and `SMOKE Test Company`), a safe manual cleanup — **only after confirming with whoever owns that Supabase project that these are disposable test artifacts** — would be:

```sql
-- 1. Inspect first — confirm these are all test/fixture rows, not real data.
select id, name, nif, created_at
from companies
where owner_id = '62daa10f-4397-42df-ab77-1aea49b935d1'
order by created_at;

-- 2. Confirm none of the "extra" rows have projects attached before deleting
--    (the FK is ON DELETE RESTRICT, so this select is redundant safety, not
--    strictly required — a delete on a referenced row will fail loudly instead
--    of cascading).
select company_id, count(*) from projects
where company_id in (/* ids to delete */)
group by company_id;

-- 3. Only once step 2 confirms zero projects reference them, delete the
--    specific extra rows by id (never a bulk "keep the oldest" delete without
--    having read the list in step 1 first).
delete from companies where id in (/* specific ids, chosen after review */);
```

This is intentionally left as a reviewed, manual, one-time operation — not something this feature automates.
