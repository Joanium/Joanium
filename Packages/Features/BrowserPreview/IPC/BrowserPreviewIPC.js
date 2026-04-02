import { ipcMain } from 'electron';

export const ipcMeta = { needs: ['browserPreviewService'] };
export function register(browserPreviewService) {
  ipcMain.handle('browser-preview-get-state', () => {
    try {
      return { ok: true, state: browserPreviewService.getState() };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('browser-preview-set-visible', (_event, visible) => {
    try {
      browserPreviewService.setVisible(Boolean(visible));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('browser-preview-set-bounds', (_event, bounds) => {
    try {
      browserPreviewService.setHostBounds(bounds ?? null);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}
