import { createModal } from '../System/ModalFactory.js';

// ── Slash commands reference ────────────────────────────────────────────────
const SLASH_SECTIONS = [
  {
    title: 'Actions',
    commands: [
      { cmd: '/new', desc: 'Start a fresh conversation' },
      { cmd: '/private', desc: 'Start an incognito session \u2014 nothing is saved' },
      { cmd: '/settings', desc: 'Open workspace settings' },
      { cmd: '/close', desc: 'Quit Joanium' },
      { cmd: '/restart', desc: 'Restart (relaunch) Joanium' },
      { cmd: '/help', desc: 'Show this help panel' },
    ],
  },
  {
    title: 'Navigate',
    commands: [
      { cmd: '/skills', desc: 'Go to the Skills library' },
      { cmd: '/personas', desc: 'Go to Personas' },
      { cmd: '/marketplace', desc: 'Go to the Marketplace' },
      { cmd: '/usage', desc: 'Go to Usage & billing' },
      { cmd: '/events', desc: 'Go to automation Events' },
    ],
  },
];

// ── Keyboard shortcuts reference ────────────────────────────────────────────
const SHORTCUT_SECTIONS = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['Ctrl', 'N'], desc: 'New chat' },
      { keys: ['Ctrl', 'P'], desc: 'Open Projects' },
      { keys: ['Ctrl', ','], desc: 'Open Settings' },
      { keys: ['Ctrl', '/'], desc: 'Open Help' },
    ],
  },
  {
    title: 'Chat',
    shortcuts: [
      { keys: ['Enter'], desc: 'Send message' },
      { keys: ['Shift', 'Enter'], desc: 'New line in message' },
      { keys: ['Ctrl', 'L'], desc: 'Focus message input' },
      { keys: ['Esc'], desc: 'Dismiss dialog / stop' },
    ],
  },
  {
    title: 'Workspace',
    shortcuts: [
      { keys: ['Ctrl', 'Shift', 'M'], desc: 'Open Marketplace' },
      { keys: ['Ctrl', 'Shift', 'S'], desc: 'Open Skills' },
      { keys: ['Ctrl', 'Shift', 'P'], desc: 'Open Personas' },
    ],
  },
];

// ── Render helpers ──────────────────────────────────────────────────────────
function buildSlashSection({ title, commands }) {
  return `
    <div class="help-section">
      <h4 class="help-section-title">${title}</h4>
      <div class="help-rows">
        ${commands
          .map(
            ({ cmd, desc }) => `
          <div class="help-row">
            <code class="help-cmd">${cmd}</code>
            <span class="help-desc">${desc}</span>
          </div>`,
          )
          .join('')}
      </div>
    </div>`;
}

function buildShortcutSection({ title, shortcuts }) {
  return `
    <div class="help-section">
      <h4 class="help-section-title">${title}</h4>
      <div class="help-rows">
        ${shortcuts
          .map(
            ({ keys, desc }) => `
          <div class="help-row">
            <span class="help-keys">${keys.map((k) => `<kbd>${k}</kbd>`).join('')}</span>
            <span class="help-desc">${desc}</span>
          </div>`,
          )
          .join('')}
      </div>
    </div>`;
}

// ── Modal ───────────────────────────────────────────────────────────────────
export function initHelpModal() {
  const modal = createModal({
    backdropId: 'help-modal-backdrop',
    html: `
    <div id="help-modal-backdrop">
      <div id="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-modal-title">

        <div class="help-modal-header">
          <div class="help-modal-title-wrap">
            <svg class="help-modal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
                 width="20" height="20" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <h2 id="help-modal-title">Help &amp; Shortcuts</h2>
          </div>
          <button class="settings-modal-close help-modal-close"
                  id="help-modal-close" type="button" aria-label="Close help">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12"
                    stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>
            </svg>
          </button>
        </div>

        <div class="help-modal-body">
          <div class="help-col">

            <div class="help-col-header">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                   stroke-linecap="round" stroke-linejoin="round" width="14" height="14"
                   aria-hidden="true">
                <line x1="7" y1="20" x2="17" y2="4"/>
              </svg>
              Slash Commands
            </div>
            <p class="help-col-hint">Type <code>/</code> in the chat input to trigger a command.</p>
            ${SLASH_SECTIONS.map(buildSlashSection).join('')}

            <div class="help-divider"></div>

            <div class="help-col-header">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                   stroke-linecap="round" stroke-linejoin="round" width="14" height="14"
                   aria-hidden="true">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="M6 8h.01M10 8h.01M14 8h.01"/>
              </svg>
              Keyboard Shortcuts
            </div>
            <p class="help-col-hint">On macOS, swap <kbd>Ctrl</kbd> for <kbd>&#8984;</kbd>.</p>
            ${SHORTCUT_SECTIONS.map(buildShortcutSection).join('')}

          </div>
        </div>

      </div>
    </div>`,
    closeBtnSelector: '#help-modal-close',
  });

  return { open: modal.open, close: modal.close, isOpen: modal.isOpen };
}
