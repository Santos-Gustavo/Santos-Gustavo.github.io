# Standing Engineering Decisions

Cross-feature principles established from real bugs or real disagreements. Load when working on anything the principle applies to. Do not duplicate content already in a feature file — link to it instead.

---

## Version lineage ≠ business status

Creating a successor version of a record (re-proposal, report revision, quote revision) must never rewrite the historical status recorded on its parent. Status describes what happened to that specific record. The version chain (`parent_id`, `version`) describes how records relate over time. Conflating them (e.g. writing `superseded` over `declined`) destroys the audit trail.

Applies to: change orders, report revisions, quote revisions, any future append-only/versioned entity.

## Verification integrity

"I implemented it and tests pass" is not verification. Verification requires evidence independent of the implementer's own conclusion: actual diff, actual test execution output, actual application behavior. Implemented ≠ Verified.

## Self-approved engineering strengthening

An engineering change that strengthens compliance with an already-approved requirement — without expanding scope or changing user-facing behavior — can be flagged and self-justified in the feature file without a full re-gate. It must still be named explicitly in the decision record, not folded silently into "done."

---

*Add new entries here only when a principle is confirmed to generalize beyond one feature. One-off decisions belong in that feature's own FEATURE-ID.md.*
