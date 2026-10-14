# Privacy / Rights-Request Intake

Audit date: 2026-10-09

## Current state

| Route | Exists? | Evidence |
|---|---|---|
| Privacy contact on the public site | **No** | No email, form or link in `index.html`, `app.html`, `share.html` |
| In-app access / export | No | Users can view their own data in the app; no export |
| In-app correction | Yes, partly | Company, client, project and Estado da Obra data are editable. Frozen reports are not (by design) |
| In-app deletion | Very limited | Sign-out only; client delete only when it has no projects; projects archive/hide only; "Remover" is a soft delete. No account deletion |
| Route for end clients (people who receive share links) | No | Share page shows only the report |

## Temporary channel

**NEED USER INPUT.** No support/contact address exists in any authoritative repo/config source, so none can be documented as the rights-request channel. (The email inside `examples/report_example.pdf` is sample report data and must not be assumed to be a support address.)

Once the owner supplies an address, the minimum interim setup (no new feature) is:
1. Publish it in the landing footer and later in the Privacy Policy as the contact for privacy, access, correction and deletion requests.
2. Handle requests manually via the Supabase dashboard (owner-only — live data operations need human-owner authorisation per the governance charter).
3. Keep a simple manual log of requests and responses (where/how to be decided in the next phase).

Note for the next phase: end clients' data (client records, site addresses, photos) is entered by contractors; how requests from those people are routed (to the contractor vs to us) depends on the controller/processor decision flagged in FORM-AUDIT.md.
