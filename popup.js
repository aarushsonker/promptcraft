/* global TECHNIQUES, chrome */

let allTechniques = [];
let selectedId = 1;
let currentResult = null;

document.addEventListener('DOMContentLoaded', async () => {
  await init();
});

async function init() {
  const { customTechniques = [] } = await chrome.storage.local.get('customTechniques');
  allTechniques = [...TECHNIQUES, ...customTechniques];

  renderTechniqueButtons();
  selectTechnique(1);

  const enhanceBtn = document.getElementById('btn-enhance');
  const promptInput = document.getElementById('prompt-input');

  // Disable Enhance button when textarea is empty
  const syncEnhanceBtn = () => {
    enhanceBtn.disabled = promptInput.value.trim().length === 0;
  };
  promptInput.addEventListener('input', syncEnhanceBtn);
  syncEnhanceBtn();

  enhanceBtn.addEventListener('click', runEnhancement);
  document.getElementById('btn-history').addEventListener('click', showHistoryView);
  document.getElementById('btn-back').addEventListener('click', showEnhanceView);
  document.getElementById('btn-options').addEventListener('click', () => chrome.runtime.openOptionsPage());
  document.getElementById('btn-clear-history').addEventListener('click', clearHistory);
  document.getElementById('btn-import').addEventListener('click', importFromPage);

  // Auto-import from the page when the popup opens
  await importFromPage();
  syncEnhanceBtn();
}

// ── Page read / write (via executeScript — no pre-injected content script needed) ──

// Runs inside the page context; reads the current prompt text.
function PAGE_readPrompt() {
  const selectors = [
    '.ProseMirror[contenteditable="true"]',
    '#prompt-textarea',
    '.ql-editor[contenteditable="true"]',
    '[contenteditable="true"][role="textbox"]',
    'textarea:not([readonly]):not([disabled])',
    '[contenteditable="true"]'
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return (el.value !== undefined ? el.value : el.innerText).trim();
  }
  return '';
}

// Runs inside the page context; inserts text into the prompt field.
function PAGE_insertText(text) {
  const selectors = [
    '.ProseMirror[contenteditable="true"]',
    '#prompt-textarea',
    '.ql-editor[contenteditable="true"]',
    '[contenteditable="true"][role="textbox"]',
    'textarea:not([readonly]):not([disabled])',
    '[contenteditable="true"]'
  ];

  let target = null;
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) { target = el; break; }
  }
  if (!target) return false;

  target.focus();

  if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
    // Native setter so React detects the change
    const proto = target.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(target, text);
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  if (target.isContentEditable) {
    // selectAll then insertText reliably replaces all content in ProseMirror / Quill
    document.execCommand('selectAll', false, null);
    if (document.execCommand('insertText', false, text)) return true;

    // Fallback for editors that block execCommand
    target.innerHTML = '';
    target.appendChild(document.createTextNode(text));
    target.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
    return true;
  }

  return false;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

async function importFromPage() {
  const tab = await getActiveTab();
  if (!tab) return;

  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: PAGE_readPrompt
    });
    if (result) {
      document.getElementById('prompt-input').value = result;
    }
  } catch {
    // Not on a supported page — silently ignore
  }
}

// ── Technique UI ────────────────────────────────────────────────────

function renderTechniqueButtons() {
  const container = document.getElementById('technique-buttons');
  container.innerHTML = '';

  allTechniques.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'tech-btn';
    btn.dataset.tid = t.id;
    btn.textContent = t.id <= 6 ? t.id : t.name;
    btn.title = t.name;
    if (t.id === selectedId) btn.classList.add('active');
    btn.addEventListener('click', () => selectTechnique(t.id));
    container.appendChild(btn);
  });
}

function selectTechnique(id) {
  selectedId = id;
  document.querySelectorAll('.tech-btn').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.tid) === id);
  });
  const technique = allTechniques.find(t => t.id === id);
  if (technique) renderTechniqueCard(technique);
}

function renderTechniqueCard(technique) {
  const card = document.getElementById('technique-card');
  card.innerHTML = `
    <h3>${escHtml(technique.name)}</h3>
    <p>${escHtml(technique.description)}</p>
    <div class="try-it-row">
      <button class="btn-try" id="btn-try">Try It →</button>
      <span class="example-text" title="${escHtml(technique.example)}">${escHtml(technique.example)}</span>
    </div>
  `;
  document.getElementById('btn-try').addEventListener('click', () => {
    document.getElementById('prompt-input').value = technique.example;
    document.getElementById('prompt-input').focus();
  });
}

// ── Enhancement ─────────────────────────────────────────────────────

async function runEnhancement() {
  const prompt = document.getElementById('prompt-input').value.trim();
  if (!prompt) return;

  if (!navigator.onLine) {
    setResultContent(`<div class="error-msg">No internet connection detected.</div>`);
    return;
  }

  const technique = allTechniques.find(t => t.id === selectedId);
  setEnhancing(true);

  const response = await chrome.runtime.sendMessage({
    type: 'ENHANCE_PROMPT',
    prompt,
    techniqueId: selectedId,
    customInstruction: technique?.instruction ?? null
  });

  setEnhancing(false);

  if (response.success) {
    currentResult = { original: prompt, enhanced: response.enhanced };
    showResult(prompt, response.enhanced, response.suggestions || []);
    await saveToHistory(prompt, response.enhanced, technique);
  } else {
    setResultContent(`<div class="error-msg">${escHtml(response.error)}</div>`);
  }
}

function setEnhancing(loading) {
  const btn = document.getElementById('btn-enhance');
  btn.disabled = loading;
  btn.textContent = loading ? '⏳ Enhancing…' : '✨ Enhance My Prompt';
  if (loading) {
    setResultContent(`<div class="loading-msg"><span class="spinner"></span>Enhancing…</div>`);
  }
}

function setResultContent(html) {
  const section = document.getElementById('result-section');
  section.classList.remove('hidden');
  section.innerHTML = html;
}

function showResult(original, enhanced, suggestions = []) {
  const suggestionsHtml = suggestions.length ? `
    <div class="suggestions">
      <div class="suggestions-label">💡 Would be stronger with:</div>
      <div class="suggestions-list">
        ${suggestions.map(s => `<span class="suggestion-chip">${escHtml(s)}</span>`).join('')}
      </div>
    </div>
  ` : '';

  setResultContent(`
    <div class="result-panels">
      <div class="panel panel-before">
        <div class="panel-label">Before</div>
        <div class="panel-text">${escHtml(original)}</div>
      </div>
      <div class="panel panel-after">
        <div class="panel-label">After</div>
        <div class="panel-text">${escHtml(enhanced)}</div>
      </div>
    </div>
    ${suggestionsHtml}
    <div class="result-actions">
      <button id="btn-copy" class="btn-secondary">Copy</button>
      <button id="btn-insert" class="btn-primary">Insert into page</button>
    </div>
  `);

  document.getElementById('btn-copy').addEventListener('click', copyEnhanced);
  document.getElementById('btn-insert').addEventListener('click', insertIntoPage);
}

async function copyEnhanced() {
  if (!currentResult) return;
  await navigator.clipboard.writeText(currentResult.enhanced);

  const btn = document.getElementById('btn-copy');
  if (!btn) return;
  btn.textContent = 'Copied';
  setTimeout(() => { if (btn) btn.textContent = 'Copy'; }, 1600);
}

function insertIntoPage() {
  if (!currentResult) return;

  const section = document.getElementById('result-section');
  const actions = section.querySelector('.result-actions');
  if (!actions) return;

  // Replace action row with inline confirmation
  actions.innerHTML = `
    <div class="confirm-banner">
      <span class="confirm-text">⚠️ This will replace your current prompt.</span>
      <div class="confirm-btns">
        <button id="btn-confirm-yes" class="btn-primary">✓ Replace</button>
        <button id="btn-confirm-no"  class="btn-secondary">Cancel</button>
      </div>
    </div>
  `;

  document.getElementById('btn-confirm-yes').addEventListener('click', doInsert);
  document.getElementById('btn-confirm-no').addEventListener('click', restoreActions);
}

function restoreActions() {
  const section = document.getElementById('result-section');
  const actions = section.querySelector('.result-actions');
  if (!actions) return;
  actions.innerHTML = `
    <button id="btn-copy"   class="btn-secondary">📋 Copy Enhanced</button>
    <button id="btn-insert" class="btn-primary">→ Insert</button>
  `;
  document.getElementById('btn-copy').addEventListener('click', copyEnhanced);
  document.getElementById('btn-insert').addEventListener('click', insertIntoPage);
}

async function doInsert() {
  const tab = await getActiveTab();
  if (!tab) return;

  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: PAGE_insertText,
      args: [currentResult.enhanced]
    });

    if (!result) showInsertError('No editable field found on this page.');
    else restoreActions();
  } catch {
    showInsertError('Cannot access this page. Try Claude.ai or ChatGPT.');
  }
}

function showInsertError(msg) {
  const section = document.getElementById('result-section');
  if (section.querySelector('.error-msg')) return;
  const err = document.createElement('div');
  err.className = 'error-msg';
  err.style.marginTop = '8px';
  err.textContent = msg;
  section.appendChild(err);
}

// ── History View ────────────────────────────────────────────────────

function showHistoryView() {
  document.getElementById('view-enhance').classList.remove('active');
  document.getElementById('view-history').classList.add('active');
  renderHistory();
}

function showEnhanceView() {
  document.getElementById('view-history').classList.remove('active');
  document.getElementById('view-enhance').classList.add('active');
}

async function renderHistory() {
  const { history = [] } = await chrome.storage.local.get('history');
  const list = document.getElementById('history-list');

  if (history.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        Enhance a prompt to see history here.
      </div>
    `;
    return;
  }

  list.innerHTML = history.map(entry => `
    <div class="history-item">
      <div class="history-item-header">
        <span class="history-technique">${escHtml(entry.techniqueName)}</span>
        <span class="history-time">${formatTime(entry.timestamp)}</span>
      </div>
      <div class="history-preview">${escHtml(entry.original)}</div>
      <div class="history-actions">
        <button class="btn-use" data-hid="${entry.id}">↩ Re-use</button>
        <button class="btn-delete" data-hid="${entry.id}">✕ Delete</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.btn-use').forEach(btn => {
    btn.addEventListener('click', () => reuseEntry(btn.dataset.hid, history));
  });
  list.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteEntry(btn.dataset.hid));
  });
}

function reuseEntry(id, history) {
  const entry = history.find(h => h.id === id);
  if (!entry) return;
  showEnhanceView();
  document.getElementById('prompt-input').value = entry.original;
  selectTechnique(entry.techniqueId ?? 1);
  currentResult = { original: entry.original, enhanced: entry.enhanced };
  showResult(entry.original, entry.enhanced);
}

async function deleteEntry(id) {
  const { history = [] } = await chrome.storage.local.get('history');
  await chrome.storage.local.set({ history: history.filter(h => h.id !== id) });
  renderHistory();
}

async function clearHistory() {
  const btn = document.getElementById('btn-clear-history');
  if (btn.dataset.confirming) {
    await chrome.storage.local.set({ history: [] });
    delete btn.dataset.confirming;
    btn.textContent = 'Clear All';
    renderHistory();
  } else {
    btn.dataset.confirming = '1';
    btn.textContent = 'Sure?';
    setTimeout(() => {
      if (btn.dataset.confirming) {
        delete btn.dataset.confirming;
        btn.textContent = 'Clear All';
      }
    }, 3000);
  }
}

async function saveToHistory(original, enhanced, technique) {
  const { history = [] } = await chrome.storage.local.get('history');
  history.unshift({
    id: Date.now().toString(),
    timestamp: Date.now(),
    techniqueId: technique?.id ?? 1,
    techniqueName: technique?.name ?? 'Unknown',
    original,
    enhanced
  });
  if (history.length > 50) history.length = 50;
  await chrome.storage.local.set({ history });
}

// ── Utilities ───────────────────────────────────────────────────────

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function formatTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 60_000)    return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}
