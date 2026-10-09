# Forms + Consent Audit

Audit date: 2026-10-09 · Sources: `app.html`, `reset-password.html`, `index.html`, `js/auth/auth.js`, `js/projects/**`, `js/payments/payment.js`.

Summary: **no checkboxes, consent controls, pre-checked options or marketing opt-ins exist anywhere.** There is no newsletter, contact or marketing form. The landing page has no form at all (CTAs link to `app.html`). No legal-basis decisions are made here — they are flagged as `LB?` for the next phase.

| Form | Fields collected | Purpose evident from UI? | Required / optional | Checkbox / consent present | Pre-checked? | Marketing consent? | Issue / recommendation |
|---|---|---|---|---|---|---|---|
| **Sign-in** (`app.html` auth card) | Email, password | Yes ("Entre para guardar relatórios, projetos e fotografias.") | Both required | No | — | No | None |
| **Sign-up** (same card, "Criar conta" → confirm password) | Email, password, password confirmation | Partly — same intro line only | All required | No | — | No | No link to Privacy Policy / Terms at the point of collection (none exist yet). `LB?` account data. Raw Supabase error text (English, e.g. "User already registered") is shown → account-existence disclosure; REVIEW in security pass |
| **Password reset request** (same card) | Email | Yes (button label) | Required | No | — | No | None |
| **Reset password page** (`reset-password.html`) | New password | Yes | Required | No | — | No | Unstyled page, no privacy link — cosmetic |
| **Company profile** ("Dados da Empresa") | Company name*, slogan, NIF, IMPIC/Alvará, responsible person, phone, email, address, logo | Yes ("usado em todos os projetos e relatórios") | Name required, rest optional | No | — | No | Fields are printed on client-facing reports — UI says "usado … relatórios", which is adequate notice. Label says "IMPIC / Alvará" but reports print "INCI n.º" — consistency REVIEW. `LB?` responsible-person name/phone/email (natural person data even in a B2B account) |
| **Client create/edit** ("Novo Cliente") | Name*, phone, email, NIF, address | Partly — no explanation of why phone/email/NIF are collected | Name required, rest optional | No | — | No | Collects data **about the user's own customers** (third-party data subjects). `LB?` / controller-vs-processor role decision needed for next phase. NIF / phone / email are not used by reports or sharing → see DATA-MINIMISATION.md |
| **Project create** ("Dados do Projeto") | Project name*, client*, site address*, contract no., distributed to, sent via (select) | Yes ("guardados para uso futuro") | 3 required | No | "Enviado via" defaults to WhatsApp — a report metadata value, not a consent choice | No | Site address is required — it is often the client's home address. `LB?` |
| **Estado da Obra** workspace | Phase, progress, summary, next steps; work items (type, area, description, status); incidents (description); photos (caption, area, **worker name**, stage, include-in-report toggle) | Yes | Optional | "Incluir no relatório" toggles — functional, not consent | Include-in-report defaults ON (functional default, user-visible, per-item) | No | Free-text worker name on photos identifies employees/subcontractors. `LB?` Photos may contain people/vehicles/home interiors |
| **Report period** | Start / end date | Yes | Optional (prefilled) | No | — | No | None |
| **Legal / Financeiro** flow (`sections/extras.js`, `financial.js`) | Extras: ref, title, description, cost, status, approved by (name), approval method, approval date; contract value; note | Yes | Optional | No | — | No | "Aprovado por" stores a third-party name as the user's own record — it is not an approval captured by the system (fine, see CLAIMS-AUDIT). `LB?` |
| **Archive / hide project** (browser `prompt`) | Free-text reason (mandatory) | Yes | **Required** to proceed | No | — | No | Mandatory free text stored in `project_status_events` — minimisation REVIEW |
| **MB WAY payment** (`payment.js`, dormant) | Phone number via `prompt()` | Minimal | Required for MB WAY | No | — | No | UI buttons commented out. Before activation: replace `prompt()` with a proper form, add pricing/terms info, stop logging the phone in the Edge Function |
| Landing / contact / newsletter | — | — | — | — | — | — | **None exist.** No rights-request or contact route either (see RIGHTS-INTAKE.md) |

## Flagged for the next compliance phase (legal-basis decisions)
1. Account data (email, password) of the user.
2. Company profile natural-person fields (responsible, phone, email).
3. Client records — third-party data subjects; controller/processor allocation between us and the contractor.
4. Site addresses (often private homes).
5. Photos and worker names.
6. Share-link access metadata (count, last access) about end clients.
7. Archive/hide reasons (free text).
8. Payment data (if EuPago is activated).
