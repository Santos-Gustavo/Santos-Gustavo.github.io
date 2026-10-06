-- ESTADO-DA-OBRA-WORKSPACE-001 Phase 4 — canonical report generation.
--
-- Three parts, applied together:
--
--   1. project_photos.storage_path hardening (DB boundary, not just UI).
--   2. reports snapshot guard: snapshot photo paths must stay inside the
--      report's own {company_id}/{project_id}/ folder, and a report's frozen
--      content can never be rewritten once its snapshot exists.
--   3. generate_report(p_project_id) — "Gerar relatório" as a pure export of
--      the SAVED canonical Estado da Obra. The browser sends only the project
--      id; every byte of report content is read here, inside one transaction.
--
-- Why 1 and 2 matter: get-shared-report signs snapshot photo paths with the
-- service-role key, i.e. with more storage access than the browser has. Any
-- path that reaches a snapshot must therefore be proven to belong to the
-- report's own project before it gets there.

-- ---------------------------------------------------------------------------
-- 1. project_photos.storage_path hardening
-- ---------------------------------------------------------------------------
--
-- A project photo may only reference its own project's workspace folder:
--
--   {projects.company_id}/{project_photos.project_id}/workspace/{file}
--
-- company_id is derived from the row's project, never trusted from the
-- caller. {file} is a single path segment (no sub-folders, no leading dot).
--
-- Fires on INSERT and on any UPDATE that names storage_path or project_id.
-- save_project_workspace never sets either column, so the one pre-existing
-- backfilled row (whose path is the legacy .../reports/{report_id}/... file
-- it was copied from) is left alone; generate_report re-checks every
-- selected photo against the looser {company_id}/{project_id}/ prefix below.

create or replace function public.enforce_project_photo_storage_path()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_prefix text;
  v_file text;
begin
  select p.company_id into v_company_id
  from public.projects p
  where p.id = new.project_id;

  if v_company_id is null then
    raise exception 'Projeto inválido para esta fotografia.' using errcode = '42501';
  end if;

  v_prefix := v_company_id::text || '/' || new.project_id::text || '/workspace/';

  if new.storage_path is null
     or left(new.storage_path, length(v_prefix)) <> v_prefix then
    raise exception 'Caminho de fotografia inválido para este projeto.' using errcode = '42501';
  end if;

  v_file := substr(new.storage_path, length(v_prefix) + 1);

  if v_file !~ '^[A-Za-z0-9_-][A-Za-z0-9._-]*$' then
    raise exception 'Caminho de fotografia inválido para este projeto.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_project_photos_storage_path on public.project_photos;

create trigger trg_project_photos_storage_path
before insert or update of storage_path, project_id on public.project_photos
for each row execute function public.enforce_project_photo_storage_path();

-- ---------------------------------------------------------------------------
-- 2. reports snapshot guard
-- ---------------------------------------------------------------------------
--
-- (a) Every snapshot_json.photos[].storagePath written to a report must start
--     with that report's own {company_id}/{project_id}/. Covers both
--     generate_report and the legacy client-built snapshot (legal/financial
--     wizard, fixtures). Existing rows are not re-validated.
-- (b) Write-once: once a report has a snapshot, its frozen content (snapshot,
--     legacy mirror columns, number, project) can never change. The legacy
--     wizard's insert-then-attach-snapshot (null -> value) still works;
--     archiving/soft-deleting a report (archived_at/deleted_at/status) still
--     works.

create or replace function public.guard_report_snapshot()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_prefix text;
  v_path text;
begin
  if tg_op = 'UPDATE' and old.snapshot_json is not null then
    if new.snapshot_json is distinct from old.snapshot_json
       or new.snapshot_version is distinct from old.snapshot_version
       or new.project_id is distinct from old.project_id
       or new.report_num is distinct from old.report_num
       or new.report_date is distinct from old.report_date
       or new.phase is distinct from old.phase
       or new.progress_pct is distinct from old.progress_pct
       or new.week_summary is distinct from old.week_summary
       or new.works is distinct from old.works
       or new.incidents is distinct from old.incidents
       or new.next_steps is distinct from old.next_steps
       or new.extras is distinct from old.extras then
      raise exception 'Relatório já gerado — o conteúdo não pode ser alterado.' using errcode = '42501';
    end if;

    return new;
  end if;

  if new.snapshot_json is null
     or jsonb_typeof(new.snapshot_json -> 'photos') is distinct from 'array' then
    return new;
  end if;

  select p.company_id into v_company_id
  from public.projects p
  where p.id = new.project_id;

  if v_company_id is null then
    raise exception 'Projeto inválido para este relatório.' using errcode = '42501';
  end if;

  v_prefix := v_company_id::text || '/' || new.project_id::text || '/';

  for v_path in
    select photo ->> 'storagePath'
    from jsonb_array_elements(new.snapshot_json -> 'photos') as photo
  loop
    if coalesce(v_path, '') <> ''
       and left(v_path, length(v_prefix)) <> v_prefix then
      raise exception 'Fotografia fora da pasta deste projeto — relatório não guardado.' using errcode = '42501';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_reports_guard_snapshot on public.reports;

create trigger trg_reports_guard_snapshot
before insert or update on public.reports
for each row execute function public.guard_report_snapshot();

-- ---------------------------------------------------------------------------
-- 3. generate_report
-- ---------------------------------------------------------------------------
--
-- SECURITY INVOKER: every read and the report insert run as the calling
-- user, so the existing ownership RLS on projects/companies/clients/
-- project_* and reports_insert_own all still apply. The explicit ownership
-- and eligibility checks only exist to fail loudly with a clear message.
--
-- Eligibility mirrors canCreateWeeklyReport (js/projects/project-status-rules.js):
-- status 1 (em curso) or 2 (pausada), not soft-deleted. Archived (5) and
-- completed (3) projects cannot generate.
--
-- Numbering: a per-project transaction-scoped advisory lock serialises
-- concurrent generate_report calls for the same project (double click, two
-- tabs) before max(report_num)+1 is read. max() runs over every report row
-- of the project, including soft-deleted ones, because
-- UNIQUE(project_id, report_num) covers those too and stays the DB backstop
-- (e.g. against a legacy-wizard insert that doesn't take this lock).
--
-- Content: phase/progress/summary/next_steps from project_status_state, plus
--   project_work_items  active AND include_in_reports
--   project_incidents   active AND include_in_reports
--   project_photos      active AND include_in_reports AND is_client_visible
-- "Active" = deactivated_at IS NULL. All tasks regardless of status, every
-- such incident (open or resolved) — no "changes this week" filtering.
--
-- The snapshot is self-contained: rendering it never needs the live
-- project_* rows. It carries no canonical row ids (only project/company/
-- client/report ids in the same places the legacy snapshot already had
-- them, which get-shared-report strips). Photos keep their storage_path —
-- canonical photo removal is soft-only and storage objects are retained.
--
-- No report-scoped `photos` rows are created: history ("Abrir"), "Ver PDF"
-- and the client share link (get-shared-report) all render from
-- snapshot_json.photos[].storagePath only. The legacy `photos` table is read
-- solely by the delete-photo edge function, which hard-deletes the storage
-- object — so pointing a `photos` row at a shared workspace object would
-- let that function destroy evidence other reports still reference.
--
-- The legacy columns (phase, progress_pct, week_summary, works, incidents,
-- incidents_on, next_steps) are filled once, here, as write-once mirrors in
-- the legacy shapes/status codes (blocked/progress/done), and are frozen by
-- trg_reports_guard_snapshot.
--
-- Everything happens in this one function call = one transaction: any error
-- leaves no report row and consumes no report number.

create or replace function public.generate_report(p_project_id uuid)
returns public.reports
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_project public.projects%rowtype;
  v_company public.companies%rowtype;
  v_client public.clients%rowtype;
  v_status public.project_status_state%rowtype;
  v_prefix text;
  v_report_id uuid := gen_random_uuid();
  v_report_num integer;
  v_report_date date := current_date;
  v_generated_at timestamptz := now();
  v_phase text;
  v_progress integer;
  v_summary text;
  v_works jsonb;
  v_works_mirror jsonb;
  v_incidents jsonb;
  v_incidents_mirror jsonb;
  v_photos jsonb;
  v_next_steps jsonb;
  v_next_steps_mirror jsonb;
  v_snapshot jsonb;
  v_report public.reports;
begin
  if p_project_id is null then
    raise exception 'project_id é obrigatório.' using errcode = '22023';
  end if;

  select p.* into v_project
  from public.projects p
  join public.companies c on c.id = p.company_id
  where p.id = p_project_id
    and c.owner_id = auth.uid();

  if not found then
    raise exception 'Projeto não encontrado ou sem permissão.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('generate_report:' || p_project_id::text, 0));

  -- Re-read under the lock so eligibility reflects the latest committed state.
  select p.* into v_project from public.projects p where p.id = p_project_id;

  if v_project.deleted_at is not null or v_project.status = 5 then
    raise exception 'Projeto arquivado — só de leitura.' using errcode = '42501';
  end if;

  if v_project.status not in (1, 2) then
    raise exception 'Só é possível gerar relatórios para obras em curso ou pausadas.' using errcode = '42501';
  end if;

  select * into v_company from public.companies where id = v_project.company_id;
  select * into v_client from public.clients where id = v_project.client_id;
  select * into v_status from public.project_status_state where project_id = p_project_id;

  v_phase := coalesce(v_status.phase, '');
  v_progress := least(100, greatest(0, coalesce(v_status.progress_pct, 0)));
  v_summary := coalesce(v_status.summary, '');

  -- Defense in depth for rows older than trg_project_photos_storage_path.
  v_prefix := v_project.company_id::text || '/' || p_project_id::text || '/';

  if exists (
    select 1
    from public.project_photos ph
    where ph.project_id = p_project_id
      and ph.deactivated_at is null
      and ph.include_in_reports
      and ph.is_client_visible
      and (ph.storage_path is null or left(ph.storage_path, length(v_prefix)) <> v_prefix)
  ) then
    raise exception 'Fotografia fora da pasta deste projeto — relatório não gerado.' using errcode = '42501';
  end if;

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'type', w.type,
      'area', w.area,
      'description', w.description,
      'status', w.status
    ) order by w.created_at, w.id), '[]'::jsonb),
    coalesce(jsonb_agg(jsonb_build_object(
      'id', w.id,
      'type', w.type,
      'area', w.area,
      'desc', w.description,
      'status', case w.status when 'pending' then 'blocked' when 'in_progress' then 'progress' else 'done' end
    ) order by w.created_at, w.id), '[]'::jsonb)
  into v_works, v_works_mirror
  from public.project_work_items w
  where w.project_id = p_project_id
    and w.deactivated_at is null
    and w.include_in_reports;

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'description', i.description,
      'status', i.status
    ) order by i.created_at, i.id), '[]'::jsonb),
    coalesce(jsonb_agg(jsonb_build_object(
      'id', i.id,
      'desc', i.description,
      'status', i.status
    ) order by i.created_at, i.id), '[]'::jsonb)
  into v_incidents, v_incidents_mirror
  from public.project_incidents i
  where i.project_id = p_project_id
    and i.deactivated_at is null
    and i.include_in_reports;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', null,
    'area', coalesce(ph.area, ''),
    'description', coalesce(ph.description, ''),
    'worker', coalesce(ph.worker, ''),
    'stage', ph.stage,
    'storagePath', ph.storage_path,
    'displayUrl', ''
  ) order by ph.created_at, ph.id), '[]'::jsonb)
  into v_photos
  from public.project_photos ph
  where ph.project_id = p_project_id
    and ph.deactivated_at is null
    and ph.include_in_reports
    and ph.is_client_visible;

  -- Próximos passos: one step per non-empty line of the saved textarea.
  select
    coalesce(jsonb_agg(jsonb_build_object('description', s.line, 'date', null) order by s.ord), '[]'::jsonb),
    coalesce(jsonb_agg(jsonb_build_object('desc', s.line, 'date', null) order by s.ord), '[]'::jsonb)
  into v_next_steps, v_next_steps_mirror
  from (
    select btrim(t.line) as line, t.ord
    from regexp_split_to_table(coalesce(v_status.next_steps, ''), E'\r?\n') with ordinality as t(line, ord)
  ) s
  where s.line <> '';

  select coalesce(max(r.report_num), 0) + 1 into v_report_num
  from public.reports r
  where r.project_id = p_project_id;

  v_snapshot := jsonb_build_object(
    'schemaVersion', 1,
    'snapshotVersion', 1,
    'source', 'canonical',
    'meta', jsonb_build_object(
      'reportId', v_report_id,
      'projectId', p_project_id,
      'mode', 'weekly',
      'reportNumber', v_report_num,
      'reportDate', v_report_date,
      'periodStart', null,
      'periodEnd', null,
      'generatedAt', v_generated_at
    ),
    'company', jsonb_build_object(
      'id', v_company.id,
      'name', coalesce(v_company.name, ''),
      'tagline', '',
      'nif', coalesce(v_company.nif, ''),
      'impic', coalesce(v_company.impic, ''),
      'responsible', coalesce(v_company.responsible, ''),
      'phone', coalesce(v_company.phone, ''),
      'email', coalesce(v_company.email, '')
    ),
    'project', jsonb_build_object(
      'id', v_project.id,
      'clientId', v_project.client_id,
      'name', coalesce(v_project.name, ''),
      'clientName', coalesce(v_client.name, ''),
      'location', coalesce(v_project.site_address, ''),
      'contractNumber', coalesce(v_project.contract_num, ''),
      'contractValue', coalesce(v_project.contract_value, 0)
    ),
    'progress', jsonb_build_object(
      'phase', v_phase,
      'percentage', v_progress,
      'weekSummary', v_summary
    ),
    'alert', jsonb_build_object(
      'enabled', false,
      'title', '',
      'description', '',
      'deadline', null,
      'consequence', ''
    ),
    'incidents', jsonb_build_object(
      'enabled', jsonb_array_length(v_incidents) > 0,
      'items', v_incidents
    ),
    'works', v_works,
    'photos', v_photos,
    'extras', '[]'::jsonb,
    'nextSteps', v_next_steps,
    'financialNote', ''
  );

  insert into public.reports (
    id,
    project_id,
    report_num,
    report_date,
    period_start,
    period_end,
    phase,
    progress_pct,
    week_summary,
    alert_on,
    incidents_on,
    works,
    incidents,
    extras,
    next_steps,
    snapshot_json,
    snapshot_version,
    status
  )
  values (
    v_report_id,
    p_project_id,
    v_report_num,
    v_report_date,
    null,
    null,
    nullif(v_phase, ''),
    v_progress,
    nullif(v_summary, ''),
    false,
    jsonb_array_length(v_incidents) > 0,
    v_works_mirror,
    v_incidents_mirror,
    '[]'::jsonb,
    v_next_steps_mirror,
    v_snapshot,
    1,
    0
  )
  returning * into v_report;

  return v_report;
end;
$$;

revoke all on function public.generate_report(uuid) from public;
revoke all on function public.generate_report(uuid) from anon;
grant execute on function public.generate_report(uuid) to authenticated;
