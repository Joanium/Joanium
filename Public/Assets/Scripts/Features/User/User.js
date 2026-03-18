// ─────────────────────────────────────────────
//  openworld — Public/Assets/Scripts/Features/User/User.js
//  Avatar panel, settings modal (user / providers / memory / connectors),
//  and profile persistence.
// ─────────────────────────────────────────────

import { state }                        from '../../Shared/State.js';
import { getInitials }                  from '../../Shared/Utils.js';
import { loadConnectorsPanel }          from '../Connectors/Connectors.js';
import {
  avatarBtn, avatarPanel, avatarPanelBadge, avatarPanelName,
  avatarSettingsBtn, themePanel, libraryBackdrop,
  settingsModalBackdrop, settingsModalClose,
  syncModalOpenState,
}                                       from '../../Shared/DOM.js';
import {
  loadProviders,
  updateModelLabel,
  buildModelDropdown,
}                                       from '../ModelSelector/ModelSelector.js';

/* ══════════════════════════════════════════
   PROVIDER META  (colors / icons for Settings)
══════════════════════════════════════════ */
const PROVIDER_META = {
  anthropic:  { color: '#cc785c', placeholder: 'sk-ant-api03-…', iconPath: 'Assets/Icons/Claude.png',     fallback: 'C'   },
  openai:     { color: '#10a37f', placeholder: 'sk-proj-…',      iconPath: 'Assets/Icons/ChatGPT.png',    fallback: 'GPT' },
  google:     { color: '#4285f4', placeholder: 'AIza…',          iconPath: 'Assets/Icons/Gemini.png',     fallback: 'G'   },
  openrouter: { color: '#9b59b6', placeholder: 'sk-or-v1-…',     iconPath: 'Assets/Icons/OpenRouter.png', fallback: 'OR'  },
};

/* ══════════════════════════════════════════
   MODULE STATE
══════════════════════════════════════════ */
const settingsState = {
  activeTab:           'user',
  providerCatalog:     [],
  pendingProviderKeys: {},
};

/* ══════════════════════════════════════════
   DOM REFS  (settings modal internals)
══════════════════════════════════════════ */
const settingsTabs         = Array.from(document.querySelectorAll('[data-settings-tab]'));
const settingsPanels       = Array.from(document.querySelectorAll('[data-settings-panel]'));
const nameInput            = document.getElementById('settings-user-name');
const memoryInput          = document.getElementById('settings-memory');
const customInstructionsInput = document.getElementById('settings-custom-instructions');
const providersList        = document.getElementById('settings-providers-list');
const saveBtn              = document.getElementById('settings-save');
const saveFeedback         = document.getElementById('settings-save-feedback');

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */
function escapeHtml(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function setFeedback(msg = '', tone = 'info') {
  if (!saveFeedback) return;
  saveFeedback.textContent = msg;
  saveFeedback.className   = msg ? `settings-feedback ${tone}` : 'settings-feedback';
}

function updateSaveBtn() {
  if (!saveBtn) return;
  const tab = settingsState.activeTab;
  if (tab === 'user')      { saveBtn.textContent = 'Save changes';          saveBtn.disabled = false; return; }
  if (tab === 'providers') { saveBtn.textContent = 'Save provider changes'; saveBtn.disabled = false; return; }
  saveBtn.textContent = 'No changes to save';
  saveBtn.disabled    = true;
}

/* ══════════════════════════════════════════
   APPLY USER PROFILE TO DOM
══════════════════════════════════════════ */
function applyUserProfile(user = {}) {
  const rawName     = String(user?.name ?? '').trim();
  const displayName = rawName || 'User';
  const initials    = getInitials(displayName);
  const firstName   = displayName.split(/\s+/)[0];

  state.userName     = rawName;
  state.userInitials = initials;

  if (avatarBtn) { avatarBtn.textContent = initials; avatarBtn.title = displayName; avatarBtn.setAttribute('data-tip', displayName); }
  if (avatarPanelBadge) avatarPanelBadge.textContent = initials;
  if (avatarPanelName)  avatarPanelName.textContent  = displayName;

  const welcomeTitle = document.querySelector('.welcome-title');
  if (welcomeTitle) welcomeTitle.textContent = rawName ? `Welcome, ${firstName}` : 'Welcome';
}

/* ══════════════════════════════════════════
   LOAD USER  (called on startup)
══════════════════════════════════════════ */
export async function loadUser() {
  try {
    const user = await window.electronAPI?.getUser?.();
    applyUserProfile(user ?? {});
  } catch (err) {
    console.warn('[User] Could not load user:', err);
    applyUserProfile({});
  }
}

/* ══════════════════════════════════════════
   SETTINGS TABS
══════════════════════════════════════════ */
function switchTab(tabId) {
  settingsState.activeTab = tabId;
  settingsTabs.forEach(btn => {
    const active = btn.dataset.settingsTab === tabId;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  settingsPanels.forEach(panel => {
    const active = panel.dataset.settingsPanel === tabId;
    panel.classList.toggle('active', active);
    panel.hidden = !active;
  });
  setFeedback();
  updateSaveBtn();
  if (tabId === 'connectors') loadConnectorsPanel();
}

function focusActiveTab() {
  if (settingsState.activeTab === 'providers') { providersList?.querySelector('input')?.focus(); return; }
  if (settingsState.activeTab === 'user')      nameInput?.focus();
}

/* ══════════════════════════════════════════
   PROVIDERS PANEL
══════════════════════════════════════════ */
function renderProviders() {
  if (!providersList) return;
  if (!settingsState.providerCatalog.length) {
    providersList.innerHTML = '<div class="settings-empty-card">No providers available</div>';
    updateSaveBtn(); return;
  }

  const sorted = [...settingsState.providerCatalog].sort((a, b) => {
    const ac = String(a.api ?? '').trim().length > 0;
    const bc = String(b.api ?? '').trim().length > 0;
    return Number(bc) - Number(ac);
  });

  providersList.innerHTML = sorted.map(p => {
    const meta    = PROVIDER_META[p.provider] ?? {};
    const inputId = `settings-key-${p.provider}`;
    const pending = settingsState.pendingProviderKeys[p.provider] ?? '';
    return `
      <article class="settings-provider-row" style="--p-color:${meta.color ?? 'var(--accent)'}">
        <div class="spr-icon">
          <img class="spr-icon-img" src="${escapeHtml(meta.iconPath ?? '')}" alt="" draggable="false"/>
        </div>
        <div class="key-input-wrap spr-key-wrap">
          <input class="key-input spr-key-input" id="${escapeHtml(inputId)}"
            type="password" data-provider-input="${escapeHtml(p.provider)}"
            placeholder="${escapeHtml(meta.placeholder ?? 'Paste API key')}"
            value="${escapeHtml(pending)}" autocomplete="off" spellcheck="false"/>
          <button type="button" class="key-eye" data-target="${escapeHtml(inputId)}" title="Show / hide">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke-width="1.8"/>
              <circle cx="12" cy="12" r="3" stroke-width="1.8"/>
            </svg>
          </button>
        </div>
      </article>`;
  }).join('');

  providersList.querySelectorAll('.spr-icon-img').forEach(img => {
    if (img.complete && img.naturalWidth === 0) img.closest('.spr-icon')?.classList.add('icon-missing');
    img.addEventListener('error', () => img.closest('.spr-icon')?.classList.add('icon-missing'));
    img.addEventListener('load',  () => img.closest('.spr-icon')?.classList.remove('icon-missing'));
  });

  providersList.querySelectorAll('[data-provider-input]').forEach(input => {
    input.addEventListener('input', () => {
      settingsState.pendingProviderKeys[input.dataset.providerInput] = input.value;
      updateSaveBtn();
    });
  });

  providersList.querySelectorAll('.key-eye').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if (input) input.type = input.type === 'password' ? 'text' : 'password';
    });
  });

  updateSaveBtn();
}

/* ══════════════════════════════════════════
   HYDRATE MODAL
══════════════════════════════════════════ */
async function hydrateModal() {
  setFeedback();
  const [user, customInstructions, memory, providers] = await Promise.all([
    window.electronAPI?.getUser?.(),
    window.electronAPI?.getCustomInstructions?.(),
    window.electronAPI?.getMemory?.(),
    window.electronAPI?.getModels?.(),
  ]);

  applyUserProfile(user ?? {});
  settingsState.providerCatalog    = Array.isArray(providers) ? providers : [];
  settingsState.pendingProviderKeys = {};

  if (nameInput)              nameInput.value              = user?.name ?? '';
  if (memoryInput)            memoryInput.value            = memory ?? '';
  if (customInstructionsInput) customInstructionsInput.value = customInstructions ?? '';

  renderProviders();
  updateSaveBtn();
}

/* ══════════════════════════════════════════
   SAVE — user tab
══════════════════════════════════════════ */
async function saveUserTab() {
  const nextName         = nameInput?.value.trim() ?? '';
  const nextMemory       = memoryInput?.value ?? '';
  const nextInstructions = customInstructionsInput?.value ?? '';

  if (nextName.length < 2) {
    setFeedback('Enter a name with at least 2 characters.', 'error');
    nameInput?.focus(); return;
  }

  saveBtn.disabled = true;
  setFeedback('Saving…', 'info');

  try {
    const [profileRes, instrRes, memRes] = await Promise.all([
      window.electronAPI?.saveUserProfile?.({ name: nextName }),
      window.electronAPI?.saveCustomInstructions?.(nextInstructions),
      window.electronAPI?.saveMemory?.(nextMemory),
    ]);
    if (!profileRes?.ok) throw new Error(profileRes?.error ?? 'Could not save profile.');
    if (!instrRes?.ok)   throw new Error(instrRes?.error   ?? 'Could not save custom instructions.');
    if (!memRes?.ok)     throw new Error(memRes?.error     ?? 'Could not save memory.');

    applyUserProfile(profileRes.user ?? { name: nextName });
    setFeedback('Changes saved.', 'success');
    window.dispatchEvent(new CustomEvent('ow:settings-saved'));
  } catch (err) {
    console.error('[User] Could not save user settings:', err);
    setFeedback(err.message || 'Could not save.', 'error');
  } finally { updateSaveBtn(); }
}

/* ══════════════════════════════════════════
   SAVE — providers tab
══════════════════════════════════════════ */
async function saveProvidersTab() {
  const changes = Object.fromEntries(
    Object.entries(settingsState.pendingProviderKeys)
      .map(([id, key]) => [id, String(key ?? '').trim()])
      .filter(([, key]) => key.length > 0),
  );

  if (!Object.keys(changes).length) {
    setFeedback('Add at least one API key before saving.', 'error'); return;
  }

  saveBtn.disabled = true;
  setFeedback('Saving provider keys…', 'info');

  try {
    const result = await window.electronAPI?.saveAPIKeys?.(changes);
    if (!result?.ok) throw new Error(result?.error ?? 'Could not save keys.');

    await loadProviders();
    settingsState.providerCatalog    = state.allProviders;
    settingsState.pendingProviderKeys = {};
    renderProviders();

    const count = Object.keys(changes).length;
    setFeedback(count === 1 ? 'Provider key saved.' : `${count} provider keys saved.`, 'success');
    window.dispatchEvent(new CustomEvent('ow:settings-saved'));
  } catch (err) {
    console.error('[User] Could not save provider keys:', err);
    setFeedback(err.message || 'Could not save.', 'error');
  } finally { updateSaveBtn(); }
}

/* ══════════════════════════════════════════
   AVATAR PANEL
══════════════════════════════════════════ */
export function closeAvatarPanel() { avatarPanel?.classList.remove('open'); }

/* ══════════════════════════════════════════
   SETTINGS MODAL
══════════════════════════════════════════ */
export async function openSettingsModal(tabId = settingsState.activeTab) {
  closeAvatarPanel();
  themePanel?.classList.remove('open');
  libraryBackdrop?.classList.remove('open');
  document.querySelector('[data-view="library"]')?.classList.remove('active');
  switchTab(tabId);
  settingsModalBackdrop?.classList.add('open');
  syncModalOpenState();

  try { await hydrateModal(); }
  catch (err) { console.error('[User] Could not load settings:', err); setFeedback('Could not load settings.', 'error'); }

  requestAnimationFrame(() => focusActiveTab());
}

export function closeSettingsModal() {
  settingsModalBackdrop?.classList.remove('open');
  syncModalOpenState();
}

/* ══════════════════════════════════════════
   INIT (bind all UI events)
══════════════════════════════════════════ */
export function init() {
  // Tabs
  settingsTabs.forEach(btn => {
    btn.addEventListener('click', () => { switchTab(btn.dataset.settingsTab); focusActiveTab(); });
  });

  // Avatar panel toggle
  avatarBtn?.addEventListener('click', e => {
    e.stopPropagation();
    avatarPanel?.classList.toggle('open');
    themePanel?.classList.remove('open');
  });

  // Open settings from avatar panel
  avatarSettingsBtn?.addEventListener('click', e => {
    e.stopPropagation();
    void openSettingsModal();
  });

  // Save button
  saveBtn?.addEventListener('click', () => {
    if (settingsState.activeTab === 'user')      void saveUserTab();
    if (settingsState.activeTab === 'providers') void saveProvidersTab();
  });

  // Close settings modal
  settingsModalClose?.addEventListener('click', closeSettingsModal);
  settingsModalBackdrop?.addEventListener('click', e => {
    if (e.target === settingsModalBackdrop) closeSettingsModal();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    const isSave = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's';
    if (isSave && settingsModalBackdrop?.classList.contains('open')) {
      e.preventDefault();
      if (settingsState.activeTab === 'user')      void saveUserTab();
      if (settingsState.activeTab === 'providers') void saveProvidersTab();
      return;
    }
    if (e.key === 'Escape') closeSettingsModal();
  });

  // Close avatar panel on outside click
  document.addEventListener('click', e => {
    if (!avatarPanel?.contains(e.target) && e.target !== avatarBtn) closeAvatarPanel();
  });
}
