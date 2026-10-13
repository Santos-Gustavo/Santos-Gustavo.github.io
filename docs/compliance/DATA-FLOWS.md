# Data Flows

Phase 2A · 2026-10-09 · Actual architecture only, from the repository (branch `marketing_updates`). Hosting of static files: GitHub Pages (`santos-gustavo.github.io`, from hard-coded URLs). Backend: Supabase project `haiwrmwpltzhdnrqzxep` (region NEEDS DASHBOARD CHECK). No other runtime third parties (see THIRD-PARTIES.md sweep).

## 1. Sign-up / sign-in
```
Contractor browser (app.html, vendored supabase-js 2.117.3)
  → Supabase Auth (email + password over HTTPS)
  ← session (access + refresh token) → stored in localStorage key sb-<ref>-auth-token
  → Supabase Auth email (confirmation, if enabled in the dashboard) → contractor's inbox
```

## 2. Password reset
```
Contractor browser → supabase.auth.resetPasswordForEmail(email, redirectTo = https://santos-gustavo.github.io/reset-password.html)
  → Supabase Auth sends email (provider NEEDS USER INPUT) → inbox
Inbox link → reset-password.html (vendored supabase-js) → supabase.auth.updateUser({ password }) → Supabase Auth
```

## 3. Company, client and project data
```
Contractor browser → Supabase PostgREST (JWT) → Postgres tables
  companies, clients, projects, project_status_events (direct table access, owner/company RLS)
  project_status_state, project_work_items, project_incidents, project_photos
    → written through save_project_workspace RPC (one transaction; authenticated only)
```

## 4. Photos and logo
```
Contractor picks image → browser re-encodes via canvas (≤1600 px JPEG; EXIF/GPS dropped)
  → Supabase Storage, private bucket project-photos
     {company_id}/{project_id}/workspace/<file>          (Estado da Obra photos)
     {company_id}/{project_id}/reports/<report>/<file>   (legacy wizard photos)
     {company_id}/company/logo-<uuid>.png                (logo; 1:1 PNG, old files kept)
  → project_photos / photos rows hold the storage_path
Viewing in the app → createSignedUrl(s), 1-hour expiry, refreshed after 55 min
```

## 5. Report generation (immutable snapshot)
```
"Gerar relatório" → generate_report RPC (server-side, authenticated)
  reads project + client name + company + Estado da Obra (only include_in_reports / is_client_visible photos,
  photo paths validated against the project folder, logo path validated)
  → inserts reports.snapshot_json (guard_report_snapshot trigger blocks later edits)
App preview → renderReportHtml(snapshot) in the browser (v1/v2 renderer; fonts self-hosted)
```

## 6. Client report sharing
```
Contractor → Edge Function create-report-share-link (JWT)
  → RPC create_report_share_link (service_role only): 32 random bytes token, SHA-256 hash stored,
    expires in 168 h → raw token returned once
Contractor copies link https://<host>/share.html#token=<token>   (token in URL fragment: not sent to the host)
  → sends it by any channel (e.g. WhatsApp, user-initiated)
End-client browser → share.html (no account, no cookies, noindex, no-referrer)
  → POST token to Edge Function get-shared-report
  → RPC get_report_by_share_token (service_role only): checks hash, expiry, revocation;
    increments access_count, sets last_accessed_at
  ← snapshot + 1-hour signed URLs for report photos and logo
  → rendered in a sandboxed iframe (allow-scripts allow-modals, no same-origin)
Contractor app ← report_share_links status (Visualizado / Não visualizado, count, last access)
Revoke → Edge Function revoke-report-share-link → RPC (service_role only)
```

## 7. WhatsApp
```
Contractor taps "WhatsApp" → browser navigates to https://wa.me/?text=<message + share URL>
```
User-initiated navigation only. No API, SDK or data sent by us; the user's WhatsApp app sends the message.

## 8. Payments — DISABLED
```
(UI buttons commented out in app.html; initPayments() listener idle)
If enabled: browser → Edge Function create-eupago-payment (JWT) → payments row → EuPago REST API
  (Multibanco reference, or MB WAY push using the payer's phone) → allowlisted response stored
EuPago → Edge Function eupago-webhook (chave_api required) → payments.status = paid → companies.subscription_*
```
Deployment status of both functions: NEEDS DASHBOARD CHECK. Repo fixes are not deployed.

## 9. Project deletion (exists, not exposed)
```
Edge Function delete-project → begin_project_delete RPC (live DB only, body not in repo)
  → Storage batch delete of returned paths → finalize_project_delete RPC
```
Not called by the app UI. Whether it is deployed and whether it covers `project_photos`/logo paths: NEEDS DASHBOARD CHECK / REVIEW.

## 10. Logs
Supabase platform logs (auth, API, Edge Function `console.*`), GitHub Pages access logs. Content and retention are platform-defined: NEEDS DASHBOARD CHECK.
