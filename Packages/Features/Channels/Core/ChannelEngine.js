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
const CHANNEL_LABELS = Object.freeze({
    telegram: 'Telegram',
    whatsapp: 'WhatsApp',
    discord: 'Discord',
    slack: 'Slack',
  }),
  CHANNEL_RECOVERY_DELAYS = Object.freeze([1e3, 3e3, 5e3, 1e4, 15e3, 3e4]),
  CHANNEL_RUNTIME_ERROR_PATTERNS = Object.freeze([
    /net::ERR_/i,
    /failed to fetch/i,
    /fetch failed/i,
    /networkerror/i,
    /econnreset/i,
    /socket hang up/i,
    /etimedout/i,
    /session closed/i,
  ]);
function getPrimaryErrorMessage(err) {
  return err instanceof Error ? err.message : String(err ?? 'Unknown error');
}
function sanitizeRequestTarget(input) {
  const raw = String(input ?? '');
  try {
    const url = new URL(raw),
      pathSegments = url.pathname.split('/').filter(Boolean);
    if ('api.telegram.org' === url.hostname && pathSegments[0]?.startsWith('bot'))
      pathSegments[0] = 'bot<redacted>';
    if ('api.twilio.com' === url.hostname) {
      const accountIndex = pathSegments.indexOf('Accounts');
      accountIndex >= 0 &&
        pathSegments[accountIndex + 1] &&
        (pathSegments[accountIndex + 1] = '<redacted>');
    }
    return `${url.origin}/${pathSegments.join('/')}`;
  } catch {
    return raw;
  }
}
function attachRequestContext(err, input, init) {
  const wrapped =
      err && 'object' == typeof err
        ? err
        : new Error(err instanceof Error ? err.message : String(err ?? 'Unknown error')),
    request = {
      method: String(init?.method ?? 'GET').toUpperCase(),
      target: sanitizeRequestTarget(input),
    };
  return ((wrapped.channelRequest = request), wrapped);
}
function getErrorMessage(err) {
  const primary = getPrimaryErrorMessage(err),
    parts = [primary],
    code = err && 'object' == typeof err ? err.code : null,
    errno = err && 'object' == typeof err ? err.errno : null,
    type = err && 'object' == typeof err ? err.type : null,
    causeMessage = err?.cause ? getPrimaryErrorMessage(err.cause) : '',
    request = err?.channelRequest;
  return (
    code && !primary.includes(String(code)) && parts.push(`code=${code}`),
    errno && !primary.includes(String(errno)) && parts.push(`errno=${errno}`),
    type && !primary.includes(String(type)) && parts.push(`type=${type}`),
    causeMessage && causeMessage !== primary && parts.push(`cause=${causeMessage}`),
    request?.target && parts.push(`request=${request.method ?? 'GET'} ${request.target}`),
    parts.join(' | ')
  );
}
function isRecoverableChannelRuntimeError(err) {
  const message = getErrorMessage(err);
  return CHANNEL_RUNTIME_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}
async function channelFetch(input, init) {
  try {
    return 'function' == typeof net?.fetch ? net.fetch(input, init) : fetch(input, init);
  } catch (err) {
    throw attachRequestContext(err, input, init);
  }
}
async function sendTelegram(botToken, chatId, text) {
  const chunks = splitIntoChunks(text, 4000); // Telegram limit is 4096
  for (const chunk of chunks) {
    const res = await channelFetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: chunk }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.description ?? `Telegram sendMessage HTTP ${res.status}`);
    }
  }
}
async function sendWhatsApp(cfg, to, text) {
  const chunks = splitIntoChunks(text, 1500); // WhatsApp limit via Twilio is usually 1600
  for (const chunk of chunks) {
    const body = new URLSearchParams({ From: cfg.fromNumber, To: to, Body: chunk }),
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
    this.storage = storage;
    this._data = null;
    this._ticker = null;
    this._running = false;
    this._processing = false;
    this._pollFailureState = new Map();
    this._channelRecoveryState = new Map();
    this._mainWindow = null;
    this._pending = new Map();
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
      // Evict oldest pending entry if map is getting large
      if (this._pending.size >= 50) {
        const [oldestId] = this._pending.keys();
        const oldest = this._pending.get(oldestId);
        this._pending.delete(oldestId);
        oldest?.reject(new Error('Channel gateway overflow — request dropped'));
      }
      const id = randomUUID(),
        timer = setTimeout(() => {
          this._pending.delete(id);
          reject(new Error('Channel gateway timeout (1800s)'));
        }, 1800000); //30 mins
      this._pending.set(id, {
        resolve: (reply) => {
          clearTimeout(timer);
          resolve(reply);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });
      this._mainWindow.webContents.send('channel-incoming', {
        id,
        channelName,
        from,
        text,
      });
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
  _channelLabel(channel) {
    return CHANNEL_LABELS[channel] ?? channel;
  }
  _getChannelRecoveryState(channel) {
    let state = this._channelRecoveryState.get(channel);
    return (
      state ||
        ((state = { attempts: 0, timer: null, inFlight: !1, lastError: '' }),
        this._channelRecoveryState.set(channel, state)),
      state
    );
  }
  _isChannelRecoveryActive(channel) {
    const state = this._channelRecoveryState.get(channel);
    return Boolean(state?.timer || state?.inFlight);
  }
  _cancelChannelRecovery(channel, { clearFailure: clearFailure = !0 } = {}) {
    const state = this._channelRecoveryState.get(channel);
    state?.timer && clearTimeout(state.timer);
    this._channelRecoveryState.delete(channel);
    clearFailure && this._clearPollFailure(this._channelLabel(channel));
  }
  _resetChannelRuntime(channel, cfg) {
    ('discord' !== channel && 'slack' !== channel) || delete cfg._botUserId;
  }
  _handleChannelPollSuccess(channel) {
    const label = this._channelLabel(channel),
      state = this._channelRecoveryState.get(channel),
      attempts = state?.attempts ?? 0,
      lastError = state?.lastError ?? '';
    (state?.timer && clearTimeout(state.timer),
      this._channelRecoveryState.delete(channel),
      this._clearPollFailure(label),
      attempts &&
        console.info(
          `[ChannelEngine] ${label} service recovered after ${attempts} restart attempt${1 === attempts ? '' : 's'}${lastError ? `. Last error: ${lastError}` : ''}`,
        ));
  }
  _handleChannelPollFailure(channel, err) {
    const label = this._channelLabel(channel);
    const state = this._getChannelRecoveryState(channel);
    ((state.lastError = getErrorMessage(err)),
      this._logPollFailure(label, err),
      this._running &&
        isRecoverableChannelRuntimeError(err) &&
        this._scheduleChannelRecovery(channel));
  }
  _scheduleChannelRecovery(channel) {
    if (!this._running) return;
    const label = this._channelLabel(channel),
      state = this._getChannelRecoveryState(channel);
    if (state.timer) return;
    state.attempts += 1;
    const delay =
      CHANNEL_RECOVERY_DELAYS[Math.min(state.attempts - 1, CHANNEL_RECOVERY_DELAYS.length - 1)];
    (console.warn(
      `[ChannelEngine] Restarting ${label} service in ${delay}ms (attempt ${state.attempts})${state.lastError ? `. Last error: ${state.lastError}` : '.'}`,
    ),
      (state.timer = setTimeout(() => {
        ((state.timer = null),
          this._restartChannelService(channel).catch((error) => {
            (console.error(`[ChannelEngine] ${label} restart failed:`, getErrorMessage(error)),
              this._scheduleChannelRecovery(channel));
          }));
      }, delay)));
  }
  async _restartChannelService(channel) {
    const state = this._channelRecoveryState.get(channel);
    if (!state || state.inFlight || !this._running) return;
    state.inFlight = !0;
    try {
      this._load();
      const cfg = this._data.channels[channel];
      if (!cfg?.enabled || !this._isConfigured(channel, cfg))
        return void this._cancelChannelRecovery(channel);
      this._resetChannelRuntime(channel, cfg);
      await this._pollChannel(channel, cfg, { ignoreRecoveryGuard: !0 });
    } finally {
      const latest = this._channelRecoveryState.get(channel);
      latest && (latest.inFlight = !1);
    }
  }
  async _pollChannel(channel, cfg, { ignoreRecoveryGuard: ignoreRecoveryGuard = !1 } = {}) {
    if (!ignoreRecoveryGuard && this._isChannelRecoveryActive(channel)) return !1;
    return 'telegram' === channel
      ? this._pollTelegram(cfg)
      : 'whatsapp' === channel
        ? this._pollWhatsApp(cfg)
        : 'discord' === channel
          ? this._pollDiscord(cfg)
          : 'slack' === channel
            ? this._pollSlack(cfg)
            : !1;
  }
  _clearPollFailure(channel) {
    this._pollFailureState.delete(channel);
  }
  _logPollFailure(channel, err) {
    const message = getErrorMessage(err),
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
      this._cancelChannelRecovery(name),
      this._persist(),
      { ok: !0, connectedAt: this._data.channels[name].connectedAt }
    );
  }
  removeChannel(name) {
    (this._load(),
      (this._data.channels[name] = cloneValue(DEFAULT_STATE.channels[name] ?? {})),
      (this._data.channels[name].enabled = !1),
      this._cancelChannelRecovery(name),
      this._persist());
  }
  toggleChannel(name, enabled) {
    (this._load(),
      this._data.channels[name] &&
        ((this._data.channels[name].enabled = Boolean(enabled)),
        this._cancelChannelRecovery(name),
        this._persist()));
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
    this._load();
    this._running = true;
    this._scheduleNextPoll();
  }
  _scheduleNextPoll() {
    if (!this._running) return;
    // Self-scheduling: next poll only fires AFTER the current one fully completes
    this._ticker = setTimeout(async () => {
      await this._poll();
      this._scheduleNextPoll();
    }, 3e3);
  }
  stop() {
    this._running = false;
    if (this._ticker) {
      clearTimeout(this._ticker);
      this._ticker = null;
    }
    for (const channel of [...this._channelRecoveryState.keys()])
      this._cancelChannelRecovery(channel, { clearFailure: !1 });
    for (const [, p] of this._pending) p.reject(new Error('App shutting down'));
    this._pending.clear();
  }
  async _poll() {
    if (this._processing) return;
    this._processing = true;
    try {
      // Single disk read for the whole poll cycle
      this._load();
      const ch = this._data.channels;
      await this._pollChannel('telegram', ch.telegram);
      await this._pollChannel('whatsapp', ch.whatsapp);
      await this._pollChannel('discord', ch.discord);
      await this._pollChannel('slack', ch.slack);
    } catch (err) {
      console.error('[ChannelEngine] Poll error:', err.message);
    } finally {
      this._processing = false;
    }
  }
  async _pollTelegram(cfg) {
    if (!cfg?.enabled || !cfg.botToken) return this._cancelChannelRecovery('telegram');
    let messages;
    try {
      // AbortController: 15-second hard cap on the HTTP request
      const ac = new AbortController();
      const fetchTimer = setTimeout(() => ac.abort(), 15e3);
      try {
        const base = `https://api.telegram.org/bot${cfg.botToken}`,
          offset = (cfg.lastUpdateId ?? 0) + 1,
          // timeout=2 gives headroom below the 3s poll interval — prevents overlap
          res = await channelFetch(`${base}/getUpdates?offset=${offset}&timeout=2&limit=10`, {
            signal: ac.signal,
          });
        if (!res.ok) throw new Error(`Telegram getUpdates HTTP ${res.status}`);
        const data = await res.json();
        if (!data.ok) throw new Error(data.description ?? 'Telegram API error');
        messages = (data.result ?? [])
          .filter((u) => u.message?.text)
          .map((u) => ({
            updateId: u.update_id,
            chatId: u.message.chat.id,
            text: u.message.text,
            from: u.message.from?.first_name ?? 'User',
          }));
      } finally {
        clearTimeout(fetchTimer);
      }
    } catch (err) {
      return void this._handleChannelPollFailure('telegram', err);
    }
    if ((this._handleChannelPollSuccess('telegram'), messages.length)) {
      const maxId = Math.max(...messages.map((m) => m.updateId));
      if (maxId >= (cfg.lastUpdateId ?? 0)) {
        cfg.lastUpdateId = maxId;
        this._persist();
      }
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
  async _pollWhatsApp(cfg) {
    if (!(cfg?.enabled && cfg.accountSid && cfg.authToken && cfg.fromNumber))
      return this._cancelChannelRecovery('whatsapp');
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
        // Cap at 200 (down from 500) — WhatsApp sandbox rates are low
        cfg._seenSids = seenSids.size > 200 ? new Set(Array.from(seenSids).slice(-200)) : seenSids;
        return messages;
      })(cfg);
    } catch (err) {
      return void this._handleChannelPollFailure('whatsapp', err);
    }
    this._handleChannelPollSuccess('whatsapp');
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
  async _pollDiscord(cfg) {
    if (!cfg?.enabled || !cfg.botToken || !cfg.channelId)
      return this._cancelChannelRecovery('discord');
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
      return void this._handleChannelPollFailure('discord', err);
    }
    (this._handleChannelPollSuccess('discord'),
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
  async _pollSlack(cfg) {
    if (!cfg?.enabled || !cfg.botToken || !cfg.channelId)
      return this._cancelChannelRecovery('slack');
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
      return void this._handleChannelPollFailure('slack', err);
    }
    (this._handleChannelPollSuccess('slack'),
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
