---
paths:
  - "supabase/functions/**"
---

# API Engineering Rules

House style for Edge Functions (JWT → caller identity → `SECURITY DEFINER` RPC owns authorization; webhooks validate a shared secret): `docs/brain/context/stack.md`.

## Contracts

- Define request, response, error and status semantics explicitly.
- Validate external input at trust boundaries.
- Maintain established API compatibility or document authorized breaking changes.
- Follow existing API versioning and error conventions.
- Use consistent pagination, filtering and resource representations where relevant.
- Do not expose internal implementation details through API errors.

## Authorization

- Authenticate and authorize server-side.
- Check permissions for the specific resource and action.
- Enforce ownership and tenant isolation.
- Never trust client-provided identity, role or ownership claims.
- Test denied, unauthenticated and cross-tenant access where applicable.

## Correctness and Reliability

- Preserve business invariants and valid state transitions.
- Define idempotency requirements for operations subject to retries.
- Handle concurrency, duplicate requests and partial failures.
- Bound timeouts, payload sizes and resource usage as appropriate.
- Avoid unnecessary database queries and hidden side effects.

## Verification

Test valid requests, invalid input, authorization failures, error handling, contract compatibility and consequential integration behavior.

Do not introduce incompatible responses or new external dependencies without justification.
