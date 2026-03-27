import { state } from '../Core/State.js';
import { loadConnectorsPanel } from '../../Features/Connectors/index.js';
import { loadMCPPanel } from '../../Features/MCP/index.js';

// PROVIDER META
const PROVIDER_META = {
  anthropic: { color: '#cc785c', placeholder: 'sk-ant-api03-…', iconPath: 'Assets/Icons/Claude.png', fallback: 'C' },
  openai: { color: '#10a37f', placeholder: 'sk-proj-…', iconPath: 'Assets/Icons/ChatGPT.png', fallback: 'GPT' },
  google: { color: '#4285f4', placeholder: 'AIza…', iconPath: 'Assets/Icons/Gemini.png', fallback: 'G' },
  openrouter: { color: '#9b59b6', placeholder: 'sk-or-v1-…', iconPath: 'Assets/Icons/OpenRouter.png', fallback: 'OR' },
  mistral: { color: '#f54e42', placeholder: 'Enter Mistral API key', iconPath: 'Assets/Icons/Mistral.png', fallback: 'M' },
  nvidia: { color: '#76b900', placeholder: 'nvapi-...', iconPath: 'Assets/Icons/Nvidia.png', fallback: 'NV', },
};

// HELPERS
function escapeHtml(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getInitials(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0] ?? 'OW').slice(0, 2).toUpperCase();
}

// HTML TEMPLATE
function buildHTML() {
  return /* html */`
    <div id="settings-modal-backdrop">
      <div id="settings-modal" role="dialog" aria-modal="true"
           aria-labelledby="settings-modal-title">

        <div class="settings-modal-header">
          <div class="settings-modal-copy">
            <h2 id="settings-modal-title">Workspace settings</h2>
          </div>
          <button id="settings-modal-close" class="settings-modal-close"
                  type="button" aria-label="Close settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12"
                    stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>
            </svg>
          </button>
        </div>

        <div class="settings-modal-body">
          <div class="settings-shell">

            <nav class="settings-tabs" aria-label="Settings sections">
              <button class="settings-tab active" type="button"
                      data-settings-tab="user">User</button>
              <button class="settings-tab" type="button"
                      data-settings-tab="providers">Connected Providers</button>
              <button class="settings-tab" type="button"
                      data-settings-tab="connectors">Connectors</button>
              <button class="settings-tab" type="button"
                      data-settings-tab="mcp">MCP Servers</button>
            </nav>

            <div class="settings-content">

              <!-- ── User tab ── -->
              <section class="settings-panel active" data-settings-panel="user">
                <div class="settings-panel-header">
                  <h3>User</h3>
                  <p>Update your display name, memory, and custom instructions.
                     These are injected into every AI conversation automatically.</p>
                </div>
                <div class="settings-form">
                  <label class="settings-field">
                    <span class="settings-field-label">Name</span>
                    <input id="settings-user-name" type="text" maxlength="80"
                           placeholder="Your name" autocomplete="name"/>
                  </label>
                  <label class="settings-field">
                    <span class="settings-field-label">Memory</span>
                    <textarea id="settings-memory"
                      placeholder="Facts about you, ongoing projects, preferences the AI should always remember…">
                    </textarea>
                  </label>
                  <label class="settings-field">
                    <span class="settings-field-label">Custom Instructions</span>
                    <textarea id="settings-custom-instructions"
                      placeholder="Tone, style, or behaviour instructions for the AI…">
                    </textarea>
                  </label>
                </div>
              </section>

              <!-- ── Providers tab ── -->
              <section class="settings-panel" data-settings-panel="providers" hidden>
                <div class="settings-panel-header">
                  <h3>Connected Providers</h3>
                  <p>Add, update, or remove API keys for AI providers. Active providers are available in the model selector.</p>
                </div>
                <div id="settings-providers-list" class="providers-stack">
                  <div class="ap-empty-hint">Loading…</div>
                </div>
              </section>

              <!-- ── Connectors tab ── -->
              <section class="settings-panel" data-settings-panel="connectors" hidden>
                <div class="settings-panel-header">
                  <h3>Connectors</h3>
                  <p>Link Gmail and GitHub so the AI knows about your emails and repos,
                     and automations can take action.</p>
                </div>
                <div id="connector-list" class="connector-list">
                  <div class="cx-loading">Loading connectors…</div>
                </div>
              </section>

              <section class="settings-panel" data-settings-panel="mcp" hidden>
                <div class="settings-panel-header">
                  <h3>MCP Servers</h3>
                  <p>
                    Connect Model Context Protocol servers here. Browser-control MCP tools will
                    automatically show up in chat once the server is connected.
                  </p>
                </div>
                <div id="mcp-settings-panel" class="mcp-settings-panel">
                  <div class="cx-loading">Loading MCP servers...</div>
                </div>
              </section>

            </div>
          </div>
        </div>

        <div class="settings-modal-footer">
          <div id="settings-save-feedback" class="settings-feedback"
               aria-live="polite"></div>
          <button id="settings-save" class="settings-save-btn" type="button">
            Save changes
          </button>
        </div>

      </div>
    </div>
  `;
}

// MAIN EXPORT
export function initSettingsModal() {

  // 1. Inject HTML (only once)
  if (!document.getElementById('settings-modal-backdrop')) {
    const wrap = document.createElement('div');
    wrap.innerHTML = buildHTML();
    document.body.appendChild(wrap.firstElementChild);

  }

  // 2. Module state
  const settingsState = {
    activeTab: 'user',
    providerCatalog: [],
    pendingProviderKeys: {},
    pendingDeletes: new Set(), // provider IDs marked for key removal
  };

  // 3. Element accessors (resolved after injection)
  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const backdrop = () => $('settings-modal-backdrop');
  const closeBtn = () => $('settings-modal-close');
  const saveBtn = () => $('settings-save');
  const saveFeedback = () => $('settings-save-feedback');
  const nameInput = () => $('settings-user-name');
  const memoryInput = () => $('settings-memory');
  const instructInput = () => $('settings-custom-instructions');
  const providersList = () => $('settings-providers-list');

  const tabs = () => $$('[data-settings-tab]');
  const panels = () => $$('[data-settings-panel]');

  // 4. Feedback
  function setFeedback(msg = '', tone = 'info') {
    const el = saveFeedback();
    if (!el) return;
    el.textContent = msg;
    el.className = msg ? `settings-feedback ${tone}` : 'settings-feedback';
  }

  function updateSaveBtn() {
    const btn = saveBtn();
    if (!btn) return;
    const tab = settingsState.activeTab;
    if (tab === 'user') { btn.textContent = 'Save changes'; btn.disabled = false; return; }
    if (tab === 'providers') {
      btn.textContent = 'Save provider changes';
      btn.disabled = false;
      return;
    }
    btn.textContent = 'No changes to save';
    btn.disabled = true;
  }

  // 5. Tabs
  function switchTab(tabId) {
    settingsState.activeTab = tabId;
    tabs().forEach(btn => {
      const active = btn.dataset.settingsTab === tabId;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    panels().forEach(panel => {
      const active = panel.dataset.settingsPanel === tabId;
      panel.classList.toggle('active', active);
      panel.hidden = !active;
    });
    setFeedback();
    updateSaveBtn();
    if (tabId === 'connectors') loadConnectorsPanel();
    if (tabId === 'mcp') loadMCPPanel();
  }

  function focusActiveTab() {
    if (settingsState.activeTab === 'providers') { providersList()?.querySelector('input')?.focus(); return; }
    if (settingsState.activeTab === 'mcp') { document.getElementById('mcp-add-btn')?.focus(); return; }
    if (settingsState.activeTab === 'user') nameInput()?.focus();
  }

  // 6. Providers tab — enhanced with status badges + delete
  function renderProviders() {
    const list = providersList();
    if (!list) return;

    if (!settingsState.providerCatalog.length) {
      list.innerHTML = '<div class="settings-empty-card">No providers available</div>';
      updateSaveBtn(); return;
    }

    // Sort: active (has key) first, then inactive
    const sorted = [...settingsState.providerCatalog].sort((a, b) => {
      const aActive = Boolean(String(a.api ?? '').trim());
      const bActive = Boolean(String(b.api ?? '').trim());
      return Number(bActive) - Number(aActive);
    });

    list.innerHTML = '';

    sorted.forEach(p => {
      const meta = PROVIDER_META[p.provider] ?? {};
      const inputId = `settings-key-${p.provider}`;
      const savedKey = String(p.api ?? '').trim();
      const isActive = savedKey.length > 0;
      const isDeleting = settingsState.pendingDeletes.has(p.provider);
      const pending = settingsState.pendingProviderKeys[p.provider] ?? '';

      const row = document.createElement('div');
      row.className = `spr-row${isActive && !isDeleting ? ' spr-row--active' : ''}${isDeleting ? ' spr-row--deleting' : ''}`;
      row.style.setProperty('--p-color', meta.color ?? 'var(--accent)');

      // ── Provider icon
      const iconWrap = document.createElement('div');
      iconWrap.className = 'spr-icon';
      const img = document.createElement('img');
      img.className = 'spr-icon-img';
      img.src = meta.iconPath ?? '';
      img.alt = '';
      img.addEventListener('error', () => iconWrap.classList.add('icon-missing'));
      img.addEventListener('load', () => iconWrap.classList.remove('icon-missing'));
      if (img.complete && img.naturalWidth === 0) iconWrap.classList.add('icon-missing');
      iconWrap.appendChild(img);

      // ── Provider name + status badge
      const info = document.createElement('div');
      info.className = 'spr-info';

      const providerName = document.createElement('div');
      providerName.className = 'spr-provider-name';
      providerName.textContent = p.label ?? p.provider;

      const statusBadge = document.createElement('span');
      if (isDeleting) {
        statusBadge.className = 'spr-status spr-status--removing';
        statusBadge.textContent = '× Removing';
      } else if (isActive) {
        statusBadge.className = 'spr-status spr-status--active';
        statusBadge.innerHTML = `
          <span class="spr-status-dot"></span>
          Active
        `;
      } else {
        statusBadge.className = 'spr-status spr-status--inactive';
        statusBadge.textContent = 'No key';
      }

      info.append(providerName, statusBadge);

      // ── Key input area
      const keyWrap = document.createElement('div');
      keyWrap.className = 'key-input-wrap spr-key-wrap';

      const input = document.createElement('input');
      input.className = 'key-input spr-key-input';
      input.id = inputId;
      input.type = 'password';
      input.dataset.providerInput = p.provider;
      input.placeholder = isActive && !isDeleting ? '••••••••  (key saved)' : (meta.placeholder ?? 'Paste API key');
      input.value = pending;
      input.autocomplete = 'off';
      input.spellcheck = false;
      if (isDeleting) {
        input.disabled = true;
        input.placeholder = 'Key will be removed on save';
      }
      input.addEventListener('input', () => {
        settingsState.pendingProviderKeys[p.provider] = input.value;
        // If they type a new key, cancel any pending delete
        if (input.value.trim()) {
          settingsState.pendingDeletes.delete(p.provider);
          row.classList.remove('spr-row--deleting');
          statusBadge.className = 'spr-status spr-status--inactive';
          statusBadge.textContent = 'No key';
        }
        updateSaveBtn();
      });

      const eyeBtn = document.createElement('button');
      eyeBtn.type = 'button';
      eyeBtn.className = 'key-eye';
      eyeBtn.title = 'Show / hide';
      eyeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke-width="1.8"/><circle cx="12" cy="12" r="3" stroke-width="1.8"/></svg>`;
      eyeBtn.addEventListener('click', () => {
        input.type = input.type === 'password' ? 'text' : 'password';
      });

      keyWrap.append(input, eyeBtn);

      // ── Delete / undo button (only shown when a key exists or is being deleted)
      const actionArea = document.createElement('div');
      actionArea.className = 'spr-actions';

      if (isActive || isDeleting) {
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = isDeleting ? 'spr-undo-btn' : 'spr-delete-btn';
        deleteBtn.title = isDeleting ? 'Undo removal' : 'Remove API key';
        deleteBtn.innerHTML = isDeleting
          ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 14l-4-4 4-4M5 10h11a4 4 0 010 8h-1" stroke-linecap="round" stroke-linejoin="round"/></svg> Undo`
          : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

        deleteBtn.addEventListener('click', () => {
          if (isDeleting) {
            // Undo
            settingsState.pendingDeletes.delete(p.provider);
          } else {
            // Mark for deletion, clear any pending key edit
            settingsState.pendingDeletes.add(p.provider);
            settingsState.pendingProviderKeys[p.provider] = '';
            input.value = '';
          }
          updateSaveBtn();
          renderProviders(); // re-render to update visual state
        });

        actionArea.appendChild(deleteBtn);
      }

      row.append(iconWrap, info, keyWrap, actionArea);
      list.appendChild(row);
    });

    updateSaveBtn();
  }

  // 7. Apply user profile to DOM + state
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

  // 8. Load user (public)
  async function loadUser() {
    try {
      const user = await window.electronAPI?.getUser?.();
      applyUserProfile(user ?? {});
      return user;
    } catch (err) {
      console.warn('[SettingsModal] Could not load user:', err);
      applyUserProfile({});
      return null;
    }
  }

  // 9. Hydrate modal fields
  async function hydrateModal() {
    setFeedback();
    settingsState.pendingDeletes.clear();
    const [user, customInstructions, memory, providers] = await Promise.all([
      window.electronAPI?.getUser?.(),
      window.electronAPI?.getCustomInstructions?.(),
      window.electronAPI?.getMemory?.(),
      window.electronAPI?.getModels?.(),
    ]);

    applyUserProfile(user ?? {});
    settingsState.providerCatalog = Array.isArray(providers) ? providers : [];
    settingsState.pendingProviderKeys = {};

    const ni = nameInput(); if (ni) ni.value = user?.name ?? '';
    const mi = memoryInput(); if (mi) mi.value = memory ?? '';
    const ii = instructInput(); if (ii) ii.value = customInstructions ?? '';

    renderProviders();
    updateSaveBtn();
  }

  // 10. Save — user tab
  async function saveUserTab() {
    const nextName = nameInput()?.value.trim() ?? '';
    const nextMem = memoryInput()?.value ?? '';
    const nextInstr = instructInput()?.value ?? '';

    if (nextName.length < 2) {
      setFeedback('Enter a name with at least 2 characters.', 'error');
      nameInput()?.focus(); return;
    }

    saveBtn().disabled = true;
    setFeedback('Saving…', 'info');

    try {
      const [profileRes, instrRes, memRes] = await Promise.all([
        window.electronAPI?.saveUserProfile?.({ name: nextName }),
        window.electronAPI?.saveCustomInstructions?.(nextInstr),
        window.electronAPI?.saveMemory?.(nextMem),
      ]);
      if (!profileRes?.ok) throw new Error(profileRes?.error ?? 'Could not save profile.');
      if (!instrRes?.ok) throw new Error(instrRes?.error ?? 'Could not save custom instructions.');
      if (!memRes?.ok) throw new Error(memRes?.error ?? 'Could not save memory.');

      applyUserProfile(profileRes.user ?? { name: nextName });
      setFeedback('Changes saved.', 'success');
      window.dispatchEvent(new CustomEvent('ow:settings-saved'));
    } catch (err) {
      console.error('[SettingsModal] Save user error:', err);
      setFeedback(err.message || 'Could not save.', 'error');
    } finally { updateSaveBtn(); }
  }

  // 11. Save — providers tab (handles both new keys AND deletions)
  async function saveProvidersTab() {
    const changes = {};

    // New / updated keys
    Object.entries(settingsState.pendingProviderKeys).forEach(([id, key]) => {
      const trimmed = String(key ?? '').trim();
      if (trimmed.length > 0 && !settingsState.pendingDeletes.has(id)) {
        changes[id] = trimmed;
      }
    });

    // Deletions — pass null to remove the key
    settingsState.pendingDeletes.forEach(id => {
      changes[id] = null;
    });

    if (!Object.keys(changes).length) {
      setFeedback('No changes to save.', 'error'); return;
    }

    saveBtn().disabled = true;
    setFeedback('Saving provider keys…', 'info');

    try {
      const result = await window.electronAPI?.saveAPIKeys?.(changes);
      if (!result?.ok) throw new Error(result?.error ?? 'Could not save keys.');

      const all = await window.electronAPI?.getModels?.() ?? [];
      state.allProviders = all;
      state.providers = all.filter(p => p.api && p.api.trim() !== '');

      settingsState.providerCatalog = all;
      settingsState.pendingProviderKeys = {};
      settingsState.pendingDeletes.clear();
      renderProviders();

      const addedCount = Object.values(changes).filter(v => v !== null).length;
      const removedCount = Object.values(changes).filter(v => v === null).length;
      const parts = [];
      if (addedCount) parts.push(`${addedCount} key${addedCount !== 1 ? 's' : ''} saved`);
      if (removedCount) parts.push(`${removedCount} key${removedCount !== 1 ? 's' : ''} removed`);
      setFeedback(parts.join(', ') + '.', 'success');
      window.dispatchEvent(new CustomEvent('ow:settings-saved'));
    } catch (err) {
      console.error('[SettingsModal] Save providers error:', err);
      setFeedback(err.message || 'Could not save.', 'error');
    } finally { updateSaveBtn(); }
  }

  // 12. Wire all events
  function wireEvents() {
    tabs().forEach(btn => {
      btn.addEventListener('click', () => {
        switchTab(btn.dataset.settingsTab);
        focusActiveTab();
      });
    });

    saveBtn()?.addEventListener('click', () => {
      if (settingsState.activeTab === 'user') void saveUserTab();
      if (settingsState.activeTab === 'providers') void saveProvidersTab();
    });

    closeBtn()?.addEventListener('click', close);
    backdrop()?.addEventListener('click', e => {
      if (e.target === backdrop()) close();
    });

    document.addEventListener('keydown', e => {
      const isSave = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's';
      if (isSave && backdrop()?.classList.contains('open')) {
        e.preventDefault();
        if (settingsState.activeTab === 'user') void saveUserTab();
        if (settingsState.activeTab === 'providers') void saveProvidersTab();
        return;
      }
      if (e.key === 'Escape' && backdrop()?.classList.contains('open')) close();
    });
  }

  wireEvents();

  // 13. Sync body class
  function syncBodyClass() {
    const hasOpen = Boolean(
      document.querySelector(
        '#settings-modal-backdrop.open, #library-modal-backdrop.open'
      )
    );
    document.body.classList.toggle('modal-open', hasOpen);
  }

  // 14. Public API
  async function open(tabId = settingsState.activeTab) {
    switchTab(tabId);
    backdrop()?.classList.add('open');
    syncBodyClass();
    try { await hydrateModal(); }
    catch (err) {
      console.error('[SettingsModal] Could not load settings:', err);
      setFeedback('Could not load settings.', 'error');
    }
    requestAnimationFrame(() => focusActiveTab());
  }

  function close() {
    backdrop()?.classList.remove('open');
    syncBodyClass();
  }

  return { open, close, loadUser };
}
