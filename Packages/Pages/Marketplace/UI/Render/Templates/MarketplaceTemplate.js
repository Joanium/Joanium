export function getMarketplaceHTML() {
  return /* html */ `
<main id="main" class="marketplace-main">
  <div class="marketplace-scroll">
    <div class="marketplace-page-header">
      <div class="marketplace-page-header-copy">
        <h2>
          Marketplace
          <span class="agents-tagline-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M4 7.5h16l-1.3 10.4a2 2 0 0 1-1.98 1.85H7.28A2 2 0 0 1 5.3 17.9L4 7.5z" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M8 7.5V6a4 4 0 0 1 8 0v1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            Skills &amp; Personas
          </span>
        </h2>
        <p>Browse the live Joanium marketplace, read full files, and install new skills or personas into your local library.</p>
      </div>

      <div class="marketplace-header-actions">
        <span id="marketplace-count" class="page-count">0 items</span>
        <span id="marketplace-source" class="marketplace-source-pill" hidden></span>
      </div>
    </div>

    <div class="marketplace-tabs" role="tablist" aria-label="Marketplace type">
      <button id="marketplace-tab-skills" class="marketplace-tab is-active" type="button" data-type="skills" role="tab" aria-selected="true">Skills</button>
      <button id="marketplace-tab-personas" class="marketplace-tab" type="button" data-type="personas" role="tab" aria-selected="false">Personas</button>
    </div>

    <div class="marketplace-controls">
      <div id="marketplace-search-wrapper" class="page-search-wrapper">
        <div class="page-search-box marketplace-search-box">
          <svg class="page-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="11" cy="11" r="7" />
            <path d="M16.5 16.5L21 21" stroke-linecap="round" />
          </svg>
          <input type="text" id="marketplace-search" class="page-search-input" placeholder="Search marketplace..." autocomplete="off" spellcheck="false" />
          <button id="marketplace-search-clear" class="page-search-clear" type="button" aria-label="Clear search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div class="marketplace-control-row">
        <div class="marketplace-filter-group" role="tablist" aria-label="Publisher filter">
          <button class="marketplace-filter-chip is-active" type="button" data-filter="all">All</button>
          <button class="marketplace-filter-chip" type="button" data-filter="verified">Verified</button>
          <button class="marketplace-filter-chip" type="button" data-filter="community">Community</button>
        </div>

        <label class="marketplace-sort">
          <span>Sort</span>
          <select id="marketplace-sort">
            <option value="az">A-Z</option>
            <option value="za">Z-A</option>
            <option value="newest">Newest</option>
          </select>
        </label>
      </div>
    </div>

    <div id="marketplace-error" class="marketplace-error" hidden></div>

    <div id="marketplace-empty" class="page-empty" hidden>
      <div class="page-empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M4 7.5h16l-1.3 10.4a2 2 0 0 1-1.98 1.85H7.28A2 2 0 0 1 5.3 17.9L4 7.5z" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M8 7.5V6a4 4 0 0 1 8 0v1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <h3 id="marketplace-empty-title">Nothing to show</h3>
      <p id="marketplace-empty-copy">Try a broader search, switch filters, or come back after the marketplace finishes loading.</p>
    </div>

    <div id="marketplace-grid" class="marketplace-grid" hidden></div>

    <div id="marketplace-loading" class="marketplace-loading" hidden>
      <div class="marketplace-loading-spinner"></div>
      <span id="marketplace-loading-copy">Loading marketplace...</span>
    </div>

    <div id="marketplace-sentinel" class="marketplace-sentinel" hidden aria-hidden="true"></div>
  </div>
</main>

<div id="marketplace-modal-backdrop">
  <div id="marketplace-modal">
    <div class="marketplace-modal-header">
      <div class="marketplace-modal-title-group">
        <div class="marketplace-modal-icon" id="marketplace-modal-icon"></div>
        <div class="marketplace-modal-title-copy">
          <div class="marketplace-modal-name-row">
            <div class="marketplace-modal-name" id="marketplace-modal-name">Marketplace Item</div>
            </div>
          <div id="marketplace-modal-meta" class="marketplace-modal-meta">
            <span id="marketplace-modal-verified" class="marketplace-verified-pill" hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 12.75l2.25 2.25L15 9.75" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M12 3l2.6 1.2 2.84-.34 1.2 2.6 2.36 1.62-.8 2.74.8 2.74-2.36 1.62-1.2 2.6-2.84-.34L12 21l-2.6-1.2-2.84.34-1.2-2.6L3 15.92l.8-2.74L3 10.44l2.36-1.62 1.2-2.6 2.84.34L12 3z" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              Verified
            </span>
          </div>
        </div>
      </div>

      <div class="marketplace-modal-actions">
        <button id="marketplace-modal-install" class="marketplace-install-btn" type="button">Install</button>
        <button class="settings-modal-close" id="marketplace-modal-close" type="button" aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" />
          </svg>
        </button>
      </div>
    </div>

    <div class="marketplace-modal-body">
      <div id="marketplace-modal-status" class="marketplace-modal-status" hidden></div>
      <div id="marketplace-modal-content" class="marketplace-modal-content"></div>
    </div>
  </div>
</div>
`;
}
