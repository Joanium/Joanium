// Window controls
import '../Shared/WindowControls.js';

// Modals
import { initSidebar } from '../Shared/Sidebar.js';
import { initAboutModal } from '../Shared/Modals/AboutModal.js';
import { initLibraryModal } from '../Shared/Modals/LibraryModal.js';
import { initSettingsModal } from '../Shared/Modals/SettingsModal.js';

const about = initAboutModal();
const settings = initSettingsModal();

const library = initLibraryModal({
  onChatSelect: (chatId) => {
    if (chatId) localStorage.setItem('ow-pending-chat', chatId);
    window.electronAPI?.launchMain();
  },
});

const sidebar = initSidebar({
  activePage: 'skills',
  onNewChat: () => window.electronAPI?.launchMain(),
  onLibrary: () => library.isOpen() ? library.close() : library.open(),
  onAutomations: () => window.electronAPI?.launchAutomations?.(),
  onAgents: () => window.electronAPI?.launchAgents?.(),
  onEvents: () => window.electronAPI?.launchEvents?.(),
  onSkills: () => { /* already here */ },
  onPersonas: () => window.electronAPI?.launchPersonas?.(),
  onUsage: () => window.electronAPI?.launchUsage?.(),
  onSettings: () => settings.open(),
  onAbout: () => about.open(),
});

window.addEventListener('ow:user-profile-updated', e => sidebar.setUser(e.detail?.name ?? ''));
settings.loadUser().then(user => sidebar.setUser(user?.name ?? ''));

// ── DOM refs ─────────────────────────────────────────────────────────────
const skillsGrid = document.getElementById('skills-grid');
const skillsEmpty = document.getElementById('skills-empty');
const searchWrapper = document.getElementById('skills-search-wrapper');
const searchInput = document.getElementById('skills-search');
const countEl = document.getElementById('skills-count');
const enabledCountEl = document.getElementById('skills-enabled-count');
const enableAllBtn = document.getElementById('skills-enable-all');
const disableAllBtn = document.getElementById('skills-disable-all');
const modalBackdrop = document.getElementById('skill-modal-backdrop');
const modalName = document.getElementById('skill-modal-name');
const modalContent = document.getElementById('skill-modal-content');
const modalCloseBtn = document.getElementById('skill-modal-close');

// ── State ─────────────────────────────────────────────────────────────────
let _allSkills = [];

// ── Confirmation dialog ───────────────────────────────────────────────────

function injectConfirmDialog() {
  if (document.getElementById('skills-confirm-backdrop')) return;

  const el = document.createElement('div');
  el.innerHTML = `
    <div id="skills-confirm-backdrop">
      <div class="skills-confirm-box">
        <div class="skills-confirm-icon" id="skills-confirm-icon"></div>
        <h3 id="skills-confirm-title"></h3>
        <p  id="skills-confirm-body"></p>
        <div class="skills-confirm-actions">
          <button class="skills-confirm-btn skills-confirm-btn--cancel" id="skills-confirm-cancel">Cancel</button>
          <button class="skills-confirm-btn skills-confirm-btn--ok"     id="skills-confirm-ok"></button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(el.firstElementChild);

  // Inject styles
  const style = document.createElement('style');
  style.textContent = `
    #skills-confirm-backdrop {
      position: fixed; inset: 0;
      display: flex; align-items: center; justify-content: center;
      padding: 32px;
      background: rgba(8,11,18,0.55);
      backdrop-filter: blur(12px);
      z-index: 500;
      opacity: 0; pointer-events: none;
      transition: opacity 0.22s ease;
    }
    #skills-confirm-backdrop.open {
      opacity: 1; pointer-events: auto;
    }
    .skills-confirm-box {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 32px 28px 26px;
      width: min(400px, calc(100vw - 48px));
      box-shadow: 0 32px 96px rgba(0,0,0,0.32);
      transform: translateY(16px) scale(0.95);
      transition: transform 0.28s var(--ease-spring);
      display: flex; flex-direction: column; align-items: center;
      text-align: center; gap: 0;
    }
    #skills-confirm-backdrop.open .skills-confirm-box {
      transform: translateY(0) scale(1);
    }
    .skills-confirm-icon {
      width: 52px; height: 52px; border-radius: 15px;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 16px; flex-shrink: 0;
    }
    .skills-confirm-icon--enable {
      background: var(--accent-dim);
      border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
      color: var(--accent);
    }
    .skills-confirm-icon--disable {
      background: var(--bg-tertiary);
      border: 1px solid var(--border);
      color: var(--text-muted);
    }
    #skills-confirm-title {
      font-size: 17px; font-weight: 600;
      color: var(--text-primary); margin: 0 0 10px;
    }
    #skills-confirm-body {
      font-size: 13px; color: var(--text-secondary);
      line-height: 1.6; margin: 0 0 26px; max-width: 300px;
    }
    .skills-confirm-actions {
      display: flex; gap: 10px; width: 100%;
    }
    .skills-confirm-btn {
      flex: 1; padding: 10px;
      border-radius: 12px;
      font-family: var(--font-ui); font-size: 13px; font-weight: 600;
      cursor: pointer; border: none;
      transition: opacity 0.15s, transform 0.1s, background 0.15s;
    }
    .skills-confirm-btn:hover  { opacity: 0.88; }
    .skills-confirm-btn:active { transform: scale(0.97); }
    .skills-confirm-btn--cancel {
      background: var(--bg-tertiary);
      color: var(--text-secondary);
      border: 1px solid var(--border);
    }
    .skills-confirm-btn--cancel:hover { background: var(--bg-hover); opacity: 1; }
    .skills-confirm-btn--ok--enable {
      background: var(--accent); color: #fff;
      box-shadow: 0 4px 14px var(--accent-glow);
    }
    .skills-confirm-btn--ok--disable {
      background: var(--bg-hover); color: var(--text-primary);
      border: 1px solid var(--border);
    }
  `;
  document.head.appendChild(style);

  document.getElementById('skills-confirm-cancel').addEventListener('click', closeConfirm);
  document.getElementById('skills-confirm-backdrop').addEventListener('click', e => {
    if (e.target.id === 'skills-confirm-backdrop') closeConfirm();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.getElementById('skills-confirm-backdrop')?.classList.contains('open')) {
      closeConfirm();
    }
  });
}

let _confirmResolve = null;

function openConfirm({ type }) {
  injectConfirmDialog();

  const backdrop = document.getElementById('skills-confirm-backdrop');
  const iconEl = document.getElementById('skills-confirm-icon');
  const titleEl = document.getElementById('skills-confirm-title');
  const bodyEl = document.getElementById('skills-confirm-body');
  const okBtn = document.getElementById('skills-confirm-ok');

  if (type === 'enable') {
    iconEl.className = 'skills-confirm-icon skills-confirm-icon--enable';
    iconEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="26" height="26">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
    titleEl.textContent = 'Enable all skills?';
    bodyEl.textContent = `This will activate all ${_allSkills.length} skill${_allSkills.length !== 1 ? 's' : ''} and inject them into every AI conversation.`;
    okBtn.textContent = 'Enable all';
    okBtn.className = 'skills-confirm-btn skills-confirm-btn--ok skills-confirm-btn--ok--enable';
  } else {
    iconEl.className = 'skills-confirm-icon skills-confirm-icon--disable';
    iconEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="26" height="26">
      <circle cx="12" cy="12" r="10"/>
      <path d="M4.93 4.93l14.14 14.14" stroke-linecap="round"/>
    </svg>`;
    titleEl.textContent = 'Disable all skills?';
    bodyEl.textContent = `This will deactivate all ${_allSkills.filter(s => s.enabled).length} active skill${_allSkills.filter(s => s.enabled).length !== 1 ? 's' : ''}. The AI will no longer use them.`;
    okBtn.textContent = 'Disable all';
    okBtn.className = 'skills-confirm-btn skills-confirm-btn--ok skills-confirm-btn--ok--disable';
  }

  backdrop.classList.add('open');
  document.body.classList.add('modal-open');

  return new Promise(resolve => {
    _confirmResolve = resolve;
    // Wire ok button fresh each time (avoids stale listener)
    const newOk = okBtn.cloneNode(true);
    okBtn.replaceWith(newOk);
    newOk.className = okBtn.className; // restore class lost during clone
    if (type === 'enable') {
      newOk.className = 'skills-confirm-btn skills-confirm-btn--ok skills-confirm-btn--ok--enable';
    } else {
      newOk.className = 'skills-confirm-btn skills-confirm-btn--ok skills-confirm-btn--ok--disable';
    }
    newOk.textContent = type === 'enable' ? 'Enable all' : 'Disable all';
    newOk.addEventListener('click', () => { _confirmResolve = null; closeConfirm(); resolve(true); });
  });
}

function closeConfirm() {
  const backdrop = document.getElementById('skills-confirm-backdrop');
  backdrop?.classList.remove('open');
  document.body.classList.remove('modal-open');
  _confirmResolve?.(false);
  _confirmResolve = null;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function escapeHtml(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderMarkdown(raw) {
  let text = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim();
  let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  html = html.replace(/```([\s\S]*?)```/g, (_m, inner) => {
    const nl = inner.indexOf('\n');
    const code = nl >= 0 ? inner.slice(nl + 1) : inner;
    return `</p><pre><code>${code}</code></pre><p>`;
  });
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/^### (.+)$/gm, '</p><h3>$1</h3><p>');
  html = html.replace(/^## (.+)$/gm, '</p><h2>$1</h2><p>');
  html = html.replace(/^# (.+)$/gm, '</p><h1>$1</h1><p>');
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  html = `<p>${html}</p>`;
  html = html.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>');
  html = html.replace(/<p>\s*<\/p>/g, '').replace(/<p><br><\/p>/g, '');
  return html;
}

function matchesSearch(skill, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  return [skill.name, skill.trigger, skill.description, skill.body, skill.filename]
    .join(' ').toLowerCase().includes(q);
}

// ── Count helpers ─────────────────────────────────────────────────────────

function updateCounts() {
  const total = _allSkills.length;
  const enabled = _allSkills.filter(s => s.enabled).length;

  if (countEl) countEl.textContent = `${total} skill${total !== 1 ? 's' : ''}`;

  if (enabledCountEl) {
    enabledCountEl.textContent = enabled === 0 ? 'None active' : `${enabled} active`;
    enabledCountEl.classList.toggle('skills-enabled-count--active', enabled > 0);
  }

  if (enableAllBtn) enableAllBtn.disabled = enabled === total;
  if (disableAllBtn) disableAllBtn.disabled = enabled === 0;
}

// ── Toggle a skill ────────────────────────────────────────────────────────

async function handleToggle(filename, newEnabled) {
  const skill = _allSkills.find(s => s.filename === filename);
  if (skill) skill.enabled = newEnabled;
  updateCounts();

  const res = await window.electronAPI?.toggleSkill?.(filename, newEnabled);
  if (!res?.ok) {
    if (skill) skill.enabled = !newEnabled;
    updateCounts();
    console.error('[Skills] Toggle failed:', res?.error);
  }
}

// ── Build skill card ──────────────────────────────────────────────────────

function buildSkillCard(skill) {
  const card = document.createElement('div');
  card.className = `skill-card${skill.enabled ? ' skill-card--enabled' : ''}`;
  card.dataset.filename = skill.filename;

  card.innerHTML = `
    <div class="skill-card-head">
      <div class="skill-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="skill-card-title-group">
        <div class="skill-name">${escapeHtml(skill.name)}</div>
        <span class="skill-badge">Skill</span>
      </div>
      <label class="skill-toggle" title="${skill.enabled ? 'Disable this skill' : 'Enable this skill'}">
        <input type="checkbox" class="skill-toggle-input" ${skill.enabled ? 'checked' : ''} />
        <span class="skill-toggle-track"></span>
      </label>
    </div>
    ${skill.trigger ? `
      <div class="skill-trigger">
        <span class="skill-trigger-label">When</span>
        <span>${escapeHtml(skill.trigger)}</span>
      </div>` : ''}
    ${skill.description ? `
      <div class="skill-description">${escapeHtml(skill.description)}</div>` : ''}
    <div class="skill-card-footer">
      <button class="skill-read-btn" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Read
      </button>
    </div>`;

  const toggleInput = card.querySelector('.skill-toggle-input');
  const toggleLabel = card.querySelector('.skill-toggle');

  toggleLabel.addEventListener('click', e => e.stopPropagation());
  toggleInput.addEventListener('change', async e => {
    const newEnabled = e.target.checked;
    toggleLabel.title = newEnabled ? 'Disable this skill' : 'Enable this skill';
    card.classList.toggle('skill-card--enabled', newEnabled);
    await handleToggle(skill.filename, newEnabled);
  });

  card.addEventListener('click', e => {
    if (e.target.closest('.skill-toggle')) return;
    openModal(skill);
  });
  card.querySelector('.skill-read-btn').addEventListener('click', e => {
    e.stopPropagation();
    openModal(skill);
  });

  return card;
}

// ── Render grid ───────────────────────────────────────────────────────────

function render(query = '') {
  const filtered = _allSkills.filter(s => matchesSearch(s, query));
  updateCounts();

  if (_allSkills.length === 0) {
    skillsEmpty.hidden = false;
    skillsGrid.hidden = true;
    searchWrapper.hidden = true;
    return;
  }

  skillsEmpty.hidden = true;
  searchWrapper.hidden = false;
  skillsGrid.hidden = false;
  skillsGrid.innerHTML = '';

  if (filtered.length === 0) {
    const nope = document.createElement('div');
    nope.className = 'skills-no-results';
    nope.textContent = `No skills match "${query}"`;
    skillsGrid.appendChild(nope);
    return;
  }

  filtered.forEach(skill => skillsGrid.appendChild(buildSkillCard(skill)));
}

// ── Modal ──────────────────────────────────────────────────────────────────

function openModal(skill) {
  modalName.textContent = skill.name;
  modalContent.innerHTML = renderMarkdown(skill.raw);
  modalBackdrop.classList.add('open');
  document.body.classList.add('modal-open');
}

function closeModal() {
  modalBackdrop.classList.remove('open');
  document.body.classList.remove('modal-open');
}

modalCloseBtn?.addEventListener('click', closeModal);
modalBackdrop?.addEventListener('click', e => { if (e.target === modalBackdrop) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ── Search ────────────────────────────────────────────────────────────────

const clearBtn = document.getElementById('skills-search-clear');

searchInput?.addEventListener('input', () => {
  render(searchInput.value.trim());
  if (clearBtn) clearBtn.classList.toggle('visible', searchInput.value.length > 0);
});

clearBtn?.addEventListener('click', () => {
  if (searchInput) searchInput.value = '';
  clearBtn.classList.remove('visible');
  render('');
  searchInput?.focus();
});

// ── Bulk actions — with confirmation ─────────────────────────────────────

enableAllBtn?.addEventListener('click', async () => {
  const confirmed = await openConfirm({ type: 'enable' });
  if (!confirmed) return;

  enableAllBtn.disabled = true;
  const res = await window.electronAPI?.enableAllSkills?.();
  if (res?.ok !== false) {
    _allSkills.forEach(s => { s.enabled = true; });
    render(searchInput?.value?.trim() ?? '');
  }
});

disableAllBtn?.addEventListener('click', async () => {
  const confirmed = await openConfirm({ type: 'disable' });
  if (!confirmed) return;

  disableAllBtn.disabled = true;
  const res = await window.electronAPI?.disableAllSkills?.();
  if (res?.ok !== false) {
    _allSkills.forEach(s => { s.enabled = false; });
    render(searchInput?.value?.trim() ?? '');
  }
});

// ── Boot ──────────────────────────────────────────────────────────────────

async function load() {
  try {
    const res = await window.electronAPI?.getSkills?.();
    _allSkills = res?.skills ?? [];
  } catch (err) {
    console.error('[Skills] Load error:', err);
    _allSkills = [];
  }
  render();
}

load();