# Business Details on the Public Site

Audit date: 2026-10-09 · Sources searched: `index.html` (incl. footer), `app.html`, `share.html`, `reset-password.html`, `package.json`, `docs/product/*`, `docs/brain/context/*`.

The public site footer shows only: "RelatórioObra · Gestão de obra simples, feita no telemóvel." No operator details appear anywhere on the site, and **no authoritative repo/config source contains them**, so nothing was added.

| Detail | Status | Notes |
|---|---|---|
| Operator / legal name (person or company behind RelatórioObra) | MISSING · NEED USER INPUT | Brand "RelatórioObra" only. Git author name is not an authoritative source for the legal operator |
| Business address | MISSING · NEED USER INPUT | — |
| Contact email | MISSING · NEED USER INPUT | Not on site. An email appears in `examples/report_example.pdf` as sample company data — **not** used as a contact source (see DATA-MINIMISATION.md) |
| Phone | MISSING · NEED USER INPUT | Optional to publish; decide |
| NIF / company registration | MISSING · NEED USER INPUT | Depends on whether the operator is a sole trader or company |
| Product name / domain | PRESENT | "RelatórioObra"; served from `santos-gustavo.github.io`. Custom domain: NEED USER INPUT |

When provided, the natural place is the landing footer (`index.html` `.landing-footer`) plus the future Privacy Policy / Terms.
