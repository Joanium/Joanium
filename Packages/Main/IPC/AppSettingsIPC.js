import { app, ipcMain } from 'electron';
import fs from 'fs';
import * as AppSettingsService from '../Services/AppSettingsService.js';
import * as AppLockService from '../Services/AppLockService.js';
import * as PowerService from '../Services/PowerService.js';
import * as SystemPromptService from '../Services/SystemPromptService.js';
import { loadPage } from '../Core/Window.js';
import Paths from '../Core/Paths.js';
import { wrapHandler, wrapRead } from './IPCWrapper.js';

export const ipcMeta = { needs: [] };

export function register() {
  ipcMain.handle(
    'reset-app',
    wrapHandler(async () => {
      // Directories to wipe recursively
      const dirsToRemove = [
        Paths.CHATS_DIR,
        Paths.PROJECTS_DIR,
        Paths.FEATURES_DATA_DIR,
        Paths.MEMORIES_DIR,
      ];
      // Individual files to delete
      const filesToRemove = [
        Paths.USER_FILE,
        Paths.APP_LOCK_FILE,
        Paths.APP_LOCK_BACKUP_FILE,
        Paths.CUSTOM_INSTRUCTIONS_FILE,
        Paths.USAGE_FILE,
        Paths.SKILLS_FILE,
        Paths.ACTIVE_PERSONA_FILE,
        Paths.MCP_FILE,
      ];

      for (const dir of dirsToRemove) {
        try {
          fs.rmSync(dir, { recursive: true, force: true });
        } catch (err) {
          console.warn('[ResetApp] Could not remove dir', dir, err.message);
        }
      }
      for (const file of filesToRemove) {
        try {
          fs.rmSync(file, { force: true });
        } catch (err) {
          console.warn('[ResetApp] Could not remove file', file, err.message);
        }
      }

      // Navigate to setup — slight delay so renderer can close gracefully
      setTimeout(() => loadPage(Paths.SETUP_PAGE), 120);
      return { ok: true };
    }),
  );

  ipcMain.handle(
    'get-app-settings',
    wrapRead(() => ({
      ...AppSettingsService.readAppSettings(),
      app_lock: AppLockService.isAppLockEnabled(),
    })),
  );

  ipcMain.handle(
    'set-app-settings',
    wrapHandler((patch) => {
      if (!patch || typeof patch !== 'object') return;
      if ('app_lock' in patch) delete patch.app_lock;

      // Persist first
      if (Object.keys(patch).length > 0) AppSettingsService.writeAppSettings(patch);

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

      // --- app_lock_idle_minutes ---
      if ('app_lock_idle_minutes' in patch) {
        AppLockService.refreshIdleLockTimer({ bumpActivity: true });
      }

      // --- app_language ---
      // When the language changes, the AI system prompt needs to be rebuilt so the
      // new language preference is visible to the model on the next message.
      if ('app_language' in patch) {
        SystemPromptService.invalidate();
      }

      // --- system_tray ---
      // TrayService toggling is handled in App.js via the 'tray-toggle' flow;
      // IPC just persists the value here. The tray feature (item 2) wires this up.

      return {
        settings: {
          ...AppSettingsService.readAppSettings(),
          app_lock: AppLockService.isAppLockEnabled(),
        },
      };
    }),
  );
}
