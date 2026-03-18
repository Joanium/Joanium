// ─────────────────────────────────────────────
//  openworld — Public/Assets/Scripts/Shared/Markdown.js
//  Lightweight markdown → HTML renderer.
//  No external dependencies — pure string transforms.
// ─────────────────────────────────────────────

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

  // Fenced code blocks  (``` … ```)
  html = html.replace(/```(?:[^\n]*)?\n([\s\S]*?)```/g,
    (_, code) => `<pre><code>${code}</code></pre>`);

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

  return `<p>${html}</p>`;
}
