// ─────────────────────────────────────────────
//  openworld — Packages/Main/IPC/GmailIPC.js
//  Handlers for Gmail OAuth + read/search/send operations.
// ─────────────────────────────────────────────

import { ipcMain } from 'electron';
import * as GmailAPI                          from '../../Automation/Gmail.js';
import { startGmailOAuthFlow }                from '../../Automation/Gmail.js';
import { invalidate as invalidateSysPrompt }  from '../Services/SystemPromptService.js';

/**
 * @param {ConnectorEngine} connectorEngine
 */
export function register(connectorEngine) {
  // ── One-click Google OAuth flow ──────────────────────────────────────
  ipcMain.handle('gmail-oauth-start', async (_e, clientId, clientSecret) => {
    try {
      if (!clientId?.trim() || !clientSecret?.trim())
        return { ok: false, error: 'Client ID and Client Secret are required' };

      const tokens = await startGmailOAuthFlow(clientId.trim(), clientSecret.trim());
      connectorEngine.saveConnector('gmail', tokens);
      invalidateSysPrompt();
      return { ok: true, email: tokens.email };
    } catch (err) { return { ok: false, error: err.message }; }
  });

  // ── Read / browse ─────────────────────────────────────────────────────
  ipcMain.handle('gmail-get-brief', async (_e, maxResults = 15) => {
    try {
      const creds = connectorEngine.getCredentials('gmail');
      if (!creds?.accessToken) return { ok: false, error: 'Gmail not connected' };
      const brief = await GmailAPI.getEmailBrief(creds, maxResults);
      return { ok: true, ...brief };
    } catch (err) { return { ok: false, error: err.message }; }
  });

  ipcMain.handle('gmail-get-unread', async (_e, maxResults = 20) => {
    try {
      const creds = connectorEngine.getCredentials('gmail');
      if (!creds?.accessToken) return { ok: false, error: 'Gmail not connected' };
      return { ok: true, emails: await GmailAPI.getUnreadEmails(creds, maxResults) };
    } catch (err) { return { ok: false, error: err.message }; }
  });

  ipcMain.handle('gmail-search', async (_e, query, maxResults = 10) => {
    try {
      const creds = connectorEngine.getCredentials('gmail');
      if (!creds?.accessToken) return { ok: false, error: 'Gmail not connected' };
      return { ok: true, emails: await GmailAPI.searchEmails(creds, query, maxResults) };
    } catch (err) { return { ok: false, error: err.message }; }
  });

  // ── Send ──────────────────────────────────────────────────────────────
  ipcMain.handle('gmail-send', async (_e, to, subject, body) => {
    try {
      const creds = connectorEngine.getCredentials('gmail');
      if (!creds?.accessToken) return { ok: false, error: 'Gmail not connected' };
      await GmailAPI.sendEmail(creds, to, subject, body);
      return { ok: true };
    } catch (err) { return { ok: false, error: err.message }; }
  });
}
