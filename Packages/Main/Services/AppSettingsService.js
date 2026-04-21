import { readUser, writeUser } from './UserService.js';
import * as PowerService from './PowerService.js';

const DEFAULTS = { run_on_startup: false, system_tray: false, keep_awake: false };

export function readAppSettings() {
  return { ...DEFAULTS, ...(readUser().app_settings ?? {}) };
}

export function writeAppSettings(patch = {}) {
  return writeUser({ app_settings: { ...readAppSettings(), ...patch } });
}

/**
 * Called once at boot after engines are ready.
 * Applies every persisted setting so the app is in the right state on relaunch.
 * TrayService is intentionally NOT imported here to keep the coupling one-way;
 * App.js passes `win` and the caller (App.js) handles tray via TrayService directly.
 */
export function applyAll(win) {
  const settings = readAppSettings();

  // keep_awake
  if (settings.keep_awake) {
    PowerService.start();
  } else {
    PowerService.stop();
  }

  // run_on_startup is applied via the IPC handler when changed;
  // on boot the OS itself handles launching so nothing to do here.

  // system_tray is handled by App.js after this call returns.
  return settings;
}
