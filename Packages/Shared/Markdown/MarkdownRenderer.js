/**
 * Shared/Markdown/MarkdownRenderer.js
 *
 * Lightweight Markdown → DOM renderer for Joanium.
 *
 * Supported syntax:
 *   Blocks  : headings (h1–h6), paragraphs, fenced code blocks,
 *             blockquotes, unordered lists, ordered lists, horizontal rules,
 *             GFM tables (with column alignment), display math.
 *   Inlines : **bold**, *italic*, `code`, [label](url), inline math.
 *
 * Usage:
 *   import { renderMarkdown } from '../../Shared/Markdown/MarkdownRenderer.js';
 *   const el = renderMarkdown(markdownString);
 *   container.append(el);
 */

import { iconMarkup } from '../Icons/Icons.js';
import { invokeIpc } from '../Ipc/RendererIpc.js';
import { copyToClipboard } from '../Utils/DomUtils.js';
import strings from '../I18n/en.js';
import katex from '../../../node_modules/katex/dist/katex.mjs';

const codeBlockStrings = strings.markdown.codeBlock;

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttributeFromEscapedText(value) {
  return String(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function sanitizeEscapedMarkdownUrl(url) {
  const candidate = String(url ?? '').trim();
  if (!/^(https?:|mailto:)/i.test(candidate)) return '#';
  return escapeAttributeFromEscapedText(candidate);
}

function isEscaped(text, index) {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor--) {
    slashCount++;
  }
  return slashCount % 2 === 1;
}

function renderMath(latex, displayMode = false) {
  try {
    return katex.renderToString(latex, {
      displayMode,
      output: 'htmlAndMathml',
      throwOnError: true,
      strict: 'ignore',
      trust: false,
    });
  } catch {
    return `<span class="md-math-fallback">${escapeHtml(latex)}</span>`;
  }
}

function extractInlineMath(text) {
  const mathTokens = [];
  let output = '';
  let index = 0;

  while (index < text.length) {
    if (text.startsWith('\\(', index) && !isEscaped(text, index)) {
      const end = text.indexOf('\\)', index + 2);
      if (end !== -1 && !isEscaped(text, end)) {
        const latex = text.slice(index + 2, end);
        if (latex.trim()) {
          const token = `@@JOANIUMMATH${mathTokens.length}@@`;
          mathTokens.push(renderMath(latex));
          output += token;
          index = end + 2;
          continue;
        }
      }
    }

    if (text[index] === '$' && text[index + 1] !== '$' && !isEscaped(text, index)) {
      let end = index + 1;
      while (end < text.length) {
        if (text[end] === '$' && !isEscaped(text, end)) break;
        end++;
      }
      const latex = text.slice(index + 1, end);
      if (end < text.length && latex.trim() && latex === latex.trim()) {
        const token = `@@JOANIUMMATH${mathTokens.length}@@`;
        mathTokens.push(renderMath(latex));
        output += token;
        index = end + 1;
        continue;
      }
    }

    output += text[index];
    index++;
  }

  return { mathTokens, text: output };
}

function findDisplayMath(lines, index) {
  const line = lines[index];
  const dollarMatch = line.match(/^\s*\$\$(.*?)\$\$\s*$/);
  if (dollarMatch) return { end: index, latex: dollarMatch[1] };

  if (/^\s*\$\$\s*$/.test(line)) {
    const mathLines = [];
    for (let cursor = index + 1; cursor < lines.length; cursor++) {
      if (/^\s*\$\$\s*$/.test(lines[cursor])) {
        return { end: cursor, latex: mathLines.join('\n') };
      }
      mathLines.push(lines[cursor]);
    }
  }

  const bracketMatch = line.match(/^\s*\\\[(.*?)\\\]\s*$/);
  if (bracketMatch) return { end: index, latex: bracketMatch[1] };

  if (/^\s*\\\[\s*$/.test(line)) {
    const mathLines = [];
    for (let cursor = index + 1; cursor < lines.length; cursor++) {
      if (/^\s*\\\]\s*$/.test(lines[cursor])) {
        return { end: cursor, latex: mathLines.join('\n') };
      }
      mathLines.push(lines[cursor]);
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Inline renderer
// ---------------------------------------------------------------------------

/**
 * Converts inline Markdown syntax within a single text string to HTML.
 * HTML-escapes the source first so no raw markup leaks through.
 *
 * @param {string} text
 * @returns {string} HTML string (safe for innerHTML assignment)
 */
export function renderInline(text) {
  const inlineCodeTokens = [];

  // 1. Protect inline code before extracting math syntax.
  let out = String(text).replace(/`([^`]+)`/g, (_, code) => {
    const token = `@@JOANIUMINLINECODE${inlineCodeTokens.length}@@`;
    inlineCodeTokens.push(`<code class="md-code-inline">${escapeHtml(code)}</code>`);
    return token;
  });
  const { mathTokens, text: textWithoutMath } = extractInlineMath(out);
  out = escapeHtml(textWithoutMath);

  // 2. Bold  **text** or __text__
  out = out.replace(/\*\*(.+?)\*\*|__(.+?)__/g, (_, a, b) => `<strong>${a ?? b}</strong>`);

  // 3. Italic  *text* or _text_  (single star/underscore, not already consumed)
  out = out.replace(/\*([^*]+)\*|_([^_]+)_/g, (_, a, b) => `<em>${a ?? b}</em>`);

  // 4. Links  [label](url)
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    const safe = sanitizeEscapedMarkdownUrl(url);
    return `<a class="md-link" href="${safe}" rel="noopener noreferrer">${label}</a>`;
  });

  // 5. Auto-link bare URLs  https://… or http://…
  //    Must run after [label](url) so already-linked URLs aren't double-processed.
  out = out.replace(/(?<!href=")(https?:\/\/[^\s<>"'\)\]]+)/g, (match) => {
    const safe = escapeAttributeFromEscapedText(match);
    return `<a class="md-link" href="${safe}" rel="noopener noreferrer">${match}</a>`;
  });

  out = inlineCodeTokens.reduce((next, html, index) => {
    return next.replace(`@@JOANIUMINLINECODE${index}@@`, html);
  }, out);

  out = mathTokens.reduce((next, html, index) => {
    return next.replace(`@@JOANIUMMATH${index}@@`, html);
  }, out);

  return out;
}

// ---------------------------------------------------------------------------
// Table helpers
// ---------------------------------------------------------------------------

/**
 * Splits a GFM table row string into trimmed cell strings.
 * Handles leading/trailing pipes: | a | b | → ['a', 'b']
 */
function parseTableRow(line) {
  return line
    .replace(/^\|?|\|?\s*$/g, '')
    .split('|')
    .map((cell) => cell.trim());
}

/**
 * Reads column alignments from a GFM separator row (e.g. |:---|:---:|---:|).
 * Returns an array of 'left' | 'center' | 'right' per column.
 */
function parseTableAlignments(line) {
  return parseTableRow(line).map((cell) => {
    const c = cell.trim();
    if (c.startsWith(':') && c.endsWith(':')) return 'center';
    if (c.endsWith(':')) return 'right';
    return 'left';
  });
}

// ---------------------------------------------------------------------------
// Block parser — produces an AST-like array of block objects
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} Block
 * @property {string} type
 */

/**
 * Parses an array of raw lines into a flat sequence of block descriptors.
 *
 * @param {string[]} lines
 * @returns {Block[]}
 */
function parseBlocks(lines) {
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── Blank line ──────────────────────────────────────────────────────
    if (line.trim() === '') {
      i++;
      continue;
    }

    // ── Fenced code block  ```lang ──────────────────────────────────────
    if (/^```/.test(line)) {
      const lang = line.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // consume closing ```
      const code = codeLines.join('\n');
      if (code.trim()) {
        blocks.push({ type: 'codeblock', lang, code });
      }
      continue;
    }

    // ── Horizontal rule  --- / *** / ___ ───────────────────────────────
    const displayMath = findDisplayMath(lines, i);
    if (displayMath && displayMath.latex.trim()) {
      blocks.push({ type: 'math', latex: displayMath.latex });
      i = displayMath.end + 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // ── Heading  # … ###### ────────────────────────────────────────────
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      i++;
      continue;
    }

    // ── Blockquote  > … ────────────────────────────────────────────────
    if (/^>\s?/.test(line)) {
      const qLines = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        qLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'blockquote', lines: qLines });
      continue;
    }

    // ── Unordered list  - / * / + ──────────────────────────────────────
    if (/^[-*+]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*+]\s/, ''));
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // ── Ordered list  1. … ─────────────────────────────────────────────
    if (/^\d+\.\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // ── Table  | col | col | separator row ─────────────────────────────
    // A table starts with a line containing a pipe whose NEXT line is a
    // GFM separator row (only pipes, dashes, colons, and spaces).
    const separatorRe = /^\|?[\s|:*-]+\|?\s*$/;
    if (line.includes('|') && i + 1 < lines.length && separatorRe.test(lines[i + 1])) {
      const headers = parseTableRow(line);
      if (headers.length >= 2) {
        i++; // consume separator
        const alignments = parseTableAlignments(lines[i]);
        i++;
        const rows = [];
        while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
          rows.push(parseTableRow(lines[i]));
          i++;
        }
        blocks.push({ type: 'table', headers, alignments, rows });
        continue;
      }
    }

    // ── Paragraph ──────────────────────────────────────────────────────
    // Collect consecutive non-blank lines that aren't block-level openers.
    const paraLines = [];
    const blockOpener = /^(#{1,6}\s|```|>\s?|[-*+]\s|\d+\.\s|(-{3,}|\*{3,}|_{3,})\s*$)/;
    while (i < lines.length && lines[i].trim() !== '' && !blockOpener.test(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      // Join soft-wrapped lines into a single paragraph string
      blocks.push({ type: 'paragraph', text: paraLines.join(' ') });
    }
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// DOM builder — turns block descriptors into real DOM nodes
// ---------------------------------------------------------------------------

/**
 * Recursively builds DOM nodes from a block array.
 * Returns a DocumentFragment ready to be appended.
 *
 * @param {Block[]} blocks
 * @returns {DocumentFragment}
 */
function buildDom(blocks) {
  const frag = document.createDocumentFragment();

  for (const block of blocks) {
    switch (block.type) {
      case 'heading': {
        const el = document.createElement(`h${block.level}`);
        el.className = `md-h md-h${block.level}`;
        el.innerHTML = renderInline(block.text);
        frag.append(el);
        break;
      }

      case 'paragraph': {
        const el = document.createElement('p');
        el.className = 'md-p';
        el.innerHTML = renderInline(block.text);
        frag.append(el);
        break;
      }

      case 'math': {
        const el = document.createElement('div');
        el.className = 'md-math md-math--display';
        el.innerHTML = renderMath(block.latex, true);
        frag.append(el);
        break;
      }

      case 'codeblock': {
        // When the language is "markdown", render the content as actual markdown
        // instead of displaying it as raw code. AI models sometimes wrap their
        // entire markdown output inside ```markdown fences.
        const rawLang = (block.lang || '').toLowerCase();
        if (rawLang === 'markdown' || rawLang === 'md') {
          const mdContent = renderMarkdown(block.code);
          frag.append(mdContent);
          break;
        }

        const wrap = document.createElement('div');
        wrap.className = 'md-codeblock';

        // ── Header bar ────────────────────────────────────────────────
        const header = document.createElement('div');
        header.className = 'md-codeblock__header';

        const langLabel = document.createElement('span');
        langLabel.className = 'md-codeblock__lang';
        langLabel.textContent =
          (block.lang || 'text').charAt(0).toUpperCase() +
          (block.lang || 'text').slice(1).toLowerCase();
        header.append(langLabel);

        const actions = document.createElement('div');
        actions.className = 'md-codeblock__actions';

        // Copy button
        const copyBtn = document.createElement('button');
        copyBtn.className = 'md-codeblock__btn';
        copyBtn.type = 'button';
        copyBtn.innerHTML = `${iconMarkup.copy}<span></span>`;
        const copyLabel = copyBtn.querySelector('span');
        copyLabel.textContent = codeBlockStrings.copy;
        copyBtn.addEventListener('click', () => {
          copyToClipboard(block.code).then(() => {
            copyLabel.textContent = codeBlockStrings.copied;
            copyBtn.classList.add('md-codeblock__btn--success');
            setTimeout(() => {
              copyLabel.textContent = codeBlockStrings.copy;
              copyBtn.classList.remove('md-codeblock__btn--success');
            }, 1800);
          });
        });

        // Download button
        const dlBtn = document.createElement('button');
        dlBtn.className = 'md-codeblock__btn';
        dlBtn.type = 'button';
        const extMap = {
          js: 'js',
          javascript: 'js',
          ts: 'ts',
          typescript: 'ts',
          py: 'py',
          python: 'py',
          css: 'css',
          html: 'html',
          json: 'json',
          sh: 'sh',
          bash: 'sh',
          cpp: 'cpp',
          c: 'c',
          java: 'java',
          rs: 'rs',
          rust: 'rs',
          go: 'go',
          sql: 'sql',
          md: 'md',
          yaml: 'yaml',
          yml: 'yml',
          xml: 'xml',
        };
        const ext = extMap[block.lang?.toLowerCase()] ?? 'txt';
        dlBtn.innerHTML = `${iconMarkup.download}<span></span>`;
        dlBtn.querySelector('span').textContent = codeBlockStrings.download;
        dlBtn.addEventListener('click', () => {
          const blob = new Blob([block.code], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `snippet.${ext}`;
          a.click();
          URL.revokeObjectURL(url);
        });

        const btns = [copyBtn, dlBtn];
        if (block.lang?.toLowerCase() === 'html') {
          const previewBtn = document.createElement('button');
          previewBtn.className = 'md-codeblock__btn';
          previewBtn.type = 'button';
          previewBtn.innerHTML = `${iconMarkup.eye}<span></span>`;
          previewBtn.querySelector('span').textContent = codeBlockStrings.preview;
          previewBtn.addEventListener('click', () => {
            void invokeIpc('browser-preview:load-html', block.code, 'user').catch(() => {});
          });
          btns.push(previewBtn);
        }

        actions.append(...btns);
        header.append(actions);
        wrap.append(header);

        // ── Code area ──────────────────────────────────────────────────
        const pre = document.createElement('pre');
        pre.className = 'md-pre';
        const code = document.createElement('code');
        code.className = `md-code${block.lang ? ` language-${block.lang}` : ''}`;
        code.textContent = block.code;
        pre.append(code);
        wrap.append(pre);

        frag.append(wrap);
        break;
      }

      case 'blockquote': {
        const bq = document.createElement('blockquote');
        bq.className = 'md-blockquote';
        const inner = buildDom(parseBlocks(block.lines));
        bq.append(inner);
        frag.append(bq);
        break;
      }

      case 'ul': {
        const ul = document.createElement('ul');
        ul.className = 'md-ul';
        for (const item of block.items) {
          const li = document.createElement('li');
          li.className = 'md-li';
          li.innerHTML = renderInline(item);
          ul.append(li);
        }
        frag.append(ul);
        break;
      }

      case 'ol': {
        const ol = document.createElement('ol');
        ol.className = 'md-ol';
        for (const item of block.items) {
          const li = document.createElement('li');
          li.className = 'md-li';
          li.innerHTML = renderInline(item);
          ol.append(li);
        }
        frag.append(ol);
        break;
      }

      case 'table': {
        const tableWrap = document.createElement('div');
        tableWrap.className = 'md-table-wrap';
        const table = document.createElement('table');
        table.className = 'md-table';

        // Header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        for (let ci = 0; ci < block.headers.length; ci++) {
          const th = document.createElement('th');
          th.className = 'md-th';
          th.style.textAlign = block.alignments[ci] ?? 'left';
          th.innerHTML = renderInline(block.headers[ci]);
          headerRow.append(th);
        }
        thead.append(headerRow);
        table.append(thead);

        // Body
        if (block.rows.length > 0) {
          const tbody = document.createElement('tbody');
          for (const row of block.rows) {
            const tr = document.createElement('tr');
            for (let ci = 0; ci < block.headers.length; ci++) {
              const td = document.createElement('td');
              td.className = 'md-td';
              td.style.textAlign = block.alignments[ci] ?? 'left';
              td.innerHTML = renderInline(row[ci] ?? '');
              tr.append(td);
            }
            tbody.append(tr);
          }
          table.append(tbody);
        }

        tableWrap.append(table);
        frag.append(tableWrap);
        break;
      }

      case 'hr': {
        const hr = document.createElement('hr');
        hr.className = 'md-hr';
        frag.append(hr);
        break;
      }

      default:
        break;
    }
  }

  return frag;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Renders a Markdown string into a `<div class="md-root">` element.
 *
 * @param {string} markdown   Raw Markdown text.
 * @param {string} [extra]    Optional extra class(es) appended to the root div.
 * @returns {HTMLDivElement}  Ready-to-append DOM element.
 */
export function renderMarkdown(markdown, extra = '') {
  const lines = (markdown ?? '').split(/\r?\n/);
  const blocks = parseBlocks(lines);
  const dom = buildDom(blocks);

  const root = document.createElement('div');
  root.className = ['md-root', extra].filter(Boolean).join(' ');
  root.append(dom);

  // Open links in the live browser instead of the system browser.
  root.addEventListener('click', (event) => {
    const anchor = event.target.closest('a.md-link');
    if (!anchor) return;
    const url = anchor.getAttribute('href');
    if (!url || url === '#') return;
    event.preventDefault();
    root.dispatchEvent(new CustomEvent('jo:open-url', { bubbles: true, detail: { url } }));
  });

  return root;
}
