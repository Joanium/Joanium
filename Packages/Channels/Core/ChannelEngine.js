import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

/* ══════════════════════════════════════════
   DEFAULT CHANNEL STATE
══════════════════════════════════════════ */
const DEFAULT_STATE = {
  channels: {
    telegram: {
      enabled: false,
      botToken: '',
      lastUpdateId: 0,
      connectedAt: null,
    },
    whatsapp: {
      enabled: false,
      accountSid: '',
      authToken: '',
      fromNumber: '',
      connectedAt: null,
    },
  },
};

/* ══════════════════════════════════════════
   TELEGRAM  — poll + send
══════════════════════════════════════════ */
async function pollTelegram(cfg) {
  const base = `https://api.telegram.org/bot${cfg.botToken}`;
  const offset = (cfg.lastUpdateId ?? 0) + 1;
  const res = await fetch(`${base}/getUpdates?offset=${offset}&timeout=5&limit=10`);
  if (!res.ok) throw new Error(`Telegram getUpdates HTTP ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.description ?? 'Telegram API error');

  return (data.result ?? [])
    .filter(u => u.message?.text)
    .map(u => ({
      updateId: u.update_id,
      chatId: u.message.chat.id,
      text: u.message.text,
      from: u.message.from?.first_name ?? 'User',
    }));
}

async function sendTelegram(botToken, chatId, text) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.description ?? `Telegram sendMessage HTTP ${res.status}`);
  }
}

/* ══════════════════════════════════════════
   TWILIO WHATSAPP  — poll + send
══════════════════════════════════════════ */
async function pollWhatsApp(cfg) {
  const encodedTo = encodeURIComponent(cfg.fromNumber);
  const url = `https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Messages.json?To=${encodedTo}&PageSize=10`;
  const auth = 'Basic ' + Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString('base64');
  const res = await fetch(url, { headers: { Authorization: auth } });
  if (!res.ok) throw new Error(`Twilio HTTP ${res.status}`);
  const data = await res.json();

  const seenSids = cfg._seenSids ?? new Set();
  const messages = [];

  for (const msg of (data.messages ?? [])) {
    if (msg.direction !== 'inbound') continue;
    if (seenSids.has(msg.sid)) continue;
    const age = Date.now() - new Date(msg.date_created).getTime();
    if (age > 20_000) continue;
    messages.push({ sid: msg.sid, from: msg.from, to: msg.to, text: msg.body });
    seenSids.add(msg.sid);
  }

  if (seenSids.size > 500) cfg._seenSids = new Set(Array.from(seenSids).slice(-500));
  else cfg._seenSids = seenSids;

  return messages;
}

async function sendWhatsApp(cfg, to, text) {
  const body = new URLSearchParams({ From: cfg.fromNumber, To: to, Body: text });
  const auth = 'Basic ' + Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString('base64');
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Messages.json`,
    { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' }, body },
  );
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.message ?? `Twilio sendMessage HTTP ${res.status}`);
  }
}

/* ══════════════════════════════════════════
   CHANNEL ENGINE CLASS
   The engine is a GATEWAY only — it does NOT
   call AI itself. All message processing is
   dispatched to the renderer's full chat
   pipeline (agentLoop + tools + usage tracking).
══════════════════════════════════════════ */
export class ChannelEngine {
  constructor(filePath) {
    this.filePath = filePath;
    this._data = null;
    this._ticker = null;
    this._processing = false;

    // mainWindow is set after Electron app ready via setWindow()
    this._mainWindow = null;

    // Pending reply promises keyed by request id
    this._pending = new Map();
  }

  /* ── Window reference (injected after BrowserWindow is created) ── */
  setWindow(win) {
    this._mainWindow = win;
  }

  /* ── Resolve a pending reply from the renderer ── */
  resolveReply(id, text) {
    const p = this._pending.get(id);
    if (p) { this._pending.delete(id); p.resolve(text); }
  }

  /* ── Dispatch to renderer and await reply ── */
  _dispatchToRenderer(channelName, from, text) {
    return new Promise((resolve, reject) => {
      if (!this._mainWindow || this._mainWindow.isDestroyed()) {
        return reject(new Error('App window not available'));
      }
      const id = randomUUID();
      const timer = setTimeout(() => {
        this._pending.delete(id);
        reject(new Error('Channel gateway timeout (120s)'));
      }, 120_000);

      this._pending.set(id, {
        resolve: (reply) => { clearTimeout(timer); resolve(reply); },
        reject:  (err)   => { clearTimeout(timer); reject(err); },
      });

      this._mainWindow.webContents.send('channel-incoming', { id, channelName, from, text });
    });
  }

  /* ── Private helpers ── */
  _load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this._data = JSON.parse(raw);
      } else {
        this._data = JSON.parse(JSON.stringify(DEFAULT_STATE));
      }
    } catch {
      this._data = JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
    for (const [key, val] of Object.entries(DEFAULT_STATE.channels)) {
      if (!this._data.channels[key]) this._data.channels[key] = JSON.parse(JSON.stringify(val));
    }
    return this._data;
  }

  _persist() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const toSave = JSON.parse(JSON.stringify(this._data));
    delete toSave.channels.whatsapp._seenSids;
    fs.writeFileSync(this.filePath, JSON.stringify(toSave, null, 2), 'utf-8');
  }

  /* ── Public channel management API ── */
  getAll() {
    this._load();
    const out = {};
    for (const [name, c] of Object.entries(this._data.channels)) {
      out[name] = { enabled: c.enabled, connectedAt: c.connectedAt, configured: this._isConfigured(name, c) };
    }
    return out;
  }

  getChannel(name) { return this._load().channels[name] ?? null; }

  saveChannel(name, config) {
    this._load();
    const existing = this._data.channels[name] ?? {};
    // Strip system prompt if accidentally passed — channels use global settings
    const { systemPrompt: _ignored, ...cleanConfig } = config;
    this._data.channels[name] = { ...existing, ...cleanConfig, enabled: true, connectedAt: new Date().toISOString() };
    this._persist();
    return { ok: true, connectedAt: this._data.channels[name].connectedAt };
  }

  removeChannel(name) {
    this._load();
    this._data.channels[name] = JSON.parse(JSON.stringify(DEFAULT_STATE.channels[name] ?? {}));
    this._data.channels[name].enabled = false;
    this._persist();
  }

  toggleChannel(name, enabled) {
    this._load();
    if (this._data.channels[name]) { this._data.channels[name].enabled = Boolean(enabled); this._persist(); }
  }

  /* ── Validation ── */
  async validateTelegram(botToken) {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.description ?? 'Invalid bot token');
    return { username: data.result?.username, firstName: data.result?.first_name };
  }

  async validateWhatsApp(accountSid, authToken) {
    const auth = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
      headers: { Authorization: auth },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message ?? 'Invalid Twilio credentials');
    return { friendlyName: data.friendly_name };
  }

  /* ── Polling ── */
  start() {
    this._load();
    this._ticker = setInterval(() => this._poll(), 5_000);
    console.log('[ChannelEngine] Started — polling every 5 s');
  }

  stop() {
    if (this._ticker) { clearInterval(this._ticker); this._ticker = null; }
    // Reject all pending replies on shutdown
    for (const [, p] of this._pending) p.reject(new Error('App shutting down'));
    this._pending.clear();
    console.log('[ChannelEngine] Stopped');
  }

  async _poll() {
    if (this._processing) return;
    this._processing = true;
    try {
      await this._pollTelegram();
      await this._pollWhatsApp();
    } catch (err) {
      console.error('[ChannelEngine] Poll error:', err.message);
    } finally {
      this._processing = false;
    }
  }

  async _pollTelegram() {
    this._load();
    const cfg = this._data.channels.telegram;
    if (!cfg?.enabled || !cfg.botToken) return;

    let messages;
    try { messages = await pollTelegram(cfg); }
    catch (err) { console.warn('[ChannelEngine] Telegram poll failed:', err.message); return; }

    if (messages.length) {
      const maxId = Math.max(...messages.map(m => m.updateId));
      if (maxId >= (cfg.lastUpdateId ?? 0)) cfg.lastUpdateId = maxId;
      this._persist();
    }

    // Process all incoming messages concurrently
    for (const msg of messages) {
      (async () => {
        let typingInterval = null;
        try {
          // Send typing indicator every 4.5s while the AI is thinking (max 5s per Telegram docs)
          const sendTyping = () => fetch(`https://api.telegram.org/bot${cfg.botToken}/sendChatAction`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ chat_id: msg.chatId, action: 'typing' }),
          }).catch(() => {});

          sendTyping();
          typingInterval = setInterval(sendTyping, 4500);

          // Full autonomous processing via renderer pipeline
          const reply = await this._dispatchToRenderer('telegram', msg.from, msg.text);
          
          clearInterval(typingInterval);
          await sendTelegram(cfg.botToken, msg.chatId, reply);
          console.log(`[ChannelEngine] Telegram ↩ replied to ${msg.from} (chat ${msg.chatId})`);
        } catch (err) {
          if (typingInterval) clearInterval(typingInterval);
          console.error(`[ChannelEngine] Telegram reply failed (chat ${msg.chatId}):`, err.message);
        }
      })();
    }
  }

  async _pollWhatsApp() {
    this._load();
    const cfg = this._data.channels.whatsapp;
    if (!cfg?.enabled || !cfg.accountSid || !cfg.authToken || !cfg.fromNumber) return;

    let messages;
    try { messages = await pollWhatsApp(cfg); }
    catch (err) { console.warn('[ChannelEngine] WhatsApp poll failed:', err.message); return; }

    // Process all incoming messages concurrently
    for (const msg of messages) {
      (async () => {
        try {
          const reply = await this._dispatchToRenderer('whatsapp', msg.from, msg.text);
          await sendWhatsApp(cfg, msg.from, reply);
          console.log(`[ChannelEngine] WhatsApp ↩ replied to ${msg.from}`);
        } catch (err) {
          console.error(`[ChannelEngine] WhatsApp reply failed (${msg.from}):`, err.message);
        }
      })();
    }
  }

  _isConfigured(name, c) {
    if (name === 'telegram') return Boolean(c.botToken);
    if (name === 'whatsapp') return Boolean(c.accountSid && c.authToken && c.fromNumber);
    return false;
  }
}
