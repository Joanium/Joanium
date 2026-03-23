// ─────────────────────────────────────────────
//  openworld — Packages/Main/IPC/TerminalIPC.js
//  Executes shell commands, reads files, and lists
//  directories on behalf of the AI chat tool system.
//  Runs in the Electron main process (full Node access).
// ─────────────────────────────────────────────

import { ipcMain } from 'electron';
import { exec }     from 'child_process';
import fs           from 'fs';
import path         from 'path';
import os           from 'os';

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
}
