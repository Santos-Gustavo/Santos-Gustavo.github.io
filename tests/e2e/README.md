# E2E tests

## Run

npm run test:e2e
npx playwright test tests/e2e/report

## Test categories

- auth: login/session
- project: project creation/edit/archive
- report: weekly/legal/report generation flows
- mobile: mobile smoke paths
- contracts: static frontend/backend contract checks

## Data policy

Tests that create data must prefix names with `E2E`.
Tests must not depend on `.project-card.first()` unless explicitly marked smoke.