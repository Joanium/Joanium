import { randomUUID } from 'crypto';
import { net } from 'electron';
import defineEngine from '../../../System/Contracts/DefineEngine.js';
import { cloneValue } from '../../../System/Utils/CloneValue.js';
const DEFAULT_STATE = {
  channels: {
    telegram: { enabled: !1, botToken: '', lastUpdateId: 0, connectedAt: null },
    whatsapp: { enabled: !1, accountSid: '', authToken: '', fromNumber: '', connectedAt: null },
    discord: { enabled: !1, botToken: '', channelId: '', lastMessageId: null, connectedAt: null },
    slack: { enabled: !1, botToken: '', channelId: '', lastMessageTs: null, connectedAt: null },
  },
};
async function channelFetch(input, init) {
  return 'function' == typeof net?.fetch ? net.fetch(input, init) : fetch(input, init);
}
async function sendTelegram(botToken, chatId, text) {
  const res = await channelFetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.description ?? `Telegram sendMessage HTTP ${res.status}`);
  }
}
async function sendWhatsApp(cfg, to, text) {
  const body = new URLSearchParams({ From: cfg.fromNumber, To: to, Body: text }),
    auth = 'Basic ' + Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString('base64'),
    res = await channelFetch(
      `https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body,
      },
    );
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.message ?? `Twilio sendMessage HTTP ${res.status}`);
  }
}
async function sendDiscord(botToken, channelId, text) {
  const chunks = splitIntoChunks(text, 1990);
  for (const chunk of chunks) {
    const res = await channelFetch(`https://discord.com/API/v10/channels/${channelId}/messages`, {
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
async function sendSlack(botToken, channelId, text) {
  const chunks = splitIntoChunks(text, 3e3);
  for (const chunk of chunks) {
    const res = await channelFetch('https://slack.com/API/chat.postMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${botToken}` },
      body: JSON.stringify({ channel: channelId, text: chunk }),
    });
    if (!res.ok) throw new Error(`Slack sendMessage HTTP ${res.status}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error ?? 'Slack sendMessage API error');
  }
}
function splitIntoChunks(text, maxLen) {
  const str = String(text ?? '');
  if (str.length <= maxLen) return [str];
  const chunks = [];
  let i = 0;
  for (; i < str.length; ) (chunks.push(str.slice(i, i + maxLen)), (i += maxLen));
  return chunks;
}
export class ChannelEngine {
  constructor(storage) {
    ((this.storage = storage),
      (this._data = null),
      (this._ticker = null),
      (this._processing = !1),
      (this._pollFailureState = new Map()),
      (this._mainWindow = null),
      (this._pending = new Map()));
  }
  setWindow(win) {
    this._mainWindow = win;
  }
  resolveReply(id, text) {
    const p = this._pending.get(id);
    p && (this._pending.delete(id), p.resolve(text));
  }
  _dispatchToRenderer(channelName, from, text) {
    return new Promise((resolve, reject) => {
      if (!this._mainWindow || this._mainWindow.isDestroyed())
        return reject(new Error('App window not available'));
      const id = randomUUID(),
        timer = setTimeout(() => {
          (this._pending.delete(id), reject(new Error('Channel gateway timeout (240s)')));
        }, 24e4);
      (this._pending.set(id, {
        resolve: (reply) => {
          (clearTimeout(timer), resolve(reply));
        },
        reject: (err) => {
          (clearTimeout(timer), reject(err));
        },
      }),
        this._mainWindow.webContents.send('channel-incoming', {
          id: id,
          channelName: channelName,
          from: from,
          text: text,
        }));
    });
  }
  _load() {
    try {
      const loaded = this.storage.load(() => cloneValue(DEFAULT_STATE)),
        channels =
          loaded?.channels && 'object' == typeof loaded.channels && !Array.isArray(loaded.channels)
            ? loaded.channels
            : {};
      this._data = {
        ...(loaded && 'object' == typeof loaded && !Array.isArray(loaded) ? loaded : {}),
        channels: channels,
      };
    } catch {
      this._data = cloneValue(DEFAULT_STATE);
    }
    for (const [key, val] of Object.entries(DEFAULT_STATE.channels)) {
      const existing = this._data.channels[key];
      this._data.channels[key] =
        existing && 'object' == typeof existing && !Array.isArray(existing)
          ? { ...cloneValue(val), ...existing }
          : cloneValue(val);
    }
    return this._data;
  }
  _persist() {
    const toSave = cloneValue(this._data);
    (delete toSave.channels.whatsapp._seenSids,
      delete toSave.channels.discord._botUserId,
      delete toSave.channels.slack._botUserId,
      this.storage.save(toSave));
  }
  _clearPollFailure(channel) {
    this._pollFailureState.delete(channel);
  }
  _logPollFailure(channel, err) {
    const message = (function (err) {
        return err instanceof Error ? err.message : String(err ?? 'Unknown error');
      })(err),
      now = Date.now(),
      previous = this._pollFailureState.get(channel);
    (previous && previous.message === message && now - previous.loggedAt < 6e4) ||
      (this._pollFailureState.set(channel, { message: message, loggedAt: now }),
      console.warn(`[ChannelEngine] ${channel} poll failed:`, message));
  }
  getAll() {
    this._load();
    const out = {};
    for (const [name, c] of Object.entries(this._data.channels))
      out[name] = {
        enabled: c.enabled,
        connectedAt: c.connectedAt,
        configured: this._isConfigured(name, c),
      };
    return out;
  }
  getChannel(name) {
    return this._load().channels[name] ?? null;
  }
  saveChannel(name, config) {
    this._load();
    const existing = this._data.channels[name] ?? {},
      { systemPrompt: _ignored, ...cleanConfig } = config;
    return (
      (this._data.channels[name] = {
        ...existing,
        ...cleanConfig,
        enabled: !0,
        connectedAt: new Date().toISOString(),
      }),
      this._persist(),
      { ok: !0, connectedAt: this._data.channels[name].connectedAt }
    );
  }
  removeChannel(name) {
    (this._load(),
      (this._data.channels[name] = cloneValue(DEFAULT_STATE.channels[name] ?? {})),
      (this._data.channels[name].enabled = !1),
      this._persist());
  }
  toggleChannel(name, enabled) {
    (this._load(),
      this._data.channels[name] &&
        ((this._data.channels[name].enabled = Boolean(enabled)), this._persist()));
  }
  async validateTelegram(botToken) {
    const res = await channelFetch(`https://api.telegram.org/bot${botToken}/getMe`),
      data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.description ?? 'Invalid bot token');
    return { username: data.result?.username, firstName: data.result?.first_name };
  }
  async validateWhatsApp(accountSid, authToken) {
    const auth = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
      res = await channelFetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
        headers: { Authorization: auth },
      }),
      data = await res.json();
    if (!res.ok) throw new Error(data.message ?? 'Invalid Twilio credentials');
    return { friendlyName: data.friendly_name };
  }
  async validateSlack(botToken) {
    const res = await channelFetch('https://slack.com/API/auth.test', {
        headers: { Authorization: `Bearer ${botToken}` },
      }),
      data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error ?? 'Invalid Slack token');
    return { name: data.user, team: data.team };
  }
  async validateDiscord(botToken) {
    const res = await channelFetch('https://discord.com/API/v10/users/@me', {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (!res.ok) throw new Error('Invalid Discord bot token');
    return { username: (await res.json()).username };
  }
  async validateDiscordChannel(botToken, channelId) {
    const res = await channelFetch(`https://discord.com/API/v10/channels/${channelId}`, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (403 === res.status)
      throw new Error(
        `Bot cannot access channel ${channelId}. Invite the bot to your server first.`,
      );
    if (404 === res.status)
      throw new Error(`Channel ${channelId} not found. Double-check the Channel ID.`);
    if (!res.ok) throw new Error(`Discord HTTP ${res.status}`);
    return { channelName: (await res.json()).name };
  }
  async validateSlackChannel(botToken, channelId) {
    const res = await channelFetch(
        `https://slack.com/API/conversations.info?channel=${channelId}`,
        { headers: { Authorization: `Bearer ${botToken}` } },
      ),
      data = await res.json();
    if (!data.ok) {
      if ('channel_not_found' === data.error)
        throw new Error(
          'Channel not found. Make sure the Channel ID is correct (starts with C for public channels).',
        );
      throw new Error(data.error ?? 'Could not validate channel');
    }
    const isMember = data.channel?.is_member;
    return { channelName: data.channel?.name ?? channelId, isMember: isMember };
  }
  start() {
    (this._load(), (this._ticker = setInterval(() => this._poll(), 5e3)));
  }
  stop() {
    this._ticker && (clearInterval(this._ticker), (this._ticker = null));
    for (const [, p] of this._pending) p.reject(new Error('App shutting down'));
    this._pending.clear();
  }
  async _poll() {
    if (!this._processing) {
      this._processing = !0;
      try {
        (await this._pollTelegram(),
          await this._pollWhatsApp(),
          await this._pollDiscord(),
          await this._pollSlack());
      } catch (err) {
        console.error('[ChannelEngine] Poll error:', err.message);
      } finally {
        this._processing = !1;
      }
    }
  }
  async _pollTelegram() {
    this._load();
    const cfg = this._data.channels.telegram;
    if (!cfg?.enabled || !cfg.botToken) return;
    let messages;
    try {
      messages = await (async function (cfg) {
        const base = `https://api.telegram.org/bot${cfg.botToken}`,
          offset = (cfg.lastUpdateId ?? 0) + 1,
          res = await channelFetch(`${base}/getUpdates?offset=${offset}&timeout=5&limit=10`);
        if (!res.ok) throw new Error(`Telegram getUpdates HTTP ${res.status}`);
        const data = await res.json();
        if (!data.ok) throw new Error(data.description ?? 'Telegram API error');
        return (data.result ?? [])
          .filter((u) => u.message?.text)
          .map((u) => ({
            updateId: u.update_id,
            chatId: u.message.chat.id,
            text: u.message.text,
            from: u.message.from?.first_name ?? 'User',
          }));
      })(cfg);
    } catch (err) {
      return void this._logPollFailure('Telegram', err);
    }
    if ((this._clearPollFailure('Telegram'), messages.length)) {
      const maxId = Math.max(...messages.map((m) => m.updateId));
      (maxId >= (cfg.lastUpdateId ?? 0) && (cfg.lastUpdateId = maxId), this._persist());
    }
    for (const msg of messages)
      (async () => {
        let typingInterval = null;
        try {
          const sendTyping = () =>
            channelFetch(`https://api.telegram.org/bot${cfg.botToken}/sendChatAction`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ chat_id: msg.chatId, action: 'typing' }),
            }).catch(() => {});
          (sendTyping(), (typingInterval = setInterval(sendTyping, 4500)));
          const reply = await this._dispatchToRenderer('telegram', msg.from, msg.text);
          (clearInterval(typingInterval), await sendTelegram(cfg.botToken, msg.chatId, reply));
        } catch (err) {
          (typingInterval && clearInterval(typingInterval),
            console.error(
              `[ChannelEngine] Telegram reply failed (chat ${msg.chatId}):`,
              err.message,
            ));
        }
      })();
  }
  async _pollWhatsApp() {
    this._load();
    const cfg = this._data.channels.whatsapp;
    if (!(cfg?.enabled && cfg.accountSid && cfg.authToken && cfg.fromNumber)) return;
    let messages;
    try {
      messages = await (async function (cfg) {
        const encodedTo = encodeURIComponent(cfg.fromNumber),
          url = `https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Messages.json?To=${encodedTo}&PageSize=10`,
          auth = 'Basic ' + Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString('base64'),
          res = await channelFetch(url, { headers: { Authorization: auth } });
        if (!res.ok) throw new Error(`Twilio HTTP ${res.status}`);
        const data = await res.json(),
          seenSids = cfg._seenSids ?? new Set(),
          messages = [];
        for (const msg of data.messages ?? [])
          'inbound' === msg.direction &&
            (seenSids.has(msg.sid) ||
              Date.now() - new Date(msg.date_created).getTime() > 2e4 ||
              (messages.push({ sid: msg.sid, from: msg.from, to: msg.to, text: msg.body }),
              seenSids.add(msg.sid)));
        return (
          seenSids.size > 500
            ? (cfg._seenSids = new Set(Array.from(seenSids).slice(-500)))
            : (cfg._seenSids = seenSids),
          messages
        );
      })(cfg);
    } catch (err) {
      return void this._logPollFailure('WhatsApp', err);
    }
    this._clearPollFailure('WhatsApp');
    for (const msg of messages)
      (async () => {
        try {
          const reply = await this._dispatchToRenderer('whatsapp', msg.from, msg.text);
          await sendWhatsApp(cfg, msg.from, reply);
        } catch (err) {
          console.error(`[ChannelEngine] WhatsApp reply failed (${msg.from}):`, err.message);
        }
      })();
  }
  async _pollDiscord() {
    this._load();
    const cfg = this._data.channels.discord;
    if (!cfg?.enabled || !cfg.botToken || !cfg.channelId) return;
    let messages;
    try {
      messages = await (async function (cfg) {
        if (!cfg.channelId || !cfg.botToken) return [];
        if (!cfg._botUserId)
          try {
            const meRes = await channelFetch('https://discord.com/API/v10/users/@me', {
              headers: { Authorization: `Bot ${cfg.botToken}` },
            });
            if (meRes.ok) {
              const me = await meRes.json();
              cfg._botUserId = me.id;
            }
          } catch {}
        const url = `https://discord.com/API/v10/channels/${cfg.channelId}/messages?limit=10${cfg.lastMessageId ? `&after=${cfg.lastMessageId}` : ''}`,
          res = await channelFetch(url, { headers: { Authorization: `Bot ${cfg.botToken}` } });
        if (403 === res.status)
          throw new Error(
            `Discord 403: Bot cannot access channel ${cfg.channelId}. Make sure: (1) the bot is invited to your server, (2) the bot has "View Channel" and "Read Message History" permissions, (3) the channel ID is correct.`,
          );
        if (401 === res.status)
          throw new Error('Discord 401: Invalid bot token. Regenerate it in the Developer Portal.');
        if (!res.ok) throw new Error(`Discord HTTP ${res.status}`);
        const messages = await res.json();
        return Array.isArray(messages)
          ? messages
              .filter((m) => !m.author?.bot && !!m.content?.trim())
              .map((m) => ({
                id: m.id,
                channelId: m.channel_id,
                text: m.content,
                from: m.author?.username ?? 'User',
              }))
              .reverse()
          : [];
      })(cfg);
    } catch (err) {
      return void this._logPollFailure('Discord', err);
    }
    (this._clearPollFailure('Discord'),
      messages.length && ((cfg.lastMessageId = messages[messages.length - 1].id), this._persist()));
    for (const msg of messages)
      (async () => {
        let typingInterval = null;
        try {
          const sendTyping = () =>
            channelFetch(`https://discord.com/API/v10/channels/${msg.channelId}/typing`, {
              method: 'POST',
              headers: { Authorization: `Bot ${cfg.botToken}` },
            }).catch(() => {});
          (sendTyping(), (typingInterval = setInterval(sendTyping, 9e3)));
          const reply = await this._dispatchToRenderer('discord', msg.from, msg.text);
          (clearInterval(typingInterval), await sendDiscord(cfg.botToken, msg.channelId, reply));
        } catch (err) {
          (typingInterval && clearInterval(typingInterval),
            console.error(`[ChannelEngine] Discord reply failed (${msg.from}):`, err.message));
        }
      })();
  }
  async _pollSlack() {
    this._load();
    const cfg = this._data.channels.slack;
    if (!cfg?.enabled || !cfg.botToken || !cfg.channelId) return;
    let messages;
    try {
      messages = await (async function (cfg) {
        if (!cfg.channelId || !cfg.botToken) return [];
        if (!cfg._botUserId)
          try {
            const authRes = await channelFetch('https://slack.com/API/auth.test', {
                headers: { Authorization: `Bearer ${cfg.botToken}` },
              }),
              authData = await authRes.json();
            authData.ok && (cfg._botUserId = authData.bot_id ?? authData.user_id);
          } catch {}
        let url = `https://slack.com/API/conversations.history?channel=${cfg.channelId}&limit=10`;
        cfg.lastMessageTs && (url += `&oldest=${cfg.lastMessageTs}`);
        const res = await channelFetch(url, {
          headers: { Authorization: `Bearer ${cfg.botToken}` },
        });
        if (!res.ok) throw new Error(`Slack HTTP ${res.status}`);
        const data = await res.json();
        if (!data.ok) {
          if ('channel_not_found' === data.error)
            throw new Error(
              `Slack channel_not_found: Channel ID "${cfg.channelId}" is invalid or the bot is not a member. Run /invite @YourBotName in the channel.`,
            );
          if ('not_in_channel' === data.error)
            throw new Error(
              `Slack not_in_channel: The bot is not a member of channel ${cfg.channelId}. Run /invite @YourBotName in the Slack channel.`,
            );
          throw new Error(data.error ?? 'Slack API error');
        }
        return (data.messages ?? [])
          .filter(
            (m) =>
              !(
                'message' !== m.type ||
                m.subtype ||
                m.bot_id ||
                (cfg._botUserId && m.bot_id === cfg._botUserId) ||
                !m.text?.trim()
              ),
          )
          .map((m) => ({
            ts: m.ts,
            channelId: cfg.channelId,
            text: m.text,
            from: m.user || 'User',
          }))
          .reverse();
      })(cfg);
    } catch (err) {
      return void this._logPollFailure('Slack', err);
    }
    (this._clearPollFailure('Slack'),
      messages.length && ((cfg.lastMessageTs = messages[messages.length - 1].ts), this._persist()));
    for (const msg of messages)
      (async () => {
        try {
          const reply = await this._dispatchToRenderer('slack', msg.from, msg.text);
          await sendSlack(cfg.botToken, cfg.channelId, reply);
        } catch (err) {
          console.error(`[ChannelEngine] Slack reply failed (${msg.from}):`, err.message);
        }
      })();
  }
  _isConfigured(name, c) {
    return 'telegram' === name
      ? Boolean(c.botToken)
      : 'whatsapp' === name
        ? Boolean(c.accountSid && c.authToken && c.fromNumber)
        : ('discord' === name || 'slack' === name) && Boolean(c.botToken && c.channelId);
  }
}
export const engineMeta = defineEngine({
  id: 'channels',
  provides: 'channelEngine',
  needs: ['featureStorage'],
  storage: [
    { key: 'channels', featureKey: 'channels', fileName: 'Channels.json' },
    { key: 'channelMessages', featureKey: 'channels', fileName: 'ChannelMessages.json' },
  ],
  create: ({ featureStorage: featureStorage }) => new ChannelEngine(featureStorage.get('channels')),
});
