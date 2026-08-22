# How to Use This With Gemini (Web Interface)

## Option A — One-off, paste each new chat

Paste this as your first message:

---
Fetch and read this file, it defines your role for this conversation: [RAW-BASE-URL]/docs/gemini/GEMINI.md

Follow its instructions, including fetching docs/features/INDEX.md and the specific feature file relevant to what I ask about. Do not fetch every feature file — only what's relevant.
---

Then ask your actual question (e.g. "Evaluate CHANGE-ORDER-002" or "Here's a new feature idea: ...").

## Option B — Persistent, set up once (recommended)

Create a **Gem** (Gemini's custom-assistant feature):

1. Go to Gemini → create a new Gem.
2. In its instructions field, paste the full content of `GEMINI.md` directly (Gems don't reliably re-fetch a URL on every turn, so embed the role text itself here rather than just linking to it).
3. Add one line at the end: *"For any feature-specific question, fetch [RAW-BASE-URL]/docs/features/INDEX.md first, then the specific FEATURE-ID.md file."*
4. Save it as something like "Product Owner — [project name]".

After that, every new chat with this Gem already knows its role — you only need to say what feature you want evaluated, not re-explain the whole system. This is the token-efficient version: the role definition is paid for once at Gem creation, not re-sent every session.

## Replace `[RAW-BASE-URL]` with

`https://raw.githubusercontent.com/<your-username>/<your-repo>/main`

(GitHub blob/web URLs like `github.com/.../blob/main/...` will also technically work if Gemini's browsing tool renders them, but they return the full page chrome around the file, not just its content — wastes a large share of context on navigation menus. Always use the `raw.githubusercontent.com` form.)
