export function getEventsHTML() {
  return `
<main id="main" class="events-main">
  <div class="events-scroll">
    <div class="events-page-header">
      <div class="events-page-header-copy">
        <h2>
          Events
          <span class="events-live-badge" id="events-live-badge">
            <span class="events-live-dot"></span>
            Live
          </span>
        </h2>
        <p>Real-time log of every automation and agent run - successes, failures, and what happened.</p>
      </div>
      <div class="events-header-actions">
        <div class="events-filter-group">
          <button class="events-filter-btn active" data-filter="all">All</button>
          <button class="events-filter-btn" data-filter="agents">Agents</button>
          <button class="events-filter-btn" data-filter="automations">Automations</button>
          <button class="events-filter-btn" data-filter="errors">Errors</button>
        </div>
        <button class="events-clear-btn" id="events-clear-btn" title="Clear event log">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          Clear
        </button>
      </div>
    </div>

    <div class="events-stats-bar">
      <div class="events-stat">
        <span class="events-stat-value" id="stat-total">-</span>
        <span class="events-stat-label">Total runs</span>
      </div>
      <div class="events-stat-divider"></div>
      <div class="events-stat">
        <span class="events-stat-value success" id="stat-success">-</span>
        <span class="events-stat-label">Successful</span>
      </div>
      <div class="events-stat-divider"></div>
      <div class="events-stat">
        <span class="events-stat-value skipped" id="stat-skipped">-</span>
        <span class="events-stat-label">Skipped</span>
      </div>
      <div class="events-stat-divider"></div>
      <div class="events-stat">
        <span class="events-stat-value error" id="stat-errors">-</span>
        <span class="events-stat-label">Errors</span>
      </div>
      <div class="events-stat-divider"></div>
      <div class="events-stat">
        <span class="events-stat-value" id="stat-agents">-</span>
        <span class="events-stat-label">Active agents</span>
      </div>
    </div>

    <div id="events-loading" class="events-loading">
      <div class="events-shimmer"></div>
      <div class="events-shimmer" style="width:85%"></div>
      <div class="events-shimmer" style="width:70%"></div>
    </div>

    <div id="events-empty" class="events-empty" style="display:none">
      <div class="events-empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <h3>No events yet</h3>
      <p>Events will appear here as your automations and agents run. Create an automation or agent and run it to see live logs.</p>
    </div>

    <div id="events-feed" class="events-feed" style="display:none"></div>
  </div>
</main>

<div id="event-detail-backdrop">
  <div id="event-detail-modal" role="dialog" aria-modal="true">
    <div class="event-detail-header">
      <div class="event-detail-title-group">
        <div class="event-detail-eyebrow" id="detail-eyebrow">Event Details</div>
        <h2 id="detail-title">-</h2>
        <div class="event-detail-timestamp" id="detail-meta"></div>
      </div>
      <button class="settings-modal-close" id="event-detail-close" type="button" aria-label="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" />
        </svg>
      </button>
    </div>

    <div class="event-detail-body" id="detail-body"></div>
  </div>
</div>

<div id="events-confirm-backdrop" class="modal-backdrop">
  <div class="modal-panel events-confirm-modal">
    <div class="events-confirm-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="28" height="28">
        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>
    <h2 class="events-confirm-title">Clear all events?</h2>
    <p class="events-confirm-body">
      This will permanently delete all run history for every agent and automation.
      Events from future runs will still appear here.
    </p>
    <div class="events-confirm-actions">
      <button class="events-confirm-btn events-confirm-btn--cancel" id="events-confirm-cancel">Cancel</button>
      <button class="events-confirm-btn events-confirm-btn--ok" id="events-confirm-ok">Clear all</button>
    </div>
  </div>
</div>`;
}
