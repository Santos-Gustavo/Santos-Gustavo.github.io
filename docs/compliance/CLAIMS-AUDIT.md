# Unsupported Claims Audit

Audit date: 2026-10-09 · Scope: `index.html` (copy, `<title>`, meta description, FAQ), `app.html`, `share.html`, report renderers v1/v2, WhatsApp share text, `examples/report_example.pdf`.
Approved claims rules used: the guardrails in `tests/e2e/landing-page.spec.js` (no payment wording; no "Visualizado pelo cliente"; no autosave / offline / Gantt / Kanban / digital-signature / "prova legal" / IMPIC / "ilimitad" claims) and the "Visualizado" qualification from CLIENT-SHARE-LINK-001.

**Result: no live unsupported claim found. No wording changed.**

| Topic | What the copy says | Supported? | Status |
|---|---|---|---|
| Legal proof / protection | FAQ "Tem valor legal?" → "Não substitui contratos, o livro de obra nem os documentos legalmente exigidos." Report disclaimer: "Não substitui o contrato de empreitada, o Livro de Projeto…" | Yes — explicitly disclaimed | OK. Carried open item: "Livro de Projeto" (report) vs "livro de obra" (landing FAQ) wording — owner/legal decision already tracked in `project-state.md` |
| "Se surgir uma dúvida, sabe o que ficou registado." (landing, Histórico) | Implies a reliable record | Yes — reports are immutable snapshots | OK (does not claim legal proof) |
| IMPIC compliance | No compliance claim. Company form has an "IMPIC / Alvará" field; reports print "INCI n.º <value>" (user-entered number) | Not a claim | OK · REVIEW label consistency (IMPIC vs INCI) |
| Client approval / acceptance / read | "Visualizado indica que o link foi aberto. Não indica quem o abriu, nem que o conteúdo foi lido ou aceite." FAQ: client cannot approve/sign | Yes | OK |
| Extras "Aprovado" | Contractor records an approval they obtained elsewhere ("Aprovado por", "Método de aprovação") | Yes — user-entered record, not system capture | OK |
| Automatic WhatsApp sending | "Envie pelo WhatsApp, como já faz" / "Partilhe o PDF ou o link" | Yes — user-initiated `wa.me` link | OK |
| Offline | FAQ: "Funciona sem internet? Não." | Yes | OK |
| Autosave | FAQ: "Guarda automaticamente? Não… é avisado antes" | Yes (unsaved-changes guard exists) | OK. Note: the company **logo** is saved immediately on upload — consistent, as the FAQ is about Estado da Obra |
| Multi-user / team | No team claims; "um sítio para cada obra" | — | OK |
| Unlimited | None | — | OK |
| Financial / payment | No pricing or payment wording on landing (test-enforced). App has a "Resumo Financeiro" (contract + extras totals) — a user calculation, not a payment feature | Yes | OK |
| "Um link seguro para o relatório" | Unguessable token, hashed at rest, 7-day expiry, revocable, private storage with 1-hour signed photo URLs | Reasonably supported | OK — keep wording modest; don't upgrade to "encriptado"/"100% seguro" |
| "As fotografias ficam guardadas de forma privada. O cliente só vê as que incluir num relatório." | Private bucket with owner-only RLS; share page gets only report photos via signed URLs | Yes | OK |
| "Sem conta e sem instalar nada" (end client) | Share page needs no login | Yes | OK |
| "Experimentar" CTA | Implies trying the product; sign-up is free and no pricing exists | Yes today | REVIEW when billing launches (state trial terms) |
| Meta / title | "Gestão de obra simples, feita no telemóvel"; description mirrors hero | Yes | OK |
| `examples/relatorio-exemplo.pdf` (replaced `report_example.pdf` on 2026-10-09) | Fictional demo data; v2 layout with correct "Página X de 2" | — | OK. Note: v2 layout is not live yet |
