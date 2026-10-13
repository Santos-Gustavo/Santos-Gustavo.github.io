# Data-Subject Rights Runbook (manual, first launch)

Phase 2A · 2026-10-09 · Operational procedure for the owner. Not legal advice; deadlines and exemptions to be confirmed in legal review. **No self-service tooling exists** — everything below is manual via the Supabase dashboard (SQL editor / Storage) by the human owner. Live data operations require human-owner authorisation per the governance charter.

## Common steps (apply to every request)

1. **Intake** — requests arrive at the privacy contact (address: NEEDS USER INPUT). Log on receipt: date, requester, channel, request type, deadline (legal deadline to confirm — NEEDS LEGAL REVIEW).
2. **Identity verification**
   - *Account holder:* request must come from the account email, or the owner replies to that email and waits for confirmation.
   - *End client (not a user):* ask for the report link they received or details only the contractor and client would know; never disclose data before verification. Do not ask for more ID than necessary.
3. **Role check** (CONTROLLER-PROCESSOR-MAP.md)
   - Account, auth, company-account, support, billing data → **we are controller (PROPOSED)** → we answer.
   - Client, project, photo, report, share data → **contractor is controller (PROPOSED)** → forward to the contractor without undue delay, tell the requester we did so, and assist the contractor on instruction. Do not act on contractor data on an end client's sole instruction.
4. **Locate data** (by `owner_id` / `company_id`):
   - `auth.users` (email) → `companies.owner_id` → `company_id`
   - `clients`, `projects` (by `company_id`) → `project_status_state`, `project_work_items`, `project_incidents`, `project_photos`, `photos`, `project_status_events`, `reports.snapshot_json`, `report_share_links` (via `reports.project_id`)
   - Storage: bucket `project-photos`, prefix `{company_id}/`
   - `payments` (by `company_id`, disabled feature)
   - For an end client: search `clients.name/email/phone`, and **free text** (summaries, incidents, next steps, captions, archive reasons, report snapshots) — there is no index or search tool for this.
   - Logs: Supabase / GitHub dashboards (limited control).
5. **Customer involvement** — when the contractor is controller: send them the request, the data located (if they ask) and wait for written instructions; record them.
6. **Response / action** — per right, below.
7. **Record completion** — log the date, actions taken, tables/paths touched, who authorised, and the reply sent. Keep the log (retention: RETENTION-MATRIX.md, legal TBD).

## Per right

| Right | Applies to (we = controller) | Action | Technical notes / difficulty |
|---|---|---|---|
| **Access** | Account + company + any project data for the account holder (their own business data) | SQL export of the rows above to JSON/CSV; list storage files; provide copies or signed links | No export tool; JSONB snapshots are readable but raw. Photos must be downloaded one by one or via script |
| **Correction** | Account email (Auth dashboard), company profile (user can edit in app) | Point the user to the in-app edit; correct auth email in the dashboard | **Reports are immutable** — corrections apply to future reports only; old snapshots cannot be edited (trigger) without a deliberate exception |
| **Deletion** | Account and everything under it (on the account holder's request; also the contract end) | 1) offer export; 2) delete storage prefix `{company_id}/`; 3) delete the auth user (cascades DB rows) | **Storage is not cascaded** — must be purged first or files are orphaned. Cascade order must be checked (`project_status_events.changed_by`, `report_share_links.created_by` reference `auth.users` without cascade — expected to clear via the company cascade in the same statement; verify on a test project). The `delete-project` function exists but is not wired; its live RPCs are not in the repo. Backups retain data until rotation |
| **Deletion (end client, via contractor)** | Contractor-controlled | Contractor deletes the client (only possible with no projects) or asks us to | Client name/site persist in **immutable report snapshots**; free-text mentions are not findable systematically; soft-deleted items/photos remain → conflict listed in RETENTION-MATRIX.md |
| **Restriction** | Account data | Mark the account (no flag exists) and avoid processing; for project data, contractor decides | No "restricted" state in the schema; could only be done by archiving + a manual note, or by disabling the user in Supabase Auth |
| **Objection** | Processing on legitimate interests (logs, possibly telemetry) | Assess; stop where required | Telemetry cannot be switched off per link or per recipient today |
| **Portability** | Data the user provided, processed by contract/consent, by automated means | Machine-readable export (JSON) of account, company, clients, projects, workspace items, report snapshots, photo files | Same as access; no tooling |

## Known architectural gaps (for Phase 2B / engineering)
1. No account deletion or export feature; no admin tooling — every request is hand-written SQL by the owner.
2. Storage objects are not linked to DB cascades; logos and removed photos are kept by design.
3. Immutable snapshots conflict with correction/erasure.
4. Free-text fields make end-client data hard to locate.
5. No "restricted" state; telemetry has no opt-out.
6. Live DB functions (`begin_project_delete`, `finalize_project_delete`, `get_authorized_photo_storage_path`, `delete_authorized_photo`) are not versioned in the repo — their behaviour cannot be verified here.
7. No request log or privacy mailbox exists yet.
