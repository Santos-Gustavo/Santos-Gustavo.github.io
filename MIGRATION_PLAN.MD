# Migration Plan

## Goal

Migrate the app to a stable model:

Company → Clients → Projects → Reports → Photos

The migration must make the database, RLS, storage cleanup, frontend repositories, tests, and deployment checks consistent.

## Rules

1. Baseline changes fix drift; target changes go in new migrations.
2. No JS repository refactor before schema baseline, cleanup, constraints, RLS, and storage delete are handled.
3. Browser must not directly delete storage files.
4. UI files must not call Supabase directly.
5. Compatibility wrappers are temporary and must have removal conditions.

## PR Order

1. Baseline migration PR
2. Legacy pollution cleanup PR
3. Target DB constraint migration PR
4. RLS policies + RLS test PR
5. Storage delete Edge Function PR
6. Module boundary PR
7. Company/client/project repository PR
8. Stabilize existing UI PR
9. Clients first-class UI PR
10. Reports/photos repository PR
11. Remove wrappers/legacy shape PR

## Current Milestone

Milestone 1 — Schema Baseline