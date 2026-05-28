# PromptCraft

A Chrome extension that rewrites your AI prompts using prompt engineering techniques — before you send them.

You type a rough prompt into Claude, ChatGPT, or Gemini. PromptCraft reads it, rewrites it using whichever technique you pick, and inserts the improved version back into the input box. It also tells you what details are missing that would make the output even better.

---

## The 6 techniques

**Be Specific** — fills in the missing context: who it's for, what tone, how long, what purpose.

**Assign a Role** — gives the AI a precise expert identity relevant to your task, not just "act as an expert."

**Give Examples** — adds 2–3 real examples showing the pattern you want before making the actual request.

**Specify Format** — defines the exact output structure: sections, tables, bullet lists, word counts.

**Think Step-by-Step** — forces the model to reason through numbered steps before giving a final answer.

**Add Constraints** — lists what to avoid: banned phrases, length caps, structural rules, tone requirements.

---

## Setup

**1. Load the extension**

- Open `chrome://extensions` in Chrome
- Enable Developer mode (top right)
- Click "Load unpacked" and select this folder

**2. Get a Groq API key**

Groq is free. Go to [console.groq.com/keys](https://console.groq.com/keys), sign up, and create a key.

**3. Add the key**

Click the PromptCraft icon → Settings → paste your key → Save → Test Connection.

---

## How to use it

1. Go to any AI chat (Claude, ChatGPT, Gemini, or anything else)
2. Type your prompt into the input box
3. Open PromptCraft — it auto-imports what you typed
4. Pick a technique, click **Enhance prompt**
5. Review the before/after, check the suggestions at the bottom
6. Click **Insert into page** to replace your original prompt

---

## Stack

Vanilla JS, no build tools, no dependencies. Manifest V3. Uses the [Groq API](https://groq.com) with `llama-3.3-70b-versatile` for fast inference.
