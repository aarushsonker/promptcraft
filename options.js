/* global chrome */

const CUSTOM_TECHNIQUE_BASE_ID = 100; // custom technique IDs start here

document.addEventListener('DOMContentLoaded', async () => {
  await loadApiKey();
  await renderCustomTechniques();
  setupListeners();
});

// ── API Key ─────────────────────────────────────────────────────────

async function loadApiKey() {
  const { apiKey = '' } = await chrome.storage.sync.get('apiKey');
  document.getElementById('api-key-input').value = apiKey;
}

function setupListeners() {
  document.getElementById('btn-toggle-key').addEventListener('click', () => {
    const input = document.getElementById('api-key-input');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  document.getElementById('btn-save-key').addEventListener('click', saveApiKey);
  document.getElementById('btn-test-key').addEventListener('click', testConnection);
  document.getElementById('btn-remove-key').addEventListener('click', removeApiKey);

  document.getElementById('btn-save-technique').addEventListener('click', saveCustomTechnique);
  document.getElementById('btn-cancel-technique').addEventListener('click', () => {
    document.getElementById('add-technique-details').removeAttribute('open');
    clearAddForm();
  });

  document.getElementById('btn-clear-history').addEventListener('click', clearHistory);
}

async function saveApiKey() {
  const key = document.getElementById('api-key-input').value.trim();
  if (!key) {
    showStatus('key-status', 'Enter a valid API key.', 'error');
    return;
  }
  await chrome.storage.sync.set({ apiKey: key });
  showStatus('key-status', 'API key saved.', 'success');
}

async function removeApiKey() {
  await chrome.storage.sync.remove('apiKey');
  document.getElementById('api-key-input').value = '';
  showStatus('key-status', 'API key removed.', 'success');
}

async function testConnection() {
  const key = document.getElementById('api-key-input').value.trim();
  if (!key) {
    showStatus('key-status', 'Enter a key first, then test.', 'error');
    return;
  }
  const btn = document.getElementById('btn-test-key');
  btn.textContent = 'Testing…';
  btn.disabled = true;

  const response = await chrome.runtime.sendMessage({ type: 'TEST_CONNECTION', apiKey: key });

  btn.textContent = 'Test Connection';
  btn.disabled = false;

  if (response.success) {
    showStatus('key-status', '✓ Connection successful — API key works.', 'success');
  } else {
    showStatus('key-status', `✗ ${response.error}`, 'error');
  }
}

// ── Custom Techniques ───────────────────────────────────────────────

async function renderCustomTechniques() {
  const { customTechniques = [] } = await chrome.storage.sync.get('customTechniques');
  const list = document.getElementById('custom-list');

  if (customTechniques.length === 0) {
    list.innerHTML = '<p style="font-size:12.5px;color:#9ca3af;margin-bottom:4px;">No custom techniques yet.</p>';
    return;
  }

  list.innerHTML = customTechniques.map(t => `
    <div class="custom-item">
      <div class="custom-item-info">
        <div class="custom-item-name">${escHtml(t.name)}</div>
        <div class="custom-item-desc">${escHtml(t.description)}</div>
      </div>
      <div class="custom-item-actions">
        <button class="btn-sm edit" data-cid="${t.id}">Edit</button>
        <button class="btn-sm del" data-cid="${t.id}">Delete</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.btn-sm.edit').forEach(btn => {
    btn.addEventListener('click', () => editCustomTechnique(Number(btn.dataset.cid), customTechniques));
  });

  list.querySelectorAll('.btn-sm.del').forEach(btn => {
    btn.addEventListener('click', () => deleteCustomTechnique(Number(btn.dataset.cid)));
  });
}

function editCustomTechnique(id, techniques) {
  const t = techniques.find(x => x.id === id);
  if (!t) return;

  document.getElementById('ct-name').value = t.name;
  document.getElementById('ct-desc').value = t.description;
  document.getElementById('ct-example').value = t.example ?? '';
  document.getElementById('ct-instruction').value = t.instruction;

  const details = document.getElementById('add-technique-details');
  details.setAttribute('open', '');
  details.dataset.editingId = id;

  document.getElementById('btn-save-technique').textContent = 'Update Technique';
  document.getElementById('ct-name').focus();
}

async function saveCustomTechnique() {
  const name = document.getElementById('ct-name').value.trim();
  const desc = document.getElementById('ct-desc').value.trim();
  const example = document.getElementById('ct-example').value.trim();
  const instruction = document.getElementById('ct-instruction').value.trim();

  const errEl = document.getElementById('ct-form-error');

  if (!name || !desc || !instruction) {
    errEl.textContent = 'Name, Description, and Enhancement Instruction are required.';
    errEl.classList.remove('hidden');
    return;
  }

  errEl.classList.add('hidden');

  const { customTechniques = [] } = await chrome.storage.sync.get('customTechniques');
  const details = document.getElementById('add-technique-details');
  const editingId = details.dataset.editingId ? Number(details.dataset.editingId) : null;

  if (editingId) {
    const idx = customTechniques.findIndex(t => t.id === editingId);
    if (idx !== -1) {
      customTechniques[idx] = { ...customTechniques[idx], name, description: desc, example, instruction };
    }
    delete details.dataset.editingId;
  } else {
    const maxId = customTechniques.reduce((m, t) => Math.max(m, t.id), CUSTOM_TECHNIQUE_BASE_ID - 1);
    customTechniques.push({ id: maxId + 1, name, description: desc, example, instruction });
  }

  await chrome.storage.sync.set({ customTechniques });

  details.removeAttribute('open');
  clearAddForm();
  document.getElementById('btn-save-technique').textContent = 'Save Technique';
  await renderCustomTechniques();
}

async function deleteCustomTechnique(id) {
  const { customTechniques = [] } = await chrome.storage.sync.get('customTechniques');
  await chrome.storage.sync.set({ customTechniques: customTechniques.filter(t => t.id !== id) });
  await renderCustomTechniques();
}

function clearAddForm() {
  ['ct-name', 'ct-desc', 'ct-example', 'ct-instruction'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('ct-form-error').classList.add('hidden');
  document.getElementById('btn-save-technique').textContent = 'Save Technique';
}

// ── Data ────────────────────────────────────────────────────────────

async function clearHistory() {
  const btn = document.getElementById('btn-clear-history');
  if (btn.dataset.confirming) {
    await chrome.storage.sync.set({ history: [] });
    delete btn.dataset.confirming;
    btn.textContent = 'Clear History';
    showStatus('data-status', 'History cleared.', 'success');
  } else {
    btn.dataset.confirming = '1';
    btn.textContent = 'Really clear?';
    setTimeout(() => {
      if (btn.dataset.confirming) {
        delete btn.dataset.confirming;
        btn.textContent = 'Clear History';
      }
    }, 3000);
  }
}

// ── Utilities ───────────────────────────────────────────────────────

function showStatus(elementId, message, type) {
  const el = document.getElementById(elementId);
  el.textContent = message;
  el.className = `status-msg ${type}`;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3000);
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
