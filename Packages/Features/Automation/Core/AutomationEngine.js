import fs   from 'fs';
import path from 'path';
import { exec } from 'child_process';

// Automation Packages
import { openSite }                           from '../Actions/Site.js';
import { openFolder }                         from '../Actions/Folder.js';
import { openTerminalAtPath, openTerminalAndRun } from '../Actions/Terminal.js';
import { openApp }                            from '../Actions/Application.js';
import { sendNotification }                   from '../Actions/Notification.js';
import { copyToClipboard }                    from '../Actions/Clipboard.js';
import { writeFile }                          from '../Actions/File.js';

import { shouldRunNow } from '../Scheduling/Scheduling.js';


// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  ACTION DISPATCHER
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function runAction(action, connectorEngine = null) {
  if (!action?.type) return;


  switch (action.type) {
    // System / OS
    case 'open_site':
      return openSite(action.url);

    case 'open_multiple_sites': {
      const urls = String(action.urls ?? '').split('\n').map(u => u.trim()).filter(Boolean);
      for (const url of urls) {
        await openSite(url);
        if (urls.length > 1) await new Promise(r => setTimeout(r, 400));
      }
      return;
    }

    case 'open_folder':
      await openFolder(action.path);
      if (action.openTerminal)
        await openTerminalAtPath(action.path, action.terminalCommand || '');
      return;

    case 'run_command': {
      if (!action.command) throw new Error('run_command: no command provided');
      if (action.silent) {
        await new Promise((resolve, reject) => {
          exec(action.command, (err) => {
            if (action.notifyOnFinish) {
              sendNotification(
                err ? 'âŒ Command failed' : 'âœ… Command done',
                action.command.slice(0, 80),
              );
            }
            err ? reject(err) : resolve();
          });
        });
      } else {
        await openTerminalAndRun(action.command);
        if (action.notifyOnFinish) sendNotification('âœ… Command launched', action.command.slice(0, 80));
      }
      return;
    }

    case 'run_script': {
      if (!action.scriptPath) throw new Error('run_script: no script path provided');
      const cmd = action.args?.trim()
        ? `${action.scriptPath} ${action.args}`
        : action.scriptPath;
      if (action.silent) {
        await new Promise((resolve, reject) => {
          exec(cmd, (err, stdout, stderr) => {
            if (action.notifyOnFinish) {
              sendNotification(
                err ? 'âŒ Script failed' : 'âœ… Script done',
                path.basename(action.scriptPath),
              );
            }
            err ? reject(err) : resolve();
          });
        });
      } else {
        await openTerminalAndRun(cmd);
        if (action.notifyOnFinish) sendNotification('âœ… Script launched', path.basename(action.scriptPath));
      }
      return;
    }

    case 'open_app':
      return openApp(action.appPath);

    case 'send_notification':
      return sendNotification(action.title, action.body ?? '', action.clickUrl ?? '');

    case 'copy_to_clipboard':
      return copyToClipboard(action.text);

    case 'write_file': {
      if (!action.filePath) throw new Error('write_file: no file path provided');
      const dir = path.dirname(action.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (action.append) {
        fs.appendFileSync(action.filePath, String(action.content ?? ''), 'utf-8');
      } else {
        fs.writeFileSync(action.filePath, String(action.content ?? ''), 'utf-8');
      }
      return;
    }

    case 'move_file': {
      if (!action.sourcePath || !action.destPath) throw new Error('move_file: source and destination paths required');
      const destDir = path.dirname(action.destPath);
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
      fs.renameSync(action.sourcePath, action.destPath);
      return;
    }

    case 'copy_file': {
      if (!action.sourcePath || !action.destPath) throw new Error('copy_file: source and destination paths required');
      const destDir = path.dirname(action.destPath);
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(action.sourcePath, action.destPath);
      return;
    }

    case 'delete_file': {
      if (!action.filePath) throw new Error('delete_file: no file path provided');
      fs.unlinkSync(action.filePath);
      return;
    }

    case 'create_folder': {
      if (!action.path) throw new Error('create_folder: no path provided');
      fs.mkdirSync(action.path, { recursive: true });
      return;
    }

    case 'lock_screen': {
      if (process.platform === 'darwin') {
        exec('pmset displaysleepnow');
      } else if (process.platform === 'win32') {
        exec('rundll32.exe user32.dll,LockWorkStation');
      } else {
        exec('xdg-screensaver lock 2>/dev/null || gnome-screensaver-command -l 2>/dev/null || loginctl lock-session');
      }
      return;
    }

    case 'http_request': {
      if (!action.url) throw new Error('http_request: no URL provided');
      const method = (action.method || 'GET').toUpperCase();
      const headers = {};

      if (action.headers) {
        String(action.headers).split('\n').forEach(line => {
          const idx = line.indexOf(':');
          if (idx > 0) {
            const key = line.slice(0, idx).trim();
            const val = line.slice(idx + 1).trim();
            if (key) headers[key] = val;
          }
        });
      }
      if (!headers['Content-Type'] && action.body) headers['Content-Type'] = 'application/json';

      const opts = { method, headers };
      if (!['GET', 'HEAD'].includes(method) && action.body) opts.body = action.body;

      try {
        const res = await fetch(action.url, opts);
        if (action.notify) {
          sendNotification(
            `ðŸŒ ${method} ${res.ok ? 'âœ…' : 'âŒ'} ${res.status}`,
            action.url,
          );
        }
      } catch (err) {
        if (action.notify) sendNotification('ðŸŒ HTTP Request Failed', err.message);
        throw err;
      }
      return;
    }


    default:
      console.warn(`[AutomationEngine] Unknown action type: "${action.type}"`);
  }
}


// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  AUTOMATION ENGINE CLASS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export class AutomationEngine {
  constructor(automationsFilePath, connectorEngine = null, featureRegistry = null) {
    this.filePath        = automationsFilePath;
    this.connectorEngine = connectorEngine;
    this.featureRegistry = featureRegistry;
    this.automations     = [];
    this._ticker         = null;
    this._running        = new Set();
  }

  start() {
    this._load();
    this._runStartupAutomations();
    this._ticker = setInterval(() => this._checkScheduled(), 60_000);
  }

  stop() {
    if (this._ticker) { clearInterval(this._ticker); this._ticker = null; }
  }

  reload() {
    this._load();
  }

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

  clearAllHistory() {
    this._load();
    for (const auto of this.automations) {
      auto.history = [];
      auto.lastRun = null;
    }
    this._persist();
  }

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
      if (a.enabled && !this._running.has(a.id) && shouldRunNow(a, now)) this._execute(a);
    }
  }

  async _execute(automation) {
    const automationId = automation.id;
    this._running.add(automationId);

    const entry = {
      timestamp: new Date().toISOString(),
      status:    'success',
      summary:   '',
      error:     null,
    };

    try {
      const actionTypes = [];
      for (const action of (automation.actions ?? [])) {
        const featureResult = await this.featureRegistry?.runAutomationAction?.(action, {
          connectorEngine: this.connectorEngine,
        });
        if (featureResult?.handled) {
          await featureResult.result;
        } else {
          await runAction(action, this.connectorEngine);
        }
        if (action.type) actionTypes.push(action.type);
      }
      entry.summary = actionTypes.length
        ? `Ran: ${actionTypes.join(', ')}`
        : 'Automation executed (no actions)';
    } catch (err) {
      entry.status  = 'error';
      entry.error   = err.message;
      entry.summary = `Error: ${err.message}`;
      console.error(`[AutomationEngine] Error in "${automation.name}":`, err);
    } finally {
      this._running.delete(automationId);
    }

    const live = this.automations.find(a => a.id === automationId);
    if (live) {
      if (!Array.isArray(live.history)) live.history = [];
      live.history.unshift(entry);
      if (live.history.length > 30) live.history = live.history.slice(0, 30);
      live.lastRun = entry.timestamp;
      this._persist();
    } else {
      console.warn(`[AutomationEngine] Automation ${automationId} not found after run â€” was it deleted?`);
    }
  }
}


