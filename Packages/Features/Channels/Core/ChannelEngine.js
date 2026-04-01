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
    discord: {
      enabled: false,
      botToken: '',
      channelId: '',
      lastMessageId: null,
      connectedAt: null,
    },
    slack: {
      enabled: false,
      botToken: '',
      channelId: '',
      lastMessageTs: null,
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
   DISCORD  — poll + send

   IMPORTANT: For the bot to read message
   content via REST polling, you MUST enable
   "Message Content Intent" in the Discord
   Developer Portal:
     Bot → Privileged Gateway Intents →
     Message Content Intent → ON

   The bot must also be invited to your server
   with at least Read Messages + Send Messages
   permissions in the target channel.
══════════════════════════════════════════ */
async function pollDiscord(cfg) {
  if (!cfg.channelId || !cfg.botToken) return [];

  // Fetch our own bot user ID on first poll so we can skip self-messages
  if (!cfg._botUserId) {
    try {
      const meRes = await fetch('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: `Bot ${cfg.botToken}` },
      });
      if (meRes.ok) {
        const me = await meRes.json();
        cfg._botUserId = me.id;
      }
    } catch { /* non-fatal — we'll skip by author.bot flag instead */ }
  }

  const url = `https://discord.com/api/v10/channels/${cfg.channelId}/messages?limit=10${
    cfg.lastMessageId ? `&after=${cfg.lastMessageId}` : ''
  }`;
  const res = await fetch(url, { headers: { Authorization: `Bot ${cfg.botToken}` } });

  if (res.status === 403) {
    throw new Error(
      `Discord 403: Bot cannot access channel ${cfg.channelId}. ` +
      `Make sure: (1) the bot is invited to your server, ` +
      `(2) the bot has "View Channel" and "Read Message History" permissions, ` +
      `(3) the channel ID is correct.`
    );
  }
  if (res.status === 401) {
    throw new Error('Discord 401: Invalid bot token. Regenerate it in the Developer Portal.');
  }
  if (!res.ok) throw new Error(`Discord HTTP ${res.status}`);

  const messages = await res.json();
  if (!Array.isArray(messages)) return [];

  return messages
    .filter(m => {
      // Skip all bot messages (including ourselves)
      if (m.author?.bot) return false;
      // Skip our own user ID if we resolved it
      if (cfg._botUserId && m.author?.id === cfg._botUserId) return false;
      // Skip messages with no readable text
      if (!m.content?.trim()) return false;
      return true;
    })
    .map(m => ({
      id: m.id,
      channelId: m.channel_id,
      text: m.content,
      from: m.author?.username ?? 'User',
    }))
    .reverse(); // Oldest first so we process in order
}

async function sendDiscord(botToken, channelId, text) {
  // Discord has a 2000 char limit per message — split if needed
  const chunks = splitIntoChunks(text, 1990);
  for (const chunk of chunks) {
    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bot ${botToken}` },
      body: JSON.stringify({ content: chunk }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.message ?? `Discord sendMessage HTTP ${res.status}`);
    }
  }
}

/* ══════════════════════════════════════════
   SLACK  — poll + send

   The bot token needs these OAuth scopes:
     channels:history  (read public channels)
     channels:read     (list channels)
     chat:write        (send messages)
     groups:history    (read private channels)

   The bot must also be /invited to the channel.

   IMPORTANT: conversations.history oldest param
   is EXCLUSIVE (messages after that timestamp,
   not including it), which is exactly what we
   want for polling — no duplicate processing.
══════════════════════════════════════════ */
async function pollSlack(cfg) {
  if (!cfg.channelId || !cfg.botToken) return [];

  // Fetch our bot user ID once so we can skip our own messages
  if (!cfg._botUserId) {
    try {
      const authRes = await fetch('https://slack.com/api/auth.test', {
        headers: { Authorization: `Bearer ${cfg.botToken}` },
      });
      const authData = await authRes.json();
      if (authData.ok) cfg._botUserId = authData.bot_id ?? authData.user_id;
    } catch { /* non-fatal */ }
  }

  // Build URL — oldest is exclusive (messages AFTER this ts, not including it)
  // This is exactly what we want for polling: no re-processing of last seen message
  let url = `https://slack.com/api/conversations.history?channel=${cfg.channelId}&limit=10`;
  if (cfg.lastMessageTs) {
    url += `&oldest=${cfg.lastMessageTs}`;
  }

  const res = await fetch(url, { headers: { Authorization: `Bearer ${cfg.botToken}` } });
  if (!res.ok) throw new Error(`Slack HTTP ${res.status}`);

  const data = await res.json();

  if (!data.ok) {
    if (data.error === 'channel_not_found') {
      throw new Error(
        `Slack channel_not_found: Channel ID "${cfg.channelId}" is invalid or ` +
        `the bot is not a member. Run /invite @YourBotName in the channel.`
      );
    }
    if (data.error === 'not_in_channel') {
      throw new Error(
        `Slack not_in_channel: The bot is not a member of channel ${cfg.channelId}. ` +
        `Run /invite @YourBotName in the Slack channel.`
      );
    }
    throw new Error(data.error ?? 'Slack API error');
  }

  const messages = (data.messages ?? [])
    .filter(m => {
      // Only plain user messages (type: 'message', no subtype = regular user message)
      if (m.type !== 'message') return false;
      // Skip bot messages and system messages (subtypes like channel_join, etc.)
      if (m.subtype) return false;
      if (m.bot_id) return false;
      // Skip our own bot if we know its ID
      if (cfg._botUserId && m.bot_id === cfg._botUserId) return false;
      if (!m.text?.trim()) return false;
      return true;
    })
    .map(m => ({
      ts: m.ts,
      channelId: cfg.channelId,
      text: m.text,
      from: m.user || 'User',
    }));

  // conversations.history returns newest first — reverse for chronological processing
  return messages.reverse();
}

async function sendSlack(botToken, channelId, text) {
  // Slack has a ~40k char limit but we keep messages reasonable
  const chunks = splitIntoChunks(text, 3000);
  for (const chunk of chunks) {
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${botToken}` },
      body: JSON.stringify({ channel: channelId, text: chunk }),
    });
    if (!res.ok) {
      throw new Error(`Slack sendMessage HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!data.ok) throw new Error(data.error ?? 'Slack sendMessage API error');
  }
}

/* ══════════════════════════════════════════
   UTILITY
══════════════════════════════════════════ */
function splitIntoChunks(text, maxLen) {
  const str = String(text ?? '');
  if (str.length <= maxLen) return [str];
  const chunks = [];
  let i = 0;
  while (i < str.length) {
    chunks.push(str.slice(i, i + maxLen));
    i += maxLen;
  }
  return chunks;
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
        reject(new Error('Channel gateway timeout (240s)'));
      }, 240_000);

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
    // Strip runtime-only cache fields
    delete toSave.channels.discord._botUserId;
    delete toSave.channels.slack._botUserId;
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

  async validateSlack(botToken) {
    const res = await fetch('https://slack.com/api/auth.test', {
      headers: { Authorization: `Bearer ${botToken}` },
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error ?? 'Invalid Slack token');
    return { name: data.user, team: data.team };
  }

  async validateDiscord(botToken) {
    const res = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (!res.ok) throw new Error('Invalid Discord bot token');
    const data = await res.json();
    return { username: data.username };
  }

  /* ── Test that the Discord bot can actually read the channel ── */
  async validateDiscordChannel(botToken, channelId) {
    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (res.status === 403) throw new Error(`Bot cannot access channel ${channelId}. Invite the bot to your server first.`);
    if (res.status === 404) throw new Error(`Channel ${channelId} not found. Double-check the Channel ID.`);
    if (!res.ok) throw new Error(`Discord HTTP ${res.status}`);
    const data = await res.json();
    return { channelName: data.name };
  }

  /* ── Test that the Slack bot can actually read the channel ── */
  async validateSlackChannel(botToken, channelId) {
    const res = await fetch(`https://slack.com/api/conversations.info?channel=${channelId}`, {
      headers: { Authorization: `Bearer ${botToken}` },
    });
    const data = await res.json();
    if (!data.ok) {
      if (data.error === 'channel_not_found') {
        throw new Error(`Channel not found. Make sure the Channel ID is correct (starts with C for public channels).`);
      }
      throw new Error(data.error ?? 'Could not validate channel');
    }
    const isMember = data.channel?.is_member;
    const channelName = data.channel?.name ?? channelId;
    return { channelName, isMember };
  }

  /* ── Polling ── */
  start() {
    this._load();
    this._ticker = setInterval(() => this._poll(), 5_000);
  }

  stop() {
    if (this._ticker) { clearInterval(this._ticker); this._ticker = null; }
    // Reject all pending replies on shutdown
    for (const [, p] of this._pending) p.reject(new Error('App shutting down'));
    this._pending.clear();
  }

  async _poll() {
    if (this._processing) return;
    this._processing = true;
    try {
      await this._pollTelegram();
      await this._pollWhatsApp();
      await this._pollDiscord();
      await this._pollSlack();
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

    for (const msg of messages) {
      (async () => {
        let typingInterval = null;
        try {
          const sendTyping = () => fetch(`https://api.telegram.org/bot${cfg.botToken}/sendChatAction`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ chat_id: msg.chatId, action: 'typing' }),
          }).catch(() => {});

          sendTyping();
          typingInterval = setInterval(sendTyping, 4500);

          const reply = await this._dispatchToRenderer('telegram', msg.from, msg.text);

          clearInterval(typingInterval);
          await sendTelegram(cfg.botToken, msg.chatId, reply);
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

    for (const msg of messages) {
      (async () => {
        try {
          const reply = await this._dispatchToRenderer('whatsapp', msg.from, msg.text);
          await sendWhatsApp(cfg, msg.from, reply);
        } catch (err) {
          console.error(`[ChannelEngine] WhatsApp reply failed (${msg.from}):`, err.message);
        }
      })();
    }
  }

  async _pollDiscord() {
    this._load();
    const cfg = this._data.channels.discord;
    if (!cfg?.enabled || !cfg.botToken || !cfg.channelId) return;

    let messages;
    try { messages = await pollDiscord(cfg); }
    catch (err) { console.warn('[ChannelEngine] Discord poll failed:', err.message); return; }

    if (messages.length) {
      cfg.lastMessageId = messages[messages.length - 1].id;
      this._persist();
    }

    for (const msg of messages) {
      (async () => {
        let typingInterval = null;
        try {
          const sendTyping = () => fetch(`https://discord.com/api/v10/channels/${msg.channelId}/typing`, {
            method: 'POST',
            headers: { Authorization: `Bot ${cfg.botToken}` },
          }).catch(() => {});

          sendTyping();
          typingInterval = setInterval(sendTyping, 9000); // 10s max per Discord docs

          const reply = await this._dispatchToRenderer('discord', msg.from, msg.text);

          clearInterval(typingInterval);
          await sendDiscord(cfg.botToken, msg.channelId, reply);
        } catch (err) {
          if (typingInterval) clearInterval(typingInterval);
          console.error(`[ChannelEngine] Discord reply failed (${msg.from}):`, err.message);
        }
      })();
    }
  }

  async _pollSlack() {
    this._load();
    const cfg = this._data.channels.slack;
    if (!cfg?.enabled || !cfg.botToken || !cfg.channelId) return;

    let messages;
    try { messages = await pollSlack(cfg); }
    catch (err) { console.warn('[ChannelEngine] Slack poll failed:', err.message); return; }

    if (messages.length) {
      // Store the ts of the newest message as our cursor for next poll
      // conversations.history oldest param is exclusive, so we won't re-fetch this message
      cfg.lastMessageTs = messages[messages.length - 1].ts;
      this._persist();
    }

    for (const msg of messages) {
      (async () => {
        try {
          const reply = await this._dispatchToRenderer('slack', msg.from, msg.text);
          await sendSlack(cfg.botToken, cfg.channelId, reply);
        } catch (err) {
          console.error(`[ChannelEngine] Slack reply failed (${msg.from}):`, err.message);
        }
      })();
    }
  }

  _isConfigured(name, c) {
    if (name === 'telegram') return Boolean(c.botToken);
    if (name === 'whatsapp') return Boolean(c.accountSid && c.authToken && c.fromNumber);
    if (name === 'discord') return Boolean(c.botToken && c.channelId);
    if (name === 'slack') return Boolean(c.botToken && c.channelId);
    return false;
  }
}
