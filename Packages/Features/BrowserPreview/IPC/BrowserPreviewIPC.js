import { ipcMain } from 'electron';
export const ipcMeta = { needs: ['browserPreviewService'] };
export function register(browserPreviewService) {
  (ipcMain.handle('browser-preview-get-state', () => {
    try {
      return { ok: !0, state: browserPreviewService.getState() };
    } catch (err) {
      return { ok: !1, error: err.message };
    }
  }),
    ipcMain.handle('browser-preview-set-visible', (_event, visible) => {
      try {
        return (browserPreviewService.setVisible(Boolean(visible)), { ok: !0 });
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }),
    ipcMain.handle('browser-preview-set-bounds', (_event, bounds) => {
      try {
        return (browserPreviewService.setHostBounds(bounds ?? null), { ok: !0 });
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }));
}
