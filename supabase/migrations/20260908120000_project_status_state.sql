-- PROJECT-HUB-INTEGRATION-001 — editable "Estado da Obra" fields (Fase atual,
-- Progresso geral, Resumo da obra), saved explicitly via "Guardar alterações".
-- Deliberately no autosave: one row per project, replaced wholesale on save.
--
-- Historical reports remain historical evidence — this table is live, mutable
-- project state, never written into reports.works/reports snapshots. A weekly
-- report generated from Estado da Obra reads this table once at draft-prefill
-- time (js/navigation/navigation.js's prepareWeeklyReportFromMasterSheet) and
-- then behaves like any other report draft field from that point on.
--
-- Also extends project_work_item_status (see 20260907120000) with a nullable
-- `desc` column so a work item can be added directly from Estado da Obra with
-- no source report to pull its description from. Existing quick-tap status
-- changes never send `desc` in their upsert payload, so this column is left
-- untouched for report-derived items — see js/database/db-project-work-items.js.

create table public.project_status_state (
  project_id uuid not null,
  company_id uuid not null,

  phase text not null default '',
  progress_pct integer not null default 0,
  summary text not null default '',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint project_status_state_pkey primary key (project_id),
  constraint project_status_state_project_id_fkey foreign key (project_id) references public.projects (id) on delete cascade,
  constraint project_status_state_company_id_fkey foreign key (company_id) references public.companies (id) on delete cascade,
  constraint project_status_state_progress_pct_check check (progress_pct >= 0 and progress_pct <= 100)
);

create trigger set_project_status_state_updated_at before
update on public.project_status_state for each row
execute function set_updated_at();

alter table public.project_status_state enable row level security;

create policy "project_status_state_select_own"
on public.project_status_state
as permissive
for select
to authenticated
using (
  exists (
    select 1
    from projects p
    join companies c on c.id = p.company_id
    where p.id = project_status_state.project_id
      and c.owner_id = auth.uid()
  )
);

create policy "project_status_state_insert_own"
on public.project_status_state
as permissive
for insert
to authenticated
with check (
  exists (
    select 1
    from projects p
    join companies c on c.id = p.company_id
    where p.id = project_status_state.project_id
      and c.owner_id = auth.uid()
  )
);

create policy "project_status_state_update_own"
on public.project_status_state
as permissive
for update
to authenticated
using (
  exists (
    select 1
    from projects p
    join companies c on c.id = p.company_id
    where p.id = project_status_state.project_id
      and c.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from projects p
    join companies c on c.id = p.company_id
    where p.id = project_status_state.project_id
      and c.owner_id = auth.uid()
  )
);

create policy "project_status_state_delete_own"
on public.project_status_state
as permissive
for delete
to authenticated
using (
  exists (
    select 1
    from projects p
    join companies c on c.id = p.company_id
    where p.id = project_status_state.project_id
      and c.owner_id = auth.uid()
  )
);

alter table public.project_work_item_status add column if not exists "desc" text null;
