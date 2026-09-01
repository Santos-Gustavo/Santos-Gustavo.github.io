# UX-FIXES-002

Status: **Implemented, Tested.** Eight independent, narrowly-scoped UX/security/quality fixes across auth, client management, project creation, and report generation. No schema/RLS changes, no payment UI touched, no product-flow rewrite — each fix is additive to existing patterns (delegated `data-*-action` click dispatch, `.field`/`.btn` design tokens, `alert()`-based validation).

### Key Files

| Path | What changed |
|---|---|
| `js/auth/auth.js`, `app.html`, `reset-password.html`, `styles.css` | Confirm-password field + validation on sign-up; password reveal/hide toggle on all three password fields. |
| `js/clients/client-actions.js`, `app.html` | Client email `.com`-governance guard clause. |
| `js/clients/client-form.js`, `app.html`, `styles.css` | Client edit form now hides the list/search/"+ Novo Cliente" while editing; dynamic "Editar cliente: [Nome]" heading and "Guardar alterações" label. |
| `js/projects/project-selection.js`, `js/projects/project-index.js` | Awaits `populateClientNameOptions()` before navigating to "Dados do Projeto" (see §1 for root cause). |
| `styles.css`, `js/ui/ui-controls.js`, `js/reports/report-prefill.js` | Progress slider now renders a filled track (`--fill` CSS custom property) synced on input and on prefill. |
| `app.html`, `styles.css`, `js/ui/confirm-dialog.js` (new), `js/navigation/navigation.js`, `js/main.js` | "Voltar ao Início" relocated to the report-screen header (top-right), spaced away from "Gerar Relatório"; new reusable confirm-dialog component gates the actual navigation. |
| `tests/e2e/*` | New/updated coverage for all 8 fixes; `global-teardown.js`'s cleanup retry loop updated to click through the new confirm dialog. |

## 1. FIX 5 root cause — client dropdown in "Dados do Projeto"

Verified empirically against the live app + Supabase (network tab + console instrumentation), not guessed. `populateClientNameOptions()` (`js/clients/client-list.js`) queries active clients correctly — confirmed the right filtered query firing and the datalist populating with all real active clients, archived ones correctly excluded.

The actual defect: both call sites (`newProject()`, `editProject()` in `js/projects/project-selection.js`) called `populateClientNameOptions()` fire-and-forget (`.catch()`, not awaited), immediately followed by a synchronous `goToStepId(2)`. The "Dados do Projeto" step became interactive before the network round-trip filling the datalist necessarily resolved — on a slow/mobile connection (this is an on-site contractor app) a user could reach the field before it populated. Fixed by awaiting the call in both sites before navigating; `editProject()` was also promoted to `async` (its one call site in `project-index.js` updated to `await` it).

A second, historical-only cause was investigated and ruled out for the current state: a past duplicate-`companies`-row data issue (documented in `COMPANY-PROFILE-001`) could silently exclude clients under a stale non-primary company row. Not reproducible today (the test account has a single company row, apparently cleaned up since), and fixing it would mean a one-time data migration outside this batch's "no schema/RLS changes" scope — flagged as a residual risk, not fixed.

## 2. Confirm password (FIX 1)

`app.html`'s single shared auth form (no sign-in/sign-up mode toggle — confirmed pre-existing) gained an `#authPasswordConfirm` field. It starts `hidden` and only appears once "Criar conta" is clicked — the first click enters a lightweight `signUpMode` (reveals the field, relabels the button to "Confirmar Criação"), a second click actually validates and submits. `signIn()`/`resetPassword()` and any click on "Entrar" reset out of sign-up mode, hiding and clearing the field again, so it never lingers on the plain login view. `signUp()` in `auth.js` checks `password !== getAuthPasswordConfirm()` after the existing length check and blocks with the exact copy "As palavras-passe não coincidem." before any Supabase call — validation failures keep sign-up mode active (field stays visible, input preserved) so the user can correct and resubmit without losing their input; only a successful sign-up exits the mode. `signIn()`'s own logic is untouched — the confirm field is never read there.

## 3. Password reveal (FIX 2)

New `.password-input-wrap` + `.password-toggle-btn` CSS pattern (none existed before — confirmed via full-repo grep; the app uses emoji/text for all other icon-like affordances, so this follows that convention with a 👁/🙈 toggle button). Applied to `#authPassword`, `#authPasswordConfirm` (via a new delegated `data-toggle-password` click branch in `auth.js`, checked before the existing `data-auth-action` dispatch), and `reset-password.html`'s `#newPassword` (wired via `addEventListener`, not a new inline `onclick`, to avoid adding further debt to that already-exempted legacy file). `aria-label`/`title` toggle between "Mostrar palavra-passe"/"Esconder palavra-passe".

## 4. Client email governance (FIX 3)

Originally enforced a `.com`-only suffix per the initial brief; relaxed after user feedback flagged that rule as too restrictive for a Portuguese contractor base (`.pt`, `.com.pt`, etc. are common client domains). Current regex is deliberately loose — `/^[^@\s]+@[^@\s]+\.[^@\s]+$/`, i.e. "something@something.something" — in `saveClientFromForm()` (`js/clients/client-actions.js`), guarding both create and edit (both routes go through this one function). It only rejects genuinely malformed input (missing `@`, no domain, no TLD, more than one `@`); real-world domains of any TLD pass. Error copy: "O email do cliente é inválido." Empty email stays optional (falsy check skips validation). The project-creation flow's client field was confirmed to have no email input at all — `findOrCreateClient`/`updateClientById` always receive `undefined` for `clientEmail` today, so there is no second code path to guard.

## 5. Client edit clarity (FIX 4)

`showFormPanel()`/`hideFormPanel()` in `client-form.js` now toggle a `client-form-open` class on `#step-clients`; CSS hides `#clientList`, the search field, and "+ Novo Cliente" while that class is present. Heading becomes "Editar cliente: [Nome]"; Save button becomes "Guardar alterações" in edit mode ("Guardar" for new). Cancel/Save both already routed through `closeClientForm()`, so no wiring changes were needed there.

## 6. Progress bar fill (FIX 6)

`#progressSlider` was previously unstyled (confirmed via grep — zero CSS targeted it, 100% default OS thumb rendering). Restyled with a `linear-gradient` driven by a `--fill` CSS custom property (forest for the filled portion, paper-line for the track). New `syncProgressSlider()` in `ui-controls.js` is the single source of truth for both the fill and the `#progressPct` text, called on input, on boot, and — closing a related latent gap — after `report-prefill.js` programmatically sets the slider's value (which uses raw `.value =` and doesn't dispatch an `input` event, so the display previously silently failed to update on prefill too).

## 7. Report-screen navigation (FIX 7 + 8)

"Voltar ao Início" moved out of the bottom nav-bar into the step-header (top-right, `.step-header-with-action`/`.btn-home-top`), leaving "Gerar Relatório" as the clearly dominant action in the nav-bar. Colors were already correct pre-fix (`--forest` on Generate, neutral ink/brass on Home) — this was purely a layout fix.

No modal/dialog component existed anywhere in the app (confirmed by grep; `CLIENT-MANAGEMENT-001.md` explicitly documents this as prior precedent, using native `confirm()` elsewhere for archive/delete). The brief's exact-copy, custom-labeled two-button requirement can't be done with native `confirm()`, so one small reusable overlay was added: `js/ui/confirm-dialog.js` (`confirmAction({title, message, confirmLabel, cancelLabel})`, promise-based), backed by a single static `#confirmDialog` overlay in `app.html` reusing existing `.btn`/`.btn-back`/`.btn-next` tokens. `navigation.js`'s `data-nav-action="home"` branch (the only such element in the app — confirmed by grep, so no other navigation flow is affected) now awaits confirmation before calling `goHome()`. `company-index.js`'s two internal `goHome()` calls (after company-profile save/cancel) call the function directly and are correctly unaffected.

**Critical test-infra fix**: `tests/e2e/global-teardown.js`'s self-cleaning `goToProjectList()` retry loop clicks the home button as part of its cleanup — without updating it, the new confirmation dialog would have silently stalled teardown for every test run. Updated to click the confirm button when present.

## 8. Verification

- `node scripts/check-share-import-boundary.js` — passed.
- `node scripts/check-esm-migration.js` — passed.
- `npm run test:e2e` — **55/55 passed in 2.2 minutes** (44 pre-existing + 11 new), run in the foreground with orphaned-process check (`Get-CimInstance Win32_Process -Filter "Name='node.exe'"`) confirming a clean process tree afterward. Self-cleaning teardown completed normally (39 projects, 55 clients, 1 zero-use test company deleted).

## 9. Remaining risks

- The historical duplicate-`companies`-row data-hygiene issue (§1) is flagged but not fixed — not reproducible today, and a real fix would touch data/schema outside this batch's scope.
- `reset-password.html` remains otherwise unstyled/unmigrated (pre-existing, deliberately out of scope per `DESIGN-SYSTEM-001` §2) — only the new reveal-toggle was added to it, via inline scoped styles matching its existing bare-legacy state.
