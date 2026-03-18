// ─────────────────────────────────────────────
//  openworld — Packages/Automation/AutomationEngine.js
//  Runs in the Electron main process.
//  Loads automations from Data/Automations.json,
//  schedules them, and executes actions.
//  Now supports Gmail and GitHub actions.
// ─────────────────────────────────────────────

import { shell, clipboard, Notification } from 'electron';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import * as GmailAPI  from './Gmail.js';
import * as GithubAPI from './Github.js';

/* ══════════════════════════════════════════
   ACTION IMPLEMENTATIONS
══════════════════════════════════════════ */

function sq(str) {
  return `'${String(str ?? '').replace(/'/g, "'\\''")}'`;
}

export async function openSite(url) {
  if (!url) throw new Error('openSite: no URL provided');
  let target = url.trim();
  if (/^https?:[^/]/i.test(target)) target = target.replace(/^https?:/i, 'https://');
  if (!/^https?:\/\//i.test(target)) target = `https://${target}`;
  await shell.openExternal(target);
  console.log(`[AutomationEngine] openSite → ${target}`);
}

export function openFolder(folderPath) {
  if (!folderPath) throw new Error('openFolder: no path provided');
  return new Promise((resolve, reject) => {
    if (process.platform === 'win32') {
      exec(`start "" "${folderPath}"`, { shell: 'cmd.exe' }, (err) => {
        if (err) { console.error('[AutomationEngine] openFolder error:', err); return reject(err); }
        resolve();
      });
    } else {
      shell.openPath(folderPath).then((result) => {
        if (result) reject(new Error(result));
        else resolve();
      });
    }
  });
}

export function openTerminalAtPath(folderPath, command = '') {
  if (!folderPath) throw new Error('openTerminalAtPath: no path provided');
  return new Promise((resolve, reject) => {
    let launcher;
    const cdAndRun = command ? `cd ${sq(folderPath)} && ${command}` : `cd ${sq(folderPath)}`;
    if (process.platform === 'darwin') {
      const escaped = cdAndRun.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      launcher = `osascript -e 'tell application "Terminal" to do script "${escaped}"'`;
    } else if (process.platform === 'win32') {
      const winPath = folderPath.replace(/"/g, '');
      launcher = command
        ? `start cmd.exe /k "cd /d "${winPath}" && ${command}"`
        : `start cmd.exe /k "cd /d "${winPath}""`;
    } else {
      launcher = `x-terminal-emulator -e bash -c "${cdAndRun}; exec bash" || gnome-terminal -- bash -c "${cdAndRun}; exec bash"`;
    }
    exec(launcher, (err) => {
      if (err) { console.error('[AutomationEngine] openTerminalAtPath error:', err); reject(err); }
      else resolve();
    });
  });
}

export function openTerminalAndRun(command) {
  if (!command) throw new Error('openTerminalAndRun: no command provided');
  return new Promise((resolve, reject) => {
    let launcher;
    if (process.platform === 'darwin') {
      const escaped = command.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      launcher = `osascript -e 'tell application "Terminal" to do script "${escaped}"'`;
    } else if (process.platform === 'win32') {
      launcher = `start cmd.exe /k "${command}"`;
    } else {
      launcher = `x-terminal-emulator -e bash -c "${command}; read" || gnome-terminal -- bash -c "${command}; read"`;
    }
    exec(launcher, (err) => {
      if (err) { console.error('[AutomationEngine] openTerminalAndRun error:', err); reject(err); }
      else resolve();
    });
  });
}

export async function openApp(appPath) {
  if (!appPath) throw new Error('openApp: no app path provided');
  const result = await shell.openPath(appPath);
  if (result) throw new Error(`openApp: ${result}`);
  console.log(`[AutomationEngine] openApp → ${appPath}`);
}

export function sendNotification(title, body = '') {
  if (!Notification.isSupported()) {
    console.warn('[AutomationEngine] Notifications not supported on this platform');
    return;
  }
  if (!title) throw new Error('sendNotification: no title provided');
  const n = new Notification({ title, body });
  n.show();
  console.log(`[AutomationEngine] sendNotification → "${title}"`);
}

export function copyToClipboard(text) {
  if (text === undefined || text === null) throw new Error('copyToClipboard: no text provided');
  clipboard.writeText(String(text));
}

export function writeFile(filePath, content = '') {
  if (!filePath) throw new Error('writeFile: no file path provided');
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, String(content), 'utf-8');
  console.log(`[AutomationEngine] writeFile → ${filePath}`);
}

/* ══════════════════════════════════════════
   ACTION DISPATCHER
   connectorEngine is passed from AutomationEngine._execute()
   so Gmail / GitHub actions can access live credentials.
══════════════════════════════════════════ */

export async function runAction(action, connectorEngine = null) {
  if (!action?.type) return;

  switch (action.type) {

    /* ── Existing system actions ── */

    case 'open_site':
      return openSite(action.url);

    case 'open_folder':
      await openFolder(action.path);
      if (action.openTerminal)
        await openTerminalAtPath(action.path, action.terminalCommand || '');
      return;

    case 'run_command':
      return openTerminalAndRun(action.command);

    case 'open_app':
      return openApp(action.appPath);

    case 'send_notification':
      return sendNotification(action.title, action.body);

    case 'copy_to_clipboard':
      return copyToClipboard(action.text);

    case 'write_file':
      return writeFile(action.filePath, action.content);

    /* ── Gmail actions ── */

    case 'gmail_send_email': {
      const creds = connectorEngine?.getCredentials('gmail');
      if (!creds?.accessToken) throw new Error('Gmail not connected — connect in Settings → Connectors');
      await GmailAPI.sendEmail(creds, action.to, action.subject, action.body ?? '');
      console.log(`[AutomationEngine] gmail_send_email → ${action.to}`);
      return;
    }

    case 'gmail_get_brief': {
      const creds = connectorEngine?.getCredentials('gmail');
      if (!creds?.accessToken) throw new Error('Gmail not connected');
      const brief = await GmailAPI.getEmailBrief(creds, action.maxResults ?? 10);
      const preview = brief.emails
        .slice(0, 3)
        .map(e => e.subject)
        .filter(Boolean)
        .join(' · ');
      sendNotification(
        `📬 Gmail — ${brief.count} unread`,
        preview || 'No unread emails.',
      );
      return;
    }

    /* ── GitHub actions ── */

    case 'github_open_repo': {
      const owner = action.owner?.trim();
      const repo  = action.repo?.trim();
      if (!owner || !repo) throw new Error('github_open_repo: owner and repo are required');
      return openSite(`https://github.com/${owner}/${repo}`);
    }

    case 'github_check_prs': {
      const creds = connectorEngine?.getCredentials('github');
      if (!creds?.token) throw new Error('GitHub not connected');
      const prs     = await GithubAPI.getPullRequests(creds, action.owner, action.repo);
      const titles  = prs.slice(0, 3).map(p => `• ${p.title}`).join('\n');
      sendNotification(
        `🔀 ${action.owner}/${action.repo} — ${prs.length} open PR${prs.length !== 1 ? 's' : ''}`,
        titles || 'No open pull requests.',
      );
      return;
    }

    case 'github_check_issues': {
      const creds = connectorEngine?.getCredentials('github');
      if (!creds?.token) throw new Error('GitHub not connected');
      const issues = await GithubAPI.getIssues(creds, action.owner, action.repo);
      const titles = issues.slice(0, 3).map(i => `• ${i.title}`).join('\n');
      sendNotification(
        `🐛 ${action.owner}/${action.repo} — ${issues.length} open issue${issues.length !== 1 ? 's' : ''}`,
        titles || 'No open issues.',
      );
      return;
    }

    case 'github_check_notifs': {
      const creds = connectorEngine?.getCredentials('github');
      if (!creds?.token) throw new Error('GitHub not connected');
      const notifs = await GithubAPI.getNotifications(creds);
      const count  = notifs?.length ?? 0;
      sendNotification(
        `🔔 GitHub Notifications`,
        count === 0
          ? 'No unread notifications.'
          : `${count} unread notification${count !== 1 ? 's' : ''}`,
      );
      return;
    }

    default:
      console.warn(`[AutomationEngine] Unknown action type: "${action.type}"`);
  }
}

/* ══════════════════════════════════════════
   SCHEDULING HELPERS
══════════════════════════════════════════ */

export function shouldRunNow(automation, now = new Date()) {
  const { trigger, lastRun } = automation;
  if (!trigger) return false;

  const last = lastRun ? new Date(lastRun) : null;

  if (trigger.type === 'on_startup') return false;

  if (trigger.type === 'hourly') {
    if (now.getMinutes() !== 0) return false;
    if (last &&
      last.getFullYear() === now.getFullYear() &&
      last.getMonth()    === now.getMonth()    &&
      last.getDate()     === now.getDate()     &&
      last.getHours()    === now.getHours()) return false;
    return true;
  }

  if (trigger.type === 'daily') {
    if (!trigger.time) return false;
    const [h, m] = trigger.time.split(':').map(Number);
    if (now.getHours() !== h || now.getMinutes() !== m) return false;
    if (last && last.toDateString() === now.toDateString()) return false;
    return true;
  }

  if (trigger.type === 'weekly') {
    const DAY_MAP = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    if (!trigger.day || DAY_MAP.indexOf(trigger.day) !== now.getDay()) return false;
    if (!trigger.time) return false;
    const [h, m] = trigger.time.split(':').map(Number);
    if (now.getHours() !== h || now.getMinutes() !== m) return false;
    if (last) {
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
   * @param {string}           automationsFilePath  Absolute path to Data/Automations.json
   * @param {ConnectorEngine}  connectorEngine      For Gmail / GitHub actions (optional)
   */
  constructor(automationsFilePath, connectorEngine = null) {
    this.filePath        = automationsFilePath;
    this.connectorEngine = connectorEngine;
    this.automations     = [];
    this._ticker         = null;
  }

  /* ── Lifecycle ─────────────────────── */

  start() {
    this._load();
    this._runStartupAutomations();
    this._ticker = setInterval(() => this._checkScheduled(), 60_000);
    console.log('[AutomationEngine] Started —', this.automations.length, 'automation(s)');
  }

  stop() {
    if (this._ticker) { clearInterval(this._ticker); this._ticker = null; }
    console.log('[AutomationEngine] Stopped');
  }

  reload() {
    this._load();
    console.log('[AutomationEngine] Reloaded —', this.automations.length, 'automation(s)');
  }

  /* ── CRUD ── */

  getAll() {
    this._load();
    return this.automations;
  }

  saveAutomation(automation) {
    this._load();
    const idx = this.automations.findIndex(a => a.id === automation.id);
    if (idx >= 0) this.automations[idx] = { ...this.automations[idx], ...automation };
    else          this.automations.push(automation);
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
    if (a) { a.enabled = Boolean(enabled); this._persist(); }
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
        'utf-8',
      );
    } catch (err) {
      console.error('[AutomationEngine] _persist error:', err);
    }
  }

  _runStartupAutomations() {
    const targets = this.automations.filter(
      a => a.enabled && a.trigger?.type === 'on_startup',
    );
    for (const a of targets) this._execute(a);
  }

  _checkScheduled() {
    const now = new Date();
    for (const a of this.automations) {
      if (a.enabled && shouldRunNow(a, now)) this._execute(a);
    }
  }

  async _execute(automation) {
    console.log(`[AutomationEngine] Executing: "${automation.name}"`);
    try {
      for (const action of (automation.actions ?? [])) {
        await runAction(action, this.connectorEngine);
      }
      automation.lastRun = new Date().toISOString();
      this._persist();
    } catch (err) {
      console.error(`[AutomationEngine] Error in "${automation.name}":`, err);
    }
  }
}
