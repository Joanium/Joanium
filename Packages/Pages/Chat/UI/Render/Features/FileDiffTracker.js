import { state } from '../../../../../System/State.js';

// ─── Diff engine ────────────────────────────────────────────────────────────

const MAX_DIFF_LINES = 400; // above this cap, skip LCS and show stats only
const CONTEXT = 2; // unchanged lines shown around each hunk

/**
 * Compute a line-level unified diff between two strings.
 * Returns { ops, added, removed, tooLarge }.
 * ops: array of { t: 'eq'|'add'|'rem', l: string }
 */
function computeDiff(before, after) {
  const a = before ? before.split('\n') : [];
  const b = after ? after.split('\n') : [];

  if (a.length > MAX_DIFF_LINES || b.length > MAX_DIFF_LINES) {
    // Fast approximation for large files
    const aSet = new Set(a);
    const bSet = new Set(b);
    return {
      ops: null,
      added: b.filter((l) => !aSet.has(l)).length,
      removed: a.filter((l) => !bSet.has(l)).length,
      tooLarge: true,
    };
  }

  // LCS via dynamic programming
  const m = a.length,
    n = b.length;
  const dp = new Array(m + 1);
  for (let i = 0; i <= m; i++) dp[i] = new Int32Array(n + 1);
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Back-trace
  const ops = [];
  let i = m,
    j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.push({ t: 'eq', l: a[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ t: 'add', l: b[j - 1] });
      j--;
    } else {
      ops.push({ t: 'rem', l: a[i - 1] });
      i--;
    }
  }
  ops.reverse();

  return {
    ops,
    added: ops.filter((o) => o.t === 'add').length,
    removed: ops.filter((o) => o.t === 'rem').length,
    tooLarge: false,
  };
}

/** Convert diff ops into HTML rows with context-based hunk grouping. */
function buildDiffHTML(ops) {
  if (!ops || ops.length === 0) return '';

  // Collect indices of changed lines, then expand by CONTEXT
  const show = new Uint8Array(ops.length);
  for (let i = 0; i < ops.length; i++) {
    if (ops[i].t !== 'eq') {
      const lo = Math.max(0, i - CONTEXT);
      const hi = Math.min(ops.length - 1, i + CONTEXT);
      for (let k = lo; k <= hi; k++) show[k] = 1;
    }
  }

  let html = '';
  let lastShown = -2;

  for (let i = 0; i < ops.length; i++) {
    if (!show[i]) continue;
    if (lastShown !== -2 && i > lastShown + 1) {
      html += '<div class="fdp-hunk-sep">&#8943;</div>';
    }
    const { t, l } = ops[i];
    const cls = t === 'add' ? 'fdp-line--add' : t === 'rem' ? 'fdp-line--rem' : 'fdp-line--eq';
    const prefix = t === 'add' ? '+' : t === 'rem' ? '-' : '\u00a0';
    const text = (l || ' ').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html += `<div class="fdp-line ${cls}"><span class="fdp-prefix">${prefix}</span><span class="fdp-text">${text}</span></div>`;
    lastShown = i;
  }

  return html;
}

// ─── Tracker ─────────────────────────────────────────────────────────────────

export function createFileDiffTracker() {
  /** @type {Map<string, { before: string, after: string, diff: object }>} */
  const changes = new Map();
  /** Track file paths that have already been rendered at least once (no re-stagger) */
  const renderedPaths = new Set();
  let panelEl = null;

  function getPanel() {
    if (!panelEl || !document.contains(panelEl)) {
      panelEl = document.getElementById('file-diff-panel');
    }
    return panelEl;
  }

  // ── Event handler ──────────────────────────────────────────────────────────

  function onFileChanged(e) {
    if (!state.workspacePath && !state.activeProject) return; // panel is project-only
    const { filePath, before, after } = e.detail ?? {};
    if (!filePath) return;

    // Preserve original `before` across multiple writes to the same file
    const existing = changes.get(filePath);
    const originalBefore = existing ? existing.before : (before ?? '');
    const isNew = existing ? existing.isNew : originalBefore === '';
    const diff = computeDiff(originalBefore, after ?? '');
    changes.set(filePath, { before: originalBefore, after: after ?? '', diff, isNew });
    render();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  function render() {
    const panel = getPanel();
    if (!panel) return;

    if (changes.size === 0 || (!state.workspacePath && !state.activeProject)) {
      panel.hidden = true;
      return;
    }

    panel.hidden = false;
    const workspaceRoot = (state.workspacePath ?? state.activeProject?.rootPath ?? '')
      .replace(/\\/g, '/')
      .replace(/\/$/, '');

    const cardHTMLs = Array.from(changes.entries()).map(([filePath, { diff, isNew }], idx) => {
      // Relative path display
      let rel = filePath.replace(/\\/g, '/');
      if (workspaceRoot && rel.startsWith(workspaceRoot)) {
        rel = rel.slice(workspaceRoot.length).replace(/^\//, '');
      }
      const slashIdx = rel.lastIndexOf('/');
      const filename = slashIdx >= 0 ? rel.slice(slashIdx + 1) : rel;
      const dirPart = slashIdx >= 0 ? rel.slice(0, slashIdx + 1) : '';
      const safeId = `fdp-dv-${idx}`;
      const diffHTML = diff.ops
        ? buildDiffHTML(diff.ops) || '<div class="fdp-large-note">No line changes detected</div>'
        : `<div class="fdp-large-note">File is large \u2014 showing summary only</div>`;

      const escapedPath = filePath.replace(/"/g, '&quot;').replace(/</g, '&lt;');

      const isFirstRender = !renderedPaths.has(filePath);
      renderedPaths.add(filePath);

      return `
        <div class="fdp-card${isFirstRender ? ' fdp-card--entering' : ''}">
          <button class="fdp-card-hd" data-dv="${safeId}" aria-expanded="false" title="${escapedPath}">
            <svg class="fdp-file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <span class="fdp-filename">${filename}</span>
            ${dirPart ? `<span class="fdp-dirpath">${dirPart}</span>` : ''}
            <span class="fdp-stats">
              ${isNew ? '<span class="fdp-tag-new">new</span>' : ''}
              ${diff.added > 0 ? `<span class="fdp-added">+${diff.added}</span>` : ''}
              ${diff.removed > 0 ? `<span class="fdp-removed">-${diff.removed}</span>` : ''}
            </span>
            <svg class="fdp-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
          <div class="fdp-diff-view" id="${safeId}" hidden>
            ${diffHTML}
          </div>
        </div>`;
    });

    panel.innerHTML = `
      <div class="fdp-header">
        <span class="fdp-label">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="12" height="12">
            <path d="M9 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7"/>
            <path d="M9 2l4 4"/>
            <path d="M9 2v4h4"/>
          </svg>
          ${changes.size} file${changes.size !== 1 ? 's' : ''} changed this session
        </span>
        <button class="fdp-dismiss" id="fdp-dismiss" aria-label="Dismiss">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="11" height="11">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6"  y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="fdp-scroll" id="fdp-scroll">
        ${cardHTMLs.join('')}
      </div>`;

    // Wire card expand/collapse
    panel.querySelectorAll('.fdp-card-hd').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dv = document.getElementById(btn.dataset.dv);
        if (!dv) return;
        const open = dv.hidden;
        dv.hidden = !open;
        btn.setAttribute('aria-expanded', String(open));
        btn.closest('.fdp-card').classList.toggle('fdp-card--open', open);
      });
    });

    // Wire dismiss
    document.getElementById('fdp-dismiss')?.addEventListener('click', () => reset());
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  function reset() {
    changes.clear();
    renderedPaths.clear();
    const panel = getPanel();
    if (panel) {
      panel.hidden = true;
      panel.innerHTML = '';
    }
  }

  function init() {
    window.addEventListener('jo:file-changed', onFileChanged);
  }

  function destroy() {
    window.removeEventListener('jo:file-changed', onFileChanged);
    reset();
    panelEl = null;
  }

  return { init, reset, destroy };
}
