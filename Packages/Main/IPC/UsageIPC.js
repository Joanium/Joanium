import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { loadPage } from '../Core/Window.js';
import Paths from '../Core/Paths.js';
import { wrapHandler } from './IPCWrapper.js';

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

export const ipcMeta = { needs: [] };
export function register() {
  ipcMain.handle('launch-usage', () => {
    loadPage(Paths.USAGE_PAGE);
    return { ok: true };
  });

  ipcMain.handle('track-usage', wrapHandler((record) => {
    const data = load();
    data.records.push({
      timestamp: new Date().toISOString(),
      provider: record.provider ?? 'unknown',
      model: record.model ?? 'unknown',
      modelName: record.modelName ?? record.model ?? 'unknown',
      inputTokens: record.inputTokens ?? 0,
      outputTokens: record.outputTokens ?? 0,
      chatId: record.chatId ?? null,
    });
    if (data.records.length > 20_000)
      data.records = data.records.slice(-20_000);
    persist(data);
  }));

  ipcMain.handle('get-usage', () => {
    try {
      const { records } = load();
      return { ok: true, records };
    } catch (err) {
      return { ok: false, records: [], error: err.message };
    }
  });

  ipcMain.handle('clear-usage', wrapHandler(() => {
    persist({ records: [] });
  }));
}
