# LIVE-SITE-FETCH-001

Status: **Investigated. No code defect found on the live site.** Root cause could not be reproduced — `https://santos-gustavo.github.io/` was confirmed serving HTTP 200 with the correct, up-to-date content at time of investigation, via both direct `curl` and byte-for-byte content comparison against `origin/main`. Added regression E2E coverage (root → app entry, reset-password reachability) and fixed a stale doc comment; no functional code changes were required.

### Key Files

| Path | What changed |
|---|---|
| `tests/e2e/landing-page.spec.js` | Added two tests: clicking "Entrar" from `/` reaches `app.html`'s auth screen; `reset-password.html` loads independently. Fixed a stale top-of-file comment still describing the pre-LANDING-PAGE-001 `landing-page.html` naming. |

## 1. The reported problem

ChatGPT's web-fetch tool reported `Failed to fetch https://santos-gustavo.github.io/: Cache miss` when attempting an external visual/design audit, raising concern that the root GitHub Pages URL might not be serving correctly after the recent `index.html`/`app.html` routing swap (DESIGN-SYSTEM-001 §6, merged to `main` via PR #8 / commit `f5e1fcb`).

## 2. Investigation

**Branch/commit state:**
- Current branch: `UX-FIXES-002`, one commit ahead of `main` (`f3effe4`, the UX-FIXES-002 batch) — already pushed to `origin/UX-FIXES-002`, **not yet merged to `main`**.
- The routing swap itself (`index.html` = landing page, `app.html` = wizard app) was merged to `main` earlier, in `f5e1fcb` (PR #8, LANDING-PAGE-001) — `origin/main` already has the correct root file layout. UX-FIXES-002 being unmerged does **not** affect the live routing question; it only means UX-FIXES-002's own fixes (confirm-password, client email governance, etc.) aren't live yet, which is expected and unrelated to this investigation.

**Root files, `origin/main`:** `index.html`, `app.html`, `report_template.html`, `reset-password.html`, `share.html` — no `landing-page.html` (correctly renamed away). `index.html`'s `<title>` and `<h1>` confirmed to contain the expected landing copy.

**Stale-reference sweep** (`git grep` across `*.html`, `js`, `tests`, `scripts`, `docs`): every remaining `landing-page.html` mention is historical documentation (session logs, `DESIGN-SYSTEM-001.md`'s own change record) — none are live `href`/`goto`/script references. All functional references to `app.html` (landing page's three CTAs, `reset-password.html`'s post-reset redirect, `check-esm-migration.js`'s scan target, `global-teardown.js`'s cleanup navigation) point correctly at `app.html`. No stale references found requiring a fix, beyond one outdated comment in `tests/e2e/landing-page.spec.js` (see above).

**Live site, direct verification:**
```
curl -I https://santos-gustavo.github.io/                 → 200 OK
curl -I https://santos-gustavo.github.io/app.html          → 200 OK
curl -I https://santos-gustavo.github.io/reset-password.html → 200 OK
```
Root response body: 8889 bytes, byte-for-byte identical to `origin/main`'s `index.html`; contains the exact headline "Relatórios de obra profissionais, enviados por WhatsApp."; no payment wording present. `Last-Modified` header showed a same-day timestamp, confirming GitHub Pages had already rebuilt after the LANDING-PAGE-001 merge.

**Local server smoke test** (`npx serve . -l 4173`): root, `styles.css`, `js/main.js` all 200. `app.html`/`reset-password.html` returned a 301 **locally only** — this is `serve`'s own "clean URLs" feature (`/app.html` → `/app`), a known, previously-investigated local dev-server quirk (see DESIGN-SYSTEM-001 §6) that does **not** occur on GitHub Pages (confirmed above: `/app.html` is a direct 200 there, no redirect). Following the local redirect resolves to 200 either way, so it's cosmetic for local testing, not a functional bug.

## 3. Conclusion — which category (per the investigation brief)

**D — external fetch/cache issue, not reproducible against the live site.** All of A (local routing/reference bug), B (unmerged/unpushed branch), and C (Pages deployment lag/failure) were ruled out directly: no stale references, the relevant routing commit is merged and live, and Pages had already rebuilt with fresh content by the time of this check. The site was fully reachable and correct via both `curl` and content verification at the time of this investigation. The "Cache miss" report from ChatGPT's fetch tool most likely reflects a transient failure or a stale attempt on the auditor's own fetch path (e.g. checked before that day's Pages rebuild propagated, or a one-off tool-side hiccup) rather than an actual site outage — nothing on the repository or hosting side needed to change.

## 4. Verification

- `node scripts/check-share-import-boundary.js` — passed.
- `node scripts/check-esm-migration.js` — passed.
- `npm run test:e2e` — **59/59 passed in 2.2 minutes** (57 pre-existing + 2 new: Entrar → app.html reachability, reset-password.html standalone load).
- Direct `curl -I` against all three live URLs — all 200 OK, verified above.

## 5. Remaining risk

None identified specific to this investigation. If an external auditor reports a fetch failure again, the fastest re-check is the same `curl -I https://santos-gustavo.github.io/` used here — if that returns 200 with fresh content, the issue is on the auditor's fetch path, not this site.
