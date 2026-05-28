# Claude Code Prompt: Prompt Enhancer Chrome Extension

## Project Overview

Build a Chrome extension called **"PromptCraft"** that detects when a user is typing a prompt in any text field (with special support for Claude.ai, ChatGPT, and Gemini), and on clicking the extension button, analyzes the prompt and rewrites it using six core prompt engineering principles — powered by the Claude API in real time.

---

## Tech Stack

- **Manifest Version:** 3
- **Languages:** HTML, CSS (vanilla), JavaScript (ES modules)
- **API:** Anthropic Claude API (`claude-sonnet-4-20250514`) via `fetch` from the service worker
- **No frameworks. No build tools.** Pure vanilla JS only.

---

## File Structure

```
promptcraft/
├── manifest.json
├── background.js          # Service worker — handles Claude API calls
├── content.js             # Injected into pages — detects active textarea
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/
│   ├── options.html
│   └── options.js         # For saving the API key
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Manifest (`manifest.json`)

```json
{
  "manifest_version": 3,
  "name": "PromptCraft – AI Prompt Enhancer",
  "version": "1.0.0",
  "description": "Enhance any prompt using 6 proven prompt engineering techniques, powered by Claude.",
  "permissions": ["activeTab", "scripting", "storage"],
  "host_permissions": ["https://api.anthropic.com/*", "<all_urls>"],
  "background": { "service_worker": "background.js" },
  "action": { "default_popup": "popup/popup.html", "default_icon": "icons/icon48.png" },
  "options_page": "options/options.html",
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ]
}
```

---

## Core Feature: The 6 Techniques

The popup must display **all 6 techniques as interactive tabs/cards**. Each technique must:

1. Show a **short explanation** of the principle
2. Show a **live "Try It" example** — a pre-filled example prompt the user can click to load into the input field
3. Show the **before (original)** and **after (enhanced)** side-by-side when enhanced
4. Be selectable so the user can choose which technique(s) to apply

### Technique Definitions & Examples

Each technique must be implemented exactly as described below. The "Try It" examples must be hardcoded as clickable demo prompts.

---

#### 1. Be Specific
**Principle:** Replace vague language with concrete details — audience, purpose, tone, length, context.

**Try It Example (Vague → Strong):**
- Vague input to load: `Write me an email about the project delay`
- Expected enhanced output style: Specifies recipient (client/manager), the reason for delay, tone (apologetic/professional), desired outcome (reschedule/reassure), and length

**System instruction for Claude:**
> Rewrite this prompt to be maximally specific. Add concrete details about the target audience, purpose, desired tone, length, context, and any missing parameters. Keep the core intent intact.

---

#### 2. Assign a Role
**Principle:** Tell the AI who to be. A role activates domain knowledge and a specific communication style.

**Try It Example:**
- Input to load: `Give me advice on what to eat to lose weight`
- Expected enhanced output style: Assigns Claude the role of a registered dietitian with 10+ years of experience, specializing in sustainable weight loss

**System instruction for Claude:**
> Identify the most relevant expert role for this task and prepend it to the prompt. The role should include: the profession, years/type of experience, and a relevant specialization. Then re-state the original request through that lens.

---

#### 3. Give Examples (Few-Shot Prompting)
**Principle:** Show the model what "good" looks like using 2–3 examples before the actual request.

**Try It Example:**
- Input to load: `Write an Instagram caption for my coffee shop photo`
- Expected enhanced output style: Adds 2 example captions in the desired brand voice (warm, witty, community-focused) before the actual request, so Claude matches the style

**System instruction for Claude:**
> Add 2–3 high-quality examples that demonstrate the desired output style, tone, and format. The examples should immediately precede the actual request and be clearly labeled as "Example 1:", "Example 2:", etc.

---

#### 4. Specify the Format
**Principle:** Define the exact output structure — tables, bullet points, JSON, headers, word count, etc.

**Try It Example:**
- Input to load: `Summarize the key points from our team meeting`
- Expected enhanced output style: Requests a structured table with columns: Topic | Decision Made | Owner | Deadline — plus a separate "Action Items" bullet list and a 3-sentence executive summary at the top

**System instruction for Claude:**
> Rewrite this prompt to explicitly define the output format. Specify: structure (table/list/prose/JSON), sections needed, any ordering requirements, length limits per section, and any labeling conventions.

---

#### 5. Think Step-by-Step (Chain of Thought)
**Principle:** Force the model to reason before concluding. Explicitly ask it to show its work.

**Try It Example:**
- Input to load: `Should I leave my job to start my own business?`
- Expected enhanced output style: Instructs Claude to reason through this in explicit steps — (1) assess current situation, (2) evaluate financial runway, (3) identify transferable skills, (4) map out risks and mitigations, (5) weigh opportunity cost, (6) then give a final recommendation with reasoning

**System instruction for Claude:**
> Rewrite this prompt to enforce step-by-step reasoning. Add an explicit instruction that Claude must think through the problem in numbered steps before reaching a conclusion. Each step should be labeled and the final answer must come after the reasoning — never before.

---

#### 6. Add Constraints
**Principle:** Define what NOT to do. Constraints reduce noise, prevent clichés, and focus the output.

**Try It Example:**
- Input to load: `Write product copy for my new productivity app`
- Expected enhanced output style: Adds constraints: max 80 words, do not use the words "game-changer", "revolutionary", "seamless", or "powerful", avoid passive voice, no generic feature lists, must lead with a user pain point, must end with a single clear CTA

**System instruction for Claude:**
> Identify the top 5–7 constraints that would make this output higher quality. Constraints should include: word/length limits, banned words or phrases (especially clichés for the domain), structural rules (what must come first/last), tone rules, and anything to explicitly exclude.

---

## Popup UI Specification (`popup/popup.html`)

### Layout

```
┌─────────────────────────────────────┐
│  ⚡ PromptCraft                  ⚙️  │
├─────────────────────────────────────┤
│  Detected prompt:                   │
│  ┌─────────────────────────────┐    │
│  │ [editable textarea]         │    │
│  └─────────────────────────────┘    │
│                                     │
│  Technique:                         │
│  [ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ] [ 6 ]│
│  ┌─────────────────────────────┐    │
│  │ Technique name + description│    │
│  │ [Try It →] example prompt   │    │
│  └─────────────────────────────┘    │
│                                     │
│  [  ✨ Enhance My Prompt  ]         │
│                                     │
│  ┌── Before ──┬── After ──────┐     │
│  │ original   │ enhanced      │     │
│  └────────────┴───────────────┘     │
│  [ 📋 Copy Enhanced ] [→ Insert ]   │
└─────────────────────────────────────┘
```

### Popup Behavior

1. On open, `content.js` sends the currently focused textarea's content to the popup via `chrome.tabs.sendMessage`
2. User selects a technique (tabs 1–6), reads the description and sees the "Try It" example
3. Clicking "Try It →" loads the example prompt into the editable textarea
4. User clicks "✨ Enhance My Prompt"
5. Popup sends a message to `background.js` with `{ prompt, technique }`
6. `background.js` calls the Claude API and streams (or returns) the enhanced prompt
7. Before/After panel appears — original on left, enhanced on right
8. "📋 Copy Enhanced" copies to clipboard
9. "→ Insert" uses `chrome.scripting.executeScript` to inject the enhanced text back into the original textarea on the page

---

## Background Service Worker (`background.js`)

Handle a `chrome.runtime.onMessage` listener for message type `"ENHANCE_PROMPT"`.

### API Call Structure

```javascript
const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "x-api-key": apiKey,                      // retrieved from chrome.storage.sync
    "anthropic-version": "2023-06-01",
    "content-type": "application/json"
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: TECHNIQUE_SYSTEM_PROMPTS[technique], // map of the 6 system prompts above
    messages: [
      {
        role: "user",
        content: `Here is the prompt to enhance:\n\n"${userPrompt}"\n\nReturn only the enhanced prompt text. No preamble, no explanation, no quotes.`
      }
    ]
  })
});
```

Return `{ success: true, enhanced: responseText }` or `{ success: false, error: message }` to the popup.

---

## Content Script (`content.js`)

Listen for a message from the popup requesting the active focused element's text content.

```javascript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_FOCUSED_TEXT") {
    const el = document.activeElement;
    if (el && (el.tagName === "TEXTAREA" || el.isContentEditable || el.tagName === "INPUT")) {
      sendResponse({ text: el.value || el.innerText || "", found: true });
    } else {
      // fallback: scan for the most recently interacted textarea
      sendResponse({ text: "", found: false });
    }
  }

  if (message.type === "INSERT_TEXT") {
    const el = document.activeElement;
    if (el && el.tagName === "TEXTAREA") {
      el.value = message.text;
      el.dispatchEvent(new Event("input", { bubbles: true })); // trigger React/Vue reactivity
    } else if (el && el.isContentEditable) {
      el.innerText = message.text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }
});
```

---

## Options Page (`options/options.html`)

Simple page with:
- A password-type input for the Anthropic API key
- A "Save" button that stores to `chrome.storage.sync`
- A status message confirming save
- A "Test Connection" button that pings the API with a minimal call and shows success/failure

---

## Visual Design

- **Color palette:** Deep indigo `#4F46E5` primary, white background, soft `#F3F4F6` surface
- **Popup size:** 420px wide × auto height (max 600px with scroll)
- **Typography:** System font stack, 14px base
- **Technique tabs:** Pill-style numbered buttons `[1]` through `[6]`, active state in indigo
- **Before/After:** Side-by-side panels with subtle border, monospace font, color-coded (gray left, indigo-tinted right)
- **Enhance button:** Full-width, indigo background, white text, rounded, with a subtle pulse animation while loading
- **Loading state:** Skeleton shimmer on the "After" panel while API call is in progress

---

## Error Handling

| Scenario | Behavior |
|---|---|
| No API key set | Show inline warning: "Add your API key in ⚙️ Settings" with link to options page |
| No focused textarea found | Show: "Click into a text field on the page first, then re-open PromptCraft" |
| API error (4xx/5xx) | Show error message with the status code and a retry button |
| Empty prompt | Disable the Enhance button and show placeholder: "Start typing a prompt above" |
| Network offline | Show: "No internet connection detected" |

---

## Deliverables Checklist

- [ ] All 6 files created and wired together
- [ ] All 6 techniques implemented with correct system prompts
- [ ] "Try It" examples hardcoded and clickable for each technique
- [ ] Before/After comparison panel working
- [ ] Copy to clipboard working
- [ ] Insert back into page working (with React/Vue event dispatch)
- [ ] API key stored and retrieved from `chrome.storage.sync`
- [ ] Options page with test connection feature
- [ ] All error states handled gracefully
- [ ] Extension loads in Chrome (`chrome://extensions` → Load unpacked) with no console errors

---

## Notes for Claude Code

- Do not use any npm packages or bundlers. This must work as a plain unpacked extension.
- The `background.js` service worker **cannot** use `window` or `document`. All DOM interaction goes through `content.js` only.
- Use `chrome.storage.sync` (not `localStorage`) for the API key, as service workers don't have access to `localStorage`.
- When inserting text back into the page, always fire an `input` event after setting the value — this is required for Claude.ai and ChatGPT's React-based interfaces to recognize the change.
- Icons can be simple colored squares generated via canvas if real PNGs aren't provided — just make sure all three sizes exist in `manifest.json`.


You are an expert prompt engineer. Your job is to rewrite the user's prompt to be clearer, more specific, and more effective — while strictly preserving:

1. FIRST PERSON VOICE: The prompt is always written from the user's perspective. Use "I", "my", "me" — never "your", "you", or third person. The user is the one making the request.

2. ORIGINAL INTENT: Do not change what the user is asking for. Only make it more specific and structured.

3. BREVITY WITH PRECISION: Remove fluff. Add only details that genuinely improve the output (tone, format, audience, constraints). Do not make it unnecessarily long.

4. DIRECT INSTRUCTIONS: The enhanced prompt should give the AI clear, direct instructions — not describe what a good response would look like.

Return ONLY the enhanced prompt text. No explanation, no preamble, no quotes around it.

BAD (wrong): "Draft a professional email to inform your supervisor about your upcoming absence..."
GOOD (correct): "Write a professional email from me to my manager informing him that I will be absent on [date] to attend a wedding. Include my return date, who will cover my tasks while I'm away, and close with a respectful tone. Keep it concise — under 150 words."