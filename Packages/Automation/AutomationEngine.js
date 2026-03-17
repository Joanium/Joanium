// ─────────────────────────────────────────────
//  openworld — Packages/Automation/AutomationEngine.js
//  Runs in the Electron main process.
//  Loads automations from Data/Automations.json,
//  schedules them, and executes actions.
// ─────────────────────────────────────────────

import { shell } from 'electron';
import { exec }   from 'child_process';
import fs          from 'fs';
import path        from 'path';

/* ══════════════════════════════════════════
   ACTION IMPLEMENTATIONS
   Each returns a Promise (or is async).
══════════════════════════════════════════ */

/**
 * Open a URL in the OS default browser.
 * @param {string} url
 */
export async function openSite(url) {
  if (!url) throw new Error('openSite: no URL provided');
  const target = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  await shell.openExternal(target);
  console.log(`[AutomationEngine] openSite → ${target}`);
}

/**
 * Open a folder (or file) in the OS file manager.
 * @param {string} folderPath
 */
export function openFolder(folderPath) {
  if (!folderPath) throw new Error('openFolder: no path provided');
  shell.openPath(folderPath);
  console.log(`[AutomationEngine] openFolder → ${folderPath}`);
}

/**
 * Spawn a shell command in a new terminal window.
 * On macOS: opens Terminal.app running the command.
 * On Windows: opens cmd.exe.
 * On Linux: tries x-terminal-emulator / gnome-terminal.
 * @param {string} command
 */
export function openTerminalAndRun(command) {
  if (!command) throw new Error('openTerminalAndRun: no command provided');

  return new Promise((resolve, reject) => {
    let launcher;

    if (process.platform === 'darwin') {
      // Escape for AppleScript string
      const escaped = command.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      launcher = `osascript -e 'tell application "Terminal" to do script "${escaped}"'`;
    } else if (process.platform === 'win32') {
      launcher = `start cmd.exe /k "${command}"`;
    } else {
      // Linux — try common emulators
      launcher = `x-terminal-emulator -e bash -c "${command}; read" || gnome-terminal -- bash -c "${command}; read"`;
    }

    exec(launcher, (err) => {
      if (err) {
        console.error('[AutomationEngine] openTerminalAndRun error:', err);
        reject(err);
      } else {
        console.log(`[AutomationEngine] openTerminalAndRun → ${command}`);
        resolve();
      }
    });
  });
}

/**
 * Dispatch a single action object.
 * @param {{ type: string, url?: string, path?: string, command?: string }} action
 */
export async function runAction(action) {
  if (!action?.type) return;

  switch (action.type) {
    case 'open_site':
      return openSite(action.url);

    case 'open_folder':
      return openFolder(action.path);

    case 'run_command':
      return openTerminalAndRun(action.command);

    default:
      console.warn(`[AutomationEngine] Unknown action type: "${action.type}"`);
  }
}

/* ══════════════════════════════════════════
   SCHEDULING HELPERS
══════════════════════════════════════════ */

/**
 * Returns true when an automation's trigger fires for the given Date.
 * @param {{ trigger: object, lastRun: string|null }} automation
 * @param {Date} now
 */
export function shouldRunNow(automation, now = new Date()) {
  const { trigger, lastRun } = automation;
  if (!trigger) return false;

  const last = lastRun ? new Date(lastRun) : null;

  /* ── on_startup ──────────────────────── */
  // Handled separately in runStartupAutomations()
  if (trigger.type === 'on_startup') return false;

  /* ── hourly ──────────────────────────── */
  if (trigger.type === 'hourly') {
    if (now.getMinutes() !== 0) return false;
    if (last &&
        last.getFullYear() === now.getFullYear() &&
        last.getMonth()    === now.getMonth()    &&
        last.getDate()     === now.getDate()     &&
        last.getHours()    === now.getHours()) return false;
    return true;
  }

  /* ── daily ───────────────────────────── */
  if (trigger.type === 'daily') {
    if (!trigger.time) return false;
    const [h, m] = trigger.time.split(':').map(Number);
    if (now.getHours() !== h || now.getMinutes() !== m) return false;
    if (last && last.toDateString() === now.toDateString()) return false;
    return true;
  }

  /* ── weekly ──────────────────────────── */
  if (trigger.type === 'weekly') {
    const DAY_MAP = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    if (!trigger.day || DAY_MAP.indexOf(trigger.day) !== now.getDay()) return false;
    if (!trigger.time) return false;
    const [h, m] = trigger.time.split(':').map(Number);
    if (now.getHours() !== h || now.getMinutes() !== m) return false;
    if (last) {
      // Already ran this calendar week?
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);
      if (last >= weekStart) return false;
    }
    return true;
  }

  return false;
}

/* ══════════════════════════════════════════
   AUTOMATION ENGINE CLASS
══════════════════════════════════════════ */

export class AutomationEngine {
  /**
   * @param {string} automationsFilePath  Absolute path to Data/Automations.json
   */
  constructor(automationsFilePath) {
    this.filePath     = automationsFilePath;
    this.automations  = [];
    this._ticker      = null;   // setInterval handle
  }

  /* ── Lifecycle ─────────────────────── */

  /** Load automations, run startup ones, start the 60-second ticker. */
  start() {
    this._load();
    this._runStartupAutomations();
    this._ticker = setInterval(() => this._checkScheduled(), 60_000);
    console.log('[AutomationEngine] Started — monitoring', this.automations.length, 'automation(s)');
  }

  /** Stop the ticker (call on app quit). */
  stop() {
    if (this._ticker) {
      clearInterval(this._ticker);
      this._ticker = null;
    }
    console.log('[AutomationEngine] Stopped');
  }

  /** Re-read the JSON file (called after any CRUD from the UI). */
  reload() {
    this._load();
    console.log('[AutomationEngine] Reloaded —', this.automations.length, 'automation(s)');
  }

  /* ── CRUD (called from IPC handlers) ── */

  getAll() {
    this._load();
    return this.automations;
  }

  saveAutomation(automation) {
    this._load();
    const idx = this.automations.findIndex(a => a.id === automation.id);
    if (idx >= 0) {
      this.automations[idx] = { ...this.automations[idx], ...automation };
    } else {
      this.automations.push(automation);
    }
    this._persist();
    return automation;
  }

  deleteAutomation(id) {
    this._load();
    this.automations = this.automations.filter(a => a.id !== id);
    this._persist();
  }

  toggleAutomation(id, enabled) {
    this._load();
    const a = this.automations.find(a => a.id === id);
    if (a) {
      a.enabled = Boolean(enabled);
      this._persist();
    }
  }

  /* ── Private helpers ─────────────────── */

  _load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw  = fs.readFileSync(this.filePath, 'utf-8');
        const data = JSON.parse(raw);
        this.automations = Array.isArray(data.automations) ? data.automations : [];
      } else {
        this.automations = [];
      }
    } catch (err) {
      console.error('[AutomationEngine] _load error:', err);
      this.automations = [];
    }
  }

  _persist() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        this.filePath,
        JSON.stringify({ automations: this.automations }, null, 2),
        'utf-8'
      );
    } catch (err) {
      console.error('[AutomationEngine] _persist error:', err);
    }
  }

  _runStartupAutomations() {
    const targets = this.automations.filter(
      a => a.enabled && a.trigger?.type === 'on_startup'
    );
    for (const a of targets) this._execute(a);
  }

  _checkScheduled() {
    const now = new Date();
    for (const a of this.automations) {
      if (a.enabled && shouldRunNow(a, now)) {
        this._execute(a);
      }
    }
  }

  async _execute(automation) {
    console.log(`[AutomationEngine] Executing: "${automation.name}"`);
    try {
      for (const action of (automation.actions ?? [])) {
        await runAction(action);
      }
      // Stamp lastRun and persist
      automation.lastRun = new Date().toISOString();
      this._persist();
    } catch (err) {
      console.error(`[AutomationEngine] Error in "${automation.name}":`, err);
    }
  }
}
