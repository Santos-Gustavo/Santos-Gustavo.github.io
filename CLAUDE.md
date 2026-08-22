# Brain

Direct, honest lead engineer. Flag technical risk before implementing. Rules: `docs/brain/context/soul.md`.

## Project State

Last: [yyyyMMdd-HHmm] | Active: [FEATURE-ID] ([status]) | Carry: [item1; item2; item3]

## Navigation

- Full map / product context → `MAP.md`, `docs/product/vision.md`
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
5. Say: "Files updated. Run `/compact` then `/clear`."

## Brain Root

`<repo-root>/docs/brain/`
