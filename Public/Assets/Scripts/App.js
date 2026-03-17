// ─────────────────────────────────────────────
//  openworld — app.js
//  UI interactions · Chat logic · Theme switcher
// ─────────────────────────────────────────────

import { APP_NAME } from './Config.js';

/* ── State ── */
const state = {
  messages: [],
  isTyping: false,
  theme: localStorage.getItem('ow-theme') || 'dark',
};

/* ── DOM refs ── */
const textarea     = document.getElementById('chat-input');
const sendBtn      = document.getElementById('send-btn');
const welcome      = document.getElementById('welcome');
const chatView     = document.getElementById('chat-view');
const chatMessages = document.getElementById('chat-messages');
const chips        = document.querySelectorAll('.chip');
const sidebarBtns  = document.querySelectorAll('.sidebar-btn[data-view]');
const themeBtn     = document.getElementById('theme-toggle-btn');
const themePanel   = document.getElementById('theme-panel');
const themeOptions = document.querySelectorAll('.theme-option');

/* ══════════════════════════════════════════
   THEME SYSTEM
══════════════════════════════════════════ */
const THEMES = ['dark', 'light', 'midnight', 'forest', 'pinky'];

function applyTheme(theme, animate = true) {
  if (!THEMES.includes(theme)) theme = 'dark';

  if (animate) {
    // Ripple flash on switch
    const flash = document.createElement('div');
    flash.style.cssText = `
      position:fixed; inset:0; z-index:9999;
      background: var(--accent-glow);
      pointer-events:none;
      animation: themeFlash 0.35s ease forwards;
    `;
    document.body.appendChild(flash);
    flash.addEventListener('animationend', () => flash.remove());
  }

  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('ow-theme', theme);
  state.theme = theme;

  // Update active state on options
  themeOptions.forEach(opt => {
    opt.classList.toggle('active', opt.dataset.theme === theme);
  });
}

function toggleThemePanel() {
  themePanel.classList.toggle('open');
}

function closeThemePanel() {
  themePanel.classList.remove('open');
}

// Inject flash keyframe once
const styleEl = document.createElement('style');
styleEl.textContent = `
  @keyframes themeFlash {
    0%   { opacity: 0.3; }
    100% { opacity: 0;   }
  }
`;
document.head.appendChild(styleEl);

// Init theme on load
applyTheme(state.theme, false);

// Theme button toggle
themeBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleThemePanel();
});

// Theme option clicks
themeOptions.forEach(opt => {
  opt.addEventListener('click', () => {
    applyTheme(opt.dataset.theme);
    closeThemePanel();
  });
});

// Close panel on outside click
document.addEventListener('click', (e) => {
  if (!themePanel.contains(e.target) && e.target !== themeBtn) {
    closeThemePanel();
  }
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
  const hasText = textarea.value.trim().length > 0;
  sendBtn.classList.toggle('ready', hasText);
}

textarea.addEventListener('input', autoResize);

textarea.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

sendBtn.addEventListener('click', sendMessage);

/* ── Chips ── */
chips.forEach(chip => {
  chip.addEventListener('click', () => {
    const prompt = chip.getAttribute('data-prompt');
    textarea.value = prompt;
    autoResize();
    textarea.focus();

    // Subtle pulse animation on the chip
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

  // Send button pulse
  sendBtn.animate(
    [
      { transform: 'scale(1)' },
      { transform: 'scale(0.85)' },
      { transform: 'scale(1.15)' },
      { transform: 'scale(1)' }
    ],
    { duration: 350, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
  );

  simulateResponse(text);
}

function showChatView() {
  if (chatView.classList.contains('active')) return;

  // Slide welcome out
  welcome.animate(
    [
      { opacity: 1, transform: 'translateY(0) scale(1)' },
      { opacity: 0, transform: 'translateY(-16px) scale(0.97)' }
    ],
    { duration: 280, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' }
  ).onfinish = () => { welcome.style.display = 'none'; };

  chatView.classList.add('active');
}

/* ── Append message to DOM ── */
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
      <div class="content"><p>${content}</p></div>`;
  }

  chatMessages.appendChild(row);
  smoothScrollToBottom();
  return row;
}

function smoothScrollToBottom() {
  chatMessages.scrollTo({
    top: chatMessages.scrollHeight,
    behavior: 'smooth',
  });
}

/* ── Simulated AI response ── */
function simulateResponse(userText) {
  state.isTyping = true;

  // Typing indicator
  const row = document.createElement('div');
  row.className = 'message-row assistant';
  row.id = 'typing-row';
  row.innerHTML = `
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

  chatMessages.appendChild(row);
  smoothScrollToBottom();

  const delay = 1100 + Math.random() * 900;

  setTimeout(() => {
    // Fade out typing row
    row.animate(
      [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.96)' }],
      { duration: 180, easing: 'ease-in', fill: 'forwards' }
    ).onfinish = () => {
      row.remove();
      state.isTyping = false;

      const replies = [
        `I'm ${APP_NAME}, your connected world assistant. I heard you — let me help with that.`,
        `Got it. Working on that for you right now.`,
        `Sure thing! Here's what I found for "${escapeHtml(userText.slice(0, 40))}..."`,
        `That's a great question. Let me break it down for you.`,
        `On it. Here's everything you need to know.`,
      ];
      const reply = replies[Math.floor(Math.random() * replies.length)];
      appendMessage('assistant', reply);
    };
  }, delay);
}

/* ── Sidebar nav ── */
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
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}

/* ── Init ── */
document.title = APP_NAME;
console.log(`[${APP_NAME}] UI loaded ✓ theme: ${state.theme}`);
