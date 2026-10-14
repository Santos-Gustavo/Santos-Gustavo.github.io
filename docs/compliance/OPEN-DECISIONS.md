# Open Decisions (before Phase 2B)

Phase 2A · 2026-10-09 · Owner of each decision in brackets. Nothing here has been decided; no code or schema was changed.

## Product
| # | Decision | Context / options | Blocks |
|---|---|---|---|
| P1 | Client **email**: keep / remove / keep optional? | Collected, not used by reports or features | Minimisation statement in Privacy Policy |
| P2 | Client **NIF**: keep / remove / optional? | Not used; tax ID of a private person | Same |
| P3 | Client **address**: keep / remove / optional? | Not used (site address is on the project) | Same |
| P4 | **Worker name** printed on reports ("Responsável: …")? | Discloses employees/subcontractors to end clients | Report content description |
| P5 | Archive/hide **reason mandatory**? | Free text stored in history | Minimisation |
| P6 | Photo **"Remover"** semantics | Today: hide, file kept forever. Options: delete file if unused in reports; purge after N days | Retention + rights runbook |
| P7 | **Retention durations**: historical reports, photos, archived projects, inactive accounts, expired share links, soft-deleted items | See RETENTION-MATRIX.md | Privacy Policy, DPA |
| P8 | **Hidden-project recovery** (no un-hide in UI) | Add un-hide, or state irreversibility | Dark-pattern item |
| P9 | **Payments launch** timing (EuPago) | Disabled; needs contract, terms, pricing | Terms (billing section) |
| P10 | Immutable reports vs **erasure** | Delete whole report / anonymise snapshot / keep under exemption | Rights runbook, DPA |
| P11 | **Account deletion & export** feature, or manual-only at launch? | Manual today | Rights, Terms (termination) |
| P12 | "Visualizado" telemetry: keep as is / add notice on share page / opt-out? | Role unclear | Privacy Policy |
| P13 | Sample PDF shows v2 layout (not live yet) | Keep / regenerate after Option A | Marketing accuracy |

## Legal / text
| # | Decision | Context |
|---|---|---|
| L1 | "Livro de Projeto" (report disclaimer) vs "livro de obra" (landing FAQ) | Carried from earlier phases |
| L2 | "IMPIC / Alvará" (form label) vs "INCI n.º" (report) | Label consistency |
| L3 | Controller/processor positions | CONTROLLER-PROCESSOR-MAP.md (PROPOSED) |
| L4 | Lawful bases | PROCESSING-REGISTER.md (category proposals; telemetry, support, logs = REVIEW) |
| L5 | Retention periods incl. accounting/legal minimums for billing | RETENTION-MATRIX.md |
| L6 | Old example PDF: if data is real, notification assessment | BREACH-RUNBOOK.md worked example |
| L7 | Rights-request deadlines, ID-verification standard | DATA-RIGHTS-RUNBOOK.md |
| L8 | Whether a share-page notice for end clients is needed/advisable | Contractor is (PROPOSED) controller |

## User / company
| # | Fact needed |
|---|---|
| U1 | Legal / operator name (sole trader or company) |
| U2 | Legal address |
| U3 | NIF / company registration number |
| U4 | Public contact email |
| U5 | Phone (publish or not) |
| U6 | Privacy / rights-request email |
| U7 | Is the data in the old example PDF real, and whose is it? |
| U8 | Intended licence for the code (`package.json` says ISC) |

## Infrastructure (NEEDS DASHBOARD CHECK unless stated)
| # | Fact needed |
|---|---|
| I1 | Production Supabase region |
| I2 | Supabase DPA accepted/signed? Plan tier? |
| I3 | Auth email provider (built-in vs custom SMTP) and email-confirmation setting |
| I4 | Production hostname / custom domain (NEEDS USER INPUT) |
| I5 | EuPago functions deployed? Historical `payments` rows with raw payloads / API key? |
| I6 | Storage bucket `project-photos` "public" flag = off? |
| I7 | Backups / PITR and retention; restore ever tested? |
| I8 | Platform log retention (Auth, API, Edge Functions) |
| I9 | Dashboard access: who, MFA on? |
| I10 | Is `delete-project` deployed; do `begin/finalize_project_delete` cover `project_photos` and logos? |
| I11 | Branch protection / deploy controls on `main` (NEEDS USER INPUT) |
