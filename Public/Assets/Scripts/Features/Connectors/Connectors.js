// ─────────────────────────────────────────────
//  openworld — Public/Assets/Scripts/Features/Connectors/Connectors.js
//  Renders connector cards and handles connect/disconnect/toggle flows.
//  Includes service connectors (Gmail, GitHub) and free API connectors.
// ─────────────────────────────────────────────

/* ══════════════════════════════════════════
   SERVICE CONNECTORS  (require credentials)
══════════════════════════════════════════ */
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
   FREE API CONNECTORS  (enabled by default)
══════════════════════════════════════════ */
const FREE_CONNECTORS = [
  {
    id:          'open_meteo',
    name:        'Open-Meteo',
    icon:        '🌤️',
    description: 'Real-time weather for any city — temperature, humidity, wind, and 3-day forecast.',
    noKey:       true,
    docsUrl:     'https://open-meteo.com',
    tools:       ['get_weather'],
    toolHint:    'Ask: "What\'s the weather in Tokyo?" or "Will it rain in Mumbai tomorrow?"',
  },
  {
    id:          'coingecko',
    name:        'CoinGecko',
    icon:        '🦎',
    description: 'Live crypto prices, market caps, 24h changes, and trending coins. 10,000+ tokens.',
    noKey:       true,
    docsUrl:     'https://coingecko.com',
    tools:       ['get_crypto_price', 'get_crypto_trending'],
    toolHint:    'Ask: "What\'s the price of Ethereum?" or "What coins are trending right now?"',
  },
  {
    id:          'exchange_rate',
    name:        'Exchange Rates',
    icon:        '💱',
    description: 'Real-time currency exchange rates for 160+ currencies. Powered by open.er-api.com.',
    noKey:       true,
    docsUrl:     'https://open.er-api.com',
    tools:       ['get_exchange_rate'],
    toolHint:    'Ask: "Convert 100 USD to INR" or "What\'s the EUR/GBP rate?"',
  },
  {
    id:          'treasury',
    name:        'US Treasury',
    icon:        '🏛️',
    description: 'Official US government fiscal data — national debt, treasury rates, and daily cash balance.',
    noKey:       true,
    docsUrl:     'https://fiscaldata.treasury.gov',
    tools:       ['get_treasury_data'],
    toolHint:    'Ask: "What is the current US national debt?" or "Show US treasury interest rates"',
  },
  {
    id:          'fred',
    name:        'Federal Reserve (FRED)',
    icon:        '📊',
    description: 'Economic indicators from the St. Louis Fed — GDP, unemployment, CPI, interest rates, and hundreds more.',
    noKey:       false,
    optionalKey: true,
    keyLabel:    'FRED API Key',
    keyPlaceholder: 'Get your free key at fred.stlouisfed.org',
    keyHint:     'Free key at fred.stlouisfed.org/docs/api/api_key.html — unlocks full access to 800,000+ series.',
    docsUrl:     'https://fred.stlouisfed.org/docs/api/api_key.html',
    tools:       ['get_fred_data'],
    toolHint:    'Ask: "Show me US GDP" or "What\'s the current unemployment rate?" or "What\'s the inflation rate?"',
  },
  {
    id:          'openweathermap',
    name:        'OpenWeatherMap',
    icon:        '🌦️',
    description: 'Detailed weather with hourly forecasts, air quality, and historical data. Free tier included.',
    noKey:       false,
    optionalKey: false,
    keyLabel:    'OpenWeatherMap API Key',
    keyPlaceholder: 'Get your free key at openweathermap.org/api',
    keyHint:     'Register at openweathermap.org/api — free tier allows 1,000 calls/day.',
    docsUrl:     'https://openweathermap.org/api',
    tools:       ['get_weather'],
    toolHint:    'Works alongside Open-Meteo for richer weather data when a key is provided.',
  },
  {
    id:          'unsplash',
    name:        'Unsplash',
    icon:        '📷',
    description: 'Search millions of high-quality free photos by topic. Get image URLs and photographer credits.',
    noKey:       false,
    optionalKey: false,
    keyLabel:    'Unsplash Access Key',
    keyPlaceholder: 'Get your free key at unsplash.com/developers',
    keyHint:     'Register at unsplash.com/oauth/applications — free tier: 50 requests/hour.',
    docsUrl:     'https://unsplash.com/developers',
    tools:       ['search_photos'],
    toolHint:    'Ask: "Find me photos of minimal workspace setups" or "Search for sunset mountain photos"',
  },
  {
    id:          'wikipedia',
    name:        'Wikipedia',
    icon:        '📚',
    description: 'Search any topic on Wikipedia — get summaries, descriptions, and direct links.',
    noKey:       true,
    docsUrl:     'https://en.wikipedia.org',
    tools:       ['search_wikipedia'],
    toolHint:    'Ask: "Tell me about quantum computing" or "Search Wikipedia for the Roman Empire"',
  },

  {
    id:          'ipgeo',
    name:        'IP Geolocation',
    icon:        '🌍',
    description: 'Look up geolocation, ISP, and timezone info for any IP address — or your own.',
    noKey:       true,
    docsUrl:     'https://ip-api.com',
    tools:       ['get_ip_info'],
    toolHint:    'Ask: "What\'s my IP location?" or "Where is 8.8.8.8 located?"',
  },
  {
    id:          'funfacts',
    name:        'Fun Facts & Trivia',
    icon:        '🎲',
    description: 'Random fun facts, number trivia, math facts, and historical date facts.',
    noKey:       true,
    docsUrl:     'https://uselessfacts.jsph.pl',
    tools:       ['get_random_fact', 'get_number_fact'],
    toolHint:    'Ask: "Give me a random fact" or "Tell me something about the number 42"',
  },
  {
    id:          'jokeapi',
    name:        'Jokes',
    icon:        '😂',
    description: 'Random jokes — programming, puns, misc, and more. Family-friendly filter included.',
    noKey:       true,
    docsUrl:     'https://v2.jokeapi.dev',
    tools:       ['get_joke'],
    toolHint:    'Ask: "Tell me a joke" or "Give me a programming joke"',
  },
  {
    id:          'quotes',
    name:        'Quotes',
    icon:        '💬',
    description: 'Inspirational and thought-provoking quotes from famous authors, leaders, and thinkers.',
    noKey:       true,
    docsUrl:     'https://zenquotes.io',
    tools:       ['get_quote'],
    toolHint:    'Ask: "Give me an inspirational quote" or "Quote about wisdom"',
  },
  {
    id:          'restcountries',
    name:        'Country Info',
    icon:        '🌐',
    description: 'Detailed country data — capital, population, languages, currencies, timezones, borders, and more.',
    noKey:       true,
    docsUrl:     'https://restcountries.com',
    tools:       ['get_country_info'],
    toolHint:    'Ask: "Tell me about Japan" or "What are the languages spoken in India?"',
  },
  {
    id:          'nasa',
    name:        'NASA / Astronomy',
    icon:        '🔭',
    description: 'NASA Astronomy Picture of the Day and real-time ISS tracking with crew info.',
    noKey:       false,
    optionalKey: true,
    keyLabel:    'NASA API Key',
    keyPlaceholder: 'Get your free key at api.nasa.gov',
    keyHint:     'Register at api.nasa.gov — free key with 1,000 req/hr. Works without a key using DEMO_KEY (30 req/hr).',
    docsUrl:     'https://api.nasa.gov',
    tools:       ['get_apod', 'get_iss_location'],
    toolHint:    'Ask: "Show me NASA\'s picture of the day" or "Where is the ISS right now?"',
  },
  {
    id:          'hackernews',
    name:        'Hacker News',
    icon:        '🔶',
    description: 'Top stories from Hacker News (Y Combinator) — the leading tech and startup news aggregator.',
    noKey:       true,
    docsUrl:     'https://news.ycombinator.com',
    tools:       ['get_hacker_news'],
    toolHint:    'Ask: "What\'s on Hacker News?" or "Show me the top tech stories"',
  },

  {
    id:          'cleanuri',
    name:        'URL Shortener',
    icon:        '🔗',
    description: 'Shorten any long URL into a compact, shareable link.',
    noKey:       true,
    docsUrl:     'https://cleanuri.com',
    tools:       ['shorten_url'],
    toolHint:    'Ask: "Shorten this URL: https://example.com/very/long/path"',
  },
  {
    id:          'local_system',
    name:        'Local System',
    icon:        '💻',
    description: 'Grant the AI permission to access your local file system, run terminal commands, and create/edit local code files.',
    noKey:       true,
    docsUrl:     '#',
    tools:       ['run_shell_command', 'read_local_file', 'list_directory', 'write_file', 'create_folder', 'open_folder', 'start_local_server'],
    toolHint:    'Lets you build tools and manage files directly on your system.',
  },
];

/* ══════════════════════════════════════════
   MODULE STATE
══════════════════════════════════════════ */
const cxState = {
  loaded:        false,
  statuses:      {},    // service connector statuses
  freeStatuses:  {},    // free connector enabled states
  freeKeys:      {},    // pending key edits for free connectors
  pending:       {},    // pending credential edits for service connectors
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
   SERVICE CONNECTOR CARD BUILDER
══════════════════════════════════════════ */
function buildCard(def) {
  const status      = cxState.statuses[def.id] ?? { enabled: false };
  const isConnected = Boolean(status.enabled);

  const card = document.createElement('div');
  card.className = `cx-card${isConnected ? ' cx-connected' : ''}`;
  card.id        = `cx-card-${def.id}`;

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

  const caps = document.createElement('div');
  caps.className = 'cx-capabilities';
  def.capabilities.forEach(cap => {
    const tag = document.createElement('span');
    tag.className   = 'cx-cap-tag';
    tag.textContent = cap;
    caps.appendChild(tag);
  });
  card.appendChild(caps);

  if (isConnected && status.accountInfo) {
    const info    = document.createElement('div');
    info.className = 'cx-account-info';
    const display = status.accountInfo.email || status.accountInfo.username || 'Connected';
    info.innerHTML = `
      <div class="cx-account-avatar">${display[0].toUpperCase()}</div>
      <span>${display}</span>`;
    card.appendChild(info);
  }

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

  const statusEl   = document.createElement('div');
  statusEl.className = 'cx-status-msg';
  statusEl.id        = `cx-status-${def.id}`;
  card.appendChild(statusEl);

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
   FREE API CONNECTOR CARD BUILDER
══════════════════════════════════════════ */
function buildFreeCard(def) {
  const isEnabled = cxState.freeStatuses[def.id] ?? true;
  const hasKey    = Boolean(cxState.freeKeys[def.id]?.saved);

  const card = document.createElement('div');
  card.className = `cx-free-card${isEnabled ? ' cx-free-enabled' : ' cx-free-disabled'}`;
  card.id = `cx-free-card-${def.id}`;

  // ── Header ──────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'cx-free-header';
  header.innerHTML = `
    <div class="cx-free-icon">${def.icon}</div>
    <div class="cx-free-info">
      <div class="cx-free-name">
        ${def.name}
        ${def.noKey ? '<span class="cx-free-badge">Free · No key</span>' : def.optionalKey ? '<span class="cx-free-badge cx-free-badge--optional">Free · Optional key</span>' : '<span class="cx-free-badge cx-free-badge--key">Free key required</span>'}
      </div>
      <div class="cx-free-desc">${def.description}</div>
    </div>`;

  // Toggle switch
  const toggleWrap = document.createElement('label');
  toggleWrap.className = 'cx-free-toggle';
  toggleWrap.title = isEnabled ? 'Click to disable' : 'Click to enable';
  toggleWrap.innerHTML = `
    <input type="checkbox" class="cx-free-toggle-input" ${isEnabled ? 'checked' : ''} />
    <span class="cx-free-toggle-track"></span>`;
  toggleWrap.querySelector('.cx-free-toggle-input').addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    cxState.freeStatuses[def.id] = enabled;
    card.classList.toggle('cx-free-enabled', enabled);
    card.classList.toggle('cx-free-disabled', !enabled);
    toggleWrap.title = enabled ? 'Click to disable' : 'Click to enable';
    await window.electronAPI?.toggleFreeConnector?.(def.id, enabled);
  });

  header.appendChild(toggleWrap);
  card.appendChild(header);

  // ── Tool hint ────────────────────────────────────────────
  if (def.toolHint) {
    const hint = document.createElement('div');
    hint.className = 'cx-free-tool-hint';
    hint.innerHTML = `<span class="cx-free-tool-hint-icon">💬</span> ${def.toolHint}`;
    card.appendChild(hint);
  }

  // ── Optional / required API key field ───────────────────
  if (!def.noKey) {
    const keySection = document.createElement('div');
    keySection.className = 'cx-free-key-section';

    const keyLabel = document.createElement('div');
    keyLabel.className = 'cx-free-key-label';
    keyLabel.textContent = def.keyLabel;

    const keyWrap = document.createElement('div');
    keyWrap.className = 'cx-free-key-wrap key-input-wrap';

    const keyInput = document.createElement('input');
    keyInput.type = 'password';
    keyInput.className = 'cx-field-input cx-free-key-input';
    keyInput.id = `cx-free-key-${def.id}`;
    keyInput.placeholder = def.keyPlaceholder;
    keyInput.autocomplete = 'off';
    keyInput.spellcheck = false;
    // Pre-fill saved key (masked)
    if (cxState.freeKeys[def.id]?.saved) {
      keyInput.value = cxState.freeKeys[def.id].value ?? '';
    }

    const eyeBtn = document.createElement('button');
    eyeBtn.type = 'button';
    eyeBtn.className = 'key-eye';
    eyeBtn.title = 'Show / hide';
    eyeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke-width="1.8"/><circle cx="12" cy="12" r="3" stroke-width="1.8"/></svg>`;
    eyeBtn.addEventListener('click', () => {
      keyInput.type = keyInput.type === 'password' ? 'text' : 'password';
    });

    keyWrap.append(keyInput, eyeBtn);

    const keyHint = document.createElement('div');
    keyHint.className = 'cx-field-hint';
    keyHint.textContent = def.keyHint;

    const keyActions = document.createElement('div');
    keyActions.className = 'cx-free-key-actions';

    const saveKeyBtn = document.createElement('button');
    saveKeyBtn.className = 'cx-connect-btn cx-free-save-btn';
    saveKeyBtn.textContent = 'Save key';
    saveKeyBtn.addEventListener('click', async () => {
      const val = keyInput.value.trim();
      saveKeyBtn.disabled = true;
      saveKeyBtn.textContent = 'Saving…';
      const res = await window.electronAPI?.saveFreeConnectorKey?.(def.id, val);
      if (res?.ok !== false) {
        cxState.freeKeys[def.id] = { saved: true, value: val };
        saveKeyBtn.textContent = '✓ Saved';
        setFreeStatus(def.id, val ? `Key saved — ${def.name} is ready.` : 'Key cleared.', 'success');
        setTimeout(() => { saveKeyBtn.disabled = false; saveKeyBtn.textContent = 'Save key'; }, 2000);
      } else {
        setFreeStatus(def.id, `Error: ${res.error}`, 'error');
        saveKeyBtn.disabled = false;
        saveKeyBtn.textContent = 'Save key';
      }
    });

    const docsLink = document.createElement('a');
    docsLink.className = 'cx-help-link';
    docsLink.textContent = 'Get free key →';
    docsLink.href = '#';
    docsLink.addEventListener('click', e => {
      e.preventDefault();
      const a = Object.assign(document.createElement('a'), { href: def.docsUrl, target: '_blank', rel: 'noopener noreferrer' });
      a.click();
    });

    keyActions.append(docsLink, saveKeyBtn);
    keySection.append(keyLabel, keyWrap, keyHint, keyActions);

    // Status message
    const statusEl = document.createElement('div');
    statusEl.className = 'cx-status-msg';
    statusEl.id = `cx-free-status-${def.id}`;
    keySection.appendChild(statusEl);

    card.appendChild(keySection);
  }

  return card;
}

function setFreeStatus(id, message, type = '') {
  const el = document.getElementById(`cx-free-status-${id}`);
  if (!el) return;
  el.textContent = message;
  el.className   = `cx-status-msg${message && type ? ` ${type}` : ''}`;
}

/* ══════════════════════════════════════════
   RENDER PANEL
══════════════════════════════════════════ */
function renderPanel() {
  const list = document.getElementById('connector-list');
  if (!list) return;
  list.innerHTML = '';

  // ── Section: Service Connectors ──────────
  const svcHeader = document.createElement('div');
  svcHeader.className = 'cx-section-header';
  svcHeader.innerHTML = `
    <div class="cx-section-title">
      <span class="cx-section-icon">🔌</span>
      Service Connectors
    </div>
    <div class="cx-section-sub">Requires authentication</div>`;
  list.appendChild(svcHeader);

  CONNECTORS.forEach(def => list.appendChild(buildCard(def)));

  // ── Section: Free APIs ───────────────────
  const freeHeader = document.createElement('div');
  freeHeader.className = 'cx-section-header cx-section-header--free';
  freeHeader.innerHTML = `
    <div class="cx-section-title">
      <span class="cx-section-icon">⚡</span>
      Free APIs
    </div>
    <div class="cx-section-sub">Enabled by default · Toggle to disable</div>`;
  list.appendChild(freeHeader);

  FREE_CONNECTORS.forEach(def => list.appendChild(buildFreeCard(def)));
}

/* ══════════════════════════════════════════
   SERVICE CONNECTOR HANDLERS
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
   LOAD PANEL  (called by SettingsModal on tab switch)
══════════════════════════════════════════ */
export async function loadConnectorsPanel() {
  const list = document.getElementById('connector-list');
  if (!list) return;
  if (!cxState.loaded) list.innerHTML = '<div class="cx-loading">Loading connectors…</div>';

  try {
    // Load service connector statuses
    const statuses = await window.electronAPI?.getConnectors?.() ?? {};
    cxState.statuses = {};
    for (const [name, s] of Object.entries(statuses)) {
      if (!s.isFree) {
        cxState.statuses[name] = { ...s, accountInfo: null };
      }
    }

    // Validate service connectors
    await Promise.all(
      Object.entries(cxState.statuses)
        .filter(([, s]) => s.enabled)
        .map(async ([name]) => {
          const v = await window.electronAPI?.validateConnector?.(name).catch(() => null);
          if (v?.ok) cxState.statuses[name].accountInfo = { email: v.email ?? null, username: v.username ?? null };
        }),
    );

    // Load free connector statuses and keys
    for (const def of FREE_CONNECTORS) {
      const config = await window.electronAPI?.getFreeConnectorConfig?.(def.id).catch(() => null);
      if (config) {
        cxState.freeStatuses[def.id] = config.enabled ?? true;
        if (!def.noKey && config.credentials?.apiKey) {
          cxState.freeKeys[def.id] = { saved: true, value: config.credentials.apiKey };
        }
      } else {
        cxState.freeStatuses[def.id] = true; // default enabled
      }
    }

    cxState.loaded = true;
    renderPanel();
  } catch (err) {
    if (list) list.innerHTML = `<div class="cx-loading">Could not load connectors: ${err.message}</div>`;
  }
}
