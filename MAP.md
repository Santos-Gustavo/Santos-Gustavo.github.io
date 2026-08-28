# MAP — Start Here

Read this first. Everything else is one link away. Keep this file under 30 lines — if it's growing, the new content belongs in a linked file, not here.

## Rule

**Nothing is true until it's committed.** A decision made in a Gemini, ChatGPT, or Claude chat that isn't written to a file here doesn't exist for the next session. Copy it in before you close the tab.

## For Humans

- New idea? → add a line to `inbox.md`, don't build a doc for it yet.
- Working a feature? → `docs/features/INDEX.md` → open the specific `FEATURE-ID.md`.
- Wondering what's next / why we're building something? → `docs/product/roadmap.md`, `docs/product/vision.md`.
- Wondering what the product already does today? → `docs/product/features-catalog.md`.

## For AI (any role)

- Claude (Claude Code): `CLAUDE.md` auto-loads. Don't read this file unless asked to.
- Gemini: `docs/gemini/GEMINI.md`
- ChatGPT: `docs/chatgpt/CHATGPT.md`

## Structure

```
inbox.md                  ← raw unsorted ideas, process weekly
docs/
  product/                ← Gemini's domain: vision, evidence, roadmap
  features/                ← shared: one file per FEATURE-ID, INDEX.md dashboard
  validation/              ← trial/beta plans: tester profile, task checklist, go/no-go
  brain/                   ← Claude's domain: architecture, decisions, sessions
  gemini/ · chatgpt/       ← role definitions for web-interface AIs
```

## Truth Ownership (don't duplicate across these)

| Question | Lives in |
|---|---|
| Why build this? | `docs/product/vision.md`, feature file §1 |
| What does the product already do? | `docs/product/features-catalog.md` |
| What exactly, and is it verified? | feature file §2–4 |
| How was it built? | feature file §3 + git history |
| Did it actually work for users? | `docs/product/evidence.md` |
| What changed and when? | `git log` — never hand-maintain a separate changelog |
