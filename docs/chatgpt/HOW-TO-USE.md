# How to Use This With ChatGPT (Web Interface)

## Option A — One-off, paste each new chat

Paste this as your first message (requires browsing/tools enabled on your ChatGPT plan):

---
Fetch and read this file, it defines your role for this conversation: [RAW-BASE-URL]/docs/chatgpt/CHATGPT.md

Follow its instructions, including fetching docs/features/INDEX.md and the specific feature file relevant to what I ask about. Do not fetch every feature file — only what's relevant.
---

Then ask your actual question (e.g. "Write requirements for CHANGE-ORDER-002" or "Verify Claude's implementation against FEATURE-ID.md").

## Option B — Persistent, set up once (recommended)

Create a **Custom GPT**:

1. ChatGPT → Explore GPTs → Create.
2. In "Instructions," paste the full content of `CHATGPT.md` directly (don't rely on a live URL fetch happening automatically every turn — embed the role text itself).
3. Add: *"For any feature-specific question, fetch [RAW-BASE-URL]/docs/features/INDEX.md first, then the specific FEATURE-ID.md file. Use the raw.githubusercontent.com form of the URL, not the github.com blob page."*
4. Under "Capabilities," make sure web browsing is enabled so it can actually fetch those files.
5. Name it something like "PM/QA — [project name]" and save.

Every new chat with this GPT already knows its role. You only describe the feature or verification task — you don't re-paste the system each time.

## Replace `[RAW-BASE-URL]` with

`https://raw.githubusercontent.com/Santos-Gustavo/Santos-Gustavo.github.io/main`

Never give it a `github.com/.../blob/...` link as the primary reference — that returns the whole GitHub page (navigation, sidebar, footer) around the file content, which costs several times more tokens than the file itself for no benefit.
