# Standing Engineering Decisions

Cross-feature principles established from real bugs or real disagreements. Load when working on anything the principle applies to. Do not duplicate content already in a feature file — link to it instead.

---

## Version lineage ≠ business status

Creating a successor version of a record (re-proposal, report revision, quote revision) must never rewrite the historical status recorded on its parent. Status describes what happened to that specific record. The version chain (`parent_id`, `version`) describes how records relate over time. Conflating them (e.g. writing `superseded` over `declined`) destroys the audit trail.

Applies to: change orders, report revisions, quote revisions, any future append-only/versioned entity.

## Verification integrity

"I implemented it and tests pass" is not verification. Verification requires evidence independent of the implementer's own conclusion: actual diff, actual test execution output, actual application behavior. Implemented ≠ Verified.

## Self-approved engineering strengthening

An engineering change that strengthens compliance with an already-approved requirement — without expanding scope or changing user-facing behavior — can be flagged and self-justified in the feature file without a full re-gate. It must still be named explicitly in the decision record, not folded silently into "done."

## Feature docs carry a "Key Files" table

Every `docs/features/FEATURE-ID.md` should open (right after the status lines/intro) with a `Key Files` table: path → one-line description of what it owns. No line numbers — they drift and a wrong one costs a wasted edit before anyone notices. This exists to let a session orient with `Read`/`Grep` on the exact files instead of dispatching a broad Explore agent to rediscover the feature's shape from scratch, which is slow and burns a lot of tokens on repeated discovery.

Keep it maintained when files move/get added — a stale table is worse than none. See `docs/features/CLIENT-SHARE-LINK-001.md` for the template.

Applies to: every feature file, existing or new.

## Never match-or-create a row on unindexed heuristics

A read-then-write "find by X, else insert" (no unique constraint backing X) is a TOCTOU bug waiting to happen, not a dedup mechanism — any drift in the match field (a blank optional value, retyped casing/whitespace, or two calls racing) silently inserts a duplicate instead of reusing the real row. `findOrCreateCompany`'s name-or-nif match (COMPANY-PROFILE-001) produced 9 duplicate company rows for one real owner in the live DB before it was caught. If an entity is meant to be singular or found by identity, resolve it by a stored id carried in session/app state (loaded once, e.g. at login) — never re-derive "which row is this" from user-editable text on every write.

Applies to: any "get or create" pattern over a table without a unique constraint on the match fields.

## Async state loaded at login must be awaited before it's relied on, not just kicked off

`showLoggedInUI()`-style boot code that flips the UI visible synchronously and starts async state-loading (e.g. the primary company fetch) without blocking on it creates a race: code that runs immediately after login "looks like" it has ready data but may not. COMPANY-PROFILE-001's `newProject()` read `appState.primaryCompanyId` synchronously and could misfire its "no company yet" branch for a user who already had one, purely because the load hadn't resolved. Fix: give call sites an async resolver (`resolvePrimaryCompanyId()` — returns cached value if present, awaits a fresh load otherwise) instead of a plain state read, whenever the state in question is populated by a fire-and-forget async call at boot.

Applies to: any appState field populated asynchronously at login/boot that another action might read immediately after.

## An E2E suite must own its fixtures and its cleanup from one shared definition

A suite that depends on hand-seeded rows (env vars pointing at pre-existing DB ids, or "run cleanup manually before this passes") is not safe to run repeatedly or in CI — it silently breaks the moment that seed data is missing, renamed, or wiped by an earlier destructive run. E2E-FIXTURES-001 replaced `.env`-pinned `E2E_REPORT_ID`/`E2E_SECOND_REPORT_ID` with `tests/e2e/global-setup.js` calling idempotent `ensureE2E*()` helpers (`tests/e2e/helpers/e2e-fixtures.js`) that create-or-reuse the exact rows specs need, writing their ids to a gitignored state file specs read instead of `process.env`. The same module's `cleanupE2EData()` is called by both nothing-to-do checks and `global-teardown.js`, so creation and deletion always agree on what `isTestName()` considers test data — two copies of that predicate drifting apart was exactly how E2E-CLEANUP-001's manual runbook became necessary in the first place.

Also: destructive test cleanup belongs behind a default-on negative flag (`E2E_SKIP_CLEANUP=true` to opt out), not a default-off positive one (`E2E_DELETE_ALL_PROJECTS=true` to opt in) — the positive form gets left on permanently in a real `.env` (it did here) and then runs unnoticed on every invocation, including ones nobody meant to be destructive.

Applies to: any Playwright/E2E suite in this repo, and any future one seeding its own DB fixtures.

---

*Add new entries here only when a principle is confirmed to generalize beyond one feature. One-off decisions belong in that feature's own FEATURE-ID.md.*
