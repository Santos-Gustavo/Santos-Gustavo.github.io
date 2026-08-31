# DESIGN-SYSTEM-001

Status: **Implemented, Tested.** Visual-refinement pass only — locks `styles.css`'s existing "Paper, Ink, Brass & Forest" tokens to their exact approved hex values, fixes two IBM Plex Mono typography violations (form labels, filter-tab navigation), restyles the previously-untracked `landing-page.html` from a generic SaaS blue/orange theme onto the shared token system, and cleans up a handful of hardcoded off-palette colors in `js/auth/auth.js` and `js/projects/sections/financial.js`. No product functionality, DB schema, RLS, or payment state changed.

Risk: Low for the visual work itself (CSS/copy only, no logic). One incidental find during E2E authoring: a real, pre-existing auth race condition (see §3) required a small, deliberate fix to `js/auth/auth.js` — reviewed and confirmed against the full suite before landing.

### Key Files

| Path | What changed |
|---|---|
| `styles.css` | `:root` token corrections (`--paper-line`, `--ink-soft`, `--brass`, `--brass-deep`, `--amber` — 5 of 15 tokens differed from the newly locked spec); `.field label` and `.project-filter-btn` moved from IBM Plex Mono to IBM Plex Sans (spec forbids Mono for form labels and "ordinary navigation"); `.auth-actions button` gained Space Grotesk (spec: primary buttons use Space Grotesk). |
| `landing-page.html` | Full restyle onto the shared token system (dropped its own `--navy`/`--cta-orange` theme, now links `styles.css` + the same Google Fonts as `index.html`). Copy corrected to the locked spec text (CTA "Testar grátis", added secondary CTA, added missing mockup lines, fixed "Visualizado pelo cliente" → "Visualizado" overclaiming). Registration marks (`.document-card-signature`) added to the two hero mockup cards only. |
| `js/auth/auth.js` | Inline hardcoded colors (`#dc2626`/`#166534`, `white`/`#e5e7eb`) replaced with design tokens. Separately: removed the redundant direct `showLoggedInUI()` calls in `signIn()`/`signUp()` — see §3. |
| `js/projects/sections/financial.js` | Inline hardcoded table colors replaced with design tokens. |
| `tests/e2e/landing-page.spec.js` | New — headline, CTA, no app shell, no payment wording, no overclaiming wording. |
| `tests/e2e/auth.spec.js` | Added a logout case (previously untested). |

## 1. Why this exists

The app already carried most of the "Site Document / Technical Drawing" vernacular from earlier work (title-block topbar, registration marks, blueprint grid, brass/forest tokens in `styles.css`). Product/design locked the exact token values and typography rules and asked for the whole app — including the new, still-generic-SaaS-styled `landing-page.html` (added on the `LANDING-PAGE-001` branch, untracked) — to be brought in line with them. Explicit instruction: refinement pass, not a product/flow rewrite.

## 2. Scope decisions (confirmed with the user, or made and documented below)

- **Superseded in §6**: `landing-page.html` initially stayed a separate, standalone page with no routing change (confirmed via clarifying question at the time). The user later asked for the landing page to become the actual site root — see §6 for that follow-up and why the reasoning below no longer reflects current routing.
- **`js/reports/report-renderer.js`** (the generated client-facing report/PDF document) was left untouched. It already has its own deliberate navy/gold/green stamped-document aesthetic; re-skinning it to the exact same hex tokens is a separate, larger, riskier task — it's the actual deliverable sent to clients over WhatsApp — and wasn't required to satisfy the app-UI/landing-page ask. Flagged here as a follow-up candidate, not done silently.
- **`reset-password.html`** — currently bare/unstyled, not named in the original scope list. Left alone; new scope, not requested.
- **"Aprovado"/"Aceite" wording in `extras.js`, `review.js`, `report-renderer.js`** — this is the separate "Trabalhos Extra" contract-change-approval feature (a real, legitimate status), not the Visualizado/share-status overclaiming guardrail. Not touched.
- **`.card h3`/`.review-section h3`** kept IBM Plex Mono — treated as small technical "section stamp" labels (title-block section titles), consistent with the vernacular even though not literally on the typography spec's allow-list. A judgment call, not a spec violation fix.

## 3. Incidental fix: logout race condition in `js/auth/auth.js`

Writing the required logout E2E coverage (§11 item 6 of the original brief — previously untested) surfaced a real, deterministic bug: after signing out, the app briefly showed the login screen, then flipped back to the app shell with a project-list load error ("Precisa de entrar na conta antes de guardar").

Root cause (confirmed via instrumented reproduction, not guessed): `signIn()`/`signUp()` each called `showLoggedInUI()` directly, **in addition to** Supabase's `onAuthStateChange` listener also calling it for the same login event. `signInWithPassword()`'s own promise does not resolve until Supabase's internal subscriber-notification pipeline finishes — which includes the listener's own `showLoggedInUI()` chain (company + project fetches, with retries). In a fast logout (exactly what the new E2E test does), the *direct* call in `signIn()` was still pending and fired **after** sign-out had already completed, re-showing the app shell with a now-dead session.

Fix: removed the redundant direct `showLoggedInUI()` calls from `signIn()`/`signUp()`; the `onAuthStateChange` listener is now the single source of truth for reacting to auth state, which is also the standard Supabase pattern. A `signingOut` guard flag was also added to the listener as defense-in-depth against any other stale event during an explicit sign-out. Verified: the logout E2E test went from a 12s timeout/failure to a deterministic 1.0–1.4s pass across repeated runs; full suite re-run clean afterward.

This was a scope judgment call, made with the user: an explicit choice was offered (fix now / report-only / leave failing) and "fix now" was chosen, since it's a narrowly-scoped auth-listener fix, not a redesign, and it's the only way to actually satisfy the brief's own §8 "logout must return to logged-out state" requirement.

## 4. Verification

- `node scripts/check-share-import-boundary.js` — passed.
- `node scripts/check-esm-migration.js` — passed.
- `npm run test:e2e` — 44/44 passed. (One run hit a single unrelated timeout in `project-archived-photo-evidence.spec.js`; re-ran in isolation and it passed in 5.9s, confirming pre-existing flakiness unrelated to this change, not a regression.)

## 5. Remaining visual risks

- `report-renderer.js`'s generated document was intentionally left on its own navy/gold/green palette (see §2) — a visible, if minor, inconsistency between the in-app UI/landing page and the actual document contractors send clients.
- New token values (slightly darker/more saturated brass and ink-soft) were not device-tested for outdoor/direct-sunlight mobile contrast — worth a real-device check before wide rollout, per the original brief's own callout.

## 6. Follow-up: landing page promoted to site root

Requested directly by the user, after §2 above had deliberately kept routing unchanged: make `landing-page.html` the page served at `/`, matching how `index.html` worked before, and fix the E2E suite to click through "Entrar" instead of assuming the login form is the first thing shown.

**File swap** (no routing/rewrite logic — plain static-file rename, since this is a GitHub Pages / static-server site where `/` always resolves to whatever file is literally named `index.html`):
- `index.html` (the wizard app) → `git mv`'d to `app.html`.
- `landing-page.html` → moved to `index.html`.
- The landing page's three `href="index.html"` links (header "Entrar", hero CTA, sticky-bar CTA) updated to `href="app.html"`.
- `reset-password.html`'s post-reset redirect and `scripts/check-esm-migration.js`'s `filesOnly` targets (which specifically scan the wizard app's markup for legacy inline handlers) updated from `index.html` to `app.html`. A few comments referencing `index.html` (`client-list.js`, `e2e-fixtures.js`, `payments-readonly-boundary.spec.js`) updated for accuracy.

**E2E updates**: every spec that used to `page.goto("/")` and immediately assume the login form (22 occurrences across 18 files) now clicks the landing page's "Entrar" link first. `global-teardown.js`'s *own* mid-cleanup `goto("/")` fallback (inside its retry loop, used when already authenticated) was pointed at `/app.html` directly instead — that one isn't a fresh login, so it shouldn't go through the marketing page at all. New `tests/e2e/landing-page.spec.js` (from earlier in this feature) already asserted `/` itself, so its `goto()` target flipped from `/landing-page.html` to `/`.

**A real bug this surfaced, and the actual fix**: adding the "Entrar" click broke 26–27 of 44 E2E tests, reproducibly, at first. Root cause (confirmed by instrumenting a live run, not guessed): `page.goto()` waits for the destination's `load` event; a `.click()` on a link that triggers navigation does not wait the same way. So after clicking "Entrar," the test could reach `app.html` and see `#authEmail`/`#authPassword` (present in raw static HTML, no JS required) *before* `js/main.js`'s module script had actually run — meaning `bindAuthEvents()` hadn't registered its click handler yet when the test clicked the login submit button, so the click did nothing. Confirmed directly: console output showed the `[ESM boot]` log lines printing *after* the submit click, not before. This wasn't Supabase rate-limiting or leftover test-data buildup — both were checked and ruled out directly (5 rapid sequential logins outside the test runner all succeeded in under 500ms each; the E2E test user had 0 leftover projects at the time).

Fix: `await page.waitForLoadState("load");` added immediately after every `.click()` on the "Entrar" link, before any interaction with the destination page. Verified: full suite went from 26–27 failures to **44/44 passing in 1.8 minutes** (faster than the pre-change baseline), confirmed on two separate clean runs.

**A process note for future sessions**: several `npm run test:e2e` background runs in this session appeared to "complete" (wrapper exited, notification fired) while the underlying `npm`/`playwright`/Chromium process tree kept running independently in the background — Windows/git-bash does not reliably kill backgrounded child processes when the wrapping shell exits. This caused real, confusing test contamination (multiple suites hammering the same port and Supabase test account concurrently) before it was diagnosed. When a background E2E run's timing looks anomalous, check `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` for orphans before trusting the result.
