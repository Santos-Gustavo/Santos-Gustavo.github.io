-- CLIENT-SHARE-LINK-001 — Phase 2: data + access layer.
-- See docs/features/CLIENT-SHARE-LINK-001.md §3.2-3.3 for the design this implements.

-- gen_random_bytes()/digest() (used for token generation/hashing below) come from
-- pgcrypto, not core Postgres. gen_random_uuid() alone (already used elsewhere in this
-- schema) doesn't require it, so it may not actually be enabled yet.
create extension if not exists pgcrypto;

create table public.report_share_links (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,

  token_hash text not null unique,

  expires_at timestamptz not null,
  revoked_at timestamptz,

  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),

  last_accessed_at timestamptz,
  access_count integer not null default 0,

  constraint report_share_links_expires_after_created check (expires_at > created_at)
);

create index idx_report_share_links_report_id on public.report_share_links(report_id);
create index idx_report_share_links_token_hash on public.report_share_links(token_hash);
create index idx_report_share_links_expires_at on public.report_share_links(expires_at)
  where revoked_at is null;

alter table public.report_share_links enable row level security;

-- Authenticated owners can see their own reports' share links (e.g. "does this report
-- already have a live link" UI state). No insert/update/delete policy is added: every
-- mutation goes through the SECURITY DEFINER RPCs below, called only by the service-role
-- client inside the create/revoke Edge Functions. No anon policy exists on this table —
-- the public read flow never queries it directly, only through get_report_by_share_token.
create policy "report_share_links_select_own"
on public.report_share_links
as permissive
for select
to authenticated
using (
  exists (
    select 1
    from reports r
    join projects p on p.id = r.project_id
    join companies c on c.id = p.company_id
    where r.id = report_share_links.report_id
      and c.owner_id = auth.uid()
  )
);

-- Generates a fresh capability token for a report the caller owns, storing only its
-- sha256 hash. Returns the raw token exactly once — callers must persist/display it
-- immediately, it can never be recovered afterwards. p_user_id is supplied by the caller
-- (the create-report-share-link Edge Function, after verifying the caller's JWT) rather
-- than read from auth.uid(), because this function runs as SECURITY DEFINER and is only
-- reachable via the service-role client — see grant below.
create or replace function public.create_report_share_link(
  p_report_id uuid,
  p_user_id uuid,
  p_ttl_hours int default 168
)
returns table (id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owns boolean;
  v_token text;
  v_expires_at timestamptz;
  v_id uuid;
begin
  select exists (
    select 1
    from reports r
    join projects p on p.id = r.project_id
    join companies c on c.id = p.company_id
    where r.id = p_report_id
      and r.deleted_at is null
      and c.owner_id = p_user_id
  ) into v_owns;

  if not v_owns then
    return;
  end if;

  -- 256 bits of randomness, base64url-encoded (no +, /, = — safe in a URL fragment
  -- and in a wa.me query string without any additional escaping surprises).
  v_token := translate(encode(gen_random_bytes(32), 'base64'), '+/', '-_');
  v_token := regexp_replace(v_token, '=+$', '');

  v_expires_at := now() + make_interval(hours => greatest(p_ttl_hours, 1));

  insert into public.report_share_links (report_id, token_hash, expires_at, created_by)
  values (p_report_id, encode(digest(v_token, 'sha256'), 'hex'), v_expires_at, p_user_id)
  returning report_share_links.id into v_id;

  return query select v_id, v_token, v_expires_at;
end;
$$;

-- Validates a token (by its hash — the raw token is never passed to SQL by anything
-- other than the Edge Function that just minted it) and returns the report row it
-- resolves to, or nothing at all for expired/revoked/unknown tokens — the caller
-- (get-shared-report) collapses every one of those into the same generic response,
-- per docs/features/CLIENT-SHARE-LINK-001.md AC-01.8/AC-03.1.
create or replace function public.get_report_by_share_token(
  p_token_hash text
)
returns table (report_id uuid, snapshot_json jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link record;
begin
  select id, report_id, expires_at, revoked_at
  into v_link
  from report_share_links
  where token_hash = p_token_hash;

  if not found then
    return;
  end if;

  if v_link.revoked_at is not null or v_link.expires_at <= now() then
    return;
  end if;

  update report_share_links
  set last_accessed_at = now(),
      access_count = access_count + 1
  where id = v_link.id;

  return query
  select r.id, r.snapshot_json
  from reports r
  where r.id = v_link.report_id
    and r.deleted_at is null;
end;
$$;

-- Revokes a link the caller owns (via the same report -> project -> company chain used
-- everywhere else). Idempotent: revoking an already-revoked link is a no-op success,
-- not an error.
create or replace function public.revoke_report_share_link(
  p_link_id uuid,
  p_user_id uuid
)
returns table (revoked_link_id uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update report_share_links as l
  set revoked_at = coalesce(l.revoked_at, now())
  from reports r
  join projects p on p.id = r.project_id
  join companies c on c.id = p.company_id
  where l.id = p_link_id
    and l.report_id = r.id
    and c.owner_id = p_user_id
  returning l.id;
end;
$$;

-- These three functions accept a caller-supplied user id / a bare token hash and do
-- their own authorization — they must only ever be reachable via the service-role
-- client inside their Edge Functions, never directly by anon or authenticated callers
-- (which would let a caller pass an arbitrary p_user_id and bypass the Edge Function's
-- own JWT verification entirely).
revoke execute on function public.create_report_share_link(uuid, uuid, int) from public, anon, authenticated;
revoke execute on function public.get_report_by_share_token(text) from public, anon, authenticated;
revoke execute on function public.revoke_report_share_link(uuid, uuid) from public, anon, authenticated;

grant execute on function public.create_report_share_link(uuid, uuid, int) to service_role;
grant execute on function public.get_report_by_share_token(text) to service_role;
grant execute on function public.revoke_report_share_link(uuid, uuid) to service_role;
