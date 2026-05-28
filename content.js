chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'INSERT_TEXT') {
    const success = insertText(msg.text);
    sendResponse({ success });
  }
  return true;
});

function insertText(text) {
  const target = findInputTarget();
  if (!target) return false;

  target.focus();

  if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
    // Use native setter so React's synthetic event system detects the change
    const proto = target.tagName === 'TEXTAREA'
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    nativeSetter.call(target, text);
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  if (target.isContentEditable) {
    // Select all existing content then replace — works with ProseMirror (Claude.ai) and Quill (Gemini)
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(target);
    selection.removeAllRanges();
    selection.addRange(range);

    if (document.execCommand('insertText', false, text)) return true;

    // Fallback for editors that block execCommand
    target.innerHTML = '';
    target.appendChild(document.createTextNode(text));
    target.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
    return true;
  }

  return false;
}

function findInputTarget() {
  // Check active/focused element first — user may have clicked into the field before opening the popup
  const active = document.activeElement;
  if (active && isEditable(active)) return active;

  // Site-specific selectors in priority order
  const selectors = [
    '.ProseMirror[contenteditable="true"]',       // Claude.ai
    '#prompt-textarea',                             // ChatGPT
    '.ql-editor[contenteditable="true"]',          // Gemini (Quill)
    'textarea[name="sq"]',                         // Copilot
    '[contenteditable="true"][role="textbox"]',    // Generic accessible editors
    'textarea:not([readonly]):not([disabled])',
    '[contenteditable="true"]'
  ];

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }

  return null;
}

function isEditable(el) {
  if (!el) return false;
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return !el.readOnly && !el.disabled;
  return el.isContentEditable;
}
