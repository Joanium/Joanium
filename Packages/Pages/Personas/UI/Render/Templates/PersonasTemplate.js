export function getPersonasHTML() {
  return /* html */`
<main id="main" class="personas-main">
  <div class="personas-scroll">
    <div class="personas-page-header">
      <div class="personas-page-header-copy">
        <h2>Personas</h2>
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

    <div id="personas-search-wrapper" class="page-search-wrapper">
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

    <div id="personas-grid" class="personas-grid"></div>
  </div>
</main>
`;
}
