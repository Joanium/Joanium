import { app, ipcMain } from 'electron';
import * as AppSettingsService from '../Services/AppSettingsService.js';
import * as PowerService from '../Services/PowerService.js';
import { wrapHandler, wrapRead } from './IPCWrapper.js';

export const ipcMeta = { needs: [] };

export function register() {
  ipcMain.handle(
    'get-app-settings',
    wrapRead(() => AppSettingsService.readAppSettings()),
  );

  ipcMain.handle(
    'set-app-settings',
    wrapHandler((patch) => {
      if (!patch || typeof patch !== 'object') return;

      // Persist first
      AppSettingsService.writeAppSettings(patch);

      // --- run_on_startup ---
      // app.setLoginItemSettings is available on macOS, Windows, and Linux (Electron 13+).
      // openAsHidden: true  → window starts minimised to tray on Windows/Linux, hidden on macOS.
      if ('run_on_startup' in patch) {
        const openAtLogin = Boolean(patch.run_on_startup);

        if (process.platform === 'darwin') {
          // macOS: openAsHidden hides the window; user sees it via tray/dock.
          app.setLoginItemSettings({ openAtLogin, openAsHidden: openAtLogin });
        } else if (process.platform === 'win32') {
          // Windows: openAsHidden minimises to tray on launch.
          app.setLoginItemSettings({ openAtLogin, openAsHidden: openAtLogin });
        } else {
          // Linux: openAsHidden not supported; just register/deregister.
          app.setLoginItemSettings({ openAtLogin });
        }
      }

      // --- keep_awake ---
      if ('keep_awake' in patch) {
        patch.keep_awake ? PowerService.start() : PowerService.stop();
      }

      // --- system_tray ---
      // TrayService toggling is handled in App.js via the 'tray-toggle' flow;
      // IPC just persists the value here. The tray feature (item 2) wires this up.

      return { settings: AppSettingsService.readAppSettings() };
    }),
  );
}
