let _workingDir = null,
  _pollTimer = null,
  _isDirty = false,
  _currentBranch = '',
  _unpushedCount = -1,
  _hasNoCommits = false,
  _pendingAction = null,
  _cachedBranches = null; // ← cache branches to avoid re-fetching every click

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
  const display = firstLine.length > 120 ? firstLine.slice(0, 117) + '…' : firstLine;
  const t = Object.assign(document.createElement('div'), {
    className: `pcb-toast${err ? ' pcb-toast-error' : ''}`,
    textContent: display,
  });
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('pcb-toast-show'));
  setTimeout(() => {
    t.classList.remove('pcb-toast-show');
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

function updatePrimaryBtn() {
  const btn = $('pcb-git-action-btn');
  const toggle = $('pcb-git-action-toggle');
  if (!btn) return;

  const canCommit = _isDirty;
  const canPush = _unpushedCount !== 0;

  if (canCommit) {
    btn.textContent = 'Commit';
    btn.dataset.action = 'commit';
    btn.disabled = false;
    btn.classList.remove('is-disabled');
    if (toggle) {
      toggle.disabled = false;
      toggle.classList.remove('is-disabled');
      toggle.title = 'More actions';
    }
  } else {
    btn.textContent = 'Push';
    btn.dataset.action = 'push';
    if (canPush) {
      btn.disabled = false;
      btn.classList.remove('is-disabled');
      if (toggle) {
        toggle.disabled = false;
        toggle.classList.remove('is-disabled');
        toggle.title = 'More actions';
      }
    } else {
      btn.disabled = true;
      btn.classList.add('is-disabled');
      if (toggle) {
        toggle.disabled = true;
        toggle.classList.add('is-disabled');
        toggle.title = 'Nothing to push';
      }
    }
  }
}

function applyStatusDot(branch, dirty) {
  const d = $('pcb-status-dot');
  if (!d) return;
  d.classList.toggle('is-dirty', dirty);
  d.classList.toggle('is-clean', !dirty && !!branch);
}

async function refreshStatus() {
  if (!_workingDir) return;
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
  // Invalidate branch cache on status refresh so next open re-fetches
  _cachedBranches = null;
  applyStatusDot(_currentBranch, dirty);
  updatePrimaryBtn();
  buildActionMenu();
}

function buildActionMenu() {
  const d = $('pcb-action-dropdown');
  if (!d) return;

  const canCommit = _isDirty;
  const canPush = _unpushedCount !== 0;

  const opts = canCommit
    ? [
        { action: 'commit', label: 'Commit changes', meta: 'Stage & commit', enabled: true },
        { action: 'commit-push', label: 'Commit & Push', meta: 'Commit then push', enabled: true },
        { action: 'push', label: 'Push', meta: 'Push to remote', enabled: canPush },
        { action: 'push-sync', label: 'Push & Sync', meta: 'Pull then push', enabled: canPush },
      ]
    : [
        { action: 'push', label: 'Push', meta: 'Push to remote', enabled: canPush },
        { action: 'push-sync', label: 'Push & Sync', meta: 'Pull then push', enabled: canPush },
      ];

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

// FIX 1: Use cached branches; only hit git-branches IPC when cache is cold
function openBranchDropdown() {
  const d = $('pcb-branch-dropdown');
  if (!d) return;
  if (!d.hidden) {
    d.hidden = true;
    return;
  }

  // If we have a warm cache, render immediately — no loading flash
  if (_cachedBranches) {
    renderBranchList(d, _cachedBranches);
    d.hidden = false;
    return;
  }

  d.innerHTML = '<div class="pcb-dropdown-loading">Loading branches…</div>';
  d.hidden = false;

  gitCall('git-branches').then((res) => {
    if (d.hidden) return;
    _cachedBranches = res?.branches || [];
    renderBranchList(d, _cachedBranches);
  });
}

function renderBranchList(d, branches) {
  const branchItems = branches.length
    ? branches
        .map(
          (b) =>
            `<button class="pcb-dropdown-item${b === _currentBranch ? ' is-active' : ''}" data-branch="${b}" type="button">
              <span class="pcb-branch-check">${b === _currentBranch ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="11" height="11"><polyline points="20 6 9 17 4 12"/></svg>' : ''}</span>
              <span class="pcb-branch-name">${b}</span>
            </button>`,
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
    createBtn.textContent = '…';
    const r = await gitCall('git-create-branch', { branchName: name, checkout: true });
    if (r?.ok) {
      _cachedBranches = null; // invalidate so next open re-fetches with new branch
      showToast(`Switched to "${name}"`);
      d.hidden = true;
      await refreshStatus();
    } else {
      showToast(r?.stderr || 'Failed to create branch', true);
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
  if (action === 'commit' || action === 'commit-push') {
    openCommitPopover(action);
    return;
  }
  const res = await (action === 'push-sync' ? gitCall('git-push-sync') : gitCall('git-push'));
  res?.ok
    ? showToast(action === 'push-sync' ? 'Synced successfully' : 'Pushed successfully')
    : showToast(res?.stderr || 'Failed', true);
  await refreshStatus();
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
  if (m) m.value = '';
  _pendingAction = null;
}

async function performCommit() {
  const msg = $('pcb-commit-msg')?.value.trim();
  if (!msg) {
    $('pcb-commit-msg')?.focus();
    return;
  }
  const res = await gitCall('git-commit', { message: msg });
  if (!res?.ok) {
    showToast(res?.stderr || 'Commit failed', true);
    return;
  }
  showToast('Committed successfully');
  if (_pendingAction === 'commit-push') {
    const pr = await gitCall('git-push');
    pr?.ok ? showToast('Pushed successfully') : showToast(pr?.stderr || 'Push failed', true);
  }
  closeCommitPopover();
  await refreshStatus();
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
      const a = $('pcb-action-dropdown');
      if (a) a.hidden = true;
      openBranchDropdown();
    });

    $('pcb-branch-dropdown')?.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-branch]');
      if (b) {
        $('pcb-branch-dropdown').hidden = true;
        _cachedBranches = null; // invalidate after checkout
        const r = await gitCall('git-checkout-branch', { branch: b.dataset.branch });
        r?.ok
          ? showToast(`Switched to ${b.dataset.branch}`)
          : showToast(r?.stderr || 'Checkout failed', true);
        await refreshStatus();
      }
    });

    $('pcb-git-action-btn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (e.currentTarget.disabled) return;
      closeDropdowns();
      await executeAction(e.currentTarget.dataset.action || 'push');
    });

    $('pcb-git-action-toggle')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.currentTarget.disabled) return;
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

    $('pcb-commit-cancel')?.addEventListener('click', closeCommitPopover);
    $('pcb-commit-confirm')?.addEventListener('click', performCommit);
    $('pcb-commit-msg')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) performCommit();
    });
    document.addEventListener('click', onDocClick);
  }

  function updateWorkingDir(workingDir) {
    if (_pollTimer) {
      clearInterval(_pollTimer);
      _pollTimer = null;
    }
    _cachedBranches = null; // clear cache on project switch
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
    _cachedBranches = null;
    _workingDir = null;
  }

  return { init, updateWorkingDir, cleanup };
}
