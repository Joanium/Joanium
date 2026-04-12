import { ipcMain } from 'electron';
function loadMessages(messageStore) {
  return messageStore.load(() => ({ messages: [] }));
}
function persistMessages(messageStore, data) {
  messageStore.save(data);
}
export const ipcMeta = { needs: ['channelEngine', 'featureStorage'] };
export function register(channelEngine, featureStorage) {
  const messageStore = featureStorage.get('channelMessages');
  (ipcMain.handle('get-channels', () => {
    try {
      return { ok: !0, channels: channelEngine.getAll() };
    } catch (err) {
      return { ok: !1, error: err.message, channels: {} };
    }
  }),
    ipcMain.handle('get-channel-config', (_e, name) => {
      try {
        const c = channelEngine.getChannel(name);
        if (!c) return { ok: !1, error: 'Unknown channel' };
        const safe = { enabled: c.enabled, connectedAt: c.connectedAt };
        return (
          'telegram' === name && (safe.botTokenSet = Boolean(c.botToken)),
          'whatsapp' === name &&
            ((safe.accountSidSet = Boolean(c.accountSid)),
            (safe.authTokenSet = Boolean(c.authToken)),
            (safe.fromNumber = c.fromNumber ?? '')),
          'discord' === name &&
            ((safe.channelId = c.channelId ?? ''), (safe.botTokenSet = Boolean(c.botToken))),
          'slack' === name &&
            ((safe.channelId = c.channelId ?? ''), (safe.botTokenSet = Boolean(c.botToken))),
          { ok: !0, config: safe }
        );
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }),
    ipcMain.handle('save-channel', (_e, name, config) => {
      try {
        return channelEngine.saveChannel(name, config);
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }),
    ipcMain.handle('remove-channel', (_e, name) => {
      try {
        return (channelEngine.removeChannel(name), { ok: !0 });
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }),
    ipcMain.handle('toggle-channel', (_e, name, enabled) => {
      try {
        return (channelEngine.toggleChannel(name, enabled), { ok: !0 });
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }),
    ipcMain.handle('validate-channel', async (_e, name, credentials) => {
      try {
        return 'telegram' === name
          ? { ok: !0, ...(await channelEngine.validateTelegram(credentials.botToken)) }
          : 'whatsapp' === name
            ? {
                ok: !0,
                ...(await channelEngine.validateWhatsApp(
                  credentials.accountSid,
                  credentials.authToken,
                )),
              }
            : 'discord' === name
              ? { ok: !0, ...(await channelEngine.validateDiscord(credentials.botToken)) }
              : 'slack' === name
                ? { ok: !0, ...(await channelEngine.validateSlack(credentials.botToken)) }
                : { ok: !1, error: 'Unknown channel' };
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }),
    ipcMain.handle('channel-reply', (_e, id, text) => {
      try {
        return (channelEngine.resolveReply(id, text), { ok: !0 });
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }),
    ipcMain.handle('save-channel-message', (_e, msg) => {
      try {
        const data = loadMessages(messageStore);
        return (
          data.messages.unshift({
            id: `chmsg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            channel: msg.channel,
            incoming: msg.incoming,
            reply: msg.reply,
            timestamp: new Date().toISOString(),
          }),
          data.messages.length > 500 && (data.messages.length = 500),
          persistMessages(messageStore, data),
          { ok: !0 }
        );
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }),
    ipcMain.handle('get-channel-messages', () => {
      try {
        return { ok: !0, messages: loadMessages(messageStore).messages };
      } catch (err) {
        return { ok: !1, error: err.message, messages: [] };
      }
    }),
    ipcMain.handle('delete-channel-message', (_e, msgId) => {
      try {
        const data = loadMessages(messageStore);
        return (
          (data.messages = data.messages.filter((m) => m.id !== msgId)),
          persistMessages(messageStore, data),
          { ok: !0 }
        );
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }),
    ipcMain.handle('clear-channel-messages', () => {
      try {
        return (persistMessages(messageStore, { messages: [] }), { ok: !0 });
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }));
}
