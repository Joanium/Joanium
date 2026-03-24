// ─────────────────────────────────────────────
//  Romelson — Public/Assets/Scripts/Pages/Events.js
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
  activePage: 'events',
  onNewChat: () => window.electronAPI?.launchMain(),
  onLibrary: () => library.isOpen() ? library.close() : library.open(),
  onAutomations: () => window.electronAPI?.launchAutomations?.(),
  onAgents: () => window.electronAPI?.launchAgents?.(),
  onSkills: () => window.electronAPI?.launchSkills?.(),
  onPersonas: () => window.electronAPI?.launchPersonas?.(),
  onEvents: () => { /* already here */ },
  onUsage: () => window.electronAPI?.launchUsage?.(),
  onSettings: () => settings.open(),
  onAbout: () => about.open(),
});

window.addEventListener('ow:user-profile-updated', e => sidebar.setUser(e.detail?.name ?? ''));
settings.loadUser().then(user => sidebar.setUser(user?.name ?? ''));

/* ══════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════ */
const POLL_MS = 1_500;
const MAX_EVENTS = 200;

/* ══════════════════════════════════════════
   DOM
══════════════════════════════════════════ */
const feedEl = document.getElementById('events-feed');
const emptyEl = document.getElementById('events-empty');
const loadingEl = document.getElementById('events-loading');
const liveBadge = document.getElementById('events-live-badge');
const statTotal = document.getElementById('stat-total');
const statSuccess = document.getElementById('stat-success');
const statSkipped = document.getElementById('stat-skipped');
const statErrors = document.getElementById('stat-errors');
const statAgents = document.getElementById('stat-agents');
const filterBtns = document.querySelectorAll('.events-filter-btn');
const clearBtn = document.getElementById('events-clear-btn');

// Detail modal
const detailBackdrop = document.getElementById('event-detail-backdrop');
const detailClose = document.getElementById('event-detail-close');
const detailEyebrow = document.getElementById('detail-eyebrow');
const detailTitle = document.getElementById('detail-title');
const detailMeta = document.getElementById('detail-meta');
const detailBody = document.getElementById('detail-body');

// Confirm-clear modal
const confirmBackdrop = document.getElementById('events-confirm-backdrop');
const confirmCancel = document.getElementById('events-confirm-cancel');
const confirmOk = document.getElementById('events-confirm-ok');

/* ══════════════════════════════════════════
   STATE
══════════════════════════════════════════ */
let _historyEvents = [];
let _runningJobs = [];
let _seenHistoryIds = new Set();
let _filter = 'all';
let _pollTimer = null;
let _firstLoad = true;
let _clearing = false;   // prevent poll re-populating during clear

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */
const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso);
  const s = 1000, m = 60 * s, h = 60 * m, d = 24 * h;
  if (diff < 30 * s) return 'just now';
  if (diff < 2 * m) return `${Math.floor(diff / s)}s ago`;
  if (diff < 2 * h) return `${Math.floor(diff / m)}m ago`;
  if (diff < 2 * d) return `${Math.floor(diff / h)}h ago`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function runningDuration(startedAt) {
  if (!startedAt) return '';
  const secs = Math.floor((Date.now() - new Date(startedAt)) / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function fullDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString([], {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function triggerLabel(trigger) {
  if (!trigger) return '';
  switch (trigger.type) {
    case 'on_startup': return '⚡ Startup';
    case 'interval': return `⏱ Every ${trigger.minutes}m`;
    case 'hourly': return '⏰ Hourly';
    case 'daily': return `🌅 Daily ${trigger.time ?? ''}`;
    case 'weekly': return `📅 ${trigger.day ?? ''} ${trigger.time ?? ''}`;
    default: return trigger.type;
  }
}

function show(el) { if (el) el.style.display = ''; }
function hide(el) { if (el) el.style.display = 'none'; }

/* ══════════════════════════════════════════
   DATA COLLECTION
══════════════════════════════════════════ */
async function fetchHistory() {
  const events = [];

  try {
    const res = await window.electronAPI?.getAgents?.();
    const agents = Array.isArray(res?.agents) ? res.agents : [];
    for (const agent of agents) {
      for (const job of (agent.jobs ?? [])) {
        for (const entry of (job.history ?? [])) {
          const status = entry.error
            ? 'error'
            : (entry.nothingToReport || entry.skipped) ? 'skipped' : 'success';
          events.push({
            id: `agent__${agent.id}__${job.id}__${entry.timestamp}`,
            type: 'agent',
            source: agent.name,
            agentId: agent.id,
            jobId: job.id,
            jobName: job.name || 'Job',
            status,
            timestamp: entry.timestamp,
            summary: entry.summary || '',
            fullResponse: entry.fullResponse || '',
            error: entry.error || null,
            skipReason: entry.skipReason || null,
            trigger: job.trigger || null,
            agentEnabled: agent.enabled,
          });
        }
      }
    }
  } catch { /* non-fatal */ }

  try {
    const res = await window.electronAPI?.getAutomations?.();
    const autos = Array.isArray(res?.automations) ? res.automations : [];
    for (const auto of autos) {
      for (const entry of (auto.history ?? [])) {
        events.push({
          id: `auto__${auto.id}__${entry.timestamp}`,
          type: 'automation',
          source: auto.name,
          autoId: auto.id,
          status: entry.error ? 'error' : 'success',
          timestamp: entry.timestamp,
          summary: entry.summary || auto.description || `${auto.actions?.length ?? 0} action(s) ran`,
          fullResponse: entry.summary || '',
          error: entry.error || null,
          skipReason: null,
          trigger: auto.trigger || null,
          autoEnabled: auto.enabled,
        });
      }
      // Fallback: if no history yet but lastRun exists, show a legacy entry
      if (!(auto.history?.length) && auto.lastRun) {
        events.push({
          id: `auto__${auto.id}__${auto.lastRun}`,
          type: 'automation',
          source: auto.name,
          autoId: auto.id,
          status: 'success',
          timestamp: auto.lastRun,
          summary: auto.description || `${auto.actions?.length ?? 0} action(s) ran`,
          fullResponse: '',
          error: null,
          skipReason: null,
          trigger: auto.trigger || null,
          autoEnabled: auto.enabled,
        });
      }
    }
  } catch { /* non-fatal */ }

  events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return events.slice(0, MAX_EVENTS);
}

async function fetchRunning() {
  try {
    const res = await window.electronAPI?.getRunningJobs?.();
    return Array.isArray(res?.running) ? res.running : [];
  } catch { return []; }
}

/* ══════════════════════════════════════════
   STATS
══════════════════════════════════════════ */
function updateStats(historyEvents, runningJobs) {
  statTotal.textContent = historyEvents.length;
  statSuccess.textContent = historyEvents.filter(e => e.status === 'success').length;
  statSkipped.textContent = historyEvents.filter(e => e.status === 'skipped').length;
  statErrors.textContent = historyEvents.filter(e => e.status === 'error').length;

  const historicIds = new Set(historyEvents.filter(e => e.type === 'agent').map(e => e.agentId));
  const runningIds = new Set(runningJobs.map(r => r.agentId));
  statAgents.textContent = new Set([...historicIds, ...runningIds]).size;
}

function zeroStats() {
  statTotal.textContent = statSuccess.textContent =
    statSkipped.textContent = statErrors.textContent = statAgents.textContent = '0';
}

/* ══════════════════════════════════════════
   FILTER
══════════════════════════════════════════ */
function applyFilter(events) {
  switch (_filter) {
    case 'agents': return events.filter(e => e.type === 'agent');
    case 'automations': return events.filter(e => e.type === 'automation');
    case 'errors': return events.filter(e => e.status === 'error');
    default: return events;
  }
}

/* ══════════════════════════════════════════
   BUILD: RUNNING CARD
══════════════════════════════════════════ */
function buildRunningCard(job) {
  const card = document.createElement('div');
  card.className = 'event-row event-row--running';
  card.dataset.runKey = `${job.agentId}__${job.jobId}`;
  card.innerHTML = `
    <div class="event-status-icon event-status--running">
      <svg class="running-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
        <path d="M21 12a9 9 0 11-6.219-8.56" stroke-linecap="round"/>
      </svg>
    </div>
    <div class="event-row-body">
      <div class="event-row-top">
        <div class="event-source-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="event-type-icon event-type-icon--agent">
            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-3.14Z" stroke-linecap="round"/>
            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-3.14Z" stroke-linecap="round"/>
          </svg>
          <span class="event-source">${esc(job.agentName)}</span>
          <span class="event-job-sep">›</span>
          <span class="event-job-name">${esc(job.jobName)}</span>
        </div>
        <div class="event-row-badges">
          ${job.trigger ? `<span class="event-trigger-badge">${esc(triggerLabel(job.trigger))}</span>` : ''}
          <span class="event-status-badge event-status-badge--running">⟳ Running</span>
        </div>
      </div>
      <div class="event-summary">Collecting data and calling AI…</div>
      <div class="event-row-footer">
        <span class="event-time running-duration" data-started="${esc(job.startedAt)}">Started ${timeAgo(job.startedAt)}</span>
        <span class="event-elapsed">Elapsed: <span class="elapsed-value">${runningDuration(job.startedAt)}</span></span>
      </div>
    </div>`;
  return card;
}

/* ══════════════════════════════════════════
   BUILD: HISTORY ROW
══════════════════════════════════════════ */
function buildEventRow(ev, isNew = false) {
  const row = document.createElement('div');
  row.className = `event-row event-row--${ev.status}${isNew ? ' event-row--new' : ''}`;
  row.dataset.eventId = ev.id;

  const statusIcon = {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/></svg>`,
    skipped: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h14" stroke-linecap="round"/></svg>`,
  }[ev.status] ?? '';

  const typeIcon = ev.type === 'agent'
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="event-type-icon event-type-icon--agent">
        <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-3.14Z" stroke-linecap="round"/>
        <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-3.14Z" stroke-linecap="round"/>
       </svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="event-type-icon event-type-icon--automation">
        <path d="M13 2L4.5 13H11l-1 9L20.5 11H14L13 2z" stroke-linejoin="round"/>
       </svg>`;

  const statusLabel = { success: '✓ Acted', error: '✗ Error', skipped: '— Skipped' }[ev.status] ?? ev.status;
  const triggerBadge = ev.trigger ? `<span class="event-trigger-badge">${esc(triggerLabel(ev.trigger))}</span>` : '';
  const hasDetail = ev.fullResponse || ev.error || ev.summary;

  let bodyContent = '';
  if (ev.status === 'error' && ev.error) {
    bodyContent = `<div class="event-error-preview">${esc(ev.error.slice(0, 140))}${ev.error.length > 140 ? '…' : ''}</div>`;
  } else if (ev.status === 'skipped') {
    const reason = ev.skipReason || 'Data source returned nothing to act on — no output was sent.';
    bodyContent = `<div class="event-summary muted">${esc(reason)}</div>`;
  } else if (ev.summary) {
    bodyContent = `<div class="event-summary">${esc(ev.summary.slice(0, 140))}${ev.summary.length > 140 ? '…' : ''}</div>`;
  }

  row.innerHTML = `
    <div class="event-status-icon event-status--${ev.status}">${statusIcon}</div>
    <div class="event-row-body">
      <div class="event-row-top">
        <div class="event-source-wrap">
          ${typeIcon}
          <span class="event-source">${esc(ev.source)}</span>
          ${ev.jobName ? `<span class="event-job-sep">›</span><span class="event-job-name">${esc(ev.jobName)}</span>` : ''}
        </div>
        <div class="event-row-badges">
          ${triggerBadge}
          <span class="event-status-badge event-status-badge--${ev.status}">${statusLabel}</span>
        </div>
      </div>
      ${bodyContent}
      <div class="event-row-footer">
        <span class="event-time" title="${fullDateTime(ev.timestamp)}">${timeAgo(ev.timestamp)}</span>
        ${(ev.agentEnabled === false || ev.autoEnabled === false)
      ? `<span class="event-disabled-badge">disabled</span>` : ''}
        ${hasDetail ? `<button class="event-view-btn" type="button">View output</button>` : ''}
      </div>
    </div>`;

  if (hasDetail) {
    row.querySelector('.event-view-btn')?.addEventListener('click', e => { e.stopPropagation(); openDetail(ev); });
    row.style.cursor = 'pointer';
    row.addEventListener('click', e => { if (!e.target.closest('.event-view-btn')) openDetail(ev); });
  }

  return row;
}

/* ══════════════════════════════════════════
   RENDER HISTORY
══════════════════════════════════════════ */
function renderHistory(historyEvents, newIds = new Set()) {
  feedEl.querySelectorAll('.event-date-header, .event-row:not(.event-row--running)').forEach(el => el.remove());

  const filtered = applyFilter(historyEvents);
  if (!filtered.length) return;

  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86_400_000).toDateString();
  const groups = new Map();

  for (const ev of filtered) {
    const day = new Date(ev.timestamp).toDateString();
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(ev);
  }

  for (const [day, evs] of groups) {
    const header = document.createElement('div');
    header.className = 'event-date-header';
    header.textContent = day === today ? 'Today'
      : day === yesterday ? 'Yesterday'
        : new Date(day).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
    feedEl.appendChild(header);
    for (const ev of evs) feedEl.appendChild(buildEventRow(ev, newIds.has(ev.id)));
  }
}

/* ══════════════════════════════════════════
   RENDER
══════════════════════════════════════════ */
function render(historyEvents, runningJobs, newHistoryIds = new Set()) {
  hide(loadingEl);

  const hasAnything = runningJobs.length > 0 || applyFilter(historyEvents).length > 0;
  if (!hasAnything) { hide(feedEl); show(emptyEl); return; }

  hide(emptyEl);
  show(feedEl);

  // Sync running cards
  const existingRunKeys = new Set(
    Array.from(feedEl.querySelectorAll('.event-row--running')).map(el => el.dataset.runKey)
  );
  const newRunKeys = new Set(runningJobs.map(j => `${j.agentId}__${j.jobId}`));

  feedEl.querySelectorAll('.event-row--running').forEach(el => {
    if (!newRunKeys.has(el.dataset.runKey)) {
      el.classList.add('event-row--finishing');
      setTimeout(() => el.remove(), 400);
    }
  });

  for (const job of runningJobs) {
    const key = `${job.agentId}__${job.jobId}`;
    if (!existingRunKeys.has(key)) {
      const card = buildRunningCard(job);
      const firstHeader = feedEl.querySelector('.event-date-header');
      if (firstHeader) feedEl.insertBefore(card, firstHeader);
      else feedEl.prepend(card);
    }
  }

  // Tick elapsed timers
  feedEl.querySelectorAll('.elapsed-value').forEach(el => {
    const started = el.closest('.event-row--running')?.querySelector('.running-duration')?.dataset?.started;
    if (started) el.textContent = runningDuration(started);
  });

  // Always re-render history so filter clicks work instantly
  renderHistory(historyEvents, newHistoryIds);
}

/* ══════════════════════════════════════════
   DETAIL MODAL
══════════════════════════════════════════ */
function openDetail(ev) {
  detailEyebrow.textContent = ev.type === 'agent' ? 'Agent Output' : 'Automation Run';
  detailTitle.textContent = ev.jobName ? `${ev.source} › ${ev.jobName}` : ev.source;
  detailMeta.textContent = fullDateTime(ev.timestamp);

  let html = '';
  if (ev.status === 'error') {
    html += `<div class="detail-section detail-section--error">
      <div class="detail-section-label">Error</div>
      <div class="detail-error-text">${esc(ev.error)}</div>
    </div>`;
  }
  if (ev.status === 'skipped') {
    html += `<div class="detail-section">
      <div class="detail-section-label">Why was this skipped?</div>
      <div class="detail-skipped-note">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16" style="flex-shrink:0">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01" stroke-linecap="round"/>
        </svg>
        ${esc(ev.skipReason || 'Data source returned nothing to act on.')}
      </div>
    </div>`;
  }
  if (ev.fullResponse) {
    html += `<div class="detail-section">
      <div class="detail-section-label">AI Output</div>
      <div class="detail-response">${esc(ev.fullResponse)}</div>
    </div>`;
  } else if (ev.summary && ev.status === 'success') {
    html += `<div class="detail-section">
      <div class="detail-section-label">Summary</div>
      <div class="detail-response">${esc(ev.summary)}</div>
    </div>`;
  }
  if (ev.trigger) {
    html += `<div class="detail-section">
      <div class="detail-section-label">Trigger</div>
      <div class="detail-meta-pill">${esc(triggerLabel(ev.trigger))}</div>
    </div>`;
  }

  detailBody.innerHTML = html || '<div class="detail-no-content">No additional detail available.</div>';
  detailBackdrop.classList.add('open');
  document.body.classList.add('modal-open');
}

function closeDetail() {
  detailBackdrop.classList.remove('open');
  document.body.classList.remove('modal-open');
}

detailClose?.addEventListener('click', closeDetail);
detailBackdrop?.addEventListener('click', e => { if (e.target === detailBackdrop) closeDetail(); });

/* ══════════════════════════════════════════
   CONFIRM-CLEAR MODAL
══════════════════════════════════════════ */
function openConfirmClear() {
  confirmBackdrop.classList.add('open');
  document.body.classList.add('modal-open');
}

function closeConfirmClear() {
  confirmBackdrop.classList.remove('open');
  document.body.classList.remove('modal-open');
}

async function executeClear() {
  closeConfirmClear();
  _clearing = true;

  try {
    // Wipe data on disk via IPC — this clears job.history in Agents.json
    // and lastRun in Automations.json
    await window.electronAPI?.clearEventsHistory?.();
  } catch (err) {
    console.error('[Events] clearEventsHistory IPC failed:', err);
  }

  // Reset local state
  _historyEvents = [];
  _seenHistoryIds = new Set();

  // Wipe DOM
  feedEl.querySelectorAll('.event-date-header, .event-row:not(.event-row--running)').forEach(el => el.remove());

  // Show empty state if nothing is running
  if (_runningJobs.length === 0) {
    hide(feedEl);
    show(emptyEl);
  }

  zeroStats();

  // Re-enable polling after a short delay so the disk write finishes
  // before we fetch again — avoids stale data sneaking back in
  setTimeout(() => { _clearing = false; }, 800);
}

clearBtn?.addEventListener('click', openConfirmClear);
confirmCancel?.addEventListener('click', closeConfirmClear);
confirmOk?.addEventListener('click', executeClear);
confirmBackdrop?.addEventListener('click', e => { if (e.target === confirmBackdrop) closeConfirmClear(); });

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeDetail(); closeConfirmClear(); }
});

/* ══════════════════════════════════════════
   FILTER BUTTONS
══════════════════════════════════════════ */
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    _filter = btn.dataset.filter;
    render(_historyEvents, _runningJobs);
  });
});

/* ══════════════════════════════════════════
   POLL
══════════════════════════════════════════ */
async function poll() {
  if (_clearing) return;   // don't re-populate while a clear is in flight

  try {
    const [history, running] = await Promise.all([fetchHistory(), fetchRunning()]);

    const newIds = new Set();
    for (const ev of history) {
      if (!_seenHistoryIds.has(ev.id)) {
        newIds.add(ev.id);
        _seenHistoryIds.add(ev.id);
      }
    }

    const historyChanged = _firstLoad || newIds.size > 0;
    const prevRunKeys = _runningJobs.map(r => `${r.agentId}__${r.jobId}`).join(',');
    const nextRunKeys = running.map(r => `${r.agentId}__${r.jobId}`).join(',');
    const runningChanged = prevRunKeys !== nextRunKeys;

    _historyEvents = history;
    _runningJobs = running;

    if (historyChanged || runningChanged) {
      updateStats(history, running);
      render(history, running, _firstLoad ? new Set() : newIds);

      if (!_firstLoad && (newIds.size > 0 || runningChanged)) {
        liveBadge.classList.add('pulse');
        setTimeout(() => liveBadge.classList.remove('pulse'), 1200);
      }
    } else if (running.length > 0) {
      feedEl.querySelectorAll('.elapsed-value').forEach(el => {
        const started = el.closest('.event-row--running')?.querySelector('.running-duration')?.dataset?.started;
        if (started) el.textContent = runningDuration(started);
      });
    }

    if (_firstLoad) { hide(loadingEl); _firstLoad = false; }

  } catch (err) {
    console.error('[Events] poll error:', err);
    if (_firstLoad) { hide(loadingEl); _firstLoad = false; }
  }
}

/* ══════════════════════════════════════════
   BOOT
══════════════════════════════════════════ */
async function start() {
  show(loadingEl);
  hide(emptyEl);
  hide(feedEl);
  await poll();
  _pollTimer = setInterval(poll, POLL_MS);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { clearInterval(_pollTimer); }
  else { poll(); _pollTimer = setInterval(poll, POLL_MS); }
});

start();