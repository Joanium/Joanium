// ─────────────────────────────────────────────
//  Romelson — Public/Assets/Scripts/Pages/Agents.js
// ─────────────────────────────────────────────

import '../Shared/WindowControls.js';
import { initSidebar } from '../Shared/Sidebar.js';
import { initAboutModal } from '../Shared/Modals/AboutModal.js';
import { initLibraryModal } from '../Shared/Modals/LibraryModal.js';
import { initSettingsModal } from '../Shared/Modals/SettingsModal.js';

const about = initAboutModal();
const settings = initSettingsModal();
const library = initLibraryModal({
  onChatSelect: chatId => {
    if (chatId) localStorage.setItem('ow-pending-chat', chatId);
    window.electronAPI?.launchMain();
  },
});
const sidebar = initSidebar({
  activePage: 'agents',
  onNewChat: () => window.electronAPI?.launchMain(),
  onLibrary: () => library.isOpen() ? library.close() : library.open(),
  onAutomations: () => window.electronAPI?.launchAutomations?.(),
  onSkills: () => window.electronAPI?.launchSkills?.(),
  onPersonas: () => window.electronAPI?.launchPersonas?.(),
  onAgents: () => { },
  onEvents: () => window.electronAPI?.launchEvents?.(),
  onUsage: () => window.electronAPI?.launchUsage?.(),
  onSettings: () => settings.open(),
  onAbout: () => about.open(),
});

window.addEventListener('ow:user-profile-updated', e => sidebar.setUser(e.detail?.name ?? ''));
settings.loadUser().then(user => sidebar.setUser(user?.name ?? ''));

/* ══════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════ */
const MAX_JOBS = 5;

const DATA_SOURCE_TYPES = [
  { value: 'gmail_inbox', label: '📧 Gmail — Unread inbox', group: 'Email' },
  { value: 'gmail_search', label: '📧 Gmail — Search emails', group: 'Email' },
  { value: 'github_notifications', label: '🐙 GitHub — Notifications', group: 'GitHub' },
  { value: 'github_repos', label: '🐙 GitHub — All my repos', group: 'GitHub' },
  { value: 'github_prs', label: '🐙 GitHub — Pull requests', group: 'GitHub' },
  { value: 'github_issues', label: '🐙 GitHub — Issues', group: 'GitHub' },
  { value: 'github_commits', label: '🐙 GitHub — Recent commits', group: 'GitHub' },
  { value: 'rss_feed', label: '📡 RSS / Atom Feed', group: 'Web & Feeds' },
  { value: 'reddit_posts', label: '🔴 Reddit — Subreddit posts', group: 'Web & Feeds' },
  { value: 'hacker_news', label: '🔶 Hacker News — Top stories', group: 'Web & Feeds' },
  { value: 'fetch_url', label: '🌐 Fetch URL — Any web page', group: 'Web & Feeds' },
  { value: 'weather', label: '🌤️ Weather — Current conditions', group: 'System & Data' },
  { value: 'crypto_price', label: '🪙 Crypto — Live prices', group: 'System & Data' },
  { value: 'system_stats', label: '🖥️ System Stats — CPU / Memory', group: 'System & Data' },
  { value: 'read_file', label: '📄 Read File — Local file', group: 'System & Data' },
  { value: 'custom_context', label: '✍️ Custom — Provide context directly', group: 'Other' },
];

const OUTPUT_TYPES = [
  { value: 'send_email', label: '📧 Send email via Gmail', group: 'Messaging' },
  { value: 'send_notification', label: '🔔 Desktop notification', group: 'Messaging' },
  { value: 'write_file', label: '📝 Write to a file', group: 'Files' },
  { value: 'append_to_memory', label: '🧠 Append to AI Memory', group: 'AI' },
  { value: 'http_webhook', label: '🌐 HTTP webhook / POST', group: 'Webhooks' },
];

const INSTRUCTION_TEMPLATES = {
  gmail_inbox: 'Read these emails. Identify the most important ones needing action today. For each: subject, sender, what action is needed, and urgency. Then briefly list FYI emails.',
  gmail_search: 'Analyze these matching emails. Summarize findings, highlight patterns and urgent items.',
  github_notifications: 'Review these GitHub notifications. Group by type (PR reviews needed, mentions, issues). List immediate action items first.',
  github_repos: 'Review my repositories. Identify any that have open PRs, recent issues, or activity needing attention. Summarize what needs my focus.',
  github_prs: 'Analyze these pull requests. For each: what it does, readiness to merge, concerns, who needs to act.',
  github_issues: 'Review these issues. Categorize by priority. Identify blocked, needs-clarification, or closeable items.',
  github_commits: 'Analyze recent commits. Summarize what changed and flag any risky or large changes.',
  rss_feed: 'Read these feed articles. Identify the most relevant and interesting items. Summarize key developments.',
  reddit_posts: 'Review these posts. Identify trending topics, significant discussions, and anything worth knowing.',
  hacker_news: 'Summarize the most relevant stories. Focus on AI, engineering, and startup news. Give a brief insight for each.',
  fetch_url: 'Read and analyze this content. Extract key information and anything actionable.',
  weather: 'Based on current weather, provide a practical briefing: what to wear, any warnings, how it affects outdoor plans.',
  crypto_price: 'Analyze these prices and 24h changes. Flag significant moves (>5%), note any trends.',
  system_stats: 'Analyze these system stats. Flag any concerning resource usage. Provide a brief health assessment.',
  read_file: 'Analyze this file content. Summarize key information, patterns, and anything actionable.',
  custom_context: 'Analyze the provided information and give a thoughtful, useful response.',
};

/* ══════════════════════════════════════════
   STATE
══════════════════════════════════════════ */
let _agents = [];
let _allModels = [];
let _editingId = null;
let _deletingId = null;
let _primaryModel = null;
let _fallbackModels = [];
let _jobs = [];

/* ══════════════════════════════════════════
   UTILS
══════════════════════════════════════════ */
const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const genId = () => `agent_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const genJid = () => `job_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

function formatTrigger(t) {
  if (!t) return '?';
  switch (t.type) {
    case 'on_startup': return '⚡ Startup';
    case 'interval': return `⏱ Every ${t.minutes}m`;
    case 'hourly': return '⏰ Hourly';
    case 'daily': return `🌅 Daily ${t.time ?? ''}`;
    case 'weekly': return `📅 ${cap(t.day ?? '')} ${t.time ?? ''}`;
    default: return t.type;
  }
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso);
  const m = 60_000, h = 3_600_000;
  if (diff < m) return 'just now';
  if (diff < h) return Math.floor(diff / m) + 'm ago';
  if (diff < 86_400_000) return Math.floor(diff / h) + 'h ago';
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function fullDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString([], {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function modelLabel(pid, mid) {
  const e = _allModels.find(m => m.providerId === pid && m.modelId === mid);
  return e ? `${e.modelName} (${e.provider})` : mid ?? '';
}

function agentHealth(agent) {
  const all = (agent.jobs ?? []).flatMap(j => j.history ?? []);
  if (!all.length) return 'none';
  const latest = [...all].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
  if (latest.error) return 'error';
  if (latest.nothingToReport || latest.skipped) return 'skipped';
  if (latest.acted) return 'acted';
  return 'none';
}

/* ══════════════════════════════════════════
   LOAD MODELS
══════════════════════════════════════════ */
async function loadModels() {
  try {
    const providers = await window.electronAPI?.getModels?.() ?? [];
    _allModels = [];
    for (const p of providers) {
      if (!p.api?.trim()) continue;
      for (const [modelId, info] of Object.entries(p.models ?? {})) {
        _allModels.push({
          providerId: p.provider,
          provider: p.label ?? p.provider,
          modelId,
          modelName: info.name ?? modelId,
          description: info.description ?? '',
          rank: info.rank ?? 999,
        });
      }
    }
    _allModels.sort((a, b) => a.rank - b.rank);
  } catch (err) {
    console.warn('[Agents] Could not load models:', err);
    _allModels = [];
  }
}

/* ══════════════════════════════════════════
   GRID RENDERING
══════════════════════════════════════════ */
const gridEl = document.getElementById('agents-grid');
const emptyEl = document.getElementById('agents-empty');

function renderGrid() {
  if (!_agents.length) { emptyEl.hidden = false; gridEl.hidden = true; return; }
  emptyEl.hidden = true; gridEl.hidden = false; gridEl.innerHTML = '';

  _agents.forEach(agent => {
    const card = document.createElement('div');
    card.className = `agent-card${agent.enabled ? '' : ' is-disabled'}`;

    const health = agentHealth(agent);
    const healthDot = '';

    const lastRuns = (agent.jobs ?? []).map(j => j.lastRun).filter(Boolean).sort().reverse();
    const lastRun = lastRuns[0] ? timeAgo(lastRuns[0]) : '';

    const jobRows = (agent.jobs ?? []).slice(0, 3).map(job => {
      const latest = (job.history ?? [])[0];
      const dot = '';

      const srcCount = Array.isArray(job.dataSources) && job.dataSources.length
        ? job.dataSources.length : (job.dataSource?.type ? 1 : 0);
      const srcBadge = srcCount > 1
        ? `<span class="agent-job-sources-badge">${srcCount} sources</span>` : '';
      const jobLab = job.name ||
        (DATA_SOURCE_TYPES.find(d => d.value === (job.dataSources?.[0]?.type ?? job.dataSource?.type))?.label ?? 'Job');

      return `
        <div class="agent-job-row">
          <div class="agent-job-dot"></div>
          <span class="agent-job-trigger">${formatTrigger(job.trigger)}</span>
          <span class="agent-job-label">${esc(jobLab)}</span>
          ${srcBadge}${dot}
        </div>`;
    }).join('');

    card.innerHTML = `
      <div class="agent-card-head">
        <div class="agent-avatar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-3.14Z" stroke-linecap="round"/>
            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-3.14Z" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="agent-card-info">
          <div class="agent-name">${healthDot}${esc(agent.name)}</div>
          ${agent.description ? `<div class="agent-desc">${esc(agent.description)}</div>` : ''}
        </div>
        <label class="agent-toggle" title="${agent.enabled ? 'Enabled' : 'Disabled'}">
          <input type="checkbox" class="toggle-input" ${agent.enabled ? 'checked' : ''}>
          <div class="agent-toggle-track"></div>
        </label>
      </div>

      <div class="agent-meta">
        <span class="agent-model-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <path d="M8 21h8M12 17v4" stroke-linecap="round"/>
          </svg>
          ${esc(agent.primaryModel ? modelLabel(agent.primaryModel.provider, agent.primaryModel.modelId) : 'No model')}
        </span>
        <span class="agent-jobs-badge">${(agent.jobs ?? []).length} job${(agent.jobs ?? []).length !== 1 ? 's' : ''}</span>
        ${lastRun ? `<span class="agent-lastrun">${esc(lastRun)}</span>` : ''}
      </div>

      ${jobRows ? `<div class="agent-jobs-summary">${jobRows}</div>` : ''}

      <div class="agent-card-footer">
        <button class="agent-card-btn run-btn"     title="Run all jobs now">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>
        <button class="agent-card-btn history-btn" title="View run history">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 8v4l3 3" stroke-linecap="round"/><circle cx="12" cy="12" r="9"/></svg>
        </button>
        <button class="agent-card-btn edit-btn"    title="Edit agent">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke-linecap="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke-linecap="round"/></svg>
        </button>
        <button class="agent-card-btn danger delete-btn" title="Delete agent">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>`;

    card.querySelector('.toggle-input').addEventListener('change', async e => {
      agent.enabled = e.target.checked;
      card.classList.toggle('is-disabled', !agent.enabled);
      await window.electronAPI?.toggleAgent?.(agent.id, agent.enabled);
    });

    card.querySelector('.run-btn').addEventListener('click', async () => {
      const btn = card.querySelector('.run-btn');
      btn.classList.add('is-running');
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 11-6.219-8.56" stroke-linecap="round"/></svg>`;
      await window.electronAPI?.runAgentNow?.(agent.id);
      const res = await window.electronAPI?.getAgents?.();
      _agents = Array.isArray(res?.agents) ? res.agents : _agents;
      renderGrid();
    });

    card.querySelector('.history-btn').addEventListener('click', async () => {
      const res = await window.electronAPI?.getAgents?.();
      _agents = Array.isArray(res?.agents) ? res.agents : _agents;
      openHistoryModal(_agents.find(a => a.id === agent.id) ?? agent);
    });

    card.querySelector('.edit-btn').addEventListener('click', () => openModal(agent));
    card.querySelector('.delete-btn').addEventListener('click', () => openConfirm(agent.id, agent.name));

    gridEl.appendChild(card);
  });
}

/* ══════════════════════════════════════════
   RESPONSE VIEWER OVERLAY
══════════════════════════════════════════ */
(function injectResponseViewer() {
  if (document.getElementById('agent-response-viewer')) return;
  const el = document.createElement('div');
  el.innerHTML = `
    <div id="agent-response-viewer">
      <div id="agent-response-viewer-box">
        <div class="agent-rv-header">
          <div>
            <div class="agent-rv-eyebrow" id="agent-rv-eyebrow">Run Result</div>
            <div class="agent-rv-meta"    id="agent-rv-meta"></div>
          </div>
          <button class="settings-modal-close" id="agent-rv-close" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>
            </svg>
          </button>
        </div>
        <div class="agent-rv-body" id="agent-rv-body"></div>
      </div>
    </div>`;
  document.body.appendChild(el.firstElementChild);
  document.getElementById('agent-rv-close').addEventListener('click', closeResponseViewer);
  document.getElementById('agent-response-viewer').addEventListener('click', e => {
    if (e.target.id === 'agent-response-viewer') closeResponseViewer();
  });
})();

function openResponseViewer(entry, jobName) {
  document.getElementById('agent-rv-eyebrow').textContent = jobName ?? 'Run Result';
  document.getElementById('agent-rv-meta').textContent = fullDateTime(entry.timestamp);
  document.getElementById('agent-rv-body').textContent = entry.fullResponse || entry.summary || '(no content)';
  document.getElementById('agent-response-viewer').classList.add('open');
}

function closeResponseViewer() {
  document.getElementById('agent-response-viewer')?.classList.remove('open');
}

/* ══════════════════════════════════════════
   HISTORY MODAL
══════════════════════════════════════════ */
(function injectHistoryModal() {
  if (document.getElementById('agent-history-backdrop')) return;
  const el = document.createElement('div');
  el.innerHTML = `
    <div id="agent-history-backdrop">
      <div id="agent-history-modal">
        <div class="agent-history-header">
          <div>
            <div class="agent-modal-eyebrow">Run History</div>
            <h2 id="agent-history-title">Agent</h2>
          </div>
          <button class="settings-modal-close" id="agent-history-close" type="button" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>
            </svg>
          </button>
        </div>
        <div id="agent-history-body" class="agent-history-body"></div>
      </div>
    </div>`;
  document.body.appendChild(el.firstElementChild);
  document.getElementById('agent-history-close').addEventListener('click', closeHistoryModal);
  document.getElementById('agent-history-backdrop').addEventListener('click', e => {
    if (e.target.id === 'agent-history-backdrop') closeHistoryModal();
  });
})();

function openHistoryModal(agent) {
  document.getElementById('agent-history-title').textContent = agent.name;
  const bodyEl = document.getElementById('agent-history-body');
  bodyEl.innerHTML = '';

  const jobs = agent.jobs ?? [];
  let hasAny = false;

  jobs.forEach(job => {
    const history = job.history ?? [];
    if (history.length) hasAny = true;

    const section = document.createElement('div');
    section.className = 'agent-history-job';

    const srcCount = Array.isArray(job.dataSources) && job.dataSources.length
      ? job.dataSources.length : (job.dataSource?.type ? 1 : 0);
    const jobLab = job.name ||
      (DATA_SOURCE_TYPES.find(d => d.value === (job.dataSources?.[0]?.type ?? job.dataSource?.type))?.label ?? 'Job');

    section.innerHTML = `
      <div class="agent-history-job-header">
        <span class="agent-history-job-name">${esc(jobLab)}</span>
        ${srcCount > 1 ? `<span class="agent-history-src-count">${srcCount} sources</span>` : ''}
        <span class="agent-history-job-trigger">${formatTrigger(job.trigger)}</span>
        <span class="agent-history-job-count">${history.length} run${history.length !== 1 ? 's' : ''}</span>
      </div>`;

    if (!history.length) {
      const noRun = document.createElement('div');
      noRun.className = 'agent-history-norun';
      noRun.textContent = 'No runs yet — click the run button to execute this job.';
      section.appendChild(noRun);
    } else {
      history.forEach(entry => {
        const row = document.createElement('div');

        let sc, statusLabel;
        if (entry.error) {
          sc = 'error';
          statusLabel = 'Error';
        } else if (entry.nothingToReport || entry.skipped) {
          sc = 'nothing';
          statusLabel = 'Nothing to report';
        } else {
          sc = 'acted';
          statusLabel = 'Acted';
        }

        // View button only shown when agent actually sent output
        const hasContent = entry.acted && !!(entry.fullResponse || entry.summary);

        row.className = `agent-history-entry agent-history-entry--${sc}`;
        row.innerHTML = `
          <div class="agent-history-entry-row">
            <div class="agent-history-entry-left">
              <span class="agent-history-entry-time">${timeAgo(entry.timestamp)}</span>
              <span class="agent-history-entry-datetime">${fullDateTime(entry.timestamp)}</span>
            </div>
            <div class="agent-history-entry-right">
              <span class="agent-history-entry-status agent-history-entry-status--${sc}">${statusLabel}</span>
              ${hasContent ? `<button class="agent-history-view-btn" type="button">View</button>` : ''}
            </div>
          </div>
          ${entry.error
            ? `<div class="agent-history-entry-error">${esc(entry.error)}</div>`
            : (entry.nothingToReport || entry.skipped)
              ? `<div class="agent-history-entry-nothing">No data to act on — no email or notification was sent.</div>`
              : ''}`;

        row.querySelector('.agent-history-view-btn')?.addEventListener('click', e => {
          e.stopPropagation();
          openResponseViewer(entry, jobLab);
        });

        section.appendChild(row);
      });
    }

    bodyEl.appendChild(section);
  });

  if (!hasAny) {
    const hint = document.createElement('div');
    hint.className = 'agent-history-empty';
    hint.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
        style="width:28px;height:28px;opacity:0.35">
        <path d="M12 8v4l3 3" stroke-linecap="round"/><circle cx="12" cy="12" r="9"/>
      </svg>
      <p>No runs recorded yet.<br>Click the run button on the card to execute all jobs.</p>`;
    bodyEl.insertBefore(hint, bodyEl.firstChild);
  }

  document.getElementById('agent-history-backdrop').classList.add('open');
}

function closeHistoryModal() {
  document.getElementById('agent-history-backdrop')?.classList.remove('open');
}

/* ══════════════════════════════════════════
   DELETE CONFIRM
══════════════════════════════════════════ */
const confirmOverlay = document.getElementById('agent-confirm-overlay');
const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
const confirmNameEl = document.getElementById('confirm-agent-name');

function openConfirm(id, name) {
  _deletingId = id;
  if (confirmNameEl) confirmNameEl.textContent = name;
  confirmOverlay?.classList.add('open');
}

function closeConfirm() {
  confirmOverlay?.classList.remove('open');
  _deletingId = null;
}

confirmCancelBtn?.addEventListener('click', closeConfirm);
confirmOverlay?.addEventListener('click', e => { if (e.target === confirmOverlay) closeConfirm(); });
confirmDeleteBtn?.addEventListener('click', async () => {
  if (!_deletingId) return;
  await window.electronAPI?.deleteAgent?.(_deletingId);
  _agents = _agents.filter(a => a.id !== _deletingId);
  closeConfirm();
  renderGrid();
});

/* ══════════════════════════════════════════
   MODEL PICKER
══════════════════════════════════════════ */
const primaryModelBtn = document.getElementById('primary-model-btn');
const primaryModelLabel = document.getElementById('primary-model-label');
const primaryModelMenu = document.getElementById('primary-model-menu');

function buildModelMenu(menuEl, onSelect, selectedPid, selectedMid) {
  menuEl.innerHTML = '';
  if (!_allModels.length) {
    menuEl.innerHTML = '<div style="padding:12px;font-size:12px;color:var(--text-muted)">No models. Add API keys in Settings.</div>';
    return;
  }
  const groups = {};
  for (const m of _allModels) {
    if (!groups[m.provider]) groups[m.provider] = [];
    groups[m.provider].push(m);
  }
  for (const [gn, models] of Object.entries(groups)) {
    const h = document.createElement('div');
    h.className = 'agent-model-group-header';
    h.textContent = gn;
    menuEl.appendChild(h);
    for (const m of models) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'agent-model-option' +
        (m.providerId === selectedPid && m.modelId === selectedMid ? ' selected' : '');
      btn.innerHTML = `<span>${esc(m.modelName)}</span>${m.description ? `<span class="agent-model-option-desc">${esc(m.description)}</span>` : ''}`;
      btn.addEventListener('click', () => {
        onSelect(m.providerId, m.modelId, m.modelName);
        menuEl.classList.remove('open');
        primaryModelBtn?.classList.remove('open');
      });
      menuEl.appendChild(btn);
    }
  }
}

primaryModelBtn?.addEventListener('click', e => {
  e.stopPropagation();
  const open = primaryModelMenu?.classList.contains('open');
  primaryModelMenu?.classList.toggle('open', !open);
  primaryModelBtn?.classList.toggle('open', !open);
  if (!open) {
    buildModelMenu(
      primaryModelMenu,
      (pid, mid, name) => {
        _primaryModel = { provider: pid, modelId: mid };
        if (primaryModelLabel) primaryModelLabel.textContent = `${name} (${pid})`;
      },
      _primaryModel?.provider,
      _primaryModel?.modelId
    );
  }
});

document.addEventListener('click', e => {
  if (!primaryModelBtn?.contains(e.target) && !primaryModelMenu?.contains(e.target)) {
    primaryModelMenu?.classList.remove('open');
    primaryModelBtn?.classList.remove('open');
  }
});

function buildFallbackList() {
  const listEl = document.getElementById('fallback-models-list');
  if (!listEl) return;
  listEl.innerHTML = '';
  if (!_allModels.length) {
    listEl.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:4px">No models available.</div>';
    return;
  }
  for (const m of _allModels) {
    if (_primaryModel?.provider === m.providerId && _primaryModel?.modelId === m.modelId) continue;
    const checked = _fallbackModels.some(fb => fb.provider === m.providerId && fb.modelId === m.modelId);
    const item = document.createElement('label');
    item.className = 'agent-fallback-item';
    item.innerHTML = `
      <input type="checkbox" class="agent-fallback-check"
        data-provider="${esc(m.providerId)}" data-model="${esc(m.modelId)}" ${checked ? 'checked' : ''}/>
      <span class="agent-fallback-name">${esc(m.modelName)}</span>
      <span class="agent-fallback-provider">${esc(m.provider)}</span>`;
    item.querySelector('input').addEventListener('change', e => {
      const pid = e.target.dataset.provider, mid = e.target.dataset.model;
      if (e.target.checked) _fallbackModels.push({ provider: pid, modelId: mid });
      else _fallbackModels = _fallbackModels.filter(fb => !(fb.provider === pid && fb.modelId === mid));
    });
    listEl.appendChild(item);
  }
}

/* ══════════════════════════════════════════
   JOB BUILDER
══════════════════════════════════════════ */
const jobsListEl = document.getElementById('jobs-list');
const addJobBtn = document.getElementById('add-job-btn');
const jobsBadge = document.getElementById('jobs-count-badge');

function updateJobsBadge() {
  if (jobsBadge) jobsBadge.textContent = `(${_jobs.length}/${MAX_JOBS})`;
  if (addJobBtn) addJobBtn.disabled = _jobs.length >= MAX_JOBS;
}

function renderJobsList() {
  if (!jobsListEl) return;
  jobsListEl.innerHTML = '';
  _jobs.forEach((job, idx) => jobsListEl.appendChild(buildJobCard(job, idx)));
  updateJobsBadge();
}

/* ── Source selector HTML ── */
function buildSourceSelectorHTML(ds, sourceIdx) {
  const type = ds?.type ?? '';
  const groups = {};
  for (const d of DATA_SOURCE_TYPES) {
    if (!groups[d.group]) groups[d.group] = [];
    groups[d.group].push(d);
  }
  const opts = Object.entries(groups).map(([g, items]) =>
    `<optgroup label="${g}">${items.map(i =>
      `<option value="${i.value}" ${type === i.value ? 'selected' : ''}>${i.label}</option>`
    ).join('')}</optgroup>`
  ).join('');

  return `
    <div class="source-selector-group" data-source-idx="${sourceIdx}">
      <div class="source-selector-top">
        <select class="job-param-select ds-type-select">
          <option value="">— ${sourceIdx === 0 ? 'Choose a data source' : 'Add another source'} —</option>
          ${opts}
        </select>
        ${sourceIdx > 0 ? `
          <button type="button" class="source-remove-btn" title="Remove source">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/>
            </svg>
          </button>` : ''}
      </div>
      <div class="ds-params-area">${buildDsParams(ds)}</div>
    </div>`;
}

/* ── Job card ── */
function buildJobCard(job, idx) {
  const card = document.createElement('div');
  card.className = 'job-card open';
  card.dataset.jobId = job.id;

  // Normalise to dataSources[]
  if (!Array.isArray(job.dataSources) || !job.dataSources.length) {
    job.dataSources = job.dataSource?.type ? [{ ...job.dataSource }] : [{ type: '' }];
  }

  const nameHint = job.name ||
    (DATA_SOURCE_TYPES.find(d => d.value === job.dataSources[0]?.type)?.label ?? 'New Job');

  card.innerHTML = `
    <div class="job-card-header">
      <div class="job-card-number">${idx + 1}</div>
      <div class="job-card-name ${job.name ? 'has-value' : ''}">${esc(nameHint)}</div>
      <svg class="job-card-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 15l-6-6-6 6" stroke-linecap="round"/>
      </svg>
      <button type="button" class="job-remove-btn" title="Remove job">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <div class="job-body">

      <!-- Label -->
      <div class="agent-field" style="margin-top:14px">
        <label class="agent-field-label">
          Job Label <span style="color:var(--text-muted);font-weight:400">(optional)</span>
        </label>
        <input type="text" class="agent-input job-name-input"
          value="${esc(job.name ?? '')}"
          placeholder="e.g. Morning Email Digest, Daily PR Check…"
          maxlength="60"/>
      </div>

      <!-- Trigger -->
      <div class="job-sub-section">
        <div class="job-sub-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3" stroke-linecap="round"/>
          </svg>
          When to Run
        </div>
        ${buildTriggerHTML(job.trigger)}
      </div>

      <!-- Data Sources -->
      <div class="job-sub-section">
        <div class="job-sub-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <ellipse cx="12" cy="5" rx="9" ry="3"/>
            <path d="M21 12c0 1.66-4.03 3-9 3S3 13.66 3 12"/>
            <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" stroke-linecap="round"/>
          </svg>
          Data to Collect
          <span class="job-sources-count-badge" style="font-size:10px;color:var(--text-muted);font-weight:500;letter-spacing:0;text-transform:none">
            (${job.dataSources.length} source${job.dataSources.length !== 1 ? 's' : ''})
          </span>
        </div>
        <div class="sources-list">
          ${job.dataSources.map((ds, si) => buildSourceSelectorHTML(ds, si)).join('')}
        </div>
        <button type="button" class="add-source-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14" stroke-linecap="round"/>
          </svg>
          Add another data source
        </button>
      </div>

      <!-- AI Instruction -->
      <div class="job-sub-section">
        <div class="job-sub-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-3.14Z" stroke-linecap="round"/>
            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-3.14Z" stroke-linecap="round"/>
          </svg>
          AI Instruction
        </div>
        <div class="job-params">
          <textarea class="job-param-textarea job-instruction" rows="4"
            placeholder="Tell the AI what to do with the data — and any conditions e.g. 'only alert me if CPU exceeds 90%' or 'only send if there are urgent emails'…"
          >${esc(job.instruction ?? '')}</textarea>
        </div>
        <div class="job-instruction-hint">
          Tip: You can write conditions directly here — e.g. "Only send if there are PRs waiting for my review" or "Skip if everything is normal."
        </div>
      </div>

      <!-- Output -->
      <div class="job-sub-section">
        <div class="job-sub-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/>
          </svg>
          What to Do With the Result
        </div>
        ${buildOutputHTML(job.output)}
      </div>

    </div>`;

  // Toggle collapse
  card.querySelector('.job-card-header').addEventListener('click', e => {
    if (e.target.closest('.job-remove-btn')) return;
    card.classList.toggle('open');
  });

  // Remove job
  card.querySelector('.job-remove-btn').addEventListener('click', () => {
    _jobs = _jobs.filter(j => j.id !== job.id);
    renderJobsList();
  });

  // Job name
  const nameInp = card.querySelector('.job-name-input');
  const nameLbl = card.querySelector('.job-card-name');
  nameInp?.addEventListener('input', () => {
    job.name = nameInp.value.trim();
    nameLbl.textContent = job.name ||
      (DATA_SOURCE_TYPES.find(d => d.value === job.dataSources[0]?.type)?.label ?? 'Job');
    nameLbl.classList.toggle('has-value', !!job.name);
  });

  wireTriggerEvents(card, job);
  wireAllSourceEvents(card, job);

  card.querySelector('.add-source-btn').addEventListener('click', () => {
    job.dataSources.push({ type: '' });
    card.querySelector('.sources-list').innerHTML =
      job.dataSources.map((ds, si) => buildSourceSelectorHTML(ds, si)).join('');
    card.querySelector('.job-sources-count-badge').textContent =
      `(${job.dataSources.length} source${job.dataSources.length !== 1 ? 's' : ''})`;
    wireAllSourceEvents(card, job);
  });

  card.querySelector('.job-instruction')?.addEventListener('input', e => {
    job.instruction = e.target.value;
  });

  wireOutputEvents(card, job);

  return card;
}

/* ── Wire all source selectors ── */
function wireAllSourceEvents(card, job) {
  const sourcesList = card.querySelector('.sources-list');
  if (!sourcesList) return;

  sourcesList.querySelectorAll('.source-selector-group').forEach((group, si) => {
    const typeSelect = group.querySelector('.ds-type-select');
    const paramsArea = group.querySelector('.ds-params-area');

    typeSelect?.addEventListener('change', () => {
      const dsType = typeSelect.value;
      if (!job.dataSources[si]) job.dataSources[si] = {};
      job.dataSources[si] = { type: dsType };

      // Auto-fill instruction template if first source and instruction is blank
      const instrArea = card.querySelector('.job-instruction');
      if (si === 0 && instrArea && !instrArea.value.trim()) {
        const tmpl = INSTRUCTION_TEMPLATES[dsType];
        if (tmpl) { instrArea.value = tmpl; job.instruction = tmpl; }
      }

      // Update label in header
      const nameLbl = card.querySelector('.job-card-name');
      const nameInp = card.querySelector('.job-name-input');
      if (si === 0 && !nameInp?.value.trim() && nameLbl) {
        nameLbl.textContent = DATA_SOURCE_TYPES.find(d => d.value === dsType)?.label ?? 'Job';
      }

      if (paramsArea) paramsArea.innerHTML = buildDsParams(job.dataSources[si]);
      card.querySelector('.job-sources-count-badge').textContent =
        `(${job.dataSources.length} source${job.dataSources.length !== 1 ? 's' : ''})`;
      wireDsParamEvents(group, job.dataSources[si]);
    });

    group.querySelector('.source-remove-btn')?.addEventListener('click', () => {
      job.dataSources.splice(si, 1);
      sourcesList.innerHTML = job.dataSources.map((ds, i) => buildSourceSelectorHTML(ds, i)).join('');
      card.querySelector('.job-sources-count-badge').textContent =
        `(${job.dataSources.length} source${job.dataSources.length !== 1 ? 's' : ''})`;
      wireAllSourceEvents(card, job);
    });

    wireDsParamEvents(group, job.dataSources[si] ?? {});
  });
}

/* ── Trigger ── */
function buildTriggerHTML(trigger) {
  const type = trigger?.type ?? 'daily';
  const time = trigger?.time ?? '08:00';
  const day = trigger?.day ?? 'monday';
  const mins = trigger?.minutes ?? 30;

  const intervals = [5, 10, 15, 30, 60, 120, 240, 480, 1440];
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  return `
    <div class="job-params">
      <select class="job-param-select trigger-type-select">
        <option value="on_startup" ${type === 'on_startup' ? 'selected' : ''}>⚡ On app startup</option>
        <option value="interval"   ${type === 'interval' ? 'selected' : ''}>⏱ At an interval</option>
        <option value="hourly"     ${type === 'hourly' ? 'selected' : ''}>⏰ Every hour</option>
        <option value="daily"      ${type === 'daily' ? 'selected' : ''}>🌅 Every day at…</option>
        <option value="weekly"     ${type === 'weekly' ? 'selected' : ''}>📅 Every week on…</option>
      </select>
      <div class="job-trigger-sub ${type === 'interval' ? '' : 'hidden'} trigger-sub-interval">
        <select class="job-interval-select">
          ${intervals.map(m =>
    `<option value="${m}" ${mins == m ? 'selected' : ''}>${m < 60 ? `Every ${m} min` : m === 60 ? 'Every 1 hr' : `Every ${m / 60} hrs`}</option>`
  ).join('')}
        </select>
      </div>
      <div class="job-trigger-sub ${type === 'daily' ? '' : 'hidden'} trigger-sub-daily">
        <span style="font-size:12px;color:var(--text-muted)">at</span>
        <input type="time" class="job-time-input trigger-time-daily" value="${time}"/>
      </div>
      <div class="job-trigger-sub ${type === 'weekly' ? '' : 'hidden'} trigger-sub-weekly">
        <select class="job-day-select trigger-day">
          ${days.map(d => `<option value="${d}" ${day === d ? 'selected' : ''}>${cap(d)}</option>`).join('')}
        </select>
        <span style="font-size:12px;color:var(--text-muted)">at</span>
        <input type="time" class="job-time-input trigger-time-weekly" value="${time}"/>
      </div>
    </div>`;
}

function wireTriggerEvents(card, job) {
  const sel = card.querySelector('.trigger-type-select'); if (!sel) return;
  sel.addEventListener('change', () => {
    job.trigger = job.trigger ?? {};
    job.trigger.type = sel.value;
    card.querySelector('.trigger-sub-interval')?.classList.toggle('hidden', sel.value !== 'interval');
    card.querySelector('.trigger-sub-daily')?.classList.toggle('hidden', sel.value !== 'daily');
    card.querySelector('.trigger-sub-weekly')?.classList.toggle('hidden', sel.value !== 'weekly');
  });
  card.querySelector('.job-interval-select')?.addEventListener('change', e => { job.trigger = job.trigger ?? {}; job.trigger.minutes = parseInt(e.target.value); });
  card.querySelector('.trigger-time-daily')?.addEventListener('change', e => { job.trigger = job.trigger ?? {}; job.trigger.time = e.target.value; });
  card.querySelector('.trigger-day')?.addEventListener('change', e => { job.trigger = job.trigger ?? {}; job.trigger.day = e.target.value; });
  card.querySelector('.trigger-time-weekly')?.addEventListener('change', e => { job.trigger = job.trigger ?? {}; job.trigger.time = e.target.value; });
}

/* ── Data source params ── */
function buildDsParams(ds) {
  const type = ds?.type ?? '';
  switch (type) {
    case 'gmail_inbox':
      return `<input type="number" class="job-param-input ds-max-results" placeholder="Max emails (default 20)" value="${ds?.maxResults ?? 20}" min="1" max="50"/>`;
    case 'gmail_search':
      return `<input type="text"   class="job-param-input ds-query"       placeholder="Gmail query, e.g: from:boss OR subject:urgent" value="${esc(ds?.query ?? '')}"/>
              <input type="number" class="job-param-input ds-max-results"  placeholder="Max results (default 10)" value="${ds?.maxResults ?? 10}" min="1" max="30"/>`;
    case 'github_prs':
    case 'github_issues':
    case 'github_commits':
      return `
        <input type="text" class="job-param-input ds-owner" placeholder="GitHub owner / org" value="${esc(ds?.owner ?? '')}"/>
        <input type="text" class="job-param-input ds-repo"  placeholder="Repository name"   value="${esc(ds?.repo ?? '')}"/>
        ${type === 'github_commits'
          ? `<input type="number" class="job-param-input ds-max-results" placeholder="Commits (default 10)" value="${ds?.maxResults ?? 10}" min="1" max="30"/>`
          : `<select class="job-param-select ds-state">
               <option value="open"   ${ds?.state === 'open' ? 'selected' : ''}>Open</option>
               <option value="closed" ${ds?.state === 'closed' ? 'selected' : ''}>Closed</option>
               <option value="all"    ${ds?.state === 'all' ? 'selected' : ''}>All</option>
             </select>`}`;
    case 'github_repos':
      return `<input type="number" class="job-param-input ds-max-results" placeholder="Max repos (default 30)" value="${ds?.maxResults ?? 30}" min="1" max="100"/>`;
    case 'rss_feed':
      return `<input type="url"    class="job-param-input ds-url"         placeholder="Feed URL, e.g. https://hnrss.org/frontpage" value="${esc(ds?.url ?? '')}"/>
              <input type="number" class="job-param-input ds-max-results"  placeholder="Max items (default 10)" value="${ds?.maxResults ?? 10}" min="1" max="30"/>`;
    case 'reddit_posts':
      return `<input type="text"   class="job-param-input ds-subreddit"   placeholder="Subreddit, e.g. programming" value="${esc(ds?.subreddit ?? '')}"/>
              <select class="job-param-select ds-reddit-sort">
                <option value="hot"    ${ds?.sort === 'hot' ? 'selected' : ''}>Hot</option>
                <option value="new"    ${ds?.sort === 'new' ? 'selected' : ''}>New</option>
                <option value="top"    ${ds?.sort === 'top' ? 'selected' : ''}>Top</option>
                <option value="rising" ${ds?.sort === 'rising' ? 'selected' : ''}>Rising</option>
              </select>
              <input type="number" class="job-param-input ds-max-results"  placeholder="Max posts (default 10)" value="${ds?.maxResults ?? 10}" min="1" max="25"/>`;
    case 'hacker_news':
      return `<input type="number" class="job-param-input ds-hn-count" placeholder="Stories (default 10)" value="${ds?.count ?? 10}" min="3" max="20"/>
              <select class="job-param-select ds-hn-type">
                <option value="top"  ${ds?.hnType === 'top' ? 'selected' : ''}>Top</option>
                <option value="new"  ${ds?.hnType === 'new' ? 'selected' : ''}>New</option>
                <option value="best" ${ds?.hnType === 'best' ? 'selected' : ''}>Best</option>
                <option value="ask"  ${ds?.hnType === 'ask' ? 'selected' : ''}>Ask HN</option>
              </select>`;
    case 'weather':
      return `<input type="text" class="job-param-input ds-location" placeholder="City, e.g: London, Mumbai" value="${esc(ds?.location ?? '')}"/>
              <select class="job-param-select ds-units">
                <option value="celsius"    ${ds?.units === 'celsius' ? 'selected' : ''}>Celsius</option>
                <option value="fahrenheit" ${ds?.units === 'fahrenheit' ? 'selected' : ''}>Fahrenheit</option>
              </select>`;
    case 'crypto_price':
      return `<input type="text" class="job-param-input ds-coins" placeholder="e.g: bitcoin,ethereum,solana" value="${esc(ds?.coins ?? 'bitcoin,ethereum')}"/>`;
    case 'system_stats':
      return `<div class="ds-info-note">📊 Collects CPU, memory, load, and uptime from your machine. No config needed.</div>`;
    case 'read_file':
      return `<input type="text" class="job-param-input ds-filepath" placeholder="/Users/you/logs/app.log" value="${esc(ds?.filePath ?? '')}"/>`;
    case 'fetch_url':
      return `<input type="url" class="job-param-input ds-url" placeholder="https://example.com/page-to-monitor" value="${esc(ds?.url ?? '')}"/>`;
    case 'custom_context':
      return `<textarea class="job-param-textarea ds-context" rows="3" placeholder="Paste any text or context for the AI…">${esc(ds?.context ?? '')}</textarea>`;
    default:
      return '';
  }
}

function wireDsParamEvents(container, dsObj) {
  const g = sel => container.querySelector(sel);
  g('.ds-max-results')?.addEventListener('input', e => { dsObj.maxResults = parseInt(e.target.value) || 10; });
  g('.ds-query')?.addEventListener('input', e => { dsObj.query = e.target.value.trim(); });
  g('.ds-owner')?.addEventListener('input', e => { dsObj.owner = e.target.value.trim(); });
  g('.ds-repo')?.addEventListener('input', e => { dsObj.repo = e.target.value.trim(); });
  g('.ds-state')?.addEventListener('change', e => { dsObj.state = e.target.value; });
  g('.ds-hn-count')?.addEventListener('input', e => { dsObj.count = parseInt(e.target.value) || 10; });
  g('.ds-hn-type')?.addEventListener('change', e => { dsObj.hnType = e.target.value; });
  g('.ds-location')?.addEventListener('input', e => { dsObj.location = e.target.value.trim(); });
  g('.ds-units')?.addEventListener('change', e => { dsObj.units = e.target.value; });
  g('.ds-coins')?.addEventListener('input', e => { dsObj.coins = e.target.value.trim(); });
  g('.ds-url')?.addEventListener('input', e => { dsObj.url = e.target.value.trim(); });
  g('.ds-subreddit')?.addEventListener('input', e => { dsObj.subreddit = e.target.value.trim(); });
  g('.ds-reddit-sort')?.addEventListener('change', e => { dsObj.sort = e.target.value; });
  g('.ds-filepath')?.addEventListener('input', e => { dsObj.filePath = e.target.value.trim(); });
  g('.ds-context')?.addEventListener('input', e => { dsObj.context = e.target.value; });
}

/* ── Output ── */
function buildOutputHTML(output) {
  const type = output?.type ?? '';
  const groups = {};
  for (const o of OUTPUT_TYPES) {
    if (!groups[o.group]) groups[o.group] = [];
    groups[o.group].push(o);
  }
  const opts = Object.entries(groups).map(([g, items]) =>
    `<optgroup label="${g}">${items.map(i =>
      `<option value="${i.value}" ${type === i.value ? 'selected' : ''}>${i.label}</option>`
    ).join('')}</optgroup>`
  ).join('');
  return `
    <div class="job-params">
      <select class="job-param-select out-type-select">
        <option value="">— Choose what to do with the result —</option>
        ${opts}
      </select>
      <div class="out-params-area">${buildOutParams(output)}</div>
    </div>`;
}

function buildOutParams(output) {
  switch (output?.type) {
    case 'send_email':
      return `
        <input type="email" class="job-param-input out-to"      placeholder="Send to email *"                              value="${esc(output?.to ?? '')}"/>
        <input type="text"  class="job-param-input out-subject"  placeholder="Subject (auto-generated if blank)"            value="${esc(output?.subject ?? '')}"/>
        <input type="email" class="job-param-input out-cc"       placeholder="CC (optional)"                                value="${esc(output?.cc ?? '')}"/>`;
    case 'send_notification':
      return `<input type="text" class="job-param-input out-notif-title" placeholder="Notification title (optional)" value="${esc(output?.title ?? '')}"/>`;
    case 'write_file':
      return `
        <input type="text" class="job-param-input out-file-path" placeholder="/Users/you/Desktop/agent-log.txt" value="${esc(output?.filePath ?? '')}"/>
        <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-secondary);cursor:pointer;padding:4px 0">
          <input type="checkbox" class="out-append" ${output?.append ? 'checked' : ''} style="width:14px;height:14px"/>
          Append to file (instead of overwrite)
        </label>`;
    case 'append_to_memory':
      return `<div class="ds-info-note ds-info-note--accent">🧠 <strong>Agent insights become permanent AI knowledge.</strong><br>The AI's analysis is appended to your Memory, injected into every chat session. Your agent literally teaches the AI about the world over time.</div>`;
    case 'http_webhook':
      return `
        <input type="url"    class="job-param-input out-webhook-url"    placeholder="Webhook URL, e.g. https://hooks.slack.com/…" value="${esc(output?.url ?? '')}"/>
        <select class="job-param-select out-webhook-method">
          <option value="POST" ${output?.method === 'POST' ? 'selected' : ''}>POST</option>
          <option value="GET"  ${output?.method === 'GET' ? 'selected' : ''}>GET</option>
        </select>`;
    default:
      return '';
  }
}

function wireOutputEvents(card, job) {
  const sel = card.querySelector('.out-type-select');
  const area = card.querySelector('.out-params-area');
  if (!sel) return;
  sel.addEventListener('change', () => {
    job.output = { type: sel.value };
    if (area) area.innerHTML = buildOutParams(job.output);
    wireOutParamEvents(card, job);
  });
  wireOutParamEvents(card, job);
}

function wireOutParamEvents(card, job) {
  const g = sel => card.querySelector(sel);
  g('.out-to')?.addEventListener('input', e => { job.output.to = e.target.value.trim(); });
  g('.out-subject')?.addEventListener('input', e => { job.output.subject = e.target.value.trim(); });
  g('.out-cc')?.addEventListener('input', e => { job.output.cc = e.target.value.trim(); });
  g('.out-notif-title')?.addEventListener('input', e => { job.output.title = e.target.value.trim(); });
  g('.out-file-path')?.addEventListener('input', e => { job.output.filePath = e.target.value.trim(); });
  g('.out-append')?.addEventListener('change', e => { job.output.append = e.target.checked; });
  g('.out-webhook-url')?.addEventListener('input', e => { job.output.url = e.target.value.trim(); });
  g('.out-webhook-method')?.addEventListener('change', e => { job.output.method = e.target.value; });
}

addJobBtn?.addEventListener('click', () => {
  if (_jobs.length >= MAX_JOBS) return;
  _jobs.push({
    id: genJid(),
    name: '',
    trigger: { type: 'daily', time: '08:00' },
    dataSources: [{ type: '' }],
    instruction: '',
    output: { type: '' },
    history: [],
    lastRun: null,
  });
  renderJobsList();
  document.getElementById('agent-modal-body')?.scrollTo({ top: 999999, behavior: 'smooth' });
});

/* ══════════════════════════════════════════
   MAIN MODAL
══════════════════════════════════════════ */
const modalBackdrop = document.getElementById('agent-modal-backdrop');
const modalTitleEl = document.getElementById('agent-modal-title-text');
const modalClose = document.getElementById('agent-modal-close');
const cancelBtn = document.getElementById('agent-cancel-btn');
const saveBtn = document.getElementById('agent-save-btn');
const nameInput = document.getElementById('agent-name');
const descInput = document.getElementById('agent-desc');

async function openModal(agent = null) {
  _editingId = agent?.id ?? null;
  _primaryModel = agent?.primaryModel ? { ...agent.primaryModel } : null;
  _fallbackModels = agent?.fallbackModels ? [...agent.fallbackModels] : [];
  _jobs = agent?.jobs
    ? agent.jobs.map(j => ({
      ...j,
      dataSources: Array.isArray(j.dataSources) && j.dataSources.length
        ? j.dataSources.map(ds => ({ ...ds }))
        : (j.dataSource?.type ? [{ ...j.dataSource }] : [{ type: '' }]),
      output: { ...j.output },
      trigger: { ...j.trigger },
      history: j.history ?? [],
    }))
    : [];

  if (modalTitleEl) modalTitleEl.textContent = agent ? 'Edit Agent' : 'New Agent';
  if (nameInput) nameInput.value = agent?.name ?? '';
  if (descInput) descInput.value = agent?.description ?? '';
  if (primaryModelLabel) {
    primaryModelLabel.textContent = _primaryModel
      ? modelLabel(_primaryModel.provider, _primaryModel.modelId)
      : 'Select a model…';
  }

  buildFallbackList();
  renderJobsList();
  modalBackdrop?.classList.add('open');
  document.body.classList.add('modal-open');
  setTimeout(() => nameInput?.focus(), 60);
}

function closeModal() {
  modalBackdrop?.classList.remove('open');
  document.body.classList.remove('modal-open');
  _editingId = null;
}

modalClose?.addEventListener('click', closeModal);
cancelBtn?.addEventListener('click', closeModal);
modalBackdrop?.addEventListener('click', e => { if (e.target === modalBackdrop) closeModal(); });

saveBtn?.addEventListener('click', async () => {
  const name = nameInput?.value.trim();
  if (!name) {
    nameInput?.animate([{ borderColor: '#f87171' }, { borderColor: 'var(--border)' }], { duration: 900 });
    nameInput?.focus();
    return;
  }

  const data = {
    id: _editingId ?? genId(),
    name,
    description: descInput?.value.trim() ?? '',
    enabled: true,
    primaryModel: _primaryModel,
    fallbackModels: _fallbackModels,
    jobs: _jobs.filter(j => j.dataSources?.some(ds => ds.type) && j.output?.type),
  };

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';
  try {
    const res = await window.electronAPI?.saveAgent?.(data);
    if (res?.ok) {
      const idx = _agents.findIndex(a => a.id === data.id);
      if (idx >= 0) _agents[idx] = res.agent ?? data;
      else _agents.push(res.agent ?? data);
      renderGrid();
      closeModal();
    }
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Agent';
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeModal();
    closeConfirm();
    closeHistoryModal();
    closeResponseViewer();
  }
});

/* ══════════════════════════════════════════
   BOOT
══════════════════════════════════════════ */
document.getElementById('add-agent-header-btn')?.addEventListener('click', () => openModal());
document.getElementById('add-agent-empty-btn')?.addEventListener('click', () => openModal());

async function load() {
  await loadModels();
  const res = await window.electronAPI?.getAgents?.().catch(() => null);
  _agents = Array.isArray(res?.agents) ? res.agents : [];
  renderGrid();
}

load();