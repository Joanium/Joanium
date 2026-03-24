// ─────────────────────────────────────────────
//  Romelson — Packages/Main/IPC/UsageIPC.js
//  Tracks per-request token usage, persists to
//  Data/Usage.json, and serves the Usage page.
// ─────────────────────────────────────────────

import { ipcMain } from 'electron';
import fs   from 'fs';
import path from 'path';
import { loadPage } from '../Window.js';
import Paths from '../Paths.js';

/* ── Helpers ──────────────────────────────── */
function load() {
  try {
    if (fs.existsSync(Paths.USAGE_FILE))
      return JSON.parse(fs.readFileSync(Paths.USAGE_FILE, 'utf-8'));
  } catch { /* fall through */ }
  return { records: [] };
}

function persist(data) {
  const dir = path.dirname(Paths.USAGE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(Paths.USAGE_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/* ── Registration ─────────────────────────── */
export function register() {
  /* Navigate to Usage page */
  ipcMain.handle('launch-usage', () => {
    loadPage(Paths.USAGE_PAGE);
    return { ok: true };
  });

  /* Record one API call's token usage */
  ipcMain.handle('track-usage', (_e, record) => {
    try {
      const data = load();
      data.records.push({
        timestamp:   new Date().toISOString(),
        provider:    record.provider    ?? 'unknown',
        model:       record.model       ?? 'unknown',
        modelName:   record.modelName   ?? record.model ?? 'unknown',
        inputTokens: record.inputTokens  ?? 0,
        outputTokens:record.outputTokens ?? 0,
        chatId:      record.chatId      ?? null,
      });
      // Keep last 20 000 records (~ months of heavy use)
      if (data.records.length > 20_000)
        data.records = data.records.slice(-20_000);
      persist(data);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  /* Return all records */
  ipcMain.handle('get-usage', () => {
    try {
      const { records } = load();
      return { ok: true, records };
    } catch (err) {
      return { ok: false, records: [], error: err.message };
    }
  });

  /* Wipe all records */
  ipcMain.handle('clear-usage', () => {
    try {
      persist({ records: [] });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}
