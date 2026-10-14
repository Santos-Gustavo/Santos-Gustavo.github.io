---
name: design-review
description: Review an implementation or architecture for complexity, maintainability, boundaries, compatibility and engineering trade-offs.
disable-model-invocation: true
context: fork
---

# Design Review

Scope: `$ARGUMENTS`, or the current relevant change if no arguments are supplied.

This review runs in an isolated context without the conversation. If no arguments are supplied, establish scope from `git status --short` and the base branch (`main` unless arguments name another):

- Committed branch changes: `git diff main...HEAD`
- Staged changes: `git diff --cached`
- Unstaged tracked changes: `git diff`
- Relevant untracked files: read their contents directly (diffs omit them)

Review each file once, at its current working-tree content, even when it appears in several views. Exclude generated or third-party output (`node_modules/`, `test-results/`, `playwright-report/`, `artifacts/`, minified `vendor/` files, binaries) unless it is the subject of the review.

Begin the output with the base branch used, the files inspected and the files excluded, each exclusion with its reason.

Perform a read-only engineering review.

1. Inspect the requirements (`docs/features/`), affected code, tests and applicable architectural decisions (`docs/decisions/`, `docs/brain/decisions.md`).
2. Evaluate correctness, scope adherence and behavior preservation.
3. Check coupling, cohesion, dependency direction and encapsulation.
4. Identify speculative abstractions, unnecessary layers, duplicated business knowledge and avoidable complexity.
5. Evaluate consequential compatibility, testing and operational implications.
6. Check whether important architectural decisions require an ADR.
7. Distinguish demonstrated defects from preferences and hypothetical improvements.

## Output

Return:

- Scope reviewed
- Findings grouped by severity: Critical, High, Medium, Low
- File and line references with supporting evidence
- Concrete recommended corrections
- Trade-offs or unresolved questions
- Tests or evidence still needed
- Final advisory status: NO FINDINGS, CHANGES RECOMMENDED, or BLOCKING FINDINGS

Do not modify files unless a separate authorized request explicitly instructs you to.

Do not grant independent approval, even when there are no findings.

Do not invent defects to fill categories.
