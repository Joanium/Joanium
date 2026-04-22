import { state } from '../System/State.js';
import { createModal } from '../System/ModalFactory.js';
import { loadConnectorsPanel } from '../Pages/Shared/Connectors/index.js';
import { loadMCPPanel } from '../Pages/Shared/MCP/index.js';
import { loadChannelsPanel } from '../Pages/Channels/Features/index.js';
import { openConfirm } from '../System/ConfirmDialog.js';
import { PROVIDERS, PROVIDERS_BY_ID } from '../Pages/Setup/UI/Render/Providers/SetupProviders.js';
const PROVIDER_ORDER = new Map(PROVIDERS.map((provider, index) => [provider.id, index]));
function buildProviderCatalog(providers) {
  const knownProviders = new Set(PROVIDERS.map((p) => p.id)),
    catalog = Array.isArray(providers) ? [...providers] : [];
  return (
    PROVIDERS.forEach((def) => {
      catalog.some((p) => p.provider === def.id) ||
        catalog.push({
          provider: def.id,
          label: def.label,
          api: null,
          settings: {},
          configured: !1,
          models: {},
        });
    }),
    catalog.filter((p) => knownProviders.has(p.provider))
  );
}
function getProviderDefinition(providerId) {
  return PROVIDERS_BY_ID[providerId] ?? null;
}
function getSavedProviderConfig(r) {
  return {
    apiKey: String(r.api ?? ''),
    endpoint: String(r.settings?.endpoint ?? ''),
    modelId: String(r.settings?.modelId ?? ''),
  };
}
function isProviderConfigured(r) {
  return Boolean(r?.configured);
}
function getEffectiveProviderConfig(r, pending = {}) {
  const def = getProviderDefinition(r.provider),
    effective = { ...getSavedProviderConfig(r) };
  return (
    def?.fields?.forEach((f) => {
      'password' === f.type ||
        effective[f.key] ||
        null == f.defaultValue ||
        (effective[f.key] = f.defaultValue);
    }),
    Object.entries(pending ?? {}).forEach(([k, v]) => {
      effective[k] = String(v ?? '');
    }),
    effective
  );
}
function providerHasDraftChanges(pending = {}) {
  return Object.keys(pending ?? {}).length > 0;
}
function providerIsComplete(r, config) {
  const def = getProviderDefinition(r.provider);
  return (
    !!def &&
    def.fields.every(
      (f) => !f.required || String(config[f.key] ?? '').trim().length >= (f.minLength ?? 1),
    )
  );
}
export function initSettingsModal() {
  const $ = (id) => document.getElementById(id),
    $$ = (selector) => Array.from(document.querySelectorAll(selector)),
    ss = {
      activeTab: 'user',
      providerCatalog: [],
      pendingProviderConfigs: {},
      pendingDeletes: new Set(),
    },
    modal = createModal({
      backdropId: 'settings-modal-backdrop',
      html: '\n    <div id="settings-modal-backdrop">\n      <div id="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">\n        <div class="settings-modal-header">\n          <div class="settings-modal-copy">\n            <h2 id="settings-modal-title">Workspace settings</h2>\n          </div>\n          <button id="settings-modal-close" class="settings-modal-close" type="button" aria-label="Close settings">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">\n              <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>\n            </svg>\n          </button>\n        </div>\n\n        <div class="settings-modal-body">\n          <div class="settings-shell">\n            <nav class="settings-tabs" aria-label="Settings sections">\n              <button class="settings-tab active" type="button" data-settings-tab="user">User</button>\n              <button class="settings-tab" type="button" data-settings-tab="providers">AI Providers</button>\n              <button class="settings-tab" type="button" data-settings-tab="connectors">Connectors</button>\n              <button class="settings-tab" type="button" data-settings-tab="channels">Channels</button>\n              <button class="settings-tab" type="button" data-settings-tab="mcp">MCP Servers</button>\n              <button class="settings-tab" type="button" data-settings-tab="shortcuts">Shortcuts</button>\n              <button class="settings-tab" type="button" data-settings-tab="app">App</button>\n            </nav>\n\n            <div class="settings-content">\n              <section class="settings-panel active" data-settings-panel="user">\n                <div class="settings-panel-header">\n                  <h3>User</h3>\n                  <p>Update your display name, pinned memory note, and custom instructions. Custom instructions stay in every conversation, while personal memory is stored separately and read only when relevant.</p>\n                </div>\n                <div class="settings-form">\n                  <label class="settings-field">\n                    <span class="settings-field-label">Name</span>\n                    <input id="settings-user-name" type="text" maxlength="80" placeholder="Your name" autocomplete="name"/>\n                  </label>\n                  <label class="settings-field">\n                    <span class="settings-field-label">Pinned Memory</span>\n                    <textarea id="settings-memory" placeholder="Durable personal notes the AI can read when your conversation needs them."></textarea>\n                  </label>\n                  <label class="settings-field">\n                    <span class="settings-field-label">Custom Instructions</span>\n                    <textarea id="settings-custom-instructions" placeholder="Tone, style, or behaviour instructions for the AI."></textarea>\n                  </label>\n                </div>\n              </section>\n\n              <section class="settings-panel" data-settings-panel="providers" hidden>\n                <div class="settings-panel-header">\n                  <h3>AI Providers</h3>\n                  <p>Connect hosted models with API keys or point Joanium at local Ollama or LM Studio servers. When a local server is reachable, Joanium detects its available models automatically.</p>\n                </div>\n                <div id="settings-providers-list" class="providers-stack">\n                  <div class="ap-empty-hint">Loading...</div>\n                </div>\n              </section>\n\n              <section class="settings-panel" data-settings-panel="connectors" hidden>\n                <div class="settings-panel-header">\n                  <h3>Connectors</h3>\n                  <p>Link your workspace so the AI knows about your emails, repos and files, and automations can take action.</p>\n                </div>\n                <div id="connector-list" class="connector-list">\n                  <div class="cx-loading">Loading connectors...</div>\n                </div>\n              </section>\n\n              <section class="settings-panel" data-settings-panel="mcp" hidden>\n                <div class="settings-panel-header">\n                  <h3>MCP Servers</h3>\n                  <p>Connect Model Context Protocol servers here. Browser-control MCP tools automatically show up in chat once a server is connected.</p>\n                </div>\n                <div id="mcp-settings-panel" class="mcp-settings-panel">\n                  <div class="cx-loading">Loading MCP servers...</div>\n                </div>\n              </section>\n\n              <section class="settings-panel" data-settings-panel="channels" hidden>\n                <div class="settings-panel-header">\n                  <h3>Channels</h3>\n                  <p>Connect WhatsApp and Telegram. When someone messages in, the AI replies automatically on your behalf.</p>\n                </div>\n                <div id="channels-settings-panel" class="channels-settings-panel">\n                  <div class="cx-loading">Loading channels...</div>\n                </div>\n              </section>\n\n              <section class="settings-panel" data-settings-panel="app" hidden>\n                <div class="settings-panel-header">\n                  <h3>App</h3>\n                  <p>System-level behaviour for Joanium.</p>\n                </div>\n                <div class="settings-form" id="app-settings-form">\n                  <div class="settings-toggle-row" id="app-setting-startup" hidden>\n                    <div class="settings-toggle-info">\n                      <span class="settings-field-label">Run on Startup</span>\n                      <span class="settings-field-hint">Launch Joanium automatically when you log in.</span>\n                    </div>\n                    <label class="settings-toggle" aria-label="Run on startup">\n                      <input id="app-toggle-startup" type="checkbox" />\n                      <span class="settings-toggle-track"><span class="settings-toggle-thumb"></span></span>\n                    </label>\n                  </div>\n                  <div class="settings-toggle-row" id="app-setting-tray" hidden>\n                    <div class="settings-toggle-info">\n                      <span class="settings-field-label">System Tray</span>\n                      <span class="settings-field-hint">Keep Joanium in the system tray when the window is closed.</span>\n                    </div>\n                    <label class="settings-toggle" aria-label="System tray">\n                      <input id="app-toggle-tray" type="checkbox" />\n                      <span class="settings-toggle-track"><span class="settings-toggle-thumb"></span></span>\n                    </label>\n                  </div>\n                  <div class="settings-toggle-row" id="app-setting-awake">\n                    <div class="settings-toggle-info">\n                      <span class="settings-field-label">Keep Awake</span>\n                      <span class="settings-field-hint">Prevent the system from sleeping while Joanium is running.</span>\n                    </div>\n                    <label class="settings-toggle" aria-label="Keep awake">\n                      <input id="app-toggle-awake" type="checkbox" />\n                      <span class="settings-toggle-track"><span class="settings-toggle-thumb"></span></span>\n                    </label>\n                  </div>\n\n                  <div class="settings-danger-zone">\n                    <div class="settings-danger-zone-header">\n                      <span class="settings-danger-zone-label">Danger Zone</span>\n                    </div>\n                    <div class="settings-danger-row">\n                      <div class="settings-toggle-info">\n                        <span class="settings-field-label">Reset App</span>\n                        <span class="settings-field-hint">Permanently clears all chats, events, API keys, memory, and settings.</span>\n                        <span class="settings-danger-warning">This action is destructive and irreversible.</span>\n                      </div>\n                      <button id="app-reset-btn" class="settings-reset-btn" type="button">Reset App</button>\n                    </div>\n                  </div>\n                </div>\n              </section>\n\n              <section class="settings-panel" data-settings-panel="shortcuts" hidden>\n                <div class="settings-panel-header">\n                  <h3>Shortcuts</h3>\n                  <p>Keyboard shortcuts to move faster inside Joanium. All shortcuts are active by default &#8212; no setup needed. On macOS, swap Ctrl for &#8984; Cmd.</p>\n                </div>\n                <div class="shortcuts-panel">\n                  <div class="shortcuts-group">\n                    <h4 class="shortcuts-group-title">Navigation</h4>\n                    <div class="shortcuts-list">\n                      <div class="shortcut-row"><span class="shortcut-desc">New chat</span><span class="shortcut-keys"><kbd>Ctrl</kbd><kbd>N</kbd></span></div>\n                      <div class="shortcut-row"><span class="shortcut-desc">Go to Projects</span><span class="shortcut-keys"><kbd>Ctrl</kbd><kbd>P</kbd></span></div>\n                      <div class="shortcut-row"><span class="shortcut-desc">Open Settings</span><span class="shortcut-keys"><kbd>Ctrl</kbd><kbd>,</kbd></span></div>\n                                       </div>\n                  </div>\n                  <div class="shortcuts-group">\n                    <h4 class="shortcuts-group-title">Chat</h4>\n                    <div class="shortcuts-list">\n                      <div class="shortcut-row"><span class="shortcut-desc">Send message</span><span class="shortcut-keys"><kbd>Ctrl</kbd><kbd>Enter</kbd></span></div>\n                      <div class="shortcut-row"><span class="shortcut-desc">New line in message</span><span class="shortcut-keys"><kbd>Shift</kbd><kbd>Enter</kbd></span></div>\n                      <div class="shortcut-row"><span class="shortcut-desc">Focus message input</span><span class="shortcut-keys"><kbd>Ctrl</kbd><kbd>L</kbd></span></div>\n                                     <div class="shortcut-row"><span class="shortcut-desc">Close chat / dismiss dialog</span><span class="shortcut-keys"><kbd>Esc</kbd></span></div>\n                    </div>\n                  </div>\n                  <div class="shortcuts-group">\n                    <h4 class="shortcuts-group-title">Workspace</h4>\n                    <div class="shortcuts-list">\n                                        <div class="shortcut-row"><span class="shortcut-desc">Open Agents</span><span class="shortcut-keys"><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>A</kbd></span></div>\n                              <div class="shortcut-row"><span class="shortcut-desc">Open Marketplace</span><span class="shortcut-keys"><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>M</kbd></span></div>\n           <div class="shortcut-row"><span class="shortcut-desc">Open Skills</span><span class="shortcut-keys"><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>S</kbd></span></div>\n                           <div class="shortcut-row"><span class="shortcut-desc">Open Personas</span><span class="shortcut-keys"><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>P</kbd></span></div>\n           <div class="shortcut-row"><span class="shortcut-desc">Open Automations</span><span class="shortcut-keys"><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>U</kbd></span></div>\n                                         </div>\n                  </div>\n                  <p class="shortcuts-note">On macOS, Ctrl maps to &#8984;</p>\n                </div>\n              </section>\n            </div>\n          </div>\n        </div>\n\n        <div class="settings-modal-footer">\n          <div id="settings-save-feedback" class="settings-feedback" aria-live="polite"></div>\n          <button id="settings-save" class="settings-save-btn" type="button">Save changes</button>\n        </div>\n      </div>\n    </div>\n  ',
      closeBtnSelector: '#settings-modal-close',
      onInit(backdrop) {
        ($$('[data-settings-tab]').forEach((btn) => {
          btn.addEventListener('click', () => {
            (switchTab(btn.dataset.settingsTab), focusActiveTab());
          });
        }),
          $('settings-save')?.addEventListener('click', () => {
            ('user' === ss.activeTab && saveUserTab(),
              'providers' === ss.activeTab && saveProvidersTab());
          }),
          document.addEventListener('keydown', (e) => {
            (e.ctrlKey || e.metaKey) &&
              's' === e.key.toLowerCase() &&
              modal.isOpen() &&
              (e.preventDefault(),
              'user' === ss.activeTab && saveUserTab(),
              'providers' === ss.activeTab && saveProvidersTab());
          }),
          initAppSettingsTab());
      },
    });
  function setFeedback(msg = '', tone = 'info') {
    const el = $('settings-save-feedback');
    el &&
      ((el.textContent = msg),
      (el.className = msg ? `settings-feedback ${tone}` : 'settings-feedback'));
  }
  function updateSaveButton() {
    const btn = $('settings-save');
    if (btn) {
      if ('user' === ss.activeTab)
        return ((btn.textContent = 'Save changes'), void (btn.disabled = !1));
      if ('providers' === ss.activeTab)
        return (
          (btn.textContent = 'Save provider changes'),
          void (btn.disabled = !(
            ss.pendingDeletes.size > 0 ||
            Object.values(ss.pendingProviderConfigs).some(providerHasDraftChanges)
          ))
        );
      ((btn.textContent = 'No changes to save'), (btn.disabled = !0));
    }
  }
  /** Reveal only the settings rows the current OS supports and wire toggle changes. */
  function initAppSettingsTab() {
    const platform = window.electronAPI?.platform ?? 'linux';
    // run_on_startup: shown on Windows and macOS; Linux has no openAsHidden support.
    if (platform === 'win32' || platform === 'darwin')
      $('app-setting-startup')?.removeAttribute('hidden');
    // system_tray: shown on Windows and Linux; macOS keeps app alive via Dock convention.
    if (platform === 'win32' || platform === 'linux')
      $('app-setting-tray')?.removeAttribute('hidden');
    // keep_awake: shown on all platforms (powerSaveBlocker works everywhere).
    // (#app-setting-awake is already visible by default in HTML.)

    // Wire toggles — save immediately on change so no "Save" button needed.
    const wire = (inputId, key) => {
      const input = $(inputId);
      if (!input) return;
      input.addEventListener('change', async () => {
        try {
          await window.electronAPI?.invoke('set-app-settings', { [key]: input.checked });
        } catch (err) {
          console.warn('[AppSettings] Failed to save', key, err);
          input.checked = !input.checked; // revert on error
        }
      });
    };
    wire('app-toggle-startup', 'run_on_startup');
    wire('app-toggle-tray', 'system_tray');
    wire('app-toggle-awake', 'keep_awake');

    // Reset App button
    const resetBtn = $('app-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', async () => {
        const confirmed = await openConfirm({
          title: 'Reset Joanium?',
          body: 'This will permanently delete all chats, events, API keys, memory, and settings. This cannot be undone.',
          confirmText: 'Yes, reset everything',
          cancelText: 'Cancel',
          variant: 'danger',
        });
        if (!confirmed) return;
        resetBtn.disabled = true;
        resetBtn.textContent = 'Resetting…';
        try {
          await window.electronAPI?.invoke('reset-app');
        } catch (err) {
          console.error('[ResetApp] Failed:', err);
          resetBtn.disabled = false;
          resetBtn.textContent = 'Reset App';
        }
      });
    }
  }
  /** Load and apply saved app settings into the toggle inputs. */
  async function loadAppSettings() {
    try {
      const settings = await window.electronAPI?.invoke('get-app-settings');
      if (!settings) return;
      const startup = $('app-toggle-startup'),
        tray = $('app-toggle-tray'),
        awake = $('app-toggle-awake');
      if (startup) startup.checked = Boolean(settings.run_on_startup);
      if (tray) tray.checked = Boolean(settings.system_tray);
      if (awake) awake.checked = Boolean(settings.keep_awake);
    } catch (err) {
      console.warn('[AppSettings] Failed to load app settings:', err);
    }
  }
  function switchTab(tabId) {
    ((ss.activeTab = tabId),
      $$('[data-settings-tab]').forEach((b) => {
        const active = b.dataset.settingsTab === tabId;
        (b.classList.toggle('active', active), b.setAttribute('aria-selected', String(active)));
      }),
      $$('[data-settings-panel]').forEach((p) => {
        const active = p.dataset.settingsPanel === tabId;
        (p.classList.toggle('active', active), (p.hidden = !active));
      }),
      setFeedback(),
      updateSaveButton(),
      'connectors' === tabId && loadConnectorsPanel(),
      'mcp' === tabId && loadMCPPanel(),
      'channels' === tabId && loadChannelsPanel(),
      'app' === tabId && loadAppSettings());
  }
  function focusActiveTab() {
    'providers' !== ss.activeTab
      ? 'mcp' !== ss.activeTab
        ? 'shortcuts' !== ss.activeTab &&
          'user' === ss.activeTab &&
          $('settings-user-name')?.focus()
        : $('mcp-add-btn')?.focus()
      : $('settings-providers-list')?.querySelector('input')?.focus();
  }
  function applyUserProfile(user = {}) {
    const rawName = String(user?.name ?? '').trim(),
      displayName = rawName || 'User',
      firstName = displayName.split(/\s+/)[0];
    ((state.userName = rawName),
      (state.userInitials = (function (name) {
        const parts = String(name ?? '')
          .trim()
          .split(/\s+/)
          .filter(Boolean);
        return parts.length >= 2
          ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
          : (parts[0] ?? 'JO').slice(0, 2).toUpperCase();
      })(displayName)));
    const wt = document.querySelector('.welcome-title');
    (wt && (wt.textContent = rawName ? `Welcome, ${firstName}` : 'Welcome'),
      window.dispatchEvent(
        new CustomEvent('ow:user-profile-updated', {
          detail: { name: displayName, initials: state.userInitials },
        }),
      ));
  }
  function renderProviders(focusState = null) {
    const list = $('settings-providers-list');
    if (!list) return;
    const catalog = (function (catalog, ss) {
      return [...catalog].sort((l, r) => {
        const lc = Number(isProviderConfigured(l) || ss.pendingDeletes.has(l.provider)),
          rc = Number(isProviderConfigured(r) || ss.pendingDeletes.has(r.provider));
        return lc !== rc
          ? rc - lc
          : (PROVIDER_ORDER.get(l.provider) ?? Number.MAX_SAFE_INTEGER) -
              (PROVIDER_ORDER.get(r.provider) ?? Number.MAX_SAFE_INTEGER);
      });
    })(ss.providerCatalog, ss);
    if (!catalog.length)
      return (
        (list.innerHTML = '<div class="settings-empty-card">No providers available.</div>'),
        void updateSaveButton()
      );
    ((list.innerHTML = ''),
      catalog.forEach((r) => {
        const def = getProviderDefinition(r.provider);
        if (!def) return;
        const savedConfig = getSavedProviderConfig(r),
          pendingConfig = ss.pendingProviderConfigs[r.provider] ?? {},
          effectiveConfig = getEffectiveProviderConfig(r, pendingConfig),
          isDeleting = ss.pendingDeletes.has(r.provider),
          hasDraft = providerHasDraftChanges(pendingConfig),
          hasAnyConfig = isProviderConfigured(r) || hasDraft,
          status = (function (r, config, isDeleting, hasDraft) {
            return isDeleting
              ? { tone: 'removing', label: 'Removing' }
              : providerIsComplete(r, config)
                ? {
                    tone: isProviderConfigured(r) ? 'active' : 'draft',
                    label: isProviderConfigured(r) ? 'Connected' : 'Ready to save',
                  }
                : hasDraft
                  ? { tone: 'incomplete', label: 'Needs required fields' }
                  : { tone: 'inactive', label: 'Not connected' };
          })(r, effectiveConfig, isDeleting, hasDraft),
          row = document.createElement('div');
        ((row.className = `spr-row${'active' === status.tone ? ' spr-row--active' : ''}${isDeleting ? ' spr-row--deleting' : ''}`),
          row.style.setProperty('--p-color', def.color));
        const main = document.createElement('div');
        main.className = 'spr-main';
        const summary = document.createElement('div');
        summary.className = 'spr-summary';
        const icon = document.createElement('div');
        ((icon.className = 'spr-icon'),
          (icon.innerHTML = `<img class="spr-icon-img" src="${def.iconPath || 'data:,'}" alt="" /><span class="spr-icon-fallback">${def.fallback}</span>`),
          def.iconPath || icon.classList.add('icon-missing'));
        const img = icon.querySelector('.spr-icon-img');
        (img?.addEventListener('error', () => icon.classList.add('icon-missing')),
          img?.addEventListener('load', () => icon.classList.remove('icon-missing')));
        const info = document.createElement('div');
        ((info.className = 'spr-info'),
          (info.innerHTML = `<div class="spr-provider-name">${r.label ?? def.label}</div><div class="spr-provider-copy">${def.company || def.caption}</div>`));
        const badge = document.createElement('span');
        ((badge.className = `spr-status spr-status--${status.tone}`),
          (badge.textContent = status.label),
          summary.append(icon, info, badge));
        const fields = document.createElement('div');
        if (
          ((fields.className = 'spr-fields' + (def.fields.length > 1 ? ' spr-fields--multi' : '')),
          def.fields.forEach((f) =>
            fields.appendChild(
              (function (r, field, savedConfig, effectiveConfig, disabled) {
                const wrapper = document.createElement('label');
                wrapper.className = 'spr-field';
                const label = document.createElement('span');
                ((label.className = 'spr-field-label'), (label.textContent = field.label));
                const inputWrap = document.createElement('div');
                inputWrap.className = 'key-input-wrap spr-key-wrap';
                const input = document.createElement('input');
                if (
                  ((input.className = 'key-input spr-key-input'),
                  (input.type = 'password' === field.type ? 'password' : 'text'),
                  (input.placeholder =
                    'password' === field.type && savedConfig.apiKey
                      ? '••••••••  (saved)'
                      : field.placeholder),
                  (input.autocomplete = 'off'),
                  (input.spellcheck = !1),
                  (input.disabled = disabled),
                  (input.dataset.providerId = r.provider),
                  (input.dataset.fieldKey = field.key),
                  (input.value =
                    'password' === field.type
                      ? String(ss.pendingProviderConfigs[r.provider]?.[field.key] ?? '')
                      : String(effectiveConfig[field.key] ?? '')),
                  input.addEventListener('input', () => {
                    const focusState = (function () {
                        const list = $('settings-providers-list'),
                          active = document.activeElement;
                        return active instanceof HTMLInputElement && list?.contains(active)
                          ? {
                              providerId: active.dataset.providerId ?? '',
                              fieldKey: active.dataset.fieldKey ?? '',
                              selectionStart: active.selectionStart,
                              selectionEnd: active.selectionEnd,
                              selectionDirection: active.selectionDirection,
                            }
                          : null;
                      })(),
                      pending = { ...(ss.pendingProviderConfigs[r.provider] ?? {}) },
                      trimmed = input.value.trim();
                    ('password' === field.type && !trimmed && savedConfig.apiKey
                      ? delete pending[field.key]
                      : (pending[field.key] = input.value),
                      Object.keys(pending).length > 0
                        ? (ss.pendingProviderConfigs[r.provider] = pending)
                        : delete ss.pendingProviderConfigs[r.provider],
                      trimmed && ss.pendingDeletes.delete(r.provider),
                      renderProviders(focusState));
                  }),
                  inputWrap.appendChild(input),
                  'password' === field.type)
                ) {
                  const eye = document.createElement('button');
                  ((eye.type = 'button'),
                    (eye.className = 'key-eye'),
                    (eye.title = 'Show or hide'),
                    (eye.innerHTML =
                      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke-width="1.8"/><circle cx="12" cy="12" r="3" stroke-width="1.8"/></svg>'),
                    (eye.disabled = disabled),
                    eye.addEventListener('click', () => {
                      input.type = 'password' === input.type ? 'text' : 'password';
                    }),
                    inputWrap.appendChild(eye));
                }
                return (wrapper.append(label, inputWrap), wrapper);
              })(r, f, savedConfig, effectiveConfig, isDeleting),
            ),
          ),
          main.append(summary, fields),
          def.hint)
        ) {
          const h = document.createElement('p');
          ((h.className = 'spr-hint'), (h.textContent = def.hint), main.appendChild(h));
        }
        const actions = document.createElement('div');
        actions.className = 'spr-actions';
        const delBtn = document.createElement('button');
        ((delBtn.type = 'button'),
          (delBtn.className = isDeleting ? 'spr-undo-btn' : 'spr-delete-btn'),
          (delBtn.title = isDeleting ? 'Undo removal' : 'Remove configuration'),
          (delBtn.hidden = !isDeleting && !hasAnyConfig),
          (delBtn.innerHTML = isDeleting
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 14l-4-4 4-4M5 10h11a4 4 0 010 8h-1" stroke-linecap="round" stroke-linejoin="round"/></svg> Undo'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke-linecap="round" stroke-linejoin="round"/></svg>'),
          delBtn.addEventListener('click', () => {
            (isDeleting
              ? ss.pendingDeletes.delete(r.provider)
              : (ss.pendingDeletes.add(r.provider), delete ss.pendingProviderConfigs[r.provider]),
              renderProviders());
          }),
          actions.appendChild(delBtn),
          row.append(main, actions),
          list.appendChild(row));
      }),
      updateSaveButton(),
      (function (focusState) {
        focusState?.providerId &&
          focusState?.fieldKey &&
          requestAnimationFrame(() => {
            const list = $('settings-providers-list');
            if (!list) return;
            const nextInput = Array.from(
              list.querySelectorAll('input[data-provider-id][data-field-key]'),
            ).find(
              (input) =>
                input.dataset.providerId === focusState.providerId &&
                input.dataset.fieldKey === focusState.fieldKey,
            );
            if (
              nextInput &&
              !nextInput.disabled &&
              (nextInput.focus(),
              'number' == typeof focusState.selectionStart &&
                'number' == typeof focusState.selectionEnd &&
                'function' == typeof nextInput.setSelectionRange)
            )
              try {
                nextInput.setSelectionRange(
                  focusState.selectionStart,
                  focusState.selectionEnd,
                  focusState.selectionDirection ?? 'none',
                );
              } catch {}
          });
      })(focusState));
  }
  async function saveUserTab() {
    const nextName = $('settings-user-name')?.value.trim() ?? '',
      nextMemory = $('settings-memory')?.value ?? '',
      nextInstructions = $('settings-custom-instructions')?.value ?? '';
    if (nextName.length < 2)
      return (
        setFeedback('Enter a name with at least 2 characters.', 'error'),
        void $('settings-user-name')?.focus()
      );
    (($('settings-save').disabled = !0), setFeedback('Saving...', 'info'));
    try {
      const [profileResult, instructionsResult, memoryResult] = await Promise.all([
        window.electronAPI?.invoke('save-user-profile', { name: nextName }),
        window.electronAPI?.invoke('save-custom-instructions', nextInstructions),
        window.electronAPI?.invoke('save-memory', nextMemory),
      ]);
      if (!profileResult?.ok) throw new Error(profileResult?.error ?? 'Could not save profile.');
      if (!instructionsResult?.ok)
        throw new Error(instructionsResult?.error ?? 'Could not save custom instructions.');
      if (!memoryResult?.ok) throw new Error(memoryResult?.error ?? 'Could not save memory.');
      (applyUserProfile(profileResult.user ?? { name: nextName }),
        setFeedback('Changes saved.', 'success'),
        window.dispatchEvent(new CustomEvent('ow:settings-saved')));
    } catch (err) {
      setFeedback(err.message || 'Could not save.', 'error');
    } finally {
      updateSaveButton();
    }
  }
  async function saveProvidersTab() {
    const changes = {};
    for (const r of ss.providerCatalog) {
      const pid = r.provider;
      if (ss.pendingDeletes.has(pid)) {
        changes[pid] = null;
        continue;
      }
      const pendingConfig = ss.pendingProviderConfigs[pid];
      if (!providerHasDraftChanges(pendingConfig)) continue;
      const effectiveConfig = getEffectiveProviderConfig(r, pendingConfig);
      if (!providerIsComplete(r, effectiveConfig))
        return (
          setFeedback(`Finish the required fields for ${r.label ?? pid}.`, 'error'),
          void renderProviders()
        );
      const def = getProviderDefinition(pid),
        savedConfig = getSavedProviderConfig(r),
        payload = {};
      (def.fields.forEach((f) => {
        const pv = pendingConfig[f.key];
        null == pv
          ? !savedConfig[f.key] &&
            effectiveConfig[f.key] &&
            (payload[f.key] = String(effectiveConfig[f.key]).trim())
          : (payload[f.key] = String(pv).trim());
      }),
        Object.keys(payload).length > 0 && (changes[pid] = payload));
    }
    if (Object.keys(changes).length) {
      (($('settings-save').disabled = !0), setFeedback('Saving provider settings...', 'info'));
      try {
        const result = await window.electronAPI?.invoke('save-provider-configs', changes);
        if (!result?.ok) throw new Error(result?.error ?? 'Could not save provider settings.');
        const allProviders = (await window.electronAPI?.invoke('get-models')) ?? [];
        ((state.allProviders = allProviders),
          (state.providers = allProviders.filter((p) => p.configured)),
          (ss.providerCatalog = buildProviderCatalog(allProviders)),
          (ss.pendingProviderConfigs = {}),
          ss.pendingDeletes.clear(),
          renderProviders());
        const savedCount = Object.values(changes).filter((v) => null !== v).length,
          removedCount = Object.values(changes).filter((v) => null === v).length,
          parts = [];
        (savedCount && parts.push(`${savedCount} provider${1 !== savedCount ? 's' : ''} saved`),
          removedCount &&
            parts.push(`${removedCount} provider${1 !== removedCount ? 's' : ''} removed`),
          setFeedback(`${parts.join(', ')}.`, 'success'),
          window.dispatchEvent(new CustomEvent('ow:settings-saved')));
      } catch (err) {
        setFeedback(err.message || 'Could not save.', 'error');
      } finally {
        updateSaveButton();
      }
    } else setFeedback('No provider changes to save.', 'error');
  }
  return {
    open: async function (tabId = ss.activeTab) {
      (switchTab(tabId), modal.open());
      if (tabId === 'app') loadAppSettings();
      try {
        await (async function () {
          (setFeedback(), ss.pendingDeletes.clear(), (ss.pendingProviderConfigs = {}));
          const [user, customInstructions, memory, providers] = await Promise.all([
            window.electronAPI?.invoke('get-user'),
            window.electronAPI?.invoke('get-custom-instructions'),
            window.electronAPI?.invoke('get-memory'),
            window.electronAPI?.invoke('get-models'),
          ]);
          (applyUserProfile(user ?? {}),
            (ss.providerCatalog = buildProviderCatalog(providers)),
            $('settings-user-name') && ($('settings-user-name').value = user?.name ?? ''),
            $('settings-memory') && ($('settings-memory').value = memory ?? ''),
            $('settings-custom-instructions') &&
              ($('settings-custom-instructions').value = customInstructions ?? ''),
            renderProviders(),
            updateSaveButton());
        })();
      } catch (err) {
        setFeedback('Could not load settings.', 'error');
      }
      requestAnimationFrame(() => focusActiveTab());
    },
    close: modal.close,
    loadUser: async function () {
      try {
        const user = await window.electronAPI?.invoke('get-user');
        return (applyUserProfile(user ?? {}), user);
      } catch {
        return (applyUserProfile({}), null);
      }
    },
  };
}
