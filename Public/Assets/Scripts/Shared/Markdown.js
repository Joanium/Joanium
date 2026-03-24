/**
 * Romelson — Shared/Markdown.js
 *
 * Production-grade, Claude-style Markdown renderer.
 *
 * Block elements
 *   ATX headings (h1–h3), horizontal rules, fenced code blocks,
 *   blockquotes (nested), unordered lists, ordered lists, task lists
 *   (- [ ] / - [x]), tables (GFM-style), and paragraphs.
 *
 * Inline elements
 *   Bold (**text** / __text__), italic (*text* / _text_),
 *   bold+italic (***text***), strikethrough (~~text~~),
 *   inline code (`code`), links ([text](url)), bare-URL auto-links,
 *   and hard line-breaks (two spaces before \n).
 *
 * Code blocks render with the existing Copy + Download button UI so
 * that the Chat.js event handlers (.copy-code-btn / .download-code-btn)
 * keep working without any changes.
 *
 * Architecture
 *   1. Extract fenced code blocks → opaque placeholders
 *   2. Split remaining text into lines
 *   3. parseBlocks() walks line-by-line, dispatching to specialised
 *      parsers for tables, blockquotes, and lists
 *   4. Each text node is passed through renderInline()
 *   5. Placeholders are swapped back for the full code-block HTML
 */

import { escapeHtml } from './Utils.js';

/* ══════════════════════════════════════════
   SVG ICONS  (match existing UI in Chat.js)
══════════════════════════════════════════ */
const COPY_ICON = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
const DL_ICON = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;

/* Private sentinel used for code-block placeholders — never appears in real text */
const CODE_FENCE = '\x00CB';

/* ══════════════════════════════════════════
   CODE BLOCK RENDERER
   Preserves exact class names Chat.js depends on.
══════════════════════════════════════════ */
function renderCodeBlock(lang, code) {
  const display = lang || 'code';
  return (
    `<div class="code-wrapper">` +
    `<div class="code-header">` +
    `<span class="code-lang">${escapeHtml(display)}</span>` +
    `<div class="code-actions">` +
    `<button class="copy-code-btn" title="Copy code">${COPY_ICON} Copy</button>` +
    `<button class="download-code-btn" title="Download file" data-lang="${escapeHtml(lang)}">${DL_ICON} Download</button>` +
    `</div>` +
    `</div>` +
    `<pre><code${lang ? ` class="language-${escapeHtml(lang)}"` : ''}>${escapeHtml(code)}</code></pre>` +
    `</div>`
  );
}

/* ══════════════════════════════════════════
   INLINE FORMATTER
   Order matters: protect code spans first,
   escape HTML, then apply rich formatting.
══════════════════════════════════════════ */
function renderInline(raw) {
  if (!raw) return '';

  // 1 ─ Protect inline code from subsequent processing
  const spans = [];
  let s = raw.replace(/`([^`\n]+)`/g, (_, c) => {
    const i = spans.length;
    spans.push(`<code class="md-inline-code">${escapeHtml(c)}</code>`);
    return `\x01S${i}\x01`;
  });

  // 2 ─ HTML-escape the remainder (code spans already extracted)
  s = escapeHtml(s);

  // 2a ─ Restore literal <br> / <br/> tags the AI may emit inside table cells
  s = s.replace(/&lt;br\s*\/?&gt;/gi, '<br>');

  // 3 ─ Links:  [label](url)
  s = s.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (_, label, rawUrl) => {
    // Undo escapeHtml on the URL so the href is clean
    const url = rawUrl.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    const safe = url.replace(/"/g, '%22');
    return `<a class="md-link" href="${safe}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });

  // 4 ─ Auto-link bare URLs (not already inside an href)
  s = s.replace(/(?<![="'>])(https?:\/\/[^\s<>"'&]+)/g,
    u => `<a class="md-link" href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`
  );

  // 5 ─ Bold + italic  ***text***  or  ___text___
  s = s.replace(/\*\*\*(.+?)\*\*\*/gs, '<strong><em>$1</em></strong>');
  s = s.replace(/___(.+?)___/gs, '<strong><em>$1</em></strong>');

  // 6 ─ Bold  **text**  or  __text__
  s = s.replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>');
  s = s.replace(/__(.+?)__/gs, '<strong>$1</strong>');

  // 7 ─ Italic  *text*  or  _text_
  //    Use negative look-arounds to avoid matching list bullets (* item)
  s = s.replace(/(?<![*\w])\*(?![\s*])(.+?)(?<![\s*])\*(?![*\w])/gs, '<em>$1</em>');
  s = s.replace(/(?<![_\w])_(?![_\s])(.+?)(?<![_\s])_(?![_\w])/gs, '<em>$1</em>');

  // 8 ─ Strikethrough  ~~text~~
  s = s.replace(/~~(.+?)~~/gs, '<del>$1</del>');

  // 9 ─ Hard line break  (two trailing spaces + newline)
  s = s.replace(/  \n/g, '<br>');

  // 9a ─ Terminal Mounts
  s = s.replace(/\[TERMINAL:([a-zA-Z0-9.-]+)\]/g, (_, pid) => {
    return `<div class="embedded-terminal-mount" data-pid="${pid}" style="height: 300px; width: 100%; border-radius: 8px; margin: 10px 0; overflow: hidden; padding: 4px; border: 1px solid var(--border-subtle); background: #12141c;"></div>`;
  });

  // 10 ─ Restore code spans
  s = s.replace(/\x01S(\d+)\x01/g, (_, i) => spans[+i]);

  return s;
}

/* ══════════════════════════════════════════
   TABLE PARSER
   Detects GFM-style tables:
     | Head | Head |
     |------|:----:|
     | Cell | Cell |
══════════════════════════════════════════ */
const TABLE_ROW_RE = /^\s*\|.+\|\s*$/;
const TABLE_SEP_RE = /^\s*\|[\s|:\-]+\|\s*$/;

function isTableRow(line) { return TABLE_ROW_RE.test(line); }
function isSepRow(line) { return TABLE_SEP_RE.test(line); }

function splitCells(row) {
  return row.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
}

function columnAlign(sep) {
  if (sep.startsWith(':') && sep.endsWith(':')) return 'center';
  if (sep.endsWith(':')) return 'right';
  return 'left';
}

/**
 * Try to parse a GFM table beginning at line `start`.
 * Returns { html, consumed } on success, or null on failure.
 */
function parseTable(lines, start) {
  if (start + 1 >= lines.length) return null;
  if (!isTableRow(lines[start]) || !isSepRow(lines[start + 1])) return null;

  const headers = splitCells(lines[start]);
  const aligns = splitCells(lines[start + 1]).map(columnAlign);

  let i = start + 2;
  const bodyRows = [];
  while (i < lines.length && isTableRow(lines[i]) && !isSepRow(lines[i])) {
    bodyRows.push(splitCells(lines[i]));
    i++;
  }

  // Head
  let html = '<div class="md-table-wrap"><table class="md-table"><thead><tr>';
  headers.forEach((h, j) => {
    const align = aligns[j] ?? 'left';
    html += `<th style="text-align:${align}">${renderInline(h)}</th>`;
  });
  html += '</tr></thead>';

  // Body
  if (bodyRows.length) {
    html += '<tbody>';
    bodyRows.forEach(row => {
      html += '<tr>';
      headers.forEach((_, j) => {
        const align = aligns[j] ?? 'left';
        html += `<td style="text-align:${align}">${renderInline(row[j] ?? '')}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody>';
  }

  html += '</table></div>';
  return { html, consumed: i - start };
}

/* ══════════════════════════════════════════
   LIST PARSER
   Builds a tree from indented list lines,
   then renders it recursively.  Supports:
     • unordered  (- * +)
     • ordered    (1. 1))
     • task       (- [ ]  - [x])
     • nesting via two-space indent multiples
══════════════════════════════════════════ */
const LIST_ITEM_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

function isListItem(line) { return LIST_ITEM_RE.test(line); }
function getIndent(line) { return (line.match(/^(\s*)/) || ['', ''])[1].length; }

/**
 * Parse consecutive list lines starting at `start` into an HTML string.
 * Returns { html, consumed }.
 */
function parseList(lines, start) {
  // Collect lines that belong to this list block
  const listLines = [];
  let i = start;

  while (i < lines.length) {
    const line = lines[i];
    if (isListItem(line)) {
      listLines.push(line);
      i++;
    } else if (line.trim() === '') {
      // A single blank line inside a loose list is OK;
      // two blanks or non-list content ends the list.
      if (i + 1 < lines.length && isListItem(lines[i + 1])) {
        i++; // skip blank, continue
      } else {
        break;
      }
    } else if (/^\s{2,}/.test(line) && !isListItem(line)) {
      // Indented continuation text of the previous item
      listLines.push(line);
      i++;
    } else {
      break;
    }
  }

  if (!listLines.length) return null;

  const html = renderListNode(buildListTree(listLines));
  return { html, consumed: i - start };
}

/**
 * Build a recursive tree from list lines.
 * Tree node: { ordered: bool, items: [{ text, children: node | null }] }
 */
function buildListTree(lines) {
  const root = { ordered: false, items: [] };
  // Stack entries: { node (list-level node), indent (of items in that node) }
  const stack = [{ node: root, indent: -1 }];

  for (const line of lines) {
    const m = line.match(LIST_ITEM_RE);
    if (!m) continue; // continuation lines are ignored for tree purposes

    const indent = m[1].length;
    const marker = m[2];
    const text = m[3];
    const ordered = /\d/.test(marker);

    // Pop back to the correct parent level
    while (stack.length > 1 && stack[stack.length - 1].indent > indent) {
      stack.pop();
    }

    const top = stack[stack.length - 1];

    if (top.node.items.length === 0) {
      // First item at this level — initialise the list node
      top.node.ordered = ordered;
      top.indent = indent;
      top.node.items.push({ text, children: null });
    } else if (top.indent === indent) {
      // Same level — add sibling item
      top.node.items.push({ text, children: null });
    } else if (top.indent < indent) {
      // Deeper indent — create a child list inside the last item
      const newNode = { ordered, items: [{ text, children: null }] };
      const parentItems = top.node.items;
      parentItems[parentItems.length - 1].children = newNode;
      stack.push({ node: newNode, indent });
    }
  }

  return root;
}

const TASK_RE = /^\[([ xX])\]\s+/;

function renderListNode(node) {
  if (!node || !node.items.length) return '';
  const tag = node.ordered ? 'ol' : 'ul';
  let html = `<${tag} class="md-list">`;

  for (const item of node.items) {
    const taskM = item.text.match(TASK_RE);
    let content;

    if (taskM) {
      const checked = taskM[1].trim() !== '';
      const rest = item.text.slice(taskM[0].length);
      content =
        `<input type="checkbox" class="md-task-check" ${checked ? 'checked' : ''} disabled>` +
        `<span class="md-task-label${checked ? ' md-task-done' : ''}">${renderInline(rest)}</span>`;
    } else {
      content = renderInline(item.text);
    }

    html += `<li class="md-list-item">${content}`;
    if (item.children) html += renderListNode(item.children);
    html += '</li>';
  }

  html += `</${tag}>`;
  return html;
}

/* ══════════════════════════════════════════
   BLOCKQUOTE PARSER
   Strips one level of ">" per line, then
   recursively renders the inner content so
   that nested blockquotes and all other
   block elements work inside quotes.
══════════════════════════════════════════ */
function parseBlockquote(lines, start) {
  const inner = [];
  let i = start;

  while (i < lines.length && lines[i].trim().startsWith('>')) {
    inner.push(lines[i].replace(/^[ \t]*>[ \t]?/, ''));
    i++;
  }

  const innerHtml = parseBlocks(inner);
  return {
    html: `<blockquote class="md-blockquote">${innerHtml}</blockquote>`,
    consumed: i - start,
  };
}

/* ══════════════════════════════════════════
   BLOCK PARSER
   Single pass, line by line.
   Dispatches to specialised parsers above.
══════════════════════════════════════════ */
function parseBlocks(lines) {
  let html = '';
  let paraLines = [];
  let i = 0;

  /** Flush accumulated paragraph lines to HTML */
  function flushPara() {
    if (!paraLines.length) return;
    // Join lines — single \n becomes a space per CommonMark;
    // but for AI chat output, visible soft-breaks feel more natural.
    // We render each line through inline formatter then join with <br>.
    const parts = paraLines.join('\n').split('\n').map(l => renderInline(l));
    html += `<p class="md-p">${parts.join('<br>')}</p>`;
    paraLines = [];
  }

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    /* ── Blank line ───────────────────────────────────── */
    if (trimmed === '') {
      flushPara();
      i++;
      continue;
    }

    /* ── Code-block placeholder ───────────────────────── */
    if (trimmed.startsWith(CODE_FENCE)) {
      flushPara();
      html += trimmed; // will be replaced in the final pass
      i++;
      continue;
    }

    /* ── ATX Heading  # / ## / ### ───────────────────── */
    const headingM = trimmed.match(/^(#{1,6})\s+(.+?)(?:\s+#+\s*)?$/);
    if (headingM) {
      flushPara();
      const level = headingM[1].length;
      html += `<h${level} class="md-heading md-h${level}">${renderInline(headingM[2])}</h${level}>`;
      i++;
      continue;
    }

    /* ── Horizontal rule  ---  ***  ___ ──────────────── */
    if (/^(?:[-*_]){3,}$/.test(trimmed)) {
      flushPara();
      html += '<hr class="md-hr">';
      i++;
      continue;
    }

    /* ── Table ────────────────────────────────────────── */
    if (isTableRow(line) && i + 1 < lines.length && isSepRow(lines[i + 1])) {
      flushPara();
      const result = parseTable(lines, i);
      if (result) {
        html += result.html;
        i += result.consumed;
        continue;
      }
    }

    /* ── Blockquote  > ────────────────────────────────── */
    if (trimmed.startsWith('>')) {
      flushPara();
      const result = parseBlockquote(lines, i);
      html += result.html;
      i += result.consumed;
      continue;
    }

    /* ── List ─────────────────────────────────────────── */
    if (isListItem(line)) {
      flushPara();
      const result = parseList(lines, i);
      if (result) {
        html += result.html;
        i += result.consumed;
        continue;
      }
    }

    /* ── Paragraph (default) ──────────────────────────── */
    paraLines.push(line);
    i++;
  }

  flushPara();
  return html;
}

/* ══════════════════════════════════════════
   PUBLIC API
══════════════════════════════════════════ */

/**
 * Convert a Markdown string to a safe HTML string.
 *
 * @param  {string} text  Raw Markdown
 * @returns {string}      HTML ready for innerHTML
 */
export function render(text) {
  if (!text) return '';

  /* ── Phase 1: extract fenced code blocks ── */
  const codeBlocks = [];
  let processed = String(text).replace(
    /```([^\n`]*)\n?([\s\S]*?)```/g,
    (_, rawLang, code) => {
      const lang = rawLang.trim();
      const id = `${CODE_FENCE}${codeBlocks.length}${CODE_FENCE}`;
      // Strip trailing newline that was inside the fence
      codeBlocks.push({ lang, code: code.replace(/\n$/, '') });
      return `\n${id}\n`;
    },
  );

  /* ── Phase 2: parse and render blocks ── */
  const lines = processed.split('\n');
  let html = parseBlocks(lines);

  /* ── Phase 3: restore code blocks ── */
  const escapedFence = CODE_FENCE.replace(/\x00/, '\\x00');
  html = html.replace(
    new RegExp(`${CODE_FENCE}(\\d+)${CODE_FENCE}`, 'g'),
    (_, idx) => {
      const { lang, code } = codeBlocks[+idx];
      return renderCodeBlock(lang, code);
    },
  );

  return html;
}