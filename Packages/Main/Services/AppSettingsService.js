import { readUser, writeUser } from './UserService.js';
import * as PowerService from './PowerService.js';
import { LANGUAGES_BY_CODE } from '../../System/Languages.js';

const DEFAULTS = {
  run_on_startup: false,
  system_tray: false,
  keep_awake: false,
  app_language: 'en',
  completion_sound: true,
};

export function getSupportedLanguages() {
  return LANGUAGES_BY_CODE;
}

export function getLanguageLabel(code) {
  return LANGUAGES_BY_CODE[code]?.label ?? 'English';
}

function readStoredAppSettings() {
  return readUser().app_settings ?? {};
}

export function readAppSettings() {
  const stored = readStoredAppSettings();
  const rawLang = stored.app_language ?? DEFAULTS.app_language;
  const app_language = rawLang in LANGUAGES_BY_CODE ? rawLang : 'en';
  return {
    run_on_startup: Boolean(stored.run_on_startup ?? DEFAULTS.run_on_startup),
    system_tray: Boolean(stored.system_tray ?? DEFAULTS.system_tray),
    keep_awake: Boolean(stored.keep_awake ?? DEFAULTS.keep_awake),
    app_lock: Boolean(stored.app_lock ?? false),
    app_language,
    completion_sound: stored.completion_sound !== false, // default true
  };
}

export function writeAppSettings(patch = {}) {
  return writeUser({
    app_settings: { ...DEFAULTS, ...readStoredAppSettings(), ...patch },
  });
}

/**
 * Called once at boot after engines are ready.
 * Applies every persisted setting so the app is in the right state on relaunch.
 * TrayService is intentionally NOT imported here to keep the coupling one-way;
 * App.js passes `win` and the caller (App.js) handles tray via TrayService directly.
 */
export function applyAll(_win) {
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

  // app_lock is applied at window creation time in App.js;
  // nothing to do here after boot.

  return settings;
}
