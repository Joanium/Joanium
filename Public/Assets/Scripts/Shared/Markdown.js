import { escapeHtml } from './Utils.js';

/**
 * Convert a markdown string to an HTML string.
 * Supports: fenced code blocks, inline code, bold, italic,
 * headings (h1–h3), list items, and paragraphs.
 *
 * @param {string} text
 * @returns {string}  Wrapped in <p>…</p>
 */
export function render(text) {
  let html = escapeHtml(text);
  const codeBlocks = [];

  // 1. Extract Fenced code blocks securely before processing other Markdown
  html = html.replace(/```([^\n]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const id = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push({ lang, code });
    return id;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold / italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g,     '<em>$1</em>');

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm,  '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm,   '<h1>$1</h1>');

  // List items (unordered + ordered)
  html = html.replace(/^[-*] (.+)$/gm,  '<li>$1</li>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Paragraphs & line breaks
  html = html.replace(/\n\n+/g, '</p><p>');
  html = html.replace(/\n/g,    '<br>');

  // 2. Restore Code Blocks with Copy + Download Button UI
  codeBlocks.forEach((block, i) => {
    const id = `__CODE_BLOCK_${i}__`;
    const lang = block.lang.trim();
    const langClass = lang ? ` class="language-${lang}"` : '';
    const langDisplay = lang
      ? `<span class="code-lang">${lang}</span>`
      : `<span class="code-lang">code</span>`;

    // Copy icon SVG
    const copyIconSvg = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;

    // Download icon SVG
    const downloadIconSvg = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;

    const replacement = `</p>
      <div class="code-wrapper">
        <div class="code-header">
          ${langDisplay}
          <div class="code-actions">
            <button class="copy-code-btn" title="Copy code">
              ${copyIconSvg} Copy
            </button>
            <button class="download-code-btn" title="Download file" data-lang="${escapeHtml(lang)}">
              ${downloadIconSvg} Download
            </button>
          </div>
        </div>
        <pre><code${langClass}>${block.code}</code></pre>
      </div><p>`;
    html = html.replace(id, replacement);
  });

  // Cleanup empty paragraphs created during extraction
  html = `<p>${html}</p>`.replace(/<p><\/p>/g, '');
  html = html.replace(/<p><br><\/p>/g, '');

  return html;
}
