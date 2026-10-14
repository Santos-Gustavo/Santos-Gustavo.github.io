# Data Lifecycle Design — Admin Export + Privacy Purge

2026-10-13 · Branch `marketing_updates` · **Design only — nothing implemented.** Status: PENDING REVIEW (destructive production operation → human-owner approval and independent review required before any implementation).

Inputs: Phase 2A docs (RETENTION-MATRIX, DATA-RIGHTS-RUNBOOK, SECURITY-TOMS, OPEN-DECISIONS), migrations in `supabase/migrations/`, the live-schema snapshot `supabase/manual/live_schema_rls_baseline.sql`, Edge Functions, app code (`js/database/*`), and the test teardown (`tests/e2e/helpers/e2e-fixtures.js` `deleteProjectsDeep`).

Labels: **CONFIRMED** (proven by repo source) · **UNVERIFIED** (referenced in repo, definition only in the live DB) · **NEEDS DASHBOARD CHECK** · **PROPOSED** (this design).

## 0. Product decisions applied (from the brief)

| Decision | Effect on this design |
|---|---|
| Stop collecting new client email/NIF/address later; no schema change now | Export/purge must still cover these columns (`clients.email`, `.nif`, `.address`) |
| Worker name stays optional internal data | Present in `project_photos.worker`, legacy `photos.worker`, report snapshots — covered by purge |
| Archive reason → optional later | `projects.closure_reason`, `project_status_events.reason/note` — covered |
| Hidden projects recoverable later | No effect on purge; export includes `hidden_at` rows |
| Normal photo "Remover" stays soft | Purge ignores `deactivated_at` — deactivated rows and their files are purged like live ones |
| Privacy purge must really delete storage | Storage deletion is a first-class step with independent verification (§4) |
| Privacy purge may delete historical reports | Whole-report deletion, no redaction (§6) |
| Admin-operated export/deletion at launch | CLI + service-role SQL functions, no UI (§5) |
| Payments disabled | Payment rows are a **blocker** in the purge plan, not silently deleted (§3.4) |

---

## 1. Data model relevant to deletion

### 1.1 Tables and foreign keys

| Table | Parent FK → on delete | Other FKs | Source | Personal data |
|---|---|---|---|---|
| `auth.users` | — | Supabase-managed children (identities, sessions, refresh tokens) | Platform | Email, auth metadata |
| `companies` | `owner_id → auth.users` **CASCADE** | — | baseline snapshot · CONFIRMED | Name, NIF, IMPIC, responsible, phone, email, address, notes, `logo_url` |
| `clients` | `company_id → companies` **CASCADE** | unique `(id, company_id)` | baseline · CONFIRMED | Name, phone, email, NIF, address, notes |
| `projects` | `company_id → companies` **CASCADE** | `(client_id, company_id) → clients` **RESTRICT** | baseline · CONFIRMED | Name, site address, contract no./value, internal notes, closure reason |
| `project_status_events` | `project_id → projects` **CASCADE** | `changed_by → auth.users` **NO ACTION** | baseline · CONFIRMED | reason, note, `snapshot_json` |
| `project_status_state` | `project_id → projects` **CASCADE**; `company_id → companies` **CASCADE** | — | `20260908120000` · CONFIRMED | phase, summary |
| `project_work_items` | `project_id → projects` **CASCADE** | `first_report_id → reports` **SET NULL** | `20261005120000` · CONFIRMED | description, area |
| `project_incidents` | `project_id → projects` **CASCADE** | — | `20261005120000` · CONFIRMED | description |
| `project_photos` | `project_id → projects` **CASCADE** | — | `20261005120000` · CONFIRMED | `storage_path`, area, description, worker |
| `project_work_item_status` | `project_id → projects` **CASCADE** | `source_report_id → reports` **SET NULL** | `20260907120000` · CONFIRMED | `desc` |
| `reports` | `project_id → projects` **CASCADE** | — | baseline · CONFIRMED | `snapshot_json` (company profile, client name, site, photos, works…), legacy columns (`works`, `incidents`, `distributed_to`, `financial_note`…), `pdf_url`/`pdf_storage_path` (unused by current code) |
| `photos` (legacy) | `report_id → reports` **UNVERIFIED** (DDL not in repo) | — | RLS policies in baseline; columns inferred from `js/database/db-photos.js` | `storage_path`, area, description, worker |
| `report_share_links` | `report_id → reports` **CASCADE** | `created_by → auth.users` **NO ACTION** | `20260828120000` · CONFIRMED | access telemetry (`access_count`, `last_accessed_at`), `token_hash` |
| `payments` | `company_id → companies` **CASCADE** | — | baseline · CONFIRMED | amounts, EuPago refs, `raw_create_response`, `raw_webhook_payload` |
| `storage.objects` (bucket `project-photos`) | **no FK** to any app table | `owner` column — FK to `auth.users`? **NEEDS DASHBOARD CHECK** | Platform | Photos, logos |

No other public tables were found in migrations, the baseline or app code (`.from("…")` calls).

### 1.2 RLS implications (CONFIRMED)

- Every user policy keys on `companies.owner_id = auth.uid()`. **Once the `companies` row is gone, the user can no longer insert or read anything**, including uploads: storage policies also require `companies.id = first path segment AND owner_id = auth.uid()`. The purge relies on this for its ordering (§4.3).
- Workspace tables (`project_work_items`, `project_incidents`, `project_photos`) have **no DELETE policy** (`20261006120000`); `report_share_links` has select-only. So deletion **must use the service role** (RLS bypass), not the user's session.
- `guard_report_snapshot` fires on `INSERT OR UPDATE` only. It does **not** block `DELETE` of reports. The `SET NULL` cascades update `project_work_items`/`project_work_item_status`, not `reports`, so the guard is not triggered by them.
- `prevent_report_insert_on_deleted_project` is insert-only (trigger in baseline; body UNVERIFIED).

### 1.3 Storage layout (CONFIRMED from `js/database/storage-service.js` and DB triggers)

Single bucket `project-photos`. First path segment = `company_id` (storage RLS keys on it).

| Path | Written by | Referenced from |
|---|---|---|
| `{company_id}/{project_id}/workspace/{file}` | Estado da Obra upload | `project_photos.storage_path`; report `snapshot_json.photos[].storagePath` |
| `{company_id}/{project_id}/reports/{report_id}/{file}` | Legacy report wizard | legacy `photos.storage_path`; `project_photos.storage_path` (migrated legacy shape allowed by `enforce_project_photo_storage_path`); report snapshots |
| `{company_id}/company/logo-{uuid}.png` | Company logo upload; never overwritten or deleted | `companies.logo_url` (current only); `snapshot_json.company.logoPath` (any historical version) |

Guarantees useful to purge (CONFIRMED by triggers):
- Report snapshots can only reference photos under **their own** `{company_id}/{project_id}/` and logos under **their own** `{company_id}/company/`. **A project purge can never break another project's report, and a company purge never touches another company's files.**
- Logos are company-scoped and may be referenced by reports of **any** project in that company.

---

## 2. Deletion dependency graph

```
auth.users
 ├─(CASCADE)─ companies ─┬─(CASCADE)─ clients ◄──(RESTRICT)── projects
 │                       ├─(CASCADE)─ payments
 │                       ├─(CASCADE)─ project_status_state
 │                       ├─ logo files {company_id}/company/*          (storage, no FK)
 │                       └─(CASCADE)─ projects ─┬─(CASCADE)─ project_status_state
 │                                              ├─(CASCADE)─ project_status_events ──(NO ACTION)─► auth.users (changed_by)
 │                                              ├─(CASCADE)─ project_work_items ──(SET NULL)─► reports
 │                                              ├─(CASCADE)─ project_work_item_status ──(SET NULL)─► reports
 │                                              ├─(CASCADE)─ project_incidents
 │                                              ├─(CASCADE)─ project_photos ── files {c}/{p}/workspace|reports/*
 │                                              └─(CASCADE)─ reports ─┬─(CASCADE)─ report_share_links ──(NO ACTION)─► auth.users (created_by)
 │                                                                    ├─(UNVERIFIED)─ photos (legacy) ── files {c}/{p}/reports/{r}/*
 │                                                                    └─ snapshot_json → photo paths + logo path (no FK)
 └─ storage.objects.owner (FK? NEEDS DASHBOARD CHECK)
```

### 2.1 Scope A — client

A client cannot be deleted while any project references it (`RESTRICT`, and `projects.client_id` is NOT NULL). So **client purge = purge all of the client's projects, then the client row.** Detaching a project from a client, or anonymising the client in place, is not supported by the schema without a later decision.

| Resource | Behaviour | Storage cleanup | Report dependency | Order |
|---|---|---|---|---|
| Projects with `client_id = X` | Must be deleted explicitly (RESTRICT) | Yes, per project prefix | Yes: their reports are deleted | 1 (run Scope B per project) |
| Reports in **other** projects whose `snapshot_json.project.clientId = X` | Possible if a project's client was changed after reports were generated (snapshot keeps the old `clientId`/`clientName`) | Not for files: their photos belong to the other project | Yes: these reports contain the client's name | Plan reports them as a **blocker for manual decision**; never auto-deleted |
| `clients` row | Hard delete after projects are gone | — | — | 2 |
| Free-text mentions in other projects (notes, descriptions) | Not systematically findable | — | — | Plan lists name-match **candidates** for manual review only |

### 2.2 Scope B — project

| Resource | FK behaviour | RLS | Storage | Report dependency | Order |
|---|---|---|---|---|---|
| `report_share_links` of the project's reports | CASCADE from reports | select-only for users; service role required | — | Links stop resolving | 1. revoke (`revoked_at = now()`), then removed by cascade at step 3 |
| legacy `photos` of the project's reports | UNVERIFIED | user policies via report→project→company | `{c}/{p}/reports/**` | Referenced by legacy reports | 2. explicit delete (does not rely on cascade) |
| `reports` | CASCADE from project | — | (via photos/snapshots) | **Deleted** (§6) | 3 (via project delete) |
| `project_status_state`, `_events`, `_work_items`, `_incidents`, `_photos`, `_work_item_status` | CASCADE from project | workspace tables have no DELETE policy | `project_photos` → `{c}/{p}/workspace/**` (and migrated `reports/**` paths) | Snapshots copied paths, not FKs | 3 (via project delete) |
| `projects` row | Hard delete | — | — | — | 3 |
| Files under `{company_id}/{project_id}/` | No FK; **prefix delete** (§4) | service role | **Yes, the entire prefix**, including deactivated ("Removido") photos and unreferenced uploads | — | 4, after DB commit |
| Company logos | **Not touched**: shared by other projects' reports | — | No | — | — |

### 2.3 Scope C — company / account

Target = an **auth user id**; the plan enumerates **all** companies with `owner_id = user_id` (`owner_id` is not unique, CONFIRMED: test owners have several).

| Step | Resource | Notes |
|---|---|---|
| 0 | Blocker checks | `payments` rows exist → STOP (§3.4). `project_status_events.changed_by = user` or `report_share_links.created_by = user` **outside** the user's companies → STOP (would block auth deletion under NO ACTION; should be 0) |
| 1 | Ban the auth user and sign out sessions | Prevents new sign-ins. Already-issued JWTs stay valid until expiry (NEEDS DASHBOARD CHECK: JWT expiry); step 3 makes them harmless |
| 2 | Revoke all active share links of all the user's reports | Immediate end of public exposure, even if later steps fail |
| 3 | One DB transaction per account: delete legacy `photos` → `projects` (cascades the workspace tables, reports and links) → `clients` → `project_status_state` leftovers → `companies` | Explicit order avoids depending on the order of cascades across `RESTRICT` (UNVERIFIED whether a single `delete from companies` succeeds when projects→clients is RESTRICT; the explicit order makes this moot) |
| 4 | Storage: delete everything under each `{company_id}/` (photos **and all logo versions**) | Prefix-based (§4) |
| 5 | Verify: DB counts = 0 for all tables; storage prefix list = empty | Failure → stop, report, re-runnable |
| 6 | `auth.admin.deleteUser(user_id)` (hard delete, **last**) | Then verify `getUserById` → not found |
| 7 | Final verification and purge record | §5.4 |

---

## 3. Specific hazards

### 3.1 Deletion hazards
1. **Storage is not cascaded** (CONFIRMED). Every DB-only deletion orphans files (photos, logos). The existing E2E teardown already leaves logos behind because it never deletes `{c}/company/*`.
2. **"Remover" photos are still rows with files.** A purge that only looks at "live" rows (`deactivated_at is null`) would leave removed photos behind. The purge ignores soft-state flags.
3. **Path discovery from DB rows is incomplete.** Uploads that failed before their row was inserted, replaced logos, and legacy paths only in snapshots all exist only in storage. Hence prefix listing is authoritative (§4).
4. **`storage.remove()` reports success for missing paths.** The existing `delete-project` counts `batch.length` as "deleted" (CONFIRMED in source): it infers success. The purge must re-list.
5. **Wrong-target deletion.** Mitigated by dry-run plan, typed confirmation and plan-hash check (§5).
6. **Concurrent writes during purge.** A still-signed-in user could upload between steps. Mitigated by ban, DB delete **before** storage (after which RLS denies all uploads) and a final re-list.
7. **Auth deletion blocked or partial**: NO ACTION FKs (`changed_by`, `created_by`) and possibly a `storage.objects.owner` FK (NEEDS DASHBOARD CHECK). Auth is deleted last, after verification, so a block leaves a deleted-data, banned-user state that is safe and retryable.
8. **Payments cascade silently** with the company. Accounting retention may require keeping them (legal review): blocker.
9. **Reports outside the project referencing a client** (§2.1). They are reported, never auto-deleted.
10. **Irreversibility.** Storage deletes cannot be rolled back. Provider backups are the only undo (§7).

### 3.2 Order change vs Phase 2A runbook
DATA-RIGHTS-RUNBOOK.md suggested "storage first, then auth delete (cascade)". This design **reverses** it to DB first (explicit, one transaction), then storage, then auth, because:
- once the company row is gone, RLS prevents new uploads into the prefix, so the storage sweep is final;
- explicit deletes do not depend on cascade order across `RESTRICT`;
- a storage failure leaves only orphan files under a known prefix, which re-running cleans. The reverse failure (storage gone, DB rows left) would leave a live account with broken reports.

The runbook should be updated when this design is approved.

### 3.3 Existing delete-project order (for comparison)
`delete-project` does `begin_project_delete` (soft-lock, returns paths) → storage remove → `finalize_project_delete`. This is reasonable for a user-initiated delete, but its path list comes from a live-only RPC (UNVERIFIED whether it covers `project_photos`, which postdates it), and it trusts `remove()` (hazard 4). **Not reused for privacy purge** (§8).

### 3.4 Payments
Payments are disabled, but the table exists, and historical rows may exist (OPEN-DECISIONS I5). Purge plan behaviour:
- 0 rows → proceed;
- ≥1 row → **STOP** with "payments present: requires retention decision (L5)". An explicit `--payments=export-then-delete` flag may be added only after legal review sets the rule.

---

## 4. Storage strategy

### 4.1 Discovery: two independent sources
1. **Referenced set (DB):** `project_photos.storage_path` ∪ legacy `photos.storage_path` ∪ `reports.snapshot_json.photos[*].storagePath` ∪ `reports.snapshot_json.company.logoPath` ∪ `companies.logo_url` ∪ `reports.pdf_storage_path` (unused by code; included defensively).
2. **Actual set (storage):** every object whose name starts with the scope prefix (`{company_id}/` or `{company_id}/{project_id}/`).

PROPOSED listing method: a service-role-only `SECURITY DEFINER` RPC `admin_list_storage_objects(p_prefix text)` that selects `name, metadata->>'size', created_at` from `storage.objects where bucket_id = 'project-photos' and name like p_prefix || '%'`. This is one query, unpaginated and recursive by nature. Cross-check by recursive Storage API `list()` (non-recursive, paginated, 1000/page) in tests. Deletion is **only** via the Storage API (`storage.from(bucket).remove(paths)`, batches ≤ 100). Never `DELETE FROM storage.objects`: Supabase blocks or discourages it, and it would leave the underlying blobs.

### 4.2 Purge deletes = actual set (prefix), not referenced set
The plan reports both sets and the differences:
- **referenced-but-missing** (broken references, informational);
- **present-but-unreferenced** (orphans: deleted too, because they are within the target's prefix).

### 4.3 Verification (never inferred)
After `remove()`, the purge re-runs the listing for the prefix. Success = **0 objects**. Anything left → step fails with the remaining paths, retryable. After auth deletion, one more listing (catches a race upload from a still-valid JWT; expected empty since the company row is gone).

### 4.4 Orphan sweep (separate admin command, report-first)
`orphans --dry-run` lists:
- (a) top-level folders in the bucket whose `company_id` no longer exists in `companies` (left over from past DB-only deletions and E2E teardown);
- (b) within a live company, files referenced by **nothing** in §4.1.

Deleting (a) is safe once confirmed. Deleting (b) needs product sign-off: it covers old logos not referenced by any report and failed uploads. Removed-but-referenced photos are **not** orphans, because the rows still exist. Never run automatically.

### 4.5 Signed URLs
Signed URLs already issued (1 hour) stop working once the object is deleted. Copies already downloaded or printed (PDFs, WhatsApp) are outside our control (§6).

---

## 5. Admin tooling

### 5.1 Components (PROPOSED)
1. **SQL migration** (service_role-only: `revoke … from public, anon, authenticated; grant … to service_role`):
   - `admin_purge_plan(p_scope text, p_id uuid)` → jsonb: per-table counts, row ids, referenced storage paths, blockers. Read-only (`stable`).
   - `admin_revoke_share_links(p_scope, p_id)` → count revoked (idempotent: `coalesce(revoked_at, now())`).
   - `admin_purge_db(p_scope, p_id, p_plan_hash text)` → recomputes the plan inside the transaction, **raises if its hash ≠ `p_plan_hash`**, then deletes in the §2 order and returns per-table deleted counts. Single transaction.
   - `admin_list_storage_objects(p_prefix)` (§4.1).
   - Optional `privacy_operations` table (purge run log, §5.4). It needs a retention rule (legal review).
2. **Node CLI** `scripts/admin/privacy.mjs`. Runs **only on the owner's machine**, reads `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from a local env file (never committed, never in browser/Pages/CI), refuses to start otherwise.
   - `plan  --user <uuid> | --company <uuid> | --project <uuid> | --client <uuid>` → writes `plan-<scope>-<id>-<ts>.json` + prints a human summary + `planHash` (SHA-256 of a canonical plan without timestamps).
   - `export --user <uuid> [--no-files]` (§5.3).
   - `purge  --plan <file> --confirm "<company name>/<id>"`: executes the plan if, and only if, the live plan still hashes the same.
   - `orphans [--dry-run]`.
   - `verify --plan <file>`: re-runs all post-conditions.
   - No defaults that delete. `purge` without `--plan` is impossible; a dry run is **mandatory** by construction.

### 5.2 Purge sequence (account scope; project/client scopes are subsets)

| # | Step | Idempotent? | On failure |
|---|---|---|---|
| 1 | `plan` (dry run): counts, ids, both storage sets, blockers, hash. Human reads it | Read-only | — |
| 2 | Operator runs `purge --plan … --confirm "<name>/<id>"`; CLI re-plans and compares hash | Yes | Abort: "data changed since plan, re-plan" |
| 3 | Blockers non-empty → abort | — | — |
| 4 | (account) ban user + admin sign-out | Yes | Abort before any deletion |
| 5 | `admin_revoke_share_links` | Yes | Abort; nothing deleted yet |
| 6 | `admin_purge_db` (single transaction, hash-checked) | Yes (re-run deletes 0) | Transaction rolls back. Report, fix, retry |
| 7 | Storage `remove()` of the actual-set prefix listing, in batches | Yes (missing = no-op) | Record failed paths, continue other batches, then fail step |
| 8 | Re-list prefix → must be empty | Yes | Fail with remaining paths. Re-run `purge` resumes at 7 |
| 9 | (account) `auth.admin.deleteUser(id)` (hard) | Yes (not-found = done, confirmed via `getUserById`) | Fail. Data already gone, user banned. Retry |
| 10 | `verify`: all table counts 0 for the scope ids, prefix empty, user absent, share tokens of the plan's link ids not resolvable | Read-only | Report |
| 11 | Write the purge record | — | — |

**Resumability:** the run state (`planned → links_revoked → db_deleted → storage_verified → auth_deleted → verified`) is stored in the local run file, and in `privacy_operations` if adopted. Every step checks its post-condition first and skips if it is already met. So "re-run the same command" is the recovery procedure. The scope ids live in the plan file, so storage cleanup can still run after the DB rows are gone.

**Output:** every run prints and saves a report covering:
- per table: planned count and deleted count;
- storage: planned, removed, remaining and failed paths;
- auth result and blockers;
- timings and the operator.

It contains ids and counts only, **no personal content** (no names, emails or file contents).

### 5.3 Export package (account scope)

ZIP, PROPOSED layout:
```
export-<company_id>-<YYYYMMDD>/
  README.txt                    # pt-PT: what each file is, format version, date
  manifest.json                 # formatVersion, generatedAt, userId, companyIds, per-file sha256 + size, row counts
  account/user.json             # auth: id, email, created_at, last_sign_in_at (no hashes/tokens/factors)
  account/companies.json
  clients.json
  projects.json
  estado-da-obra/project_status_state.json
  estado-da-obra/project_work_items.json
  estado-da-obra/project_incidents.json
  estado-da-obra/project_photos.json
  estado-da-obra/project_work_item_status.json
  estado-da-obra/project_status_events.json
  reports/reports.json          # all columns except snapshot_json
  reports/<report_id>.snapshot.json
  reports/legacy_photos.json
  share-links.json              # id, report_id, created_at, expires_at, revoked_at, access_count, last_accessed_at — NEVER token_hash
  payments.json                 # only if rows exist; raw payloads re-minimised, any secret field stripped
  files/<storage path as-is>    # every object under {company_id}/ (photos incl. removed ones, all logo versions)
  files-index.json              # path, size, sha256, referencedBy[] (table/row ids), orphan flag
```
- JSON is UTF-8, pretty-printed, one array per table, original column names. Files are stored byte-for-byte (already EXIF-stripped at upload).
- Rendered report HTML/PDF is **not** included in v1: the renderers are browser modules. Snapshots are the canonical record. Rendering can be added later via the existing Playwright tooling.
- Delivery (PROPOSED, NEEDS LEGAL REVIEW for the channel): encrypted archive (AES-256 7z/zip) and password sent by a different channel, or a short-lived signed URL from a private bucket. Delete the local copy after confirmed delivery, and log the date.
- The export contains end clients' and workers' data. It goes to the account holder, the PROPOSED controller of that data (CONTROLLER-PROCESSOR-MAP.md).
- Project/client-scoped export: same structure filtered by scope, for a contractor answering an end-client access request.

### 5.4 Purge record (minimal evidence)
Request id, date received, requester channel, scope + target ids, plan hash, per-step timestamps, counts, outcome, operator. **No personal content.** Whether to keep target ids, and for how long, is NEEDS LEGAL REVIEW. They are needed to re-apply erasure after a backup restore (§7).

### 5.5 Required permissions
| Actor | Needs | Must not |
|---|---|---|
| CLI (owner machine) | service-role key; Auth admin API; Storage API | run from browser, Pages, CI or shared machines |
| Admin SQL functions | `SECURITY DEFINER`, `set search_path = public, pg_temp`, execute granted **only** to `service_role` | be callable by `anon`/`authenticated` (add to a static check like `check:share-boundary`, and to a test) |
| Operator | owner only (single-person operation) | run `purge` without a fresh `plan` |

### 5.6 Security risks
1. **Service-role key on a laptop** = full database + storage access. Store it outside the repo, prefer a dedicated short-lived key if the platform allows, rotate after use (NEEDS DASHBOARD CHECK), and keep the machine encrypted.
2. **Admin RPC exposure.** A grant mistake would let any user purge any company. Mitigate with explicit revoke/grant, a test that `authenticated`/`anon` calls fail, and no definer function taking an arbitrary target without the plan hash.
3. **Wrong target / ID typo.** Mitigate with the plan file, typed name+id confirmation and the hash check.
4. **Exports are concentrated personal data.** Encrypt them, keep local copies short-lived, and never commit them (add `exports/`, `plans/` to `.gitignore`).
5. **Log leakage.** The CLI prints ids and counts only. Storage paths contain ids, not names (CONFIRMED path shapes).
6. **Impersonated requests.** Identity verification belongs to the rights runbook (L7). The CLI cannot verify it.
7. **Partial purge left unnoticed.** Mitigated by the `verify` command and the run state.

---

## 6. Historical report conflict

| Affected | What purge does | Consequence |
|---|---|---|
| Immutable `snapshot_json` | The **whole report row is deleted** (project/client/account scope). No field-level redaction or mutation; `guard_report_snapshot` stays as is | Report disappears from history. No partially-redacted reports exist |
| Report photo references | Files under the project prefix are deleted. For a project or client scope, the company's logos are **kept**, because other projects' reports may reference them; account scope deletes them all | No surviving report can point at a deleted photo, because snapshots are project-scoped by trigger. Surviving reports in the same company keep their logo |
| Shared report links | Revoked first, then removed by cascade | The share page shows the existing invalid/expired state. Signed URLs already issued die within ≤1 h, or as soon as the object is deleted |
| Copies outside the system | Not reachable | PDFs downloaded or printed, WhatsApp messages and end clients' devices are outside our control. This should be said in the privacy text and the DPA |
| Reports in other projects naming the purged client (§2.1) | Not deleted automatically: blocker → manual decision (delete those reports too, or keep and document) | Avoids silently deleting another project's history, and avoids silently keeping the data |

**Not allowed by this design:** partial erasure within a report (e.g. removing one photo or the client's name) while keeping the report. That needs an explicit architecture decision (P10: anonymised snapshots vs whole-report deletion). Until then, the only privacy-erasure unit for report content is the whole report, via its project.

Single-photo erasure (e.g. an end client's face in one photo) is not supported without deleting the project. It is listed as an open gap. A `photo` scope (row + file, refusing if referenced by a report snapshot, unless reports are deleted too) is a possible extension.

---

## 7. Backups and what remains

| Location | Immediate purge removes it? | Notes |
|---|---|---|
| Live Postgres rows | **Yes** | Verified by count queries |
| Storage objects | **Yes** | Verified by listing |
| Auth user + identities/sessions | **Yes** (hard delete) | Verified by `getUserById` |
| Supabase DB backups / PITR | **No**, until they age out | Plan, PITR enabled, retention: NEEDS DASHBOARD CHECK |
| Storage in provider backups | Unknown | Whether/how Supabase backs up Storage objects: NEEDS PROVIDER CHECK (do not assume) |
| Platform logs (API, Auth, Edge Functions, Storage) | **No** | May contain user id, email (auth logs), paths, IPs; retention NEEDS DASHBOARD CHECK |
| Local exports, plan/run files on the admin machine | Operator must delete | Plans contain ids only |
| Test artifacts / Git history | Not applicable to customer data | Repo hygiene finding below |
| Downloaded/printed reports, WhatsApp | **No** | Outside our systems |

**Backup restore rule (PROPOSED):** after any restore, re-apply all purges recorded since the backup's point in time, using the purge records (§5.4), before the restored DB serves traffic. This is the reason to retain minimal purge records (legal review).

Facts still needed: I1 region, I2 plan/DPA, I7 backups/PITR/retention + restore test, I8 log retention, provider statement on Storage backup coverage, JWT expiry, Auth admin "ban" availability on the plan.

---

## 8. Existing delete functions: inventory

| Item | Where | Status | Notes |
|---|---|---|---|
| `delete-project` Edge Function | `supabase/functions/delete-project/index.ts`; `config.toml` `verify_jwt=false` | Source CONFIRMED; **deployment UNVERIFIED**; **not called by the app** (no `functions.invoke` reference in `js/`) | Trusts `remove()` (counts batch length). Echoes DB error messages to the client. Path list from live RPC |
| `begin_project_delete(p_project_id, p_user_id)` | live DB only | **UNVERIFIED** | Returns `storage_path` rows; soft-locks the project. Unknown whether it includes `project_photos`, logos, or snapshot paths |
| `finalize_project_delete(p_project_id, p_user_id)` | live DB only | **UNVERIFIED** | Returns `deleted_project_id` |
| `delete-photo` Edge Function | `supabase/functions/delete-photo/index.ts` | Source CONFIRMED; deployment UNVERIFIED; not called by app | Hard-deletes one photo (storage then row). Which table (legacy `photos` vs `project_photos`) depends on the live RPCs |
| `get_authorized_photo_storage_path`, `delete_authorized_photo` | live DB only | **UNVERIFIED** | |
| `prevent_report_insert_on_deleted_project` | trigger in baseline; body live only | **UNVERIFIED** | Insert-only, so irrelevant to deletion |
| Legacy `photos` table DDL (FK `report_id` on-delete rule, columns) | live DB only (RLS in baseline) | **UNVERIFIED** | Purge deletes it explicitly to avoid depending on it |
| `set_updated_at` | live DB only | UNVERIFIED | Irrelevant to deletion |
| E2E teardown `deleteProjectsDeep` | `tests/e2e/helpers/e2e-fixtures.js` | CONFIRMED | Correct FK order; removes legacy + workspace photo files; **never removes logos**; warns instead of failing on storage errors. Test-only |
| `supabase/manual/e2e_test_data_cleanup.sql` | repo | CONFIRMED | Manual SQL runbook, DB-only (storage left to a separate script) |
| Account deletion | — | **None exists** | |

**Retrieve from Supabase (SQL editor, read-only)** and commit to the repo as a schema-versioning migration or snapshot before implementation:
```sql
-- function bodies
select p.proname, pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('begin_project_delete','finalize_project_delete','get_authorized_photo_storage_path',
                    'delete_authorized_photo','prevent_report_insert_on_deleted_project','set_updated_at');
-- all FKs into/out of app tables, incl. legacy photos and auth/storage references
select conrelid::regclass, conname, pg_get_constraintdef(oid)
from pg_constraint where contype = 'f'
  and (connamespace = 'public'::regnamespace or confrelid = 'auth.users'::regclass);
select pg_get_constraintdef(oid) from pg_constraint
where conrelid = 'storage.objects'::regclass and contype = 'f';
-- legacy photos table
select column_name, data_type, is_nullable from information_schema.columns
where table_schema = 'public' and table_name = 'photos' order by ordinal_position;
-- any custom triggers on auth.users / storage.objects
select tgrelid::regclass, tgname, pg_get_triggerdef(oid) from pg_trigger
where tgrelid in ('auth.users'::regclass, 'storage.objects'::regclass) and not tgisinternal;
-- bucket flags
select id, public, file_size_limit, allowed_mime_types from storage.buckets;
-- complete public table list (to confirm no table is missing from this design)
select table_name from information_schema.tables where table_schema = 'public' order by 1;
```
Also check in the dashboard whether `delete-project` and `delete-photo` are deployed (Edge Functions list).

---

## 9. Failure and rollback strategy

- **Before step 6 (DB):** nothing destructive has happened beyond the ban and link revocation. Both are reversible (unban; links can be re-created by the user).
- **Step 6:** a single transaction. Any error → full rollback, no partial DB state.
- **Steps 7–8 (storage):** irreversible per object. A failure leaves only files under the known prefix, with no DB rows. Recovery = re-run (resumes, idempotent). No user-visible inconsistency, because the account/project is already gone from the DB.
- **Step 9 (auth):** a failure leaves a banned user with no data. Recovery = fix the blocker (e.g. NO ACTION reference) and re-run.
- **No application-level rollback after commit.** The only restore path is provider backups (§7), which is itself a privacy event that must be followed by re-applying purges.
- **Recommended pre-purge export?** Only when the requester asked for it (access + erasure). Otherwise do not create extra copies.

---

## 10. Tests required (before first production use)

Run against the test project with disposable users created through the Auth admin API (the purge deletes the user, so the shared E2E users cannot be used).

1. `plan` makes **zero** changes (row counts and storage listing identical before and after).
2. `purge` without a plan, with a wrong confirmation string, or with a stale plan hash (data changed after plan) → aborts with no changes.
3. Account purge with ≥2 companies, legacy reports + legacy photos, workspace photos (live + "Removido"), several logo versions, active + expired + revoked share links, status events, an orphan upload under the prefix → all public tables 0 rows for those ids; prefix empty by **both** SQL listing and Storage API listing; auth user gone; old share token → invalid state on `share.html`; old signed URL → fails.
4. **Isolation:** a second user/company with similar data is byte-for-byte untouched (row counts, file list, share link still works).
5. Project purge: sibling projects, their reports, links and all company logos remain; the purged project's prefix is empty.
6. Client purge: all of the client's projects gone, other clients untouched. A report in another project with `snapshot.project.clientId = X` → blocker reported, nothing deleted.
7. Blockers: a `payments` row present → abort. `changed_by` outside scope → abort.
8. Idempotency: re-run after success → all zero, success. Simulated storage failure mid-batch → step fails with paths; re-run completes.
9. Admin RPCs: `anon` and `authenticated` calls are denied (and a static grant check).
10. Export: every table present and row counts match the DB; no `token_hash`; files' sha256 match storage; `files-index` marks orphans; JSON parses; no secrets in `payments.json`.
11. Orphan sweep dry-run flags a folder for a deleted company and an unreferenced file, and deletes nothing.

---

## 11. Unresolved dashboard / provider facts

| # | Fact | Why it matters |
|---|---|---|
| D1 | Live function bodies + legacy `photos` DDL + full FK list (§8 queries) | Confirms the graph; whether `delete-project` is reusable or should be retired |
| D2 | `storage.objects.owner` FK to `auth.users`? | Can block auth deletion |
| D3 | Edge Functions deployed (`delete-project`, `delete-photo`) | Attack surface / decommission |
| D4 | Bucket `public` flag (I6) | Whether deleted-object URLs could have been public |
| D5 | Backups/PITR, retention, Storage backup coverage (I7) | What "deleted" means in the privacy text |
| D6 | Log retention per product (I8) | Residual data after purge |
| D7 | JWT expiry; Auth admin ban availability | Concurrency window during purge |
| D8 | Service-role key rotation possible without downtime | Post-operation hygiene |

---

## 12. Repo hygiene finding (outside this brief's scope, not changed)

`supabase/manual/e2e_test_data_cleanup.sql` (public repo) names a second, **real-looking account**: its owner UUID, a company name, and client names including a person's full name. This should go to the same review as the old example PDF (BREACH-RUNBOOK worked example / OPEN-DECISIONS U7). It was not edited here.

---

## 13. Implementation outline and complexity

| Work item | Size | Risk |
|---|---|---|
| Retrieve + version live functions/DDL (§8) | S | Low (read-only), but it gates the rest |
| SQL migration: plan / revoke / purge_db / list_storage (+ optional `privacy_operations`) | M | **High** (destructive, definer, service role) |
| Node CLI: plan, purge, verify, export, orphans | M–L (~600–900 lines) | High |
| Test spec with disposable users + storage fixtures | M | Medium (needs admin-created users, Auth admin API) |
| Runbook updates (DATA-RIGHTS-RUNBOOK, RETENTION-MATRIX) | S | Low |

**Overall: medium-high.** Roughly 3–5 focused sessions after D1–D3 are answered. Classified **high risk**. It needs:
- human-owner approval of the migration and the first production run;
- independent review of the SQL and the CLI;
- one rehearsal on the test project, with the §10 tests passing, before any real request.
