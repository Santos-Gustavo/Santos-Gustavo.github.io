# Brain

Direct, honest lead engineer. Flag technical risk before implementing. Rules: `docs/brain/context/soul.md`.

## Project State

Last: 20260901-1416 | Active: LIVE-SITE-FETCH-001 (investigated, no code defect found — root `/` confirmed live and correct via curl + content diff against origin/main; added regression E2E coverage; see docs/features/LIVE-SITE-FETCH-001.md). UX-FIXES-002 remains implemented/tested but only pushed to `origin/UX-FIXES-002`, not merged to `main` — the live site's routing fix (index.html/app.html swap) was already merged earlier via PR #8 and is unaffected by that. | Carry: get real Gemini Value Gate + ChatGPT Definition Gate sign-off on CLIENT-SHARE-LINK-001 before Phase 2 build (drafts currently unreviewed); log a real evidence.md entry to back Evidence Level above 0; resolve open question on concurrent share links per report (REQ-03); process inbox.md weekly; consider whether report-renderer.js's generated document should eventually adopt the same Paper/Ink/Brass/Forest tokens (deliberately left out of DESIGN-SYSTEM-001, see its §2); real-device outdoor/mobile contrast check on the new token values not yet done; historical duplicate-companies-row data-hygiene issue flagged in UX-FIXES-002 §1 not fixed (not reproducible today, would touch data/schema outside batch scope); decide whether/when to merge UX-FIXES-002 into main; note for any session running `npm run test:e2e` in background on this Windows box — the wrapper can report "completed" while the underlying node/playwright process tree keeps running orphaned, causing test contamination (see DESIGN-SYSTEM-001 §6 process note)

## Navigation

- Full map / product context → `MAP.md`, `docs/product/vision.md`
- What's actually shipped → `docs/product/features-catalog.md`
- Feature work → `docs/features/INDEX.md` → `docs/features/FEATURE-ID.md`
- Architecture/stack questions → `docs/brain/context/architecture.md` or `stack.md`
- Cross-feature engineering decisions → `docs/brain/decisions.md`
- Keyword unclear → grep the repo before guessing
- New decision made → write it before ending session
- If the user pastes output from a Gemini or ChatGPT session, commit it to the relevant file yourself — don't just acknowledge it in chat

## Wrap Up

Triggered: "wrap up" OR before context gets heavy (~15-20 exchanges).

1. Rewrite Project State line above.
2. Append `docs/brain/sessions/yyyyMMdd-HHmm.md` (what changed, why, what's next).
3. Update `docs/features/INDEX.md` row for any touched feature (status, risk).
4. Update `docs/brain/decisions.md` if a standing engineering principle was established.
5. Say: "Files updated. Run `/compact`."

## Brain Root

`<repo-root>/docs/brain/`
