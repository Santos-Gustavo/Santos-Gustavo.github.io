# Architecture — Constants

Keep this to structure that changes rarely. Feature-specific schema belongs in that feature's own file, not here.

## Stack
- Supabase (Postgres, Auth, Storage, RLS)
- Vanilla JS (ESM modules via import maps, no framework)
- Playwright E2E

## Cross-cutting patterns
- Public/unauthenticated routes: token-based access (opaque, server-generated, hashed at rest — never a UUID or predictable value), never RLS relaxation. See `docs/features/CLIENT-SHARE-LINK-001.md` §3 for a worked design once it ships, and existing `delete-photo`/`delete-project` Edge Functions for the JWT → service-role → `SECURITY DEFINER` RPC house style.
- Versioned records: see `decisions.md` → "Version lineage ≠ business status" before building anything append-only.
- [add other durable patterns as they're established]

## Explicitly NOT here
- Per-feature schema — lives in that feature's FEATURE-ID.md
- One-off implementation notes — lives in sessions/ or the feature file
