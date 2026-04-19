import { state } from '../../../../../System/State.js';
import { fetchWithTools } from '../../../../../Features/AI/index.js';

let _workingDir = null,
  _pollTimer = null,
  _isDirty = false,
  _currentBranch = '',
  _unpushedCount = -1,
  _hasNoCommits = false,
  _pendingAction = null,
  _cachedBranches = null,
  _confirmCallback = null,
  _busy = false; // prevents concurrent git ops

const POLL_MS = 15000;
const $ = (id) => document.getElementById(id);

function parseGitStatus(stdout) {
  const lines = (stdout || '').split('\n');
  const headerLine = lines[0] || '';
  const m = headerLine.match(/^## (?:No commits yet on )?(.+?)(?:\.\.\.|\s|$)/);
  const noCommits = headerLine.includes('No commits yet');
  const aheadMatch = headerLine.match(/\[ahead (\d+)\]/);
  const unpushedCount = noCommits ? 0 : aheadMatch ? parseInt(aheadMatch[1], 10) : -1;
  return {
    branch: m?.[1]?.trim() || '',
    dirty: lines.slice(1).some((l) => l.trim()),
    unpushedCount,
    noCommits,
  };
}

async function gitCall(ch, args = {}) {
  return window.electronAPI?.invoke?.(ch, { workingDir: _workingDir, ...args });
}

function showToast(msg, err = false) {
  const text = String(msg || '').trim();
  const firstLine = text.split('\n').find((l) => l.trim()) || text;
  const display = firstLine.length > 120 ? firstLine.slice(0, 117) + '\u2026' : firstLine;
  const t = Object.assign(document.createElement('div'), {
    className: `pcb-toast${err ? ' pcb-toast-error' : ''}`,
    textContent: display,
  });
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('pcb-toast-show'));
  setTimeout(() => {
    t.classList.remove('pcb-toast-show');
    setTimeout(() => t.remove(), 300);
  }, 3500);
}

// ── UI lock helpers ───────────────────────────────────────────────────────────
function setGitBusy(busy) {
  _busy = busy;
  const btn = $('pcb-git-action-btn');
  const toggle = $('pcb-git-action-toggle');
  const branchBtn = $('pcb-branch-btn');
  [btn, toggle, branchBtn].forEach((el) => {
    if (!el) return;
    el.disabled = busy;
    el.classList.toggle('is-disabled', busy);
  });
}

function setCommitPopoverBusy(busy, label = '') {
  const confirm = $('pcb-commit-confirm');
  const cancel = $('pcb-commit-cancel');
  const textarea = $('pcb-commit-msg');
  if (confirm) {
    confirm.disabled = busy;
    if (label) confirm.textContent = label;
  }
  if (cancel) cancel.disabled = busy;
  if (textarea) textarea.disabled = busy;
}

function setCommitStatus(text) {
  const el = $('pcb-commit-status');
  if (!el) return;
  if (text) {
    el.textContent = text;
    el.hidden = false;
  } else {
    el.hidden = true;
    el.textContent = '';
  }
}

function updatePrimaryBtn() {
  if (_busy) return;
  const btn = $('pcb-git-action-btn');
  const toggle = $('pcb-git-action-toggle');
  if (!btn) return;

  const enableToggle = (show) => {
    if (!toggle) return;
    toggle.hidden = !show;
    toggle.disabled = !show;
    toggle.classList.toggle('is-disabled', !show);
    btn?.classList.toggle('pcb-solo', !show);
  };

  if (_isDirty) {
    btn.textContent = 'Commit';
    btn.dataset.action = 'commit';
    btn.disabled = false;
    btn.classList.remove('is-disabled');
    enableToggle(true);
  } else if (_unpushedCount > 0) {
    btn.textContent = `Push (${_unpushedCount})`;
    btn.dataset.action = 'push';
    btn.disabled = false;
    btn.classList.remove('is-disabled');
    enableToggle(true);
  } else {
    btn.textContent = 'Pull';
    btn.dataset.action = 'pull';
    btn.disabled = false;
    btn.classList.remove('is-disabled');
    enableToggle(false);
  }
}

function applyStatusDot(branch, dirty) {
  const d = $('pcb-status-dot');
  if (!d) return;
  d.classList.toggle('is-dirty', dirty);
  d.classList.toggle('is-clean', !dirty && !!branch);
}

async function refreshStatus() {
  if (!_workingDir || _busy) return;
  const res = await gitCall('git-status');
  if (!res?.ok) return;
  const { branch, dirty, unpushedCount, noCommits } = parseGitStatus(res.stdout);
  if (branch) {
    _currentBranch = branch;
    const l = $('pcb-branch-label');
    if (l) l.textContent = branch;
  }
  _isDirty = dirty;
  _unpushedCount = unpushedCount;
  _hasNoCommits = noCommits;
  _cachedBranches = null;
  applyStatusDot(_currentBranch, dirty);
  updatePrimaryBtn();
  buildActionMenu();
}

function buildActionMenu() {
  const d = $('pcb-action-dropdown');
  if (!d) return;

  let opts;
  if (_isDirty) {
    opts = [
      {
        action: 'commit-push',
        label: 'Commit & Push',
        meta: 'Stage, commit, then push',
        enabled: true,
      },
    ];
  } else if (_unpushedCount > 0) {
    opts = [{ action: 'push-sync', label: 'Push & Sync', meta: 'Pull then push', enabled: true }];
  } else {
    opts = [{ action: 'pull', label: 'Pull', meta: 'Pull from remote', enabled: true }];
  }

  d.innerHTML = opts
    .map(
      ({ action, label, meta, enabled }) =>
        `<button class="pcb-dropdown-item${!enabled ? ' is-muted' : ''}" data-action="${action}" type="button"${!enabled ? ' disabled' : ''}>
          <span class="pcb-dropdown-item-label">${label}</span>
          <span class="pcb-dropdown-item-meta">${meta}</span>
        </button>`,
    )
    .join('');
}

function closeDropdowns() {
  const b = $('pcb-branch-dropdown'),
    a = $('pcb-action-dropdown');
  if (b) b.hidden = true;
  if (a) a.hidden = true;
}

function openBranchDropdown() {
  const d = $('pcb-branch-dropdown');
  if (!d) return;
  if (!d.hidden) {
    d.hidden = true;
    return;
  }

  if (_cachedBranches) {
    renderBranchList(d, _cachedBranches);
    d.hidden = false;
    return;
  }

  d.innerHTML = '<div class="pcb-dropdown-loading">Loading branches\u2026</div>';
  d.hidden = false;

  gitCall('git-branches').then((res) => {
    if (d.hidden) return;
    _cachedBranches = res?.branches || [];
    renderBranchList(d, _cachedBranches);
  });
}

const _trashSvg =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';

function renderBranchList(d, branches) {
  const branchItems = branches.length
    ? branches
        .map(
          (b) =>
            `<div class="pcb-branch-row">
              <button class="pcb-dropdown-item${b === _currentBranch ? ' is-active' : ''}" data-branch="${b}" type="button">
                <span class="pcb-branch-check">${b === _currentBranch ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="11" height="11"><polyline points="20 6 9 17 4 12"/></svg>' : ''}</span>
                <span class="pcb-branch-name">${b}</span>
              </button>
              ${b !== _currentBranch ? `<button class="pcb-branch-delete-btn" data-delete-branch="${b}" type="button" title="Delete branch &quot;${b}&quot;">${_trashSvg}</button>` : ''}
            </div>`,
        )
        .join('')
    : '<div class="pcb-dropdown-empty">No branches found</div>';

  d.innerHTML = `
    <div class="pcb-branch-list">${branchItems}</div>
    <div class="pcb-dropdown-divider"></div>
    <div class="pcb-new-branch-row">
      <input id="pcb-new-branch-input" class="pcb-new-branch-input" placeholder="new-branch-name" type="text" spellcheck="false" autocomplete="off" />
      <button id="pcb-new-branch-btn" class="pcb-new-branch-confirm" type="button">Create</button>
    </div>
  `;

  const input = document.getElementById('pcb-new-branch-input');
  const createBtn = document.getElementById('pcb-new-branch-btn');

  const doCreate = async () => {
    const name = input?.value.trim().replace(/\s+/g, '-');
    if (!name) {
      input?.focus();
      return;
    }
    createBtn.disabled = true;
    createBtn.textContent = '\u2026';
    const r = await gitCall('git-create-branch', { branchName: name, checkout: true });
    if (r?.ok) {
      _cachedBranches = null;
      showToast(`Switched to "${name}"`);
      d.hidden = true;
      await refreshStatus();
    } else {
      showToast(r?.hint || r?.stderr || 'Failed to create branch', true);
      createBtn.disabled = false;
      createBtn.textContent = 'Create';
    }
  };

  createBtn?.addEventListener('click', doCreate);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doCreate();
    e.stopPropagation();
  });
  input?.addEventListener('click', (e) => e.stopPropagation());
}

async function executeAction(action) {
  if (_busy) return;
  if (action === 'commit' || action === 'commit-push') {
    openCommitPopover(action);
    return;
  }

  setGitBusy(true);
  const btn = $('pcb-git-action-btn');
  const originalLabel = btn?.textContent;
  if (btn) btn.textContent = '\u2026';

  try {
    if (action === 'pull') {
      const res = await gitCall('git-pull');
      res?.ok
        ? showToast('Pulled successfully')
        : showToast(res?.hint || res?.stderr || 'Pull failed', true);
    } else if (action === 'push-sync') {
      const res = await gitCall('git-push-sync');
      res?.ok
        ? showToast('Synced successfully')
        : showToast(res?.hint || res?.stderr || 'Sync failed', true);
    } else {
      const res = await gitCall('git-push');
      res?.ok
        ? showToast('Pushed successfully')
        : showToast(res?.hint || res?.stderr || 'Push failed', true);
    }
  } finally {
    setGitBusy(false);
    if (btn && originalLabel) btn.textContent = originalLabel;
    await refreshStatus();
  }
}

function openCommitPopover(action) {
  _pendingAction = action;
  const p = $('pcb-commit-popover');
  if (!p) return;
  p.hidden = false;
  $('pcb-commit-msg')?.focus();
  const c = $('pcb-commit-confirm');
  if (c) c.textContent = action === 'commit-push' ? 'Commit & Push' : 'Commit';
}

function closeCommitPopover() {
  const p = $('pcb-commit-popover');
  if (p) p.hidden = true;
  const m = $('pcb-commit-msg');
  if (m) {
    m.value = '';
    m.disabled = false;
  }
  _setAiGenerating(false);
  setCommitStatus('');
  _pendingAction = null;
}

async function performCommit() {
  if (_busy) return;
  const msg = $('pcb-commit-msg')?.value.trim();
  if (!msg) {
    $('pcb-commit-msg')?.focus();
    return;
  }

  const isPushAfter = _pendingAction === 'commit-push';
  setGitBusy(true);
  setCommitPopoverBusy(true, isPushAfter ? 'Commit & Push' : 'Commit');
  setCommitStatus('Staging files\u2026');

  const hooksTimer = setTimeout(
    () => setCommitStatus('Running commit hooks\u2026 (may take a while)'),
    2500,
  );

  try {
    const commitRes = await gitCall('git-commit', { message: msg });
    clearTimeout(hooksTimer);

    if (!commitRes?.ok) {
      setCommitStatus('');
      showToast(commitRes?.hint || commitRes?.stderr || 'Commit failed', true);
      return;
    }

    if (isPushAfter) {
      setCommitStatus('Pushing\u2026');
      setCommitPopoverBusy(true, 'Pushing\u2026');
      const pushRes = await gitCall('git-push');
      if (pushRes?.ok) {
        showToast('Committed & pushed successfully');
      } else {
        showToast(
          'Committed. Push failed: ' + (pushRes?.hint || pushRes?.stderr || 'unknown error'),
          true,
        );
      }
    } else {
      showToast(
        commitRes?.noop
          ? 'Nothing to commit \u2014 tree is already clean.'
          : 'Committed successfully',
      );
    }

    closeCommitPopover();
  } finally {
    clearTimeout(hooksTimer);
    setGitBusy(false);
    setCommitStatus('');
    setCommitPopoverBusy(false, isPushAfter ? 'Commit & Push' : 'Commit');
    await refreshStatus();
  }
}

// ── AI commit message generation ──────────────────────────────────────────────

/** Toggle the shimmer animation + locked state on the textarea wrap. */
function _setAiGenerating(on) {
  const wrap = $('pcb-commit-msg')?.closest('.pcb-commit-textarea-wrap');
  if (wrap) wrap.classList.toggle('pcb-commit-generating', on);

  const aiBtn = $('pcb-ai-commit-btn');
  if (aiBtn) {
    aiBtn.disabled = on;
    aiBtn.classList.toggle('pcb-ai-commit-btn--loading', on);
  }

  // Disable Commit and Cancel while the AI is writing
  const confirm = $('pcb-commit-confirm');
  const cancel = $('pcb-commit-cancel');
  if (confirm) confirm.disabled = on;
  if (cancel) cancel.disabled = on;

  const textarea = $('pcb-commit-msg');
  if (textarea) textarea.disabled = on;
}

/** Write text into the textarea one character at a time (typewriter effect). */
async function _typeIntoTextarea(textarea, text, charDelayMs = 14) {
  textarea.value = '';
  for (let i = 0; i < text.length; i++) {
    if (!document.contains(textarea)) return; // bail if popover was closed
    textarea.value = text.slice(0, i + 1);
    await new Promise((r) => setTimeout(r, charDelayMs));
  }
}

async function generateAICommitMessage() {
  if (_busy) return;

  if (!state.selectedProvider || !state.selectedModel) {
    showToast('Select an AI model first', true);
    return;
  }

  // Start shimmer immediately — feels instant
  _setAiGenerating(true);

  try {
    // The existing 'git-diff' handler in TerminalIPC accepts { workingDir, staged }
    // and returns { ok, stdout, ... }. We fetch both staged + unstaged in parallel
    // to give the AI the full picture of all pending changes.
    const [unstagedRes, stagedRes] = await Promise.all([
      gitCall('git-diff', { staged: false }),
      gitCall('git-diff', { staged: true }),
    ]);

    const combined = [stagedRes?.stdout, unstagedRes?.stdout]
      .map((s) => (s || '').trim())
      .filter(Boolean)
      .join('\n');

    if (!combined) {
      showToast('No changes found to summarise', true);
      return;
    }

    // Cap at 8 000 chars so we never blow the model's context window
    const diff =
      combined.length > 8000
        ? combined.slice(0, 8000) + '\n\n…(diff truncated for length)'
        : combined;

    const result = await fetchWithTools(
      state.selectedProvider,
      state.selectedModel,
      [{ role: 'user', content: `Git diff:\n\n${diff}`, attachments: [] }],
      [
        'You are a commit message generator.',
        'Read the provided git diff and write a concise, imperative-mood commit message.',
        'Use conventional-commit prefixes (feat:, fix:, refactor:, chore:, docs:, style:, test:, perf:) when they fit naturally.',
        'The first line must be a short summary under 72 characters.',
        'If extra context is useful, add a blank line then a short body (2–4 lines max).',
        'Return ONLY the raw commit message text — no markdown, no quotes, no explanation.',
      ].join(' '),
      [],
    );

    const textarea = $('pcb-commit-msg');
    if (!textarea) return;

    if (result.type === 'text' && result.text && result.text !== '(empty response)') {
      // Typewriter reveal while the shimmer is still running
      await _typeIntoTextarea(textarea, result.text.trim());
    } else {
      showToast('AI returned an empty response', true);
    }
  } catch (err) {
    showToast('AI generation failed: ' + (err?.message ?? String(err)), true);
  } finally {
    _setAiGenerating(false);
    $('pcb-commit-msg')?.focus();
  }
}

// ── Confirm popover (branch delete) ──────────────────────────────────────────

function showConfirm(message, okLabel, onConfirm) {
  _confirmCallback = onConfirm;
  let p = $('pcb-confirm-popover');
  if (!p) {
    p = document.createElement('div');
    p.id = 'pcb-confirm-popover';
    p.className = 'pcb-commit-popover';
    p.innerHTML = `
      <p id="pcb-confirm-message" class="pcb-confirm-message"></p>
      <div class="pcb-commit-footer">
        <button id="pcb-confirm-cancel" class="project-secondary-btn" type="button">Cancel</button>
        <button id="pcb-confirm-ok" class="project-primary-btn pcb-confirm-danger" type="button"></button>
      </div>`;
    const gitRow = $('pcb-git-row');
    gitRow?.parentNode?.insertBefore(p, gitRow.nextSibling);
    $('pcb-confirm-cancel')?.addEventListener('click', closeConfirm);
    $('pcb-confirm-ok')?.addEventListener('click', () => {
      const cb = _confirmCallback;
      closeConfirm();
      cb?.();
    });
  }
  $('pcb-confirm-message').textContent = message;
  $('pcb-confirm-ok').textContent = okLabel;
  p.hidden = false;
}

function closeConfirm() {
  const p = $('pcb-confirm-popover');
  if (p) p.hidden = true;
  _confirmCallback = null;
}

function onDocClick(e) {
  const bd = $('pcb-branch-dropdown'),
    ad = $('pcb-action-dropdown');
  if (bd && !bd.hidden && !$('pcb-branch-btn')?.contains(e.target) && !bd.contains(e.target))
    bd.hidden = true;
  if (ad && !ad.hidden && !$('pcb-git-action-toggle')?.contains(e.target) && !ad.contains(e.target))
    ad.hidden = true;
}

export function createGitBar() {
  async function init(workingDir) {
    _workingDir = workingDir;
    if (!workingDir) {
      const r = $('pcb-git-row');
      if (r) r.hidden = true;
      return;
    }
    const res = await gitCall('git-status');
    const gitRow = $('pcb-git-row');
    if (!res?.ok || res.exitCode !== 0 || res.stderr?.includes('not a git')) {
      if (gitRow) gitRow.hidden = true;
      return;
    }
    if (gitRow) gitRow.hidden = false;

    const { branch, dirty, unpushedCount, noCommits } = parseGitStatus(res.stdout);
    _currentBranch = branch;
    _isDirty = dirty;
    _unpushedCount = unpushedCount;
    _hasNoCommits = noCommits;

    const l = $('pcb-branch-label');
    if (l) l.textContent = branch || 'main';
    applyStatusDot(branch, dirty);
    updatePrimaryBtn();
    buildActionMenu();
    _pollTimer = setInterval(refreshStatus, POLL_MS);

    $('pcb-branch-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (_busy) return;
      const a = $('pcb-action-dropdown');
      if (a) a.hidden = true;
      openBranchDropdown();
    });

    $('pcb-branch-dropdown')?.addEventListener('click', async (e) => {
      const del = e.target.closest('[data-delete-branch]');
      if (del) {
        e.stopPropagation();
        const branchToDelete = del.dataset.deleteBranch;
        $('pcb-branch-dropdown').hidden = true;
        showConfirm(
          `Delete branch "${branchToDelete}"? This cannot be undone.`,
          'Delete',
          async () => {
            const r = await gitCall('git-delete-branch', { branch: branchToDelete });
            if (r?.ok) {
              _cachedBranches = null;
              showToast(`Deleted "${branchToDelete}"`);
              await refreshStatus();
            } else {
              showToast(r?.hint || r?.stderr || 'Delete failed', true);
            }
          },
        );
        return;
      }
      const b = e.target.closest('[data-branch]');
      if (b) {
        $('pcb-branch-dropdown').hidden = true;
        _cachedBranches = null;
        const r = await gitCall('git-checkout-branch', { branch: b.dataset.branch });
        r?.ok
          ? showToast(`Switched to ${b.dataset.branch}`)
          : showToast(r?.hint || r?.stderr || 'Checkout failed', true);
        await refreshStatus();
      }
    });

    $('pcb-git-action-btn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (e.currentTarget.disabled || _busy) return;
      closeDropdowns();
      await executeAction(e.currentTarget.dataset.action || 'push');
    });

    $('pcb-git-action-toggle')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.currentTarget.disabled || _busy) return;
      const b = $('pcb-branch-dropdown');
      if (b) b.hidden = true;
      buildActionMenu();
      const a = $('pcb-action-dropdown');
      if (a) a.hidden = !a.hidden;
    });

    $('pcb-action-dropdown')?.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-action]:not([disabled])');
      if (b) {
        $('pcb-action-dropdown').hidden = true;
        await executeAction(b.dataset.action);
      }
    });

    $('pcb-commit-cancel')?.addEventListener('click', () => {
      if (_busy) return;
      closeCommitPopover();
    });
    $('pcb-commit-confirm')?.addEventListener('click', performCommit);
    $('pcb-commit-msg')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) performCommit();
    });

    // ── AI commit message button ──────────────────────────────────────────────
    $('pcb-ai-commit-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      generateAICommitMessage();
    });

    document.addEventListener('click', (e) => {
      onDocClick(e);
      const cp = $('pcb-confirm-popover');
      if (cp && !cp.hidden && !cp.contains(e.target)) closeConfirm();
    });
  }

  function updateWorkingDir(workingDir) {
    if (_pollTimer) {
      clearInterval(_pollTimer);
      _pollTimer = null;
    }
    _cachedBranches = null;
    _busy = false;
    closeCommitPopover();
    closeDropdowns();
    init(workingDir);
  }

  function cleanup() {
    if (_pollTimer) {
      clearInterval(_pollTimer);
      _pollTimer = null;
    }
    document.removeEventListener('click', onDocClick);
    closeCommitPopover();
    closeConfirm();
    _cachedBranches = null;
    _busy = false;
    _workingDir = null;
  }

  return { init, updateWorkingDir, cleanup };
}
