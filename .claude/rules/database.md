---
paths:
  - "supabase/migrations/**"
  - "supabase/manual/**"
  - "js/database/**"
  - "js/mappers/**"
  - "scripts/backfill-*.js"
---

# Database and Data Integrity Rules

Data authorization lives in RLS policies and `SECURITY DEFINER` RPCs; treat changes to either as security-relevant.

## Modeling

- Use explicit data ownership and coherent schema design.
- Prefer database-enforced constraints for critical invariants.
- Define primary keys, foreign keys, uniqueness and nullability intentionally.
- Add indexes based on access patterns and demonstrated needs.
- Avoid unnecessary denormalization and speculative caching.

## Transactions and Concurrency

- Define transaction boundaries according to business invariants.
- Consider isolation, race conditions, lost updates and conflicting writes.
- Use atomic operations when state changes must succeed together.
- Ensure repeatable operations are safe where retries are possible.

## Migrations

- Preserve existing data and compatible consumers.
- Prefer incremental, reversible migration strategies where feasible.
- Separate schema transitions from destructive data removal.
- Assess locks, backfills and deployment ordering.
- Require explicit authorization for destructive or difficult-to-reverse operations.
- Plan recovery or restoration for consequential changes.

## Data Operations

- Prevent unintended unbounded queries and inefficient repeated access.
- Respect privacy, retention and tenant isolation.
- Use parameterized queries and established persistence conventions.
- Consider consistency guarantees and failure recovery explicitly.
- Avoid event sourcing, distributed transactions or additional infrastructure without requirements.

## Verification

Test constraints, migrations, rollback or recovery procedures, concurrency-sensitive behavior and real database interactions according to risk. Existing RLS/isolation coverage: `tests/e2e/rls-*.spec.js`.
