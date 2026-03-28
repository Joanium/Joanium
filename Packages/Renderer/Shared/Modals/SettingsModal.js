import { state } from '../Core/State.js';
import { loadConnectorsPanel } from '../../Features/Connectors/index.js';
import { loadMCPPanel } from '../../Features/MCP/index.js';
import { loadChannelsPanel } from '../../Features/Channels/index.js';
import { PROVIDERS, PROVIDERS_BY_ID } from '../../Pages/Setup/Providers/SetupProviders.js';

const PROVIDER_ORDER = new Map(
  PROVIDERS.map((provider, index) => [provider.id, index]),
);

function getInitials(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0] ?? 'OW').slice(0, 2).toUpperCase();
}

function buildHTML() {
  return `
    <div id="settings-modal-backdrop">
      <div id="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
        <div class="settings-modal-header">
          <div class="settings-modal-copy">
            <h2 id="settings-modal-title">Workspace settings</h2>
          </div>
          <button id="settings-modal-close" class="settings-modal-close" type="button" aria-label="Close settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>
            </svg>
          </button>
        </div>

        <div class="settings-modal-body">
          <div class="settings-shell">
            <nav class="settings-tabs" aria-label="Settings sections">
              <button class="settings-tab active" type="button" data-settings-tab="user">User</button>
              <button class="settings-tab" type="button" data-settings-tab="providers">AI Providers</button>
              <button class="settings-tab" type="button" data-settings-tab="connectors">Connectors</button>
              <button class="settings-tab" type="button" data-settings-tab="channels">Channels</button>
              <button class="settings-tab" type="button" data-settings-tab="mcp">MCP Servers</button>
            </nav>

            <div class="settings-content">
              <section class="settings-panel active" data-settings-panel="user">
                <div class="settings-panel-header">
                  <h3>User</h3>
                  <p>Update your display name, memory, and custom instructions. These are injected into every AI conversation automatically.</p>
                </div>
                <div class="settings-form">
                  <label class="settings-field">
                    <span class="settings-field-label">Name</span>
                    <input id="settings-user-name" type="text" maxlength="80" placeholder="Your name" autocomplete="name"/>
                  </label>
                  <label class="settings-field">
                    <span class="settings-field-label">Memory</span>
                    <textarea id="settings-memory" placeholder="Facts about you, ongoing projects, and preferences the AI should always remember."></textarea>
                  </label>
                  <label class="settings-field">
                    <span class="settings-field-label">Custom Instructions</span>
                    <textarea id="settings-custom-instructions" placeholder="Tone, style, or behaviour instructions for the AI."></textarea>
                  </label>
                </div>
              </section>

              <section class="settings-panel" data-settings-panel="providers" hidden>
                <div class="settings-panel-header">
                  <h3>AI Providers</h3>
                  <p>Connect hosted models with API keys or point Evelina at local Ollama or LM Studio servers. Connected providers show up in the model selector immediately.</p>
                </div>
                <div id="settings-providers-list" class="providers-stack">
                  <div class="ap-empty-hint">Loading...</div>
                </div>
              </section>

              <section class="settings-panel" data-settings-panel="connectors" hidden>
                <div class="settings-panel-header">
                  <h3>Connectors</h3>
                  <p>Link Gmail and GitHub so the AI knows about your emails and repos, and automations can take action.</p>
                </div>
                <div id="connector-list" class="connector-list">
                  <div class="cx-loading">Loading connectors...</div>
                </div>
              </section>

              <section class="settings-panel" data-settings-panel="mcp" hidden>
                <div class="settings-panel-header">
                  <h3>MCP Servers</h3>
                  <p>Connect Model Context Protocol servers here. Browser-control MCP tools automatically show up in chat once a server is connected.</p>
                </div>
                <div id="mcp-settings-panel" class="mcp-settings-panel">
                  <div class="cx-loading">Loading MCP servers...</div>
                </div>
              </section>

              <section class="settings-panel" data-settings-panel="channels" hidden>
                <div class="settings-panel-header">
                  <h3>Channels</h3>
                  <p>Connect WhatsApp and Telegram. When someone messages in, the AI replies automatically on your behalf.</p>
                </div>
                <div id="channels-settings-panel" class="channels-settings-panel">
                  <div class="cx-loading">Loading channels...</div>
                </div>
              </section>
            </div>
          </div>
        </div>

        <div class="settings-modal-footer">
          <div id="settings-save-feedback" class="settings-feedback" aria-live="polite"></div>
          <button id="settings-save" class="settings-save-btn" type="button">Save changes</button>
        </div>
      </div>
    </div>
  `;
}

function buildProviderCatalog(providers) {
  const knownProviders = new Set(PROVIDERS.map((provider) => provider.id));
  const catalog = Array.isArray(providers) ? [...providers] : [];

  PROVIDERS.forEach((definition) => {
    if (!catalog.some((provider) => provider.provider === definition.id)) {
      catalog.push({
        provider: definition.id,
        label: definition.label,
        api: null,
        settings: {},
        configured: false,
        models: {},
      });
    }
  });

  return catalog.filter((provider) => knownProviders.has(provider.provider));
}

function getProviderDefinition(providerId) {
  return PROVIDERS_BY_ID[providerId] ?? null;
}

function getSavedProviderConfig(providerRecord) {
  return {
    apiKey: String(providerRecord.api ?? ''),
    endpoint: String(providerRecord.settings?.endpoint ?? ''),
    modelId: String(providerRecord.settings?.modelId ?? ''),
  };
}

function isProviderConfigured(providerRecord) {
  return Boolean(providerRecord?.configured);
}

function getEffectiveProviderConfig(providerRecord, pendingConfig = {}) {
  const definition = getProviderDefinition(providerRecord.provider);
  const saved = getSavedProviderConfig(providerRecord);
  const effective = { ...saved };

  definition?.fields?.forEach((field) => {
    if (field.type !== 'password' && !effective[field.key] && field.defaultValue != null) {
      effective[field.key] = field.defaultValue;
    }
  });

  Object.entries(pendingConfig ?? {}).forEach(([key, value]) => {
    effective[key] = String(value ?? '');
  });

  return effective;
}

function providerHasDraftChanges(pendingConfig = {}) {
  return Object.keys(pendingConfig ?? {}).length > 0;
}

function providerIsComplete(providerRecord, config) {
  const definition = getProviderDefinition(providerRecord.provider);
  if (!definition) return false;

  return definition.fields.every((field) => {
    if (!field.required) return true;
    return String(config[field.key] ?? '').trim().length >= (field.minLength ?? 1);
  });
}

function providerStatus(providerRecord, config, isDeleting, hasDraft) {
  if (isDeleting) {
    return { tone: 'removing', label: 'Removing' };
  }
  if (providerIsComplete(providerRecord, config)) {
    return {
      tone: isProviderConfigured(providerRecord) ? 'active' : 'draft',
      label: isProviderConfigured(providerRecord) ? 'Connected' : 'Ready to save',
    };
  }
  if (hasDraft) {
    return { tone: 'incomplete', label: 'Needs required fields' };
  }
  return { tone: 'inactive', label: 'Not connected' };
}

function sortProviderCatalog(catalog, settingsState) {
  return [...catalog].sort((left, right) => {
    const leftConfigured = Number(
      isProviderConfigured(left) || settingsState.pendingDeletes.has(left.provider),
    );
    const rightConfigured = Number(
      isProviderConfigured(right) || settingsState.pendingDeletes.has(right.provider),
    );

    if (leftConfigured !== rightConfigured) return rightConfigured - leftConfigured;

    return (
      (PROVIDER_ORDER.get(left.provider) ?? Number.MAX_SAFE_INTEGER) -
      (PROVIDER_ORDER.get(right.provider) ?? Number.MAX_SAFE_INTEGER)
    );
  });
}

export function initSettingsModal() {
  if (!document.getElementById('settings-modal-backdrop')) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = buildHTML();
    document.body.appendChild(wrapper.firstElementChild);
  }

  const settingsState = {
    activeTab: 'user',
    providerCatalog: [],
    pendingProviderConfigs: {},
    pendingDeletes: new Set(),
  };

  const $ = (id) => document.getElementById(id);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const backdrop = () => $('settings-modal-backdrop');
  const closeBtn = () => $('settings-modal-close');
  const saveBtn = () => $('settings-save');
  const saveFeedback = () => $('settings-save-feedback');
  const nameInput = () => $('settings-user-name');
  const memoryInput = () => $('settings-memory');
  const instructionsInput = () => $('settings-custom-instructions');
  const providersList = () => $('settings-providers-list');

  const tabs = () => $$('[data-settings-tab]');
  const panels = () => $$('[data-settings-panel]');

  function setFeedback(message = '', tone = 'info') {
    const element = saveFeedback();
    if (!element) return;
    element.textContent = message;
    element.className = message ? `settings-feedback ${tone}` : 'settings-feedback';
  }

  function providerTabHasChanges() {
    return settingsState.pendingDeletes.size > 0 ||
      Object.values(settingsState.pendingProviderConfigs).some((config) => providerHasDraftChanges(config));
  }

  function updateSaveButton() {
    const button = saveBtn();
    if (!button) return;

    if (settingsState.activeTab === 'user') {
      button.textContent = 'Save changes';
      button.disabled = false;
      return;
    }

    if (settingsState.activeTab === 'providers') {
      button.textContent = 'Save provider changes';
      button.disabled = !providerTabHasChanges();
      return;
    }

    button.textContent = 'No changes to save';
    button.disabled = true;
  }

  function switchTab(tabId) {
    settingsState.activeTab = tabId;

    tabs().forEach((button) => {
      const active = button.dataset.settingsTab === tabId;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });

    panels().forEach((panel) => {
      const active = panel.dataset.settingsPanel === tabId;
      panel.classList.toggle('active', active);
      panel.hidden = !active;
    });

    setFeedback();
    updateSaveButton();
    if (tabId === 'connectors') loadConnectorsPanel();
    if (tabId === 'mcp') loadMCPPanel();
    if (tabId === 'channels') loadChannelsPanel();
  }

  function focusActiveTab() {
    if (settingsState.activeTab === 'providers') {
      providersList()?.querySelector('input')?.focus();
      return;
    }
    if (settingsState.activeTab === 'mcp') {
      document.getElementById('mcp-add-btn')?.focus();
      return;
    }
    if (settingsState.activeTab === 'user') nameInput()?.focus();
  }

  function syncBodyClass() {
    const hasOpen = Boolean(document.querySelector('#settings-modal-backdrop.open, #library-modal-backdrop.open'));
    document.body.classList.toggle('modal-open', hasOpen);
  }

  function applyUserProfile(user = {}) {
    const rawName = String(user?.name ?? '').trim();
    const displayName = rawName || 'User';
    const firstName = displayName.split(/\s+/)[0];

    state.userName = rawName;
    state.userInitials = getInitials(displayName);

    const welcomeTitle = document.querySelector('.welcome-title');
    if (welcomeTitle) welcomeTitle.textContent = rawName ? `Welcome, ${firstName}` : 'Welcome';

    window.dispatchEvent(new CustomEvent('ow:user-profile-updated', {
      detail: { name: displayName, initials: state.userInitials },
    }));
  }

  function renderProviderField(providerRecord, field, savedConfig, effectiveConfig, disabled) {
    const wrapper = document.createElement('label');
    wrapper.className = 'spr-field';

    const label = document.createElement('span');
    label.className = 'spr-field-label';
    label.textContent = field.label;

    const inputWrap = document.createElement('div');
    inputWrap.className = 'key-input-wrap spr-key-wrap';

    const input = document.createElement('input');
    input.className = 'key-input spr-key-input';
    input.type = field.type === 'password' ? 'password' : 'text';
    input.placeholder = field.type === 'password' && savedConfig.apiKey
      ? '••••••••  (saved)'
      : field.placeholder;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.disabled = disabled;
    input.value = field.type === 'password'
      ? String(settingsState.pendingProviderConfigs[providerRecord.provider]?.[field.key] ?? '')
      : String(effectiveConfig[field.key] ?? '');
    input.addEventListener('input', () => {
      const pending = { ...(settingsState.pendingProviderConfigs[providerRecord.provider] ?? {}) };
      const trimmed = input.value.trim();

      if (field.type === 'password' && !trimmed && savedConfig.apiKey) {
        delete pending[field.key];
      } else {
        pending[field.key] = input.value;
      }

      if (Object.keys(pending).length > 0) settingsState.pendingProviderConfigs[providerRecord.provider] = pending;
      else delete settingsState.pendingProviderConfigs[providerRecord.provider];

      if (trimmed) settingsState.pendingDeletes.delete(providerRecord.provider);
      renderProviders();
    });
    inputWrap.appendChild(input);

    if (field.type === 'password') {
      const eyeButton = document.createElement('button');
      eyeButton.type = 'button';
      eyeButton.className = 'key-eye';
      eyeButton.title = 'Show or hide';
      eyeButton.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke-width="1.8"/>
          <circle cx="12" cy="12" r="3" stroke-width="1.8"/>
        </svg>
      `;
      eyeButton.disabled = disabled;
      eyeButton.addEventListener('click', () => {
        input.type = input.type === 'password' ? 'text' : 'password';
      });
      inputWrap.appendChild(eyeButton);
    }

    wrapper.append(label, inputWrap);
    return wrapper;
  }

  function renderProviders() {
    const list = providersList();
    if (!list) return;

    const catalog = sortProviderCatalog(settingsState.providerCatalog, settingsState);
    if (!catalog.length) {
      list.innerHTML = '<div class="settings-empty-card">No providers available.</div>';
      updateSaveButton();
      return;
    }

    list.innerHTML = '';

    catalog.forEach((providerRecord) => {
      const definition = getProviderDefinition(providerRecord.provider);
      if (!definition) return;

      const savedConfig = getSavedProviderConfig(providerRecord);
      const pendingConfig = settingsState.pendingProviderConfigs[providerRecord.provider] ?? {};
      const effectiveConfig = getEffectiveProviderConfig(providerRecord, pendingConfig);
      const isDeleting = settingsState.pendingDeletes.has(providerRecord.provider);
      const hasDraft = providerHasDraftChanges(pendingConfig);
      const hasAnyConfig = isProviderConfigured(providerRecord) || hasDraft;
      const status = providerStatus(providerRecord, effectiveConfig, isDeleting, hasDraft);

      const row = document.createElement('div');
      row.className = `spr-row${status.tone === 'active' ? ' spr-row--active' : ''}${isDeleting ? ' spr-row--deleting' : ''}`;
      row.style.setProperty('--p-color', definition.color);

      const main = document.createElement('div');
      main.className = 'spr-main';

      const summary = document.createElement('div');
      summary.className = 'spr-summary';

      const icon = document.createElement('div');
      icon.className = 'spr-icon';
      icon.innerHTML = `
        <img class="spr-icon-img" src="${definition.iconPath || 'data:,'}" alt="" />
        <span class="spr-icon-fallback">${definition.fallback}</span>
      `;
      if (!definition.iconPath) icon.classList.add('icon-missing');
      const image = icon.querySelector('.spr-icon-img');
      image?.addEventListener('error', () => icon.classList.add('icon-missing'));
      image?.addEventListener('load', () => icon.classList.remove('icon-missing'));

      const info = document.createElement('div');
      info.className = 'spr-info';
      info.innerHTML = `
        <div class="spr-provider-name">${providerRecord.label ?? definition.label}</div>
        <div class="spr-provider-copy">${definition.company || definition.caption}</div>
      `;

      const badge = document.createElement('span');
      badge.className = `spr-status spr-status--${status.tone}`;
      badge.textContent = status.label;

      summary.append(icon, info, badge);

      const fields = document.createElement('div');
      fields.className = `spr-fields${definition.fields.length > 1 ? ' spr-fields--multi' : ''}`;
      definition.fields.forEach((field) => {
        fields.appendChild(renderProviderField(providerRecord, field, savedConfig, effectiveConfig, isDeleting));
      });

      main.append(summary, fields);

      if (definition.hint) {
        const hint = document.createElement('p');
        hint.className = 'spr-hint';
        hint.textContent = definition.hint;
        main.appendChild(hint);
      }

      const actions = document.createElement('div');
      actions.className = 'spr-actions';

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = isDeleting ? 'spr-undo-btn' : 'spr-delete-btn';
      deleteButton.title = isDeleting ? 'Undo removal' : 'Remove configuration';
      deleteButton.hidden = !isDeleting && !hasAnyConfig;
      deleteButton.innerHTML = isDeleting
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 14l-4-4 4-4M5 10h11a4 4 0 010 8h-1" stroke-linecap="round" stroke-linejoin="round"/></svg> Undo`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      deleteButton.addEventListener('click', () => {
        if (isDeleting) {
          settingsState.pendingDeletes.delete(providerRecord.provider);
        } else {
          settingsState.pendingDeletes.add(providerRecord.provider);
          delete settingsState.pendingProviderConfigs[providerRecord.provider];
        }
        renderProviders();
      });

      actions.appendChild(deleteButton);
      row.append(main, actions);
      list.appendChild(row);
    });

    updateSaveButton();
  }

  async function hydrateModal() {
    setFeedback();
    settingsState.pendingDeletes.clear();
    settingsState.pendingProviderConfigs = {};

    const [user, customInstructions, memory, providers] = await Promise.all([
      window.electronAPI?.getUser?.(),
      window.electronAPI?.getCustomInstructions?.(),
      window.electronAPI?.getMemory?.(),
      window.electronAPI?.getModels?.(),
    ]);

    applyUserProfile(user ?? {});
    settingsState.providerCatalog = buildProviderCatalog(providers);

    if (nameInput()) nameInput().value = user?.name ?? '';
    if (memoryInput()) memoryInput().value = memory ?? '';
    if (instructionsInput()) instructionsInput().value = customInstructions ?? '';

    renderProviders();
    updateSaveButton();
  }

  async function saveUserTab() {
    const nextName = nameInput()?.value.trim() ?? '';
    const nextMemory = memoryInput()?.value ?? '';
    const nextInstructions = instructionsInput()?.value ?? '';

    if (nextName.length < 2) {
      setFeedback('Enter a name with at least 2 characters.', 'error');
      nameInput()?.focus();
      return;
    }

    saveBtn().disabled = true;
    setFeedback('Saving...', 'info');

    try {
      const [profileResult, instructionsResult, memoryResult] = await Promise.all([
        window.electronAPI?.saveUserProfile?.({ name: nextName }),
        window.electronAPI?.saveCustomInstructions?.(nextInstructions),
        window.electronAPI?.saveMemory?.(nextMemory),
      ]);

      if (!profileResult?.ok) throw new Error(profileResult?.error ?? 'Could not save profile.');
      if (!instructionsResult?.ok) throw new Error(instructionsResult?.error ?? 'Could not save custom instructions.');
      if (!memoryResult?.ok) throw new Error(memoryResult?.error ?? 'Could not save memory.');

      applyUserProfile(profileResult.user ?? { name: nextName });
      setFeedback('Changes saved.', 'success');
      window.dispatchEvent(new CustomEvent('ow:settings-saved'));
    } catch (error) {
      console.error('[SettingsModal] Save user error:', error);
      setFeedback(error.message || 'Could not save.', 'error');
    } finally {
      updateSaveButton();
    }
  }

  async function saveProvidersTab() {
    const changes = {};

    for (const providerRecord of settingsState.providerCatalog) {
      const providerId = providerRecord.provider;
      if (settingsState.pendingDeletes.has(providerId)) {
        changes[providerId] = null;
        continue;
      }

      const pendingConfig = settingsState.pendingProviderConfigs[providerId];
      if (!providerHasDraftChanges(pendingConfig)) continue;

      const effectiveConfig = getEffectiveProviderConfig(providerRecord, pendingConfig);
      if (!providerIsComplete(providerRecord, effectiveConfig)) {
        setFeedback(`Finish the required fields for ${providerRecord.label ?? providerId}.`, 'error');
        renderProviders();
        return;
      }

      const definition = getProviderDefinition(providerId);
      const savedConfig = getSavedProviderConfig(providerRecord);
      const payload = {};

      definition.fields.forEach((field) => {
        const pendingValue = pendingConfig[field.key];
        if (pendingValue != null) {
          payload[field.key] = String(pendingValue).trim();
          return;
        }

        if (!savedConfig[field.key] && effectiveConfig[field.key]) {
          payload[field.key] = String(effectiveConfig[field.key]).trim();
        }
      });

      if (Object.keys(payload).length > 0) changes[providerId] = payload;
    }

    if (!Object.keys(changes).length) {
      setFeedback('No provider changes to save.', 'error');
      return;
    }

    saveBtn().disabled = true;
    setFeedback('Saving provider settings...', 'info');

    try {
      const result = await window.electronAPI?.saveProviderConfigs?.(changes);
      if (!result?.ok) throw new Error(result?.error ?? 'Could not save provider settings.');

      const allProviders = await window.electronAPI?.getModels?.() ?? [];
      state.allProviders = allProviders;
      state.providers = allProviders.filter((provider) => provider.configured);

      settingsState.providerCatalog = buildProviderCatalog(allProviders);
      settingsState.pendingProviderConfigs = {};
      settingsState.pendingDeletes.clear();
      renderProviders();

      const savedCount = Object.values(changes).filter((value) => value !== null).length;
      const removedCount = Object.values(changes).filter((value) => value === null).length;
      const parts = [];
      if (savedCount) parts.push(`${savedCount} provider${savedCount !== 1 ? 's' : ''} saved`);
      if (removedCount) parts.push(`${removedCount} provider${removedCount !== 1 ? 's' : ''} removed`);
      setFeedback(`${parts.join(', ')}.`, 'success');
      window.dispatchEvent(new CustomEvent('ow:settings-saved'));
    } catch (error) {
      console.error('[SettingsModal] Save providers error:', error);
      setFeedback(error.message || 'Could not save.', 'error');
    } finally {
      updateSaveButton();
    }
  }

  function wireEvents() {
    tabs().forEach((button) => {
      button.addEventListener('click', () => {
        switchTab(button.dataset.settingsTab);
        focusActiveTab();
      });
    });

    saveBtn()?.addEventListener('click', () => {
      if (settingsState.activeTab === 'user') void saveUserTab();
      if (settingsState.activeTab === 'providers') void saveProvidersTab();
    });

    closeBtn()?.addEventListener('click', close);
    backdrop()?.addEventListener('click', (event) => {
      if (event.target === backdrop()) close();
    });

    document.addEventListener('keydown', (event) => {
      const isSave = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's';
      if (isSave && backdrop()?.classList.contains('open')) {
        event.preventDefault();
        if (settingsState.activeTab === 'user') void saveUserTab();
        if (settingsState.activeTab === 'providers') void saveProvidersTab();
        return;
      }

      if (event.key === 'Escape' && backdrop()?.classList.contains('open')) close();
    });
  }

  wireEvents();

  async function open(tabId = settingsState.activeTab) {
    switchTab(tabId);
    backdrop()?.classList.add('open');
    syncBodyClass();

    try {
      await hydrateModal();
    } catch (error) {
      console.error('[SettingsModal] Could not load settings:', error);
      setFeedback('Could not load settings.', 'error');
    }

    requestAnimationFrame(() => focusActiveTab());
  }

  function close() {
    backdrop()?.classList.remove('open');
    syncBodyClass();
  }

  async function loadUser() {
    try {
      const user = await window.electronAPI?.getUser?.();
      applyUserProfile(user ?? {});
      return user;
    } catch (error) {
      console.warn('[SettingsModal] Could not load user:', error);
      applyUserProfile({});
      return null;
    }
  }

  return { open, close, loadUser };
}
