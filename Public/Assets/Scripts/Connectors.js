// ─────────────────────────────────────────────
//  openworld — Public/Assets/Scripts/Connectors.js
//  Renderer-side connector management UI.
//  Handles Gmail and GitHub connect / disconnect flows.
// ─────────────────────────────────────────────

/* ══════════════════════════════════════════
   CONNECTOR DEFINITIONS
══════════════════════════════════════════ */
const CONNECTORS = [
  {
    id:           'gmail',
    name:         'Gmail',
    icon:         '📧',
    description:  'Read emails, get AI summaries in chat, and send emails via automations.',
    helpUrl:      'https://developers.google.com/oauthplayground',
    helpText:     'Get token from OAuth Playground →',
    capabilities: [
      'Ask "read my unread emails" in chat',
      'AI-powered email summaries',
      'Send emails via automations',
      'Search inbox via automations',
    ],
    fields: [
      {
        key:         'accessToken',
        label:       'OAuth2 Access Token',
        placeholder: 'ya29.a0A…',
        type:        'password',
        hint:        'From Google OAuth Playground — select Gmail API (gmail.readonly + gmail.send scopes)',
      },
      {
        key:         'email',
        label:       'Your Gmail Address',
        placeholder: 'you@gmail.com',
        type:        'email',
        hint:        'The Gmail account this token belongs to',
      },
    ],
    automations: [
      { name: 'Daily Email Brief',       description: 'Every morning — get a summary of unread emails' },
      { name: 'New Email Notification',  description: 'Every hour — notify if there are unread messages' },
      { name: 'Send a Scheduled Email',  description: 'On startup or daily — auto-send a preset email' },
    ],
  },
  {
    id:           'github',
    name:         'GitHub',
    icon:         '🐙',
    description:  'Browse repos, load code into chat, track issues & PRs, and monitor notifications.',
    helpUrl:      'https://github.com/settings/tokens/new?scopes=repo,read:user,notifications',
    helpText:     'Create a Personal Access Token →',
    capabilities: [
      'Ask "load file X from owner/repo" in chat',
      'List your repos or issues in chat',
      'Track PRs & issues via automations',
      'Monitor GitHub notifications',
    ],
    fields: [
      {
        key:         'token',
        label:       'Personal Access Token',
        placeholder: 'ghp_…',
        type:        'password',
        hint:        'Create at github.com/settings/tokens — needs: repo, read:user, notifications scopes',
      },
    ],
    automations: [
      { name: 'Daily PR Summary',        description: 'Every morning — notify about open pull requests' },
      { name: 'Issue Tracker',           description: 'Daily — notify about open issues in a repo' },
      { name: 'GitHub Notifications',    description: 'Hourly — notify if there are unread notifications' },
      { name: 'Open Repo on Startup',    description: 'On startup — open a GitHub repo in the browser' },
    ],
  },
];

/* ══════════════════════════════════════════
   STATE
══════════════════════════════════════════ */
const cxState = {
  loaded:     false,
  statuses:   {},     // { gmail: { enabled, connectedAt, accountInfo } }
  pending:    {},     // { connectorId: { fieldKey: value } }
};

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */
function setStatus(id, message, type = '') {
  const el = document.getElementById(`cx-status-${id}`);
  if (!el) return;
  el.textContent = message;
  el.className   = `cx-status-msg${message && type ? ` ${type}` : ''}`;
}

function setConnectBtnState(id, loading, label) {
  const btn = document.getElementById(`cx-connect-btn-${id}`);
  if (!btn) return;
  btn.disabled    = loading;
  btn.textContent = label;
}

/* ══════════════════════════════════════════
   RENDER
══════════════════════════════════════════ */
function buildCard(def) {
  const status      = cxState.statuses[def.id] ?? { enabled: false };
  const isConnected = Boolean(status.enabled);

  const card = document.createElement('div');
  card.className = `cx-card${isConnected ? ' cx-connected' : ''}`;
  card.id        = `cx-card-${def.id}`;

  /* ── Header ── */
  card.innerHTML = `
    <div class="cx-card-header">
      <div class="cx-icon">${def.icon}</div>
      <div class="cx-info">
        <h4>${def.name}</h4>
        <p>${def.description}</p>
      </div>
      <span class="cx-badge ${isConnected ? 'cx-badge--on' : 'cx-badge--off'}">
        ${isConnected ? '● Connected' : '○ Not connected'}
      </span>
    </div>`;

  /* ── Capabilities ── */
  const caps = document.createElement('div');
  caps.className = 'cx-capabilities';
  def.capabilities.forEach(cap => {
    const tag = document.createElement('span');
    tag.className   = 'cx-cap-tag';
    tag.textContent = cap;
    caps.appendChild(tag);
  });
  card.appendChild(caps);

  /* ── Account info when connected ── */
  if (isConnected && status.accountInfo) {
    const info     = document.createElement('div');
    info.className = 'cx-account-info';
    const display  = status.accountInfo.email || status.accountInfo.username || 'Connected';
    const initial  = display[0].toUpperCase();
    info.innerHTML = `
      <div class="cx-account-avatar">${initial}</div>
      <span>${display}</span>`;
    card.appendChild(info);
  }

  /* ── Suggested automations ── */
  if (def.automations?.length) {
    const autoSec = document.createElement('div');
    autoSec.className = 'cx-auto-section';
    autoSec.innerHTML = `<div class="cx-auto-label">Suggested Automations</div>`;
    def.automations.forEach(a => {
      const item = document.createElement('div');
      item.className = 'cx-auto-item';
      item.innerHTML = `<strong>${a.name}</strong> — <span>${a.description}</span>`;
      autoSec.appendChild(item);
    });
    card.appendChild(autoSec);
  }

  /* ── Status message ── */
  const statusEl     = document.createElement('div');
  statusEl.className = 'cx-status-msg';
  statusEl.id        = `cx-status-${def.id}`;
  card.appendChild(statusEl);

  /* ── Credential fields (hidden when connected) ── */
  const fieldsWrap     = document.createElement('div');
  fieldsWrap.className = 'cx-fields';
  fieldsWrap.id        = `cx-fields-${def.id}`;
  if (isConnected) fieldsWrap.style.display = 'none';

  def.fields.forEach(field => {
    const wrap       = document.createElement('div');
    wrap.className   = 'cx-field-wrap';

    const label      = document.createElement('label');
    label.className  = 'cx-field-label';
    label.textContent = field.label;
    label.htmlFor    = `cx-field-${def.id}-${field.key}`;

    const input      = document.createElement('input');
    input.id         = `cx-field-${def.id}-${field.key}`;
    input.type       = field.type;
    input.className  = 'cx-field-input';
    input.placeholder = field.placeholder;
    input.autocomplete = 'off';
    input.spellcheck   = false;
    input.addEventListener('input', () => {
      if (!cxState.pending[def.id]) cxState.pending[def.id] = {};
      cxState.pending[def.id][field.key] = input.value.trim();
    });

    wrap.appendChild(label);
    wrap.appendChild(input);

    if (field.hint) {
      const hint       = document.createElement('div');
      hint.className   = 'cx-field-hint';
      hint.textContent = field.hint;
      wrap.appendChild(hint);
    }

    fieldsWrap.appendChild(wrap);
  });
  card.appendChild(fieldsWrap);

  /* ── Action row ── */
  const actions     = document.createElement('div');
  actions.className = 'cx-actions';

  const helpLink       = document.createElement('a');
  helpLink.className   = 'cx-help-link';
  helpLink.textContent = def.helpText;
  helpLink.href        = '#';
  helpLink.addEventListener('click', e => {
    e.preventDefault();
    const a   = document.createElement('a');
    a.href    = def.helpUrl;
    a.target  = '_blank';
    a.rel     = 'noopener noreferrer';
    a.click();
  });
  actions.appendChild(helpLink);

  const btnGroup     = document.createElement('div');
  btnGroup.className = 'cx-btn-group';

  if (isConnected) {
    const updateBtn       = document.createElement('button');
    updateBtn.className   = 'cx-secondary-btn';
    updateBtn.textContent = 'Update token';
    updateBtn.addEventListener('click', () => {
      fieldsWrap.style.display = '';
      updateBtn.style.display  = 'none';
    });
    btnGroup.appendChild(updateBtn);

    const disconnectBtn       = document.createElement('button');
    disconnectBtn.className   = 'cx-disconnect-btn';
    disconnectBtn.textContent = 'Disconnect';
    disconnectBtn.addEventListener('click', () => handleDisconnect(def.id));
    btnGroup.appendChild(disconnectBtn);
  } else {
    const connectBtn       = document.createElement('button');
    connectBtn.id          = `cx-connect-btn-${def.id}`;
    connectBtn.className   = 'cx-connect-btn';
    connectBtn.textContent = `Connect ${def.name}`;
    connectBtn.addEventListener('click', () => handleConnect(def.id, def));
    btnGroup.appendChild(connectBtn);
  }

  actions.appendChild(btnGroup);
  card.appendChild(actions);

  return card;
}

export function renderConnectorsPanel() {
  const list = document.getElementById('connector-list');
  if (!list) return;
  list.innerHTML = '';
  CONNECTORS.forEach(def => list.appendChild(buildCard(def)));
}

/* ══════════════════════════════════════════
   CONNECT / DISCONNECT
══════════════════════════════════════════ */

async function handleConnect(id, def) {
  const credentials = cxState.pending[id] ?? {};
  const missing     = def.fields.filter(f => !credentials[f.key]?.trim());

  if (missing.length) {
    setStatus(id, `Please fill in: ${missing.map(f => f.label).join(', ')}`, 'error');
    return;
  }

  setConnectBtnState(id, true, 'Connecting…');
  setStatus(id, '', '');

  try {
    // 1. Persist credentials
    await window.electronAPI?.saveConnector?.(id, credentials);

    // 2. Validate against the live API
    const validation = await window.electronAPI?.validateConnector?.(id);
    if (!validation?.ok) throw new Error(validation?.error ?? 'Connection failed');

    // 3. Update local state
    cxState.statuses[id] = {
      enabled:     true,
      connectedAt: new Date().toISOString(),
      accountInfo: {
        email:    validation.email    ?? null,
        username: validation.username ?? null,
      },
    };
    cxState.pending[id] = {};

    setStatus(id, 'Connected successfully!', 'success');
    setTimeout(() => renderConnectorsPanel(), 900);
  } catch (err) {
    // Roll back if validation failed
    await window.electronAPI?.removeConnector?.(id).catch(() => {});
    cxState.statuses[id] = { enabled: false };
    setStatus(id, `Failed: ${err.message}`, 'error');
    setConnectBtnState(id, false, `Connect ${def.name}`);
  }
}

async function handleDisconnect(id) {
  try {
    await window.electronAPI?.removeConnector?.(id);
    cxState.statuses[id] = { enabled: false, accountInfo: null };
    cxState.pending[id]  = {};
    renderConnectorsPanel();
  } catch (err) {
    setStatus(id, `Could not disconnect: ${err.message}`, 'error');
  }
}

/* ══════════════════════════════════════════
   LOAD PANEL DATA
══════════════════════════════════════════ */

export async function loadConnectorsPanel() {
  const list = document.getElementById('connector-list');
  if (!list) return;

  if (!cxState.loaded) {
    list.innerHTML = '<div class="cx-loading">Loading connectors…</div>';
  }

  try {
    const statuses = await window.electronAPI?.getConnectors?.() ?? {};

    cxState.statuses = {};
    for (const [name, s] of Object.entries(statuses)) {
      cxState.statuses[name] = { ...s, accountInfo: null };
    }

    // Fetch account info for connected connectors
    await Promise.all(
      Object.entries(cxState.statuses)
        .filter(([, s]) => s.enabled)
        .map(async ([name]) => {
          const v = await window.electronAPI?.validateConnector?.(name).catch(() => null);
          if (v?.ok) {
            cxState.statuses[name].accountInfo = {
              email:    v.email    ?? null,
              username: v.username ?? null,
            };
          }
        }),
    );

    cxState.loaded = true;
    renderConnectorsPanel();
  } catch (err) {
    if (list) list.innerHTML = `<div class="cx-loading">Could not load connectors: ${err.message}</div>`;
  }
}

/* ══════════════════════════════════════════
   INIT
   Call once after DOM is ready.
   Sets up tab-click lazy loading.
══════════════════════════════════════════ */

export function initConnectors() {
  document.querySelectorAll('[data-settings-tab="connectors"]').forEach(tab => {
    tab.addEventListener('click', () => {
      if (!cxState.loaded) loadConnectorsPanel();
    });
  });
}
