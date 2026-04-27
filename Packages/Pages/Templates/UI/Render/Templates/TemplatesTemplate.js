export function getTemplatesHTML() {
  return /* html */ `
<div class="templates-page">

  <div class="templates-scroll">

    <!-- Page header -->
    <div class="page-tagline-header">
      <div class="page-tagline-left">
        <span class="page-tagline-badge">Templates</span>
        <h1 class="page-tagline-title" data-i18n="templates.title">Templates</h1>
        <p class="page-tagline-desc" data-i18n="templates.description">
          Save reusable prompts as /slash triggers. Type the trigger in chat and the prompt expands instantly.
        </p>
      </div>
      <div class="page-tagline-right">
        <span class="page-tagline-count" id="templates-count">0 templates</span>
        <button class="templates-add-btn" id="templates-add-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Template
        </button>
      </div>
    </div>

    <!-- Search bar -->
    <div class="templates-search-wrapper" id="templates-search-wrapper" hidden>
      <svg class="templates-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input type="text" id="templates-search" placeholder="Search slash triggers..."
             class="templates-search-input" autocomplete="off" spellcheck="false" />
      <button id="templates-search-clear" class="templates-search-clear" aria-label="Clear search">×</button>
    </div>

    <!-- Cards grid -->
    <div class="templates-grid" id="templates-grid" hidden></div>

    <!-- Empty state -->
    <div class="templates-empty" id="templates-empty" hidden>
      <div class="shared-empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"
             stroke-linecap="round" stroke-linejoin="round" width="40" height="40">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M9 3v18"/><path d="M3 9h6"/><path d="M3 15h6"/>
        </svg>
      </div>
      <h2 data-i18n="templates.noTemplatesYet">No templates yet</h2>
      <p data-i18n="templates.noTemplatesDesc">
        Create your first template to save a reusable /slash prompt trigger.
      </p>
      <button class="shared-empty-cta" id="templates-create-first">
        Create your first template
      </button>
    </div>

  </div><!-- /.templates-scroll -->

  <!-- Create / Edit modal — moved to <body> on mount for z-index coverage -->
  <div class="templates-modal-backdrop" id="templates-modal-backdrop">
    <div class="templates-modal" role="dialog" aria-modal="true" aria-labelledby="templates-modal-eyebrow">
      <div class="templates-modal-header">
        <span class="templates-modal-eyebrow" id="templates-modal-eyebrow">Template</span>
        <button id="templates-modal-close" class="templates-modal-close" aria-label="Close modal">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="templates-modal-body">

        <div>
          <label class="templates-label" for="templates-trigger-input">
            Slash Trigger
          </label>
          <div class="templates-trigger-input-wrapper">
            <span class="templates-trigger-prefix">/</span>
            <input type="text" id="templates-trigger-input"
                   placeholder="test" autocomplete="off" spellcheck="false" />
          </div>
          <span class="templates-trigger-hint" id="templates-trigger-hint"></span>
        </div>

        <div>
          <label class="templates-label" for="templates-label-input">Label</label>
          <input class="templates-field" type="text" id="templates-label-input"
                 placeholder="Test Prompt" autocomplete="off" />
        </div>

        <div>
          <label class="templates-label" for="templates-desc-input">
            Description <span class="templates-optional">(optional)</span>
          </label>
          <input class="templates-field" type="text" id="templates-desc-input"
                 placeholder="What this template does" autocomplete="off" />
        </div>

        <div>
          <label class="templates-label" for="templates-prompt-input">Prompt</label>
          <textarea class="templates-field templates-prompt-textarea"
                    id="templates-prompt-input" rows="7"
                    placeholder="The full prompt text that will replace /trigger in the chat composer..."></textarea>
        </div>

      </div>

      <div class="templates-modal-footer">
        <button id="templates-modal-cancel" class="templates-modal-cancel-btn">Cancel</button>
        <button id="templates-modal-save" class="templates-modal-save-btn">Save Template</button>
      </div>
    </div>
  </div>

</div>
`;
}
