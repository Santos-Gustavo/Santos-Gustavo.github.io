# Stack — Libraries, Conventions, Versions

Load only when unsure of a library/convention/version in use. Durable structure belongs in `architecture.md`, not here.

## Frontend
- Vanilla JS, ES modules, loaded via `<script type="importmap">` in `index.html` — no bundler, no framework.
- Module tree under `js/`: `auth`, `config`, `database`, `forms`, `mappers`, `navigation`, `payments`, `projects`, `reports`, `state`, `ui`, `utils`.
- `styles.css` — no CSS framework/preprocessor.
- Report rendering: `js/reports/report-renderer.js` (`renderReportHtml()`) is a pure function, no imports — the reusable core for both the contractor preview and any future client-facing view.

## Backend
- Supabase: Postgres, Auth, Storage, Edge Functions (Deno), RLS.
- `@supabase/supabase-js` v2, loaded both via CDN script tag (browser) and npm (Playwright tests / scripts).
- Edge Function house style (see `delete-photo`, `delete-project`): bearer JWT → anon-key client resolves caller identity → service-role client calls a `SECURITY DEFINER` Postgres RPC that does the actual authorization + row access. Authorization logic lives in SQL; the function is a thin, typed gatekeeper with CORS headers and structured JSON responses.
- `eupago-webhook` is the pattern for a function that trusts no caller identity and instead validates a shared secret from the payload.
- Manual RLS baseline snapshot: `supabase/manual/live_schema_rls_baseline.sql`.

## Testing
- Playwright E2E only, under `tests/e2e/`. Two established styles: page-driven UI assertions (e.g. `payments-readonly-boundary.spec.js`) and direct API/DB assertions via `@supabase/supabase-js` with the anon key (e.g. `rls-security.spec.js`).
- Credentials via `.env`: `E2E_EMAIL`/`E2E_PASSWORD`, `SUPABASE_URL`/`SUPABASE_ANON_KEY`.
- `npm run test:e2e` (+ `:ui`, `:headed`, `:debug`, `:mobile` variants).
- E2E-FIXTURES-001: the suite is self-seeding and self-cleaning. `tests/e2e/global-setup.js` seeds baseline fixtures (company/client/project/report) via `tests/e2e/helpers/e2e-fixtures.js`; `tests/e2e/global-teardown.js` deletes everything it created after every run, scoped to `E2E_USER_ID` + E2E/test name patterns. Set `E2E_SKIP_CLEANUP=true` only to inspect failed-test data by hand — never keep it on in `.env`. The old `E2E_DELETE_ALL_PROJECTS` opt-in flag is gone.

## Local dev
- `npx serve . -l 3000` (or `http-server`) — static file serving, no build step.
