import { state } from '../System/State.js';
import { createModal } from '../System/ModalFactory.js';
import { t, setLanguage, applyI18n } from '../System/I18n/index.js';
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
      html: `
    <div id="settings-modal-backdrop">
      <div id="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
        <div class="settings-modal-header">
          <div class="settings-modal-copy">
            <h2 id="settings-modal-title" data-i18n="settings.title">Workspace settings</h2>
          </div>
          <button id="settings-modal-close" class="settings-modal-close" type="button" data-i18n-label="settings.closeLabel" aria-label="Close settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>
            </svg>
          </button>
        </div>

        <div class="settings-modal-body">
          <div class="settings-shell">
            <nav class="settings-tabs" aria-label="Settings sections">
              <button class="settings-tab active" type="button" data-settings-tab="user" data-i18n="settings.userTab">User</button>
              <button class="settings-tab" type="button" data-settings-tab="providers" data-i18n="settings.providersTab">AI Providers</button>
              <button class="settings-tab" type="button" data-settings-tab="connectors" data-i18n="settings.connectorsTab">Connectors</button>
              <button class="settings-tab" type="button" data-settings-tab="channels" data-i18n="settings.channelsTab">Channels</button>
              <button class="settings-tab" type="button" data-settings-tab="mcp" data-i18n="settings.mcpTab">MCP Servers</button>
              <button class="settings-tab" type="button" data-settings-tab="shortcuts" data-i18n="settings.shortcutsTab">Shortcuts</button>
              <button class="settings-tab" type="button" data-settings-tab="app" data-i18n="settings.appTab">App</button>
            </nav>

            <div class="settings-content">
              <section class="settings-panel active" data-settings-panel="user">
                <div class="settings-panel-header">
                  <h3 data-i18n="settings.userPanelTitle">User</h3>
                  <p data-i18n="settings.userPanelDesc">Update your display name, pinned memory note, and custom instructions.</p>
                </div>
                <div class="settings-form">
                  <label class="settings-field">
                    <span class="settings-field-label" data-i18n="settings.nameLabel">Name</span>
                    <input id="settings-user-name" type="text" maxlength="80" data-i18n-placeholder="settings.namePlaceholder" placeholder="Your name" autocomplete="name"/>
                  </label>
                  <label class="settings-field">
                    <span class="settings-field-label" data-i18n="settings.memoryLabel">Pinned Memory</span>
                    <textarea id="settings-memory" data-i18n-placeholder="settings.memoryPlaceholder" placeholder="Durable personal notes the AI can read when your conversation needs them."></textarea>
                  </label>
                  <label class="settings-field">
                    <span class="settings-field-label" data-i18n="settings.instructionsLabel">Custom Instructions</span>
                    <textarea id="settings-custom-instructions" data-i18n-placeholder="settings.instructionsPlaceholder" placeholder="Tone, style, or behaviour instructions for the AI."></textarea>
                  </label>
                </div>
              </section>

              <section class="settings-panel" data-settings-panel="providers" hidden>
                <div class="settings-panel-header">
                  <h3 data-i18n="settings.providersPanelTitle">AI Providers</h3>
                  <p data-i18n="settings.providersPanelDesc">Connect hosted models with API keys or point Joanium at local Ollama or LM Studio servers.</p>
                </div>
                <div id="settings-providers-list" class="providers-stack">
                  <div class="ap-empty-hint" data-i18n="chat.loading">Loading...</div>
                </div>
              </section>

              <section class="settings-panel" data-settings-panel="connectors" hidden>
                <div class="settings-panel-header">
                  <h3 data-i18n="settings.connectorsPanelTitle">Connectors</h3>
                  <p data-i18n="settings.connectorsPanelDesc">Link your workspace so the AI knows about your emails, repos and files, and automations can take action.</p>
                </div>
                <div id="connector-list" class="connector-list">
                  <div class="cx-loading" data-i18n="chat.loading">Loading connectors...</div>
                </div>
              </section>

              <section class="settings-panel" data-settings-panel="mcp" hidden>
                <div class="settings-panel-header">
                  <h3 data-i18n="settings.mcpPanelTitle">MCP Servers</h3>
                  <p data-i18n="settings.mcpPanelDesc">Connect Model Context Protocol servers here.</p>
                </div>
                <div id="mcp-settings-panel" class="mcp-settings-panel">
                  <div class="cx-loading" data-i18n="chat.loading">Loading MCP servers...</div>
                </div>
              </section>

              <section class="settings-panel" data-settings-panel="channels" hidden>
                <div class="settings-panel-header">
                  <h3 data-i18n="settings.channelsPanelTitle">Channels</h3>
                  <p data-i18n="settings.channelsPanelDesc">Connect WhatsApp and Telegram. When someone messages in, the AI replies automatically on your behalf.</p>
                </div>
                <div id="channels-settings-panel" class="channels-settings-panel">
                  <div class="cx-loading" data-i18n="chat.loading">Loading channels...</div>
                </div>
              </section>

              <section class="settings-panel" data-settings-panel="app" hidden>
                <div class="settings-panel-header">
                  <h3 data-i18n="settings.appPanelTitle">App</h3>
                  <p data-i18n="settings.appPanelDesc">System-level behaviour for Joanium.</p>
                </div>
                <div class="settings-form" id="app-settings-form">
                  <div class="settings-toggle-row" id="app-setting-startup" hidden>
                    <div class="settings-toggle-info">
                      <span class="settings-field-label" data-i18n="settings.startup">Run on Startup</span>
                      <span class="settings-field-hint" data-i18n="settings.startupHint">Launch Joanium automatically when you log in.</span>
                    </div>
                    <label class="settings-toggle" data-i18n-label="settings.startup" aria-label="Run on startup">
                      <input id="app-toggle-startup" type="checkbox" />
                      <span class="settings-toggle-track"><span class="settings-toggle-thumb"></span></span>
                    </label>
                  </div>
                  <div class="settings-toggle-row" id="app-setting-tray" hidden>
                    <div class="settings-toggle-info">
                      <span class="settings-field-label" data-i18n="settings.tray">System Tray</span>
                      <span class="settings-field-hint" data-i18n="settings.trayHint">Keep Joanium in the system tray when the window is closed.</span>
                    </div>
                    <label class="settings-toggle" data-i18n-label="settings.tray" aria-label="System tray">
                      <input id="app-toggle-tray" type="checkbox" />
                      <span class="settings-toggle-track"><span class="settings-toggle-thumb"></span></span>
                    </label>
                  </div>
                  <div class="settings-toggle-row" id="app-setting-awake">
                    <div class="settings-toggle-info">
                      <span class="settings-field-label" data-i18n="settings.keepAwake">Keep Awake</span>
                      <span class="settings-field-hint" data-i18n="settings.keepAwakeHint">Prevent the system from sleeping while Joanium is running.</span>
                    </div>
                    <label class="settings-toggle" data-i18n-label="settings.keepAwake" aria-label="Keep awake">
                      <input id="app-toggle-awake" type="checkbox" />
                      <span class="settings-toggle-track"><span class="settings-toggle-thumb"></span></span>
                    </label>
                  </div>
                  <div class="settings-toggle-row" id="app-setting-lock">
                    <div class="settings-toggle-info">
                      <span class="settings-field-label" data-i18n="settings.appLock">App Lock</span>
                      <span class="settings-field-hint" data-i18n="settings.appLockHint">Require a password every time Joanium opens.</span>
                    </div>
                    <label class="settings-toggle" data-i18n-label="settings.appLock" aria-label="App lock">
                      <input id="app-toggle-lock" type="checkbox" />
                      <span class="settings-toggle-track"><span class="settings-toggle-thumb"></span></span>
                    </label>
                  </div>

                  <div class="settings-field-row" id="app-setting-language">
                    <div class="settings-toggle-info">
                      <span class="settings-field-label" data-i18n="settings.appLanguage">App Language</span>
                      <span class="settings-field-hint" data-i18n="settings.appLanguageHint">Language used across the app and by the AI when responding to you.</span>
                    </div>
                    <select id="app-language-select" class="settings-select" data-i18n-label="settings.appLanguage" aria-label="App language">
                      <option value="en">English</option>
                      <option value="de">Deutsch (German)</option>
                    </select>
                  </div>

                  <div class="settings-danger-zone">
                    <div class="settings-danger-zone-header">
                      <span class="settings-danger-zone-label" data-i18n="settings.dangerZone">Danger Zone</span>
                    </div>
                    <div class="settings-danger-row">
                      <div class="settings-toggle-info">
                        <span class="settings-field-label" data-i18n="settings.resetApp">Reset App</span>
                        <span class="settings-field-hint" data-i18n="settings.resetAppHint">Permanently clears all chats, events, API keys, memory, and settings.</span>
                        <span class="settings-danger-warning" data-i18n="settings.resetAppWarning">This action is destructive and irreversible.</span>
                      </div>
                      <button id="app-reset-btn" class="settings-reset-btn" type="button" data-i18n="settings.resetApp">Reset App</button>
                    </div>
                  </div>
                </div>
              </section>

              <section class="settings-panel" data-settings-panel="shortcuts" hidden>
                <div class="settings-panel-header">
                  <h3 data-i18n="settings.shortcutsPanelTitle">Shortcuts</h3>
                  <p data-i18n="settings.shortcutsPanelDesc">Keyboard shortcuts to move faster inside Joanium. All shortcuts are active by default &#8212; no setup needed. On macOS, swap Ctrl for &#8984; Cmd.</p>
                </div>
                <div class="shortcuts-panel">
                  <div class="shortcuts-group">
                    <h4 class="shortcuts-group-title" data-i18n="settings.navGroup">Navigation</h4>
                    <div class="shortcuts-list">
                      <div class="shortcut-row"><span class="shortcut-desc" data-i18n="sidebar.newChat">New chat</span><span class="shortcut-keys"><kbd>Ctrl</kbd><kbd>N</kbd></span></div>
                      <div class="shortcut-row"><span class="shortcut-desc" data-i18n="settings.goProjects">Go to Projects</span><span class="shortcut-keys"><kbd>Ctrl</kbd><kbd>P</kbd></span></div>
                      <div class="shortcut-row"><span class="shortcut-desc" data-i18n="settings.openSettings">Open Settings</span><span class="shortcut-keys"><kbd>Ctrl</kbd><kbd>,</kbd></span></div>
                    </div>
                  </div>
                  <div class="shortcuts-group">
                    <h4 class="shortcuts-group-title" data-i18n="settings.chatGroup">Chat</h4>
                    <div class="shortcuts-list">
                      <div class="shortcut-row"><span class="shortcut-desc" data-i18n="settings.sendMessage">Send message</span><span class="shortcut-keys"><kbd>Ctrl</kbd><kbd>Enter</kbd></span></div>
                      <div class="shortcut-row"><span class="shortcut-desc" data-i18n="settings.newLine">New line in message</span><span class="shortcut-keys"><kbd>Shift</kbd><kbd>Enter</kbd></span></div>
                      <div class="shortcut-row"><span class="shortcut-desc" data-i18n="settings.focusInput">Focus message input</span><span class="shortcut-keys"><kbd>Ctrl</kbd><kbd>L</kbd></span></div>
                      <div class="shortcut-row"><span class="shortcut-desc" data-i18n="settings.closeChat">Close chat / dismiss dialog</span><span class="shortcut-keys"><kbd>Esc</kbd></span></div>
                    </div>
                  </div>
                  <div class="shortcuts-group">
                    <h4 class="shortcuts-group-title" data-i18n="settings.workspaceGroup">Workspace</h4>
                    <div class="shortcuts-list">
                      <div class="shortcut-row"><span class="shortcut-desc" data-i18n="settings.openAgents">Open Agents</span><span class="shortcut-keys"><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>A</kbd></span></div>
                      <div class="shortcut-row"><span class="shortcut-desc" data-i18n="settings.openMarketplace">Open Marketplace</span><span class="shortcut-keys"><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>M</kbd></span></div>
                      <div class="shortcut-row"><span class="shortcut-desc" data-i18n="settings.openSkills">Open Skills</span><span class="shortcut-keys"><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>S</kbd></span></div>
                      <div class="shortcut-row"><span class="shortcut-desc" data-i18n="settings.openPersonas">Open Personas</span><span class="shortcut-keys"><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>P</kbd></span></div>
                      <div class="shortcut-row"><span class="shortcut-desc" data-i18n="settings.openAutomations">Open Automations</span><span class="shortcut-keys"><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>U</kbd></span></div>
                    </div>
                  </div>
                  <p class="shortcuts-note" data-i18n="settings.shortcutsNote">On macOS, Ctrl maps to &#8984;</p>
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
  `,
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
          initAppSettingsTab(),
          // Re-apply translations whenever the user switches language
          window.addEventListener('ow:language-changed', () => {
            applyI18n(backdrop);
            updateSaveButton();
          }));
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
        return ((btn.textContent = t('settings.saveChanges')), void (btn.disabled = !1));
      if ('providers' === ss.activeTab)
        return (
          (btn.textContent = t('settings.saveProviderChanges')),
          void (btn.disabled = !(
            ss.pendingDeletes.size > 0 ||
            Object.values(ss.pendingProviderConfigs).some(providerHasDraftChanges)
          ))
        );
      ((btn.textContent = t('settings.noChanges')), (btn.disabled = !0));
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

    // Language selector — save immediately on change
    const langSelect = $('app-language-select');
    if (langSelect) {
      langSelect.addEventListener('change', async () => {
        try {
          await window.electronAPI?.invoke('set-app-settings', { app_language: langSelect.value });
          // Update the in-process i18n module and broadcast ow:language-changed
          setLanguage(langSelect.value);
        } catch (err) {
          console.warn('[AppSettings] Failed to save app_language', err);
          // Revert to the saved value on failure
          try {
            const s = await window.electronAPI?.invoke('get-app-settings');
            if (s?.app_language) langSelect.value = s.app_language;
          } catch {}
        }
      });
    }

    // App Lock — intercept toggle to run setup/disable flows
    (function () {
      const lockInput = $('app-toggle-lock');
      if (!lockInput) return;
      lockInput.addEventListener('change', async () => {
        if (lockInput.checked) {
          lockInput.checked = false; // revert until setup completes
          const ok = await showAppLockSetup();
          lockInput.checked = ok;
        } else {
          const ok = await showAppLockDisable();
          if (!ok) lockInput.checked = true; // revert on cancel/fail
        }
      });
    })();

    // Reset App button
    const resetBtn = $('app-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', async () => {
        const confirmed = await openConfirm({
          title: t('settings.resetTitle'),
          body: t('settings.resetBody'),
          confirmText: t('settings.resetConfirm'),
          cancelText: t('settings.resetCancel'),
          variant: 'danger',
        });
        if (!confirmed) return;
        resetBtn.disabled = true;
        resetBtn.textContent = t('settings.resetting');
        try {
          await window.electronAPI?.invoke('reset-app');
        } catch (err) {
          console.error('[ResetApp] Failed:', err);
          resetBtn.disabled = false;
          resetBtn.textContent = t('settings.resetApp');
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
      const lock = $('app-toggle-lock');
      if (lock) lock.checked = Boolean(settings.app_lock);
      const lang = $('app-language-select');
      if (lang) lang.value = settings.app_language ?? 'en';
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
    (wt && (wt.textContent = rawName ? `${t('chat.welcome')}, ${firstName}` : t('chat.welcome')),
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
              ? { tone: 'removing', label: t('provider.removing') }
              : providerIsComplete(r, config)
                ? {
                    tone: isProviderConfigured(r) ? 'active' : 'draft',
                    label: isProviderConfigured(r) ? t('provider.connected') : t('provider.draft'),
                  }
                : hasDraft
                  ? { tone: 'incomplete', label: t('provider.incomplete') }
                  : { tone: 'inactive', label: t('provider.inactive') };
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
                      ? t('provider.keySaved')
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
          (delBtn.title = isDeleting ? t('provider.undoRemoval') : t('provider.removeConfig')),
          (delBtn.hidden = !isDeleting && !hasAnyConfig),
          (delBtn.innerHTML = isDeleting
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 14l-4-4 4-4M5 10h11a4 4 0 010 8h-1" stroke-linecap="round" stroke-linejoin="round"/></svg> ' +
              t('provider.undoRemoval')
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
        setFeedback(t('settings.enterNameMin'), 'error'),
        void $('settings-user-name')?.focus()
      );
    (($('settings-save').disabled = !0), setFeedback(t('settings.saving'), 'info'));
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
        setFeedback(t('settings.saved'), 'success'),
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
          setFeedback(t('settings.finishRequired', { name: r.label ?? pid }), 'error'),
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
      (($('settings-save').disabled = !0), setFeedback(t('settings.savingProviders'), 'info'));
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
        (savedCount &&
          parts.push(
            t(1 === savedCount ? 'provider.savedSingular' : 'provider.savedPlural', {
              count: savedCount,
            }),
          ),
          removedCount &&
            parts.push(
              t(1 === removedCount ? 'provider.removedSingular' : 'provider.removedPlural', {
                count: removedCount,
              }),
            ),
          setFeedback(`${parts.join(', ')}.`, 'success'),
          window.dispatchEvent(new CustomEvent('ow:settings-saved')));
      } catch (err) {
        setFeedback(err.message || 'Could not save.', 'error');
      } finally {
        updateSaveButton();
      }
    } else setFeedback(t('settings.noProviderChanges'), 'error');
  }

  function injectAppLockStyles() {
    if (document.getElementById('al-styles')) return;
    const s = document.createElement('style');
    s.id = 'al-styles';
    s.textContent = `
    .al-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px}
    .al-card{background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-xl);padding:28px 28px 24px;width:100%;max-width:400px;display:flex;flex-direction:column;gap:16px;box-shadow:var(--shadow-lg)}
    .al-card h3{margin:0;font-size:16px;font-weight:600;color:var(--text-primary)}
    .al-card .al-sub{margin:0;font-size:13px;color:var(--text-secondary);line-height:1.5}
    .al-form{display:flex;flex-direction:column;gap:12px}
    .al-input,.al-select{width:100%;padding:9px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-md);color:var(--text-primary);font-family:var(--font-ui);font-size:13px;outline:none;box-sizing:border-box;transition:border-color .15s}
    .al-input:focus,.al-select:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-glow)}
    .al-error{margin:0;font-size:12px;color:#e05555;background:rgba(224,85,85,.09);border:1px solid rgba(224,85,85,.22);border-radius:var(--radius-sm);padding:7px 10px}
    .al-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:4px}
    .al-btn-cancel{padding:8px 16px;background:transparent;border:1px solid var(--border);border-radius:var(--radius-md);color:var(--text-secondary);font-family:var(--font-ui);font-size:13px;cursor:pointer;transition:background .15s}
    .al-btn-cancel:hover{background:var(--bg-hover)}
    .al-btn-confirm{padding:8px 16px;background:var(--accent);border:none;border-radius:var(--radius-md);color:#fff;font-family:var(--font-ui);font-size:13px;font-weight:600;cursor:pointer;transition:background .15s}
    .al-btn-confirm:hover:not(:disabled){background:var(--accent-hover)}
    .al-btn-confirm:disabled{opacity:.6;cursor:not-allowed}
    .al-btn-danger{background:#c0392b}
    .al-btn-danger:hover:not(:disabled){background:#a93226}
  `;
    document.head.appendChild(s);
  }

  const APP_LOCK_MIN_PASSWORD_LENGTH = 6;
  const APP_LOCK_MIN_QUESTION_LENGTH = 10;

  function showAppLockSetup() {
    injectAppLockStyles();
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'al-overlay';
      overlay.innerHTML = `
      <div class="al-card" role="dialog" aria-modal="true">
        <h3>Set up App Lock</h3>
        <p class="al-sub">Create a password and your own recovery question for Joanium. You'll use the password every time the app opens.</p>
        <div class="al-form">
          <label class="settings-field">
            <span class="settings-field-label">New password</span>
            <input id="al-pw" type="password" class="al-input" placeholder="Min. 6 characters" autocomplete="new-password"/>
          </label>
          <label class="settings-field">
            <span class="settings-field-label">Confirm password</span>
            <input id="al-pw2" type="password" class="al-input" placeholder="Repeat password" autocomplete="new-password"/>
          </label>
          <label class="settings-field">
            <span class="settings-field-label">Recovery question</span>
            <input id="al-question" type="text" class="al-input" placeholder="Write your own question" autocomplete="off" spellcheck="false"/>
          </label>
          <label class="settings-field">
            <span class="settings-field-label">Answer</span>
            <input id="al-answer" type="text" class="al-input" placeholder="Case-insensitive" autocomplete="off" spellcheck="false"/>
          </label>
          <p id="al-err" class="al-error" hidden></p>
        </div>
        <div class="al-actions">
          <button id="al-cancel" type="button" class="al-btn-cancel">Cancel</button>
          <button id="al-confirm" type="button" class="al-btn-confirm">Enable App Lock</button>
        </div>
      </div>`;
      document.body.appendChild(overlay);

      const pw = overlay.querySelector('#al-pw');
      const pw2 = overlay.querySelector('#al-pw2');
      const qEl = overlay.querySelector('#al-question');
      const ans = overlay.querySelector('#al-answer');
      const errEl = overlay.querySelector('#al-err');
      const confirmBtn = overlay.querySelector('#al-confirm');

      function showErr(msg) {
        errEl.textContent = msg;
        errEl.hidden = false;
      }

      overlay.querySelector('#al-cancel').addEventListener('click', () => {
        overlay.remove();
        resolve(false);
      });

      confirmBtn.addEventListener('click', async () => {
        if (pw.value.length < APP_LOCK_MIN_PASSWORD_LENGTH)
          return showErr(`Password must be at least ${APP_LOCK_MIN_PASSWORD_LENGTH} characters.`);
        if (pw.value !== pw2.value) return showErr('Passwords do not match.');
        if (qEl.value.trim().length < APP_LOCK_MIN_QUESTION_LENGTH)
          return showErr(
            `Recovery question must be at least ${APP_LOCK_MIN_QUESTION_LENGTH} characters.`,
          );
        if (!ans.value.trim()) return showErr('Please enter a security answer.');
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Setting up...';
        try {
          const r = await window.electronAPI?.invoke('setup-app-lock', {
            password: pw.value,
            question: qEl.value,
            answer: ans.value,
          });
          if (!r?.ok) {
            showErr(r?.error ?? 'Setup failed.');
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Enable App Lock';
            return;
          }
          overlay.remove();
          resolve(true);
        } catch (e) {
          showErr(e.message ?? 'Setup failed.');
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Enable App Lock';
        }
      });

      pw.focus();
    });
  }

  function showAppLockDisable() {
    injectAppLockStyles();
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'al-overlay';
      overlay.innerHTML = `
      <div class="al-card" role="dialog" aria-modal="true">
        <h3>Disable App Lock</h3>
        <p class="al-sub">Enter your current App Lock password to turn it off.</p>
        <div class="al-form">
          <label class="settings-field">
            <span class="settings-field-label">Current password</span>
            <input id="al-dis-pw" type="password" class="al-input" placeholder="Current password" autocomplete="current-password"/>
          </label>
          <p id="al-dis-err" class="al-error" hidden></p>
        </div>
        <div class="al-actions">
          <button id="al-dis-cancel" type="button" class="al-btn-cancel">Cancel</button>
          <button id="al-dis-confirm" type="button" class="al-btn-confirm al-btn-danger">Disable</button>
        </div>
      </div>`;
      document.body.appendChild(overlay);

      const pw = overlay.querySelector('#al-dis-pw');
      const errEl = overlay.querySelector('#al-dis-err');
      const confirmBtn = overlay.querySelector('#al-dis-confirm');

      overlay.querySelector('#al-dis-cancel').addEventListener('click', () => {
        overlay.remove();
        resolve(false);
      });

      confirmBtn.addEventListener('click', async () => {
        if (!pw.value) {
          errEl.textContent = 'Enter your password.';
          errEl.hidden = false;
          return;
        }
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Verifying…';
        try {
          const r = await window.electronAPI?.invoke('disable-app-lock', pw.value);
          if (!r?.ok) {
            errEl.textContent = r?.error ?? 'Incorrect password.';
            errEl.hidden = false;
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Disable';
            return;
          }
          overlay.remove();
          resolve(true);
        } catch (e) {
          errEl.textContent = e.message ?? 'Failed.';
          errEl.hidden = false;
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Disable';
        }
      });

      pw.focus();
    });
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
        setFeedback(t('settings.couldNotLoad'), 'error');
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
