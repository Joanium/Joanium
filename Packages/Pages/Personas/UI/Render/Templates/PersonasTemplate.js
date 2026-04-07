export function getPersonasHTML() {
  return /* html */ `
<main id="main" class="personas-main">
  <div class="personas-scroll">
    <div class="personas-page-header">
      <div class="personas-page-header-copy">
        <h2>
          Personas
          <span class="agents-tagline-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M5.5 19a6.5 6.5 0 0113 0" stroke-linecap="round" />
            </svg>
            Voice &amp; Style
          </span>
        </h2>
        <p>Choose a personality for your AI - the active persona shapes every conversation</p>
      </div>
      <span class="page-count" id="personas-count"></span>
    </div>

    <div id="personas-active-banner" class="personas-active-banner" hidden>
      <div class="personas-active-banner-dot"></div>
      <div class="personas-active-banner-text">
        Active persona: <strong id="personas-active-name">Default Assistant</strong>
      </div>
    </div>

    <div id="personas-search-wrapper" class="page-search-wrapper" hidden>
      <div class="page-search-box">
        <svg class="page-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="11" cy="11" r="7" />
          <path d="M16.5 16.5L21 21" stroke-linecap="round" />
        </svg>
        <input id="personas-search" type="text" class="page-search-input" placeholder="Search by name, personality, description..." autocomplete="off" spellcheck="false" />
        <button class="page-search-clear" id="personas-search-clear" type="button" aria-label="Clear search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </div>

    <div id="personas-empty" class="page-empty" hidden>
      <div class="page-empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5.5 19a6.5 6.5 0 0113 0" stroke-linecap="round" />
        </svg>
      </div>
      <h3>No personas yet</h3>
      <p>Install a persona from the Marketplace.</p>
      <button id="personas-go-marketplace" class="page-empty-cta" type="button">Go to Marketplace</button>
    </div>

    <div id="personas-grid" class="personas-grid" hidden></div>
  </div>
</main>

<div id="persona-modal-backdrop">
  <div id="persona-modal">
    <div class="persona-modal-header">
      <div class="persona-modal-title-group">
        <div class="persona-modal-avatar" id="persona-modal-avatar"></div>
        <div class="persona-modal-name" id="persona-modal-name">Persona</div>
      </div>
      <button class="settings-modal-close" id="persona-modal-close" type="button" aria-label="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" />
        </svg>
      </button>
    </div>
    <div class="persona-modal-body">
      <div class="persona-modal-content" id="persona-modal-content"></div>
    </div>
  </div>
</div>
`;
}
