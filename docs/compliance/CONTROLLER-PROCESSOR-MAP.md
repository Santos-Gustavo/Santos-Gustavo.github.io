# Controller / Processor Map

Phase 2A · 2026-10-09 · Engineering analysis to prepare legal review, **not** a legal conclusion. "We" = the operator of RelatórioObra (legal entity: NEEDS USER INPUT). "Contractor" = the business customer using the app. "End client" = the contractor's customer who receives reports.

Status labels: CONFIRMED (verified in repo) · PROPOSED (engineering view) · NEEDS USER INPUT · NEEDS LEGAL REVIEW.

## Summary (PROPOSED)

- **We decide** why and how account, authentication, security, support and (future) billing data are processed → likely **CONTROLLER** for the SaaS operation.
- **The contractor decides** which clients, sites, works, workers and photos to record, what goes into each report and whom to share it with → we likely act as **PROCESSOR** on the contractor's behalf for project data.
- The grey zone is data we generate ourselves inside the contractor's workflow (share-link access telemetry, the company profile printed on reports) → **CONTEXT-DEPENDENT / NEEDS LEGAL REVIEW**.

## A. Account / SaaS operation

| Data | Whose data? | Why processed | Who determines purpose | Likely role | Explanation | Legal review? |
|---|---|---|---|---|---|---|
| User email + password hash (Supabase Auth) | Contractor's user (natural person, often the owner of a sole-trader business) | Sign-in, password reset, service messages | Us | CONTROLLER (PROPOSED) | We define the account model and its use | YES (confirm) |
| Session tokens (localStorage `sb-…-auth-token`) | Contractor's user | Keep the user signed in | Us | CONTROLLER (PROPOSED) | Essential operation of our service | NO (factual) |
| Company profile: name, NIF, IMPIC/Alvará, responsible, phone, email, address, logo, slogan | Contractor business; responsible/phone/email are often a natural person | (a) Operate the account; (b) printed on the contractor's reports to end clients | (a) Us; (b) Contractor chooses what to print | BOTH/CONTEXT-DEPENDENT | We hold it as account data, but its main use is the contractor's own client communication | YES |
| Security / technical logs (Supabase auth logs, Edge Function logs, GitHub Pages access logs) | Users, and end clients opening share links | Security, debugging, abuse prevention | Us (and infrastructure providers) | CONTROLLER (PROPOSED) | Our own operational purpose. Exact log content and retention are platform-side: NEEDS USER INPUT (dashboard) | YES |
| Support / privacy requests (manual, channel not set up yet) | Users; possibly end clients | Respond to requests | Us | CONTROLLER (PROPOSED) | Our own purpose. Requests about project data may need forwarding to the contractor (see runbook) | YES |
| Future billing / payment data (EuPago, **DISABLED**) | Contractor business; MB WAY phone of a person | Subscription billing | Us | CONTROLLER (PROPOSED); EuPago = our processor or independent controller — NEEDS LEGAL REVIEW | Not live (UI commented out) | YES before launch |

## B. Customer-controlled project data

| Data | Whose data? | Why processed | Who determines purpose | Likely role | Explanation | Legal review? |
|---|---|---|---|---|---|---|
| Client records (name, phone, email, NIF, address) | End clients (often private individuals) | Contractor's customer management and report header | Contractor | PROCESSOR (PROPOSED) | Contractor decides whether to record clients and which fields | YES |
| Projects (name, site address, contract no./value, dates, notes) | End clients (site = often their home); contractor | Contractor's project management | Contractor | PROCESSOR (PROPOSED) | — | YES |
| Site addresses | End clients | Identify the site in the app and reports | Contractor | PROCESSOR (PROPOSED) | Required field in the UI (product choice, CONFIRMED) | YES |
| Work items, incidents, summaries, next steps (free text) | Mostly contractor; may mention end clients, workers, neighbours | Record site status; feed reports | Contractor | PROCESSOR (PROPOSED) | Free text may include anything the contractor types | YES |
| Worker names (photo "Trabalhador") | Contractor's employees/subcontractors | Attribute work; printed on reports as "Responsável" | Contractor | PROCESSOR (PROPOSED) | — | YES |
| Photos (private bucket `project-photos`) | Property of end clients; may show people, vehicles, interiors | Evidence of work; selected photos go into reports | Contractor | PROCESSOR (PROPOSED) | EXIF/GPS stripped on upload (CONFIRMED) | YES |
| Reports (immutable `snapshot_json`) | All of the above | Contractor's communication with end client | Contractor | PROCESSOR (PROPOSED) | We keep the snapshot because the product promises immutable history; the contractor initiates generation | YES |
| Share links (token hash, expiry, revocation) | Contractor (creator); end client (recipient) | Let the end client view a report without an account | Contractor decides to share; we design the mechanism | PROCESSOR (PROPOSED) | — | YES |
| Archive/hide reasons, status events | Contractor; may mention end clients | Project lifecycle history | Contractor (we make the reason mandatory — product choice) | PROCESSOR (PROPOSED) | Mandatory field is our design decision → REVIEW minimisation | YES |

## C. Telemetry

| Data | Whose data? | Why processed | Who determines purpose | Likely role | Explanation | Legal review? |
|---|---|---|---|---|---|---|
| "Visualizado" status | End client (indirectly: whether *someone* opened the link) | Tell the contractor the link was opened | Feature designed by us; consumed by contractor | BOTH/CONTEXT-DEPENDENT · NEEDS LEGAL REVIEW | No identity, IP or device is stored by our code (CONFIRMED); the signal is still about the recipient's behaviour | YES |
| Access count | Same | Same | Same | BOTH/CONTEXT-DEPENDENT | `report_share_links.access_count` (CONFIRMED) | YES |
| Last accessed time | Same | Same | Same | BOTH/CONTEXT-DEPENDENT | `report_share_links.last_accessed_at` (CONFIRMED) | YES |

## Consequences to settle in Phase 2B (NEEDS LEGAL REVIEW)
1. If we are processor for project data, a **DPA with each contractor** (Terms + DPA annex) is needed, and our processors (Supabase etc.) become **subprocessors**.
2. Contractors, as controllers, owe their end clients transparency; whether and how we help (e.g. a note on the share page) is a product/legal choice.
3. Rights requests from end clients should normally be routed to the contractor (see DATA-RIGHTS-RUNBOOK.md).
4. The telemetry position must be fixed before the Privacy Policy describes "Visualizado".
