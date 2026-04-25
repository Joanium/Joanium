/**
 * SlashCommands — inline `/` command palette for the Joanium composer.
 *
 * Three command flavours:
 *  1. Action commands  (/new, /private) — execute immediately, never sent to AI.
 *  2. Tool commands    (/github, /gmail …) — render a logo chip inside the input
 *     box and inject the tool scope into the outgoing message context.
 *  3. Unknown /command — if no match exists, text stays as-is (no action).
 *
 * Design:
 *  • Dropdown floats above .input-box, anchored to its width.
 *  • Keyboard: ↑↓ navigate, Enter/Tab select, Esc dismiss.
 *  • Logo chips render inside the input box (Codex-style).
 *  • Commands without logos fall back to a glyph icon — no hardcoded lists.
 *  • Grouped: Actions first, then Tools, each with a section label.
 *
 * Icon sourcing:
 *  Icons are extracted directly from each connector's `icon` HTML string
 *  (e.g. `<img src="...">`) — zero hardcoded maps, zero drift.
 */

import {
  CONNECTORS,
  FREE_CONNECTORS,
  loadFeatureConnectorDefs,
} from '../../../Shared/Connectors/Catalog/ConnectorDefs.js';

// ── Icon extraction — reads src from the connector's existing HTML string ───
/**
 * Pull the `src` attribute out of an `<img src="...">` icon string.
 * Returns null if the field is an emoji / plain text / missing.
 */
function _extractIconSrc(iconHtml) {
  if (!iconHtml || typeof iconHtml !== 'string') return null;
  const m = iconHtml.match(/src="([^"]+)"/);
  return m ? m[1] : null;
}

// ── Built-in action commands ────────────────────────────────────────────────
const ACTION_COMMANDS = [
  {
    id: 'new',
    label: 'New Chat',
    description: 'Start a fresh conversation',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
             <path d="M12 5v14M5 12h14"/>
           </svg>`,
    type: 'action',
  },
  {
    id: 'private',
    label: 'Private Chat',
    description: 'Start an incognito session — nothing is saved',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
             <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
             <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
             <line x1="1" y1="1" x2="23" y2="23"/>
           </svg>`,
    type: 'action',
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Open workspace settings',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
             <circle cx="12" cy="12" r="3"/>
             <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06
               a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09
               A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83
               l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09
               A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83
               l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09
               a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83
               l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09
               a1.65 1.65 0 0 0-1.51 1z"/>
           </svg>`,
    type: 'action',
  },
  {
    id: 'help',
    label: 'Help',
    description: 'Show all slash commands and keyboard shortcuts',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
             <circle cx="12" cy="12" r="10"/>
             <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
             <line x1="12" y1="17" x2="12.01" y2="17"/>
           </svg>`,
    type: 'action',
  },
  {
    id: 'close',
    label: 'Close App',
    description: 'Quit Joanium',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
             <circle cx="12" cy="12" r="10"/>
             <line x1="15" y1="9" x2="9" y2="15"/>
             <line x1="9" y1="9" x2="15" y2="15"/>
           </svg>`,
    type: 'action',
  },
  {
    id: 'restart',
    label: 'Restart App',
    description: 'Relaunch Joanium',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
             <polyline points="23 4 23 10 17 10"/>
             <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
           </svg>`,
    type: 'action',
  },
];

// ── Built-in navigation commands ─────────────────────────────────────────────
const NAV_COMMANDS = [
  {
    id: 'skills',
    label: 'Skills',
    description: 'Open the Skills library',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
             <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
           </svg>`,
    type: 'nav',
  },
  {
    id: 'personas',
    label: 'Personas',
    description: 'Manage AI personas',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
             <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
             <circle cx="12" cy="7" r="4"/>
           </svg>`,
    type: 'nav',
  },
  {
    id: 'marketplace',
    label: 'Marketplace',
    description: 'Browse the Marketplace',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
             <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
             <line x1="3" y1="6" x2="21" y2="6"/>
             <path d="M16 10a4 4 0 0 1-8 0"/>
           </svg>`,
    type: 'nav',
  },
  {
    id: 'usage',
    label: 'Usage',
    description: 'View token and cost usage',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
             <line x1="18" y1="20" x2="18" y2="10"/>
             <line x1="12" y1="20" x2="12" y2="4"/>
             <line x1="6" y1="20" x2="6" y2="14"/>
           </svg>`,
    type: 'nav',
  },
  {
    id: 'events',
    label: 'Events',
    description: 'Browse automation events',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
             <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
             <line x1="16" y1="2" x2="16" y2="6"/>
             <line x1="8" y1="2" x2="8" y2="6"/>
             <line x1="3" y1="10" x2="21" y2="10"/>
           </svg>`,
    type: 'nav',
  },
];

// ── Internal state ──────────────────────────────────────────────────────────
let _textarea = null;
let _inputBox = null;
let _dropdown = null;
let _chipContainer = null;
let _activeToolChips = []; // { id, name, iconSrc }
let _commands = [];
let _filteredCmds = [];
let _selectedIndex = 0;
let _visible = false;
let _onAction = () => {};
let _connectorsCached = false;
let _slashStart = 0; // textarea index where the triggering '/' begins

// Tracks whether the most recent selection change came from the keyboard.
// While true, mouseenter events on list items will NOT override _selectedIndex
// so arrow-key navigation is never hijacked by the hover position.
let _keyboardNavigating = false;

// ── Public API ──────────────────────────────────────────────────────────────

export function initSlashCommands(textarea, inputBox, { onAction } = {}) {
  _textarea = textarea;
  _inputBox = inputBox;
  _onAction = onAction || (() => {});

  _createDropdown();
  _createChipContainer();

  _textarea.addEventListener('input', _onInput);
  _textarea.addEventListener('keydown', _onKeydown);
  document.addEventListener('click', _onDocClick);

  _rebuildCommands();
}

export function destroySlashCommands() {
  _textarea?.removeEventListener('input', _onInput);
  _textarea?.removeEventListener('keydown', _onKeydown);
  document.removeEventListener('click', _onDocClick);
  _dropdown?.remove();
  _chipContainer?.remove();
  _activeToolChips = [];
  _dropdown = null;
  _chipContainer = null;
  _connectorsCached = false;
}

/** Returns the active tool chip IDs so the agent knows which tools are scoped. */
export function getActiveToolScopes() {
  return _activeToolChips.map((c) => c.id);
}

/** Clears all tool chips (called on send / reset). */
export function clearToolChips() {
  _activeToolChips = [];
  _renderChips();
}

/** Check if slash commands dropdown is currently visible. */
export function isSlashMenuVisible() {
  return _visible;
}

// ── Dropdown DOM ────────────────────────────────────────────────────────────

function _createDropdown() {
  _dropdown = document.createElement('div');
  _dropdown.className = 'slash-dropdown';
  _dropdown.setAttribute('role', 'listbox');
  _dropdown.setAttribute('aria-label', 'Slash commands');
  _dropdown.hidden = true;

  // Insert INSIDE .input-box so it can be positioned relative to it
  _inputBox.appendChild(_dropdown);
}

function _createChipContainer() {
  _chipContainer = document.createElement('div');
  _chipContainer.className = 'slash-tool-chips';
  _chipContainer.hidden = true;

  // Insert right before the textarea (after attachments)
  const ta = _inputBox.querySelector('textarea');
  if (ta) {
    _inputBox.insertBefore(_chipContainer, ta);
  } else {
    _inputBox.prepend(_chipContainer);
  }
}

// ── Command building ────────────────────────────────────────────────────────

async function _rebuildCommands() {
  if (!_connectorsCached) {
    try {
      await loadFeatureConnectorDefs();
    } catch {
      /* silent */
    }
    _connectorsCached = true;
  }

  const toolCommands = [];
  const seen = new Set();

  // Service connectors (GitHub, Google, etc.)
  for (const connector of CONNECTORS) {
    if (seen.has(connector.id)) continue;
    seen.add(connector.id);
    const iconSrc = _extractIconSrc(connector.icon);
    toolCommands.push({
      id: connector.id,
      label: connector.name,
      description: connector.description || `Use ${connector.name} tools`,
      iconSrc,
      iconEmoji:
        !iconSrc && connector.icon && !connector.icon.includes('<') ? connector.icon : null,
      type: 'tool',
    });
  }

  // Free connectors
  for (const connector of FREE_CONNECTORS) {
    if (seen.has(connector.id)) continue;
    seen.add(connector.id);
    const iconSrc = _extractIconSrc(connector.icon);
    toolCommands.push({
      id: connector.id,
      label: connector.name,
      description: connector.description || `Use ${connector.name}`,
      iconSrc,
      iconEmoji:
        !iconSrc && connector.icon && !connector.icon.includes('<') ? connector.icon : null,
      type: 'tool',
    });
  }

  _commands = [...ACTION_COMMANDS, ...NAV_COMMANDS, ...toolCommands];
}

// ── Event handlers ──────────────────────────────────────────────────────────

function _onInput() {
  const value = _textarea.value;
  const cursor = _textarea.selectionStart;
  const textBeforeCursor = value.slice(0, cursor);
  const lastNewline = textBeforeCursor.lastIndexOf('\n');
  const lineStart = lastNewline + 1;
  const currentLine = textBeforeCursor.slice(lineStart);

  // Trigger when a '/' appears at the start of the line OR after a space,
  // with no space between it and the cursor (i.e. still typing the command).
  const m = currentLine.match(/(^|\s)(\/\S*)$/);
  if (m) {
    const slashToken = m[2]; // e.g. '/git'
    const query = slashToken.slice(1).toLowerCase();
    _slashStart = lineStart + currentLine.length - slashToken.length;
    _filter(query);
    if (_filteredCmds.length > 0) {
      _show();
    } else {
      _hide();
    }
  } else {
    _hide();
  }
}

function _onKeydown(e) {
  if (!_visible) return;

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      _keyboardNavigating = true;
      _selectedIndex = Math.min(_selectedIndex + 1, _filteredCmds.length - 1);
      _updateActiveItem();
      break;

    case 'ArrowUp':
      e.preventDefault();
      _keyboardNavigating = true;
      _selectedIndex = Math.max(_selectedIndex - 1, 0);
      _updateActiveItem();
      break;

    case 'Enter':
    case 'Tab':
      if (_filteredCmds.length > 0) {
        e.preventDefault();
        _select(_filteredCmds[_selectedIndex]);
      }
      break;

    case 'Escape':
      e.preventDefault();
      _hide();
      break;
  }
}

function _onDocClick(e) {
  if (_dropdown && !_dropdown.contains(e.target) && e.target !== _textarea) {
    _hide();
  }
}

// ── Filtering ───────────────────────────────────────────────────────────────

function _filter(query) {
  if (!query) {
    _filteredCmds = [..._commands];
  } else {
    const q = query.toLowerCase();
    _filteredCmds = _commands.filter(
      (cmd) =>
        cmd.id.toLowerCase().includes(q) ||
        cmd.label.toLowerCase().includes(q) ||
        (cmd.description || '').toLowerCase().includes(q),
    );
  }
  _selectedIndex = 0;
}

// ── Show / hide ─────────────────────────────────────────────────────────────

function _show() {
  if (!_dropdown) return;
  _visible = true;
  _keyboardNavigating = false;
  _dropdown.hidden = false;
  _renderItems();
  requestAnimationFrame(() => _dropdown.classList.add('slash-dropdown--visible'));
}

function _hide() {
  if (!_dropdown) return;
  _visible = false;
  _keyboardNavigating = false;
  _dropdown.classList.remove('slash-dropdown--visible');
  setTimeout(() => {
    if (!_visible && _dropdown) _dropdown.hidden = true;
  }, 160);
}

// ── Render ───────────────────────────────────────────────────────────────────

function _renderItems() {
  if (!_dropdown) return;
  _dropdown.innerHTML = '';

  const actions = _filteredCmds.filter((c) => c.type === 'action');
  const navs = _filteredCmds.filter((c) => c.type === 'nav');
  const tools = _filteredCmds.filter((c) => c.type === 'tool');

  // Scrollable list wrapper (matches .slash-dropdown-list in CSS)
  const list = document.createElement('div');
  list.className = 'slash-dropdown-list';

  // Build sections into the scrollable wrapper
  let offset = 0;
  if (actions.length) {
    _buildSection(list, 'Actions', actions, offset);
    offset += actions.length;
  }
  if (navs.length) {
    _buildSection(list, 'Navigate', navs, offset);
    offset += navs.length;
  }
  if (tools.length) {
    _buildSection(list, 'Tools', tools, offset);
  }

  _dropdown.appendChild(list);

  // Scroll active item into view
  requestAnimationFrame(() => {
    _dropdown.querySelector('.slash-dropdown-item--active')?.scrollIntoView({ block: 'nearest' });
  });
}

/**
 * Lightweight active-item update — only toggles CSS classes and aria-selected
 * on the existing DOM nodes. Called by arrow-key navigation so we never
 * rebuild the list (which would re-trigger mouseenter and reset the index).
 */
function _updateActiveItem() {
  if (!_dropdown) return;

  _dropdown.querySelectorAll('.slash-dropdown-item').forEach((el) => {
    const idx = parseInt(el.dataset.idx, 10);
    const isActive = idx === _selectedIndex;
    el.classList.toggle('slash-dropdown-item--active', isActive);
    el.setAttribute('aria-selected', String(isActive));
  });

  // Scroll the newly-active item into view
  _dropdown.querySelector('.slash-dropdown-item--active')?.scrollIntoView({ block: 'nearest' });
}

function _buildSection(container, title, cmds, offset) {
  // Section header
  const header = document.createElement('div');
  header.className = 'slash-dropdown-header';
  header.textContent = title;
  container.appendChild(header);

  // Items
  cmds.forEach((cmd, localIdx) => {
    const globalIdx = offset + localIdx;
    const item = document.createElement('div');
    item.className =
      'slash-dropdown-item' + (globalIdx === _selectedIndex ? ' slash-dropdown-item--active' : '');
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', String(globalIdx === _selectedIndex));
    item.dataset.idx = String(globalIdx);

    // ── Icon ──────────────────────────────────────────────────────────────
    const iconEl = document.createElement('div');
    iconEl.className = 'slash-item-icon';

    if (cmd.iconSrc) {
      const img = document.createElement('img');
      img.src = cmd.iconSrc;
      img.alt = '';
      img.width = 20;
      img.height = 20;
      img.loading = 'lazy';
      img.onerror = () => {
        iconEl.classList.add('slash-item-icon--fallback');
        iconEl.textContent = '';
        iconEl.innerHTML = _slashGlyph();
      };
      iconEl.appendChild(img);
    } else if (cmd.iconEmoji) {
      iconEl.textContent = cmd.iconEmoji;
      iconEl.classList.add('slash-item-icon--emoji');
    } else if (cmd.icon) {
      // SVG string (action commands)
      iconEl.innerHTML = cmd.icon;
      iconEl.classList.add('slash-item-icon--svg');
    } else {
      iconEl.innerHTML = _slashGlyph();
      iconEl.classList.add('slash-item-icon--fallback');
    }

    // ── Text ──────────────────────────────────────────────────────────────
    const textEl = document.createElement('div');
    textEl.className = 'slash-item-text';

    const labelRow = document.createElement('div');
    labelRow.className = 'slash-item-label';

    const slash = document.createElement('span');
    slash.className = 'slash-item-slash';
    slash.textContent = '/';

    const cmdId = document.createElement('span');
    cmdId.className = 'slash-item-cmd';
    cmdId.textContent = cmd.id;

    const displayName = document.createElement('span');
    displayName.className = 'slash-item-display-name';
    displayName.textContent = cmd.label;

    labelRow.append(slash, cmdId, displayName);

    const desc = document.createElement('div');
    desc.className = 'slash-item-desc';
    desc.textContent = cmd.description || '';

    textEl.append(labelRow, desc);

    // ── Badge ─────────────────────────────────────────────────────────────
    const badge = document.createElement('span');
    badge.className = `slash-item-badge slash-item-badge--${cmd.type}`;
    badge.textContent = cmd.type === 'action' ? 'Action' : cmd.type === 'nav' ? 'Nav' : 'Tool';

    item.append(iconEl, textEl, badge);

    // mouseenter: only update selection when NOT in the middle of keyboard
    // navigation. Once the user physically moves the mouse we hand control
    // back to hover so the two input modes feel natural together.
    item.addEventListener('mouseenter', () => {
      if (_keyboardNavigating) return; // ← ignore hover while arrowing
      _selectedIndex = globalIdx;
      _updateActiveItem(); // ← patch classes only, no DOM rebuild
    });

    // When the mouse actually moves inside the dropdown, clear the keyboard
    // lock so hover takes over again naturally.
    item.addEventListener('mousemove', () => {
      _keyboardNavigating = false;
    });

    item.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      _select(cmd);
    });

    container.appendChild(item);
  });
}

function _slashGlyph() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" width="12" height="12"><line x1="7" y1="20" x2="17" y2="4"/></svg>`;
}

// ── Selection ───────────────────────────────────────────────────────────────

function _select(cmd) {
  _hide();

  // Strip only the /command token — preserve any text before it on the same line.
  const value = _textarea.value;
  const cursorPos = _textarea.selectionStart;
  const before = value.slice(0, _slashStart); // text before the '/'
  const after = value.slice(cursorPos); // text after cursor

  const restore = (extraText = '') => {
    _textarea.value = before + extraText + after;
    const pos = before.length + extraText.length;
    _textarea.setSelectionRange(pos, pos);
    _textarea.dispatchEvent(new Event('input'));
    _textarea.focus();
  };

  if (cmd.type === 'action') {
    restore('');
    _onAction(cmd.id);
  } else if (cmd.type === 'nav') {
    restore('');
    // Use the globally exposed navigate fn so nav commands work from any page
    if (typeof window.appNavigate === 'function') {
      window.appNavigate(cmd.id);
    } else {
      _onAction(cmd.id);
    }
  } else if (cmd.type === 'tool') {
    restore('');
    _addToolChip(cmd);
  } else if (cmd.prompt) {
    restore(cmd.prompt);
  }
}

// ── Tool chip rendering ─────────────────────────────────────────────────────

function _addToolChip(cmd) {
  if (_activeToolChips.some((c) => c.id === cmd.id)) return;
  _activeToolChips.push({
    id: cmd.id,
    name: cmd.label,
    iconSrc: cmd.iconSrc || null,
    iconEmoji: cmd.iconEmoji || null,
  });
  _renderChips();
}

function _removeToolChip(id) {
  _activeToolChips = _activeToolChips.filter((c) => c.id !== id);
  _renderChips();
  _textarea?.focus();
}

function _renderChips() {
  if (!_chipContainer) return;
  _chipContainer.innerHTML = '';
  _chipContainer.hidden = _activeToolChips.length === 0;

  for (const chip of _activeToolChips) {
    const el = document.createElement('div');
    el.className = 'slash-tool-chip';

    // Icon or emoji
    if (chip.iconSrc) {
      const img = document.createElement('img');
      img.src = chip.iconSrc;
      img.alt = '';
      img.width = 14;
      img.height = 14;
      img.className = 'slash-tool-chip-icon';
      img.onerror = () => img.remove();
      el.appendChild(img);
    } else if (chip.iconEmoji) {
      const emoji = document.createElement('span');
      emoji.className = 'slash-tool-chip-emoji';
      emoji.textContent = chip.iconEmoji;
      el.appendChild(emoji);
    }

    const label = document.createElement('span');
    label.className = 'slash-tool-chip-label';
    label.textContent = chip.name;
    el.appendChild(label);

    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'slash-tool-chip-remove';
    rm.setAttribute('aria-label', `Remove ${chip.name}`);
    rm.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
      stroke-linecap="round" width="9" height="9">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>`;
    rm.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      _removeToolChip(chip.id);
    });
    el.appendChild(rm);

    _chipContainer.appendChild(el);
  }
}
