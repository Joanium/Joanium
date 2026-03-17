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

const settingsTabs = Array.from(document.querySelectorAll('[data-settings-tab]'));
const settingsPanels = Array.from(document.querySelectorAll('[data-settings-panel]'));
const settingsUserNameInput = document.getElementById('settings-user-name');
const settingsCustomInstructionsInput = document.getElementById('settings-custom-instructions');
const settingsProvidersList = document.getElementById('settings-providers-list');
const settingsSaveBtn = document.getElementById('settings-save');
const settingsSaveFeedback = document.getElementById('settings-save-feedback');

const PROVIDER_META = {
  anthropic: {
    color: '#cc785c',
    placeholder: 'sk-ant-api03-...',
    iconPath: 'Assets/Icons/Claude.png',
    fallback: 'C',
  },
  openai: {
    color: '#10a37f',
    placeholder: 'sk-proj-...',
    iconPath: 'Assets/Icons/ChatGPT.png',
    fallback: 'GPT',
  },
  google: {
    color: '#4285f4',
    placeholder: 'AIza...',
    iconPath: 'Assets/Icons/Gemini.png',
    fallback: 'G',
  },
  openrouter: {
    color: '#9b59b6',
    placeholder: 'sk-or-v1-...',
    iconPath: 'Assets/Icons/OpenRouter.png',
    fallback: 'OR',
  },
};

const settingsState = {
  activeTab: 'user',
  providerCatalog: [],
  pendingProviderKeys: {},
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getDisplayName(name) {
  const trimmed = String(name ?? '').trim();
  return trimmed || 'User';
}

function getInitials(name) {
  const displayName = getDisplayName(name);
  const parts = displayName.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  return displayName.slice(0, 2).toUpperCase();
}

function setFeedback(element, message = '', tone = 'info') {
  if (!element) return;

  element.textContent = message;
  element.className = message ? `settings-feedback ${tone}` : 'settings-feedback';
}

function applyUserProfile(user = {}) {
  const rawName = String(user?.name ?? '').trim();
  const displayName = getDisplayName(rawName);
  const initials = getInitials(displayName);
  const firstName = displayName.split(/\s+/)[0];

  state.userName = rawName;
  state.userInitials = initials;

  if (avatarBtn) {
    avatarBtn.textContent = initials;
    avatarBtn.title = displayName;
    avatarBtn.setAttribute('data-tip', displayName);
  }

  if (avatarPanelBadge) avatarPanelBadge.textContent = initials;
  if (avatarPanelName) avatarPanelName.textContent = displayName;

  const welcomeTitle = document.querySelector('.welcome-title');
  if (welcomeTitle) {
    welcomeTitle.textContent = rawName ? `Welcome, ${firstName}` : 'Welcome';
  }
}

function switchSettingsTab(tabId) {
  settingsState.activeTab = tabId;

  settingsTabs.forEach((button) => {
    const isActive = button.dataset.settingsTab === tabId;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });

  settingsPanels.forEach((panel) => {
    const isActive = panel.dataset.settingsPanel === tabId;
    panel.classList.toggle('active', isActive);
    panel.hidden = !isActive;
  });

  setFeedback(settingsSaveFeedback);
  updateSaveButtonState();
}

function focusActiveSettingsTab() {
  if (settingsState.activeTab === 'providers') {
    settingsProvidersList?.querySelector('input')?.focus();
    return;
  }

  if (settingsState.activeTab === 'user') {
    settingsUserNameInput?.focus();
  }
}

function updateSaveButtonState() {
  if (!settingsSaveBtn) return;

  if (settingsState.activeTab === 'user') {
    settingsSaveBtn.textContent = 'Save name and instructions';
    settingsSaveBtn.disabled = false;
    return;
  }

  if (settingsState.activeTab === 'providers') {
    settingsSaveBtn.textContent = 'Save provider changes';
    settingsSaveBtn.disabled = false;
    return;
  }

  settingsSaveBtn.textContent = 'No changes to save';
  settingsSaveBtn.disabled = true;
}

function getProviderPlaceholder(providerId) {
  return PROVIDER_META[providerId]?.placeholder ?? 'Paste API key';
}

function renderSettingsProviders() {
  if (!settingsProvidersList) return;

  if (settingsState.providerCatalog.length === 0) {
    settingsProvidersList.innerHTML = '<div class="settings-empty-card">No providers available</div>';
    updateSaveButtonState();
    return;
  }

  const sortedProviders = [...settingsState.providerCatalog].sort((left, right) => {
    const leftConnected = String(left.api ?? '').trim().length > 0;
    const rightConnected = String(right.api ?? '').trim().length > 0;
    return Number(rightConnected) - Number(leftConnected);
  });

  settingsProvidersList.innerHTML = sortedProviders
    .map((provider) => {
      const meta = PROVIDER_META[provider.provider] ?? {};
      const currentKey = String(provider.api ?? '').trim();
      const nextKey = settingsState.pendingProviderKeys[provider.provider] ?? '';
      const isConnected = currentKey.length > 0;
      const inputId = `settings-key-${provider.provider}`;
      const iconPath = meta.iconPath ?? '';
      const fallback = meta.fallback ?? provider.label?.slice(0, 2) ?? '?';

      return `
        <article
          class="settings-provider-row"
          style="--p-color:${meta.color ?? 'var(--accent)'}"
        >
          <div class="spr-icon" aria-hidden="true">
            <img
              class="spr-icon-img"
              src="${escapeHtml(iconPath)}"
              alt=""
              draggable="false"
            />
            <span class="spr-icon-fallback">${escapeHtml(fallback)}</span>
          </div>

          <div class="spr-meta">
            <span class="spr-name">${escapeHtml(provider.label)}</span>
            <span class="spr-status ${isConnected ? 'connected' : 'disconnected'}">
              ${isConnected ? '● Connected' : '○ Not connected'}
            </span>
          </div>

          <div class="key-input-wrap spr-key-wrap">
            <input
              class="key-input spr-key-input"
              id="${escapeHtml(inputId)}"
              type="password"
              data-provider-input="${escapeHtml(provider.provider)}"
              placeholder="${escapeHtml(getProviderPlaceholder(provider.provider))}"
              value="${escapeHtml(nextKey)}"
              autocomplete="off"
              spellcheck="false"
            />
            <button
              type="button"
              class="key-eye"
              data-target="${escapeHtml(inputId)}"
              title="Show / hide"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke-width="1.8"/>
                <circle cx="12" cy="12" r="3" stroke-width="1.8"/>
              </svg>
            </button>
          </div>
        </article>`;
    })
    .join('');

  /* Icon fallback */
  settingsProvidersList.querySelectorAll('.spr-icon-img').forEach((img) => {
    if (img.complete && img.naturalWidth === 0) img.closest('.spr-icon')?.classList.add('icon-missing');
    img.addEventListener('error', () => img.closest('.spr-icon')?.classList.add('icon-missing'));
    img.addEventListener('load', () => img.closest('.spr-icon')?.classList.remove('icon-missing'));
  });

  /* Key inputs */
  settingsProvidersList.querySelectorAll('[data-provider-input]').forEach((input) => {
    input.addEventListener('input', () => {
      settingsState.pendingProviderKeys[input.dataset.providerInput] = input.value;
      updateSaveButtonState();
    });
  });

  /* Eye toggles */
  settingsProvidersList.querySelectorAll('.key-eye').forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.target);
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  });

  updateSaveButtonState();
}

async function hydrateSettingsModal() {
  setFeedback(settingsSaveFeedback);

  const [user, customInstructions, providers] = await Promise.all([
    window.electronAPI?.getUser?.(),
    window.electronAPI?.getCustomInstructions?.(),
    window.electronAPI?.getModels?.(),
  ]);

  applyUserProfile(user ?? {});
  settingsState.providerCatalog = Array.isArray(providers) ? providers : [];
  settingsState.pendingProviderKeys = {};

  if (settingsUserNameInput) settingsUserNameInput.value = user?.name ?? '';
  if (settingsCustomInstructionsInput) settingsCustomInstructionsInput.value = customInstructions ?? '';

  renderSettingsProviders();
  updateSaveButtonState();
}

async function saveUserSettings() {
  const nextName = settingsUserNameInput?.value.trim() ?? '';
  const nextInstructions = settingsCustomInstructionsInput?.value ?? '';

  if (nextName.length < 2) {
    setFeedback(settingsSaveFeedback, 'Enter a name with at least 2 characters.', 'error');
    settingsUserNameInput?.focus();
    return;
  }

  settingsSaveBtn.disabled = true;
  setFeedback(settingsSaveFeedback, 'Saving your profile...', 'info');

  try {
    const [profileResult, instructionsResult] = await Promise.all([
      window.electronAPI?.saveUserProfile?.({ name: nextName }),
      window.electronAPI?.saveCustomInstructions?.(nextInstructions),
    ]);

    if (!profileResult?.ok) {
      throw new Error(profileResult?.error ?? 'Could not save your profile.');
    }

    if (!instructionsResult?.ok) {
      throw new Error(instructionsResult?.error ?? 'Could not save custom instructions.');
    }

    applyUserProfile(profileResult.user ?? { name: nextName });
    setFeedback(settingsSaveFeedback, 'User settings saved.', 'success');
  } catch (error) {
    console.error('[openworld] Could not save user settings:', error);
    setFeedback(settingsSaveFeedback, error.message || 'Could not save user settings.', 'error');
  } finally {
    updateSaveButtonState();
  }
}

async function saveProviderSettings() {
  const changes = Object.fromEntries(
    Object.entries(settingsState.pendingProviderKeys)
      .map(([providerId, apiKey]) => [providerId, String(apiKey ?? '').trim()])
      .filter(([, apiKey]) => apiKey.length > 0)
  );

  if (Object.keys(changes).length === 0) {
    setFeedback(settingsSaveFeedback, 'Add at least one API key before saving.', 'error');
    return;
  }

  settingsSaveBtn.disabled = true;
  setFeedback(settingsSaveFeedback, 'Saving provider keys...', 'info');

  try {
    const result = await window.electronAPI?.saveAPIKeys?.(changes);
    if (!result?.ok) {
      throw new Error(result?.error ?? 'Could not save provider keys.');
    }

    await loadProviders();
    settingsState.providerCatalog = state.allProviders;
    settingsState.pendingProviderKeys = {};
    renderSettingsProviders();

    const count = Object.keys(changes).length;
    setFeedback(
      settingsSaveFeedback,
      count === 1 ? 'Provider key saved.' : `${count} provider keys saved.`,
      'success'
    );
  } catch (error) {
    console.error('[openworld] Could not save provider keys:', error);
    setFeedback(settingsSaveFeedback, error.message || 'Could not save provider keys.', 'error');
  } finally {
    updateSaveButtonState();
  }
}

function saveActiveSettingsTab() {
  if (settingsState.activeTab === 'user') {
    void saveUserSettings();
    return;
  }

  if (settingsState.activeTab === 'providers') {
    void saveProviderSettings();
  }
}

export async function loadUser() {
  try {
    const user = await window.electronAPI?.getUser?.();
    applyUserProfile(user ?? {});
  } catch (error) {
    console.warn('[openworld] Could not load user:', error);
    applyUserProfile({});
  }
}

export function toggleAvatarPanel(event) {
  event?.stopPropagation();
  avatarPanel?.classList.toggle('open');
  themePanel?.classList.remove('open');
}

export function closeAvatarPanel() {
  avatarPanel?.classList.remove('open');
}

export async function openSettingsModal(tabId = settingsState.activeTab) {
  closeAvatarPanel();
  themePanel?.classList.remove('open');
  libraryBackdrop?.classList.remove('open');
  document.querySelector('[data-view="library"]')?.classList.remove('active');

  switchSettingsTab(tabId);
  settingsModalBackdrop?.classList.add('open');
  syncModalOpenState();

  try {
    await hydrateSettingsModal();
  } catch (error) {
    console.error('[openworld] Could not load settings modal:', error);
    setFeedback(settingsSaveFeedback, 'Could not load settings.', 'error');
  }

  requestAnimationFrame(() => {
    focusActiveSettingsTab();
  });
}

export function closeSettingsModal() {
  settingsModalBackdrop?.classList.remove('open');
  syncModalOpenState();
}

settingsTabs.forEach((button) => {
  button.addEventListener('click', () => {
    switchSettingsTab(button.dataset.settingsTab);
    focusActiveSettingsTab();
  });
});

avatarBtn?.addEventListener('click', toggleAvatarPanel);

avatarSettingsBtn?.addEventListener('click', (event) => {
  event.stopPropagation();
  void openSettingsModal();
});

settingsSaveBtn?.addEventListener('click', () => {
  saveActiveSettingsTab();
});

settingsModalClose?.addEventListener('click', closeSettingsModal);

settingsModalBackdrop?.addEventListener('click', (event) => {
  if (event.target === settingsModalBackdrop) closeSettingsModal();
});

document.addEventListener('keydown', (event) => {
  const isSaveShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's';
  if (isSaveShortcut && settingsModalBackdrop?.classList.contains('open')) {
    event.preventDefault();
    saveActiveSettingsTab();
    return;
  }

  if (event.key === 'Escape') closeSettingsModal();
});

document.addEventListener('click', (event) => {
  if (!avatarPanel?.contains(event.target) && event.target !== avatarBtn) closeAvatarPanel();
});