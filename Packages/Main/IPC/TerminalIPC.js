import { ipcMain, dialog, BrowserWindow, shell } from 'electron';
import { exec, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  extractDocumentTextFromBuffer,
  extractDocumentTextFromPath,
} from '../Services/DocumentExtractionService.js';
import { openTerminalAtPath } from '../../Features/Automation/Actions/Terminal.js';
const activePtys = new Map(),
  WORKSPACE_SKIP_DIRS = new Set([
    '.git',
    'node_modules',
    'dist',
    'build',
    'out',
    '.next',
    '.nuxt',
    'coverage',
    '.cache',
    '.turbo',
    '.parcel-cache',
    '.vercel',
    'target',
    'bin',
    'obj',
    'vendor',
    '__pycache__',
    '.pytest_cache',
    '.venv',
    'venv',
    'env',
    'tmp',
    'temp',
  ]),
  TEXT_EXTENSIONS = new Set([
    '.js',
    '.jsx',
    '.ts',
    '.tsx',
    '.mjs',
    '.cjs',
    '.json',
    '.md',
    '.mdx',
    '.txt',
    '.log',
    '.env',
    '.yml',
    '.yaml',
    '.toml',
    '.xml',
    '.html',
    '.css',
    '.scss',
    '.less',
    '.sql',
    '.graphql',
    '.gql',
    '.sh',
    '.bash',
    '.zsh',
    '.ps1',
    '.py',
    '.rb',
    '.go',
    '.rs',
    '.java',
    '.cs',
    '.c',
    '.cpp',
    '.h',
    '.hpp',
    '.vue',
    '.svelte',
    '.astro',
  ]),
  COMMAND_RISK_RULES = [
    {
      level: 'critical',
      pattern: /\brm\s+-rf\s+\/(?!\w)/i,
      reason: 'Deletes the filesystem root.',
    },
    { level: 'critical', pattern: /\b(format|mkfs)\b/i, reason: 'Formats a disk or filesystem.' },
    { level: 'critical', pattern: /\bdd\s+if=.*of=\/dev/i, reason: 'Writes raw data to a device.' },
    {
      level: 'critical',
      pattern: /\b(shutdown|reboot|halt)\b/i,
      reason: 'Shuts down or reboots the machine.',
    },
    {
      level: 'critical',
      pattern: /\b(del|erase)\b\s+\/(s|q)/i,
      reason: 'Bulk-deletes files via the shell.',
    },
    {
      level: 'critical',
      pattern: /\bRemove-Item\b.*-Recurse.*-Force/i,
      reason: 'Force-removes files recursively.',
    },
    {
      level: 'high',
      pattern: /\bgit\s+reset\s+--hard\b/i,
      reason: 'Discards Git changes permanently.',
    },
    {
      level: 'high',
      pattern: /\bgit\s+clean\s+-f/i,
      reason: 'Deletes untracked files from the repository.',
    },
    { level: 'high', pattern: /\bgit\s+push\b.*--force/i, reason: 'Rewrites remote Git history.' },
    {
      level: 'high',
      pattern: /\b(terraform|terragrunt)\s+(apply|destroy)\b/i,
      reason: 'Mutates infrastructure state.',
    },
    {
      level: 'high',
      pattern: /\bkubectl\s+(apply|delete|patch|scale|rollout)\b/i,
      reason: 'Mutates a Kubernetes cluster.',
    },
    {
      level: 'high',
      pattern: /\bhelm\s+(install|upgrade|uninstall|rollback)\b/i,
      reason: 'Mutates a Helm release.',
    },
    {
      level: 'high',
      pattern: /\bdocker\s+(system\s+prune|rm|rmi|compose\s+down)\b/i,
      reason: 'Deletes or mutates Docker resources.',
    },
    { level: 'high', pattern: /\brm\s+-rf\b/i, reason: 'Recursively deletes files.' },
    {
      level: 'medium',
      pattern: /\bgit\s+(push|merge|tag)\b/i,
      reason: 'Mutates Git history or the remote repository.',
    },
    {
      level: 'medium',
      pattern: /\b(npm|pnpm|yarn|bun)\s+publish\b/i,
      reason: 'Publishes a package.',
    },
  ];

// ─── Param guard helper ────────────────────────────────────────────────────────
// Returns { ok: false, error } when value is missing/blank, null when valid.
// Eliminates the repeated `if (!x?.trim()) return { ok: !1, error: msg }` guard
// pattern used throughout file operation and git IPC handlers.
function requireParam(value, errorMessage) {
  return value?.trim() ? null : { ok: !1, error: errorMessage };
}

function truncate(str, maxBytes = 64e3) {
  const buf = Buffer.from(str, 'utf-8');
  return buf.length <= maxBytes
    ? str
    : `${buf.slice(0, maxBytes).toString('utf-8')}\n\n…(truncated — ${buf.length} bytes total)`;
}
function resolveDir(inputPath) {
  return path.resolve(inputPath?.trim() || os.homedir());
}
function normalizeBool(value) {
  return !0 === value || 'true' === value;
}
function isProbablyTextFile(filePath) {
  const base = path.basename(filePath).toLowerCase();
  return (
    'dockerfile' === base ||
    'makefile' === base ||
    '.gitignore' === base ||
    TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase())
  );
}
function detectEol(raw = '') {
  return raw.includes('\r\n') ? '\r\n' : '\n';
}
function splitLinesPreserveFinal(raw = '') {
  if (!raw) return { lines: [], endsWithNewline: !1 };
  const endsWithNewline = /\r?\n$/.test(raw),
    lines = raw.split(/\r?\n/);
  return (endsWithNewline && lines.pop(), { lines: lines, endsWithNewline: endsWithNewline });
}
function joinLines(lines = [], eol = '\n', endsWithNewline = !1) {
  if (!lines.length) return '';
  const joined = lines.join(eol);
  return endsWithNewline ? `${joined}${eol}` : joined;
}
function readTextFilePreview(filePath, maxLines = 200) {
  const resolved = path.resolve(filePath),
    stat = fs.statSync(resolved);
  if (!stat.isFile()) throw new Error(`"${resolved}" is not a file.`);
  if (stat.size > 512e3)
    throw new Error(
      `File too large (${(stat.size / 1024).toFixed(0)} KB > 512 KB limit). Use read-file-chunk or search-workspace instead.`,
    );
  const lines = fs.readFileSync(resolved, 'utf-8').split('\n'),
    limit = Math.min(Number(maxLines) || 200, 2e3),
    sliced = lines.slice(0, limit),
    note = lines.length > limit ? `\n...(showing ${limit} of ${lines.length} lines)` : '';
  return {
    path: resolved,
    content: sliced.join('\n') + note,
    totalLines: lines.length,
    sizeBytes: stat.size,
  };
}
function buildDirectoryTree(dirPath, maxDepth = 3, maxEntries = 200) {
  const resolved = path.resolve(dirPath);
  if (!fs.statSync(resolved).isDirectory()) throw new Error(`"${resolved}" is not a directory.`);
  const depthLimit = Math.min(Math.max(1, Number(maxDepth) || 3), 6),
    entryLimit = Math.min(Math.max(1, Number(maxEntries) || 200), 500),
    lines = [resolved];
  let included = 0,
    truncated = !1;
  return (
    (function walk(currentPath, depth, prefix) {
      if (depth >= depthLimit || truncated) return;
      let entries = fs
        .readdirSync(currentPath, { withFileTypes: !0 })
        .filter((entry) => '.' !== entry.name && '..' !== entry.name && !entry.isSymbolicLink?.())
        .filter((entry) => !WORKSPACE_SKIP_DIRS.has(entry.name))
        .sort((a, b) =>
          a.isDirectory() !== b.isDirectory()
            ? a.isDirectory()
              ? -1
              : 1
            : a.name.localeCompare(b.name),
        );
      for (let index = 0; index < entries.length; index++) {
        if (included >= entryLimit) return void (truncated = !0);
        const entry = entries[index],
          isLast = index === entries.length - 1,
          marker = isLast ? '└─ ' : '├─ ',
          nextPrefix = `${prefix}${isLast ? '   ' : '│  '}`,
          label = `${entry.name}${entry.isDirectory() ? '/' : ''}`;
        if (
          (lines.push(`${prefix}${marker}${label}`),
          (included += 1),
          entry.isDirectory() &&
            (walk(path.join(currentPath, entry.name), depth + 1, nextPrefix), truncated))
        )
          return;
      }
    })(resolved, 0, ''),
    { path: resolved, lines: lines, count: included, truncated: truncated, maxDepth: depthLimit }
  );
}
function walkWorkspaceFiles(rootPath, maxFiles = 4e3) {
  const root = resolveDir(rootPath),
    files = [],
    stack = [root];
  for (; stack.length && files.length < maxFiles; ) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: !0 });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if ('.' === entry.name || '..' === entry.name || entry.isSymbolicLink?.()) continue;
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) WORKSPACE_SKIP_DIRS.has(entry.name) || stack.push(abs);
      else if ((entry.isFile() && files.push(abs), files.length >= maxFiles)) break;
    }
  }
  return { root: root, files: files };
}
function buildPackageScriptCommand(packageManager, scriptName) {
  return packageManager && scriptName
    ? 'yarn' === packageManager
      ? `yarn ${scriptName}`
      : 'bun' === packageManager
        ? `bun run ${scriptName}`
        : `${packageManager} run ${scriptName}`
    : '';
}
function inspectWorkspace(rootPath) {
  const root = resolveDir(rootPath);
  if (!fs.statSync(root).isDirectory()) throw new Error(`"${root}" is not a directory.`);
  const entries = fs
      .readdirSync(root, { withFileTypes: !0 })
      .map((entry) => ({
        name: entry.name,
        type: entry.isDirectory() ? 'dir' : entry.isFile() ? 'file' : 'other',
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    packageJson = (function (filePath) {
      try {
        if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch {}
      return null;
    })(path.join(root, 'package.json')),
    packageManager = (function (root, entries) {
      const names = new Set(entries.map((entry) => entry.name));
      return names.has('pnpm-lock.yaml')
        ? 'pnpm'
        : names.has('yarn.lock')
          ? 'yarn'
          : names.has('bun.lockb') || names.has('bun.lock')
            ? 'bun'
            : names.has('package-lock.json') || fs.existsSync(path.join(root, 'package.json'))
              ? 'npm'
              : '';
    })(root, entries),
    ciDir = path.join(root, '.github', 'workflows'),
    ciWorkflows = fs.existsSync(ciDir)
      ? fs
          .readdirSync(ciDir)
          .filter((name) => /\.(ya?ml)$/i.test(name))
          .slice(0, 20)
      : [],
    dockerFiles = entries
      .map((entry) => entry.name)
      .filter((name) => /^dockerfile/i.test(name) || /^docker-compose\.(ya?ml)$/i.test(name)),
    envFiles = entries
      .map((entry) => entry.name)
      .filter((name) => '.env' === name || name.startsWith('.env.')),
    frameworks = new Set(),
    languages = new Set(),
    testing = new Set(),
    infra = new Set(),
    deps = { ...(packageJson?.dependencies ?? {}), ...(packageJson?.devDependencies ?? {}) };
  (packageJson && languages.add('javascript'),
    fs.existsSync(path.join(root, 'tsconfig.json')) && languages.add('typescript'),
    (fs.existsSync(path.join(root, 'pyproject.toml')) ||
      fs.existsSync(path.join(root, 'requirements.txt'))) &&
      languages.add('python'),
    fs.existsSync(path.join(root, 'Cargo.toml')) && languages.add('rust'),
    fs.existsSync(path.join(root, 'go.mod')) && languages.add('go'),
    deps.react && frameworks.add('react'),
    deps.next && frameworks.add('nextjs'),
    deps.vue && frameworks.add('vue'),
    deps.svelte && frameworks.add('svelte'),
    deps.electron && frameworks.add('electron'),
    deps.express && frameworks.add('express'),
    deps.vite && frameworks.add('vite'),
    deps.jest && testing.add('jest'),
    deps.vitest && testing.add('vitest'),
    deps.playwright && testing.add('playwright'),
    deps.cypress && testing.add('cypress'),
    deps.mocha && testing.add('mocha'),
    dockerFiles.length && infra.add('docker'),
    entries.some(
      (entry) => 'k8s' === entry.name || 'helm' === entry.name || 'charts' === entry.name,
    ) && infra.add('kubernetes'),
    entries.some((entry) => /\.tf$/i.test(entry.name) || 'terraform' === entry.name) &&
      infra.add('terraform'),
    ciWorkflows.length && infra.add('github_actions'));
  const scripts = packageJson?.scripts ?? {},
    notes = [];
  return (
    scripts.dev && notes.push('Has a dev/start workflow defined in package.json.'),
    (scripts.lint || testing.size || scripts.test) &&
      notes.push('Has detectable QA/testing signals.'),
    infra.size && notes.push('Contains deployment or infrastructure-related files.'),
    {
      path: root,
      packageManager: packageManager,
      topEntries: entries.slice(0, 80),
      packageScripts: scripts,
      frameworks: [...frameworks],
      languages: [...languages],
      testing: [...testing],
      infra: [...infra],
      dockerFiles: dockerFiles,
      envFiles: envFiles,
      ciWorkflows: ciWorkflows,
      notes: notes,
    }
  );
}
function severityRank(level) {
  return { low: 0, medium: 1, high: 2, critical: 3 }[level] ?? 0;
}
function assessCommandRisk(command = '') {
  const cmd = String(command || '').trim();
  let level = 'low';
  const reasons = [];
  for (const rule of COMMAND_RISK_RULES)
    rule.pattern.test(cmd) &&
      (reasons.push(rule.reason),
      severityRank(rule.level) > severityRank(level) && (level = rule.level));
  return {
    command: cmd,
    level: level,
    reasons: reasons,
    blocked: 'critical' === level,
    requiresOptIn: 'high' === level,
  };
}
function protectedDeleteReason(resolved) {
  return resolved === path.parse(resolved).root
    ? 'Refusing to delete the filesystem root.'
    : resolved === os.homedir()
      ? 'Refusing to delete the home directory.'
      : '.git' === path.basename(resolved).toLowerCase()
        ? 'Refusing to delete a .git directory.'
        : '';
}
function runCommandDetailed(command, { cwd: cwd, timeout: timeout = 3e4 } = {}) {
  const effectiveCwd = resolveDir(cwd),
    effectiveTimeout = Math.min(Number(timeout) || 3e4, 12e4);
  return new Promise((resolve) => {
    exec(
      command,
      {
        cwd: effectiveCwd,
        timeout: effectiveTimeout,
        maxBuffer: 128e3,
        shell: 'win32' === process.platform ? 'cmd.exe' : '/bin/bash',
      },
      (err, stdout, stderr) => {
        resolve({
          ok: !err,
          stdout: truncate(stdout || ''),
          stderr: truncate(stderr || ''),
          exitCode: 'number' == typeof err?.code ? err.code : 0,
          timedOut: Boolean(err?.killed),
          cwd: effectiveCwd,
        });
      },
    );
  });
}
export const ipcMeta = { needs: [] };
export function register() {
  (ipcMain.handle(
    'find-file-by-name',
    async (_e, { rootPath: rootPath, name: name, maxResults: maxResults = 40 }) => {
      const rootErr = requireParam(rootPath, 'No workspace path provided.');
      if (rootErr) return rootErr;
      if (!name?.trim()) return { ok: !1, error: 'No filename provided.' };
      try {
        const { root: root, files: files } = walkWorkspaceFiles(rootPath),
          needle = name.toLowerCase(),
          limit = Math.min(Math.max(1, Number(maxResults) || 40), 200),
          matches = [];
        for (const file of files) {
          if (matches.length >= limit) break;
          path.basename(file).toLowerCase().includes(needle) &&
            matches.push({ path: path.relative(root, file) });
        }
        return { ok: !0, root: root, matches: matches };
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    },
  ),
    ipcMain.handle('select-directory', async (e, opts = {}) => {
      const window = BrowserWindow.fromWebContents(e.sender),
        result = await dialog.showOpenDialog(window, {
          properties: ['openDirectory', 'createDirectory'],
          defaultPath: opts.defaultPath?.trim() || void 0,
        });
      return result.canceled || 0 === result.filePaths.length
        ? { ok: !1 }
        : { ok: !0, path: result.filePaths[0] };
    }));
  const handlePtySpawn = async (e, { command: command, cwd: cwd, settleMs: settleMs } = {}) => {
    const pid = `${Date.now()}${Math.random().toString(36).slice(2)}`,
      child = spawn(command, {
        cwd: resolveDir(cwd),
        shell: !0,
        env: { ...process.env, FORCE_COLOR: '1' },
      });
    activePtys.set(pid, child);
    const safeSend = (channel, ...args) => {
      e.sender.isDestroyed() || e.sender.send(channel, ...args);
    };
    let snippet = '';
    const onStreamData = (data) => {
      const str = data.toString();
      (snippet.length < 8e3 &&
        ((snippet += str),
        snippet.length > 8e3 && (snippet = `${snippet.slice(0, 8e3)}\n…(truncated)`)),
        safeSend('pty-data', pid, str));
    };
    (child.stdout.on('data', onStreamData),
      child.stderr.on('data', onStreamData),
      child.on('exit', (code) => {
        (activePtys.delete(pid), safeSend('pty-exit', pid, code));
      }));
    const settleRaw = null == settleMs || '' === settleMs ? 15e3 : Number(settleMs),
      settle = Math.min(Math.max(0, Number.isFinite(settleRaw) ? settleRaw : 15e3), 6e4),
      earlyOutcome = await new Promise((resolve) => {
        let timeoutId,
          settled = !1;
        const finish = (value) => {
          settled || ((settled = !0), clearTimeout(timeoutId), resolve(value));
        };
        (child.once('error', (err) => finish({ kind: 'spawnError', message: err.message })),
          child.once('exit', (code, signal) =>
            finish({ kind: 'exited', code: code, signal: signal }),
          ),
          settle > 0
            ? (timeoutId = setTimeout(() => finish({ kind: 'running' }), settle))
            : finish({ kind: 'running' }));
      });
    if ('spawnError' === earlyOutcome.kind) {
      activePtys.delete(pid);
      try {
        child.kill();
      } catch {}
      return { ok: !1, error: `Failed to start process: ${earlyOutcome.message}` };
    }
    if ('exited' === earlyOutcome.kind) {
      const { code: code, signal: signal } = earlyOutcome,
        tail = snippet.trim() || '(no output captured)';
      return 0 === code
        ? {
            ok: !1,
            error:
              'Process exited immediately with code 0. For a dev server, the command must keep running; check that you used the right script (e.g. dev/start) and cwd.',
            exitCode: 0,
            outputSnippet: tail,
          }
        : null !== code && 0 !== code
          ? {
              ok: !1,
              error: `Process exited during startup (code ${code}). Common causes: port already in use (EADDRINUSE), missing dependencies, or invalid config.`,
              exitCode: code,
              outputSnippet: tail,
            }
          : {
              ok: !1,
              error: `Process terminated during startup${signal ? ` (${signal})` : ''}.`,
              exitCode: code,
              signal: signal,
              outputSnippet: tail,
            };
    }
    return { ok: !0, pid: pid };
  };
  (ipcMain.handle('pty-spawn', handlePtySpawn),
    ipcMain.handle('spawn-pty', handlePtySpawn),
    ipcMain.handle('pty-write', async (_e, pid, data) => {
      const child = activePtys.get(pid);
      return child ? (child.stdin.write(data), { ok: !0 }) : { ok: !1, error: 'PTY not found' };
    }),
    ipcMain.handle('pty-resize', async () => ({ ok: !0 })),
    ipcMain.handle('pty-kill', async (_e, pid) => {
      const child = activePtys.get(pid);
      return child
        ? (child.kill(), activePtys.delete(pid), { ok: !0 })
        : { ok: !1, error: 'PTY not found' };
    }),
    ipcMain.handle('assess-command-risk', async (_e, { command: command }) =>
      command?.trim()
        ? { ok: !0, risk: assessCommandRisk(command) }
        : { ok: !1, error: 'No command provided.' },
    ),
    ipcMain.handle(
      'run-shell-command',
      async (_e, { command: command, cwd: cwd, timeout: timeout, allowRisky: allowRisky = !1 }) => {
        if (!command?.trim()) return { ok: !1, error: 'No command provided.' };
        const risk = assessCommandRisk(command);
        return risk.blocked
          ? {
              ok: !1,
              error: 'Blocked: command matches a critical destructive pattern.',
              risk: risk,
            }
          : risk.requiresOptIn && !allowRisky
            ? {
                ok: !1,
                error:
                  'Command is high-risk. Re-run with allow_risky=true only if the user explicitly asked for it.',
                risk: risk,
              }
            : {
                ...(await runCommandDetailed(command, { cwd: cwd, timeout: timeout })),
                risk: risk,
              };
      },
    ),
    ipcMain.handle('read-local-file', async (_e, { filePath: filePath, maxLines: maxLines }) => {
      const fileErr = requireParam(filePath, 'No file path provided.');
      if (fileErr) return fileErr;
      try {
        return { ok: !0, ...readTextFilePreview(filePath, maxLines) };
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }),
    ipcMain.handle('extract-document-text', async (_e, payload = {}) => {
      try {
        return {
          ok: !0,
          ...(payload.filePath?.trim()
            ? await extractDocumentTextFromPath(payload.filePath)
            : await extractDocumentTextFromBuffer({
                fileName: payload.fileName ?? '',
                mimeType: payload.mimeType ?? '',
                buffer: payload.buffer,
              })),
        };
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }),
    ipcMain.handle(
      'read-file-chunk',
      async (_e, { filePath: filePath, startLine: startLine = 1, lineCount: lineCount = 120 }) => {
        const fileErr = requireParam(filePath, 'No file path provided.');
        if (fileErr) return fileErr;
        const resolved = path.resolve(filePath);
        try {
          const lines = fs.readFileSync(resolved, 'utf-8').split('\n'),
            start = Math.max(1, Number(startLine) || 1),
            count = Math.min(Math.max(1, Number(lineCount) || 120), 500),
            slice = lines.slice(start - 1, start - 1 + count);
          return {
            ok: !0,
            path: resolved,
            startLine: start,
            endLine: start + slice.length - 1,
            totalLines: lines.length,
            content: slice.join('\n'),
          };
        } catch (err) {
          return { ok: !1, error: err.message };
        }
      },
    ),
    ipcMain.handle(
      'read-multiple-local-files',
      async (_e, { paths: paths, maxLinesPerFile: maxLinesPerFile }) => {
        const filePaths = ((input = paths),
        String(input ?? '')
          .split(/[\r\n,]+/)
          .map((value) => value.trim())
          .filter(Boolean)).slice(0, 12);
        var input;
        if (!filePaths.length) return { ok: !1, error: 'No file paths provided.' };
        try {
          return {
            ok: !0,
            files: filePaths.map((filePath) => {
              try {
                return { ok: !0, ...readTextFilePreview(filePath, maxLinesPerFile ?? 180) };
              } catch (err) {
                return { ok: !1, path: path.resolve(filePath), error: err.message };
              }
            }),
          };
        } catch (err) {
          return { ok: !1, error: err.message };
        }
      },
    ),
    ipcMain.handle('list-directory', async (_e, { dirPath: dirPath }) => {
      const dirErr = requireParam(dirPath, 'No directory path provided.');
      if (dirErr) return dirErr;
      const resolved = path.resolve(dirPath);
      try {
        if (!fs.statSync(resolved).isDirectory())
          return { ok: !1, error: `"${resolved}" is not a directory.` };
        const items = fs
          .readdirSync(resolved, { withFileTypes: !0 })
          .map((entry) => ({
            name: entry.name,
            type: entry.isDirectory() ? 'dir' : entry.isFile() ? 'file' : 'other',
            size: entry.isFile()
              ? (() => {
                  try {
                    return fs.statSync(path.join(resolved, entry.name)).size;
                  } catch {
                    return 0;
                  }
                })()
              : null,
          }))
          .sort((a, b) =>
            a.type !== b.type ? ('dir' === a.type ? -1 : 1) : a.name.localeCompare(b.name),
          );
        return { ok: !0, path: resolved, entries: items, count: items.length };
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }),
    ipcMain.handle(
      'list-directory-tree',
      async (_e, { dirPath: dirPath, maxDepth: maxDepth, maxEntries: maxEntries }) => {
        const dirErr = requireParam(dirPath, 'No directory path provided.');
        if (dirErr) return dirErr;
        try {
          return { ok: !0, ...buildDirectoryTree(dirPath, maxDepth, maxEntries) };
        } catch (err) {
          return { ok: !1, error: err.message };
        }
      },
    ),
    ipcMain.handle(
      'search-workspace',
      async (_e, { rootPath: rootPath, query: query, maxResults: maxResults = 40 }) => {
        const rootErr = requireParam(rootPath, 'No workspace path provided.');
        if (rootErr) return rootErr;
        if (!query?.trim()) return { ok: !1, error: 'No search query provided.' };
        try {
          const { root: root, files: files } = walkWorkspaceFiles(rootPath),
            limit = Math.min(Math.max(1, Number(maxResults) || 40), 100),
            matches = [],
            matcher = /^\/.*\/[gimsuy]*$/.test(query.trim())
              ? new RegExp(
                  query.trim().slice(1, query.trim().lastIndexOf('/')),
                  query.trim().slice(query.trim().lastIndexOf('/') + 1),
                )
              : null,
            needle = query.toLowerCase();
          for (const file of files) {
            if (matches.length >= limit) break;
            if (!isProbablyTextFile(file)) continue;
            let stat;
            try {
              stat = fs.statSync(file);
            } catch {
              continue;
            }
            if (stat.size > 512e3) continue;
            let raw = '';
            try {
              raw = fs.readFileSync(file, 'utf-8');
            } catch {
              continue;
            }
            const lines = raw.split('\n');
            for (let index = 0; index < lines.length; index++) {
              const line = lines[index];
              if (
                (matcher && (matcher.lastIndex = 0),
                (matcher ? matcher.test(line) : line.toLowerCase().includes(needle)) &&
                  (matches.push({
                    path: path.relative(root, file),
                    lineNumber: index + 1,
                    line: line.trim().slice(0, 240),
                  }),
                  matches.length >= limit))
              )
                break;
            }
          }
          return { ok: !0, root: root, matches: matches };
        } catch (err) {
          return { ok: !1, error: err.message };
        }
      },
    ),
    ipcMain.handle(
      'write-ai-file',
      async (_e, { filePath: filePath, content: content, append: append = !1 }) => {
        const fileErr = requireParam(filePath, 'No file path provided.');
        if (fileErr) return fileErr;
        const resolved = path.resolve(filePath);
        try {
          const dir = path.dirname(resolved);
          return (
            fs.existsSync(dir) || fs.mkdirSync(dir, { recursive: !0 }),
            append
              ? fs.appendFileSync(resolved, content ?? '', 'utf-8')
              : fs.writeFileSync(resolved, content ?? '', 'utf-8'),
            { ok: !0, path: resolved, bytes: Buffer.byteLength(content ?? '', 'utf-8') }
          );
        } catch (err) {
          return { ok: !1, error: err.message };
        }
      },
    ),
    ipcMain.handle(
      'apply-file-patch',
      async (
        _e,
        { filePath: filePath, search: search, replace: replace, replaceAll: replaceAll = !1 },
      ) => {
        const fileErr = requireParam(filePath, 'No file path provided.');
        if (fileErr) return fileErr;
        if ('string' != typeof search || 0 === search.length)
          return { ok: !1, error: 'No search text provided.' };
        if ('string' != typeof replace) return { ok: !1, error: 'No replacement text provided.' };
        const resolved = path.resolve(filePath);
        try {
          const original = fs.readFileSync(resolved, 'utf-8');
          if (!original.includes(search))
            return { ok: !1, error: 'Search text was not found in the file.' };
          const occurrences = original.split(search).length - 1,
            next = replaceAll
              ? original.split(search).join(replace)
              : original.replace(search, replace);
          return (
            fs.writeFileSync(resolved, next, 'utf-8'),
            { ok: !0, path: resolved, replacements: replaceAll ? occurrences : 1 }
          );
        } catch (err) {
          return { ok: !1, error: err.message };
        }
      },
    ),
    ipcMain.handle(
      'replace-lines-in-file',
      async (
        _e,
        { filePath: filePath, startLine: startLine, endLine: endLine, replacement: replacement },
      ) => {
        const fileErr = requireParam(filePath, 'No file path provided.');
        if (fileErr) return fileErr;
        if (!Number.isFinite(Number(startLine)))
          return { ok: !1, error: 'No valid start line provided.' };
        if (!Number.isFinite(Number(endLine)))
          return { ok: !1, error: 'No valid end line provided.' };
        if ('string' != typeof replacement)
          return { ok: !1, error: 'No replacement text provided.' };
        const resolved = path.resolve(filePath);
        try {
          const original = fs.readFileSync(resolved, 'utf-8'),
            eol = detectEol(original),
            { lines: lines, endsWithNewline: endsWithNewline } = splitLinesPreserveFinal(original),
            start = Math.max(1, Number(startLine)),
            end = Math.max(start, Number(endLine));
          if (start > lines.length || end > lines.length)
            return {
              ok: !1,
              error: `Line range ${start}-${end} is outside the file (${lines.length} lines).`,
            };
          const replacementLines = '' === replacement ? [] : replacement.split(/\r?\n/),
            nextLines = [...lines.slice(0, start - 1), ...replacementLines, ...lines.slice(end)];
          return (
            fs.writeFileSync(resolved, joinLines(nextLines, eol, endsWithNewline), 'utf-8'),
            {
              ok: !0,
              path: resolved,
              startLine: start,
              endLine: end,
              insertedLines: replacementLines.length,
            }
          );
        } catch (err) {
          return { ok: !1, error: err.message };
        }
      },
    ),
    ipcMain.handle(
      'insert-into-file',
      async (
        _e,
        {
          filePath: filePath,
          content: content,
          position: position = 'end',
          lineNumber: lineNumber,
          anchor: anchor,
        },
      ) => {
        const fileErr = requireParam(filePath, 'No file path provided.');
        if (fileErr) return fileErr;
        if ('string' != typeof content) return { ok: !1, error: 'No content provided.' };
        const resolved = path.resolve(filePath);
        try {
          const original = fs.readFileSync(resolved, 'utf-8'),
            normalizedPosition =
              String(position || '')
                .trim()
                .toLowerCase() || (anchor ? 'after' : 'end');
          let next = original;
          if (Number.isFinite(Number(lineNumber))) {
            const eol = detectEol(original),
              { lines: lines, endsWithNewline: endsWithNewline } =
                splitLinesPreserveFinal(original),
              rawLineNumber = Math.max(1, Number(lineNumber)),
              boundedLineNumber = Math.min(rawLineNumber, lines.length + 1),
              insertIndex =
                'after' === normalizedPosition
                  ? Math.min(boundedLineNumber, lines.length)
                  : boundedLineNumber - 1,
              contentLines = '' === content ? [] : content.split(/\r?\n/);
            (lines.splice(insertIndex, 0, ...contentLines),
              (next = joinLines(lines, eol, endsWithNewline)));
          } else if (anchor) {
            const anchorIndex = original.indexOf(anchor);
            if (-1 === anchorIndex)
              return { ok: !1, error: 'Anchor text was not found in the file.' };
            const insertAt =
              'before' === normalizedPosition ? anchorIndex : anchorIndex + anchor.length;
            next = `${original.slice(0, insertAt)}${content}${original.slice(insertAt)}`;
          } else
            next =
              'start' === normalizedPosition ? `${content}${original}` : `${original}${content}`;
          return (
            fs.writeFileSync(resolved, next, 'utf-8'),
            {
              ok: !0,
              path: resolved,
              position: normalizedPosition,
              mode: Number.isFinite(Number(lineNumber)) ? 'line' : anchor ? 'anchor' : 'boundary',
            }
          );
        } catch (err) {
          return { ok: !1, error: err.message };
        }
      },
    ),
    ipcMain.handle('create-directory', async (_e, { dirPath: dirPath }) => {
      const dirErr = requireParam(dirPath, 'No directory path provided.');
      if (dirErr) return dirErr;
      const resolved = path.resolve(dirPath);
      try {
        return (
          fs.existsSync(resolved) || fs.mkdirSync(resolved, { recursive: !0 }),
          { ok: !0, path: resolved }
        );
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }),
    ipcMain.handle(
      'copy-item',
      async (
        _e,
        { sourcePath: sourcePath, destinationPath: destinationPath, overwrite: overwrite = !1 },
      ) => {
        if (!sourcePath?.trim()) return { ok: !1, error: 'No source path provided.' };
        if (!destinationPath?.trim()) return { ok: !1, error: 'No destination path provided.' };
        const source = path.resolve(sourcePath),
          destination = path.resolve(destinationPath),
          allowOverwrite = normalizeBool(overwrite);
        try {
          if (!fs.existsSync(source)) return { ok: !1, error: 'Source path does not exist.' };
          if (fs.existsSync(destination)) {
            if (!allowOverwrite)
              return {
                ok: !1,
                error: 'Destination already exists. Re-run with overwrite=true to replace it.',
              };
            const reason = protectedDeleteReason(destination);
            if (reason) return { ok: !1, error: reason };
            fs.rmSync(destination, { recursive: !0, force: !0 });
          }
          const destinationParent = path.dirname(destination);
          return (
            fs.existsSync(destinationParent) || fs.mkdirSync(destinationParent, { recursive: !0 }),
            fs.cpSync(source, destination, { recursive: !0, force: allowOverwrite }),
            { ok: !0, source: source, destination: destination }
          );
        } catch (err) {
          return { ok: !1, error: err.message };
        }
      },
    ),
    ipcMain.handle(
      'move-item',
      async (
        _e,
        { sourcePath: sourcePath, destinationPath: destinationPath, overwrite: overwrite = !1 },
      ) => {
        if (!sourcePath?.trim()) return { ok: !1, error: 'No source path provided.' };
        if (!destinationPath?.trim()) return { ok: !1, error: 'No destination path provided.' };
        const source = path.resolve(sourcePath),
          destination = path.resolve(destinationPath),
          allowOverwrite = normalizeBool(overwrite);
        try {
          if (!fs.existsSync(source)) return { ok: !1, error: 'Source path does not exist.' };
          if (fs.existsSync(destination)) {
            if (!allowOverwrite)
              return {
                ok: !1,
                error: 'Destination already exists. Re-run with overwrite=true to replace it.',
              };
            const reason = protectedDeleteReason(destination);
            if (reason) return { ok: !1, error: reason };
            fs.rmSync(destination, { recursive: !0, force: !0 });
          }
          const destinationParent = path.dirname(destination);
          fs.existsSync(destinationParent) || fs.mkdirSync(destinationParent, { recursive: !0 });
          try {
            fs.renameSync(source, destination);
          } catch (err) {
            if (!['EXDEV', 'EPERM'].includes(err.code)) throw err;
            (fs.cpSync(source, destination, { recursive: !0, force: !0 }),
              fs.rmSync(source, { recursive: !0, force: !0 }));
          }
          return { ok: !0, source: source, destination: destination };
        } catch (err) {
          return { ok: !1, error: err.message };
        }
      },
    ),
    ipcMain.handle('inspect-workspace', async (_e, { rootPath: rootPath }) => {
      const rootErr = requireParam(rootPath, 'No workspace path provided.');
      if (rootErr) return rootErr;
      try {
        return { ok: !0, summary: inspectWorkspace(rootPath) };
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }),
    ipcMain.handle('git-status', async (_e, { workingDir: workingDir }) => {
      const wdErr = requireParam(workingDir, 'No working directory provided.');
      if (wdErr) return wdErr;
      return {
        ok: !0,
        ...(await runCommandDetailed('git status --short --branch', {
          cwd: workingDir,
          timeout: 2e4,
        })),
      };
    }),
    ipcMain.handle('git-diff', async (_e, { workingDir: workingDir, staged: staged = !1 }) => {
      const wdErr = requireParam(workingDir, 'No working directory provided.');
      if (wdErr) return wdErr;
      const flag = normalizeBool(staged) ? '--cached ' : '';
      return {
        ok: !0,
        ...(await runCommandDetailed(`git diff ${flag}--stat --patch --minimal --color=never`, {
          cwd: workingDir,
          timeout: 3e4,
        })),
      };
    }),
    ipcMain.handle(
      'git-create-branch',
      async (_e, { workingDir: workingDir, branchName: branchName, checkout: checkout = !0 }) => {
        const wdErr = requireParam(workingDir, 'No working directory provided.');
        if (wdErr) return wdErr;
        if (!branchName?.trim()) return { ok: !1, error: 'No branch name provided.' };
        const command = normalizeBool(checkout)
          ? `git checkout -b "${branchName}"`
          : `git branch "${branchName}"`;
        return {
          ok: !0,
          branchName: branchName,
          ...(await runCommandDetailed(command, { cwd: workingDir, timeout: 2e4 })),
        };
      },
    ),
    ipcMain.handle('run-project-checks', async (_e, params = {}) => {
      const workingDir = params.workingDir || params.working_directory;
      if (!workingDir?.trim()) return { ok: !1, error: 'No working directory provided.' };
      try {
        return await (async function ({
          workingDir: workingDir,
          includeLint: includeLint,
          includeTest: includeTest,
          includeBuild: includeBuild,
        }) {
          const summary = inspectWorkspace(workingDir),
            commands = [];
          if (
            (summary.packageManager && Object.keys(summary.packageScripts).length
              ? (!1 !== includeLint &&
                  summary.packageScripts.lint &&
                  commands.push({
                    label: 'lint',
                    command: buildPackageScriptCommand(summary.packageManager, 'lint'),
                  }),
                !1 !== includeTest &&
                  summary.packageScripts.test &&
                  !/no test specified/i.test(summary.packageScripts.test) &&
                  commands.push({
                    label: 'test',
                    command: buildPackageScriptCommand(summary.packageManager, 'test'),
                  }),
                !1 !== includeBuild &&
                  summary.packageScripts.build &&
                  commands.push({
                    label: 'build',
                    command: buildPackageScriptCommand(summary.packageManager, 'build'),
                  }))
              : summary.languages.includes('python')
                ? (!1 !== includeLint &&
                    fs.existsSync(path.join(summary.path, 'pyproject.toml')) &&
                    commands.push({ label: 'lint', command: 'python -m ruff check .' }),
                  !1 !== includeTest &&
                    (fs.existsSync(path.join(summary.path, 'tests')) ||
                      fs.existsSync(path.join(summary.path, 'pytest.ini'))) &&
                    commands.push({ label: 'test', command: 'python -m pytest' }))
                : summary.languages.includes('rust')
                  ? (!1 !== includeLint &&
                      commands.push({
                        label: 'lint',
                        command: 'cargo clippy --all-targets --all-features',
                      }),
                    !1 !== includeTest && commands.push({ label: 'test', command: 'cargo test' }),
                    !1 !== includeBuild &&
                      commands.push({ label: 'build', command: 'cargo build' }))
                  : summary.languages.includes('go') &&
                    (!1 !== includeTest &&
                      commands.push({ label: 'test', command: 'go test ./...' }),
                    !1 !== includeBuild &&
                      commands.push({ label: 'build', command: 'go build ./...' })),
            !commands.length)
          )
            return {
              ok: !1,
              error: 'No runnable lint/test/build commands were detected for this workspace.',
              summary: summary,
              commands: [],
            };
          const results = [];
          for (const item of commands) {
            const result = await runCommandDetailed(item.command, {
              cwd: summary.path,
              timeout: 'build' === item.label ? 12e4 : 9e4,
            });
            results.push({ ...item, ...result, passed: 0 === result.exitCode && !result.timedOut });
          }
          return {
            ok: results.every((result) => result.passed),
            summary: summary,
            commands: results,
          };
        })({
          workingDir: workingDir,
          includeLint: params.includeLint ?? params.include_lint,
          includeTest: params.includeTest ?? params.include_test,
          includeBuild: params.includeBuild ?? params.include_build,
        });
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }),
    ipcMain.handle('open-folder-os', async (_e, { dirPath: dirPath }) => {
      const dirErr = requireParam(dirPath, 'No directory path provided.');
      if (dirErr) return dirErr;
      const resolved = path.resolve(dirPath);
      try {
        const err = await shell.openPath(resolved);
        return err ? { ok: !1, error: err } : { ok: !0 };
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }),
    ipcMain.handle('open-terminal-os', async (_e, { dirPath: dirPath }) => {
      const dirErr = requireParam(dirPath, 'No directory path provided.');
      if (dirErr) return dirErr;
      const resolved = path.resolve(dirPath.trim());
      try {
        return fs.existsSync(resolved)
          ? (await openTerminalAtPath(resolved, ''), { ok: !0, path: resolved })
          : { ok: !1, error: `Directory does not exist: ${resolved}` };
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }),
    ipcMain.handle('delete-item', async (_e, { itemPath: itemPath }) => {
      if (!itemPath?.trim()) return { ok: !1, error: 'No path provided to delete.' };
      const resolved = path.resolve(itemPath);
      try {
        const reason = protectedDeleteReason(resolved);
        return reason
          ? { ok: !1, error: reason }
          : fs.existsSync(resolved)
            ? (fs.rmSync(resolved, { recursive: !0, force: !0 }), { ok: !0, path: resolved })
            : { ok: !1, error: 'Path does not exist.' };
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }));
}
