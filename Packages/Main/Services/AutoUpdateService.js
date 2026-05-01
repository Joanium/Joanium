import { BrowserWindow } from 'electron';
import electronUpdater from 'electron-updater';
import log from 'electron-log';
let enabled = !1;
export function setupAutoUpdates() {
  if (enabled) return;
  let autoUpdater;
  enabled = !0;
  try {
    autoUpdater = electronUpdater.autoUpdater;
  } catch (err) {
    const message = err?.stack ?? err?.message ?? String(err);
    return void log.warn('[AutoUpdate] Could not initialise autoUpdater (skipping):', message);
  }
  autoUpdater.logger = log;
  try {
    log.transports.file.level = 'info';
  } catch {}
  function sendToRenderer(channel, payload) {
    const [win] = BrowserWindow.getAllWindows();
    win?.webContents && !win.webContents.isDestroyed() && win.webContents.send(channel, payload);
  }
  ((autoUpdater.autoDownload = !1),
    (autoUpdater.autoInstallOnAppQuit = !0),
    (autoUpdater.channel = 'latest'),
    autoUpdater.on('update-available', (info) => {
      const nextVersion = info?.version ?? info?.releaseName ?? 'unknown';
      (log.info(`[AutoUpdate] Update available (${nextVersion}). Downloading...`),
        sendToRenderer('update:download-progress', {
          percent: 0,
          bytesPerSecond: 0,
          transferred: 0,
          total: 0,
        }),
        autoUpdater.downloadUpdate().catch((err) => {
          const message = err?.stack ?? err?.message ?? String(err);
          log.warn('[AutoUpdate] downloadUpdate failed:', message);
        }));
    }),
    autoUpdater.on('download-progress', (progress) => {
      (log.info(`[AutoUpdate] Download progress: ${Math.round(progress.percent)}%`),
        sendToRenderer('update:download-progress', {
          percent: progress.percent ?? 0,
          bytesPerSecond: progress.bytesPerSecond ?? 0,
          transferred: progress.transferred ?? 0,
          total: progress.total ?? 0,
        }));
    }),
    autoUpdater.on('update-downloaded', () => {
      (log.info('[AutoUpdate] Update downloaded. Will install on app quit.'),
        sendToRenderer('update:downloaded', {}));
    }),
    autoUpdater.on('error', (err) => {
      const message = err?.stack ?? err?.message ?? String(err);
      log.warn('[AutoUpdate] Auto update error:', message);
    }));
  setTimeout(() => {
    try {
      autoUpdater.checkForUpdates().catch((err) => {
        const message = err?.stack ?? err?.message ?? String(err);
        log.warn('[AutoUpdate] checkForUpdates failed:', message);
      });
    } catch (err) {
      const message = err?.stack ?? err?.message ?? String(err);
      log.warn('[AutoUpdate] Failed to start update check:', message);
    }
  }, 15000);
}
