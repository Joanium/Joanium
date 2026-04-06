export const REFRESH_BUTTON_HTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
  <path d="M23 4v6h-6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M1 20v-6h6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke-linecap="round" stroke-linejoin="round"/>
</svg> Refresh`;

export const CLEAR_BUTTON_HTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke-linecap="round" stroke-linejoin="round"/>
</svg> Clear data`;

const INLINE_STYLE_ID = 'usage-inline-styles';

export function ensureUsageStyles() {
  if (document.getElementById(INLINE_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = INLINE_STYLE_ID;
  style.textContent = `
    .usage-refresh-btn {
      padding: 8px 16px;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--bg-tertiary);
      color: var(--text-secondary);
      font-family: var(--font-ui);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: background var(--transition-fast), color var(--transition-fast);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .usage-refresh-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
    .usage-refresh-btn svg { width: 13px; height: 13px; }
    .usage-refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    #insights-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 12px;
    }
    .insight-card {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 14px 16px;
      background: var(--bg-tertiary); border: 1px solid var(--border-subtle);
      border-radius: 16px;
      animation: cardIn 0.4s var(--ease-out-expo) both;
      transition: border-color var(--transition-fast), transform var(--transition-fast);
    }
    .insight-card:hover { border-color: color-mix(in srgb, var(--accent) 25%, var(--border)); transform: translateY(-1px); }
    .insight-icon {
      min-width: 36px; height: 36px; border-radius: 12px;
      background: var(--accent-dim); border: 1px solid color-mix(in srgb, var(--accent) 24%, transparent);
      color: var(--accent); display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700; letter-spacing: 0.3px;
      flex-shrink: 0; line-height: 1; text-transform: uppercase;
    }
    .insight-body { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .insight-title { font-size: 10.5px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: var(--text-muted); }
    .insight-text { font-size: 13px; color: var(--text-secondary); line-height: 1.5; }
    .insight-text strong { color: var(--text-primary); font-weight: 600; }
    .insight-empty { font-size: 13px; color: var(--text-muted); padding: 16px; }

    #heatmap-wrap { display: grid; grid-template-columns: repeat(24, 1fr); gap: 4px; }
    .heatmap-cell { position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: default; }
    .heatmap-cell::before { content: ''; display: block; width: 100%; aspect-ratio: 1; border-radius: 5px; background: var(--accent); opacity: var(--cell-opacity, 0.05); transition: opacity 0.2s, transform 0.15s; }
    .heatmap-cell:hover::before { transform: scaleY(1.1); }
    .heatmap-label { font-size: 7.5px; color: var(--text-muted); font-family: var(--font-mono); white-space: nowrap; }
    .heatmap-count { position: absolute; top: 2px; left: 50%; transform: translateX(-50%); font-size: 7px; color: #fff; font-weight: 700; font-family: var(--font-mono); pointer-events: none; }

    #dow-wrap { display: flex; flex-direction: column; gap: 8px; }
    .dow-row { display: grid; grid-template-columns: 36px 1fr 80px 60px; align-items: center; gap: 10px; }
    .dow-label { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
    .dow-bar-track { height: 8px; background: var(--bg-tertiary); border-radius: 999px; overflow: hidden; }
    .dow-bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 60%, #7c5dff)); transition: width 0.5s var(--ease-out-expo); }
    .dow-stat { font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); text-align: right; }
    .dow-cost { font-size: 11px; color: var(--accent); font-family: var(--font-mono); text-align: right; }

    #cost-table-body { display: flex; flex-direction: column; gap: 10px; }
    .cost-row { display: grid; grid-template-columns: 22px 1fr 120px; align-items: center; gap: 12px; padding: 10px 12px; background: var(--bg-tertiary); border: 1px solid var(--border-subtle); border-radius: 12px; transition: border-color var(--transition-fast), transform var(--transition-fast); }
    .cost-row:hover { border-color: color-mix(in srgb, var(--accent) 20%, var(--border)); transform: translateX(2px); }
    .cost-row-rank { font-size: 11px; font-weight: 700; color: var(--text-muted); font-family: var(--font-mono); }
    .cost-row-info { min-width: 0; }
    .cost-row-name { font-size: 13px; font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cost-row-meta { font-size: 10.5px; color: var(--text-muted); margin-top: 2px; }
    .cost-row-bar-wrap { height: 6px; background: var(--bg-secondary); border-radius: 999px; overflow: hidden; margin-top: 6px; }
    .cost-row-bar { height: 100%; border-radius: 999px; background: var(--accent); opacity: 0.75; transition: width 0.5s var(--ease-out-expo); }
    .cost-row-figures { text-align: right; }
    .cost-row-total { font-size: 13px; font-weight: 600; color: var(--accent); font-family: var(--font-mono); }
    .cost-row-share { font-size: 10.5px; color: var(--text-muted); margin-top: 2px; }
    .cost-empty { font-size: 13px; color: var(--text-muted); padding: 12px 0; }

    .usage-two-col { display: grid; grid-template-columns: 1.6fr 1fr; gap: 18px; margin-bottom: 18px; }
    @media (max-width: 900px) {
      .usage-two-col { grid-template-columns: 1fr; }
      .cost-row { grid-template-columns: 22px 1fr; }
      .cost-row-figures { grid-column: 2; }
    }
  `;
  document.head.appendChild(style);
}

export function getHTML(REFRESH_HTML, CLEAR_HTML) {
  return /* html */ `
<main id="main" class="usage-main">
  <div class="usage-scroll">
    <div class="usage-page-header">
      <div class="usage-page-header-copy">
        <h2>
          Usage
          <span class="agents-tagline-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M3 3v18h18" stroke-linecap="round" />
              <path d="M7 16V10M12 16V6M17 16v-5" stroke-linecap="round" />
            </svg>
            Tokens &amp; Spend
          </span>
        </h2>
        <p>Token consumption and model analytics</p>
      </div>
      <div class="usage-header-actions">
        <div class="usage-range-btns">
          <button class="usage-range-btn active" data-range="today">Today</button>
          <button class="usage-range-btn" data-range="7">7 days</button>
          <button class="usage-range-btn" data-range="30">30 days</button>
          <button class="usage-range-btn" data-range="all">All time</button>
        </div>
        <button class="usage-refresh-btn" id="refresh-btn">${REFRESH_HTML}</button>
        <button class="usage-clear-btn" id="clear-usage-btn">${CLEAR_HTML}</button>
      </div>
    </div>

    <div class="usage-summary-grid" id="summary-grid"></div>

    <div class="usage-section-full" id="insights-section">
      <div class="usage-section-header">
        <span class="usage-section-title">Insights</span>
        <span class="usage-section-meta">auto-generated</span>
      </div>
      <div id="insights-list"></div>
    </div>

    <div class="usage-sections">
      <div class="usage-section" id="chart-section">
        <div class="usage-section-header">
          <span class="usage-section-title" id="chart-title">Daily token usage</span>
          <span class="usage-section-meta" id="chart-meta"></span>
        </div>
        <div class="usage-chart-wrap" id="chart-wrap"></div>
      </div>
      <div class="usage-section" id="provider-section">
        <div class="usage-section-header">
          <span class="usage-section-title">Provider breakdown</span>
        </div>
        <div class="provider-grid" id="provider-grid"></div>
      </div>
    </div>

    <div class="usage-two-col">
      <div class="usage-section" id="heatmap-section">
        <div class="usage-section-header">
          <span class="usage-section-title">Hourly activity</span>
          <span class="usage-section-meta">24h distribution</span>
        </div>
        <div id="heatmap-wrap"></div>
      </div>
      <div class="usage-section" id="dow-section">
        <div class="usage-section-header">
          <span class="usage-section-title">Day of week</span>
          <span class="usage-section-meta">call volume</span>
        </div>
        <div id="dow-wrap"></div>
      </div>
    </div>

    <div class="usage-section-full" id="cost-table-section">
      <div class="usage-section-header">
        <span class="usage-section-title">Cost by model</span>
        <span class="usage-section-meta">top 10</span>
      </div>
      <div id="cost-table-body"></div>
    </div>

    <div class="usage-section-full" id="model-section">
      <div class="usage-section-header">
        <span class="usage-section-title">Model breakdown</span>
        <span class="usage-section-meta" id="model-meta"></span>
      </div>
      <div id="model-rows" class="model-rows"></div>
    </div>

    <div class="usage-section-full" id="activity-section">
      <div class="usage-section-header">
        <span class="usage-section-title">Recent activity</span>
        <span class="usage-section-meta" id="activity-meta"></span>
      </div>
      <div id="activity-list" class="activity-list"></div>
    </div>
  </div>
</main>

<div class="usage-confirm-overlay" id="confirm-overlay">
  <div class="usage-confirm-box">
    <h3>Clear all usage data?</h3>
    <p>This will permanently delete all token usage history. This action cannot be undone.</p>
    <div class="usage-confirm-actions">
      <button class="usage-confirm-cancel" id="confirm-cancel">Cancel</button>
      <button class="usage-confirm-delete" id="confirm-delete">Clear data</button>
    </div>
  </div>
</div>
`;
}
