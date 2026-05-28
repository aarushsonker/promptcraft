const BASE_SYSTEM = `You are an expert prompt engineer. Rewrite the user's prompt to be clearer, more specific, and more effective.

RULES — follow every one:

1. FIRST PERSON VOICE: Always write from the user's perspective. Use "I", "my", "me". Never use "your", "you", or third person.

2. NEVER INVENT DETAILS: Do not add any names, dates, times, numbers, places, or facts that are not in the original prompt.
   - If the original says "my manager" → keep it "my manager", never invent a name
   - If the original says "a colleague" → use [colleague's name] as a placeholder
   - Missing details get [placeholder] format, not invented specifics
   - BAD: "email my manager John stating I'll be out from 9 AM to 5 PM, covered by Emily"
   - GOOD: "email my manager stating I'll be absent, covered by [colleague's name]"

3. ORIGINAL INTENT: Do not change what the user is asking for. Only make it more specific and structured.

4. BREVITY WITH PRECISION: Remove fluff. Add only instructional improvements — tone, format, structure, constraints. Never pad length.

5. DIRECT INSTRUCTIONS: Write clear directives for the AI, not descriptions of what a good response would look like.

OUTPUT FORMAT — return valid JSON only, no other text:
{
  "enhanced": "the complete rewritten prompt, ready to paste",
  "suggestions": ["short thing user could add 1", "short thing user could add 2"]
}

The "suggestions" array: 2–4 short phrases (under 8 words each) naming specific details the user could provide that would genuinely improve the AI's output. Only include things that are actually missing from the original prompt and would matter.

EXAMPLE of correct output:
Input: "write a leave email for tomorrow, cousin's wedding"
{
  "enhanced": "Write a professional email from me to my manager requesting a day off tomorrow to attend my cousin's wedding. Mention that [colleague's name] will cover my tasks, that I will return the following day, and close with a grateful, respectful tone. Keep it under 120 words.",
  "suggestions": ["Your manager's name", "Colleague covering your work", "Any tasks needing handover", "Your exact return date"]
}`;

const TECHNIQUE_INSTRUCTIONS = {
  1: `Technique: Be Specific. Rewrite this prompt to be maximally specific — add concrete details about the target audience, purpose, desired tone, length, and context. Use [placeholders] for any details that are missing, never invent them. First person voice.`,

  2: `Technique: Assign a Role. Identify the most relevant expert persona for this task — include profession, experience type, and specialization. Re-state the request through that expert's lens. First person voice.`,

  3: `Technique: Give Examples. Add 2–3 realistic, specific examples demonstrating the desired output style and format, labeled "Example 1:", "Example 2:", etc., followed by the actual request. First person voice.`,

  4: `Technique: Specify Format. Rewrite this prompt to explicitly define output structure — table, list, prose, JSON, sections needed, ordering, and length limits. First person voice.`,

  5: `Technique: Think Step-by-Step. Rewrite to enforce numbered reasoning steps before the final answer. Each step must be labeled. Final answer comes last. First person voice.`,

  6: `Technique: Add Constraints. Identify 5–7 constraints that raise output quality: word/length limits, banned clichés for this domain, structural rules (what comes first/last), tone rules, what to exclude. First person voice.`
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'ENHANCE_PROMPT') {
    handleEnhance(msg).then(sendResponse);
    return true;
  }
  if (msg.type === 'TEST_CONNECTION') {
    testConnection(msg.apiKey).then(sendResponse);
    return true;
  }
});

async function handleEnhance({ prompt, techniqueId, customInstruction }) {
  const { apiKey } = await chrome.storage.sync.get('apiKey');
  if (!apiKey) {
    return { success: false, error: 'No API key set. Click ⚙️ to open Settings and add your Groq API key.' };
  }

  const techniqueInstruction = customInstruction || TECHNIQUE_INSTRUCTIONS[techniqueId] || TECHNIQUE_INSTRUCTIONS[1];
  const systemPrompt = `${BASE_SYSTEM}\n\n---\n\nTechnique to apply:\n${techniqueInstruction}`;

  try {
    const raw = await callGroqAPI(apiKey, prompt, systemPrompt, true);
    const parsed = JSON.parse(raw);
    return {
      success: true,
      enhanced: (parsed.enhanced || '').trim(),
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 4) : []
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function testConnection(apiKey) {
  try {
    const result = await callGroqAPI(
      apiKey,
      'Say hello.',
      'You are a test assistant. Reply with exactly: Connection successful.',
      false
    );
    return { success: true, message: result };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function callGroqAPI(apiKey, userPrompt, systemPrompt, jsonMode = false) {
  if (!navigator.onLine) throw new Error('No internet connection detected.');

  const body = {
    model: 'llama-3.3-70b-versatile',
    max_tokens: 1024,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Here is the prompt to enhance:\n\n"${userPrompt}"\n\nReturn your response as JSON only.`
      }
    ]
  };

  if (jsonMode) body.response_format = { type: 'json_object' };

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${res.status}`);
  }

  const data = await res.json();
  return data.choices[0].message.content.trim();
}
