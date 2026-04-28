import { t } from '../../../../../System/I18n/index.js';

export function getTemplatesHTML() {
  return /* html */ `
<div class="templates-page">

  <div class="templates-scroll">

    <!-- Page header -->
    <div class="page-tagline-header">
      <div class="page-tagline-left">
        <h1 class="page-tagline-title">
          ${t('templates.title')}
          <span class="page-tagline-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                 width="12" height="12">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
              <path d="M9 12h6M9 16h4" stroke-linecap="round"/>
            </svg>
            ${t('templates.tagline')}
          </span>
        </h1>
        <p class="page-tagline-desc">${t('templates.description')}</p>
      </div>
      <div class="page-tagline-right">
        <button class="templates-add-btn" id="templates-add-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          ${t('templates.newTemplate')}
        </button>
      </div>
    </div>

    <!-- Search bar -->
    <div class="templates-search-wrapper" id="templates-search-wrapper" hidden>
      <svg class="templates-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input type="text" id="templates-search"
             placeholder="${t('templates.searchPlaceholder')}"
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
      <h2>${t('templates.noTemplatesYet')}</h2>
      <p>${t('templates.noTemplatesDesc')}</p>
      <button class="shared-empty-cta" id="templates-create-first">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="width:14px;height:14px"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>
        ${t('templates.createFirst')}
      </button>
    </div>

  </div><!-- /.templates-scroll -->

  <!-- Create / Edit modal — moved to <body> on mount for z-index coverage -->
  <div class="templates-modal-backdrop" id="templates-modal-backdrop">
    <div class="templates-modal" role="dialog" aria-modal="true" aria-labelledby="templates-modal-eyebrow">
      <div class="templates-modal-header">
        <span class="templates-modal-eyebrow" id="templates-modal-eyebrow">${t('templates.eyebrow')}</span>
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
            ${t('templates.triggerLabel')}
          </label>
          <div class="templates-trigger-input-wrapper">
            <span class="templates-trigger-prefix">/</span>
            <input type="text" id="templates-trigger-input"
                   placeholder="${t('templates.triggerPlaceholder')}"
                   autocomplete="off" spellcheck="false" />
          </div>
          <span class="templates-trigger-hint" id="templates-trigger-hint"></span>
        </div>

        <div>
          <label class="templates-label" for="templates-label-input">
            ${t('templates.labelLabel')}
          </label>
          <input class="templates-field" type="text" id="templates-label-input"
                 placeholder="${t('templates.labelPlaceholder')}" autocomplete="off" />
        </div>

        <div>
          <label class="templates-label" for="templates-desc-input">
            ${t('templates.descriptionLabel')}
            <span class="templates-optional">(${t('templates.optional')})</span>
          </label>
          <input class="templates-field" type="text" id="templates-desc-input"
                 placeholder="${t('templates.descriptionPlaceholder')}" autocomplete="off" />
        </div>

        <div>
          <label class="templates-label" for="templates-prompt-input">
            ${t('templates.promptLabel')}
          </label>
          <textarea class="templates-field templates-prompt-textarea"
                    id="templates-prompt-input" rows="7"
                    placeholder="${t('templates.promptPlaceholder')}"></textarea>
        </div>

      </div>

      <div class="templates-modal-footer">
        <button id="templates-modal-cancel" class="templates-modal-cancel-btn">
          ${t('templates.cancel')}
        </button>
        <button id="templates-modal-save" class="templates-modal-save-btn">
          ${t('templates.saveTemplate')}
        </button>
      </div>
    </div>
  </div>

</div>
`;
}
