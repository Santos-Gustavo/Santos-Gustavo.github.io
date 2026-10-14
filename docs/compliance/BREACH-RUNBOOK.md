# Breach Response Runbook

Phase 2A · 2026-10-09 · Operational procedure only, **not legal advice**. Legal deadlines and notification duties are decided by the owner with legal counsel; this runbook only makes sure the facts needed for that decision are collected quickly. Owner = incident lead (single-person operation today).

## 1. Detection
Sources: a user or end-client report, unexpected Supabase dashboard activity, unusual Edge Function logs, GitHub security alerts, a leaked key found in a commit, a share link circulating beyond its recipient, a public file containing personal data.
**Start the incident record (section 9) and note the time of awareness immediately** — any legal clock is likely to run from here.

## 2. Containment (do first, in this order as applicable)
1. Public file exposure → remove from the published site (new deploy of `main`); note that Git history and caches still hold it.
2. Share link exposure → revoke the link (app "Revogar link" or `revoke-report-share-link`).
3. Account compromise → revoke sessions / reset password / disable the user in Supabase Auth.
4. Key exposure → rotate (section 8) before anything else.
5. Suspected RLS/permission flaw → disable the affected Edge Function or policy; put the app in maintenance if needed.
Do not delete data or logs as a containment step unless it is the only way to stop ongoing exposure — and record it.

## 3. Evidence preservation
Before changing anything further: export relevant Supabase logs (auth, API, Edge Functions), note Git commit SHAs and deploy times, screenshot public pages/URLs, keep copies of affected rows (encrypted, restricted), record who did what and when. Log retention on the platform is limited (NEEDS DASHBOARD CHECK) — export early.

## 4. Scope: systems and data affected
Answer, with evidence:
- Which system: GitHub repo/history, GitHub Pages site, Supabase DB, Storage, Auth, Edge Functions, EuPago (disabled)?
- Which tables / storage prefixes / files? Which companies (`company_id`)?
- Which data categories (see PROCESSING-REGISTER.md)? Any special-category data (unlikely by design, but photos/free text can contain anything)?
- How many people, of which kind (users, end clients, workers)?
- Period of exposure (first possible access → containment).
- Who could access it (public internet, one recipient, an authenticated user of another company)? Is there evidence of actual access (logs, downloads, forks)?

## 5. Controller vs processor role
Per CONTROLLER-PROCESSOR-MAP.md (PROPOSED):
- Account/company/auth/billing data → we are likely **controller**: our own notification assessment applies.
- Contractor project data (clients, sites, photos, reports, share links) → we are likely **processor**: **inform each affected contractor without undue delay** with the facts below; the contractor makes their own assessment towards authorities/end clients. The DPA (Phase 2B) will fix the exact duty and timing.

## 6. Affected customers
List affected contractors (company name, account email), what of theirs was affected, and the message sent (date, channel, content). Use facts, not speculation; send updates as facts are confirmed.

## 7. Severity / risk assessment (inputs for the decision, not the decision)
Rate and record: data sensitivity (contact data < home address + photos of a home < financial/identity numbers), volume, identifiability, exposure (public vs single recipient), duration, evidence of access, ease of misuse (fraud, burglary, phishing), whether data was encrypted/unusable, whether containment is complete.
**Notification decision escalation:** the owner, with legal counsel, decides whether authority and/or individual notification is required and by when. Record the decision **and the reasoning** even if the answer is "no notification".

## 8. Credential / key rotation checklist
- Supabase service-role key (Edge Function secret) and any personal access tokens.
- Supabase publishable/anon key (`js/config/env.js`, `reset-password.html`) — public by design, rotate only if abused.
- `EUPAGO_API_KEY` (rotate if it was ever logged or stored in `payments.raw_webhook_payload`).
- GitHub tokens/SSH keys with push access; review repo collaborators.
- After rotation: redeploy Edge Functions, update `env.js` if needed, confirm the app still works.

## 9. Internal incident record (template)
| Field | Value |
|---|---|
| ID / title | |
| Time of awareness / detection source | |
| Systems & data affected | |
| People affected (number, type) | |
| Role (controller / processor) per data set | |
| Containment actions + times | |
| Evidence preserved (where) | |
| Risk assessment summary | |
| Notification decision, by whom, reasoning, date | |
| Customers / individuals informed (when, how) | |
| Root cause | |
| Follow-up actions + owners + dates | |
| Closed on | |

## 10. Post-incident actions
Root-cause analysis; fix + regression test; update SECURITY-TOMS.md, this runbook and THIRD-PARTIES.md; review whether retention/minimisation would have reduced the impact.

---

## Worked example (hypothetical): old public example PDF

**Facts known (2026-10-09):** `examples/report_example.pdf` was linked from the public landing page, committed in `2d846c4` (2026-10-05) to a **public** GitHub repo, served by GitHub Pages and downloadable from raw.githubusercontent.com. It showed a personal-looking email, a Portuguese mobile number, a street address and person names. The same phone number was in test fixtures and artifacts from `34b37e2`. It has been replaced in the working tree (not yet deployed); **whether the data is real has not been decided.**

**IF the owner confirms the data is real, assess and record:**
1. Whose data is it — the owner's own, a team member's, a real customer's or a real end client's? (Own data published by oneself may be a different situation from third-party data — legal to assess.)
2. Was it ever entered in production for a real customer, or typed for the demo?
3. Exposure period: from first push of `2d846c4` / `34b37e2` until deploy of the replacement; plus Git history until any rewrite.
4. Evidence of access: GitHub traffic/clone stats, forks, any GitHub Pages analytics (none configured), search-engine caches.
5. Data categories: contact data + address + names; no financial/identity documents visible (re-check the full PDF and all historical copies).
6. Role: if it was a customer's project data → we were likely processor → that contractor must be informed with these facts.
7. Containment taken: replacement on branch; still to do: deploy, decide on history rewrite + GitHub cache/ref purge (separate incident-response task per PRELAUNCH-QUICK-WINS release note).
8. Risk inputs for the decision in section 7.

**Not concluded here:** whether any notification is legally required. That is the owner's decision with legal counsel, based on the answers above.
