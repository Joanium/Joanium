// ─────────────────────────────────────────────
//  openworld — Packages/Main/IPC/TerminalIPC.js
//  Executes shell commands, reads files, and lists
//  directories on behalf of the AI chat tool system.
//  Runs in the Electron main process (full Node access).
// ─────────────────────────────────────────────

import { ipcMain, dialog, BrowserWindow, shell } from 'electron';
import { exec }     from 'child_process';
import fs           from 'fs';
import path         from 'path';
import os           from 'os';
import { spawn }    from 'child_process';

// Keep track of active pseudo-terminals
const activePtys = new Map();

/* ── Helpers ─────────────────────────────────────── */

const MAX_OUTPUT_BYTES  = 64_000;   // truncate large outputs to ~64 KB
const DEFAULT_TIMEOUT   = 30_000;   // 30 s
const MAX_TIMEOUT       = 120_000;  // 2 min hard cap
const MAX_FILE_BYTES    = 512_000;  // 512 KB for read_local_file
const MAX_LINES_DEFAULT = 200;

/** Truncate a string to maxBytes and annotate if cut. */
function truncate(str, maxBytes = MAX_OUTPUT_BYTES) {
  const buf = Buffer.from(str, 'utf-8');
  if (buf.length <= maxBytes) return str;
  return buf.slice(0, maxBytes).toString('utf-8') + `\n\n…(truncated — ${buf.length} bytes total)`;
}

/* ── IPC Registration ─────────────────────────────── */

export function register() {

  /* ── select-directory ──────────────────────────── */
  ipcMain.handle('select-directory', async (e) => {
    const window = BrowserWindow.fromWebContents(e.sender);
    const result = await dialog.showOpenDialog(window, {
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false };
    }
    return { ok: true, path: result.filePaths[0] };
  });

  /* ── PTY (Pseudo-Terminal) Handlers ────────────── */
  ipcMain.handle('pty-spawn', async (e, { command, cwd }) => {
    const pid = Date.now().toString() + Math.random().toString(36).substring(2);
    
    // Fallback to simple spawn if node-pty isn't available
    const child = spawn(command, {
      cwd: cwd || os.homedir(),
      shell: true,
      env: { ...process.env, FORCE_COLOR: '1' } // Try to get colored output
    });

    activePtys.set(pid, child);

    child.stdout.on('data', data => {
      e.sender.send('pty-data', pid, data.toString());
    });
    child.stderr.on('data', data => {
      e.sender.send('pty-data', pid, data.toString());
    });
    child.on('exit', code => {
      activePtys.delete(pid);
      e.sender.send('pty-exit', pid, code);
    });

    return { ok: true, pid };
  });

  ipcMain.handle('pty-write', async (_e, pid, data) => {
    const child = activePtys.get(pid);
    if (!child) return { ok: false, error: 'PTY not found' };
    child.stdin.write(data);
    return { ok: true };
  });

  ipcMain.handle('pty-resize', async (_e, pid, cols, rows) => {
    // Cannot resize plain child_process, ignored
    return { ok: true };
  });

  ipcMain.handle('pty-kill', async (_e, pid) => {
    const child = activePtys.get(pid);
    if (!child) return { ok: false, error: 'PTY not found' };
    child.kill();
    activePtys.delete(pid);
    return { ok: true };
  });

  /* ── run-shell-command ─────────────────────────── */
  ipcMain.handle('run-shell-command', async (_e, { command, cwd, timeout }) => {
    if (!command?.trim()) return { ok: false, error: 'No command provided.' };

    const effectiveCwd     = cwd?.trim() || os.homedir();
    const effectiveTimeout = Math.min(Number(timeout) || DEFAULT_TIMEOUT, MAX_TIMEOUT);

    // Guard against obviously dangerous patterns the AI should never need
    const BLOCKED = [
      /rm\s+-rf\s+\/(?!\w)/,          // rm -rf /
      /mkfs/,
      /dd\s+if=.*of=\/dev/,
      /shutdown|reboot|halt/,
    ];
    for (const rx of BLOCKED) {
      if (rx.test(command)) {
        return { ok: false, error: `Blocked: command matches a destructive pattern (${rx}).` };
      }
    }

    return new Promise(resolve => {
      const child = exec(
        command,
        {
          cwd:     effectiveCwd,
          timeout: effectiveTimeout,
          maxBuffer: MAX_OUTPUT_BYTES * 2,
          shell:   process.platform === 'win32' ? 'cmd.exe' : '/bin/bash',
        },
        (err, stdout, stderr) => {
          const exitCode = err?.code ?? 0;
          resolve({
            ok:       !err || err.killed === false,
            stdout:   truncate(stdout || ''),
            stderr:   truncate(stderr || ''),
            exitCode: typeof exitCode === 'number' ? exitCode : (err ? 1 : 0),
            timedOut: err?.killed ?? false,
            cwd:      effectiveCwd,
          });
        },
      );

      // Also capture exit code for commands that succeed but return non-zero
      child.on('exit', (code) => {
        // handled in callback above
      });
    });
  });

  /* ── read-local-file ──────────────────────────── */
  ipcMain.handle('read-local-file', async (_e, { filePath, maxLines }) => {
    if (!filePath?.trim()) return { ok: false, error: 'No file path provided.' };

    const resolved = path.resolve(filePath);
    try {
      const stat = fs.statSync(resolved);
      if (!stat.isFile()) return { ok: false, error: `"${resolved}" is not a file.` };
      if (stat.size > MAX_FILE_BYTES) {
        return { ok: false, error: `File too large (${(stat.size / 1024).toFixed(0)} KB > 512 KB limit). Use run-shell-command with head/tail instead.` };
      }

      const raw   = fs.readFileSync(resolved, 'utf-8');
      const lines = raw.split('\n');
      const limit = Math.min(Number(maxLines) || MAX_LINES_DEFAULT, 2000);
      const sliced = lines.slice(0, limit);
      const note   = lines.length > limit
        ? `\n… (showing ${limit} of ${lines.length} lines)`
        : '';

      return {
        ok:        true,
        content:   sliced.join('\n') + note,
        totalLines: lines.length,
        sizeBytes: stat.size,
        path:      resolved,
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  /* ── list-directory ───────────────────────────── */
  ipcMain.handle('list-directory', async (_e, { dirPath }) => {
    if (!dirPath?.trim()) return { ok: false, error: 'No directory path provided.' };

    const resolved = path.resolve(dirPath);
    try {
      const stat = fs.statSync(resolved);
      if (!stat.isDirectory()) return { ok: false, error: `"${resolved}" is not a directory.` };

      const entries = fs.readdirSync(resolved, { withFileTypes: true });
      const items   = entries.map(e => ({
        name:  e.name,
        type:  e.isDirectory() ? 'dir' : e.isFile() ? 'file' : 'other',
        size:  e.isFile() ? (() => { try { return fs.statSync(path.join(resolved, e.name)).size; } catch { return 0; } })() : null,
      })).sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      return { ok: true, path: resolved, entries: items, count: items.length };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  /* ── write-local-file (AI-assisted code saving) ── */
  ipcMain.handle('write-ai-file', async (_e, { filePath, content, append = false }) => {
    if (!filePath?.trim()) return { ok: false, error: 'No file path provided.' };
    const resolved = path.resolve(filePath);
    try {
      const dir = path.dirname(resolved);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (append) fs.appendFileSync(resolved, content ?? '', 'utf-8');
      else        fs.writeFileSync(resolved, content ?? '', 'utf-8');
      return { ok: true, path: resolved, bytes: Buffer.byteLength(content ?? '', 'utf-8') };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  /* ── create-directory ───────────────────────────── */
  ipcMain.handle('create-directory', async (_e, { dirPath }) => {
    if (!dirPath?.trim()) return { ok: false, error: 'No directory path provided.' };
    const resolved = path.resolve(dirPath);
    try {
      if (!fs.existsSync(resolved)) fs.mkdirSync(resolved, { recursive: true });
      return { ok: true, path: resolved };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  /* ── open-folder-os ───────────────────────────── */
  ipcMain.handle('open-folder-os', async (_e, { dirPath }) => {
    if (!dirPath?.trim()) return { ok: false, error: 'No directory path provided.' };
    const resolved = path.resolve(dirPath);
    try {
      const err = await shell.openPath(resolved);
      if (err) return { ok: false, error: err };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  /* ── delete-item ───────────────────────────── */
  ipcMain.handle('delete-item', async (_e, { itemPath }) => {
    if (!itemPath?.trim()) return { ok: false, error: 'No path provided to delete.' };
    const resolved = path.resolve(itemPath);
    try {
      if (fs.existsSync(resolved)) {
        fs.rmSync(resolved, { recursive: true, force: true });
        return { ok: true, path: resolved };
      }
      return { ok: false, error: 'Path does not exist.' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}
