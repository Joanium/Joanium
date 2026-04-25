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

  _commands = [...ACTION_COMMANDS, ...toolCommands];
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
      _selectedIndex = Math.min(_selectedIndex + 1, _filteredCmds.length - 1);
      _renderItems();
      break;

    case 'ArrowUp':
      e.preventDefault();
      _selectedIndex = Math.max(_selectedIndex - 1, 0);
      _renderItems();
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
  _dropdown.hidden = false;
  _renderItems();
  requestAnimationFrame(() => _dropdown.classList.add('slash-dropdown--visible'));
}

function _hide() {
  if (!_dropdown) return;
  _visible = false;
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
  const tools = _filteredCmds.filter((c) => c.type === 'tool');

  // Scrollable list wrapper (matches .slash-dropdown-list in CSS)
  const list = document.createElement('div');
  list.className = 'slash-dropdown-list';

  // Build sections into the scrollable wrapper
  if (actions.length) _buildSection(list, 'Actions', actions, 0);
  if (tools.length) _buildSection(list, 'Tools', tools, actions.length);

  _dropdown.appendChild(list);

  // Scroll active item into view
  requestAnimationFrame(() => {
    _dropdown.querySelector('.slash-dropdown-item--active')?.scrollIntoView({ block: 'nearest' });
  });
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
    badge.textContent = cmd.type === 'action' ? 'Action' : 'Tool';

    item.append(iconEl, textEl, badge);

    item.addEventListener('mouseenter', () => {
      _selectedIndex = globalIdx;
      _renderItems();
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
