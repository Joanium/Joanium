// ─────────────────────────────────────────────
//  openworld — Public/Assets/Scripts/App.js
//  UI interactions · Real AI API calls · Dynamic model selector
// ─────────────────────────────────────────────

import { APP_NAME } from './Config.js';

/* ══════════════════════════════════════════
   STATE
══════════════════════════════════════════ */
const state = {
  messages: [],        // full conversation history
  isTyping: false,
  theme: localStorage.getItem('ow-theme') || 'dark',
  providers: [],       // from Models.json, filtered to those with API keys
  selectedProvider: null,
  selectedModel: null,
};

/* ══════════════════════════════════════════
   DOM REFS
══════════════════════════════════════════ */
const textarea         = document.getElementById('chat-input');
const sendBtn          = document.getElementById('send-btn');
const welcome          = document.getElementById('welcome');
const chatView         = document.getElementById('chat-view');
const chatMessages     = document.getElementById('chat-messages');
const chips            = document.querySelectorAll('.chip');
const sidebarBtns      = document.querySelectorAll('.sidebar-btn[data-view]');
const themeBtn         = document.getElementById('theme-toggle-btn');
const themePanel       = document.getElementById('theme-panel');
const themeOptions     = document.querySelectorAll('.theme-option');
const modelSelectorBtn = document.getElementById('model-selector-btn');
const modelDropdown    = document.getElementById('model-dropdown');
const modelLabel       = document.getElementById('model-label');

/* ── Window controls ── */
document.getElementById('btn-minimize')?.addEventListener('click', () => window.electronAPI?.minimize());
document.getElementById('btn-maximize')?.addEventListener('click', () => window.electronAPI?.maximize());
document.getElementById('btn-close')?.addEventListener('click',    () => window.electronAPI?.close());

/* ══════════════════════════════════════════
   THEME SYSTEM
══════════════════════════════════════════ */
const THEMES = ['dark', 'light', 'midnight', 'forest', 'pinky'];

function applyTheme(theme, animate = true) {
  if (!THEMES.includes(theme)) theme = 'dark';

  if (animate) {
    const flash = document.createElement('div');
    flash.style.cssText = `position:fixed;inset:0;z-index:9999;background:var(--accent-glow);pointer-events:none;animation:themeFlash 0.35s ease forwards;`;
    document.body.appendChild(flash);
    flash.addEventListener('animationend', () => flash.remove());
  }

  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('ow-theme', theme);
  state.theme = theme;

  themeOptions.forEach(opt => {
    opt.classList.toggle('active', opt.dataset.theme === theme);
  });
}

const styleEl = document.createElement('style');
styleEl.textContent = `@keyframes themeFlash { 0%{opacity:.3} 100%{opacity:0} }`;
document.head.appendChild(styleEl);

applyTheme(state.theme, false);

themeBtn?.addEventListener('click', e => {
  e.stopPropagation();
  themePanel.classList.toggle('open');
});

themeOptions.forEach(opt => {
  opt.addEventListener('click', () => {
    applyTheme(opt.dataset.theme);
    themePanel.classList.remove('open');
  });
});

document.addEventListener('click', e => {
  if (!themePanel.contains(e.target) && e.target !== themeBtn)
    themePanel.classList.remove('open');
  if (modelDropdown && !modelDropdown.contains(e.target) && e.target !== modelSelectorBtn)
    modelDropdown.classList.remove('open');
});

/* ══════════════════════════════════════════
   MODEL SELECTOR — reads Models.json via IPC,
   shows only providers that have an API key set
══════════════════════════════════════════ */
async function loadProviders() {
  try {
    const all = await window.electronAPI?.getModels() ?? [];
    state.providers = all.filter(p => p.api && p.api.trim() !== '');

    if (state.providers.length === 0) {
      modelLabel.textContent = 'No API keys set';
      return;
    }

    // Default to first provider's first model
    const first = state.providers[0];
    const firstModelId = Object.keys(first.models)[0];
    state.selectedProvider = first;
    state.selectedModel = firstModelId;
    updateModelLabel();
    buildModelDropdown();
  } catch (err) {
    console.warn('[openworld] Could not load models:', err);
    modelLabel.textContent = 'openworld 1.0';
  }
}

function updateModelLabel() {
  if (!state.selectedProvider || !state.selectedModel) return;
  const name = state.selectedProvider.models[state.selectedModel]?.name ?? state.selectedModel;
  modelLabel.textContent = name;
}

function buildModelDropdown() {
  modelDropdown.innerHTML = '';

  state.providers.forEach(provider => {
    const section = document.createElement('div');
    section.className = 'model-group';

    const header = document.createElement('div');
    header.className = 'model-group-header';
    header.textContent = provider.label;
    section.appendChild(header);

    Object.entries(provider.models).forEach(([modelId, info]) => {
      const item = document.createElement('button');
      item.className = 'model-item';
      const isActive = state.selectedProvider?.provider === provider.provider && state.selectedModel === modelId;
      if (isActive) item.classList.add('active');

      item.innerHTML = `
        <span class="model-item-name">${info.name}</span>
        <span class="model-item-desc">${info.description}</span>`;

      item.addEventListener('click', () => {
        state.selectedProvider = provider;
        state.selectedModel = modelId;
        updateModelLabel();
        buildModelDropdown();
        modelDropdown.classList.remove('open');
      });

      section.appendChild(item);
    });

    modelDropdown.appendChild(section);
  });
}

modelSelectorBtn?.addEventListener('click', e => {
  e.stopPropagation();
  if (state.providers.length === 0) return;
  modelDropdown.classList.toggle('open');
});

/* ══════════════════════════════════════════
   TEXTAREA AUTO-RESIZE
══════════════════════════════════════════ */
function autoResize() {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  updateSendBtn();
}

function updateSendBtn() {
  sendBtn.classList.toggle('ready', textarea.value.trim().length > 0);
}

textarea.addEventListener('input', autoResize);
textarea.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
sendBtn.addEventListener('click', sendMessage);

chips.forEach(chip => {
  chip.addEventListener('click', () => {
    textarea.value = chip.getAttribute('data-prompt');
    autoResize();
    textarea.focus();
    chip.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(0.95)' }, { transform: 'scale(1)' }],
      { duration: 200, easing: 'ease-out' }
    );
  });
});

/* ══════════════════════════════════════════
   MESSAGING
══════════════════════════════════════════ */
function sendMessage() {
  const text = textarea.value.trim();
  if (!text || state.isTyping) return;

  showChatView();
  appendMessage('user', text);

  textarea.value = '';
  textarea.style.height = 'auto';
  updateSendBtn();

  sendBtn.animate(
    [{ transform:'scale(1)' },{ transform:'scale(0.85)' },{ transform:'scale(1.15)' },{ transform:'scale(1)' }],
    { duration: 350, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
  );

  callAI(text);
}

function showChatView() {
  if (chatView.classList.contains('active')) return;

  welcome.animate(
    [{ opacity:1, transform:'translateY(0) scale(1)' }, { opacity:0, transform:'translateY(-16px) scale(0.97)' }],
    { duration: 280, easing: 'cubic-bezier(0.4,0,1,1)', fill: 'forwards' }
  ).onfinish = () => { welcome.style.display = 'none'; };

  chatView.classList.add('active');
}

function appendMessage(role, content) {
  state.messages.push({ role, content });

  const row = document.createElement('div');
  row.className = `message-row ${role}`;

  if (role === 'user') {
    row.innerHTML = `<div class="bubble">${escapeHtml(content)}</div>`;
  } else {
    row.innerHTML = `
      <div class="assistant-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L8 6H4v4L2 12l2 2v4h4l4 4 4-4h4v-4l2-2-2-2V6h-4L12 2z" stroke-width="1.5"/>
        </svg>
      </div>
      <div class="content"></div>`;
    row.querySelector('.content').innerHTML = renderMarkdown(content);
  }

  chatMessages.appendChild(row);
  smoothScrollToBottom();
  return row;
}

function smoothScrollToBottom() {
  chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
}

/* ══════════════════════════════════════════
   REAL AI API CALLS
══════════════════════════════════════════ */
async function callAI(userText) {
  state.isTyping = true;

  // Typing indicator
  const typingRow = document.createElement('div');
  typingRow.className = 'message-row assistant';
  typingRow.id = 'typing-row';
  typingRow.innerHTML = `
    <div class="assistant-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L8 6H4v4L2 12l2 2v4h4l4 4 4-4h4v-4l2-2-2-2V6h-4L12 2z" stroke-width="1.5"/>
      </svg>
    </div>
    <div class="content" style="padding-top:6px">
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
    </div>`;
  chatMessages.appendChild(typingRow);
  smoothScrollToBottom();

  const removeTyping = (cb) => {
    typingRow.animate(
      [{ opacity:1, transform:'scale(1)' }, { opacity:0, transform:'scale(0.96)' }],
      { duration: 180, easing: 'ease-in', fill: 'forwards' }
    ).onfinish = () => {
      typingRow.remove();
      state.isTyping = false;
      cb?.();
    };
  };

  if (!state.selectedProvider || !state.selectedModel) {
    removeTyping(() => appendMessage('assistant', '⚠️ No AI provider configured. Please add an API key in Settings.'));
    return;
  }

  try {
    const reply = await fetchFromProvider(state.selectedProvider, state.selectedModel, state.messages);
    removeTyping(() => appendMessage('assistant', reply));
  } catch (err) {
    const msg = `❌ **API Error** (${state.selectedProvider.label}): ${err.message}`;
    removeTyping(() => appendMessage('assistant', msg));
    console.error('[openworld] API error:', err);
  }
}

async function fetchFromProvider(provider, modelId, messages) {
  const { provider: id, endpoint, api, auth_header, auth_prefix = '' } = provider;
  const history = messages.slice(-20);

  /* ── Anthropic ── */
  if (id === 'anthropic') {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': api,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 2048,
        messages: history.map(m => ({ role: m.role, content: m.content })),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.content?.[0]?.text ?? '(empty response)';
  }

  /* ── Google Gemini ── */
  if (id === 'google') {
    const url = endpoint.replace('{model}', modelId) + `?key=${api}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: history.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '(empty response)';
  }

  /* ── OpenAI + OpenRouter (same format) ── */
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [auth_header]: `${auth_prefix}${api}`,
      ...(id === 'openrouter' ? { 'HTTP-Referer': 'https://openworld.app', 'X-Title': 'openworld' } : {}),
    },
    body: JSON.stringify({
      model: modelId,
      messages: history.map(m => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '(empty response)';
}

/* ══════════════════════════════════════════
   BASIC MARKDOWN RENDERER
══════════════════════════════════════════ */
function renderMarkdown(text) {
  let html = escapeHtml(text);

  // Code blocks (must come before inline code)
  html = html.replace(/```(?:[^\n]*)?\n([\s\S]*?)```/g, (_, code) =>
    `<pre><code>${code}</code></pre>`
  );
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm,  '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm,   '<h1>$1</h1>');
  // List items
  html = html.replace(/^[-•*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  // Paragraphs
  html = html.replace(/\n\n+/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');

  return `<p>${html}</p>`;
}

/* ══════════════════════════════════════════
   SIDEBAR NAV
══════════════════════════════════════════ */
sidebarBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    sidebarBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

/* ══════════════════════════════════════════
   UTIL
══════════════════════════════════════════ */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
document.title = APP_NAME;
loadProviders();
console.log(`[${APP_NAME}] UI loaded ✓ theme: ${state.theme}`);
