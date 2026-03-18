import {
  state,
  avatarBtn,
  avatarPanel,
  avatarPanelBadge,
  avatarPanelName,
  avatarSettingsBtn,
  themePanel,
  libraryBackdrop,
  syncModalOpenState,
  settingsModalBackdrop,
  settingsModalClose,
} from './Root.js';
import { loadProviders } from './ModelSelector.js';
import { initConnectors, loadConnectorsPanel } from './Connectors.js';

const settingsTabs                  = Array.from(document.querySelectorAll('[data-settings-tab]'));
const settingsPanels                = Array.from(document.querySelectorAll('[data-settings-panel]'));
const settingsUserNameInput         = document.getElementById('settings-user-name');
const settingsMemoryInput           = document.getElementById('settings-memory');
const settingsCustomInstructionsInput = document.getElementById('settings-custom-instructions');
const settingsProvidersList         = document.getElementById('settings-providers-list');
const settingsSaveBtn               = document.getElementById('settings-save');
const settingsSaveFeedback          = document.getElementById('settings-save-feedback');

const PROVIDER_META = {
  anthropic: { color: '#cc785c', placeholder: 'sk-ant-api03-…', iconPath: 'Assets/Icons/Claude.png',     fallback: 'C'   },
  openai:    { color: '#10a37f', placeholder: 'sk-proj-…',      iconPath: 'Assets/Icons/ChatGPT.png',    fallback: 'GPT' },
  google:    { color: '#4285f4', placeholder: 'AIza…',          iconPath: 'Assets/Icons/Gemini.png',     fallback: 'G'   },
  openrouter:{ color: '#9b59b6', placeholder: 'sk-or-v1-…',     iconPath: 'Assets/Icons/OpenRouter.png', fallback: 'OR'  },
};

const settingsState = {
  activeTab:          'user',
  providerCatalog:    [],
  pendingProviderKeys: {},
};

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getDisplayName(name) {
  return String(name ?? '').trim() || 'User';
}

function getInitials(name) {
  const d = getDisplayName(name);
  const p = d.split(/\s+/).filter(Boolean);
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : d.slice(0, 2).toUpperCase();
}

function setFeedback(element, message = '', tone = 'info') {
  if (!element) return;
  element.textContent = message;
  element.className   = message ? `settings-feedback ${tone}` : 'settings-feedback';
}

function applyUserProfile(user = {}) {
  const rawName    = String(user?.name ?? '').trim();
  const displayName = getDisplayName(rawName);
  const initials   = getInitials(displayName);
  const firstName  = displayName.split(/\s+/)[0];

  state.userName     = rawName;
  state.userInitials = initials;

  if (avatarBtn)       { avatarBtn.textContent = initials; avatarBtn.title = displayName; avatarBtn.setAttribute('data-tip', displayName); }
  if (avatarPanelBadge) avatarPanelBadge.textContent = initials;
  if (avatarPanelName)  avatarPanelName.textContent  = displayName;

  const welcomeTitle = document.querySelector('.welcome-title');
  if (welcomeTitle) welcomeTitle.textContent = rawName ? `Welcome, ${firstName}` : 'Welcome';
}

function switchSettingsTab(tabId) {
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

  setFeedback(settingsSaveFeedback);
  updateSaveButtonState();

  // Lazy-load connectors panel on first open
  if (tabId === 'connectors') loadConnectorsPanel();
}

function focusActiveSettingsTab() {
  if (settingsState.activeTab === 'providers') { settingsProvidersList?.querySelector('input')?.focus(); return; }
  if (settingsState.activeTab === 'user')      settingsUserNameInput?.focus();
}

function updateSaveButtonState() {
  if (!settingsSaveBtn) return;
  if (settingsState.activeTab === 'user')      { settingsSaveBtn.textContent = 'Save changes';          settingsSaveBtn.disabled = false; return; }
  if (settingsState.activeTab === 'providers') { settingsSaveBtn.textContent = 'Save provider changes'; settingsSaveBtn.disabled = false; return; }
  settingsSaveBtn.textContent = 'No changes to save';
  settingsSaveBtn.disabled    = true;
}

function getProviderPlaceholder(id) { return PROVIDER_META[id]?.placeholder ?? 'Paste API key'; }

function renderSettingsProviders() {
  if (!settingsProvidersList) return;
  if (!settingsState.providerCatalog.length) {
    settingsProvidersList.innerHTML = '<div class="settings-empty-card">No providers available</div>';
    updateSaveButtonState(); return;
  }

  const sorted = [...settingsState.providerCatalog].sort((a, b) => {
    const ac = String(a.api ?? '').trim().length > 0;
    const bc = String(b.api ?? '').trim().length > 0;
    return Number(bc) - Number(ac);
  });

  settingsProvidersList.innerHTML = sorted.map(provider => {
    const meta       = PROVIDER_META[provider.provider] ?? {};
    const currentKey = String(provider.api ?? '').trim();
    const nextKey    = settingsState.pendingProviderKeys[provider.provider] ?? '';
    const inputId    = `settings-key-${provider.provider}`;
    return `
      <article class="settings-provider-row" style="--p-color:${meta.color ?? 'var(--accent)'}">
        <div class="spr-icon">
          <img class="spr-icon-img" src="${escapeHtml(meta.iconPath ?? '')}" alt="" draggable="false"/>
        </div>
        <div class="key-input-wrap spr-key-wrap">
          <input class="key-input spr-key-input" id="${escapeHtml(inputId)}" type="password"
            data-provider-input="${escapeHtml(provider.provider)}"
            placeholder="${escapeHtml(getProviderPlaceholder(provider.provider))}"
            value="${escapeHtml(nextKey)}" autocomplete="off" spellcheck="false"/>
          <button type="button" class="key-eye" data-target="${escapeHtml(inputId)}" title="Show / hide">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke-width="1.8"/>
              <circle cx="12" cy="12" r="3" stroke-width="1.8"/>
            </svg>
          </button>
        </div>
      </article>`;
  }).join('');

  settingsProvidersList.querySelectorAll('.spr-icon-img').forEach(img => {
    if (img.complete && img.naturalWidth === 0) img.closest('.spr-icon')?.classList.add('icon-missing');
    img.addEventListener('error', () => img.closest('.spr-icon')?.classList.add('icon-missing'));
    img.addEventListener('load',  () => img.closest('.spr-icon')?.classList.remove('icon-missing'));
  });

  settingsProvidersList.querySelectorAll('[data-provider-input]').forEach(input => {
    input.addEventListener('input', () => {
      settingsState.pendingProviderKeys[input.dataset.providerInput] = input.value;
      updateSaveButtonState();
    });
  });

  settingsProvidersList.querySelectorAll('.key-eye').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if (input) input.type = input.type === 'password' ? 'text' : 'password';
    });
  });

  updateSaveButtonState();
}

async function hydrateSettingsModal() {
  setFeedback(settingsSaveFeedback);
  const [user, customInstructions, memory, providers] = await Promise.all([
    window.electronAPI?.getUser?.(),
    window.electronAPI?.getCustomInstructions?.(),
    window.electronAPI?.getMemory?.(),
    window.electronAPI?.getModels?.(),
  ]);
  applyUserProfile(user ?? {});
  settingsState.providerCatalog    = Array.isArray(providers) ? providers : [];
  settingsState.pendingProviderKeys = {};
  if (settingsUserNameInput)           settingsUserNameInput.value           = user?.name ?? '';
  if (settingsMemoryInput)             settingsMemoryInput.value             = memory ?? '';
  if (settingsCustomInstructionsInput) settingsCustomInstructionsInput.value = customInstructions ?? '';
  renderSettingsProviders();
  updateSaveButtonState();
}

async function saveUserSettings() {
  const nextName         = settingsUserNameInput?.value.trim() ?? '';
  const nextMemory       = settingsMemoryInput?.value ?? '';
  const nextInstructions = settingsCustomInstructionsInput?.value ?? '';
  if (nextName.length < 2) { setFeedback(settingsSaveFeedback, 'Enter a name with at least 2 characters.', 'error'); settingsUserNameInput?.focus(); return; }
  settingsSaveBtn.disabled = true;
  setFeedback(settingsSaveFeedback, 'Saving…', 'info');
  try {
    const [profileResult, instructionsResult, memoryResult] = await Promise.all([
      window.electronAPI?.saveUserProfile?.({ name: nextName }),
      window.electronAPI?.saveCustomInstructions?.(nextInstructions),
      window.electronAPI?.saveMemory?.(nextMemory),
    ]);
    if (!profileResult?.ok)      throw new Error(profileResult?.error      ?? 'Could not save profile.');
    if (!instructionsResult?.ok) throw new Error(instructionsResult?.error ?? 'Could not save custom instructions.');
    if (!memoryResult?.ok)       throw new Error(memoryResult?.error       ?? 'Could not save memory.');
    applyUserProfile(profileResult.user ?? { name: nextName });
    setFeedback(settingsSaveFeedback, 'Changes saved.', 'success');
  } catch (err) {
    console.error('[openworld] Could not save user settings:', err);
    setFeedback(settingsSaveFeedback, err.message || 'Could not save.', 'error');
  } finally { updateSaveButtonState(); }
}

async function saveProviderSettings() {
  const changes = Object.fromEntries(
    Object.entries(settingsState.pendingProviderKeys)
      .map(([id, key]) => [id, String(key ?? '').trim()])
      .filter(([, key]) => key.length > 0),
  );
  if (!Object.keys(changes).length) { setFeedback(settingsSaveFeedback, 'Add at least one API key before saving.', 'error'); return; }
  settingsSaveBtn.disabled = true;
  setFeedback(settingsSaveFeedback, 'Saving provider keys…', 'info');
  try {
    const result = await window.electronAPI?.saveAPIKeys?.(changes);
    if (!result?.ok) throw new Error(result?.error ?? 'Could not save keys.');
    await loadProviders();
    settingsState.providerCatalog    = state.allProviders;
    settingsState.pendingProviderKeys = {};
    renderSettingsProviders();
    const count = Object.keys(changes).length;
    setFeedback(settingsSaveFeedback, count === 1 ? 'Provider key saved.' : `${count} provider keys saved.`, 'success');
  } catch (err) {
    console.error('[openworld] Could not save provider keys:', err);
    setFeedback(settingsSaveFeedback, err.message || 'Could not save.', 'error');
  } finally { updateSaveButtonState(); }
}

function saveActiveSettingsTab() {
  if (settingsState.activeTab === 'user')      { void saveUserSettings();    return; }
  if (settingsState.activeTab === 'providers') { void saveProviderSettings(); return; }
}

export async function loadUser() {
  try {
    const user = await window.electronAPI?.getUser?.();
    applyUserProfile(user ?? {});
  } catch (err) {
    console.warn('[openworld] Could not load user:', err);
    applyUserProfile({});
  }
}

export function toggleAvatarPanel(event) { event?.stopPropagation(); avatarPanel?.classList.toggle('open'); themePanel?.classList.remove('open'); }
export function closeAvatarPanel()       { avatarPanel?.classList.remove('open'); }

export async function openSettingsModal(tabId = settingsState.activeTab) {
  closeAvatarPanel();
  themePanel?.classList.remove('open');
  libraryBackdrop?.classList.remove('open');
  document.querySelector('[data-view="library"]')?.classList.remove('active');
  switchSettingsTab(tabId);
  settingsModalBackdrop?.classList.add('open');
  syncModalOpenState();
  try { await hydrateSettingsModal(); }
  catch (err) { console.error('[openworld] Could not load settings:', err); setFeedback(settingsSaveFeedback, 'Could not load settings.', 'error'); }
  requestAnimationFrame(() => focusActiveSettingsTab());
}

export function closeSettingsModal() {
  settingsModalBackdrop?.classList.remove('open');
  syncModalOpenState();
}

settingsTabs.forEach(btn => { btn.addEventListener('click', () => { switchSettingsTab(btn.dataset.settingsTab); focusActiveSettingsTab(); }); });
avatarBtn?.addEventListener('click', toggleAvatarPanel);
avatarSettingsBtn?.addEventListener('click', e => { e.stopPropagation(); void openSettingsModal(); });
settingsSaveBtn?.addEventListener('click', () => saveActiveSettingsTab());
settingsModalClose?.addEventListener('click', closeSettingsModal);
settingsModalBackdrop?.addEventListener('click', e => { if (e.target === settingsModalBackdrop) closeSettingsModal(); });

document.addEventListener('keydown', e => {
  const isSave = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's';
  if (isSave && settingsModalBackdrop?.classList.contains('open')) { e.preventDefault(); saveActiveSettingsTab(); return; }
  if (e.key === 'Escape') closeSettingsModal();
});

document.addEventListener('click', e => {
  if (!avatarPanel?.contains(e.target) && e.target !== avatarBtn) closeAvatarPanel();
});

// Init connectors tab lazy loading
initConnectors();
