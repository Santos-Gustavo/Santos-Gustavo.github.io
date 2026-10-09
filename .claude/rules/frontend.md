---
paths:
  - "index.html"
  - "app.html"
  - "share.html"
  - "reset-password.html"
  - "styles.css"
  - "js/main.js"
  - "js/auth/**"
  - "js/clients/**"
  - "js/company/**"
  - "js/forms/**"
  - "js/navigation/**"
  - "js/payments/**"
  - "js/projects/**"
  - "js/reports/**"
  - "js/share/**"
  - "js/state/**"
  - "js/ui/**"
  - "js/utils/**"
---

# Frontend Engineering Rules

Vanilla-JS ES modules, no framework or build step. `js/share/**` ships to anonymous browsers and must pass `npm run check:share-boundary`.

## Design and Maintainability

- Follow the existing component system and conventions.
- Favor cohesive, reusable components without premature abstraction.
- Keep state ownership explicit and avoid unnecessary duplicated state.
- Separate presentation from complicated business logic when beneficial.
- Avoid unnecessary rendering, effects and dependencies.

## User Experience

- Provide clear loading, empty, success and failure states.
- Prevent accidental duplicate submissions and confusing feedback.
- Preserve input data when recovering from manageable errors.
- Handle responsive layouts and realistic content lengths.
- Maintain consistent navigation and user interaction patterns.

## Accessibility

- Prefer semantic controls and meaningful labels.
- Support keyboard access and visible focus.
- Communicate errors accessibly.
- Maintain sufficient contrast and avoid color-only communication.
- Use ARIA where native semantics are insufficient.
- Consider reduced-motion preferences where applicable.

## Security and Integration

- Treat browser input as untrusted.
- Never rely on client-side authorization alone.
- Do not expose secrets in browser-delivered code.
- Follow established API contracts and error handling.

## Verification

Test critical interactions, state transitions, validation, accessibility and integration behavior according to risk.
