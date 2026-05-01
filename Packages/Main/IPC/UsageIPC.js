import { ipcMain } from 'electron';
import { loadPage } from '../Core/Window.js';
import Paths from '../Core/Paths.js';
import { wrapHandler } from './IPCWrapper.js';
import { loadJson, persistJson } from '../Services/FileService.js';
function load() {
  return loadJson(Paths.USAGE_FILE, { records: [] });
}
function persist(data) {
  persistJson(Paths.USAGE_FILE, data);
}
export const ipcMeta = { needs: [] };
export function register() {
  (ipcMain.handle('launch-usage', () => (loadPage(Paths.USAGE_PAGE), { ok: !0 })),
    ipcMain.handle(
      'track-usage',
      wrapHandler((record) => {
        const data = load();
        (data.records.push({
          timestamp: new Date().toISOString(),
          provider: record.provider ?? 'unknown',
          model: record.model ?? 'unknown',
          modelName: record.modelName ?? record.model ?? 'unknown',
          inputTokens: record.inputTokens ?? 0,
          outputTokens: record.outputTokens ?? 0,
          chatId: record.chatId ?? null,
          sourceType: record.sourceType ?? 'chat',
          sourceId: record.sourceId ?? null,
          sourceName: record.sourceName ?? null,
        }),
          data.records.length > 2e4 && (data.records = data.records.slice(-2e4)),
          persist(data));
      }),
    ),
    ipcMain.handle('get-usage', () => {
      try {
        const { records: records } = load();
        return { ok: !0, records: records };
      } catch (err) {
        return { ok: !1, records: [], error: err.message };
      }
    }),
    ipcMain.handle(
      'clear-usage',
      wrapHandler(() => {
        persist({ records: [] });
      }),
    ));
}
