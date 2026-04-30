import { t } from '../../../../../System/I18n/index.js';
export function getEventsHTML() {
  return `
<main id="main" class="events-main">
  <div class="events-scroll">
    <div class="events-page-header">
      <div class="events-page-header-copy">
        <h2>
          ${t('nav.events')}
          <span class="events-live-badge" id="events-live-badge">
            <span class="events-live-dot"></span>
            ${t('events.live')}
          </span>
        </h2>
        <p>${t('events.description')}</p>
      </div>
      <div class="events-header-actions">
        <div class="events-filter-group">
          <button class="events-filter-btn active" data-filter="all">${t('events.filterAll')}</button>
          <button class="events-filter-btn" data-filter="channels">${t('events.filterChannels')}</button>
          <button class="events-filter-btn" data-filter="errors">${t('events.filterErrors')}</button>
        </div>
        <button class="events-clear-btn" id="events-clear-btn" title="Clear event log">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          ${t('events.clear')}
        </button>
      </div>
    </div>

    <div class="events-stats-bar">
      <div class="events-stat">
        <span class="events-stat-value" id="stat-total">-</span>
        <span class="events-stat-label">${t('events.statTotal')}</span>
      </div>
      <div class="events-stat-divider"></div>
      <div class="events-stat">
        <span class="events-stat-value success" id="stat-success">-</span>
        <span class="events-stat-label">${t('events.statSuccessful')}</span>
      </div>
      <div class="events-stat-divider"></div>
      <div class="events-stat">
        <span class="events-stat-value skipped" id="stat-skipped">-</span>
        <span class="events-stat-label">${t('events.statSkipped')}</span>
      </div>
      <div class="events-stat-divider"></div>
      <div class="events-stat">
        <span class="events-stat-value error" id="stat-errors">-</span>
        <span class="events-stat-label">${t('events.statErrors')}</span>
      </div>
      <div class="events-stat-divider"></div>
      <div class="events-stat">
        <span class="events-stat-value" id="stat-agents">-</span>
        <span class="events-stat-label">${t('events.statSources')}</span>
      </div>
    </div>

    <div id="events-loading" class="events-loading">
      <div class="events-shimmer"></div>
      <div class="events-shimmer events-shimmer--wide"></div>
      <div class="events-shimmer events-shimmer--medium"></div>
    </div>

    <div id="events-empty" class="events-empty" hidden>
      <div class="events-empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <h3>${t('events.noEventsYet')}</h3>
      <p>${t('events.noEventsDesc')}</p>
    </div>

    <div id="events-feed" class="events-feed" hidden></div>
  </div>
</main>

<div id="event-detail-backdrop">
  <div id="event-detail-modal" role="dialog" aria-modal="true">
    <div class="event-detail-header">
      <div class="event-detail-title-group">
        <div class="event-detail-eyebrow" id="detail-eyebrow">${t('events.detailEyebrow')}</div>
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
    <h2 class="events-confirm-title">${t('events.clearTitle')}</h2>
    <p class="events-confirm-body">${t('events.clearBody')}</p>
    <div class="events-confirm-actions">
      <button class="events-confirm-btn events-confirm-btn--cancel" id="events-confirm-cancel">${t('events.cancel')}</button>
      <button class="events-confirm-btn events-confirm-btn--ok" id="events-confirm-ok">${t('events.clearConfirm')}</button>
    </div>
  </div>
</div>`;
}
