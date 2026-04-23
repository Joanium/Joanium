import { t } from '../../../../../System/I18n/index.js';
export function getChatHTML() {
  return `
<main id="main" class="chat-workspace">
  <div class="chat-column">
    <section id="project-context-bar" hidden>
      <div class="pcb-row pcb-row-info">
        <div class="pcb-info">
          <svg class="pcb-folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          <span id="project-context-path" class="pcb-path"></span>
          <span class="pcb-chevron">&rsaquo;</span>
          <span id="project-context-title" class="pcb-title"></span>
          <span id="project-context-info" style="display:none"></span>
        </div>
        <div class="pcb-actions">
          <button id="project-open-folder-btn" class="project-secondary-btn" type="button">${t('project.open')}</button>
          <button id="project-exit-btn" class="project-secondary-btn" type="button">${t('project.leave')}</button>
        </div>
      </div>
      <div id="pcb-git-row" class="pcb-row pcb-row-git" hidden>
        <div class="pcb-branch-wrap">
          <button id="pcb-branch-btn" class="pcb-branch-btn" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
            <span id="pcb-branch-label">main</span>
            <svg class="pcb-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" width="10" height="10"><path d="M6 9l6 6 6-6"/></svg>
            <span id="pcb-status-dot" class="pcb-status-dot"></span>
          </button>
          <div id="pcb-branch-dropdown" class="pcb-dropdown" hidden></div>
        </div>
        <div class="pcb-git-actions">
          <button id="pcb-git-action-btn" class="pcb-git-action-btn" data-action="push" type="button">${t('project.push')}</button>
          <button id="pcb-git-action-toggle" class="pcb-git-action-toggle" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><path d="M6 9l6 6 6-6"/></svg></button>
          <div id="pcb-action-dropdown" class="pcb-dropdown" hidden></div>
        </div>
      </div>
      <div id="pcb-commit-popover" class="pcb-commit-popover" hidden>
        <div class="pcb-commit-textarea-wrap">
          <textarea id="pcb-commit-msg" class="pcb-commit-textarea" placeholder="${t('project.commitPlaceholder')}" rows="2"></textarea>
          <button id="pcb-ai-commit-btn" class="pcb-ai-commit-btn" type="button" title="Generate commit message with AI">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="13" height="13">
              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .962L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6"/>
            </svg>
          </button>
        </div>
        <p id="pcb-commit-status" class="pcb-commit-status" hidden></p>
        <div class="pcb-commit-footer">
          <button id="pcb-commit-cancel" class="project-secondary-btn" type="button">${t('project.cancel')}</button>
          <button id="pcb-commit-confirm" class="project-primary-btn" type="button">${t('project.commit')}</button>
        </div>
      </div>
    </section>

    <div id="chat-timeline" class="chat-timeline" aria-hidden="true">
      <div class="chat-timeline-track"></div>
    </div>

    <button id="scroll-to-bottom" class="scroll-to-bottom-btn" data-i18n-title="chat.scrollToBottom" title="${t('chat.scrollToBottom')}" aria-label="${t('chat.scrollToBottom')}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 5v14M5 12l7 7 7-7"/>
      </svg>
    </button>

    <button id="incognito-btn" class="incognito-btn" title="Incognito mode (chats won't be saved)" aria-label="Toggle incognito mode">
      <span class="incognito-btn-icon" aria-hidden="true"></span>
      <span class="incognito-btn-label" aria-hidden="true" data-i18n="chat.private">${t('chat.private')}</span>
    </button>

    <section id="welcome">
      <div class="welcome-greeting">
        <img src="../../../Assets/Logo/Logo.png" alt="Joanium" class="welcome-logo" width="64" height="64">
        <h1 class="welcome-title">Welcome</h1>
      </div>
      <p class="welcome-subtitle" id="welcome-subtitle">Ask me anything.</p>
      <div class="chips welcome-chips" aria-label="Starter prompts"></div>
    </section>

    <section id="chat-view">
      <div class="chat-messages" id="chat-messages"></div>
    </section>

    <div id="input-area">
      <div id="file-diff-panel" hidden></div>
      <div class="input-box">
        <div id="composer-attachments" class="composer-attachments" hidden></div>
        <textarea id="chat-input" placeholder="How can I help you today?" data-i18n-placeholder="chat.placeholder" rows="1" autofocus></textarea>
        <div id="composer-hint" class="composer-hint" aria-live="polite"></div>
        <div class="input-footer">
          <div class="model-selector-wrap">
            <button class="model-selector" id="model-selector-btn">
              <span id="model-label">Loading...</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <div id="model-dropdown"></div>
          </div>
          <div class="input-actions">
            <button class="icon-btn" id="attachment-btn" data-i18n-title="chat.attachFiles" title="${t('chat.attachFiles')}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <button class="icon-btn" id="folder-btn" data-i18n-title="chat.openWorkspace" title="${t('chat.openWorkspace')}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>
              </svg>
            </button>
            <button class="icon-btn" id="enhance-btn" data-i18n-title="chat.enhance" title="${t('chat.enhance')}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="13" height="13">
                <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .962L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6"/>
              </svg>
            </button>
            <button class="send-btn" id="send-btn" data-i18n-title="chat.send" title="${t('chat.send')}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 19V5M5 12l7-7 7 7" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
      <p class="footer-credit">Made with \u2764\ufe0f by <a href="https://joeljolly.vercel.app" target="_blank" rel="noopener noreferrer" class="credit-name">Joel Jolly</a></p>
    </div>
  </div>

  <aside id="browser-preview-panel" class="browser-preview-panel" aria-label="Live browser preview" hidden>
    <div class="browser-preview-card">
      <div class="browser-preview-header">
        <div class="browser-preview-copy">
          <span class="browser-preview-eyebrow" data-i18n="browser.eyebrow">${t('browser.eyebrow')}</span>
          <div class="browser-preview-title-row">
            <h2 id="browser-preview-title" class="browser-preview-title" data-i18n="browser.title">${t('browser.title')}</h2>
            <div class="browser-preview-activity" aria-hidden="true">
              <span class="browser-preview-activity-lights">
                <span></span>
                <span></span>
                <span></span>
              </span>
              <span id="browser-preview-status-dot" class="browser-preview-status-dot is-idle" aria-hidden="true"></span>
            </div>
          </div>
          <p id="browser-preview-url" class="browser-preview-url" data-i18n="browser.urlPlaceholder">${t('browser.urlPlaceholder')}</p>
          <p id="browser-preview-status" class="browser-preview-status-text"></p>
        </div>
      </div>

      <div id="browser-preview-mount" class="browser-preview-mount" aria-hidden="true">
        <div class="browser-preview-viewport" data-browser-preview-viewport="true"></div>
        <div class="browser-preview-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="3"></rect>
            <path d="M8 2v4M16 2v4M3 9h18"></path>
            <path d="M9 14h6M12 11v6"></path>
          </svg>
          <p class="browser-preview-empty-title" data-i18n="browser.emptyTitle">${t('browser.emptyTitle')}</p>
          <p class="browser-preview-empty-copy" data-i18n="browser.emptyCopy">${t('browser.emptyCopy')}</p>
        </div>
      </div>
    </div>
  </aside>
</main>
`;
}

let _dropOverlay = null;
export function ensureDropOverlay() {
  if (!_dropOverlay || !document.body.contains(_dropOverlay))
    return (
      (_dropOverlay = document.createElement('div')),
      (_dropOverlay.className = 'drop-overlay'),
      (_dropOverlay.innerHTML =
        '<div class="drop-overlay-content"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="48" height="48" style="margin-bottom:12px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><h2>Drop files to attach</h2></div>'),
      Object.assign(_dropOverlay.style, {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        opacity: 0,
        pointerEvents: 'none',
        transition: 'opacity 0.2s ease, transform 0.2s ease',
        transform: 'scale(1.02)',
      }),
      document.body.appendChild(_dropOverlay),
      _dropOverlay
    );
}
export function getDropOverlay() {
  return _dropOverlay;
}
