-- ESTADO-DA-OBRA-WORKSPACE-001 Phase 3 — save_project_workspace RPC.
--
-- The single write path for Estado da Obra's "Guardar alterações". Persists
-- project_status_state, project_work_items, project_incidents and
-- project_photos metadata atomically: a plpgsql function body runs inside the
-- caller's single transaction, so any raised error rolls back every write
-- made so far in this call.
--
-- SECURITY INVOKER (the default) on purpose: every statement below runs as
-- the calling authenticated user, so the existing ownership-chain RLS
-- policies on all four tables still apply. Nothing here can touch a row the
-- caller couldn't already touch through PostgREST directly. The explicit
-- ownership check at the top exists only to fail loudly with a clear message
-- instead of silently updating zero rows.
--
-- Reconciliation rule: only rows explicitly present in the payload arrays
-- are touched. An existing canonical row that is simply absent from the
-- payload is left exactly as it is — a stale or partial browser payload can
-- never deactivate anything by omission. Removal must be explicit
-- ("deactivated": true), and is always a soft delete (deactivated_at), never
-- a hard delete. "deactivated": false on a deactivated row restores it.
--
-- Payload shapes (all arrays may be empty):
--   p_status     {phase, progress_pct, summary, next_steps}
--   p_work_items [{id, type, area, description, status, include_in_reports, deactivated}]
--   p_incidents  [{id, description, status, include_in_reports, deactivated}]
--   p_photos     [{id, area, description, worker, stage, include_in_reports, deactivated}]
--
-- Work items and incidents are upserted by their client-generated canonical
-- id, always scoped to p_project_id: an id that already exists under a
-- different project raises (primary-key violation on insert) instead of
-- being re-pointed. Photos are update-only — new photos are inserted by the
-- explicit "Adicionar foto" upload action, never by this function — and a
-- photo id that doesn't belong to this project raises.

create or replace function public.save_project_workspace(
  p_project_id uuid,
  p_status jsonb,
  p_work_items jsonb default '[]'::jsonb,
  p_incidents jsonb default '[]'::jsonb,
  p_photos jsonb default '[]'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_archived boolean;
  v_item jsonb;
  v_found boolean;
  v_deactivated boolean;
begin
  if p_project_id is null then
    raise exception 'project_id é obrigatório.' using errcode = '22023';
  end if;

  -- Archived = status 5, matching canEditProject in
  -- js/projects/project-status-rules.js (the client-side read-only rule).
  -- Enforced here too so a stale/forged client can't write to an archived
  -- or deleted project.
  select p.company_id,
         (p.status = 5 or p.deleted_at is not null)
    into v_company_id, v_archived
  from projects p
  join companies c on c.id = p.company_id
  where p.id = p_project_id
    and c.owner_id = auth.uid();

  if v_company_id is null then
    raise exception 'Projeto não encontrado ou sem permissão.' using errcode = '42501';
  end if;

  if v_archived then
    raise exception 'Projeto arquivado — só de leitura.' using errcode = '42501';
  end if;

  -- project_status_state ------------------------------------------------------
  if p_status is not null then
    insert into project_status_state (project_id, company_id, phase, progress_pct, summary, next_steps)
    values (
      p_project_id,
      v_company_id,
      coalesce(p_status->>'phase', ''),
      coalesce((p_status->>'progress_pct')::integer, 0),
      coalesce(p_status->>'summary', ''),
      coalesce(p_status->>'next_steps', '')
    )
    on conflict (project_id) do update set
      phase = excluded.phase,
      progress_pct = excluded.progress_pct,
      summary = excluded.summary,
      next_steps = excluded.next_steps;
  end if;

  -- project_work_items --------------------------------------------------------
  for v_item in select * from jsonb_array_elements(coalesce(p_work_items, '[]'::jsonb))
  loop
    v_deactivated := coalesce((v_item->>'deactivated')::boolean, false);

    update project_work_items set
      type = coalesce(v_item->>'type', ''),
      area = coalesce(v_item->>'area', ''),
      description = coalesce(v_item->>'description', ''),
      status = coalesce(v_item->>'status', 'pending'),
      include_in_reports = coalesce((v_item->>'include_in_reports')::boolean, true),
      deactivated_at = case
        when v_deactivated then coalesce(deactivated_at, now())
        else null
      end
    where id = (v_item->>'id')::uuid
      and project_id = p_project_id;

    v_found := found;

    if not v_found then
      -- A brand-new item explicitly removed before ever being saved has
      -- nothing to persist.
      if v_deactivated then
        continue;
      end if;

      insert into project_work_items (id, project_id, type, area, description, status, include_in_reports)
      values (
        (v_item->>'id')::uuid,
        p_project_id,
        coalesce(v_item->>'type', ''),
        coalesce(v_item->>'area', ''),
        coalesce(v_item->>'description', ''),
        coalesce(v_item->>'status', 'pending'),
        coalesce((v_item->>'include_in_reports')::boolean, true)
      );
    end if;
  end loop;

  -- project_incidents ---------------------------------------------------------
  for v_item in select * from jsonb_array_elements(coalesce(p_incidents, '[]'::jsonb))
  loop
    v_deactivated := coalesce((v_item->>'deactivated')::boolean, false);

    update project_incidents set
      description = coalesce(v_item->>'description', ''),
      status = coalesce(v_item->>'status', 'open'),
      resolved_at = case
        when coalesce(v_item->>'status', 'open') = 'resolved' then coalesce(resolved_at, now())
        else null
      end,
      include_in_reports = coalesce((v_item->>'include_in_reports')::boolean, true),
      deactivated_at = case
        when v_deactivated then coalesce(deactivated_at, now())
        else null
      end
    where id = (v_item->>'id')::uuid
      and project_id = p_project_id;

    v_found := found;

    if not v_found then
      if v_deactivated then
        continue;
      end if;

      insert into project_incidents (id, project_id, description, status, resolved_at, include_in_reports)
      values (
        (v_item->>'id')::uuid,
        p_project_id,
        coalesce(v_item->>'description', ''),
        coalesce(v_item->>'status', 'open'),
        case when coalesce(v_item->>'status', 'open') = 'resolved' then now() else null end,
        coalesce((v_item->>'include_in_reports')::boolean, true)
      );
    end if;
  end loop;

  -- project_photos (metadata/state only, never insert) ------------------------
  for v_item in select * from jsonb_array_elements(coalesce(p_photos, '[]'::jsonb))
  loop
    v_deactivated := coalesce((v_item->>'deactivated')::boolean, false);

    update project_photos set
      area = nullif(v_item->>'area', ''),
      description = nullif(v_item->>'description', ''),
      worker = nullif(v_item->>'worker', ''),
      stage = coalesce(v_item->>'stage', 'during'),
      include_in_reports = coalesce((v_item->>'include_in_reports')::boolean, true),
      deactivated_at = case
        when v_deactivated then coalesce(deactivated_at, now())
        else null
      end
    where id = (v_item->>'id')::uuid
      and project_id = p_project_id;

    if not found then
      raise exception 'Fotografia % não pertence a este projeto.', v_item->>'id' using errcode = '42501';
    end if;
  end loop;
end;
$$;

revoke execute on function public.save_project_workspace(uuid, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_project_workspace(uuid, jsonb, jsonb, jsonb, jsonb) to authenticated;
