-- POST-RELEASE-POLISH-001 — user-chosen report period + company logo.
--
-- 1. Company logo (Dados da Empresa → Logótipo)
--    * companies.logo_url holds a storage path under {company_id}/company/
--      or null (enforced by trg_companies_logo_path; every existing row is
--      null today).
--    * generate_report freezes it into snapshot_json.company.logoPath.
--    * guard_report_snapshot rejects a snapshot whose company.logoPath is
--      outside the report's own company folder — get-shared-report signs it
--      with the service role, exactly like photo paths.
--
-- 2. User-chosen report period
--    generate_report gains two optional parameters, p_period_start and
--    p_period_end (Estado da Obra's "Período do relatório" De / Até):
--      * both null  -> the automatic period from 20261007120000 (unchanged)
--      * both given -> used as-is after validation: start <= end, end not
--                      after today (Europe/Lisbon), at most one year long
--      * only one   -> rejected
--    report_date stays the generation day.
--
-- Everything else in both functions is identical to 20261007120000.
--
-- The generate_report signature changes, so the old one-argument function is
-- dropped first: keeping both overloads would make PostgREST's call with only
-- p_project_id ambiguous. Apply this BEFORE deploying the frontend that sends
-- the dates; the old frontend keeps working against the new function.

-- ---------------------------------------------------------------------------
-- 1a. companies.logo_url
-- ---------------------------------------------------------------------------

create or replace function public.enforce_company_logo_path()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_prefix text := new.id::text || '/company/';
begin
  if new.logo_url is null then
    return new;
  end if;

  if left(new.logo_url, length(v_prefix)) <> v_prefix
     or substr(new.logo_url, length(v_prefix) + 1) !~ '^[A-Za-z0-9_-][A-Za-z0-9._-]*$' then
    raise exception 'Caminho de logótipo inválido para esta empresa.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_companies_logo_path on public.companies;

create trigger trg_companies_logo_path
before insert or update of logo_url on public.companies
for each row execute function public.enforce_company_logo_path();

-- ---------------------------------------------------------------------------
-- 1b. reports snapshot guard (20261007120000's version + company logo check)
-- ---------------------------------------------------------------------------

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
       or new.period_start is distinct from old.period_start
       or new.period_end is distinct from old.period_end
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

  if new.snapshot_json is null then
    return new;
  end if;

  select p.company_id into v_company_id
  from public.projects p
  where p.id = new.project_id;

  if v_company_id is null then
    raise exception 'Projeto inválido para este relatório.' using errcode = '42501';
  end if;

  -- Company logo: only this report's own company's logo folder.
  v_path := new.snapshot_json -> 'company' ->> 'logoPath';
  if coalesce(v_path, '') <> ''
     and left(v_path, length(v_company_id::text || '/company/')) <> v_company_id::text || '/company/' then
    raise exception 'Logótipo fora da pasta desta empresa — relatório não guardado.' using errcode = '42501';
  end if;

  if jsonb_typeof(new.snapshot_json -> 'photos') is distinct from 'array' then
    return new;
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

-- ---------------------------------------------------------------------------
-- 2. generate_report (period parameters + company logo)
-- ---------------------------------------------------------------------------

drop function if exists public.generate_report(uuid);

create function public.generate_report(
  p_project_id uuid,
  p_period_start date default null,
  p_period_end date default null
)
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
  -- Portugal's calendar date, not the server's UTC date: a report generated
  -- 00:00–01:00 Lisbon summer time must not be dated the previous day.
  v_report_date date := (now() at time zone 'Europe/Lisbon')::date;
  v_previous_report_date date;
  v_period_start date;
  v_period_end date;
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

  -- A chosen period is optional, but all-or-nothing and sane.
  if (p_period_start is null) <> (p_period_end is null) then
    raise exception 'Indique as duas datas do período do relatório.' using errcode = '22023';
  end if;

  if p_period_start is not null then
    if p_period_start > p_period_end then
      raise exception 'A data de início do período não pode ser posterior à data de fim.' using errcode = '22023';
    end if;

    if p_period_end > v_report_date then
      raise exception 'O período do relatório não pode terminar depois de hoje.' using errcode = '22023';
    end if;

    if p_period_end - p_period_start > 366 then
      raise exception 'O período do relatório não pode ter mais de um ano.' using errcode = '22023';
    end if;
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

  -- Período: the user's chosen dates when given (validated above).
  -- Otherwise from the day after the previous (non-deleted) report up to
  -- today; a project's first report covers the last 7 days (the old weekly
  -- wizard's default). Never starts after it ends.
  select r.report_date into v_previous_report_date
  from public.reports r
  where r.project_id = p_project_id
    and r.deleted_at is null
  order by r.report_num desc
  limit 1;

  if p_period_start is not null then
    v_period_start := p_period_start;
    v_period_end := p_period_end;
  else
    v_period_end := v_report_date;
    v_period_start := least(coalesce(v_previous_report_date + 1, v_report_date - 7), v_period_end);
  end if;

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
      'periodStart', v_period_start,
      'periodEnd', v_period_end,
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
      'email', coalesce(v_company.email, ''),
      'logoPath', v_company.logo_url
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
    v_period_start,
    v_period_end,
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

revoke all on function public.generate_report(uuid, date, date) from public;
revoke all on function public.generate_report(uuid, date, date) from anon;
grant execute on function public.generate_report(uuid, date, date) to authenticated;

notify pgrst, 'reload schema';
