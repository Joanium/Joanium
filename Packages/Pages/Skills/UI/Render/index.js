import { getHTML } from './Templates/SkillsTemplate.js';
import { openConfirm, closeConfirm } from './Components/SkillsConfirm.js';

/* ── DOM refs (module-level, reset on each mount/unmount) ── */
let skillsGrid     = null;
let skillsEmpty    = null;
let searchWrapper  = null;
let searchInput    = null;
let searchClearBtn = null;
let countEl        = null;
let enabledCountEl = null;
let enableAllBtn   = null;
let disableAllBtn  = null;
let modalBackdrop  = null;
let modalName      = null;
let modalContent   = null;
let modalCloseBtn  = null;

let _allSkills = [];

/* ── Helpers ── */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderMarkdown(raw) {
  let text = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim();
  let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  html = html.replace(/```([\s\S]*?)```/g, (_match, inner) => {
    const newlineIndex = inner.indexOf('\n');
    const code = newlineIndex >= 0 ? inner.slice(newlineIndex + 1) : inner;
    return `</p><pre><code>${code}</code></pre><p>`;
  });
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/^### (.+)$/gm, '</p><h3>$1</h3><p>');
  html = html.replace(/^## (.+)$/gm,  '</p><h2>$1</h2><p>');
  html = html.replace(/^# (.+)$/gm,   '</p><h1>$1</h1><p>');
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  html = `<p>${html}</p>`;
  html = html.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>');
  html = html.replace(/<p>\s*<\/p>/g, '').replace(/<p><br><\/p>/g, '');
  return html;
}

function matchesSearch(skill, query) {
  if (!query) return true;
  const lowerQuery = query.toLowerCase();
  return [skill.name, skill.trigger, skill.description, skill.body, skill.filename]
    .join(' ').toLowerCase().includes(lowerQuery);
}

function updateCounts() {
  const total   = _allSkills.length;
  const enabled = _allSkills.filter(s => s.enabled).length;
  if (countEl)        countEl.textContent = `${total} skill${total !== 1 ? 's' : ''}`;
  if (enabledCountEl) {
    enabledCountEl.textContent = enabled === 0 ? 'None active' : `${enabled} active`;
    enabledCountEl.classList.toggle('skills-enabled-count--active', enabled > 0);
  }
  if (enableAllBtn)  enableAllBtn.disabled  = enabled === total;
  if (disableAllBtn) disableAllBtn.disabled = enabled === 0;
}

async function handleToggle(filename, newEnabled) {
  const skill = _allSkills.find(s => s.filename === filename);
  if (skill) skill.enabled = newEnabled;
  updateCounts();
  const result = await window.electronAPI?.toggleSkill?.(filename, newEnabled);
  if (!result?.ok) {
    if (skill) skill.enabled = !newEnabled;
    render(searchInput?.value?.trim() ?? '');
    console.error('[Skills] Toggle failed:', result?.error);
  }
}

function openModal(skill) {
  if (!modalName || !modalContent || !modalBackdrop) return;
  modalName.textContent = skill.name;
  modalContent.innerHTML = renderMarkdown(skill.raw);
  modalBackdrop.classList.add('open');
  document.body.classList.add('modal-open');
}

function closeModal() {
  modalBackdrop?.classList.remove('open');
  document.body.classList.remove('modal-open');
}

function buildSkillCard(skill) {
  const card = document.createElement('div');
  card.className = `skill-card${skill.enabled ? ' skill-card--enabled' : ''}`;
  card.dataset.filename = skill.filename;

  card.innerHTML = `
    <div class="skill-card-head">
      <div class="skill-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke-linecap="round" stroke-linejoin="round"/>
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
    ${skill.description ? `<div class="skill-description">${escapeHtml(skill.description)}</div>` : ''}
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

  toggleLabel?.addEventListener('click', e => e.stopPropagation());
  toggleInput?.addEventListener('change', async e => {
    const newEnabled = e.target.checked;
    if (toggleLabel) toggleLabel.title = newEnabled ? 'Disable this skill' : 'Enable this skill';
    card.classList.toggle('skill-card--enabled', newEnabled);
    await handleToggle(skill.filename, newEnabled);
  });

  card.addEventListener('click', e => {
    if (e.target.closest('.skill-toggle')) return;
    openModal(skill);
  });

  card.querySelector('.skill-read-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    openModal(skill);
  });

  return card;
}

function render(query = '') {
  const filtered = _allSkills.filter(s => matchesSearch(s, query));
  updateCounts();

  if (_allSkills.length === 0) {
    skillsEmpty.hidden = false;
    skillsGrid.hidden  = true;
    searchWrapper.hidden = true;
    return;
  }

  skillsEmpty.hidden   = true;
  searchWrapper.hidden = false;
  skillsGrid.hidden    = false;
  skillsGrid.innerHTML = '';

  if (filtered.length === 0) {
    const noResults = document.createElement('div');
    noResults.className   = 'skills-no-results';
    noResults.textContent = `No skills match "${query}"`;
    skillsGrid.appendChild(noResults);
    return;
  }

  filtered.forEach(skill => skillsGrid.appendChild(buildSkillCard(skill)));
}

async function load() {
  try {
    const result = await window.electronAPI?.getSkills?.();
    _allSkills = result?.skills ?? [];
  } catch (err) {
    console.error('[Skills] Load error:', err);
    _allSkills = [];
  }
  render(searchInput?.value?.trim() ?? '');
}

/* ══════════════════════════════════════════
   MOUNT
══════════════════════════════════════════ */
export function mount(outlet) {
  outlet.innerHTML = getHTML();

  skillsGrid     = document.getElementById('skills-grid');
  skillsEmpty    = document.getElementById('skills-empty');
  searchWrapper  = document.getElementById('skills-search-wrapper');
  searchInput    = document.getElementById('skills-search');
  searchClearBtn = document.getElementById('skills-search-clear');
  countEl        = document.getElementById('skills-count');
  enabledCountEl = document.getElementById('skills-enabled-count');
  enableAllBtn   = document.getElementById('skills-enable-all');
  disableAllBtn  = document.getElementById('skills-disable-all');
  modalBackdrop  = document.getElementById('skill-modal-backdrop');
  modalName      = document.getElementById('skill-modal-name');
  modalContent   = document.getElementById('skill-modal-content');
  modalCloseBtn  = document.getElementById('skill-modal-close');

  _allSkills = [];
  closeConfirm();

  const onModalClose         = () => closeModal();
  const onModalBackdropClick = e => { if (e.target === modalBackdrop) closeModal(); };
  const onKeydown            = e => {
    if (e.key === 'Escape') { closeModal(); closeConfirm(); }
  };
  const onSearchInput = () => {
    const query = searchInput?.value.trim() ?? '';
    render(query);
    searchClearBtn?.classList.toggle('visible', (searchInput?.value.length ?? 0) > 0);
  };
  const onSearchClear = () => {
    if (searchInput) searchInput.value = '';
    searchClearBtn?.classList.remove('visible');
    render('');
    searchInput?.focus();
  };
  const onEnableAll = async () => {
    const confirmed = await openConfirm({
      type: 'enable',
      totalCount: _allSkills.length,
      enabledCount: _allSkills.filter(s => s.enabled).length,
    });
    if (!confirmed || !enableAllBtn) return;
    enableAllBtn.disabled = true;
    const result = await window.electronAPI?.enableAllSkills?.();
    if (result?.ok !== false) {
      _allSkills.forEach(s => { s.enabled = true; });
      render(searchInput?.value?.trim() ?? '');
    }
  };
  const onDisableAll = async () => {
    const confirmed = await openConfirm({
      type: 'disable',
      totalCount: _allSkills.length,
      enabledCount: _allSkills.filter(s => s.enabled).length,
    });
    if (!confirmed || !disableAllBtn) return;
    disableAllBtn.disabled = true;
    const result = await window.electronAPI?.disableAllSkills?.();
    if (result?.ok !== false) {
      _allSkills.forEach(s => { s.enabled = false; });
      render(searchInput?.value?.trim() ?? '');
    }
  };

  modalCloseBtn?.addEventListener('click', onModalClose);
  modalBackdrop?.addEventListener('click', onModalBackdropClick);
  searchInput?.addEventListener('input', onSearchInput);
  searchClearBtn?.addEventListener('click', onSearchClear);
  enableAllBtn?.addEventListener('click', onEnableAll);
  disableAllBtn?.addEventListener('click', onDisableAll);
  document.addEventListener('keydown', onKeydown);

  load();

  return function cleanup() {
    closeModal();
    closeConfirm();
    modalCloseBtn?.removeEventListener('click', onModalClose);
    modalBackdrop?.removeEventListener('click', onModalBackdropClick);
    searchInput?.removeEventListener('input', onSearchInput);
    searchClearBtn?.removeEventListener('click', onSearchClear);
    enableAllBtn?.removeEventListener('click', onEnableAll);
    disableAllBtn?.removeEventListener('click', onDisableAll);
    document.removeEventListener('keydown', onKeydown);

    skillsGrid = skillsEmpty = searchWrapper = searchInput = null;
    searchClearBtn = countEl = enabledCountEl = enableAllBtn = null;
    disableAllBtn = modalBackdrop = modalName = modalContent = modalCloseBtn = null;
  };
}
