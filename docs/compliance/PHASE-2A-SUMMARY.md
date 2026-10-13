# Phase 2A Summary — Data Governance + Operational Baseline

2026-10-09 · Branch `marketing_updates` · Documentation only (no code, schema or data changes). Engineering evidence for legal review, not legal advice or independent approval.

Documents: [CONTROLLER-PROCESSOR-MAP](CONTROLLER-PROCESSOR-MAP.md) · [PROCESSING-REGISTER](PROCESSING-REGISTER.md) · [DATA-FLOWS](DATA-FLOWS.md) · [RETENTION-MATRIX](RETENTION-MATRIX.md) · [DATA-RIGHTS-RUNBOOK](DATA-RIGHTS-RUNBOOK.md) · [BREACH-RUNBOOK](BREACH-RUNBOOK.md) · [SECURITY-TOMS](SECURITY-TOMS.md) · [SUBPROCESSORS](SUBPROCESSORS.md) · [OPEN-DECISIONS](OPEN-DECISIONS.md)

## Confirmed facts (from the repo)
- Single backend: Supabase project `haiwrmwpltzhdnrqzxep`; static site on GitHub Pages; no analytics, cookies, CDNs or Google requests; WhatsApp only as user navigation.
- Owner/company RLS on all tables; private-by-policy photo storage with 1-hour signed URLs; EXIF stripped.
- Reports generated server-side and immutable; photo/logo paths validated per project/company.
- Share links: hashed 256-bit tokens, 7-day expiry, revocable, service-role-only RPCs; telemetry = access count + last access only (no IP stored by our code).
- Deleting an auth user cascades through company data in the DB; **storage files do not cascade**; old logos and "removed" photos are kept by design.
- No account deletion, export, admin tooling, monitoring, CI or rotation process.
- Payments disabled; EuPago code hardened in repo but not deployed.

## Proposed positions (need legal review)
- **Controller** for account, auth, company-account, security logs, support and future billing.
- **Processor** for contractor project data (clients, projects, sites, workspace, workers, photos, reports, share links) → DPA needed; Supabase (and email provider) become subprocessors.
- **Context-dependent** for the company profile printed on reports and for "Visualizado" telemetry.
- Lawful-basis categories: CONTRACT for account/service; LEGITIMATE INTERESTS for security logs and the public site; telemetry and support = REVIEW.

## Missing facts
Legal entity details (name, address, NIF, contact/privacy email); Supabase region, DPA, backups, log retention, bucket public flag; auth-email provider; production domain; EuPago deployment; dashboard access/MFA; deploy controls. See OPEN-DECISIONS.md U* and I*.

## Product decisions
Client email/NIF/address; worker names on reports; mandatory archive reason; "Remover" semantics; all retention durations; immutable reports vs erasure; hidden-project recovery; account deletion/export at launch; telemetry notice; payments timing. (OPEN-DECISIONS.md P1–P13)

## Legal-review decisions
Controller/processor split; lawful bases (especially telemetry); retention periods incl. accounting minimums; rights deadlines and ID standard; old-PDF notification assessment if the data is real; share-page notice; "Livro de Projeto/Obra"; IMPIC/INCI.

## Likely engineering work discovered (not started)
1. Account deletion + export (DB cascade **and** storage purge of `{company_id}/`).
2. Storage purge for removed photos not referenced by any report; orphan cleanup.
3. Scheduled cleanup of expired share links / telemetry and soft-deleted items (after durations are set).
4. Version the live-only DB functions and the base schema in migrations.
5. Admin runbook tooling (SQL scripts) for rights requests; request log.
6. Monitoring/alerting; CI with the focused test suite; branch protection; dependency-update routine; key-rotation procedure.
7. Deploy hardened EuPago functions only together with the payments launch.

## Readiness for Phase 2B
| Document | Readiness | Why |
|---|---|---|
| Privacy Policy | **READY WITH PLACEHOLDERS** | Data categories, flows, storage, recipients and rights process are documented; placeholders needed for entity details, contact, Supabase region/transfers, retention periods and final lawful bases |
| Terms of Service | **READY WITH PLACEHOLDERS** | Product behaviour and claims are documented; placeholders for entity, pricing/payments (disabled), termination/data-export terms, governing law |
| DPA | **NOT READY** | Depends on the controller/processor position (legal review), subprocessor facts (region, DPA status, email provider) and retention/deletion commitments we cannot technically honour yet (no deletion/export, storage not cascaded) |
