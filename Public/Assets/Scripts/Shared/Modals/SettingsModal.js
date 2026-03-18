// ─────────────────────────────────────────────
//  openworld — Public/Assets/Scripts/Shared/SettingsModal.js
//
//  Self-contained Settings modal. Injects its own HTML,
//  handles all three tabs (User / Providers / Connectors),
//  and exports open / close / loadUser.
//
//  Usage (any page):
//    import { initSettingsModal } from '../Shared/SettingsModal.js';
//
//    const settings = initSettingsModal();
//    // then: settings.open() / settings.open('providers') / settings.close()
//    // loadUser() returns { name } and dispatches 'ow:user-profile-updated'
// ─────────────────────────────────────────────

import { state }              from '../State.js';
import { loadConnectorsPanel } from '../../Features/Connectors/Connectors.js';

/* ══════════════════════════════════════════
   PROVIDER META
══════════════════════════════════════════ */
const PROVIDER_META = {
  anthropic:  { color: '#cc785c', placeholder: 'sk-ant-api03-…', iconPath: 'Assets/Icons/Claude.png',     fallback: 'C'   },
  openai:     { color: '#10a37f', placeholder: 'sk-proj-…',      iconPath: 'Assets/Icons/ChatGPT.png',    fallback: 'GPT' },
  google:     { color: '#4285f4', placeholder: 'AIza…',          iconPath: 'Assets/Icons/Gemini.png',     fallback: 'G'   },
  openrouter: { color: '#9b59b6', placeholder: 'sk-or-v1-…',     iconPath: 'Assets/Icons/OpenRouter.png', fallback: 'OR'  },
};

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */
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

/* ══════════════════════════════════════════
   HTML TEMPLATE
══════════════════════════════════════════ */
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
                  <p>Update provider API keys.</p>
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

/* ══════════════════════════════════════════
   MAIN EXPORT
══════════════════════════════════════════ */
export function initSettingsModal() {

  /* ── 1. Inject HTML (only once) ── */
  if (!document.getElementById('settings-modal-backdrop')) {
    const wrap = document.createElement('div');
    wrap.innerHTML = buildHTML();
    document.body.appendChild(wrap.firstElementChild);
  }

  /* ── 2. Module state ── */
  const settingsState = {
    activeTab:           'user',
    providerCatalog:     [],
    pendingProviderKeys: {},
  };

  /* ── 3. Element accessors (resolved after injection) ── */
  const $  = (id) => document.getElementById(id);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const backdrop      = () => $('settings-modal-backdrop');
  const closeBtn      = () => $('settings-modal-close');
  const saveBtn       = () => $('settings-save');
  const saveFeedback  = () => $('settings-save-feedback');
  const nameInput     = () => $('settings-user-name');
  const memoryInput   = () => $('settings-memory');
  const instructInput = () => $('settings-custom-instructions');
  const providersList = () => $('settings-providers-list');

  const tabs   = () => $$('[data-settings-tab]');
  const panels = () => $$('[data-settings-panel]');

  /* ── 4. Feedback ── */
  function setFeedback(msg = '', tone = 'info') {
    const el = saveFeedback();
    if (!el) return;
    el.textContent = msg;
    el.className   = msg ? `settings-feedback ${tone}` : 'settings-feedback';
  }

  function updateSaveBtn() {
    const btn = saveBtn();
    if (!btn) return;
    const tab = settingsState.activeTab;
    if (tab === 'user')      { btn.textContent = 'Save changes';          btn.disabled = false; return; }
    if (tab === 'providers') { btn.textContent = 'Save provider changes'; btn.disabled = false; return; }
    btn.textContent = 'No changes to save';
    btn.disabled    = true;
  }

  /* ── 5. Tabs ── */
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
  }

  function focusActiveTab() {
    if (settingsState.activeTab === 'providers') { providersList()?.querySelector('input')?.focus(); return; }
    if (settingsState.activeTab === 'user')      nameInput()?.focus();
  }

  /* ── 6. Providers tab ── */
  function renderProviders() {
    const list = providersList();
    if (!list) return;
    if (!settingsState.providerCatalog.length) {
      list.innerHTML = '<div class="settings-empty-card">No providers available</div>';
      updateSaveBtn(); return;
    }

    const sorted = [...settingsState.providerCatalog].sort((a, b) => {
      const ac = String(a.api ?? '').trim().length > 0;
      const bc = String(b.api ?? '').trim().length > 0;
      return Number(bc) - Number(ac);
    });

    list.innerHTML = sorted.map(p => {
      const meta    = PROVIDER_META[p.provider] ?? {};
      const inputId = `settings-key-${p.provider}`;
      const pending = settingsState.pendingProviderKeys[p.provider] ?? '';
      return `
        <article class="settings-provider-row"
                 style="--p-color:${meta.color ?? 'var(--accent)'}">
          <div class="spr-icon">
            <img class="spr-icon-img"
                 src="${escapeHtml(meta.iconPath ?? '')}" alt="" draggable="false"/>
          </div>
          <div class="key-input-wrap spr-key-wrap">
            <input class="key-input spr-key-input" id="${escapeHtml(inputId)}"
              type="password" data-provider-input="${escapeHtml(p.provider)}"
              placeholder="${escapeHtml(meta.placeholder ?? 'Paste API key')}"
              value="${escapeHtml(pending)}"
              autocomplete="off" spellcheck="false"/>
            <button type="button" class="key-eye"
                    data-target="${escapeHtml(inputId)}" title="Show / hide">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke-width="1.8"/>
                <circle cx="12" cy="12" r="3" stroke-width="1.8"/>
              </svg>
            </button>
          </div>
        </article>`;
    }).join('');

    list.querySelectorAll('.spr-icon-img').forEach(img => {
      if (img.complete && img.naturalWidth === 0)
        img.closest('.spr-icon')?.classList.add('icon-missing');
      img.addEventListener('error', () => img.closest('.spr-icon')?.classList.add('icon-missing'));
      img.addEventListener('load',  () => img.closest('.spr-icon')?.classList.remove('icon-missing'));
    });

    list.querySelectorAll('[data-provider-input]').forEach(input => {
      input.addEventListener('input', () => {
        settingsState.pendingProviderKeys[input.dataset.providerInput] = input.value;
        updateSaveBtn();
      });
    });

    list.querySelectorAll('.key-eye').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = $(btn.dataset.target);
        if (input) input.type = input.type === 'password' ? 'text' : 'password';
      });
    });

    updateSaveBtn();
  }

  /* ── 7. Apply user profile to DOM + state ── */
  function applyUserProfile(user = {}) {
    const rawName     = String(user?.name ?? '').trim();
    const displayName = rawName || 'User';
    const firstName   = displayName.split(/\s+/)[0];

    state.userName     = rawName;
    state.userInitials = getInitials(displayName);

    // Update welcome title if on main page
    const welcomeTitle = document.querySelector('.welcome-title');
    if (welcomeTitle) welcomeTitle.textContent = rawName ? `Welcome, ${firstName}` : 'Welcome';

    // Notify sidebar and any other listeners
    window.dispatchEvent(new CustomEvent('ow:user-profile-updated', {
      detail: { name: displayName, initials: state.userInitials },
    }));
  }

  /* ── 8. Load user (public — call from outside to hydrate sidebar etc.) ── */
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

  /* ── 9. Hydrate modal fields ── */
  async function hydrateModal() {
    setFeedback();
    const [user, customInstructions, memory, providers] = await Promise.all([
      window.electronAPI?.getUser?.(),
      window.electronAPI?.getCustomInstructions?.(),
      window.electronAPI?.getMemory?.(),
      window.electronAPI?.getModels?.(),
    ]);

    applyUserProfile(user ?? {});
    settingsState.providerCatalog     = Array.isArray(providers) ? providers : [];
    settingsState.pendingProviderKeys = {};

    const ni = nameInput(); if (ni) ni.value = user?.name ?? '';
    const mi = memoryInput(); if (mi) mi.value = memory ?? '';
    const ii = instructInput(); if (ii) ii.value = customInstructions ?? '';

    renderProviders();
    updateSaveBtn();
  }

  /* ── 10. Save — user tab ── */
  async function saveUserTab() {
    const nextName  = nameInput()?.value.trim() ?? '';
    const nextMem   = memoryInput()?.value ?? '';
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
      if (!instrRes?.ok)   throw new Error(instrRes?.error   ?? 'Could not save custom instructions.');
      if (!memRes?.ok)     throw new Error(memRes?.error     ?? 'Could not save memory.');

      applyUserProfile(profileRes.user ?? { name: nextName });
      setFeedback('Changes saved.', 'success');
      window.dispatchEvent(new CustomEvent('ow:settings-saved'));
    } catch (err) {
      console.error('[SettingsModal] Save user error:', err);
      setFeedback(err.message || 'Could not save.', 'error');
    } finally { updateSaveBtn(); }
  }

  /* ── 11. Save — providers tab ── */
  async function saveProvidersTab() {
    const changes = Object.fromEntries(
      Object.entries(settingsState.pendingProviderKeys)
        .map(([id, key]) => [id, String(key ?? '').trim()])
        .filter(([, key]) => key.length > 0),
    );

    if (!Object.keys(changes).length) {
      setFeedback('Add at least one API key before saving.', 'error'); return;
    }

    saveBtn().disabled = true;
    setFeedback('Saving provider keys…', 'info');

    try {
      const result = await window.electronAPI?.saveAPIKeys?.(changes);
      if (!result?.ok) throw new Error(result?.error ?? 'Could not save keys.');

      // Reload providers in state
      const all = await window.electronAPI?.getModels?.() ?? [];
      state.allProviders = all;
      state.providers    = all.filter(p => p.api && p.api.trim() !== '');

      settingsState.providerCatalog     = all;
      settingsState.pendingProviderKeys = {};
      renderProviders();

      const count = Object.keys(changes).length;
      setFeedback(count === 1 ? 'Provider key saved.' : `${count} provider keys saved.`, 'success');
      window.dispatchEvent(new CustomEvent('ow:settings-saved'));
    } catch (err) {
      console.error('[SettingsModal] Save providers error:', err);
      setFeedback(err.message || 'Could not save.', 'error');
    } finally { updateSaveBtn(); }
  }

  /* ── 12. Wire all events ── */
  function wireEvents() {
    // Tabs
    tabs().forEach(btn => {
      btn.addEventListener('click', () => {
        switchTab(btn.dataset.settingsTab);
        focusActiveTab();
      });
    });

    // Save button
    saveBtn()?.addEventListener('click', () => {
      if (settingsState.activeTab === 'user')      void saveUserTab();
      if (settingsState.activeTab === 'providers') void saveProvidersTab();
    });

    // Close modal
    closeBtn()?.addEventListener('click', close);
    backdrop()?.addEventListener('click', e => {
      if (e.target === backdrop()) close();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      const isSave = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's';
      if (isSave && backdrop()?.classList.contains('open')) {
        e.preventDefault();
        if (settingsState.activeTab === 'user')      void saveUserTab();
        if (settingsState.activeTab === 'providers') void saveProvidersTab();
        return;
      }
      if (e.key === 'Escape' && backdrop()?.classList.contains('open')) close();
    });
  }

  wireEvents();

  /* ── 13. Sync body class helper ── */
  function syncBodyClass() {
    const hasOpen = Boolean(
      document.querySelector(
        '#settings-modal-backdrop.open, #library-modal-backdrop.open'
      )
    );
    document.body.classList.toggle('modal-open', hasOpen);
  }

  /* ── 14. Public API ── */
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
