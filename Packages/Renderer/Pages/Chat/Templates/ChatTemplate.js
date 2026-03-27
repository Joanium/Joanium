/**
 * Returns the main page HTML for the Chat page.
 * Injected as outlet.innerHTML by Chat.js mount().
 */
export function getChatHTML() {
  return /* html */`
<main id="main" class="chat-workspace">
  <div class="chat-column">
    <section id="project-context-bar" hidden>
      <div class="project-context-compact">
        <div class="project-compact-info">
          <span id="project-context-title" class="project-compact-title"></span>
          <span class="project-divider">/</span>
          <span id="project-context-path" class="project-compact-path"></span>
          <span id="project-context-info" style="display:none"></span>
        </div>
        <div class="project-compact-actions">
          <button id="project-open-folder-btn" class="project-secondary-btn" type="button">Open</button>
          <button id="project-exit-btn" class="project-secondary-btn" type="button">Leave</button>
        </div>
      </div>
    </section>

    <div id="chat-timeline" class="chat-timeline" aria-hidden="true">
      <div class="chat-timeline-track"></div>
    </div>

    <button id="scroll-to-bottom" class="scroll-to-bottom-btn" title="Scroll to bottom" aria-label="Scroll to bottom">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 5v14M5 12l7 7 7-7"/>
      </svg>
    </button>

    <section id="welcome">
      <div class="welcome-greeting">
        <svg class="welcome-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 2L8 6H4v4L2 12l2 2v4h4l4 4 4-4h4v-4l2-2-2-2V6h-4L12 2z" stroke-width="1.4"/>
        </svg>
        <h1 class="welcome-title">Welcome</h1>
      </div>
      <p class="welcome-subtitle" id="welcome-subtitle">Ask me anything.</p>
      <div class="chips welcome-chips" aria-label="Starter prompts">
        <button class="chip" type="button" data-prompt="Summarize this project and point out the top 3 things I should improve next.">Review this project</button>
        <button class="chip" type="button" data-prompt="Help me debug an issue in this app. Ask for the files you need and guide me step by step.">Debug this app</button>
        <button class="chip" type="button" data-prompt="Plan the next feature for this project with milestones, risks, and a clean implementation order.">Plan a feature</button>
        <button class="chip" type="button" data-prompt="Write a focused to-do list for what I should work on next based on this project.">What should I build?</button>
      </div>
    </section>

    <section id="chat-view">
      <div class="chat-messages" id="chat-messages"></div>
    </section>

    <div id="input-area">
      <div class="input-box">
        <div id="composer-attachments" class="composer-attachments" hidden></div>
        <textarea id="chat-input" placeholder="How can I help you today?" rows="1" autofocus></textarea>
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
            <button class="icon-btn" id="attachment-btn" title="Attach files">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <button class="icon-btn" id="folder-btn" title="Open Workspace Folder">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>
              </svg>
            </button>
            <button class="icon-btn" id="enhance-btn" title="Enhance prompt">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="13" height="13">
                <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .962L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6"/>
              </svg>
            </button>
            <button class="send-btn" id="send-btn" title="Send">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 19V5M5 12l7-7 7 7" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
      <p class="footer-credit">Made with love by <a href="https://joeljolly.vercel.app" target="_blank" rel="noopener noreferrer" class="credit-name">Joel Jolly</a></p>
    </div>
  </div>

  <aside id="browser-preview-panel" class="browser-preview-panel" aria-label="Live browser preview" hidden>
    <div class="browser-preview-card">
      <div class="browser-preview-header">
        <div class="browser-preview-copy">
          <span class="browser-preview-eyebrow">Live Browser</span>
          <div class="browser-preview-title-row">
            <h2 id="browser-preview-title" class="browser-preview-title">Built-in Browser</h2>
            <div class="browser-preview-activity" aria-hidden="true">
              <span class="browser-preview-activity-lights">
                <span></span>
                <span></span>
                <span></span>
              </span>
              <span id="browser-preview-status-dot" class="browser-preview-status-dot is-idle" aria-hidden="true"></span>
            </div>
          </div>
          <p id="browser-preview-url" class="browser-preview-url">AI browser activity will appear here once Evelina starts navigating.</p>
          <p id="browser-preview-status" class="browser-preview-status-text"></p>
        </div>
        <div class="browser-preview-actions">
          <button id="browser-preview-toggle-btn" class="browser-preview-action browser-preview-action--primary" type="button" disabled>Waiting</button>
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
          <p class="browser-preview-empty-title">Watch the AI browser work live</p>
          <p class="browser-preview-empty-copy">Ask Evelina to open a site, search, compare options, or fill a form and the live page will show up here.</p>
        </div>
      </div>
    </div>
  </aside>
</main>
`;
}

/** Create the drag-and-drop overlay once and attach it to document.body. */
let _dropOverlay = null;
export function ensureDropOverlay() {
  if (_dropOverlay && document.body.contains(_dropOverlay)) return;
  _dropOverlay = document.createElement('div');
  _dropOverlay.className = 'drop-overlay';
  _dropOverlay.innerHTML = '<div class="drop-overlay-content"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="48" height="48" style="margin-bottom:12px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><h2>Drop files to attach</h2></div>';
  Object.assign(_dropOverlay.style, {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999, opacity: 0, pointerEvents: 'none',
    transition: 'opacity 0.2s ease, transform 0.2s ease', transform: 'scale(1.02)',
  });
  document.body.appendChild(_dropOverlay);
  return _dropOverlay;
}

export function getDropOverlay() {
  return _dropOverlay;
}