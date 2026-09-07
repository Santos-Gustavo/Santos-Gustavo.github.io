-- PROJECT-MASTER-SHEET-001 — "Ver Estado da Obra" quick-tap status persistence.
-- See docs/features/PROJECT-MASTER-SHEET-001.md (if present) for the feature design.
--
-- Why this table and nothing bigger: the master sheet's Pendentes/Em curso/Concluídas
-- lists are consolidated client-side from existing reports.works jsonb (see
-- js/projects/project-work-items.js). The only new fact that needs a durable home is
-- "the contractor tapped a status change for work item X on project Y" — everything
-- else (title, type, area, description) already lives in the report snapshot. Adding a
-- full duplicate items table would mean keeping two copies of that text in sync for no
-- reason. This table is a thin status-override layer keyed by the work item's own
-- `id` (a client-generated uuid string already present on every works[] entry).
--
-- Hard rule this preserves: historical reports remain historical evidence. A quick-tap
-- status change here NEVER writes into reports.works — old generated report snapshots
-- already sent to clients are never mutated.

create table public.project_work_item_status (
  id uuid not null default gen_random_uuid(),
  project_id uuid not null,

  -- The work item's own id (crypto.randomUUID() from js/projects/sections/works.js),
  -- not a foreign key — the item itself lives only inside a report's works jsonb.
  item_id text not null,

  status text not null,

  -- Which report this item was first/most-recently seen on, for display only.
  source_report_id uuid null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint project_work_item_status_pkey primary key (id),
  constraint project_work_item_status_project_id_fkey foreign key (project_id) references public.projects (id) on delete cascade,
  constraint project_work_item_status_source_report_id_fkey foreign key (source_report_id) references public.reports (id) on delete set null,
  constraint project_work_item_status_project_item_unique unique (project_id, item_id),
  constraint project_work_item_status_status_check check (status = any (array['done'::text, 'progress'::text, 'blocked'::text]))
);

create index idx_project_work_item_status_project_id on public.project_work_item_status using btree (project_id);

create trigger set_project_work_item_status_updated_at before
update on public.project_work_item_status for each row
execute function set_updated_at();

alter table public.project_work_item_status enable row level security;

-- Same ownership chain as project_status_events: project -> company -> owner_id.
create policy "project_work_item_status_select_own"
on public.project_work_item_status
as permissive
for select
to authenticated
using (
  exists (
    select 1
    from projects p
    join companies c on c.id = p.company_id
    where p.id = project_work_item_status.project_id
      and c.owner_id = auth.uid()
  )
);

create policy "project_work_item_status_insert_own"
on public.project_work_item_status
as permissive
for insert
to authenticated
with check (
  exists (
    select 1
    from projects p
    join companies c on c.id = p.company_id
    where p.id = project_work_item_status.project_id
      and c.owner_id = auth.uid()
  )
);

create policy "project_work_item_status_update_own"
on public.project_work_item_status
as permissive
for update
to authenticated
using (
  exists (
    select 1
    from projects p
    join companies c on c.id = p.company_id
    where p.id = project_work_item_status.project_id
      and c.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from projects p
    join companies c on c.id = p.company_id
    where p.id = project_work_item_status.project_id
      and c.owner_id = auth.uid()
  )
);

create policy "project_work_item_status_delete_own"
on public.project_work_item_status
as permissive
for delete
to authenticated
using (
  exists (
    select 1
    from projects p
    join companies c on c.id = p.company_id
    where p.id = project_work_item_status.project_id
      and c.owner_id = auth.uid()
  )
);
