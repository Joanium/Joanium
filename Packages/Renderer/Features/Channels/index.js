/* ─────────────────────────────────────────────────────────────────
   Channels panel  —  loaded by SettingsModal on tab switch
   Same pattern as Connectors/index.js and MCP/index.js
───────────────────────────────────────────────────────────────── */

const api = window.electronAPI;

/* ──────────────────────────────────────────────────────────────
   HELPERS
────────────────────────────────────────────────────────────── */
function setFb(channel, msg, tone = '') {
  const el = document.getElementById(`ch-fb-${channel}`);
  if (!el) return;
  el.textContent = msg;
  el.className = `ch-feedback${tone ? ' ' + tone : ''}`;
}

function setStatus(channel, connected) {
  const dot  = document.getElementById(`ch-dot-${channel}`);
  const text = document.getElementById(`ch-status-${channel}`);
  if (dot)  dot.className  = `ch-status-dot${connected ? ' is-on' : ''}`;
  if (text) text.textContent = connected ? 'Connected & active' : 'Not connected';
}

function setToggle(channel, enabled, configured) {
  const t = document.getElementById(`ch-toggle-${channel}`);
  if (!t) return;
  t.checked  = enabled;
  t.disabled = !configured;
}

function setStepsVisible(channel, visible) {
  const el = document.getElementById(`ch-steps-${channel}`);
  if (el) el.hidden = !visible;
}

function setDisconnectVisible(channel, visible) {
  const el = document.getElementById(`ch-disc-${channel}`);
  if (el) el.hidden = !visible;
}

/* ──────────────────────────────────────────────────────────────
   BUILD PANEL HTML
────────────────────────────────────────────────────────────── */
function buildHTML() {
  return `
<div class="ch-panel">

  <!-- ── Telegram card ── -->
  <div class="ch-card" id="ch-card-telegram">
    <div class="ch-card-header">
      <div class="ch-icon ch-icon--telegram">
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
        </svg>
      </div>
      <div class="ch-title-group">
        <div class="ch-name">Telegram</div>
        <div class="ch-status">
          <span class="ch-status-dot" id="ch-dot-telegram"></span>
          <span id="ch-status-telegram">Not connected</span>
        </div>
      </div>
      <label class="ch-toggle" title="Enable / disable">
        <input type="checkbox" class="ch-toggle-input" id="ch-toggle-telegram" disabled />
        <span class="ch-toggle-track"></span>
      </label>
    </div>

    <div class="ch-steps" id="ch-steps-telegram">
      <div class="ch-steps-label">Setup — 30 seconds</div>
      <ol class="ch-steps-list">
        <li>Open Telegram → search <strong>@BotFather</strong></li>
        <li>Send <code>/newbot</code> and follow prompts</li>
        <li>Copy the <strong>bot token</strong> and paste below</li>
      </ol>
    </div>

    <div class="ch-form">
      <div class="ch-field">
        <label class="ch-label" for="ch-tg-token">Bot Token <span class="ch-req">*</span></label>
        <div class="ch-input-wrap">
          <input type="password" id="ch-tg-token" class="ch-input" placeholder="1234567890:ABCdef…" autocomplete="off" spellcheck="false" />
          <button type="button" class="ch-eye" id="ch-eye-tg" title="Show/hide">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </div>
      <div class="ch-actions">
        <button type="button" class="ch-btn-danger" id="ch-disc-telegram" hidden>Disconnect</button>
        <button type="button" class="ch-btn-primary" id="ch-connect-telegram">Connect</button>
      </div>
      <div class="ch-feedback" id="ch-fb-telegram" aria-live="polite"></div>
    </div>
  </div>

  <!-- ── WhatsApp card ── -->
  <div class="ch-card" id="ch-card-whatsapp">
    <div class="ch-card-header">
      <div class="ch-icon ch-icon--whatsapp">
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
        </svg>
      </div>
      <div class="ch-title-group">
        <div class="ch-name">WhatsApp</div>
        <div class="ch-status">
          <span class="ch-status-dot" id="ch-dot-whatsapp"></span>
          <span id="ch-status-whatsapp">Not connected</span>
        </div>
      </div>
      <label class="ch-toggle" title="Enable / disable">
        <input type="checkbox" class="ch-toggle-input" id="ch-toggle-whatsapp" disabled />
        <span class="ch-toggle-track"></span>
      </label>
    </div>

    <div class="ch-steps" id="ch-steps-whatsapp">
      <div class="ch-steps-label">Setup via free Twilio Sandbox — ~3 minutes, zero cost</div>
      <ol class="ch-steps-list">
        <li>Create a free account at <strong>twilio.com</strong> (no card needed for sandbox)</li>
        <li>Go to <strong>Messaging → Try it out → WhatsApp</strong></li>
        <li>Copy <strong>Account SID</strong>, <strong>Auth Token</strong>, and the <strong>sandbox number</strong></li>
        <li>From your phone, send the join code to that number</li>
        <li>Paste all three values below and hit <strong>Connect</strong></li>
      </ol>
    </div>

    <div class="ch-form">
      <div class="ch-fields-row">
        <div class="ch-field">
          <label class="ch-label" for="ch-wa-sid">Account SID <span class="ch-req">*</span></label>
          <input type="text" id="ch-wa-sid" class="ch-input" placeholder="ACxxxxxxxxxxxxxxxx" autocomplete="off" spellcheck="false" />
        </div>
        <div class="ch-field">
          <label class="ch-label" for="ch-wa-token">Auth Token <span class="ch-req">*</span></label>
          <div class="ch-input-wrap">
            <input type="password" id="ch-wa-token" class="ch-input" placeholder="Your auth token" autocomplete="off" spellcheck="false" />
            <button type="button" class="ch-eye" id="ch-eye-wa" title="Show/hide">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
        </div>
      </div>
      <div class="ch-field">
        <label class="ch-label" for="ch-wa-number">Sandbox Number <span class="ch-req">*</span></label>
        <input type="text" id="ch-wa-number" class="ch-input" placeholder="whatsapp:+14155238886" autocomplete="off" spellcheck="false" />
        <div class="ch-hint">Include the <code>whatsapp:</code> prefix as shown in Twilio.</div>
      </div>
      <div class="ch-actions">
        <button type="button" class="ch-btn-danger" id="ch-disc-whatsapp" hidden>Disconnect</button>
        <button type="button" class="ch-btn-primary" id="ch-connect-whatsapp">Connect</button>
      </div>
      <div class="ch-feedback" id="ch-fb-whatsapp" aria-live="polite"></div>
    </div>
  </div>

</div>
  `;
}

/* ──────────────────────────────────────────────────────────────
   WIRE EVENTS  (called once after HTML is injected)
────────────────────────────────────────────────────────────── */
let _wired = false;

function wireEvents() {
  if (_wired) return;
  _wired = true;

  // Eye buttons
  document.getElementById('ch-eye-tg')?.addEventListener('click', () => {
    const i = document.getElementById('ch-tg-token');
    if (i) i.type = i.type === 'password' ? 'text' : 'password';
  });
  document.getElementById('ch-eye-wa')?.addEventListener('click', () => {
    const i = document.getElementById('ch-wa-token');
    if (i) i.type = i.type === 'password' ? 'text' : 'password';
  });

  // Toggles
  document.getElementById('ch-toggle-telegram')?.addEventListener('change', async (e) => {
    try {
      await api?.toggleChannel?.('telegram', e.target.checked);
      setStatus('telegram', e.target.checked);
      setFb('telegram', e.target.checked ? 'Telegram enabled.' : 'Telegram paused.', 'success');
    } catch (err) {
      e.target.checked = !e.target.checked;
      setFb('telegram', err.message, 'error');
    }
  });
  document.getElementById('ch-toggle-whatsapp')?.addEventListener('change', async (e) => {
    try {
      await api?.toggleChannel?.('whatsapp', e.target.checked);
      setStatus('whatsapp', e.target.checked);
      setFb('whatsapp', e.target.checked ? 'WhatsApp enabled.' : 'WhatsApp paused.', 'success');
    } catch (err) {
      e.target.checked = !e.target.checked;
      setFb('whatsapp', err.message, 'error');
    }
  });

  // Connect Telegram
  document.getElementById('ch-connect-telegram')?.addEventListener('click', async () => {
    const token = document.getElementById('ch-tg-token')?.value.trim();
    const saved = document.getElementById('ch-tg-token')?.placeholder.includes('saved');
    if (!token && !saved) { setFb('telegram', 'Paste your bot token first.', 'error'); return; }

    const btn = document.getElementById('ch-connect-telegram');
    btn.disabled = true;
    setFb('telegram', 'Validating…', 'info');
    try {
      if (token) {
        const v = await api?.validateChannel?.('telegram', { botToken: token });
        if (!v?.ok) throw new Error(v?.error ?? 'Invalid token');
        setFb('telegram', `✓ @${v.username} verified`, 'success');
      }
      const payload = {};
      if (token) payload.botToken = token;
      const r = await api?.saveChannel?.('telegram', payload);
      if (!r?.ok) throw new Error(r?.error ?? 'Save failed');
      setStatus('telegram', true);
      setToggle('telegram', true, true);
      setStepsVisible('telegram', false);
      setDisconnectVisible('telegram', true);
      setFb('telegram', '🎉 Connected! Message your bot to test.', 'success');
    } catch (err) {
      setFb('telegram', `Error: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // Connect WhatsApp
  document.getElementById('ch-connect-whatsapp')?.addEventListener('click', async () => {
    const sid    = document.getElementById('ch-wa-sid')?.value.trim();
    const token  = document.getElementById('ch-wa-token')?.value.trim();
    const number = document.getElementById('ch-wa-number')?.value.trim();
    const sidSaved   = document.getElementById('ch-wa-sid')?.placeholder.includes('saved');
    const tokenSaved = document.getElementById('ch-wa-token')?.placeholder.includes('saved');

    if (!sid && !sidSaved)     { setFb('whatsapp', 'Enter your Account SID.', 'error'); return; }
    if (!token && !tokenSaved) { setFb('whatsapp', 'Enter your Auth Token.', 'error'); return; }
    if (!number)               { setFb('whatsapp', 'Enter the sandbox number.', 'error'); return; }

    const btn = document.getElementById('ch-connect-whatsapp');
    btn.disabled = true;
    setFb('whatsapp', 'Validating credentials…', 'info');
    try {
      if (sid && token) {
        const v = await api?.validateChannel?.('whatsapp', { accountSid: sid, authToken: token });
        if (!v?.ok) throw new Error(v?.error ?? 'Invalid credentials');
        setFb('whatsapp', `✓ ${v.friendlyName} verified`, 'success');
      }
      const payload = { fromNumber: number };
      if (sid)   payload.accountSid = sid;
      if (token) payload.authToken  = token;
      const r = await api?.saveChannel?.('whatsapp', payload);
      if (!r?.ok) throw new Error(r?.error ?? 'Save failed');
      setStatus('whatsapp', true);
      setToggle('whatsapp', true, true);
      setStepsVisible('whatsapp', false);
      setDisconnectVisible('whatsapp', true);
      setFb('whatsapp', '🎉 Connected! Send a WhatsApp message to test.', 'success');
    } catch (err) {
      setFb('whatsapp', `Error: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // Disconnect buttons
  document.getElementById('ch-disc-telegram')?.addEventListener('click', () => disconnectChannel('telegram'));
  document.getElementById('ch-disc-whatsapp')?.addEventListener('click', () => disconnectChannel('whatsapp'));
}

async function disconnectChannel(name) {
  if (!window.confirm(`Disconnect ${name === 'telegram' ? 'Telegram' : 'WhatsApp'}? The bot will stop replying.`)) return;
  try {
    const r = await api?.removeChannel?.(name);
    if (!r?.ok) throw new Error(r?.error ?? 'Failed');
    setStatus(name, false);
    setToggle(name, false, false);
    setStepsVisible(name, true);
    setDisconnectVisible(name, false);
    if (name === 'telegram') {
      const t = document.getElementById('ch-tg-token'); if (t) { t.value = ''; t.placeholder = '1234567890:ABCdef\u2026'; }
    } else {
      const s = document.getElementById('ch-wa-sid');    if (s) { s.value = ''; s.placeholder = 'ACxxxxxxxxxxxxxxxx'; }
      const t = document.getElementById('ch-wa-token');  if (t) { t.value = ''; t.placeholder = 'Your auth token'; }
      const n = document.getElementById('ch-wa-number'); if (n) n.value = '';
    }
    setFb(name, 'Disconnected.', 'info');
  } catch (err) {
    setFb(name, `Error: ${err.message}`, 'error');
  }
}

/* ──────────────────────────────────────────────────────────────
   PREFILL  — populate already-saved data
────────────────────────────────────────────────────────────── */
async function prefill() {
  for (const name of ['telegram', 'whatsapp']) {
    try {
      const r = await api?.getChannelConfig?.(name);
      if (!r?.ok) continue;
      const c = r.config;
      if (name === 'telegram' && c.botTokenSet) {
        const el = document.getElementById('ch-tg-token');
        if (el) el.placeholder = '••••••••  (saved)';
      }
      if (name === 'whatsapp') {
        if (c.accountSidSet) { const el = document.getElementById('ch-wa-sid');   if (el) el.placeholder = 'AC……  (saved)'; }
        if (c.authTokenSet)  { const el = document.getElementById('ch-wa-token'); if (el) el.placeholder = '••••••••  (saved)'; }
        if (c.fromNumber)    { const el = document.getElementById('ch-wa-number'); if (el) el.value = c.fromNumber; }
      }
    } catch { /* ignore */ }
  }
}

/* ──────────────────────────────────────────────────────────────
   LOAD PANEL  —  entry point called by SettingsModal on tab switch
────────────────────────────────────────────────────────────── */
let _injected = false;

export async function loadChannelsPanel() {
  const container = document.getElementById('channels-settings-panel');
  if (!container) return;

  if (!_injected) {
    container.innerHTML = buildHTML();
    _injected = true;
    wireEvents();
  }

  // Refresh state every time the tab is opened
  try {
    const res = await api?.getChannels?.();
    if (!res?.ok) return;
    for (const [name, c] of Object.entries(res.channels ?? {})) {
      setStatus(name, c.configured && c.enabled);
      setToggle(name, c.enabled, c.configured);
      setStepsVisible(name, !c.configured);
      setDisconnectVisible(name, c.configured);
    }
    await prefill();
  } catch (err) {
    console.error('[ChannelsPanel] load error:', err);
  }
}
