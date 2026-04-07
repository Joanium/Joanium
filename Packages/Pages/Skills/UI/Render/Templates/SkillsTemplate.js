export function getHTML() {
  return /* html */ `
<main id="main">
  <div class="skills-main">
    <div class="skills-scroll">
      <div class="skills-page-header">
        <div class="skills-page-header-copy">
          <h2>
            Skills
            <span class="agents-tagline-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              Context &amp; Tools
            </span>
          </h2>
          <p>Enable skills to add specialised capabilities to every chat. Disabled skills are never injected into the AI context.</p>
        </div>

        <div class="skills-header-actions">
          <span id="skills-count" class="page-count">0 skills</span>
          <span id="skills-enabled-count" class="skills-enabled-count">None active</span>
          <button id="skills-enable-all" class="skills-bulk-btn skills-bulk-btn--enable" disabled>Enable all</button>
          <button id="skills-disable-all" class="skills-bulk-btn" disabled>Disable all</button>
        </div>
      </div>

      <div id="skills-search-wrapper" class="page-search-wrapper" hidden>
        <div class="page-search-box">
          <svg class="page-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="11" cy="11" r="7" />
            <path d="M16.5 16.5L21 21" stroke-linecap="round" />
          </svg>
          <input type="text" id="skills-search" class="page-search-input" placeholder="Search skills..." autocomplete="off" spellcheck="false" />
          <button id="skills-search-clear" class="page-search-clear" type="button" aria-label="Clear search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div id="skills-empty" class="page-empty" hidden>
        <div class="page-empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <h3>No skills yet</h3>
        <p>Install a skill from the Marketplace.</p>
        <button id="skills-go-marketplace" class="page-empty-cta" type="button">Go to Marketplace</button>
      </div>

      <div id="skills-grid" class="skills-grid" hidden></div>
    </div>
  </div>
</main>

<div id="skill-modal-backdrop">
  <div id="skill-modal">
    <div class="skill-modal-header">
      <div class="skill-modal-title-group">
        <div class="skill-modal-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <div class="skill-modal-name" id="skill-modal-name">Skill</div>
      </div>
      <button class="settings-modal-close" id="skill-modal-close" type="button" aria-label="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" />
        </svg>
      </button>
    </div>
    <div class="skill-modal-body">
      <div class="skill-modal-content" id="skill-modal-content"></div>
    </div>
  </div>
</div>
`;
}
