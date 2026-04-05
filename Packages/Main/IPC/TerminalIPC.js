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

const activePtys = new Map();

const MAX_OUTPUT_BYTES = 64_000;
const DEFAULT_TIMEOUT = 30_000;
const MAX_TIMEOUT = 120_000;
const MAX_FILE_BYTES = 512_000;
const MAX_LINES_DEFAULT = 200;
const MAX_SEARCH_RESULTS = 40;
const MAX_SEARCH_FILES = 4_000;
const MAX_MULTI_FILE_READS = 12;
const MAX_TREE_DEPTH = 6;
const MAX_TREE_ENTRIES = 500;

const WORKSPACE_SKIP_DIRS = new Set([
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
]);

const TEXT_EXTENSIONS = new Set([
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
]);

const COMMAND_RISK_RULES = [
  { level: 'critical', pattern: /\brm\s+-rf\s+\/(?!\w)/i, reason: 'Deletes the filesystem root.' },
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

function truncate(str, maxBytes = MAX_OUTPUT_BYTES) {
  const buf = Buffer.from(str, 'utf-8');
  if (buf.length <= maxBytes) return str;
  return `${buf.slice(0, maxBytes).toString('utf-8')}\n\n…(truncated — ${buf.length} bytes total)`;
}

function resolveDir(inputPath) {
  return path.resolve(inputPath?.trim() || os.homedir());
}

function normalizeBool(value) {
  return value === true || value === 'true';
}

function isProbablyTextFile(filePath) {
  const base = path.basename(filePath).toLowerCase();
  if (base === 'dockerfile' || base === 'makefile' || base === '.gitignore') return true;
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function detectEol(raw = '') {
  return raw.includes('\r\n') ? '\r\n' : '\n';
}

function splitLinesPreserveFinal(raw = '') {
  if (!raw) return { lines: [], endsWithNewline: false };
  const endsWithNewline = /\r?\n$/.test(raw);
  const lines = raw.split(/\r?\n/);
  if (endsWithNewline) lines.pop();
  return { lines, endsWithNewline };
}

function joinLines(lines = [], eol = '\n', endsWithNewline = false) {
  if (!lines.length) return '';
  const joined = lines.join(eol);
  return endsWithNewline ? `${joined}${eol}` : joined;
}

function parsePathList(input) {
  return String(input ?? '')
    .split(/[\r\n,]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function readTextFilePreview(filePath, maxLines = MAX_LINES_DEFAULT) {
  const resolved = path.resolve(filePath);
  const stat = fs.statSync(resolved);
  if (!stat.isFile()) throw new Error(`"${resolved}" is not a file.`);
  if (stat.size > MAX_FILE_BYTES) {
    throw new Error(
      `File too large (${(stat.size / 1024).toFixed(0)} KB > 512 KB limit). Use read-file-chunk or search-workspace instead.`,
    );
  }

  const raw = fs.readFileSync(resolved, 'utf-8');
  const lines = raw.split('\n');
  const limit = Math.min(Number(maxLines) || MAX_LINES_DEFAULT, 2_000);
  const sliced = lines.slice(0, limit);
  const note = lines.length > limit ? `\n...(showing ${limit} of ${lines.length} lines)` : '';

  return {
    path: resolved,
    content: sliced.join('\n') + note,
    totalLines: lines.length,
    sizeBytes: stat.size,
  };
}

function buildDirectoryTree(dirPath, maxDepth = 3, maxEntries = 200) {
  const resolved = path.resolve(dirPath);
  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) throw new Error(`"${resolved}" is not a directory.`);

  const depthLimit = Math.min(Math.max(1, Number(maxDepth) || 3), MAX_TREE_DEPTH);
  const entryLimit = Math.min(Math.max(1, Number(maxEntries) || 200), MAX_TREE_ENTRIES);
  const lines = [resolved];
  let included = 0;
  let truncated = false;

  function walk(currentPath, depth, prefix) {
    if (depth >= depthLimit || truncated) return;

    let entries = fs
      .readdirSync(currentPath, { withFileTypes: true })
      .filter((entry) => entry.name !== '.' && entry.name !== '..' && !entry.isSymbolicLink?.())
      .filter((entry) => !WORKSPACE_SKIP_DIRS.has(entry.name))
      .sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    for (let index = 0; index < entries.length; index++) {
      if (included >= entryLimit) {
        truncated = true;
        return;
      }

      const entry = entries[index];
      const isLast = index === entries.length - 1;
      const marker = isLast ? '└─ ' : '├─ ';
      const nextPrefix = `${prefix}${isLast ? '   ' : '│  '}`;
      const label = `${entry.name}${entry.isDirectory() ? '/' : ''}`;

      lines.push(`${prefix}${marker}${label}`);
      included += 1;

      if (entry.isDirectory()) {
        walk(path.join(currentPath, entry.name), depth + 1, nextPrefix);
        if (truncated) return;
      }
    }
  }

  walk(resolved, 0, '');

  return {
    path: resolved,
    lines,
    count: included,
    truncated,
    maxDepth: depthLimit,
  };
}

function walkWorkspaceFiles(rootPath, maxFiles = MAX_SEARCH_FILES) {
  const root = resolveDir(rootPath);
  const files = [];
  const stack = [root];

  while (stack.length && files.length < maxFiles) {
    const current = stack.pop();
    let entries = [];

    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.name === '.' || entry.name === '..' || entry.isSymbolicLink?.()) continue;

      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!WORKSPACE_SKIP_DIRS.has(entry.name)) stack.push(abs);
        continue;
      }

      if (entry.isFile()) files.push(abs);
      if (files.length >= maxFiles) break;
    }
  }

  return { root, files };
}

function readJsonIfExists(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch {
    /* non-fatal */
  }
  return null;
}

function detectPackageManager(root, entries) {
  const names = new Set(entries.map((entry) => entry.name));
  if (names.has('pnpm-lock.yaml')) return 'pnpm';
  if (names.has('yarn.lock')) return 'yarn';
  if (names.has('bun.lockb') || names.has('bun.lock')) return 'bun';
  if (names.has('package-lock.json')) return 'npm';
  if (fs.existsSync(path.join(root, 'package.json'))) return 'npm';
  return '';
}

function buildPackageScriptCommand(packageManager, scriptName) {
  if (!packageManager || !scriptName) return '';
  if (packageManager === 'yarn') return `yarn ${scriptName}`;
  if (packageManager === 'bun') return `bun run ${scriptName}`;
  return `${packageManager} run ${scriptName}`;
}

function inspectWorkspace(rootPath) {
  const root = resolveDir(rootPath);
  const stat = fs.statSync(root);
  if (!stat.isDirectory()) throw new Error(`"${root}" is not a directory.`);

  const entries = fs
    .readdirSync(root, { withFileTypes: true })
    .map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? 'dir' : entry.isFile() ? 'file' : 'other',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const packageJson = readJsonIfExists(path.join(root, 'package.json'));
  const packageManager = detectPackageManager(root, entries);
  const ciDir = path.join(root, '.github', 'workflows');
  const ciWorkflows = fs.existsSync(ciDir)
    ? fs
        .readdirSync(ciDir)
        .filter((name) => /\.(ya?ml)$/i.test(name))
        .slice(0, 20)
    : [];

  const dockerFiles = entries
    .map((entry) => entry.name)
    .filter((name) => /^dockerfile/i.test(name) || /^docker-compose\.(ya?ml)$/i.test(name));

  const envFiles = entries
    .map((entry) => entry.name)
    .filter((name) => name === '.env' || name.startsWith('.env.'));

  const frameworks = new Set();
  const languages = new Set();
  const testing = new Set();
  const infra = new Set();

  const deps = {
    ...(packageJson?.dependencies ?? {}),
    ...(packageJson?.devDependencies ?? {}),
  };

  if (packageJson) languages.add('javascript');
  if (fs.existsSync(path.join(root, 'tsconfig.json'))) languages.add('typescript');
  if (
    fs.existsSync(path.join(root, 'pyproject.toml')) ||
    fs.existsSync(path.join(root, 'requirements.txt'))
  )
    languages.add('python');
  if (fs.existsSync(path.join(root, 'Cargo.toml'))) languages.add('rust');
  if (fs.existsSync(path.join(root, 'go.mod'))) languages.add('go');

  if (deps.react) frameworks.add('react');
  if (deps.next) frameworks.add('nextjs');
  if (deps.vue) frameworks.add('vue');
  if (deps.svelte) frameworks.add('svelte');
  if (deps.electron) frameworks.add('electron');
  if (deps.express) frameworks.add('express');
  if (deps.vite) frameworks.add('vite');

  if (deps.jest) testing.add('jest');
  if (deps.vitest) testing.add('vitest');
  if (deps.playwright) testing.add('playwright');
  if (deps.cypress) testing.add('cypress');
  if (deps.mocha) testing.add('mocha');

  if (dockerFiles.length) infra.add('docker');
  if (
    entries.some(
      (entry) => entry.name === 'k8s' || entry.name === 'helm' || entry.name === 'charts',
    )
  )
    infra.add('kubernetes');
  if (entries.some((entry) => /\.tf$/i.test(entry.name) || entry.name === 'terraform'))
    infra.add('terraform');
  if (ciWorkflows.length) infra.add('github_actions');

  const scripts = packageJson?.scripts ?? {};
  const notes = [];
  if (scripts.dev) notes.push('Has a dev/start workflow defined in package.json.');
  if (scripts.lint || testing.size || scripts.test)
    notes.push('Has detectable QA/testing signals.');
  if (infra.size) notes.push('Contains deployment or infrastructure-related files.');

  return {
    path: root,
    packageManager,
    topEntries: entries.slice(0, 80),
    packageScripts: scripts,
    frameworks: [...frameworks],
    languages: [...languages],
    testing: [...testing],
    infra: [...infra],
    dockerFiles,
    envFiles,
    ciWorkflows,
    notes,
  };
}

function severityRank(level) {
  return { low: 0, medium: 1, high: 2, critical: 3 }[level] ?? 0;
}

function assessCommandRisk(command = '') {
  const cmd = String(command || '').trim();
  let level = 'low';
  const reasons = [];

  for (const rule of COMMAND_RISK_RULES) {
    if (rule.pattern.test(cmd)) {
      reasons.push(rule.reason);
      if (severityRank(rule.level) > severityRank(level)) {
        level = rule.level;
      }
    }
  }

  return {
    command: cmd,
    level,
    reasons,
    blocked: level === 'critical',
    requiresOptIn: level === 'high',
  };
}

function protectedDeleteReason(resolved) {
  const parsed = path.parse(resolved);
  if (resolved === parsed.root) return 'Refusing to delete the filesystem root.';
  if (resolved === os.homedir()) return 'Refusing to delete the home directory.';
  if (path.basename(resolved).toLowerCase() === '.git')
    return 'Refusing to delete a .git directory.';
  return '';
}

function runCommandDetailed(command, { cwd, timeout = DEFAULT_TIMEOUT } = {}) {
  const effectiveCwd = resolveDir(cwd);
  const effectiveTimeout = Math.min(Number(timeout) || DEFAULT_TIMEOUT, MAX_TIMEOUT);

  return new Promise((resolve) => {
    exec(
      command,
      {
        cwd: effectiveCwd,
        timeout: effectiveTimeout,
        maxBuffer: MAX_OUTPUT_BYTES * 2,
        shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash',
      },
      (err, stdout, stderr) => {
        resolve({
          ok: !err,
          stdout: truncate(stdout || ''),
          stderr: truncate(stderr || ''),
          exitCode: typeof err?.code === 'number' ? err.code : 0,
          timedOut: Boolean(err?.killed),
          cwd: effectiveCwd,
        });
      },
    );
  });
}

async function runProjectChecks({ workingDir, includeLint, includeTest, includeBuild }) {
  const summary = inspectWorkspace(workingDir);
  const commands = [];

  if (summary.packageManager && Object.keys(summary.packageScripts).length) {
    if (includeLint !== false && summary.packageScripts.lint) {
      commands.push({
        label: 'lint',
        command: buildPackageScriptCommand(summary.packageManager, 'lint'),
      });
    }
    if (
      includeTest !== false &&
      summary.packageScripts.test &&
      !/no test specified/i.test(summary.packageScripts.test)
    ) {
      commands.push({
        label: 'test',
        command: buildPackageScriptCommand(summary.packageManager, 'test'),
      });
    }
    if (includeBuild !== false && summary.packageScripts.build) {
      commands.push({
        label: 'build',
        command: buildPackageScriptCommand(summary.packageManager, 'build'),
      });
    }
  } else if (summary.languages.includes('python')) {
    if (includeLint !== false && fs.existsSync(path.join(summary.path, 'pyproject.toml'))) {
      commands.push({ label: 'lint', command: 'python -m ruff check .' });
    }
    if (
      includeTest !== false &&
      (fs.existsSync(path.join(summary.path, 'tests')) ||
        fs.existsSync(path.join(summary.path, 'pytest.ini')))
    ) {
      commands.push({ label: 'test', command: 'python -m pytest' });
    }
  } else if (summary.languages.includes('rust')) {
    if (includeLint !== false)
      commands.push({ label: 'lint', command: 'cargo clippy --all-targets --all-features' });
    if (includeTest !== false) commands.push({ label: 'test', command: 'cargo test' });
    if (includeBuild !== false) commands.push({ label: 'build', command: 'cargo build' });
  } else if (summary.languages.includes('go')) {
    if (includeTest !== false) commands.push({ label: 'test', command: 'go test ./...' });
    if (includeBuild !== false) commands.push({ label: 'build', command: 'go build ./...' });
  }

  if (!commands.length) {
    return {
      ok: false,
      error: 'No runnable lint/test/build commands were detected for this workspace.',
      summary,
      commands: [],
    };
  }

  const results = [];
  for (const item of commands) {
    const result = await runCommandDetailed(item.command, {
      cwd: summary.path,
      timeout: item.label === 'build' ? 120_000 : 90_000,
    });
    results.push({
      ...item,
      ...result,
      passed: result.exitCode === 0 && !result.timedOut,
    });
  }

  return {
    ok: results.every((result) => result.passed),
    summary,
    commands: results,
  };
}

export const ipcMeta = { needs: [] };
export function register() {
  ipcMain.handle('find-file-by-name', async (_e, { rootPath, name, maxResults = 40 }) => {
    if (!rootPath?.trim()) return { ok: false, error: 'No workspace path provided.' };
    if (!name?.trim()) return { ok: false, error: 'No filename provided.' };

    try {
      const { root, files } = walkWorkspaceFiles(rootPath);
      const needle = name.toLowerCase();
      const limit = Math.min(Math.max(1, Number(maxResults) || 40), 200);
      const matches = [];

      for (const file of files) {
        if (matches.length >= limit) break;
        if (path.basename(file).toLowerCase().includes(needle)) {
          matches.push({ path: path.relative(root, file) });
        }
      }

      return { ok: true, root, matches };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('select-directory', async (e, opts = {}) => {
    const window = BrowserWindow.fromWebContents(e.sender);
    const result = await dialog.showOpenDialog(window, {
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: opts.defaultPath?.trim() || undefined,
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false };
    }
    return { ok: true, path: result.filePaths[0] };
  });

  const handlePtySpawn = async (e, { command, cwd, settleMs } = {}) => {
    const pid = `${Date.now()}${Math.random().toString(36).slice(2)}`;
    const child = spawn(command, {
      cwd: resolveDir(cwd),
      shell: true,
      env: { ...process.env, FORCE_COLOR: '1' },
    });

    activePtys.set(pid, child);

    const safeSend = (channel, ...args) => {
      if (!e.sender.isDestroyed()) e.sender.send(channel, ...args);
    };

    const MAX_SNIPPET = 8_000;
    let snippet = '';

    const onStreamData = (data) => {
      const str = data.toString();
      if (snippet.length < MAX_SNIPPET) {
        snippet += str;
        if (snippet.length > MAX_SNIPPET) {
          snippet = `${snippet.slice(0, MAX_SNIPPET)}\n…(truncated)`;
        }
      }
      safeSend('pty-data', pid, str);
    };

    child.stdout.on('data', onStreamData);
    child.stderr.on('data', onStreamData);

    child.on('exit', (code) => {
      activePtys.delete(pid);
      safeSend('pty-exit', pid, code);
    });

    const settleRaw = settleMs == null || settleMs === '' ? 15_000 : Number(settleMs);
    const settle = Math.min(Math.max(0, Number.isFinite(settleRaw) ? settleRaw : 15_000), 60_000);

    const earlyOutcome = await new Promise((resolve) => {
      let settled = false;
      let timeoutId;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        resolve(value);
      };

      child.once('error', (err) => finish({ kind: 'spawnError', message: err.message }));
      child.once('exit', (code, signal) => finish({ kind: 'exited', code, signal }));

      if (settle > 0) {
        timeoutId = setTimeout(() => finish({ kind: 'running' }), settle);
      } else {
        finish({ kind: 'running' });
      }
    });

    if (earlyOutcome.kind === 'spawnError') {
      activePtys.delete(pid);
      try {
        child.kill();
      } catch {
        /* ignore */
      }
      return { ok: false, error: `Failed to start process: ${earlyOutcome.message}` };
    }

    if (earlyOutcome.kind === 'exited') {
      const { code, signal } = earlyOutcome;
      const tail = snippet.trim() || '(no output captured)';

      if (code === 0) {
        return {
          ok: false,
          error:
            'Process exited immediately with code 0. For a dev server, the command must keep running; check that you used the right script (e.g. dev/start) and cwd.',
          exitCode: 0,
          outputSnippet: tail,
        };
      }

      if (code !== null && code !== 0) {
        return {
          ok: false,
          error: `Process exited during startup (code ${code}). Common causes: port already in use (EADDRINUSE), missing dependencies, or invalid config.`,
          exitCode: code,
          outputSnippet: tail,
        };
      }

      return {
        ok: false,
        error: `Process terminated during startup${signal ? ` (${signal})` : ''}.`,
        exitCode: code,
        signal,
        outputSnippet: tail,
      };
    }

    return { ok: true, pid };
  };
  ipcMain.handle('pty-spawn', handlePtySpawn);
  ipcMain.handle('spawn-pty', handlePtySpawn);

  ipcMain.handle('pty-write', async (_e, pid, data) => {
    const child = activePtys.get(pid);
    if (!child) return { ok: false, error: 'PTY not found' };
    child.stdin.write(data);
    return { ok: true };
  });

  ipcMain.handle('pty-resize', async () => ({ ok: true }));

  ipcMain.handle('pty-kill', async (_e, pid) => {
    const child = activePtys.get(pid);
    if (!child) return { ok: false, error: 'PTY not found' };
    child.kill();
    activePtys.delete(pid);
    return { ok: true };
  });

  ipcMain.handle('assess-command-risk', async (_e, { command }) => {
    if (!command?.trim()) return { ok: false, error: 'No command provided.' };
    return { ok: true, risk: assessCommandRisk(command) };
  });

  ipcMain.handle('run-shell-command', async (_e, { command, cwd, timeout, allowRisky = false }) => {
    if (!command?.trim()) return { ok: false, error: 'No command provided.' };

    const risk = assessCommandRisk(command);
    if (risk.blocked) {
      return { ok: false, error: 'Blocked: command matches a critical destructive pattern.', risk };
    }
    if (risk.requiresOptIn && !allowRisky) {
      return {
        ok: false,
        error:
          'Command is high-risk. Re-run with allow_risky=true only if the user explicitly asked for it.',
        risk,
      };
    }

    const result = await runCommandDetailed(command, { cwd, timeout });
    return { ...result, risk };
  });

  ipcMain.handle('read-local-file', async (_e, { filePath, maxLines }) => {
    if (!filePath?.trim()) return { ok: false, error: 'No file path provided.' };

    try {
      return {
        ok: true,
        ...readTextFilePreview(filePath, maxLines),
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('extract-document-text', async (_e, payload = {}) => {
    try {
      const result = payload.filePath?.trim()
        ? await extractDocumentTextFromPath(payload.filePath)
        : await extractDocumentTextFromBuffer({
            fileName: payload.fileName ?? '',
            mimeType: payload.mimeType ?? '',
            buffer: payload.buffer,
          });

      return { ok: true, ...result };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('read-file-chunk', async (_e, { filePath, startLine = 1, lineCount = 120 }) => {
    if (!filePath?.trim()) return { ok: false, error: 'No file path provided.' };

    const resolved = path.resolve(filePath);
    try {
      const raw = fs.readFileSync(resolved, 'utf-8');
      const lines = raw.split('\n');
      const start = Math.max(1, Number(startLine) || 1);
      const count = Math.min(Math.max(1, Number(lineCount) || 120), 500);
      const slice = lines.slice(start - 1, start - 1 + count);
      return {
        ok: true,
        path: resolved,
        startLine: start,
        endLine: start + slice.length - 1,
        totalLines: lines.length,
        content: slice.join('\n'),
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('read-multiple-local-files', async (_e, { paths, maxLinesPerFile }) => {
    const filePaths = parsePathList(paths).slice(0, MAX_MULTI_FILE_READS);
    if (!filePaths.length) return { ok: false, error: 'No file paths provided.' };

    try {
      const files = filePaths.map((filePath) => {
        try {
          return { ok: true, ...readTextFilePreview(filePath, maxLinesPerFile ?? 180) };
        } catch (err) {
          return { ok: false, path: path.resolve(filePath), error: err.message };
        }
      });

      return { ok: true, files };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('list-directory', async (_e, { dirPath }) => {
    if (!dirPath?.trim()) return { ok: false, error: 'No directory path provided.' };

    const resolved = path.resolve(dirPath);
    try {
      const stat = fs.statSync(resolved);
      if (!stat.isDirectory()) return { ok: false, error: `"${resolved}" is not a directory.` };

      const entries = fs.readdirSync(resolved, { withFileTypes: true });
      const items = entries
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
        .sort((a, b) => {
          if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

      return { ok: true, path: resolved, entries: items, count: items.length };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('list-directory-tree', async (_e, { dirPath, maxDepth, maxEntries }) => {
    if (!dirPath?.trim()) return { ok: false, error: 'No directory path provided.' };

    try {
      return {
        ok: true,
        ...buildDirectoryTree(dirPath, maxDepth, maxEntries),
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle(
    'search-workspace',
    async (_e, { rootPath, query, maxResults = MAX_SEARCH_RESULTS }) => {
      if (!rootPath?.trim()) return { ok: false, error: 'No workspace path provided.' };
      if (!query?.trim()) return { ok: false, error: 'No search query provided.' };

      try {
        const { root, files } = walkWorkspaceFiles(rootPath);
        const limit = Math.min(Math.max(1, Number(maxResults) || MAX_SEARCH_RESULTS), 100);
        const matches = [];
        const isRegex = /^\/.*\/[gimsuy]*$/.test(query.trim());
        const matcher = isRegex
          ? new RegExp(
              query.trim().slice(1, query.trim().lastIndexOf('/')),
              query.trim().slice(query.trim().lastIndexOf('/') + 1),
            )
          : null;
        const needle = query.toLowerCase();

        for (const file of files) {
          if (matches.length >= limit) break;
          if (!isProbablyTextFile(file)) continue;

          let stat;
          try {
            stat = fs.statSync(file);
          } catch {
            continue;
          }
          if (stat.size > MAX_FILE_BYTES) continue;

          let raw = '';
          try {
            raw = fs.readFileSync(file, 'utf-8');
          } catch {
            continue;
          }

          const lines = raw.split('\n');
          for (let index = 0; index < lines.length; index++) {
            const line = lines[index];
            if (matcher) matcher.lastIndex = 0;
            const matched = matcher ? matcher.test(line) : line.toLowerCase().includes(needle);
            if (!matched) continue;
            matches.push({
              path: path.relative(root, file),
              lineNumber: index + 1,
              line: line.trim().slice(0, 240),
            });
            if (matches.length >= limit) break;
          }
        }

        return { ok: true, root, matches };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    },
  );

  ipcMain.handle('write-ai-file', async (_e, { filePath, content, append = false }) => {
    if (!filePath?.trim()) return { ok: false, error: 'No file path provided.' };
    const resolved = path.resolve(filePath);
    try {
      const dir = path.dirname(resolved);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (append) fs.appendFileSync(resolved, content ?? '', 'utf-8');
      else fs.writeFileSync(resolved, content ?? '', 'utf-8');
      return { ok: true, path: resolved, bytes: Buffer.byteLength(content ?? '', 'utf-8') };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle(
    'apply-file-patch',
    async (_e, { filePath, search, replace, replaceAll = false }) => {
      if (!filePath?.trim()) return { ok: false, error: 'No file path provided.' };
      if (typeof search !== 'string' || search.length === 0)
        return { ok: false, error: 'No search text provided.' };
      if (typeof replace !== 'string') return { ok: false, error: 'No replacement text provided.' };

      const resolved = path.resolve(filePath);
      try {
        const original = fs.readFileSync(resolved, 'utf-8');
        if (!original.includes(search)) {
          return { ok: false, error: 'Search text was not found in the file.' };
        }

        const occurrences = original.split(search).length - 1;
        const next = replaceAll
          ? original.split(search).join(replace)
          : original.replace(search, replace);
        fs.writeFileSync(resolved, next, 'utf-8');

        return {
          ok: true,
          path: resolved,
          replacements: replaceAll ? occurrences : 1,
        };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    },
  );

  ipcMain.handle(
    'replace-lines-in-file',
    async (_e, { filePath, startLine, endLine, replacement }) => {
      if (!filePath?.trim()) return { ok: false, error: 'No file path provided.' };
      if (!Number.isFinite(Number(startLine)))
        return { ok: false, error: 'No valid start line provided.' };
      if (!Number.isFinite(Number(endLine)))
        return { ok: false, error: 'No valid end line provided.' };
      if (typeof replacement !== 'string')
        return { ok: false, error: 'No replacement text provided.' };

      const resolved = path.resolve(filePath);
      try {
        const original = fs.readFileSync(resolved, 'utf-8');
        const eol = detectEol(original);
        const { lines, endsWithNewline } = splitLinesPreserveFinal(original);
        const start = Math.max(1, Number(startLine));
        const end = Math.max(start, Number(endLine));

        if (start > lines.length || end > lines.length) {
          return {
            ok: false,
            error: `Line range ${start}-${end} is outside the file (${lines.length} lines).`,
          };
        }

        const replacementLines = replacement === '' ? [] : replacement.split(/\r?\n/);
        const nextLines = [...lines.slice(0, start - 1), ...replacementLines, ...lines.slice(end)];

        fs.writeFileSync(resolved, joinLines(nextLines, eol, endsWithNewline), 'utf-8');

        return {
          ok: true,
          path: resolved,
          startLine: start,
          endLine: end,
          insertedLines: replacementLines.length,
        };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    },
  );

  ipcMain.handle(
    'insert-into-file',
    async (_e, { filePath, content, position = 'end', lineNumber, anchor }) => {
      if (!filePath?.trim()) return { ok: false, error: 'No file path provided.' };
      if (typeof content !== 'string') return { ok: false, error: 'No content provided.' };

      const resolved = path.resolve(filePath);
      try {
        const original = fs.readFileSync(resolved, 'utf-8');
        const normalizedPosition =
          String(position || '')
            .trim()
            .toLowerCase() || (anchor ? 'after' : 'end');
        let next = original;

        if (Number.isFinite(Number(lineNumber))) {
          const eol = detectEol(original);
          const { lines, endsWithNewline } = splitLinesPreserveFinal(original);
          const rawLineNumber = Math.max(1, Number(lineNumber));
          const boundedLineNumber = Math.min(rawLineNumber, lines.length + 1);
          const insertIndex =
            normalizedPosition === 'after'
              ? Math.min(boundedLineNumber, lines.length)
              : boundedLineNumber - 1;
          const contentLines = content === '' ? [] : content.split(/\r?\n/);

          lines.splice(insertIndex, 0, ...contentLines);
          next = joinLines(lines, eol, endsWithNewline);
        } else if (anchor) {
          const anchorIndex = original.indexOf(anchor);
          if (anchorIndex === -1) {
            return { ok: false, error: 'Anchor text was not found in the file.' };
          }

          const insertAt =
            normalizedPosition === 'before' ? anchorIndex : anchorIndex + anchor.length;
          next = `${original.slice(0, insertAt)}${content}${original.slice(insertAt)}`;
        } else if (normalizedPosition === 'start') {
          next = `${content}${original}`;
        } else {
          next = `${original}${content}`;
        }

        fs.writeFileSync(resolved, next, 'utf-8');

        return {
          ok: true,
          path: resolved,
          position: normalizedPosition,
          mode: Number.isFinite(Number(lineNumber)) ? 'line' : anchor ? 'anchor' : 'boundary',
        };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    },
  );

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

  ipcMain.handle('copy-item', async (_e, { sourcePath, destinationPath, overwrite = false }) => {
    if (!sourcePath?.trim()) return { ok: false, error: 'No source path provided.' };
    if (!destinationPath?.trim()) return { ok: false, error: 'No destination path provided.' };

    const source = path.resolve(sourcePath);
    const destination = path.resolve(destinationPath);
    const allowOverwrite = normalizeBool(overwrite);

    try {
      if (!fs.existsSync(source)) return { ok: false, error: 'Source path does not exist.' };
      if (fs.existsSync(destination)) {
        if (!allowOverwrite) {
          return {
            ok: false,
            error: 'Destination already exists. Re-run with overwrite=true to replace it.',
          };
        }
        const reason = protectedDeleteReason(destination);
        if (reason) return { ok: false, error: reason };
        fs.rmSync(destination, { recursive: true, force: true });
      }

      const destinationParent = path.dirname(destination);
      if (!fs.existsSync(destinationParent)) fs.mkdirSync(destinationParent, { recursive: true });
      fs.cpSync(source, destination, { recursive: true, force: allowOverwrite });

      return { ok: true, source, destination };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('move-item', async (_e, { sourcePath, destinationPath, overwrite = false }) => {
    if (!sourcePath?.trim()) return { ok: false, error: 'No source path provided.' };
    if (!destinationPath?.trim()) return { ok: false, error: 'No destination path provided.' };

    const source = path.resolve(sourcePath);
    const destination = path.resolve(destinationPath);
    const allowOverwrite = normalizeBool(overwrite);

    try {
      if (!fs.existsSync(source)) return { ok: false, error: 'Source path does not exist.' };
      if (fs.existsSync(destination)) {
        if (!allowOverwrite) {
          return {
            ok: false,
            error: 'Destination already exists. Re-run with overwrite=true to replace it.',
          };
        }
        const reason = protectedDeleteReason(destination);
        if (reason) return { ok: false, error: reason };
        fs.rmSync(destination, { recursive: true, force: true });
      }

      const destinationParent = path.dirname(destination);
      if (!fs.existsSync(destinationParent)) fs.mkdirSync(destinationParent, { recursive: true });

      try {
        fs.renameSync(source, destination);
      } catch (err) {
        if (!['EXDEV', 'EPERM'].includes(err.code)) throw err;
        fs.cpSync(source, destination, { recursive: true, force: true });
        fs.rmSync(source, { recursive: true, force: true });
      }

      return { ok: true, source, destination };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('inspect-workspace', async (_e, { rootPath }) => {
    if (!rootPath?.trim()) return { ok: false, error: 'No workspace path provided.' };
    try {
      return { ok: true, summary: inspectWorkspace(rootPath) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('git-status', async (_e, { workingDir }) => {
    if (!workingDir?.trim()) return { ok: false, error: 'No working directory provided.' };
    const result = await runCommandDetailed('git status --short --branch', {
      cwd: workingDir,
      timeout: 20_000,
    });
    return { ok: true, ...result };
  });

  ipcMain.handle('git-diff', async (_e, { workingDir, staged = false }) => {
    if (!workingDir?.trim()) return { ok: false, error: 'No working directory provided.' };
    const flag = normalizeBool(staged) ? '--cached ' : '';
    const result = await runCommandDetailed(
      `git diff ${flag}--stat --patch --minimal --color=never`,
      {
        cwd: workingDir,
        timeout: 30_000,
      },
    );
    return { ok: true, ...result };
  });

  ipcMain.handle('git-create-branch', async (_e, { workingDir, branchName, checkout = true }) => {
    if (!workingDir?.trim()) return { ok: false, error: 'No working directory provided.' };
    if (!branchName?.trim()) return { ok: false, error: 'No branch name provided.' };

    const command = normalizeBool(checkout)
      ? `git checkout -b "${branchName}"`
      : `git branch "${branchName}"`;

    const result = await runCommandDetailed(command, { cwd: workingDir, timeout: 20_000 });
    return { ok: true, branchName, ...result };
  });

  ipcMain.handle('run-project-checks', async (_e, params = {}) => {
    const workingDir = params.workingDir || params.working_directory;
    if (!workingDir?.trim()) return { ok: false, error: 'No working directory provided.' };
    try {
      return await runProjectChecks({
        workingDir,
        includeLint: params.includeLint ?? params.include_lint,
        includeTest: params.includeTest ?? params.include_test,
        includeBuild: params.includeBuild ?? params.include_build,
      });
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

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

  ipcMain.handle('open-terminal-os', async (_e, { dirPath }) => {
    if (!dirPath?.trim()) return { ok: false, error: 'No directory path provided.' };
    const resolved = path.resolve(dirPath.trim());
    try {
      if (!fs.existsSync(resolved)) {
        return { ok: false, error: `Directory does not exist: ${resolved}` };
      }
      await openTerminalAtPath(resolved, '');
      return { ok: true, path: resolved };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('delete-item', async (_e, { itemPath }) => {
    if (!itemPath?.trim()) return { ok: false, error: 'No path provided to delete.' };
    const resolved = path.resolve(itemPath);
    try {
      const reason = protectedDeleteReason(resolved);
      if (reason) return { ok: false, error: reason };
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
