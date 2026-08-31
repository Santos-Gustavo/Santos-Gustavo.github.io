/*
E2E-CLEANUP-001 — one-time cleanup of E2E/test-generated data for the known
test owner. This is documentation + a reviewed runbook, not a migration —
run it by hand in the Supabase SQL Editor after reading the preview output.

Do NOT run this against any owner_id other than the one below without
redoing the inspection queries for that owner first.

--------------------------------------------------------------------------
PREVIEW COUNTS actually observed when this file was written (read-only,
service-role client — numbers below are a snapshot, not a guarantee: every
Playwright run adds more rows the same shape. ALWAYS re-run STEP 0 below
and read its output fresh before touching STEP 1 onward; do not trust these
comment numbers at execution time.

  Owner 62daa10f-4397-42df-ab77-1aea49b935d1 (the known test owner), most
  recent snapshot (2026-08-31, after a full `npx playwright test` run):
    companies : 6   (100% match a test name pattern — 0 need manual review)
    clients   : 307 (100% match a test name pattern)
    projects  : 268 (100% match a test name pattern)
    reports   : 76
    photos    : 20  (DB rows only — see the Storage note at the bottom)
    report_share_links : 4

  Owner 6cb9348f-85e8-4b65-a9e5-b970c8fda578 (a DIFFERENT, real-looking
  account — company "Lindoca", clients "Legiao Urbana", "Gustavo Santos
  Ferreira", "EU") — NOT part of this cleanup, not touched by anything
  below, scoped out by owner_id alone even before name matching.

Every company/client/project row under the known test owner already
matches a test name pattern (E2E/SMOKE/Fixture/Test) — there is no
real-looking data mixed in under this owner. That is what makes wiping the
entire owner's data set (not just a filtered subset of it) safe here.
--------------------------------------------------------------------------
*/

begin;

-- ============================================================
-- STEP 0 — freeze the cleanup scope into temp tables, computed ONCE at the
-- start of this transaction. Every DELETE below reads from these temp
-- tables instead of re-running the WHERE clause, so the scope can't drift
-- between statements and every statement is provably deleting exactly what
-- STEP 0's preview shows.
-- ============================================================

create temporary table _cleanup_companies on commit drop as
select id, name, created_at
from companies
where owner_id = '62daa10f-4397-42df-ab77-1aea49b935d1'
  and (
    name ilike '%E2E%'
    or name ilike '%SMOKE%'
    or name ilike '%Fixture%'
    or name ilike '%Test%'
  );

create temporary table _cleanup_clients on commit drop as
select id, name, company_id
from clients
where company_id in (select id from _cleanup_companies)
  and (
    name ilike '%E2E%'
    or name ilike '%SMOKE%'
    or name ilike '%Fixture%'
    or name ilike '%Test%'
  );

create temporary table _cleanup_projects on commit drop as
select id, name, company_id, client_id
from projects
where company_id in (select id from _cleanup_companies)
  and (
    name ilike '%E2E%'
    or name ilike '%SMOKE%'
    or name ilike '%Fixture%'
    or name ilike '%Test%'
  );

-- Reports have no name field to pattern-match — scoped purely by belonging
-- to a matched test project, which is the only meaningful scope for them.
create temporary table _cleanup_reports on commit drop as
select id, project_id
from reports
where project_id in (select id from _cleanup_projects);

-- ============================================================
-- STEP 0b — PREVIEW COUNTS. Read this output before going any further.
-- ============================================================

select 'companies' as table_name, count(*) as row_count from _cleanup_companies
union all
select 'clients', count(*) from _cleanup_clients
union all
select 'projects', count(*) from _cleanup_projects
union all
select 'reports', count(*) from _cleanup_reports
union all
select 'photos', count(*) from photos where report_id in (select id from _cleanup_reports)
union all
select 'report_share_links', count(*) from report_share_links where report_id in (select id from _cleanup_reports);

-- ============================================================
-- STEP 0c — CLASSIFICATION checks. These should all return ZERO rows.
-- If any of them return rows, STOP — do not run the DELETEs below until
-- you've manually reviewed what came back and understood why it didn't
-- match the expected pattern.
-- ============================================================

-- (C) Companies under this owner that do NOT match a test pattern — would
-- be silently left untouched by this script either way, but surfacing them
-- here means you get to see them before assuming the owner is 100% test data.
select id, name, 'company under test owner NOT matching a test pattern' as flag
from companies
where owner_id = '62daa10f-4397-42df-ab77-1aea49b935d1'
  and id not in (select id from _cleanup_companies);

-- (C) Clients under a matched test company that do NOT themselves match a
-- test pattern — these are classification-C candidates and are
-- deliberately excluded from _cleanup_clients, so they will NOT be deleted
-- by STEP 5 below even though their company is being wiped in STEP 6.
-- Review them; if any are real, do not proceed with STEP 6 for that company.
select id, name, company_id, 'client under a matched test company NOT matching a test pattern' as flag
from clients
where company_id in (select id from _cleanup_companies)
  and id not in (select id from _cleanup_clients);

-- (C) Same check for projects.
select id, name, company_id, 'project under a matched test company NOT matching a test pattern' as flag
from projects
where company_id in (select id from _cleanup_companies)
  and id not in (select id from _cleanup_projects);

-- ============================================================
-- CLASSIFICATION SUMMARY (matches REQ "2. Classify data")
-- ============================================================
-- A. Zero-history clients (safe to delete directly, no project dependency):
select count(*) as classification_a_zero_history_clients
from _cleanup_clients c
where not exists (select 1 from _cleanup_projects p where p.client_id = c.id);

-- B. Clients with dependent projects/reports/photos/share-links (require
--    the full dependency-ordered delete in STEPS 1-5 below):
select count(*) as classification_b_clients_with_dependencies
from _cleanup_clients c
where exists (select 1 from _cleanup_projects p where p.client_id = c.id);

-- C. Anything that looked non-test was already surfaced in STEP 0c above —
--    if those queries returned rows, treat those specific rows as
--    classification C and exclude them by adjusting the temp-table
--    definitions in STEP 0 before re-running this file.

-- ============================================================
-- >>> STOP HERE. Read STEP 0b and STEP 0c output. Only continue past this
-- >>> point once you've confirmed the counts look right and the
-- >>> classification checks returned zero rows. <<<
-- ============================================================

-- ============================================================
-- STEP 1 — report_share_links (leaf table, no dependents)
-- ============================================================
delete from report_share_links
where report_id in (select id from _cleanup_reports);

-- ============================================================
-- STEP 2 — photos (DB rows only; see the Storage note at the bottom of
-- this file for the actual files in the "project-photos" bucket)
-- ============================================================
delete from photos
where report_id in (select id from _cleanup_reports);

-- ============================================================
-- STEP 3 — reports
-- ============================================================
delete from reports
where id in (select id from _cleanup_reports);

-- ============================================================
-- STEP 4 — projects
-- ============================================================
delete from projects
where id in (select id from _cleanup_projects);

-- ============================================================
-- STEP 5 — clients (both classification A and B — by this point every
-- project referencing them has already been deleted in STEP 4, so the
-- ON DELETE RESTRICT on projects.client_id no longer blocks this)
-- ============================================================
delete from clients
where id in (select id from _cleanup_clients);

-- ============================================================
-- STEP 6 — zero-use test companies only. The "not exists" checks re-query
-- the live tables (not the frozen temp tables) so this only deletes a
-- company if it is ACTUALLY orphaned after steps 1-5, not just because it
-- was in the original matched set.
-- ============================================================
delete from companies
where id in (select id from _cleanup_companies)
  and not exists (select 1 from clients c where c.company_id = companies.id)
  and not exists (select 1 from projects p where p.company_id = companies.id);

-- ============================================================
-- VERIFICATION — run these after the deletes, before deciding to COMMIT.
-- ============================================================

select 'remaining companies for test owner' as check_name, count(*) as row_count
from companies
where owner_id = '62daa10f-4397-42df-ab77-1aea49b935d1';

select 'remaining clients under test-owner companies' as check_name, count(*) as row_count
from clients
where company_id in (
  select id from companies where owner_id = '62daa10f-4397-42df-ab77-1aea49b935d1'
);

select 'remaining projects under test-owner companies' as check_name, count(*) as row_count
from projects
where company_id in (
  select id from companies where owner_id = '62daa10f-4397-42df-ab77-1aea49b935d1'
);

-- Expect: companies possibly 0 (if every one of the 6 was zero-use after
-- cleanup), clients 0, projects 0. If a company remains, it means STEP 0c
-- found a non-test client/project under it that was deliberately excluded
-- and left in place — that is correct behavior, not a bug.

-- ============================================================
-- Only uncomment ONE of the following once you've reviewed the
-- verification output above. Never leave this transaction open/idle.
-- ============================================================

-- COMMIT;
-- ROLLBACK;

/*
--------------------------------------------------------------------------
STORAGE NOTE (not handled by this SQL file):

The `photos` rows deleted in STEP 2 point at files in the "project-photos"
Storage bucket via `storage_path`. Deleting the DB row does NOT delete the
underlying Storage object — the existing app pattern (see
supabase/functions/delete-project/index.ts and
tests/e2e/global-teardown.js's deleteProjectsDeep) always removes Storage
objects via the JS Storage API (`storage.remove()`), not SQL, because
Storage objects aren't just plain rows in a table you can DELETE FROM
safely from a database client — a JS/service-role call is the sanctioned
path in this codebase.

To find what would be orphaned, run this SELECT (read-only, safe to run any
time, does not require the transaction above):

  select storage_path
  from photos
  where report_id in (
    select r.id from reports r
    join projects p on p.id = r.project_id
    join companies c on c.id = p.company_id
    where c.owner_id = '62daa10f-4397-42df-ab77-1aea49b935d1'
      and (c.name ilike '%E2E%' or c.name ilike '%SMOKE%' or c.name ilike '%Fixture%' or c.name ilike '%Test%')
  );

If you want those Storage objects removed too, do it via a short Node
script using the service-role client and `client.storage.from("project-photos").remove([...paths])`
AFTER this transaction commits (so the photo rows and the paths you're
removing are guaranteed consistent) — not as part of this SQL file.
--------------------------------------------------------------------------
*/
