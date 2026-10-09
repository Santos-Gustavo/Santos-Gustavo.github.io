# Cookie / Browser Storage Inventory

Audit date: 2026-10-09 · Method: grep of all shipped code (`js/`, `*.html`, `vendor/`, `supabase/functions/`) for `document.cookie`, `localStorage`, `sessionStorage`, `indexedDB`, Supabase auth options, analytics/pixel/embed code.

Result: **no first-party code reads or writes cookies, localStorage, sessionStorage or IndexedDB directly.** The only device storage is the Supabase JS SDK's default session persistence.

| Key / name | Technology | Purpose | When created | Essential? | Party |
|---|---|---|---|---|---|
| `sb-haiwrmwpltzhdnrqzxep-auth-token` (Supabase SDK default key `sb-<project-ref>-auth-token`; client created with default options in `js/database/supabase-client.js` and `reset-password.html`) | localStorage | Keeps the user signed in (access + refresh token, user id, email) | On sign-in / sign-up with immediate session / opening the password-reset link | Essential (needed for the logged-in service the user requested) | First-party (stored on our origin by the SDK) |
| `sb-…-auth-token-code-verifier` | localStorage | PKCE verifier — only if the PKCE auth flow is used. The app uses the SDK default flow; presence not verified at runtime | Only during a PKCE auth flow | Essential if present | First-party |
| (none) | Cookies | — | Not set by our code. Google Fonts / jsDelivr requests are not known to set cookies, but this was **not** verified with a live browser capture → REVIEW | — | — |
| In-memory app state (`js/state/app-state.js`), Blob URLs for previews | JS memory | UI state, PDF preview | During use; gone on reload | Essential | First-party, not persistent |

Share page (`share.html`): the share token is read from the URL fragment (`#token=`) and sent to the `get-shared-report` Edge Function in a POST body. No storage is written; the end client is not signed in.

Third-party resources loaded on page view (no storage written by us, but network requests that expose IP): none since 2026-10-09 — fonts (incl. v1 reports) and supabase-js are self-hosted; only the Supabase backend is contacted. See `THIRD-PARTIES.md`.

Not present: analytics identifiers, tracking pixels, advertising, third-party embeds (iframes to other origins), service workers / offline caches.

## Does the current product appear to require a cookie-consent banner today?

**Based only on the current implementation: it does not appear to.** The only device storage is the Supabase auth session in localStorage, which exists solely to provide the signed-in service the user explicitly asked for; there are no analytics, advertising or tracking technologies.

Caveats (not legal conclusions):
- This must still be **disclosed** in the privacy information (next phase).
- The Google Fonts / jsDelivr IP transfers are a privacy-notice / transfer question, not a storage-consent question — but they are best removed by self-hosting (see quick-wins next steps).
- Re-run this inventory before adding any analytics, error tracking, chat widget or embed; any of those could change the verdict.
- Not verified with a live browser capture (DevTools Application tab). Recommended 5-minute check before launch.
