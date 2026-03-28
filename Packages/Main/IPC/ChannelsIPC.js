import { ipcMain } from 'electron';

/**
 * @param {import('../../Channels/Core/ChannelEngine.js').ChannelEngine} channelEngine
 */
export function register(channelEngine) {

  /* ── Get all channels (status only, no secrets) ── */
  ipcMain.handle('get-channels', () => {
    try { return { ok: true, channels: channelEngine.getAll() }; }
    catch (err) { return { ok: false, error: err.message, channels: {} }; }
  });

  /* ── Get safe channel config for pre-filling the UI ── */
  ipcMain.handle('get-channel-config', (_e, name) => {
    try {
      const c = channelEngine.getChannel(name);
      if (!c) return { ok: false, error: 'Unknown channel' };
      const safe = { enabled: c.enabled, connectedAt: c.connectedAt };
      if (name === 'telegram') safe.botTokenSet = Boolean(c.botToken);
      if (name === 'whatsapp') {
        safe.accountSidSet = Boolean(c.accountSid);
        safe.authTokenSet  = Boolean(c.authToken);
        safe.fromNumber    = c.fromNumber ?? '';
      }
      return { ok: true, config: safe };
    } catch (err) { return { ok: false, error: err.message }; }
  });

  /* ── Save / connect a channel ── */
  ipcMain.handle('save-channel', (_e, name, config) => {
    try { return channelEngine.saveChannel(name, config); }
    catch (err) { return { ok: false, error: err.message }; }
  });

  /* ── Disconnect / remove a channel ── */
  ipcMain.handle('remove-channel', (_e, name) => {
    try { channelEngine.removeChannel(name); return { ok: true }; }
    catch (err) { return { ok: false, error: err.message }; }
  });

  /* ── Toggle a channel on/off without clearing credentials ── */
  ipcMain.handle('toggle-channel', (_e, name, enabled) => {
    try { channelEngine.toggleChannel(name, enabled); return { ok: true }; }
    catch (err) { return { ok: false, error: err.message }; }
  });

  /* ── Validate credentials ── */
  ipcMain.handle('validate-channel', async (_e, name, credentials) => {
    try {
      if (name === 'telegram') {
        const info = await channelEngine.validateTelegram(credentials.botToken);
        return { ok: true, ...info };
      }
      if (name === 'whatsapp') {
        const info = await channelEngine.validateWhatsApp(credentials.accountSid, credentials.authToken);
        return { ok: true, ...info };
      }
      return { ok: false, error: 'Unknown channel' };
    } catch (err) { return { ok: false, error: err.message }; }
  });

  /* ── Reply from renderer's chat pipeline back to channel engine ──
     The renderer's Channel Gateway calls this after running the
     incoming message through agentLoop (full tools + usage tracking).
  ── */
  ipcMain.handle('channel-reply', (_e, id, text) => {
    try { channelEngine.resolveReply(id, text); return { ok: true }; }
    catch (err) { return { ok: false, error: err.message }; }
  });
}
