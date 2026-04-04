import { CONNECTORS, FREE_CONNECTORS, loadFeatureConnectorDefs } from './Catalog/ConnectorDefs.js';
import { buildFreeCard, setStatus, setConnectBtnState } from './Catalog/ConnectorCards.js';

export const cxState = {
  statuses: {},
  pending: {},
  freeStatuses: {},
  freeKeys: {},
  loaded: false,
};

// SERVICE BADGE RENDERER
function buildServiceBadges(def, services = {}) {
  if (!def.subServices?.length) return null;

  const wrap = document.createElement('div');
  wrap.className = 'cx-service-badges';
  wrap.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 4px;';

  for (const svc of def.subServices) {
    const enabled = services[svc.key] === true;
    const badge = document.createElement('div');
    badge.className = `cx-service-badge ${enabled ? 'cx-service-badge--on' : 'cx-service-badge--off'}`;
    badge.style.cssText = `
      display:inline-flex;align-items:center;gap:5px;
      padding:4px 10px;border-radius:20px;font-size:12px;font-family:var(--font-ui);
      border:1px solid ${enabled ? 'var(--color-border-success)' : 'var(--color-border-tertiary)'};
      background:${enabled ? 'var(--color-background-success)' : 'var(--color-background-secondary)'};
      color:${enabled ? 'var(--color-text-success)' : 'var(--color-text-secondary)'};
      cursor:${enabled ? 'default' : 'pointer'};
    `;

    const dot = document.createElement('span');
    dot.textContent = enabled ? '●' : '○';
    dot.style.fontSize = '8px';

    const label = document.createElement('span');
    label.textContent = `${svc.icon} ${svc.name}`;

    badge.append(dot, label);

    // Clicking a disabled badge opens the Google Cloud API enable page
    if (!enabled) {
      badge.title = `${svc.name} API not detected. Click to enable it in Google Cloud.`;
      badge.addEventListener('click', () => {
        const a = Object.assign(document.createElement('a'), {
          href: svc.apiUrl,
          target: '_blank',
          rel: 'noopener noreferrer',
        });
        a.click();
      });
    }

    wrap.appendChild(badge);
  }

  return wrap;
}

// SETUP STEPS (shown before connecting)
function buildSetupSteps(def) {
  if (!def.setupSteps?.length) return null;

  const wrap = document.createElement('div');
  wrap.style.cssText = 'margin:10px 0;';

  const title = document.createElement('div');
  title.style.cssText =
    'font-size:11px;font-weight:500;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;';
  title.textContent = 'Setup steps';
  wrap.appendChild(title);

  def.setupSteps.forEach((step, i) => {
    const row = document.createElement('div');
    row.style.cssText =
      'display:flex;gap:8px;align-items:flex-start;margin-bottom:4px;font-size:12px;color:var(--text-secondary);';
    row.innerHTML = `<span style="min-width:16px;font-weight:500;color:var(--text-muted)">${i + 1}.</span><span>${step}</span>`;
    wrap.appendChild(row);
  });

  return wrap;
}

// UNIFIED CONNECTOR CARD
// Handles both OAuth (Google) and token-based (GitHub) connectors
function buildCard(def, cxState, onConnect, onDisconnect) {
  const status = cxState.statuses[def.id] ?? { enabled: false };
  const isConnected = Boolean(status.enabled);
  const services = status.services ?? {};

  const card = document.createElement('div');
  card.className = `cx-card${isConnected ? ' cx-connected' : ''}`;
  card.id = `cx-card-${def.id}`;

  // Header
  const header = document.createElement('div');
  header.className = 'cx-card-header';
  header.innerHTML = `
    <div class="cx-icon">${def.icon}</div>
    <div class="cx-info">
      <h4>${def.name}</h4>
      <p>${def.description}</p>
    </div>
    <span class="cx-badge ${isConnected ? 'cx-badge--on' : 'cx-badge--off'}">
      ${isConnected ? 'Connected' : 'Not connected'}
    </span>`;
  card.appendChild(header);

  // Capabilities
  const caps = document.createElement('div');
  caps.className = 'cx-capabilities';
  (def.capabilities ?? []).forEach((cap) => {
    const tag = document.createElement('span');
    tag.className = 'cx-cap-tag';
    tag.textContent = cap;
    caps.appendChild(tag);
  });
  card.appendChild(caps);

  // Account info
  if (isConnected && status.accountInfo) {
    const info = document.createElement('div');
    info.className = 'cx-account-info';
    const display = status.accountInfo.email || status.accountInfo.username || 'Connected';
    info.innerHTML = `<div class="cx-account-avatar">${display[0].toUpperCase()}</div><span>${display}</span>`;
    card.appendChild(info);
  }

  //Service badges (Google only shown when connected)
  if (isConnected && def.subServices?.length) {
    const badgesEl = buildServiceBadges(def, services);
    if (badgesEl) {
      const badgeWrap = document.createElement('div');
      badgeWrap.style.cssText = 'padding:0 16px 4px;';

      const badgeLabel = document.createElement('div');
      badgeLabel.style.cssText =
        'font-size:11px;font-weight:500;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;';
      badgeLabel.textContent = 'Detected services';
      badgeWrap.appendChild(badgeLabel);
      badgeWrap.appendChild(badgesEl);

      if (def.featureId && def.serviceRefreshMethod) {
        const refreshBtn = document.createElement('button');
        refreshBtn.style.cssText =
          'font-size:11px;color:var(--text-muted);background:none;border:none;cursor:pointer;padding:4px 0;text-decoration:underline;';
        refreshBtn.textContent = 'Re-check services';
        refreshBtn.addEventListener('click', async () => {
          refreshBtn.textContent = 'Checking...';
          refreshBtn.disabled = true;
          const res = await window.featureAPI?.invoke?.(
            def.featureId,
            def.serviceRefreshMethod,
            {},
          );
          if (res?.ok) {
            cxState.statuses[def.id] = { ...cxState.statuses[def.id], services: res.services };
            renderPanel();
          } else {
            refreshBtn.textContent = `Error: ${res?.error ?? 'Unknown'}`;
            setTimeout(() => {
              refreshBtn.textContent = 'Re-check services';
              refreshBtn.disabled = false;
            }, 3000);
          }
        });
        badgeWrap.appendChild(refreshBtn);
      }
      card.appendChild(badgeWrap);
    }
  }

  // Automations
  if (def.automations?.length) {
    const autoSec = document.createElement('div');
    autoSec.className = 'cx-auto-section';
    autoSec.innerHTML = `<div class="cx-auto-label">Suggested Automations</div>`;
    def.automations.forEach((a) => {
      const item = document.createElement('div');
      item.className = 'cx-auto-item';
      item.innerHTML = `<strong>${a.name}</strong> - <span>${a.description}</span>`;
      autoSec.appendChild(item);
    });
    card.appendChild(autoSec);
  }

  // Status message
  const statusEl = document.createElement('div');
  statusEl.className = 'cx-status-msg';
  statusEl.id = `cx-status-${def.id}`;
  card.appendChild(statusEl);

  // Fields (only shown when not connected or when updating)
  const fieldsWrap = document.createElement('div');
  fieldsWrap.className = 'cx-fields';
  fieldsWrap.id = `cx-fields-${def.id}`;
  if (isConnected) fieldsWrap.style.display = 'none';

  // Setup steps go inside the fields section (pre-connection guidance)
  if (!isConnected && def.setupSteps?.length) {
    const stepsEl = buildSetupSteps(def);
    if (stepsEl) fieldsWrap.appendChild(stepsEl);
  }

  def.fields.forEach((field) => {
    const wrap = document.createElement('div');
    wrap.className = 'cx-field-wrap';

    const label = document.createElement('label');
    label.className = 'cx-field-label';
    label.textContent = field.label;
    label.htmlFor = `cx-field-${def.id}-${field.key}`;

    const inputWrap = document.createElement('div');
    inputWrap.className = 'key-input-wrap';

    const input = document.createElement('input');
    input.id = `cx-field-${def.id}-${field.key}`;
    input.type = field.type === 'password' ? 'password' : 'text';
    input.className = 'cx-field-input';
    input.placeholder = field.placeholder;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.addEventListener('input', () => {
      if (!cxState.pending[def.id]) cxState.pending[def.id] = {};
      cxState.pending[def.id][field.key] = input.value.trim();
    });

    inputWrap.appendChild(input);

    if (field.type === 'password') {
      const eyeBtn = document.createElement('button');
      eyeBtn.type = 'button';
      eyeBtn.className = 'key-eye';
      eyeBtn.title = 'Show / hide';
      eyeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke-width="1.8"/><circle cx="12" cy="12" r="3" stroke-width="1.8"/></svg>`;
      eyeBtn.addEventListener('click', () => {
        input.type = input.type === 'password' ? 'text' : 'password';
      });
      inputWrap.appendChild(eyeBtn);
    }

    wrap.append(label, inputWrap);

    if (field.hint) {
      const hint = document.createElement('div');
      hint.className = 'cx-field-hint';
      hint.textContent = field.hint;
      wrap.appendChild(hint);
    }

    fieldsWrap.appendChild(wrap);
  });

  card.appendChild(fieldsWrap);

  // Actions row
  const actions = document.createElement('div');
  actions.className = 'cx-actions';

  const helpLink = document.createElement('a');
  helpLink.className = 'cx-help-link';
  helpLink.textContent = def.helpText;
  helpLink.href = '#';
  helpLink.addEventListener('click', (e) => {
    e.preventDefault();
    const a = Object.assign(document.createElement('a'), {
      href: def.helpUrl,
      target: '_blank',
      rel: 'noopener noreferrer',
    });
    a.click();
  });
  actions.appendChild(helpLink);

  const btnGroup = document.createElement('div');
  btnGroup.className = 'cx-btn-group';

  if (isConnected) {
    const updateBtn = document.createElement('button');
    updateBtn.className = 'cx-secondary-btn';
    updateBtn.textContent = 'Update credentials';
    updateBtn.addEventListener('click', () => {
      fieldsWrap.style.display = '';
      updateBtn.style.display = 'none';
    });
    btnGroup.appendChild(updateBtn);

    const disconnectBtn = document.createElement('button');
    disconnectBtn.className = 'cx-disconnect-btn';
    disconnectBtn.textContent = 'Disconnect';
    disconnectBtn.addEventListener('click', () => onDisconnect(def.id));
    btnGroup.appendChild(disconnectBtn);
  } else {
    const connectBtn = document.createElement('button');
    connectBtn.id = `cx-connect-btn-${def.id}`;
    connectBtn.className = 'cx-connect-btn';
    connectBtn.textContent =
      def.connectLabel ??
      (def.oauthType === 'google' ? 'Sign in with Google' : `Connect ${def.name}`);
    connectBtn.addEventListener('click', () => onConnect(def.id, def));
    btnGroup.appendChild(connectBtn);
  }

  actions.appendChild(btnGroup);
  card.appendChild(actions);

  return card;
}

// RENDER PANEL
function renderPanel() {
  const list = document.getElementById('connector-list');
  if (!list) return;
  list.innerHTML = '';

  const svcHeader = document.createElement('div');
  svcHeader.className = 'cx-section-header';
  svcHeader.innerHTML = `
    <div class="cx-section-title">Service Connectors</div>
    <div class="cx-section-sub">Requires authentication</div>`;
  list.appendChild(svcHeader);

  CONNECTORS.forEach((def) =>
    list.appendChild(buildCard(def, cxState, handleConnect, handleDisconnect)),
  );

  const freeHeader = document.createElement('div');
  freeHeader.className = 'cx-section-header cx-section-header--free';
  freeHeader.innerHTML = `
    <div class="cx-section-title">Free APIs</div>
    <div class="cx-section-sub">Enabled by default, toggle to disable</div>`;
  list.appendChild(freeHeader);

  FREE_CONNECTORS.forEach((def) => list.appendChild(buildFreeCard(def, cxState)));
}

//CONNECT HANDLERS
async function handleConnect(id, def) {
  if (def.featureId && def.connectMethod) {
    await handleFeatureConnect(id, def);
  } else {
    await handleTokenConnect(id, def);
  }
}

async function handleFeatureConnect(id, def) {
  const credentials = cxState.pending[id] ?? {};
  const missing = def.fields.filter((f) => !credentials[f.key]?.trim());
  if (missing.length) {
    setStatus(id, `Please fill in: ${missing.map((f) => f.label).join(', ')}`, 'error');
    return;
  }

  setConnectBtnState(id, true, def.connectingLabel ?? 'Connecting...');
  if (def.oauthType) {
    setStatus(id, 'A browser window will open - sign in, grant access, then return here.');
  } else {
    setStatus(id, '');
  }

  try {
    const result = await window.featureAPI?.invoke?.(def.featureId, def.connectMethod, credentials);
    if (!result?.ok) throw new Error(result?.error ?? 'Connection failed');

    const enabledCount = Object.values(result.services ?? {}).filter(Boolean).length;
    cxState.statuses[id] = {
      enabled: true,
      connectedAt: new Date().toISOString(),
      accountInfo: result.accountInfo ?? {
        email: result.email ?? null,
        username: result.username ?? null,
      },
      services: result.services ?? {},
    };
    cxState.pending[id] = {};
    const defaultMessage = result.email ? `Connected as ${result.email}` : `Connected ${def.name}`;
    const serviceMessage = enabledCount
      ? ` - ${enabledCount} service${enabledCount !== 1 ? 's' : ''} detected`
      : '';
    setStatus(id, result.message ?? `${defaultMessage}${serviceMessage}`, 'success');
    setTimeout(renderPanel, 800);
  } catch (err) {
    setStatus(id, `Failed: ${err.message}`, 'error');
    setConnectBtnState(id, false, def.connectLabel ?? `Connect ${def.name}`);
  }
}

async function handleTokenConnect(id, def) {
  const credentials = cxState.pending[id] ?? {};
  const missing = def.fields.filter((f) => !credentials[f.key]?.trim());
  if (missing.length) {
    setStatus(id, `Please fill in: ${missing.map((f) => f.label).join(', ')}`, 'error');
    return;
  }

  setConnectBtnState(id, true, 'Connecting...');
  setStatus(id, '');

  try {
    await window.electronAPI?.invoke?.('save-connector', id, credentials);
    const validation = await window.electronAPI?.invoke?.('validate-connector', id);
    if (!validation?.ok) throw new Error(validation?.error ?? 'Connection failed');

    cxState.statuses[id] = {
      enabled: true,
      connectedAt: new Date().toISOString(),
      accountInfo: { email: validation.email ?? null, username: validation.username ?? null },
      services: {},
    };
    cxState.pending[id] = {};
    setStatus(id, 'Connected successfully!', 'success');
    setTimeout(renderPanel, 800);
  } catch (err) {
    await window.electronAPI?.invoke?.('remove-connector', id).catch(() => {});
    cxState.statuses[id] = { enabled: false };
    setStatus(id, `Failed: ${err.message}`, 'error');
    setConnectBtnState(id, false, `Connect ${def.name}`);
  }
}

async function handleDisconnect(id) {
  try {
    await window.electronAPI?.invoke?.('remove-connector', id);
    cxState.statuses[id] = { enabled: false, accountInfo: null, services: {} };
    cxState.pending[id] = {};
    renderPanel();
  } catch (err) {
    setStatus(id, `Could not disconnect: ${err.message}`, 'error');
  }
}

// LOAD PANEL
export async function loadConnectorsPanel() {
  const list = document.getElementById('connector-list');
  if (!list) return;
  if (!cxState.loaded) list.innerHTML = '<div class="cx-loading">Loading connectors...</div>';

  try {
    await loadFeatureConnectorDefs();
    const statuses = (await window.electronAPI?.invoke?.('get-connectors')) ?? {};
    cxState.statuses = {};

    for (const [name, s] of Object.entries(statuses)) {
      if (!s.isFree) {
        cxState.statuses[name] = { ...s, accountInfo: null, services: {} };
      }
    }

    // Validate connected service connectors and load their account info
    await Promise.all(
      Object.entries(cxState.statuses)
        .filter(([, s]) => s.enabled)
        .map(async ([name]) => {
          const v = await window.electronAPI
            ?.invoke?.('validate-connector', name)
            .catch(() => null);
          if (v?.ok) {
            cxState.statuses[name].accountInfo = {
              email: v.email ?? null,
              username: v.username ?? null,
            };
          }
          // For google, also load stored service detection state
          if (name === 'google') {
            const creds = await window.electronAPI
              ?.invoke?.('get-connector-safe-creds', 'google')
              .catch(() => null);
            if (creds?.ok && creds.services) cxState.statuses[name].services = creds.services;
          }
        }),
    );

    for (const def of FREE_CONNECTORS) {
      const config = await window.electronAPI
        ?.invoke?.('get-free-connector-config', def.id)
        .catch(() => null);
      if (config) {
        cxState.freeStatuses[def.id] = config.enabled ?? true;
        if (!def.noKey && config.credentials?.apiKey) {
          cxState.freeKeys[def.id] = { saved: true, value: config.credentials.apiKey };
        }
      } else {
        cxState.freeStatuses[def.id] = true;
      }
    }

    cxState.loaded = true;
    renderPanel();
  } catch (err) {
    if (list)
      list.innerHTML = `<div class="cx-loading">Could not load connectors: ${err.message}</div>`;
  }
}
