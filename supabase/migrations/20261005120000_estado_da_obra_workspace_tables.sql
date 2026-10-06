-- ESTADO-DA-OBRA-WORKSPACE-001 — Phase 1 (additive schema only) of the Estado da
-- Obra / Gerar Relatório rebuild. Introduces the canonical, mutable
-- project-workspace tables that a later `save_project_workspace` RPC (Phase 3)
-- and `generate_report` RPC (Phase 4) will read/write. Nothing in the app reads
-- or writes any of this yet — this migration is purely additive and changes no
-- existing behavior. Backfilling these tables from existing report data is a
-- separate, later migration (Phase 2), run and verified before any UI cutover.
--
-- These supersede project_work_item_status (20260907120000) as the ongoing
-- source of truth for work-item state, but that table and every existing
-- reports.works/.incidents/.next_steps/.extras jsonb column are left completely
-- untouched — they remain readable as each report's own frozen historical
-- content.
--
-- Status vocabulary for project_work_items is pending / in_progress / done —
-- no "blocked". This is a deliberate rename from project_work_item_status's
-- blocked/progress/done values; that table's own check constraint is untouched.

create table public.project_work_items (
  id uuid not null default gen_random_uuid(),
  project_id uuid not null,

  type text not null default '',
  area text not null default '',
  description text not null default '',
  status text not null default 'pending',

  include_in_reports boolean not null default true,
  first_report_id uuid null,

  -- Soft delete only. Normal removal from Estado da Obra never hard-deletes a
  -- work item: historical report snapshots reference items by id-in-jsonb, not
  -- by a live foreign key, so nothing downstream breaks either way — but a
  -- hard delete would still lose this row's own history (created_at,
  -- first_report_id) for no benefit.
  deactivated_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint project_work_items_pkey primary key (id),
  constraint project_work_items_project_id_fkey foreign key (project_id) references public.projects (id) on delete cascade,
  constraint project_work_items_first_report_id_fkey foreign key (first_report_id) references public.reports (id) on delete set null,
  constraint project_work_items_status_check check (status = any (array['pending'::text, 'in_progress'::text, 'done'::text]))
);

create index idx_project_work_items_project_id on public.project_work_items using btree (project_id);

create index idx_project_work_items_live on public.project_work_items using btree (project_id)
where (deactivated_at is null);

create trigger set_project_work_items_updated_at before
update on public.project_work_items for each row
execute function set_updated_at();

alter table public.project_work_items enable row level security;

create policy "project_work_items_select_own"
on public.project_work_items
as permissive
for select
to authenticated
using (
  exists (
    select 1
    from projects p
    join companies c on c.id = p.company_id
    where p.id = project_work_items.project_id
      and c.owner_id = auth.uid()
  )
);

create policy "project_work_items_insert_own"
on public.project_work_items
as permissive
for insert
to authenticated
with check (
  exists (
    select 1
    from projects p
    join companies c on c.id = p.company_id
    where p.id = project_work_items.project_id
      and c.owner_id = auth.uid()
  )
);

create policy "project_work_items_update_own"
on public.project_work_items
as permissive
for update
to authenticated
using (
  exists (
    select 1
    from projects p
    join companies c on c.id = p.company_id
    where p.id = project_work_items.project_id
      and c.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from projects p
    join companies c on c.id = p.company_id
    where p.id = project_work_items.project_id
      and c.owner_id = auth.uid()
  )
);

create policy "project_work_items_delete_own"
on public.project_work_items
as permissive
for delete
to authenticated
using (
  exists (
    select 1
    from projects p
    join companies c on c.id = p.company_id
    where p.id = project_work_items.project_id
      and c.owner_id = auth.uid()
  )
);


-- project_incidents — same ownership model as project_work_items, for Estado
-- da Obra's Incidentes list. Three independent axes, not to be conflated:
--   status             open / resolved — the incident's own real-world state.
--   include_in_reports whether it appears in future generated reports.
--   deactivated_at      whether it appears in the live Estado da Obra at all
--                       (soft delete — removing an accidentally-created
--                       incident). No hard-delete path; same rationale as
--                       project_work_items.deactivated_at above.
-- Resolving an incident never hides or deactivates it; hiding one from
-- reports never resolves or deactivates it. Live Estado da Obra and future
-- report generation both filter on deactivated_at is null.

create table public.project_incidents (
  id uuid not null default gen_random_uuid(),
  project_id uuid not null,

  description text not null,
  status text not null default 'open',
  include_in_reports boolean not null default true,

  resolved_at timestamptz null,
  deactivated_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint project_incidents_pkey primary key (id),
  constraint project_incidents_project_id_fkey foreign key (project_id) references public.projects (id) on delete cascade,
  constraint project_incidents_status_check check (status = any (array['open'::text, 'resolved'::text]))
);

create index idx_project_incidents_project_id on public.project_incidents using btree (project_id);

create index idx_project_incidents_live on public.project_incidents using btree (project_id)
where (deactivated_at is null);

create trigger set_project_incidents_updated_at before
update on public.project_incidents for each row
execute function set_updated_at();

alter table public.project_incidents enable row level security;

create policy "project_incidents_select_own"
on public.project_incidents
as permissive
for select
to authenticated
using (
  exists (
    select 1
    from projects p
    join companies c on c.id = p.company_id
    where p.id = project_incidents.project_id
      and c.owner_id = auth.uid()
  )
);

create policy "project_incidents_insert_own"
on public.project_incidents
as permissive
for insert
to authenticated
with check (
  exists (
    select 1
    from projects p
    join companies c on c.id = p.company_id
    where p.id = project_incidents.project_id
      and c.owner_id = auth.uid()
  )
);

create policy "project_incidents_update_own"
on public.project_incidents
as permissive
for update
to authenticated
using (
  exists (
    select 1
    from projects p
    join companies c on c.id = p.company_id
    where p.id = project_incidents.project_id
      and c.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from projects p
    join companies c on c.id = p.company_id
    where p.id = project_incidents.project_id
      and c.owner_id = auth.uid()
  )
);

create policy "project_incidents_delete_own"
on public.project_incidents
as permissive
for delete
to authenticated
using (
  exists (
    select 1
    from projects p
    join companies c on c.id = p.company_id
    where p.id = project_incidents.project_id
      and c.owner_id = auth.uid()
  )
);


-- project_photos — the live, canonical photo collection for Estado da Obra.
-- Distinct from the existing report-scoped `photos` table (report_id-only,
-- written by savePhotosForReport): this one is project-scoped and mutable
-- ahead of any report, per decision 5 (immediate upload, outside any draft/
-- save transaction). No company_id column here — project_id already
-- determines company via projects.company_id, and storing it again would
-- just be a second source of truth that could drift from the project's own
-- company. The application layer looks up the project's company_id (already
-- in hand from appState/loadProject) to build the companyId/projectId/...
-- storage path; it doesn't need it duplicated on this row to do that.
--
-- Soft delete only (deactivated_at) — per decision 4, "removing" a photo from
-- Estado da Obra never deletes the storage object or this row, so any report
-- snapshot that already copied this photo's storage_path at generation time
-- keeps working regardless of later edits here. include_in_reports is a
-- separate, reversible toggle: still live, just excluded from future reports.

create table public.project_photos (
  id uuid not null default gen_random_uuid(),
  project_id uuid not null,

  storage_path text not null,

  area text null,
  description text null,
  worker text null,
  stage text not null default 'during',

  include_in_reports boolean not null default true,
  is_client_visible boolean not null default true,

  deactivated_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint project_photos_pkey primary key (id),
  constraint project_photos_project_id_fkey foreign key (project_id) references public.projects (id) on delete cascade,
  constraint project_photos_stage_check check (stage = any (array['before'::text, 'during'::text, 'after'::text]))
);

create index idx_project_photos_project_id on public.project_photos using btree (project_id);

create index idx_project_photos_live on public.project_photos using btree (project_id)
where (deactivated_at is null);

create trigger set_project_photos_updated_at before
update on public.project_photos for each row
execute function set_updated_at();

alter table public.project_photos enable row level security;

create policy "project_photos_select_own"
on public.project_photos
as permissive
for select
to authenticated
using (
  exists (
    select 1
    from projects p
    join companies c on c.id = p.company_id
    where p.id = project_photos.project_id
      and c.owner_id = auth.uid()
  )
);

create policy "project_photos_insert_own"
on public.project_photos
as permissive
for insert
to authenticated
with check (
  exists (
    select 1
    from projects p
    join companies c on c.id = p.company_id
    where p.id = project_photos.project_id
      and c.owner_id = auth.uid()
  )
);

create policy "project_photos_update_own"
on public.project_photos
as permissive
for update
to authenticated
using (
  exists (
    select 1
    from projects p
    join companies c on c.id = p.company_id
    where p.id = project_photos.project_id
      and c.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from projects p
    join companies c on c.id = p.company_id
    where p.id = project_photos.project_id
      and c.owner_id = auth.uid()
  )
);

create policy "project_photos_delete_own"
on public.project_photos
as permissive
for delete
to authenticated
using (
  exists (
    select 1
    from projects p
    join companies c on c.id = p.company_id
    where p.id = project_photos.project_id
      and c.owner_id = auth.uid()
  )
);


-- project_status_state: add the free-narrative-text "Próximos Passos" field
-- (decision 2 of the prior design pass — no separate next-steps entity, this
-- table's existing phase/progress_pct/summary columns get a sibling text
-- column instead). Backfilling existing projects' consolidated next-steps list
-- into this column is part of Phase 2, not this migration.
alter table public.project_status_state
  add column if not exists next_steps text not null default '';


-- reports.snapshot_version: a clean version boundary for the report snapshot
-- shape, per today's final decision 6. Every report generated by the current
-- (pre-rebuild) code path, and every report generated by the new
-- generate_report RPC in Phase 4, is version 1 — this column exists now so a
-- future snapshot schema change has something to branch on without guessing
-- a row's age from created_at.
alter table public.reports
  add column if not exists snapshot_version integer not null default 1;

-- NOTE on decision 5 (report numbering): reports already carries
-- `constraint reports_project_report_num_unique unique (project_id, report_num)`
-- live today (confirmed via supabase/manual/live_schema_rls_baseline.sql,
-- originally captured 2026-08-28) — so the "run a duplicate pre-migration
-- check, then add the constraint" step is already satisfied and is not
-- repeated here. What's still missing is server-side atomic allocation: today
-- js/database/db-reports.js's getNextReportNum does a client-side
-- select-max-then-insert with no lock, which this existing constraint only
-- backstops (turns a race into a visible insert error) rather than prevents.
-- Moving allocation into generate_report's advisory-locked transaction is
-- Phase 4 application work, not a schema change, so there is nothing to add
-- to this migration for it.
