import { randomUUID } from 'node:crypto';
import { BrowserWindow, net } from 'electron';
import { isConfigured } from './ChannelState.js';
import { toIso } from '../../Shared/Utils/DateUtils.js';
import { tryParseJson } from '../../Shared/Utils/AsyncUtils.js';

const CHANNEL_LABELS = Object.freeze({
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  discord: 'Discord',
  slack: 'Slack',
  zulip: 'Zulip',
  mattermost: 'Mattermost',
  ntfy: 'ntfy',
});

const RECOVERY_DELAYS = Object.freeze([1000, 3000, 5000, 10000, 15000, 30000]);
const RUNTIME_ERROR_PATTERNS = Object.freeze([
  /net::ERR_/i,
  /failed to fetch/i,
  /fetch failed/i,
  /networkerror/i,
  /econnreset/i,
  /socket hang up/i,
  /etimedout/i,
  /session closed/i,
  /aborted/i,
]);

function splitIntoChunks(value, maxLength) {
  const text = String(value ?? '');
  if (text.length <= maxLength) return [text];

  const chunks = [];
  for (let index = 0; index < text.length; index += maxLength) {
    chunks.push(text.slice(index, index + maxLength));
  }
  return chunks;
}

function sanitizeRequestTarget(input) {
  const raw = String(input ?? '');

  try {
    const url = new URL(raw);
    const pathSegments = url.pathname.split('/').filter(Boolean);

    if (url.hostname === 'api.telegram.org' && pathSegments[0]?.startsWith('bot')) {
      pathSegments[0] = 'bot<redacted>';
    }

    if (url.hostname === 'api.twilio.com') {
      const accountIndex = pathSegments.indexOf('Accounts');
      if (accountIndex >= 0 && pathSegments[accountIndex + 1]) {
        pathSegments[accountIndex + 1] = '<redacted>';
      }
    }

    return `${url.origin}/${pathSegments.join('/')}`;
  } catch {
    return raw;
  }
}

function normalizeBaseUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
    url.hash = '';
    url.search = '';
    return url.toString().replace(/\/+$/, '');
  } catch {
    return raw.replace(/\/+$/, '');
  }
}

function getBasicAuth(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

function getZulipHeaders(config) {
  return {
    Authorization: getBasicAuth(config.email, config.apiKey),
  };
}

function getMattermostHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

async function readChannelJson(response, fallbackMessage) {
  const data = await tryParseJson(response);
  if (!response.ok) {
    throw new Error(
      data.msg ?? data.message ?? data.error ?? `${fallbackMessage} HTTP ${response.status}`,
    );
  }

  return data;
}

function isZulipSuccess(data) {
  return data?.result === 'success' || data?.result === undefined;
}

function attachRequestContext(error, input, init) {
  const wrapped =
    error && typeof error === 'object'
      ? error
      : new Error(error instanceof Error ? error.message : String(error ?? 'Unknown error'));

  wrapped.channelRequest = {
    method: String(init?.method ?? 'GET').toUpperCase(),
    target: sanitizeRequestTarget(input),
  };
  return wrapped;
}

function getPrimaryErrorMessage(error) {
  return error instanceof Error ? error.message : String(error ?? 'Unknown error');
}

function getErrorMessage(error) {
  const primary = getPrimaryErrorMessage(error);
  const parts = [primary];
  const request = error?.channelRequest;

  for (const key of ['code', 'errno', 'type']) {
    const value = error && typeof error === 'object' ? error[key] : null;
    if (value && !primary.includes(String(value))) {
      parts.push(`${key}=${value}`);
    }
  }

  if (error?.cause) {
    const cause = getPrimaryErrorMessage(error.cause);
    if (cause && cause !== primary) parts.push(`cause=${cause}`);
  }

  if (request?.target) {
    parts.push(`request=${request.method ?? 'GET'} ${request.target}`);
  }

  return parts.join(' | ');
}

function isRecoverable(error) {
  const message = getErrorMessage(error);
  return RUNTIME_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

function validateFetchUrl(input) {
  const raw = String(input ?? '');
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid URL in outbound channel request: ${raw}`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`Unsafe protocol in outbound channel request: ${url.protocol}`);
  }
  return url.href;
}

async function channelFetch(input, init) {
  try {
    const safeUrl = validateFetchUrl(input);
    return await (typeof net?.fetch === 'function'
      ? net.fetch(safeUrl, init)
      : fetch(safeUrl, init));
  } catch (error) {
    throw attachRequestContext(error, input, init);
  }
}

async function sendTelegram(botToken, chatId, text) {
  for (const chunk of splitIntoChunks(text, 4000)) {
    const response = await channelFetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: chunk }),
    });

    if (!response.ok) {
      const data = await tryParseJson(response);
      throw new Error(data.description ?? `Telegram sendMessage HTTP ${response.status}`);
    }
  }
}

async function sendWhatsApp(config, to, text) {
  for (const chunk of splitIntoChunks(text, 1500)) {
    const body = new URLSearchParams({ From: config.fromNumber, To: to, Body: chunk });
    const auth = `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64')}`;
    const response = await channelFetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: auth,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      },
    );

    if (!response.ok) {
      const data = await tryParseJson(response);
      throw new Error(data.message ?? `Twilio sendMessage HTTP ${response.status}`);
    }
  }
}

async function sendDiscord(botToken, channelId, text) {
  for (const chunk of splitIntoChunks(text, 1990)) {
    const response = await channelFetch(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bot ${botToken}`,
        },
        body: JSON.stringify({ content: chunk }),
      },
    );

    if (!response.ok) {
      const data = await tryParseJson(response);
      throw new Error(data.message ?? `Discord sendMessage HTTP ${response.status}`);
    }
  }
}

async function sendSlack(botToken, channelId, text) {
  for (const chunk of splitIntoChunks(text, 3000)) {
    const response = await channelFetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${botToken}`,
      },
      body: JSON.stringify({ channel: channelId, text: chunk }),
    });

    if (!response.ok) {
      throw new Error(`Slack sendMessage HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!data.ok) {
      throw new Error(data.error ?? 'Slack sendMessage API error');
    }
  }
}

async function sendZulip(config, topic, text) {
  const baseUrl = normalizeBaseUrl(config.siteUrl);
  const messageTopic = String(topic || config.topic || 'Joanium').trim() || 'Joanium';

  for (const chunk of splitIntoChunks(text, 5000)) {
    const body = new URLSearchParams({
      type: 'channel',
      to: config.stream,
      topic: messageTopic,
      content: chunk,
    });
    const response = await channelFetch(`${baseUrl}/api/v1/messages`, {
      method: 'POST',
      headers: {
        ...getZulipHeaders(config),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    const data = await readChannelJson(response, 'Zulip sendMessage');

    if (!isZulipSuccess(data)) {
      throw new Error(data.msg ?? 'Zulip sendMessage API error');
    }
  }
}

async function sendMattermost(config, text) {
  const baseUrl = normalizeBaseUrl(config.siteUrl);

  for (const chunk of splitIntoChunks(text, 4000)) {
    const response = await channelFetch(`${baseUrl}/api/v4/posts`, {
      method: 'POST',
      headers: {
        ...getMattermostHeaders(config.accessToken),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channel_id: config.channelId, message: chunk }),
    });

    await readChannelJson(response, 'Mattermost create post');
  }
}

async function sendNtfy(config, text) {
  const baseUrl = normalizeBaseUrl(config.siteUrl);
  const topic = encodeURIComponent(config.topic);

  for (const chunk of splitIntoChunks(text, 3500)) {
    const response = await channelFetch(`${baseUrl}/${topic}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        Title: 'Joanium',
      },
      body: chunk,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(body || `ntfy publish HTTP ${response.status}`);
    }
  }
}

async function getZulipMe(config) {
  const baseUrl = normalizeBaseUrl(config.siteUrl);
  const response = await channelFetch(`${baseUrl}/api/v1/users/me`, {
    headers: getZulipHeaders(config),
  });
  const data = await readChannelJson(response, 'Zulip users/me');

  if (!isZulipSuccess(data)) {
    throw new Error(data.msg ?? 'Invalid Zulip credentials.');
  }

  return data;
}

async function getZulipSubscriptions(config) {
  const baseUrl = normalizeBaseUrl(config.siteUrl);
  const response = await channelFetch(`${baseUrl}/api/v1/users/me/subscriptions`, {
    headers: getZulipHeaders(config),
  });
  const data = await readChannelJson(response, 'Zulip subscriptions');

  if (!isZulipSuccess(data)) {
    throw new Error(data.msg ?? 'Could not validate Zulip channel.');
  }

  return data.subscriptions ?? [];
}

async function getMattermostMe(config) {
  const baseUrl = normalizeBaseUrl(config.siteUrl);
  const response = await channelFetch(`${baseUrl}/api/v4/users/me`, {
    headers: getMattermostHeaders(config.accessToken),
  });
  return readChannelJson(response, 'Mattermost users/me');
}

async function getMattermostChannel(config) {
  const baseUrl = normalizeBaseUrl(config.siteUrl);
  const response = await channelFetch(
    `${baseUrl}/api/v4/channels/${encodeURIComponent(config.channelId)}`,
    {
      headers: getMattermostHeaders(config.accessToken),
    },
  );
  return readChannelJson(response, 'Mattermost channel');
}

function parseNtfyMessages(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function getReplyWindow() {
  return BrowserWindow.getAllWindows().find((window) => !window.isDestroyed()) ?? null;
}

export function createChannelRuntime({ channelStateManager }) {
  let running = false;
  let processing = false;
  let ticker = null;
  const pendingReplies = new Map();
  const pollFailures = new Map();
  const recoveryState = new Map();
  const whatsappSeen = new Set();

  function clearPollFailure(channelName) {
    pollFailures.delete(channelName);
  }

  function logPollFailure(channelName, error) {
    const message = getErrorMessage(error);
    const now = Date.now();
    const previous = pollFailures.get(channelName);

    if (!previous || previous.message !== message || now - previous.loggedAt > 60000) {
      pollFailures.set(channelName, { message, loggedAt: now });
      console.warn(`[Channels] ${channelName} poll failed:`, message);
    }
  }

  function getRecovery(channelName) {
    let state = recoveryState.get(channelName);
    if (!state) {
      state = { attempts: 0, timer: null, inFlight: false, lastError: '' };
      recoveryState.set(channelName, state);
    }
    return state;
  }

  function cancelRecovery(channelName, { clearFailure = true } = {}) {
    const state = recoveryState.get(channelName);
    if (state?.timer) clearTimeout(state.timer);
    recoveryState.delete(channelName);
    if (clearFailure) clearPollFailure(CHANNEL_LABELS[channelName] ?? channelName);
  }

  function isRecoveryActive(channelName) {
    const state = recoveryState.get(channelName);
    return Boolean(state?.timer || state?.inFlight);
  }

  function handlePollSuccess(channelName) {
    const label = CHANNEL_LABELS[channelName] ?? channelName;
    const state = recoveryState.get(channelName);
    const attempts = state?.attempts ?? 0;
    const lastError = state?.lastError ?? '';

    if (state?.timer) clearTimeout(state.timer);
    recoveryState.delete(channelName);
    clearPollFailure(label);

    if (attempts) {
      console.info(
        `[Channels] ${label} recovered after ${attempts} restart attempt${attempts === 1 ? '' : 's'}${lastError ? `. Last error: ${lastError}` : ''}`,
      );
    }
  }

  function scheduleRecovery(channelName) {
    if (!running) return;
    const state = getRecovery(channelName);
    if (state.timer) return;

    state.attempts += 1;
    const delay = RECOVERY_DELAYS[Math.min(state.attempts - 1, RECOVERY_DELAYS.length - 1)];
    state.timer = setTimeout(() => {
      state.timer = null;
      restartChannel(channelName).catch((error) => {
        console.error(
          `[Channels] ${CHANNEL_LABELS[channelName]} restart failed:`,
          getErrorMessage(error),
        );
        scheduleRecovery(channelName);
      });
    }, delay);
  }

  function handlePollFailure(channelName, error) {
    const label = CHANNEL_LABELS[channelName] ?? channelName;
    const state = getRecovery(channelName);
    state.lastError = getErrorMessage(error);
    logPollFailure(label, error);

    if (running && isRecoverable(error)) {
      scheduleRecovery(channelName);
    }
  }

  async function restartChannel(channelName) {
    const state = recoveryState.get(channelName);
    if (!state || state.inFlight || !running) return;

    state.inFlight = true;
    try {
      const config = await channelStateManager.getChannel(channelName);
      if (!config?.enabled || !isConfigured(channelName, config)) {
        cancelRecovery(channelName);
        return;
      }
      await pollChannel(channelName, config, { ignoreRecoveryGuard: true });
    } finally {
      const latest = recoveryState.get(channelName);
      if (latest) latest.inFlight = false;
    }
  }

  function requestReply(channelName, from, text, metadata = {}) {
    return new Promise((resolve, reject) => {
      const window = getReplyWindow();
      if (!window) {
        reject(new Error('App window is not available.'));
        return;
      }

      if (pendingReplies.size >= 50) {
        const [oldestId] = pendingReplies.keys();
        const oldest = pendingReplies.get(oldestId);
        pendingReplies.delete(oldestId);
        oldest?.reject(new Error('Channel reply queue overflow.'));
      }

      const id = randomUUID();
      const timer = setTimeout(() => {
        pendingReplies.delete(id);
        reject(new Error('Channel reply timed out.'));
      }, 1800000);

      pendingReplies.set(id, {
        resolve: (reply) => {
          clearTimeout(timer);
          resolve(reply);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });

      window.webContents.send('channels:incoming', {
        id,
        channelName,
        from,
        text,
        metadata,
      });
    });
  }

  async function pollTelegram(config) {
    if (!config?.enabled || !config.botToken) {
      cancelRecovery('telegram');
      return;
    }

    let messages = [];

    try {
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), 15000);

      try {
        const baseUrl = `https://api.telegram.org/bot${config.botToken}`;
        const offset = (config.lastUpdateId ?? 0) + 1;
        const response = await channelFetch(
          `${baseUrl}/getUpdates?offset=${offset}&timeout=2&limit=10`,
          {
            signal: abortController.signal,
          },
        );

        if (!response.ok) {
          throw new Error(`Telegram getUpdates HTTP ${response.status}`);
        }

        const data = await response.json();
        if (!data.ok) {
          throw new Error(data.description ?? 'Telegram API error');
        }

        messages = (data.result ?? [])
          .filter((update) => update.message?.text || update.channel_post?.text)
          .map((update) => {
            // Channel posts (sent via a Telegram channel) arrive as `channel_post`,
            // not `message`. Fall back to channel_post so both sources are handled.
            const msg = update.message ?? update.channel_post;
            return {
              updateId: update.update_id,
              chatId: msg.chat.id,
              text: msg.text,
              from: update.message?.from?.first_name ?? msg.chat?.title ?? 'Channel',
              receivedAt: toIso(msg.date ? msg.date * 1000 : null),
            };
          });
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      handlePollFailure('telegram', error);
      return;
    }

    handlePollSuccess('telegram');

    if (messages.length > 0) {
      const lastUpdateId = Math.max(...messages.map((message) => message.updateId));
      if (lastUpdateId >= (config.lastUpdateId ?? 0)) {
        config.lastUpdateId = lastUpdateId;
        await channelStateManager.updateRuntimeState('telegram', { lastUpdateId });
      }
    }

    for (const message of messages) {
      void (async () => {
        let typingInterval = null;
        try {
          const sendTyping = () =>
            channelFetch(`https://api.telegram.org/bot${config.botToken}/sendChatAction`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ chat_id: message.chatId, action: 'typing' }),
            }).catch(() => {});

          void sendTyping();
          typingInterval = setInterval(sendTyping, 4500);
          const reply = await requestReply('telegram', message.from, message.text, {
            externalId: String(message.updateId),
            targetId: String(message.chatId),
            conversationId: String(message.chatId),
            receivedAt: message.receivedAt,
            systemPrompt: config.systemPrompt ?? '',
          });

          clearInterval(typingInterval);
          typingInterval = null;
          await sendTelegram(config.botToken, message.chatId, reply);
        } catch (error) {
          console.error(`[Channels] Telegram reply failed:`, getErrorMessage(error));
        } finally {
          if (typingInterval) clearInterval(typingInterval);
        }
      })();
    }
  }

  async function pollWhatsApp(config) {
    if (!config?.enabled || !config.accountSid || !config.authToken || !config.fromNumber) {
      cancelRecovery('whatsapp');
      return;
    }

    let messages = [];

    try {
      const encodedTo = encodeURIComponent(config.fromNumber);
      const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json?To=${encodedTo}&PageSize=10`;
      const auth = `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64')}`;
      const response = await channelFetch(url, { headers: { Authorization: auth } });

      if (!response.ok) {
        throw new Error(`Twilio HTTP ${response.status}`);
      }

      const data = await response.json();
      messages = [];

      for (const message of data.messages ?? []) {
        if (message.direction !== 'inbound') continue;
        if (whatsappSeen.has(message.sid)) continue;
        if (Date.now() - new Date(message.date_created).getTime() > 20000) continue;

        whatsappSeen.add(message.sid);
        messages.push({
          sid: message.sid,
          from: message.from,
          to: message.to,
          text: message.body,
          receivedAt: toIso(message.date_created),
        });
      }

      if (whatsappSeen.size > 200) {
        const recent = Array.from(whatsappSeen).slice(-200);
        whatsappSeen.clear();
        recent.forEach((sid) => whatsappSeen.add(sid));
      }
    } catch (error) {
      handlePollFailure('whatsapp', error);
      return;
    }

    handlePollSuccess('whatsapp');

    for (const message of messages) {
      void (async () => {
        try {
          const reply = await requestReply('whatsapp', message.from, message.text, {
            externalId: message.sid,
            targetId: message.to,
            conversationId: message.from,
            receivedAt: message.receivedAt,
            systemPrompt: config.systemPrompt ?? '',
          });
          await sendWhatsApp(config, message.from, reply);
        } catch (error) {
          console.error(`[Channels] WhatsApp reply failed:`, getErrorMessage(error));
        }
      })();
    }
  }

  async function pollDiscord(config) {
    if (!config?.enabled || !config.botToken || !config.channelId) {
      cancelRecovery('discord');
      return;
    }

    let messages = [];

    try {
      const url = `https://discord.com/api/v10/channels/${config.channelId}/messages?limit=10${config.lastMessageId ? `&after=${config.lastMessageId}` : ''}`;
      const response = await channelFetch(url, {
        headers: { Authorization: `Bot ${config.botToken}` },
      });

      if (response.status === 403) {
        throw new Error(
          `Discord 403: Bot cannot access channel ${config.channelId}. Make sure the bot is invited and has View Channel, Read Message History, and Send Messages permissions.`,
        );
      }

      if (response.status === 401) {
        throw new Error('Discord 401: Invalid bot token.');
      }

      if (!response.ok) {
        throw new Error(`Discord HTTP ${response.status}`);
      }

      const data = await response.json();
      messages = Array.isArray(data)
        ? data
            .filter((message) => !message.author?.bot && message.content?.trim())
            .map((message) => ({
              id: message.id,
              channelId: message.channel_id,
              text: message.content,
              from: message.author?.username ?? 'User',
              receivedAt: toIso(message.timestamp),
            }))
            .reverse()
        : [];
    } catch (error) {
      handlePollFailure('discord', error);
      return;
    }

    handlePollSuccess('discord');

    if (messages.length > 0) {
      const lastMessageId = messages[messages.length - 1].id;
      config.lastMessageId = lastMessageId;
      await channelStateManager.updateRuntimeState('discord', { lastMessageId });
    }

    for (const message of messages) {
      void (async () => {
        let typingInterval = null;
        try {
          const sendTyping = () =>
            channelFetch(`https://discord.com/api/v10/channels/${message.channelId}/typing`, {
              method: 'POST',
              headers: { Authorization: `Bot ${config.botToken}` },
            }).catch(() => {});

          void sendTyping();
          typingInterval = setInterval(sendTyping, 9000);
          const reply = await requestReply('discord', message.from, message.text, {
            externalId: message.id,
            targetId: message.channelId,
            conversationId: message.channelId,
            receivedAt: message.receivedAt,
            systemPrompt: config.systemPrompt ?? '',
          });

          clearInterval(typingInterval);
          typingInterval = null;
          await sendDiscord(config.botToken, message.channelId, reply);
        } catch (error) {
          console.error(`[Channels] Discord reply failed:`, getErrorMessage(error));
        } finally {
          if (typingInterval) clearInterval(typingInterval);
        }
      })();
    }
  }

  async function pollSlack(config) {
    if (!config?.enabled || !config.botToken || !config.channelId) {
      cancelRecovery('slack');
      return;
    }

    let messages = [];

    try {
      let botUserId = config.botUserId ?? '';

      if (!botUserId) {
        const authResponse = await channelFetch('https://slack.com/api/auth.test', {
          headers: { Authorization: `Bearer ${config.botToken}` },
        });
        const authData = await tryParseJson(authResponse);
        if (authData.ok) {
          botUserId = authData.bot_id ?? authData.user_id ?? '';
        }
      }

      const url = `https://slack.com/api/conversations.history?channel=${config.channelId}&limit=10${config.lastMessageTs ? `&oldest=${config.lastMessageTs}` : ''}`;
      const response = await channelFetch(url, {
        headers: { Authorization: `Bearer ${config.botToken}` },
      });

      if (!response.ok) {
        throw new Error(`Slack HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data.ok) {
        if (data.error === 'channel_not_found') {
          throw new Error(
            `Slack channel_not_found: Channel ID "${config.channelId}" is invalid or the bot cannot see it.`,
          );
        }

        if (data.error === 'not_in_channel') {
          throw new Error(
            `Slack not_in_channel: Invite the bot to channel ${config.channelId} before enabling replies.`,
          );
        }

        throw new Error(data.error ?? 'Slack API error');
      }

      messages = (data.messages ?? [])
        .filter(
          (message) =>
            message.type === 'message' &&
            !message.subtype &&
            !message.bot_id &&
            (!botUserId || message.user !== botUserId) &&
            message.text?.trim(),
        )
        .map((message) => ({
          ts: message.ts,
          channelId: config.channelId,
          text: message.text,
          from: message.user || 'User',
          receivedAt: toIso(Number.parseFloat(message.ts) * 1000),
        }))
        .reverse();
    } catch (error) {
      handlePollFailure('slack', error);
      return;
    }

    handlePollSuccess('slack');

    if (messages.length > 0) {
      const lastMessageTs = messages[messages.length - 1].ts;
      config.lastMessageTs = lastMessageTs;
      await channelStateManager.updateRuntimeState('slack', { lastMessageTs });
    }

    for (const message of messages) {
      void (async () => {
        try {
          const reply = await requestReply('slack', message.from, message.text, {
            externalId: message.ts,
            targetId: message.channelId,
            conversationId: message.channelId,
            receivedAt: message.receivedAt,
            systemPrompt: config.systemPrompt ?? '',
          });
          await sendSlack(config.botToken, config.channelId, reply);
        } catch (error) {
          console.error(`[Channels] Slack reply failed:`, getErrorMessage(error));
        }
      })();
    }
  }

  async function pollZulip(config) {
    if (!config?.enabled || !config.siteUrl || !config.email || !config.apiKey || !config.stream) {
      cancelRecovery('zulip');
      return;
    }

    let messages = [];
    let maxMessageId = Number(config.lastMessageId ?? 0);

    try {
      const baseUrl = normalizeBaseUrl(config.siteUrl);
      const url = new URL(`${baseUrl}/api/v1/messages`);
      const hasCursor = config.lastMessageId !== null && config.lastMessageId !== undefined;
      const lastMessageId = hasCursor ? Number(config.lastMessageId) : 0;
      const narrow = [{ operator: 'channel', operand: config.stream }];
      if (config.topic?.trim()) {
        narrow.push({ operator: 'topic', operand: config.topic.trim() });
      }

      url.searchParams.set('anchor', hasCursor ? String(lastMessageId) : 'newest');
      url.searchParams.set('num_before', hasCursor ? '0' : '10');
      url.searchParams.set('num_after', hasCursor ? '10' : '0');
      url.searchParams.set('include_anchor', hasCursor ? 'false' : 'true');
      url.searchParams.set('apply_markdown', 'false');
      url.searchParams.set('allow_empty_topic_name', 'true');
      url.searchParams.set('narrow', JSON.stringify(narrow));

      const response = await channelFetch(url, { headers: getZulipHeaders(config) });
      const data = await readChannelJson(response, 'Zulip messages');
      if (!isZulipSuccess(data)) {
        throw new Error(data.msg ?? 'Zulip API error');
      }

      const rawMessages = Array.isArray(data.messages) ? data.messages : [];
      maxMessageId = rawMessages.reduce(
        (max, message) => Math.max(max, Number(message.id ?? 0)),
        maxMessageId,
      );

      if (!hasCursor) {
        await channelStateManager.updateRuntimeState('zulip', { lastMessageId: maxMessageId });
        return;
      }

      messages = rawMessages
        .filter(
          (message) =>
            Number(message.id ?? 0) > lastMessageId &&
            message.sender_email !== config.email &&
            String(message.content ?? '').trim(),
        )
        .map((message) => ({
          id: String(message.id),
          topic: message.topic ?? message.subject ?? config.topic ?? '',
          text: String(message.content ?? ''),
          from: message.sender_full_name ?? message.sender_email ?? 'User',
          receivedAt: toIso(message.timestamp ? message.timestamp * 1000 : null),
        }));
    } catch (error) {
      handlePollFailure('zulip', error);
      return;
    }

    handlePollSuccess('zulip');

    if (maxMessageId > Number(config.lastMessageId ?? 0)) {
      config.lastMessageId = maxMessageId;
      await channelStateManager.updateRuntimeState('zulip', { lastMessageId: maxMessageId });
    }

    for (const message of messages) {
      void (async () => {
        try {
          const reply = await requestReply('zulip', message.from, message.text, {
            externalId: message.id,
            targetId: config.stream,
            conversationId: `${config.stream}:${message.topic}`,
            receivedAt: message.receivedAt,
            systemPrompt: config.systemPrompt ?? '',
          });
          await sendZulip(config, message.topic, reply);
        } catch (error) {
          console.error(`[Channels] Zulip reply failed:`, getErrorMessage(error));
        }
      })();
    }
  }

  async function pollMattermost(config) {
    if (!config?.enabled || !config.siteUrl || !config.accessToken || !config.channelId) {
      cancelRecovery('mattermost');
      return;
    }

    let messages = [];
    let maxCreateAt = Number(config.lastPostCreateAt ?? 0);

    try {
      if (!config.userId) {
        const user = await getMattermostMe(config);
        config.userId = user.id ?? '';
        if (config.userId) {
          await channelStateManager.updateRuntimeState('mattermost', { userId: config.userId });
        }
      }

      const baseUrl = normalizeBaseUrl(config.siteUrl);
      const response = await channelFetch(
        `${baseUrl}/api/v4/channels/${encodeURIComponent(config.channelId)}/posts?page=0&per_page=10`,
        {
          headers: getMattermostHeaders(config.accessToken),
        },
      );
      const data = await readChannelJson(response, 'Mattermost posts');
      const rawPosts = Array.isArray(data.order)
        ? data.order.map((id) => data.posts?.[id]).filter(Boolean)
        : Object.values(data.posts ?? {});
      const hasCursor = config.lastPostCreateAt !== null && config.lastPostCreateAt !== undefined;
      const lastPostCreateAt = hasCursor ? Number(config.lastPostCreateAt) : 0;

      maxCreateAt = rawPosts.reduce(
        (max, post) => Math.max(max, Number(post.create_at ?? 0)),
        maxCreateAt,
      );

      if (!hasCursor) {
        await channelStateManager.updateRuntimeState('mattermost', {
          lastPostCreateAt: maxCreateAt,
        });
        return;
      }

      messages = rawPosts
        .filter(
          (post) =>
            Number(post.create_at ?? 0) > lastPostCreateAt &&
            post.user_id !== config.userId &&
            String(post.message ?? '').trim(),
        )
        .sort((left, right) => Number(left.create_at ?? 0) - Number(right.create_at ?? 0))
        .map((post) => ({
          id: post.id,
          text: String(post.message ?? ''),
          from: post.user_id ?? 'User',
          receivedAt: toIso(Number(post.create_at ?? 0)),
        }));
    } catch (error) {
      handlePollFailure('mattermost', error);
      return;
    }

    handlePollSuccess('mattermost');

    if (maxCreateAt > Number(config.lastPostCreateAt ?? 0)) {
      config.lastPostCreateAt = maxCreateAt;
      await channelStateManager.updateRuntimeState('mattermost', { lastPostCreateAt: maxCreateAt });
    }

    for (const message of messages) {
      void (async () => {
        try {
          const reply = await requestReply('mattermost', message.from, message.text, {
            externalId: message.id,
            targetId: config.channelId,
            conversationId: config.channelId,
            receivedAt: message.receivedAt,
            systemPrompt: config.systemPrompt ?? '',
          });
          await sendMattermost(config, reply);
        } catch (error) {
          console.error(`[Channels] Mattermost reply failed:`, getErrorMessage(error));
        }
      })();
    }
  }

  async function pollNtfy(config) {
    if (!config?.enabled || !config.siteUrl || !config.topic) {
      cancelRecovery('ntfy');
      return;
    }

    let messages = [];
    let latestMessageId = config.lastMessageId ?? null;

    try {
      const baseUrl = normalizeBaseUrl(config.siteUrl);
      const topic = encodeURIComponent(config.topic);
      const url = new URL(`${baseUrl}/${topic}/json`);
      const hasCursor = config.lastMessageId !== null && config.lastMessageId !== undefined;

      url.searchParams.set('poll', '1');
      url.searchParams.set('since', hasCursor ? String(config.lastMessageId) : 'all');

      const response = await channelFetch(url);
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(body || `ntfy poll HTTP ${response.status}`);
      }

      const rawMessages = parseNtfyMessages(await response.text());
      latestMessageId = rawMessages.at(-1)?.id ?? latestMessageId;

      if (!hasCursor) {
        await channelStateManager.updateRuntimeState('ntfy', { lastMessageId: latestMessageId });
        return;
      }

      messages = rawMessages
        .filter(
          (message) =>
            message.event === 'message' &&
            String(message.message ?? '').trim() &&
            String(message.title ?? '')
              .trim()
              .toLowerCase() !== 'joanium',
        )
        .map((message) => ({
          id: String(message.id ?? ''),
          text: String(message.message ?? ''),
          from: message.title || message.name || 'ntfy',
          receivedAt: toIso(message.time ? message.time * 1000 : null),
        }));
    } catch (error) {
      handlePollFailure('ntfy', error);
      return;
    }

    handlePollSuccess('ntfy');

    if (latestMessageId && latestMessageId !== config.lastMessageId) {
      config.lastMessageId = latestMessageId;
      await channelStateManager.updateRuntimeState('ntfy', { lastMessageId: latestMessageId });
    }

    for (const message of messages) {
      void (async () => {
        try {
          const reply = await requestReply('ntfy', message.from, message.text, {
            externalId: message.id,
            targetId: config.topic,
            conversationId: config.topic,
            receivedAt: message.receivedAt,
            systemPrompt: config.systemPrompt ?? '',
          });
          await sendNtfy(config, reply);
        } catch (error) {
          console.error(`[Channels] ntfy reply failed:`, getErrorMessage(error));
        }
      })();
    }
  }

  async function pollChannel(channelName, config, { ignoreRecoveryGuard = false } = {}) {
    if (!ignoreRecoveryGuard && isRecoveryActive(channelName)) return;

    if (channelName === 'telegram') return pollTelegram(config);
    if (channelName === 'whatsapp') return pollWhatsApp(config);
    if (channelName === 'discord') return pollDiscord(config);
    if (channelName === 'slack') return pollSlack(config);
    if (channelName === 'zulip') return pollZulip(config);
    if (channelName === 'mattermost') return pollMattermost(config);
    if (channelName === 'ntfy') return pollNtfy(config);
  }

  async function poll() {
    if (processing) return;
    processing = true;

    try {
      for (const channelName of [
        'telegram',
        'whatsapp',
        'discord',
        'slack',
        'zulip',
        'mattermost',
        'ntfy',
      ]) {
        const config = await channelStateManager.getChannel(channelName);
        await pollChannel(channelName, config);
      }
    } catch (error) {
      console.error('[Channels] Poll cycle failed:', getErrorMessage(error));
    } finally {
      processing = false;
    }
  }

  function scheduleNextPoll() {
    if (!running) return;

    ticker = setTimeout(async () => {
      await poll();
      scheduleNextPoll();
    }, 3000);
  }

  return {
    start() {
      if (running) return;
      running = true;
      scheduleNextPoll();
    },

    stop() {
      running = false;
      if (ticker) clearTimeout(ticker);
      ticker = null;

      for (const channelName of [...recoveryState.keys()]) {
        cancelRecovery(channelName, { clearFailure: false });
      }

      for (const pending of pendingReplies.values()) {
        pending.reject(new Error('App is shutting down.'));
      }
      pendingReplies.clear();
    },

    resolveReply(id, text) {
      const pending = pendingReplies.get(id);
      if (!pending) return false;
      pendingReplies.delete(id);
      pending.resolve(String(text ?? ''));
      return true;
    },

    async validateTelegram(botToken) {
      const response = await channelFetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.description ?? 'Invalid bot token.');
      }
      return {
        username: data.result?.username ?? '',
        firstName: data.result?.first_name ?? '',
      };
    },

    async validateWhatsApp(accountSid, authToken) {
      const auth = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`;
      const response = await channelFetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
        {
          headers: { Authorization: auth },
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message ?? 'Invalid Twilio credentials.');
      }
      return { friendlyName: data.friendly_name ?? accountSid };
    },

    async validateDiscord(botToken) {
      const response = await channelFetch('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: `Bot ${botToken}` },
      });
      if (!response.ok) {
        throw new Error('Invalid Discord bot token.');
      }
      const data = await response.json();
      return { username: data.username ?? '' };
    },

    async validateDiscordChannel(botToken, channelId) {
      const response = await channelFetch(`https://discord.com/api/v10/channels/${channelId}`, {
        headers: { Authorization: `Bot ${botToken}` },
      });

      if (response.status === 403) {
        throw new Error(
          `Bot cannot access channel ${channelId}. Invite the bot and grant View Channel, Read Message History, and Send Messages permissions.`,
        );
      }

      if (response.status === 404) {
        throw new Error(`Channel ${channelId} was not found. Check the Discord Channel ID.`);
      }

      if (response.status === 401) {
        throw new Error('Invalid Discord bot token.');
      }

      if (!response.ok) {
        throw new Error(`Discord HTTP ${response.status}`);
      }

      const data = await response.json();
      return { channelName: data.name ?? channelId };
    },

    async validateSlack(botToken) {
      const response = await channelFetch('https://slack.com/api/auth.test', {
        headers: { Authorization: `Bearer ${botToken}` },
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? 'Invalid Slack token.');
      }
      return {
        name: data.user ?? '',
        team: data.team ?? '',
      };
    },

    async validateSlackChannel(botToken, channelId) {
      const response = await channelFetch(
        `https://slack.com/api/conversations.info?channel=${encodeURIComponent(channelId)}`,
        { headers: { Authorization: `Bearer ${botToken}` } },
      );

      if (!response.ok) {
        throw new Error(`Slack HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data.ok) {
        if (data.error === 'channel_not_found') {
          throw new Error(
            'Channel not found. Make sure the Channel ID is correct and starts with C for public channels.',
          );
        }

        if (data.error === 'not_in_channel') {
          throw new Error(`Invite the bot to channel ${channelId}, then try again.`);
        }

        throw new Error(data.error ?? 'Could not validate Slack channel.');
      }

      if (data.channel?.is_member === false) {
        throw new Error(`Invite the bot to channel ${channelId}, then try again.`);
      }

      return {
        channelName: data.channel?.name ?? channelId,
        isMember: data.channel?.is_member ?? true,
      };
    },

    async validateZulip(siteUrl, email, apiKey) {
      const config = { siteUrl, email, apiKey };
      const data = await getZulipMe(config);
      return {
        email: data.email ?? email,
        fullName: data.full_name ?? data.fullName ?? '',
      };
    },

    async validateZulipStream(siteUrl, email, apiKey, stream) {
      const config = { siteUrl, email, apiKey };
      const subscriptions = await getZulipSubscriptions(config);
      const matched = subscriptions.find((subscription) => subscription.name === stream);

      if (!matched) {
        throw new Error(`Zulip channel "${stream}" was not found in this bot's subscriptions.`);
      }

      return {
        streamName: matched.name ?? stream,
      };
    },

    async validateMattermost(siteUrl, accessToken) {
      const data = await getMattermostMe({ siteUrl, accessToken });
      return {
        userId: data.id ?? '',
        username: data.username ?? '',
      };
    },

    async validateMattermostChannel(siteUrl, accessToken, channelId) {
      const data = await getMattermostChannel({ siteUrl, accessToken, channelId });
      return {
        channelName: data.display_name || data.name || channelId,
      };
    },

    async validateNtfy(siteUrl, topic) {
      const baseUrl = normalizeBaseUrl(siteUrl);
      const safeTopic = String(topic ?? '').trim();
      if (!baseUrl || !safeTopic) throw new Error('ntfy site URL and topic are required.');

      const response = await channelFetch(
        `${baseUrl}/${encodeURIComponent(safeTopic)}/json?poll=1&since=all`,
      );
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(body || `ntfy validation HTTP ${response.status}`);
      }

      return { topic: safeTopic };
    },
  };
}
