# MVP-VALIDATION-001 — First Contractor Trial

Status: **Ready to recruit.** Trial-readiness fixes (auth-gate bug, payment-UI boundary test, gender-agreement copy, report-generation loading state) landed 2026-08-28. See `docs/features/CLIENT-SHARE-LINK-001.md` for how the underlying share-link flow was built and verified.

This is a validation exercise, not a feature build. Its only output is evidence: does the flow — create project → weekly report → photos → generate → share link → client opens it → contractor sees Visualizado — work well enough, for a real empreiteiro, to keep using unprompted?

---

## 1. Target tester profile

Matches `docs/product/vision.md`'s target user, narrowed to what's reachable for a hands-on first trial:

- Small empreiteiro / renovation company, ~1–4 workers
- Based in Porto / Norte Portugal (reachable in person or by a short drive if something breaks)
- Residential renovation work: bathrooms, kitchens, painting, flooring, plumbing, electricity, general repairs
- Already sends progress updates to clients informally — photos over WhatsApp, a call, a text — i.e. has the underlying habit this app formalizes
- Comfortable enough with a smartphone to use WhatsApp and a basic web form without hand-holding beyond a first walkthrough

Not a fit for this round: contractors who don't personally deal with clients (subcontractors only), anyone without steady WhatsApp use, anyone without at least one active project to report on this week.

## 2. Recruitment criteria

- 3–5 contractors, recruited individually (not as a batch announcement) — personal network, referrals, or direct outreach favored over cold ads, since trust matters more than volume at this stage
- Each must have at least one project currently in progress, so the trial uses a real report, not a fabricated one
- Confirm before recruiting: they're willing to be contacted for a short pre- and post-trial conversation (call or WhatsApp voice note is fine — doesn't need to be formal)
- Do not recruit more than 5 in the first wave — the point is depth of signal per contractor, not breadth

## 3. Pre-trial questions

Ask before they touch the app, so answers aren't anchored by the product they're about to see:

1. How do you currently send progress updates to clients? (method, frequency)
2. What's the most annoying part of that today?
3. Have you ever had a client dispute what was agreed, or claim they weren't told about something? What happened?
4. Do you currently charge anything for these updates/reports, or is it just part of the service?
5. If a tool did this automatically and sent a link by WhatsApp, would that change what you send, or how often?

## 4. Contractor task checklist

Given to the contractor as "try this on one real project," not read aloud as a script:

- [ ] Log in (or create an account)
- [ ] Create a project (or open an existing one)
- [ ] Start a weekly report
- [ ] Add at least one photo
- [ ] Fill in progress/summary for the period
- [ ] Generate and save the report
- [ ] Create a client share link
- [ ] Send it via WhatsApp to the actual client (or to a test number if they're not ready to send it to a real client yet)
- [ ] Come back later and check whether the report shows Visualizado

Note where they hesitate, ask a question, or need a step explained — that's the real signal, more than whether they complete the checklist.

## 5. Post-trial questions

1. Walk me through what happened after you sent the link — did the client open it? Say anything?
2. What was confusing or slower than it should've been?
3. Did anything feel unprofessional to send to a client?
4. Would you use this again next week without being asked?
5. Would you pay for this, or ask to keep using it if it became paid? (Don't lead — ask open, let them name a number or refuse to.)
6. What's missing that would make this a "yes" instead of a "maybe"?

## 6. Evidence log template

Log every trial to `docs/product/evidence.md` using its existing template — one entry per observation, plain and specific, no editorializing. Example shape:

```
## 2026-09 — [source: contractor trial, MVP-VALIDATION-001]

- [what was observed — quote or paraphrase, note if unprompted]
- Feeds: MVP-VALIDATION-001
```

Do not log a trial as "successful" without at least one entry here. A trial that happened but wasn't recorded didn't happen, per `MAP.md`'s rule.

## 7. Go / No-Go criteria

**Go (proceed to controlled beta — see §9):**
- At least 3 of 3–5 contractors complete the full flow (project → report → photos → generate → share → client views it) without needing rescue from the person running the trial
- At least 2 say, unprompted or lightly prompted, they'd use it again next week
- No contractor reports the report/share link looked unprofessional enough to not send to a real client

**No-Go / iterate before recruiting more:**
- Contractors get stuck on the same step independently (signals a real UX problem, not individual unfamiliarity)
- Nobody sends the link to an actual client (signals trust or relevance problem, not a UI problem)
- Feedback is lukewarm ("fine, I guess") rather than a real "yes" or a specific, fixable "no"

A No-Go is not a failure signal to stop the project — it's a redirect signal. Fix what's named, then re-run with the same or new contractors before scaling recruitment.

## 8. Product stop list — do not build during trial recruitment or the trial itself

Unless a specific item below is what's blocking a contractor from completing the task checklist in §4:

- No approval / digital-signature / legal-confirmation features
- No comments, notifications, or in-app messaging
- No IP tracking or geolocation
- No new database tables
- No billing, Stripe, MB WAY, EuPago UI, invoices, or mark-as-paid actions (see §9)
- No report-wizard rewrite
- No scope expansion based on a single contractor's request — log it to `inbox.md` instead and revisit after the trial wave closes

## 9. Payments — explicitly disabled/deferred during testing

The app is free during this trial. Payment UI (Multibanco, MB WAY via EuPago) is intentionally commented out of the DOM and covered by `tests/e2e/payments-readonly-boundary.spec.js`, which asserts no `[data-payment-action]` element or payment-request wording is reachable anywhere in the app. Do not re-enable payment UI to "test if contractors would pay" — that question belongs in the post-trial questions (§5), not in the product.

## 10. Roadmap correction — what a positive trial actually unlocks

A positive 3–5 contractor trial is **not** a signal to implement billing. It is a signal to widen the trial:

- **Positive 3–5 trials → controlled beta with 5–10 contractors.** Same evidence-logging discipline, same Go/No-Go structure, larger sample.
- **Billing only after a real usage + willingness-to-pay signal**, specifically:

  > At least 5 contractors use the app across 2+ real projects or 4+ real reports each, **and** at least 3 say they would pay or ask to keep using it after the trial ends.

Until that trigger is met, payments stay disabled per §9. This correction supersedes any earlier assumption in `docs/product/roadmap.md` that a positive trial leads straight to billing work.
