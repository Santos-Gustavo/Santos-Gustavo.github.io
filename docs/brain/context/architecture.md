# Architecture — Constants

Keep this to structure that changes rarely. Feature-specific schema belongs in that feature's own file, not here.

## Stack
- Supabase (Postgres, Auth, Storage, RLS)
- [frontend framework]
- Playwright E2E

## Cross-cutting patterns
- Public/unauthenticated routes: token-based access (128-bit random token), never RLS relaxation. See CHANGE-ORDER-001 §3 for the reference implementation.
- Versioned records: see `decisions.md` → "Version lineage ≠ business status" before building anything append-only.
- [add other durable patterns as they're established]

## Explicitly NOT here
- Per-feature schema — lives in that feature's FEATURE-ID.md
- One-off implementation notes — lives in sessions/ or the feature file
