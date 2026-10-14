# Retention Matrix — PROPOSAL ONLY

Phase 2A · 2026-10-09 · Nothing here is implemented. No durations are proposed where Product input is needed; they are marked `[Product: X]`. "Contractor-controlled" data follows the controller/processor position in CONTROLLER-PROCESSOR-MAP.md (PROPOSED: we are processor, so the contractor's instructions + our Terms/DPA decide).

Relevant facts (CONFIRMED in repo / live schema snapshot):
- Deleting an auth user cascades: `companies` (owner_id) → `clients`, `projects`, `payments` → `reports`, `report_share_links`, `project_status_events`, workspace tables. **Storage objects are not cascaded** (separate system).
- `projects → clients` is `RESTRICT`: a client with projects cannot be deleted.
- Workspace tables have **no delete policy**: users can only soft-delete (`deactivated_at`).
- Reports are immutable (`guard_report_snapshot`).

| Category | Current behaviour | Proposed retention rule | Reason | Deletion / anonymisation method | Product decision? | Legal review? |
|---|---|---|---|---|---|---|
| Inactive accounts | Kept indefinitely; no deletion feature | Delete after `[Product: X months]` of inactivity, with prior email warnings, unless a subscription/legal hold applies | Minimisation; storage cost | Delete auth user (cascade) **plus** storage purge of `{company_id}/` | YES | YES |
| Account closure on request | Manual only (dashboard) | Delete within `[Product/legal: N days]` of verified request, after giving the contractor an export option | Rights; contract end | As above; confirm cascade covers all tables | YES | YES |
| Clients | Hard delete only without projects; archive keeps all fields | Keep while the contractor keeps them; delete with the account | Contractor-controlled | Row delete; past reports keep the client **name** in snapshots | YES (also: drop unused email/NIF/address?) | YES |
| Active projects | Kept | Keep while active | Core service | — | NO | NO |
| Archived / hidden projects | Kept indefinitely, hidden projects not recoverable in UI | Keep `[Product: X years]` after archive, then delete or anonymise on contractor instruction | Evidence vs minimisation | Project delete (cascade) + storage purge (delete-project function exists, not wired) | YES | YES |
| `project_status_state` | One row per project, overwritten on save | Same lifetime as the project | Current state only | Cascade with project | NO | NO |
| Work items / incidents | Soft delete (`deactivated_at`), rows kept | Purge soft-deleted rows after `[Product: X days]` **unless** referenced by a report (`first_report_id`) | Minimisation | Scheduled purge (not built) | YES | NO |
| Photos / storage objects | "Remover" = soft delete; file kept; logos never deleted | Delete file + row `[Product: X days]` after removal **if not used in any report**; otherwise keep while the report is kept | Minimisation vs report integrity | Storage delete + row delete; needs "is this path in any snapshot?" check | YES | YES |
| Immutable reports | Kept indefinitely; cascade only on project/company delete | Keep for `[Product/legal: X years]` (candidate: contractual/warranty horizon of construction work) | Evidence of what was sent | Delete with project/account, or anonymise client fields at end of retention | YES | YES |
| Share links | Expire after 7 days or revoke; rows kept | Delete rows `[Product: X days]` after expiry/revocation | Token hash and telemetry have no use after expiry | Row delete (scheduled) | YES | NO |
| Access telemetry (count, last access) | Stored on the link row, kept with it | Same as share links | Only meaningful while the link is relevant | With link row | YES | YES (role, see map) |
| Authentication / security logs | Platform-defined (Supabase, GitHub) | Accept platform defaults if documented; record them | Security | Platform | NO | YES |
| Edge Function logs | Platform-defined | As above | Debugging | Platform | NO | NO |
| Support / privacy requests | No channel yet | Keep request + response log `[Legal: X years]` as accountability evidence | Prove rights were handled | Manual log (see runbook) | YES | YES |
| Payment data (disabled) | `payments` rows kept indefinitely; historical rows may hold raw payloads | Keep invoice-relevant fields for the accounting period required by law `[Legal]`; drop raw payloads after `[Product: X days]` | Legal obligation vs minimisation | Column null-out for raw payloads (no schema change needed) | YES | YES |
| Backups | Unknown (Supabase plan/PITR: NEEDS DASHBOARD CHECK) | Document the provider's backup window; deleted data persists in backups until rotation | Recovery | Provider rotation | NO | YES (must be disclosed) |
| Browser localStorage session | Until sign-out/expiry | No change | Essential | Sign-out | NO | NO |

## Conflicts: historical evidence vs minimisation / erasure (not resolved here)

1. **Immutable reports vs erasure.** The product promise "O que foi enviado fica como foi enviado" means snapshots keep client name, site address and photo paths after the live record changes. An erasure request for a client cannot be honoured by editing reports without breaking immutability. Options for Product/legal: delete whole reports, anonymise client fields in snapshots (breaks byte-identical history), or keep under a documented exemption.
2. **Photos used in reports vs "Remover".** Removed photos stay in storage partly because past reports point to them. Deleting files would leave old reports with missing images.
3. **Logos.** Old logo files are kept so historical reports keep their branding.
4. **Archived/hidden projects as dispute evidence** vs indefinite retention of end-client data. The contractor (controller) should set the period, but the product must offer a mechanism.
5. **Share telemetry** is part of the record the contractor may rely on ("the client was sent / opened it") vs minimisation after expiry.
6. **Account deletion vs storage.** The DB cascade deletes rows, but storage objects survive → orphaned personal data unless a storage purge runs too.
7. **Backups** keep deleted data until rotation; erasure is never instant.
