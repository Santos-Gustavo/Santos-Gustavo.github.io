-- ESTADO-DA-OBRA-WORKSPACE-001 — RLS hardening for the three canonical
-- workspace tables added by 20261005120000. Normal removal in this workspace
-- is always a soft delete (deactivated_at = now()), done via an UPDATE under
-- the existing *_update_own policy — there is no product-level action that
-- should ever physically delete a row. Authenticated users must not be able
-- to hard-delete through PostgREST either, so the *_delete_own policies added
-- by the Phase 1 migration are removed here. Service-role/admin maintenance
-- still bypasses RLS entirely when genuinely required (e.g. a manual cleanup
-- script run with the service key), independent of these policies.

drop policy if exists "project_work_items_delete_own" on public.project_work_items;
drop policy if exists "project_incidents_delete_own" on public.project_incidents;
drop policy if exists "project_photos_delete_own" on public.project_photos;
