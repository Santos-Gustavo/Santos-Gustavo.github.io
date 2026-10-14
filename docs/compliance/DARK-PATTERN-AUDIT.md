# Dark-Pattern Audit

Audit date: 2026-10-09 · Scope: sign-up, login, archive/hide/delete, confirmations, sharing, CTAs, pricing/payment UI.

**No fixes were made** — nothing found was an unambiguous UI defect that could be corrected without changing copy meaning or product behaviour. Items below are recorded for a product decision.

## Checks

| Check | Finding | Verdict |
|---|---|---|
| Preselected optional choices | None. Only defaults: "Enviado via = WhatsApp" (report metadata) and per-item "include in report" ON (visible, per item) | OK |
| Misleading CTA hierarchy | Landing: one filled CTA per screen, header CTA outlined by design. Auth: "Entrar" primary, "Criar conta"/"Esqueci" secondary. "Sair sem guardar" has a crimson (destructive) style | OK |
| Difficult cancellation / deletion | No paid plan is live, so no cancellation flow. **No account deletion or data export exists in the app** (only sign-out). Projects cannot be deleted from the UI (archive/hide only); `delete-project` Edge Function exists but is not wired to the UI | RECORD — rights handled manually for now (see RIGHTS-INTAKE.md); not a dark pattern but a launch gap |
| Hidden consequences | (1) **"Ocultar projeto"** — confirm text says records are preserved, but there is no UI to un-hide (`unhideArchivedProject` has no caller). The action is effectively irreversible for the user and this is not stated. (2) **"Remover" photo / work item / incident** — soft delete (`deactivated_at`); the photo file stays in storage. Users may assume removal deletes the photo. (3) Archive/hide **require** a free-text reason via `prompt()` with no explanation of why or where it's stored | RECORD — fix needs a product decision (add un-hide, or change confirm wording; decide whether "Remover" should delete) |
| Fake urgency / scarcity | None found | OK |
| Disguised advertising | None found | OK |
| Confusing opt-outs | None (no opt-ins exist) | OK |
| Sharing | Share link expires after 7 days (168 h, `create-report-share-link`), can be revoked ("Revogar link"); "Visualizado" is qualified on landing ("Não indica quem o abriu…"). The prefilled WhatsApp text says "aceda ao link para rever o progresso documentado" — no approval/acceptance wording | OK |
| Pricing / payment UI | Not shown (buttons commented out in `app.html:83-89`). Landing CTA "Experimentar" with no pricing anywhere — if a paid plan is introduced, the trial/pricing terms must be stated before sign-up | OK today · REVIEW before paid launch |
| Sign-up | No pre-ticked boxes, no forced marketing, password confirmation shown only in sign-up mode | OK |
| Destructive confirmations | Client delete: native `confirm()` with "Esta ação não pode ser revertida"; only allowed when the client has no projects. Archive client: consequences explained | OK |

## Recommended product decisions (not done)
1. Either add an "un-hide" action for hidden projects, or change the "Ocultar" confirmation to state that it cannot be undone from the app.
2. Decide what "Remover" on a photo means (hide vs delete the file) and make the UI say so.
3. Explain the archive/hide reason prompt ("fica registado no histórico do projeto") or make it optional.
