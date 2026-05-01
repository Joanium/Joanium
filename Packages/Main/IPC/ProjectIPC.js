import { ipcMain } from 'electron';
import { exec, execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import * as ProjectService from '../Services/ProjectService.js';
import { wrapHandler, wrapRead } from './IPCWrapper.js';
export const ipcMeta = { needs: [] };

// ─── Git error categories (mirrors VS Code's git error handling) ──────────────
const GitErrorCategory = {
  AUTH: 'auth', // credential / permission denied
  NO_UPSTREAM: 'no_upstream', // branch has no remote tracking branch
  DIVERGED: 'diverged', // local and remote have diverged
  CONFLICT: 'conflict', // merge / rebase conflict
  NOTHING: 'nothing', // nothing to commit / already up to date
  NOT_REPO: 'not_repo', // not a git repository
  NETWORK: 'network', // network / timeout
  UNKNOWN: 'unknown',
};

// ─── Git guard helpers ─────────────────────────────────────────────────────────
// requireWorkingDir: returns an error response if workingDir is missing/blank,
// or null when the value is valid. Used in every git IPC handler.
function requireWorkingDir(workingDir) {
  return workingDir?.trim()
    ? null
    : { ok: false, category: GitErrorCategory.UNKNOWN, hint: 'No working directory provided.' };
}

function classifyGitError(stderr = '', stdout = '') {
  const s = (stderr + stdout).toLowerCase();
  if (/nothing to commit|nothing added to commit|no changes added/.test(s))
    return {
      category: GitErrorCategory.NOTHING,
      hint: 'Nothing to commit — working tree is clean.',
    };
  if (/already up.to.date/.test(s))
    return { category: GitErrorCategory.NOTHING, hint: 'Already up to date.' };
  if (
    /authentication failed|could not read username|permission denied|invalid credentials|http 401|http 403/.test(
      s,
    )
  )
    return {
      category: GitErrorCategory.AUTH,
      hint: 'Authentication failed. Re-enter credentials or check your SSH key.',
    };
  if (/no upstream|set.upstream|has no tracked branch|does not track/.test(s))
    return {
      category: GitErrorCategory.NO_UPSTREAM,
      hint: 'Branch has no upstream. Will set it automatically.',
    };
  if (/non-fast-forward|fetch first|tip of your current branch is behind/.test(s))
    return {
      category: GitErrorCategory.DIVERGED,
      hint: "Remote has commits you don't have. Pulling then retrying…",
    };
  if (/conflict|automatic merge failed|merge conflict/.test(s))
    return {
      category: GitErrorCategory.CONFLICT,
      hint: 'Merge conflict detected. Resolve conflicts then commit.',
    };
  if (/not a git repository/.test(s))
    return {
      category: GitErrorCategory.NOT_REPO,
      hint: 'Not a git repository. Run `git init` first.',
    };
  if (/unable to connect|could not resolve host|timed out|ssl|connection refused/.test(s))
    return {
      category: GitErrorCategory.NETWORK,
      hint: 'Network error. Check your connection and remote URL.',
    };
  return { category: GitErrorCategory.UNKNOWN, hint: stderr.trim() || 'Unknown git error.' };
}

// Safe variant: takes an args array and uses execFile — no shell, no injection risk.
function runGitArgs(args, workingDir, opts = {}) {
  const timeout = opts.timeout ?? 20_000;
  return new Promise((resolve) => {
    const [cmd, ...cmdArgs] = args;
    execFile(
      cmd,
      cmdArgs,
      { cwd: workingDir, timeout, maxBuffer: 512_000 },
      (err, stdout, stderr) => {
        const exitCode = typeof err?.code === 'number' ? err.code : 0;
        if (!err) {
          resolve({ ok: true, stdout: stdout || '', stderr: stderr || '', exitCode });
        } else {
          const { category, hint } = classifyGitError(stderr, stdout);
          resolve({
            ok: false,
            stdout: stdout || '',
            stderr: stderr || '',
            exitCode,
            category,
            hint,
          });
        }
      },
    );
  });
}

function runGit(command, workingDir, opts = {}) {
  const timeout = opts.timeout ?? 20_000;
  return new Promise((resolve) => {
    exec(
      command,
      {
        cwd: workingDir,
        timeout,
        maxBuffer: 512_000,
        shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash',
      },
      (err, stdout, stderr) => {
        const exitCode = typeof err?.code === 'number' ? err.code : 0;
        if (!err) {
          resolve({ ok: true, stdout: stdout || '', stderr: stderr || '', exitCode });
        } else {
          const { category, hint } = classifyGitError(stderr, stdout);
          resolve({
            ok: false,
            stdout: stdout || '',
            stderr: stderr || '',
            exitCode,
            category,
            hint,
          });
        }
      },
    );
  });
}

const runGitNet = (cmd, dir) => runGit(cmd, dir, { timeout: 60_000 });

function clearLockFile(workingDir) {
  try {
    const f = path.join(workingDir, '.git', 'index.lock');
    if (fs.existsSync(f)) fs.unlinkSync(f);
  } catch {
    /* best-effort */
  }
}

export function register() {
  (ipcMain.handle(
    'get-projects',
    wrapRead(() => ProjectService.list()),
  ),
    ipcMain.handle(
      'get-project',
      wrapRead((projectId) => ProjectService.get(projectId)),
    ),
    ipcMain.handle(
      'create-project',
      wrapHandler((projectData) => ({ project: ProjectService.create(projectData) })),
    ),
    ipcMain.handle(
      'update-project',
      wrapHandler((projectId, patch) => ({ project: ProjectService.update(projectId, patch) })),
    ),
    ipcMain.handle(
      'delete-project',
      wrapHandler((projectId) => {
        ProjectService.remove(projectId);
      }),
    ),
    ipcMain.handle(
      'validate-project',
      wrapHandler((projectId) => {
        const project = ProjectService.get(projectId);
        return { project: project, folderExists: project.folderExists };
      }),
    ));

  ipcMain.handle('git-pull', async (_e, { workingDir }) => {
    const wdErr = requireWorkingDir(workingDir);
    if (wdErr) return wdErr;
    const res = await runGitNet('git pull --rebase=false', workingDir);
    if (!res.ok && res.category === GitErrorCategory.NOTHING) return { ...res, ok: true };
    return res;
  });

  ipcMain.handle('git-delete-branch', async (_e, { workingDir, branch }) => {
    const wdErr = requireWorkingDir(workingDir);
    if (wdErr) return wdErr;
    if (!branch?.trim())
      return { ok: false, category: GitErrorCategory.UNKNOWN, hint: 'No branch name provided.' };
    return runGitArgs(['git', 'branch', '-D', branch], workingDir);
  });

  ipcMain.handle('git-branches', async (_e, { workingDir }) => {
    const wdErr = requireWorkingDir(workingDir);
    if (wdErr) return wdErr;
    const [currentRes, allRes] = await Promise.all([
      runGit('git rev-parse --abbrev-ref HEAD', workingDir),
      runGit('git branch --format=%(refname:short)', workingDir),
    ]);
    if (!currentRes.ok && !allRes.ok)
      return { ok: false, category: GitErrorCategory.NOT_REPO, hint: 'Not a git repository.' };
    const current = currentRes.stdout.trim();
    const branches = allRes.stdout
      .split('\n')
      .map((b) => b.trim())
      .filter(Boolean);
    return { ok: true, current, branches };
  });

  ipcMain.handle('git-checkout-branch', async (_e, { workingDir, branch }) => {
    const wdErr = requireWorkingDir(workingDir);
    if (wdErr) return wdErr;
    if (!branch?.trim())
      return { ok: false, category: GitErrorCategory.UNKNOWN, hint: 'No branch name provided.' };
    return runGitArgs(['git', 'checkout', branch], workingDir);
  });

  ipcMain.handle('git-commit', async (_e, { workingDir, message }) => {
    const wdErr = requireWorkingDir(workingDir);
    if (wdErr) return wdErr;
    if (!message?.trim())
      return { ok: false, category: GitErrorCategory.UNKNOWN, hint: 'No commit message provided.' };

    clearLockFile(workingDir);

    const statusRes = await runGit('git status --porcelain', workingDir);
    if (!statusRes.ok) return statusRes;
    if (!statusRes.stdout.trim()) {
      return {
        ok: true,
        noop: true,
        category: GitErrorCategory.NOTHING,
        hint: 'Nothing to commit — working tree is clean.',
      };
    }

    const stageRes = await runGit('git add -A', workingDir);
    if (!stageRes.ok) return stageRes;

    const commitRes = await runGitArgs(['git', 'commit', '-m', message], workingDir, {
      timeout: 300_000,
    });

    if (!commitRes.ok && commitRes.category === GitErrorCategory.NOTHING) {
      return { ...commitRes, ok: true, noop: true };
    }
    return commitRes;
  });

  ipcMain.handle('git-push', async (_e, { workingDir }) => {
    const wdErr = requireWorkingDir(workingDir);
    if (wdErr) return wdErr;

    let res = await runGitNet('git push', workingDir);
    if (res.ok) return res;

    if (res.category === GitErrorCategory.NO_UPSTREAM) {
      return runGitNet('git push -u origin HEAD', workingDir);
    }

    if (res.category === GitErrorCategory.DIVERGED) {
      // Abort any stale rebase state left over from a previous failed attempt
      // before starting a fresh pull. This is the main cause of lag / "not going"
      // when there are multiple unpushed commits and the remote has diverged.
      await runGit('git rebase --abort', workingDir).catch(() => {});

      // Use merge (not rebase) so that multiple local commits are preserved as-is
      // and the pull can't produce per-commit conflicts that stall the process.
      const pullRes = await runGitNet('git pull --no-rebase', workingDir);
      if (!pullRes.ok && pullRes.category !== GitErrorCategory.NOTHING) return pullRes;

      res = await runGitNet('git push', workingDir);
      if (!res.ok && res.category === GitErrorCategory.NO_UPSTREAM) {
        return runGitNet('git push -u origin HEAD', workingDir);
      }
      return res;
    }

    return res;
  });

  ipcMain.handle('git-push-sync', async (_e, { workingDir }) => {
    const wdErr = requireWorkingDir(workingDir);
    if (wdErr) return wdErr;

    // Abort any stale rebase state before pulling
    await runGit('git rebase --abort', workingDir).catch(() => {});

    const pullRes = await runGitNet('git pull --no-rebase', workingDir);
    // Allow NOTHING (already up to date) and NO_UPSTREAM through — both are fine
    // to ignore here since the push step handles NO_UPSTREAM with -u origin HEAD.
    if (
      !pullRes.ok &&
      pullRes.category !== GitErrorCategory.NOTHING &&
      pullRes.category !== GitErrorCategory.NO_UPSTREAM
    )
      return pullRes;

    let res = await runGitNet('git push', workingDir);
    if (res.ok) return res;

    if (res.category === GitErrorCategory.NO_UPSTREAM) {
      return runGitNet('git push -u origin HEAD', workingDir);
    }

    return res;
  });
}
