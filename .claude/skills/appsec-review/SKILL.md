---
name: appsec-review
description: Inspect code changes for authentication, authorization, input validation, data exposure, tenant isolation and relevant security risks.
disable-model-invocation: true
context: fork
---

# Security Review

Scope: `$ARGUMENTS`, or the explicitly identified relevant change.

This review runs in an isolated context without the conversation. If no arguments are supplied, establish scope from `git status --short` and the base branch (`main` unless arguments name another):

- Committed branch changes: `git diff main...HEAD`
- Staged changes: `git diff --cached`
- Unstaged tracked changes: `git diff`
- Relevant untracked files: read their contents directly (diffs omit them)

Review each file once, at its current working-tree content, even when it appears in several views. Exclude generated or third-party output (`node_modules/`, `test-results/`, `playwright-report/`, `artifacts/`, minified `vendor/` files, binaries) unless it is the subject of the review.

Begin the output with the base branch used, the files inspected and the files excluded, each exclusion with its reason.

Perform a risk-based, read-only security assessment.

1. Identify assets, trust boundaries and relevant attack surfaces.
2. Inspect authentication, authorization, resource ownership and tenant isolation.
3. Review untrusted input handling and injection risks.
4. Check secrets, credentials, sensitive data handling and logs.
5. Consider applicable dependency, configuration and integration risks.
6. Examine unsafe state transitions, replay, duplicate requests and race conditions.
7. Evaluate negative security tests and identify meaningful coverage gaps.
8. Use applicable OWASP ASVS categories as a reference where useful.

## Output

Return:

- Security scope and assumptions
- Confirmed findings with severity, location and evidence
- Plausible risks requiring additional investigation
- Specific remediation proposals
- Missing security tests
- Residual risks and unverified areas
- Advisory assessment, never a self-issued security approval

Avoid generic vulnerability lists unrelated to the implementation.

Do not change security controls, bypass safeguards or modify source files.

Escalate critical or high-impact findings to the designated reviewer or human authority.
