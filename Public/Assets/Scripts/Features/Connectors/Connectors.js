// ─────────────────────────────────────────────
//  openworld — Public/Assets/Scripts/Features/Connectors/Connectors.js
//  Renders connector cards and handles connect / disconnect flows.
//  Imported and used by User.js (settings modal connectors tab).
// ─────────────────────────────────────────────

const CONNECTORS = [
  {
    id:          'gmail',
    name:        'Gmail',
    icon:        '📧',
    description: 'Read emails, get AI summaries in chat, and send emails via automations.',
    helpUrl:     'https://console.cloud.google.com/apis/credentials',
    helpText:    'Create OAuth credentials in Google Cloud →',
    oauthFlow:   true,
    capabilities: [
      'Ask "read my unread emails" in chat',
      'AI-powered email summaries',
      'Send emails via automations',
      'Search inbox via automations',
    ],
    fields: [
      {
        key:         'clientId',
        label:       'Google Client ID',
        placeholder: 'xxxxxxxxxxxx.apps.googleusercontent.com',
        type:        'text',
        hint:        'Google Cloud Console → APIs & Services → Credentials → Create OAuth 2.0 Client ID (Desktop app type)',
      },
      {
        key:         'clientSecret',
        label:       'Google Client Secret',
        placeholder: 'GOCSPX-…',
        type:        'password',
        hint:        'Found next to your Client ID. Keep it private.',
      },
    ],
    automations: [
      { name: 'Daily Email Brief',      description: 'Every morning — get a summary of unread emails' },
      { name: 'New Email Notification', description: 'Every hour — notify if there are unread messages' },
      { name: 'Send a Scheduled Email', description: 'On startup or daily — auto-send a preset email' },
    ],
  },
  {
    id:          'github',
    name:        'GitHub',
    icon:        '🐙',
    description: 'Browse repos, load code into chat, track issues & PRs, and monitor notifications.',
    helpUrl:     'https://github.com/settings/tokens/new?scopes=repo,read:user,notifications',
    helpText:    'Create a Personal Access Token →',
    oauthFlow:   false,
    capabilities: [
      'Ask "load file X from owner/repo" in chat',
      'List your repos or issues in chat',
      'AI knows your repos by default (via system prompt)',
      'Track PRs & issues via automations',
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
      { name: 'Daily PR Summary',     description: 'Every morning — notify about open pull requests' },
      { name: 'Issue Tracker',        description: 'Daily — notify about open issues in a repo' },
      { name: 'GitHub Notifications', description: 'Hourly — notify if there are unread notifications' },
      { name: 'Open Repo on Startup', description: 'On startup — open a GitHub repo in the browser' },
    ],
  },
];

/* ══════════════════════════════════════════
   MODULE STATE
══════════════════════════════════════════ */
const cxState = {
  loaded:   false,
  statuses: {},
  pending:  {},
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
   CARD BUILDER
══════════════════════════════════════════ */
function buildCard(def) {
  const status      = cxState.statuses[def.id] ?? { enabled: false };
  const isConnected = Boolean(status.enabled);

  const card = document.createElement('div');
  card.className = `cx-card${isConnected ? ' cx-connected' : ''}`;
  card.id        = `cx-card-${def.id}`;

  /* Header */
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

  /* Capabilities */
  const caps = document.createElement('div');
  caps.className = 'cx-capabilities';
  def.capabilities.forEach(cap => {
    const tag = document.createElement('span');
    tag.className   = 'cx-cap-tag';
    tag.textContent = cap;
    caps.appendChild(tag);
  });
  card.appendChild(caps);

  /* Connected account info */
  if (isConnected && status.accountInfo) {
    const info    = document.createElement('div');
    info.className = 'cx-account-info';
    const display = status.accountInfo.email || status.accountInfo.username || 'Connected';
    info.innerHTML = `
      <div class="cx-account-avatar">${display[0].toUpperCase()}</div>
      <span>${display}</span>`;
    card.appendChild(info);
  }

  /* Suggested automations */
  if (def.automations?.length) {
    const autoSec   = document.createElement('div');
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

  /* Status message */
  const statusEl   = document.createElement('div');
  statusEl.className = 'cx-status-msg';
  statusEl.id        = `cx-status-${def.id}`;
  card.appendChild(statusEl);

  /* Credential fields (hidden when connected) */
  const fieldsWrap   = document.createElement('div');
  fieldsWrap.className = 'cx-fields';
  fieldsWrap.id        = `cx-fields-${def.id}`;
  if (isConnected) fieldsWrap.style.display = 'none';

  def.fields.forEach(field => {
    const wrap  = document.createElement('div');
    wrap.className = 'cx-field-wrap';

    const label    = document.createElement('label');
    label.className = 'cx-field-label';
    label.textContent = field.label;
    label.htmlFor   = `cx-field-${def.id}-${field.key}`;

    const input    = document.createElement('input');
    input.id       = `cx-field-${def.id}-${field.key}`;
    input.type     = field.type;
    input.className = 'cx-field-input';
    input.placeholder = field.placeholder;
    input.autocomplete = 'off';
    input.spellcheck   = false;
    input.addEventListener('input', () => {
      if (!cxState.pending[def.id]) cxState.pending[def.id] = {};
      cxState.pending[def.id][field.key] = input.value.trim();
    });

    wrap.append(label, input);
    if (field.hint) {
      const hint = document.createElement('div');
      hint.className   = 'cx-field-hint';
      hint.textContent = field.hint;
      wrap.appendChild(hint);
    }
    fieldsWrap.appendChild(wrap);
  });
  card.appendChild(fieldsWrap);

  /* Action row */
  const actions   = document.createElement('div');
  actions.className = 'cx-actions';

  const helpLink   = document.createElement('a');
  helpLink.className   = 'cx-help-link';
  helpLink.textContent = def.helpText;
  helpLink.href        = '#';
  helpLink.addEventListener('click', e => {
    e.preventDefault();
    const a = Object.assign(document.createElement('a'), { href: def.helpUrl, target: '_blank', rel: 'noopener noreferrer' });
    a.click();
  });
  actions.appendChild(helpLink);

  const btnGroup   = document.createElement('div');
  btnGroup.className = 'cx-btn-group';

  if (isConnected) {
    const updateBtn = document.createElement('button');
    updateBtn.className   = 'cx-secondary-btn';
    updateBtn.textContent = 'Update credentials';
    updateBtn.addEventListener('click', () => { fieldsWrap.style.display = ''; updateBtn.style.display = 'none'; });
    btnGroup.appendChild(updateBtn);

    const disconnectBtn = document.createElement('button');
    disconnectBtn.className   = 'cx-disconnect-btn';
    disconnectBtn.textContent = 'Disconnect';
    disconnectBtn.addEventListener('click', () => handleDisconnect(def.id));
    btnGroup.appendChild(disconnectBtn);
  } else {
    const connectBtn = document.createElement('button');
    connectBtn.id          = `cx-connect-btn-${def.id}`;
    connectBtn.className   = 'cx-connect-btn';
    connectBtn.textContent = def.oauthFlow ? 'Sign in with Google' : `Connect ${def.name}`;
    connectBtn.addEventListener('click', () => handleConnect(def.id, def));
    btnGroup.appendChild(connectBtn);
  }

  actions.appendChild(btnGroup);
  card.appendChild(actions);
  return card;
}

/* ══════════════════════════════════════════
   RENDER
══════════════════════════════════════════ */
function renderPanel() {
  const list = document.getElementById('connector-list');
  if (!list) return;
  list.innerHTML = '';
  CONNECTORS.forEach(def => list.appendChild(buildCard(def)));
}

/* ══════════════════════════════════════════
   CONNECT HANDLERS
══════════════════════════════════════════ */
async function handleConnect(id, def) {
  def.oauthFlow ? await handleOAuthConnect(id, def) : await handleTokenConnect(id, def);
}

async function handleOAuthConnect(id, def) {
  const credentials = cxState.pending[id] ?? {};
  const missing = def.fields.filter(f => !credentials[f.key]?.trim());
  if (missing.length) {
    setStatus(id, `Please fill in: ${missing.map(f => f.label).join(', ')}`, 'error'); return;
  }

  setConnectBtnState(id, true, 'Opening Google sign-in…');
  setStatus(id, 'A sign-in window will open — grant access and come back.');

  try {
    const result = await window.electronAPI?.gmailOAuthStart?.(credentials.clientId, credentials.clientSecret);
    if (!result?.ok) throw new Error(result?.error ?? 'OAuth failed');

    cxState.statuses[id] = { enabled: true, connectedAt: new Date().toISOString(), accountInfo: { email: result.email } };
    cxState.pending[id]  = {};
    setStatus(id, `Connected as ${result.email} ✓`, 'success');
    setTimeout(renderPanel, 1000);
  } catch (err) {
    setStatus(id, `Failed: ${err.message}`, 'error');
    setConnectBtnState(id, false, 'Sign in with Google');
  }
}

async function handleTokenConnect(id, def) {
  const credentials = cxState.pending[id] ?? {};
  const missing = def.fields.filter(f => !credentials[f.key]?.trim());
  if (missing.length) {
    setStatus(id, `Please fill in: ${missing.map(f => f.label).join(', ')}`, 'error'); return;
  }

  setConnectBtnState(id, true, 'Connecting…');
  setStatus(id, '');

  try {
    await window.electronAPI?.saveConnector?.(id, credentials);
    const validation = await window.electronAPI?.validateConnector?.(id);
    if (!validation?.ok) throw new Error(validation?.error ?? 'Connection failed');

    cxState.statuses[id] = {
      enabled:     true,
      connectedAt: new Date().toISOString(),
      accountInfo: { email: validation.email ?? null, username: validation.username ?? null },
    };
    cxState.pending[id] = {};
    setStatus(id, 'Connected successfully!', 'success');
    setTimeout(renderPanel, 900);
  } catch (err) {
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
    renderPanel();
  } catch (err) {
    setStatus(id, `Could not disconnect: ${err.message}`, 'error');
  }
}

/* ══════════════════════════════════════════
   LOAD PANEL  (called by User.js on tab switch)
══════════════════════════════════════════ */
export async function loadConnectorsPanel() {
  const list = document.getElementById('connector-list');
  if (!list) return;
  if (!cxState.loaded) list.innerHTML = '<div class="cx-loading">Loading connectors…</div>';

  try {
    const statuses = await window.electronAPI?.getConnectors?.() ?? {};
    cxState.statuses = {};
    for (const [name, s] of Object.entries(statuses))
      cxState.statuses[name] = { ...s, accountInfo: null };

    await Promise.all(
      Object.entries(cxState.statuses)
        .filter(([, s]) => s.enabled)
        .map(async ([name]) => {
          const v = await window.electronAPI?.validateConnector?.(name).catch(() => null);
          if (v?.ok) cxState.statuses[name].accountInfo = { email: v.email ?? null, username: v.username ?? null };
        }),
    );

    cxState.loaded = true;
    renderPanel();
  } catch (err) {
    if (list) list.innerHTML = `<div class="cx-loading">Could not load connectors: ${err.message}</div>`;
  }
}
