import { escapeHtml } from '../../../System/Utils.js';
function renderInline(raw) {
  if (!raw) return '';
  const spans = [];
  let s = raw.replace(/`([^`\n]+)`/g, (_, c) => {
    const i = spans.length;
    return (spans.push(`<code class="md-inline-code">${escapeHtml(c)}</code>`), `S${i}`);
  });
  return (
    (s = escapeHtml(s)),
    (s = s.replace(/&lt;br\s*\/?&gt;/gi, '<br>')),
    (s = s.replace(
      /\[([^\]]*)\]\(([^)]+)\)/g,
      (_, label, rawUrl) =>
        `<a class="md-link" href="${rawUrl
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/"/g, '%22')}" target="_blank" rel="noopener noreferrer">${label}</a>`,
    )),
    (s = s.replace(
      /(?<![="'>])(https?:\/\/[^\s<>"'&]+)/g,
      (u) => `<a class="md-link" href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`,
    )),
    (s = s.replace(/\*\*\*(.+?)\*\*\*/gs, '<strong><em>$1</em></strong>')),
    (s = s.replace(/___(.+?)___/gs, '<strong><em>$1</em></strong>')),
    (s = s.replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>')),
    (s = s.replace(/__(.+?)__/gs, '<strong>$1</strong>')),
    (s = s.replace(/(?<![*\w])\*(?![\s*])(.+?)(?<![\s*])\*(?![*\w])/gs, '<em>$1</em>')),
    (s = s.replace(/(?<![_\w])_(?![_\s])(.+?)(?<![_\s])_(?![_\w])/gs, '<em>$1</em>')),
    (s = s.replace(/~~(.+?)~~/gs, '<del>$1</del>')),
    (s = s.replace(/  \n/g, '<br>')),
    (s = s.replace(/\x01S(\d+)\x01/g, (_, i) => spans[+i])),
    s
  );
}
const TABLE_ROW_RE = /^\s*\|.+\|\s*$/,
  TABLE_SEP_RE = /^\s*\|[\s|:\-]+\|\s*$/;
function isTableRow(line) {
  return TABLE_ROW_RE.test(line);
}
function isSepRow(line) {
  return TABLE_SEP_RE.test(line);
}
function splitCells(row) {
  return row
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim());
}
function columnAlign(sep) {
  return sep.startsWith(':') && sep.endsWith(':') ? 'center' : sep.endsWith(':') ? 'right' : 'left';
}
function parseTable(lines, start) {
  if (start + 1 >= lines.length) return null;
  if (!isTableRow(lines[start]) || !isSepRow(lines[start + 1])) return null;
  const headers = splitCells(lines[start]),
    aligns = splitCells(lines[start + 1]).map(columnAlign);
  let i = start + 2;
  const bodyRows = [];
  for (; i < lines.length && isTableRow(lines[i]) && !isSepRow(lines[i]); )
    (bodyRows.push(splitCells(lines[i])), i++);
  let html = '<div class="md-table-wrap"><table class="md-table"><thead><tr>';
  return (
    headers.forEach((h, j) => {
      const align = aligns[j] ?? 'left';
      html += `<th style="text-align:${align}">${renderInline(h)}</th>`;
    }),
    (html += '</tr></thead>'),
    bodyRows.length &&
      ((html += '<tbody>'),
      bodyRows.forEach((row) => {
        ((html += '<tr>'),
          headers.forEach((_, j) => {
            const align = aligns[j] ?? 'left';
            html += `<td style="text-align:${align}">${renderInline(row[j] ?? '')}</td>`;
          }),
          (html += '</tr>'));
      }),
      (html += '</tbody>')),
    (html += '</table></div>'),
    { html: html, consumed: i - start }
  );
}
const LIST_ITEM_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
function isListItem(line) {
  return LIST_ITEM_RE.test(line);
}
function parseList(lines, start) {
  const listLines = [];
  let i = start;
  for (; i < lines.length; ) {
    const line = lines[i];
    if (isListItem(line)) (listLines.push(line), i++);
    else if ('' === line.trim()) {
      if (!(i + 1 < lines.length && isListItem(lines[i + 1]))) break;
      i++;
    } else {
      if (!/^\s{2,}/.test(line) || isListItem(line)) break;
      (listLines.push(line), i++);
    }
  }
  if (!listLines.length) return null;
  const html = renderListNode(
    (function (lines) {
      const root = { ordered: !1, items: [] },
        stack = [{ node: root, indent: -1 }];
      for (const line of lines) {
        const m = line.match(LIST_ITEM_RE);
        if (!m) continue;
        const indent = m[1].length,
          marker = m[2],
          text = m[3],
          ordered = /\d/.test(marker);
        for (; stack.length > 1 && stack[stack.length - 1].indent > indent; ) stack.pop();
        const top = stack[stack.length - 1];
        if (0 === top.node.items.length)
          ((top.node.ordered = ordered),
            (top.indent = indent),
            top.node.items.push({ text: text, children: null }));
        else if (top.indent === indent) top.node.items.push({ text: text, children: null });
        else if (top.indent < indent) {
          const newNode = { ordered: ordered, items: [{ text: text, children: null }] },
            parentItems = top.node.items;
          ((parentItems[parentItems.length - 1].children = newNode),
            stack.push({ node: newNode, indent: indent }));
        }
      }
      return root;
    })(listLines),
  );
  return { html: html, consumed: i - start };
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
      const checked = '' !== taskM[1].trim();
      content = `<input type="checkbox" class="md-task-check" ${checked ? 'checked' : ''} disabled><span class="md-task-label${checked ? ' md-task-done' : ''}">${renderInline(item.text.slice(taskM[0].length))}</span>`;
    } else content = renderInline(item.text);
    ((html += `<li class="md-list-item">${content}`),
      item.children && (html += renderListNode(item.children)),
      (html += '</li>'));
  }
  return ((html += `</${tag}>`), html);
}
function parseBlockquote(lines, start) {
  const inner = [];
  let i = start;
  for (; i < lines.length && lines[i].trim().startsWith('>'); )
    (inner.push(lines[i].replace(/^[ \t]*>[ \t]?/, '')), i++);
  return {
    html: `<blockquote class="md-blockquote">${parseBlocks(inner)}</blockquote>`,
    consumed: i - start,
  };
}
function parseBlocks(lines) {
  let html = '',
    paraLines = [],
    i = 0;
  function flushPara() {
    if (!paraLines.length) return;
    const parts = paraLines
      .join('\n')
      .split('\n')
      .map((l) => renderInline(l));
    ((html += `<p class="md-p">${parts.join('<br>')}</p>`), (paraLines = []));
  }
  for (; i < lines.length; ) {
    const line = lines[i],
      trimmed = line.trim();
    if ('' === trimmed) {
      (flushPara(), i++);
      continue;
    }
    if (trimmed.startsWith('\0CB')) {
      (flushPara(), (html += trimmed), i++);
      continue;
    }
    const headingM = trimmed.match(/^(#{1,6})\s+(.+?)(?:\s+#+\s*)?$/);
    if (headingM) {
      flushPara();
      const level = headingM[1].length;
      ((html += `<h${level} class="md-heading md-h${level}">${renderInline(headingM[2])}</h${level}>`),
        i++);
      continue;
    }
    if (/^(?:[-*_]){3,}$/.test(trimmed)) (flushPara(), (html += '<hr class="md-hr">'), i++);
    else {
      if (isTableRow(line) && i + 1 < lines.length && isSepRow(lines[i + 1])) {
        flushPara();
        const result = parseTable(lines, i);
        if (result) {
          ((html += result.html), (i += result.consumed));
          continue;
        }
      }
      if (trimmed.startsWith('>')) {
        flushPara();
        const result = parseBlockquote(lines, i);
        ((html += result.html), (i += result.consumed));
        continue;
      }
      if (isListItem(line)) {
        flushPara();
        const result = parseList(lines, i);
        if (result) {
          ((html += result.html), (i += result.consumed));
          continue;
        }
      }
      const termM = trimmed.match(/^\[TERMINAL:([a-zA-Z0-9.-]+)\]$/);
      if (termM) {
        flushPara();
        html += `<div class="embedded-terminal-mount" data-pid="${termM[1]}" style="height: 300px; width: 100%; border-radius: 8px; margin: 10px 0; overflow: hidden; padding: 4px; border: 1px solid var(--border-subtle); background: #12141c;"></div>`;
        i++;
        continue;
      }
      (paraLines.push(line), i++);
    }
  }
  return (flushPara(), html);
}
function buildCodeBlockHtml(lang, code, open) {
  const display = lang || 'code',
    showPreview =
      !open &&
      (function (lang, code) {
        const normalizedLang = String(lang ?? '')
          .trim()
          .toLowerCase();
        if (['html', 'htm', 'xhtml'].includes(normalizedLang)) return !0;
        const trimmed = String(code ?? '').trim();
        return /^<!doctype html\b/i.test(trimmed) || /^<html[\s>]/i.test(trimmed);
      })(lang, code);
  return (
    `<div class="code-wrapper${open ? ' is-streaming' : ''}"><div class="code-header"><span class="code-lang">${escapeHtml(display)}</span><div class="code-actions">` +
    (!open
      ? `<button class="copy-code-btn" title="Copy code"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</button>` +
        (showPreview
          ? '<button class="preview-code-btn" title="Preview HTML"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.8"/></svg> Preview</button>'
          : '') +
        `<button class="download-code-btn" title="Download file" data-lang="${escapeHtml(lang)}"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download</button>`
      : '') +
    `</div></div>` +
    `<pre><code${lang ? ` class="language-${escapeHtml(lang)}"` : ''}>${escapeHtml(code)}</code></pre></div>`
  );
}
export function render(text) {
  if (!text) return '';
  const codeBlocks = [];
  // Extract all complete (closed) code fences first
  let processed = String(text).replace(/```([^\n`]*)\n?([\s\S]*?)```/g, (_, rawLang, code) => {
    const lang = rawLang.trim(),
      id = `\0CB${codeBlocks.length}\0CB`;
    return (
      codeBlocks.push({ lang: lang, code: code.replace(/\n$/, ''), open: false }),
      `\n${id}\n`
    );
  });
  // Detect an unclosed/open fence at the end (common during streaming)
  const openFenceIdx = processed.indexOf('```');
  if (openFenceIdx !== -1) {
    const afterFence = processed.slice(openFenceIdx + 3);
    const newlineIdx = afterFence.indexOf('\n');
    const lang = (newlineIdx === -1 ? afterFence : afterFence.slice(0, newlineIdx)).trim();
    const code = newlineIdx === -1 ? '' : afterFence.slice(newlineIdx + 1);
    const id = `\0CB${codeBlocks.length}\0CB`;
    codeBlocks.push({ lang: lang, code: code, open: true });
    processed = processed.slice(0, openFenceIdx) + `\n${id}\n`;
  }
  let html = parseBlocks(processed.split('\n'));
  return (
    '\0CB'.replace(/\x00/, '\\x00'),
    (html = html.replace(new RegExp('\0CB(\\d+)\0CB', 'g'), (_, idx) => {
      const { lang, code, open } = codeBlocks[+idx];
      return buildCodeBlockHtml(lang, code, open);
    })),
    html
  );
}
