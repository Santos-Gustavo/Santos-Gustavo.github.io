# Security / TOM Baseline

Phase 2A · 2026-10-09 · Technical and organisational measures that can be **proven from the repository** (code, migrations, checked-in live-schema snapshot `supabase/manual/live_schema_rls_baseline.sql`, tests). Anything that depends on dashboard settings is marked NEEDS DASHBOARD CHECK and is **not** claimed.

## Implemented controls (CONFIRMED in repo)

| Control | Evidence | Notes |
|---|---|---|
| Authentication | Supabase Auth email/password (`js/auth/auth.js`); every data call carries the user JWT | Min. password length 6 is app-side only; server password policy, email confirmation, MFA, rate limits: NEEDS DASHBOARD CHECK |
| RLS / company isolation | RLS enabled on all public tables (baseline snapshot); policies require `companies.owner_id = auth.uid()`; new workspace tables have own RLS (`20261005120000_…`); tests `rls-isolation`, `rls-security`, `rls-estado-da-obra-workspace`, `client-share-link-isolation` | `force_rls` is false (table owner bypass) — normal for Supabase but noted |
| No hard delete on workspace tables | Delete policies dropped (`20261006120000_…remove_delete_policies.sql`) | Integrity measure; conflicts with erasure (RETENTION-MATRIX.md) |
| Private photo storage | Storage policies on bucket `project-photos` are `to authenticated` + company-folder check (baseline snapshot); app never calls `getPublicUrl` | Bucket-level "public" flag: NEEDS DASHBOARD CHECK |
| Signed, short-lived access | `createSignedUrl(s)` 1 hour in app (`storage-service.js`) and share function (`get-shared-report`) | |
| Canonical server-generated reports | `generate_report` RPC builds the snapshot server-side; `authenticated` only, `anon` revoked | |
| Immutable snapshots / report write guards | `guard_report_snapshot` trigger: "Relatório já gerado — o conteúdo não pode ser alterado"; blocks archived projects and invalid project ids; `prevent_report_insert_on_deleted_project` | |
| Project-scoped photo validation | `enforce_project_photo_storage_path` trigger + checks in `generate_report`/guard (photo must be under the project's folder); `enforce_company_logo_path` for logos | Prevents cross-project/company file references |
| Transactional workspace saves | `save_project_workspace` RPC (single function call = one transaction), `anon` revoked | |
| Share links | 32-byte random token, only SHA-256 hash stored, 7-day expiry, revocation; RPCs executable by `service_role` only, via Edge Functions; share page `noindex`, `no-referrer`; token in URL fragment; report rendered in sandboxed iframe without `allow-same-origin`; static check `check:share-boundary` keeps app code out of the public bundle | |
| Secret handling | Only the publishable key + URL ship to browsers (`js/config/env.js`); service-role key used only inside Edge Functions/tests (`.env` gitignored, `.env.example` documents it); no service-role reference in `js/` or HTML | Secret storage in Supabase dashboard not verifiable here |
| Vendored frontend dependencies | supabase-js 2.117.3, Paged.js 0.4.3, Inter fonts served first-party; no CDN or Google requests (guard tests) | Removes third-party script supply-chain risk at runtime |
| Sanitised error handling / logging | EuPago functions: allowlisted logs/storage, generic browser errors, mandatory webhook secret (repo, **not deployed**) | Other Edge Functions log `console.error` with DB error objects and return generic-ish messages — not audited in detail |
| Input escaping in reports | `escapeHtml` on all interpolations in both renderers | |
| EXIF/GPS stripping | Canvas re-encode of photos and logos before upload | Privacy measure |
| Automated tests | Playwright E2E suite incl. RLS/isolation, share-link expiry/revocation/invalid token/read-only boundary, payments read-only boundary | Run manually; no CI configured |

## Gaps (cannot be proven or not in place)

| Area | Status | Notes |
|---|---|---|
| Backup / recovery | NEEDS DASHBOARD CHECK | Supabase plan, PITR, backup retention, restore ever tested? No documented procedure |
| Admin / internal access | GAP | Single owner with Supabase dashboard/SQL access; no documented access list, MFA status unknown, no audit of admin actions |
| Live DB functions not in repo | GAP | `begin_project_delete`, `finalize_project_delete`, `get_authorized_photo_storage_path`, `delete_authorized_photo`, `prevent_report_insert_on_deleted_project` bodies not versioned; base schema migration file is empty (`20260819162117_remote_schema.sql`) — schema is only captured as a manual snapshot |
| Dependency update process | GAP | No Dependabot/renovate; vendored libs updated by hand; no SRI needed now (first-party) |
| Monitoring | GAP | No uptime/error monitoring or alerting; logs only in the dashboard |
| Incident alerting | GAP | No alerts on auth anomalies, function errors, or storage spikes |
| Credential rotation | GAP | No rotation schedule; EuPago key may have been logged by the old webhook (if ever deployed) |
| Production deployment controls | GAP | GitHub Pages deploys from `main` on push; Edge Functions deployed manually by CLI; no CI, no required review, no branch protection known (NEEDS USER INPUT) |
| Rate limiting / abuse | NEEDS DASHBOARD CHECK | Share-token endpoint and auth rate limits are platform-side |
| Security headers on the site | GAP / platform | GitHub Pages does not allow custom CSP/HSTS headers; only `<meta>` (share page has `referrer`, `robots`) |
| Encryption at rest / in transit | Platform | HTTPS everywhere in code; at-rest encryption is a Supabase platform property — cite provider documentation in Phase 2B rather than claim it here |
| Organisational measures | GAP | No written access policy, confidentiality commitments, or training — single-person operation |
