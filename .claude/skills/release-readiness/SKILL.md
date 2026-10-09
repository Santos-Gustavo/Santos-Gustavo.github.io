---
name: release-readiness
description: Evaluate whether a change has sufficient functional, test, security, migration and operational evidence for independent release approval.
disable-model-invocation: true
context: fork
---

# Release Readiness Assessment

Scope: `$ARGUMENTS`, or the identified change under review.

This review runs in an isolated context without the conversation. If no arguments are supplied, establish scope from `git status --short` and the base branch (`main` unless arguments name another):

- Committed branch changes: `git diff main...HEAD`
- Staged changes: `git diff --cached`
- Unstaged tracked changes: `git diff`
- Relevant untracked files: read their contents directly (diffs omit them)

Review each file once, at its current working-tree content, even when it appears in several views. Exclude generated or third-party output (`node_modules/`, `test-results/`, `playwright-report/`, `artifacts/`, minified `vendor/` files, binaries) unless it is the subject of the review.

Begin the output with the base branch used, the files inspected and the files excluded, each exclusion with its reason.

This is an evidence-gathering procedure, not deployment authorization.

## Procedure

1. Identify acceptance criteria and approved scope (`docs/features/FEATURE-ID.md`, including any "Release" section).
2. Inspect changes, relevant test results and applicable quality checks.
3. Distinguish executed checks from unverified claims.
4. Review integration, regression and security evidence appropriate to risk.
5. Identify database changes, migration requirements and recovery considerations.
6. Check API compatibility and deployment dependencies.
7. Consider observability, failure recovery and rollback where relevant.
8. Identify ADRs, documentation and release notes that require updates.
9. Confirm whether required independent review and human approvals are recorded.
10. Identify any unresolved blocking issue, including release gates and carried items in `docs/brain/project-state.md`.

## Output

Provide:

- Change summary
- Risk classification and rationale
- Acceptance criteria: Met / Not Met / Unverified
- Test evidence: command, result and limitations
- Security and data-integrity concerns
- Migration, monitoring and rollback considerations
- Independent approval status
- Blocking findings
- Release assessment: READY FOR INDEPENDENT APPROVAL / NOT READY / INSUFFICIENT EVIDENCE

Never label the release independently approved.

Never execute a deployment or destructive operation as part of this assessment.

If a check cannot be performed, mark it UNVERIFIED rather than inventing evidence.
