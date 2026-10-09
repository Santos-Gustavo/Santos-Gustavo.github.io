# Brain

Direct, honest lead engineer. Flag technical risk before implementing. Rules: `docs/brain/context/soul.md`.

## Project State

Last: 20261009-0930 | Active: REPORT-LAYOUT-V2 (pre-release cleanup done; v2 dark behind REPORT_LAYOUT_V2_UNRELEASED sentinel; get-shared-report redeployed v2 → share logo fixed; see docs/features/REPORT-LAYOUT-V2.md "Release") | Carry: RELEASE STEP — set REPORT_LAYOUT_V2_CUTOVER to the agreed rollout timestamp and pass `node scripts/check-report-cutover.js`; content/legal owner to confirm "Livro de Projeto" vs "Livro de Obra" in the report disclaimer (do not change in code); get real Gemini Value Gate + ChatGPT Definition Gate sign-off on CLIENT-SHARE-LINK-001; log a real evidence.md entry; resolve concurrent share links per report (REQ-03); process inbox.md weekly; real-device outdoor/mobile contrast check; historical duplicate-companies-row data hygiene (UX-FIXES-002 §1); decide whether/when to merge UX-FIXES-002 into main; background `npm run test:e2e` on Windows can orphan playwright processes (DESIGN-SYSTEM-001 §6)

## Navigation

- Full map / product context → `MAP.md`, `docs/product/vision.md`
- What's actually shipped → `docs/product/features-catalog.md`
- Feature work → `docs/features/INDEX.md` → `docs/features/FEATURE-ID.md`
- Architecture/stack questions → `docs/brain/context/architecture.md` or `stack.md`
- Cross-feature engineering decisions → `docs/brain/decisions.md`
- Keyword unclear → grep the repo before guessing
- New decision made → write it before ending session
- If the user pastes output from a Gemini or ChatGPT session, commit it to the relevant file yourself — don't just acknowledge it in chat

## Working Preferences (token efficiency)

- **Brain docs are opt-in, not automatic.** Skip session logs / feature docs / INDEX updates for small fixes and tweaks. Only do the Wrap Up below when the user explicitly says "wrap up", or the work is a genuinely new/large feature (new FEATURE-ID scope).
- **Don't run the full E2E suite after changes.** Run only the Playwright spec file(s) covering the changed area, e.g. `npx playwright test tests/e2e/<file>.spec.js`. The user runs the full suite themselves and will report back if something breaks. Only run the full suite if explicitly asked, or the change plausibly has cross-cutting blast radius (e.g. shared nav/auth/teardown helpers).

## Wrap Up

Triggered: user says "wrap up" OR the work just completed was a new/large feature (not a small fix).

1. Rewrite Project State line above.
2. Append `docs/brain/sessions/yyyyMMdd-HHmm.md` (what changed, why, what's next).
3. Update `docs/features/INDEX.md` row for any touched feature (status, risk).
4. Update `docs/brain/decisions.md` if a standing engineering principle was established.
5. Say: "Files updated. Run `/compact`."

## Brain Root

`<repo-root>/docs/brain/`
