// ─────────────────────────────────────────────
//  openworld — Public/Assets/Scripts/Features/Composer/Composer.js
//  Manages the message input area: auto-resize, attachment
//  paste, drag-drop, multi-file support (CSV/JSON/YAML/MD/TXT/code).
// ─────────────────────────────────────────────

import { state }              from '../../Shared/State.js';
import { generateId }         from '../../Shared/Utils.js';
import {
  textarea, sendBtn, attachmentBtn,
  composerAttachments as composerAttachmentsEl,
  composerHint,
}                             from '../../Shared/DOM.js';
import { modelSupportsInput, getModelInputs } from '../ModelSelector/ModelSelector.js';

/* ══════════════════════════════════════════
   FILE TYPE CONFIG
   Maps extensions → display info + parser
══════════════════════════════════════════ */

const FILE_TYPES = {
  // Images
  image: { icon: '🖼️', color: '#7c5dff', label: 'Image' },

  // Data files
  json:   { icon: '{}',  color: '#f59e0b', label: 'JSON'  },
  csv:    { icon: '⊞',   color: '#22c55e', label: 'CSV'   },
  tsv:    { icon: '⊟',   color: '#22c55e', label: 'TSV'   },
  yaml:   { icon: '≡',   color: '#06b6d4', label: 'YAML'  },
  yml:    { icon: '≡',   color: '#06b6d4', label: 'YAML'  },
  toml:   { icon: '⚙',   color: '#8b5cf6', label: 'TOML'  },
  xml:    { icon: '</>',  color: '#f97316', label: 'XML'   },

  // Code
  js:     { icon: 'JS',  color: '#f7df1e', label: 'JavaScript', dark: true },
  ts:     { icon: 'TS',  color: '#3178c6', label: 'TypeScript'  },
  jsx:    { icon: 'JSX', color: '#61dafb', label: 'React', dark: true },
  tsx:    { icon: 'TSX', color: '#61dafb', label: 'React TS', dark: true },
  py:     { icon: 'PY',  color: '#3776ab', label: 'Python'      },
  rb:     { icon: 'RB',  color: '#cc342d', label: 'Ruby'        },
  go:     { icon: 'GO',  color: '#00add8', label: 'Go'          },
  rs:     { icon: 'RS',  color: '#ce422b', label: 'Rust'        },
  java:   { icon: '♨',   color: '#ed8b00', label: 'Java'        },
  cs:     { icon: 'C#',  color: '#68217a', label: 'C#'          },
  cpp:    { icon: 'C++', color: '#00589d', label: 'C++'         },
  c:      { icon: 'C',   color: '#00589d', label: 'C'           },
  php:    { icon: 'PHP', color: '#777bb4', label: 'PHP'         },
  sh:     { icon: '$_',  color: '#1d1f21', label: 'Shell'       },
  sql:    { icon: '⊡',   color: '#4479a1', label: 'SQL'         },

  // Markup / config
  html:   { icon: 'HTML', color: '#e34f26', label: 'HTML'       },
  css:    { icon: 'CSS',  color: '#1572b6', label: 'CSS'        },
  scss:   { icon: 'SCSS', color: '#cf649a', label: 'SCSS'       },
  md:     { icon: '↓',    color: '#083fa1', label: 'Markdown'   },
  mdx:    { icon: '↓',    color: '#083fa1', label: 'MDX'        },

  // Text
  txt:    { icon: '📄',  color: '#6b7280', label: 'Text'        },
  log:    { icon: '📋',  color: '#6b7280', label: 'Log'         },
  env:    { icon: '🔑',  color: '#10b981', label: 'Env'         },
};

function getFileTypeMeta(filename) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'txt';
  return FILE_TYPES[ext] ?? { icon: '📄', color: '#6b7280', label: ext.toUpperCase() };
}

/** Parse/summarise file content for the AI. */
function enrichFileContent(filename, rawText) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';

  if (ext === 'csv' || ext === 'tsv') {
    return enrichCSV(rawText, ext === 'tsv' ? '\t' : ',');
  }
  if (ext === 'json') {
    return enrichJSON(rawText);
  }
  if (ext === 'yaml' || ext === 'yml') {
    return enrichYAML(rawText);
  }
  return rawText;
}

function enrichCSV(text, delimiter = ',') {
  try {
    const lines = text.trim().split('\n');
    if (!lines.length) return text;
    const headers  = parseCSVLine(lines[0], delimiter);
    const dataRows = lines.slice(1).filter(l => l.trim());

    // Build stats
    const colStats = headers.map((h, i) => {
      const vals = dataRows
        .map(r => parseCSVLine(r, delimiter)[i] ?? '')
        .filter(v => v !== '');
      const nums = vals.map(Number).filter(n => !isNaN(n));
      if (nums.length > vals.length / 2) {
        const min = Math.min(...nums).toFixed(2);
        const max = Math.max(...nums).toFixed(2);
        const avg = (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2);
        return `${h} (numeric: min=${min}, max=${max}, avg=${avg})`;
      }
      const unique = new Set(vals).size;
      return `${h} (${unique} unique values)`;
    });

    const preview = [lines[0], ...dataRows.slice(0, 5)].join('\n');
    const note    = dataRows.length > 5
      ? `\n…(${dataRows.length - 5} more rows)`
      : '';

    return [
      `[CSV: ${dataRows.length} rows × ${headers.length} columns]`,
      `Columns: ${colStats.join(' | ')}`,
      '',
      preview + note,
    ].join('\n');
  } catch {
    return text;
  }
}

function parseCSVLine(line, delimiter = ',') {
  const result = [];
  let current  = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function enrichJSON(text) {
  try {
    const data = JSON.parse(text);
    const type = Array.isArray(data) ? 'array' : typeof data;
    const note = Array.isArray(data)
      ? `[JSON Array: ${data.length} items]`
      : `[JSON Object: ${Object.keys(data).length} keys]`;

    // Pretty-print up to 4 KB
    const pretty = JSON.stringify(data, null, 2);
    const truncated = pretty.length > 4000
      ? pretty.slice(0, 4000) + '\n…(truncated)'
      : pretty;

    return `${note}\n\n${truncated}`;
  } catch {
    return text;
  }
}

function enrichYAML(text) {
  // No parse — just count top-level keys by looking at non-indented lines
  const topLevel = text.split('\n')
    .filter(l => l.trim() && !l.startsWith(' ') && !l.startsWith('\t') && !l.startsWith('#') && !l.startsWith('-'))
    .map(l => l.split(':')[0].trim())
    .filter(Boolean);
  const note = topLevel.length
    ? `[YAML: ${topLevel.length} top-level keys: ${topLevel.slice(0, 8).join(', ')}${topLevel.length > 8 ? '…' : ''}]`
    : '[YAML file]';
  return `${note}\n\n${text}`;
}

/* ══════════════════════════════════════════
   INTERNAL
══════════════════════════════════════════ */
let _onSend   = () => {};
let _hintTimer = null;

function getModelName() {
  return state.selectedProvider?.models?.[state.selectedModel]?.name ?? 'This model';
}

function hasUnsupportedImage() {
  return state.composerAttachments.some(
    a => a.type === 'image' && !modelSupportsInput('image'),
  );
}

/* ── Send button ── */
function updateSendBtn() {
  const ready =
    (textarea.value.trim().length > 0 || state.composerAttachments.length > 0) &&
    !state.isTyping &&
    !hasUnsupportedImage();
  sendBtn.classList.toggle('ready', ready);
  sendBtn.disabled = !ready;
}

/* ── Hint banner ── */
function showHint(message, tone = 'info', { sticky = false } = {}) {
  if (!composerHint) return;
  clearTimeout(_hintTimer);
  composerHint.textContent    = message;
  composerHint.className      = `composer-hint visible ${tone}`;
  composerHint.dataset.sticky = sticky ? 'true' : 'false';
  if (!sticky)
    _hintTimer = window.setTimeout(hideHint, 2800);
}

function hideHint(force = false) {
  if (!composerHint) return;
  if (!force && composerHint.dataset.sticky === 'true') return;
  clearTimeout(_hintTimer);
  composerHint.textContent    = '';
  composerHint.className      = 'composer-hint';
  composerHint.dataset.sticky = 'false';
}

function clearCapabilityHint() {
  if (!hasUnsupportedImage()) hideHint(true);
}

/* ── Auto-resize ── */
function autoResize() {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  updateSendBtn();
}

/* ── Composer attachment chip renderer ── */
function buildImageFrame(attachment, className) {
  const frame = document.createElement('div');
  frame.className = className;
  frame.title     = attachment.name || 'Pasted image';
  const img = document.createElement('img');
  img.src     = attachment.dataUrl;
  img.alt     = attachment.name || 'Pasted image';
  img.loading = 'lazy';
  frame.appendChild(img);
  return frame;
}

function buildFileChip(att) {
  const meta = getFileTypeMeta(att.name || 'file.txt');
  const extMatch = (att.name || '').match(/\.([^.]+)$/);
  const ext = extMatch ? extMatch[1].toUpperCase() : 'FILE';
  const preview = document.createElement('div');
  preview.className = 'composer-file-preview';

  const badge = document.createElement('div');
  badge.style.cssText = `
    display:inline-flex;align-items:center;justify-content:center;
    width:32px;height:32px;border-radius:8px;font-size:10px;font-weight:700;
    background:${meta.color}22;color:${meta.color};
    border:1px solid ${meta.color}44;margin-bottom:6px;flex-shrink:0;
    font-family:var(--font-mono);letter-spacing:-0.5px;
  `;
  badge.textContent = ext.slice(0, 4);

  const nameEl = document.createElement('div');
  nameEl.style.cssText = `font-size:11px;font-weight:600;color:var(--text-primary);
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;`;
  nameEl.textContent = att.name;

  const meta2 = document.createElement('div');
  meta2.style.cssText = 'font-size:10px;color:var(--text-muted);margin-top:2px;';
  meta2.textContent = att.summary || (att.lines ? `${att.lines} lines` : meta.label);

  preview.style.cssText = `
    display:flex;flex-direction:column;align-items:flex-start;
    width:100%;height:100%;padding:10px;box-sizing:border-box;
  `;
  preview.append(badge, nameEl, meta2);
  return preview;
}

function renderAttachments() {
  if (!composerAttachmentsEl) return;
  composerAttachmentsEl.innerHTML = '';
  composerAttachmentsEl.hidden    = state.composerAttachments.length === 0;

  state.composerAttachments.forEach(att => {
    const chip    = document.createElement('div');
    chip.className = 'composer-attachment';
    chip.title     = att.name || 'Attachment';

    let preview;
    if (att.type === 'image') {
      preview = buildImageFrame(att, 'composer-attachment-preview');
    } else {
      preview = buildFileChip(att);
    }

    const removeBtn = document.createElement('button');
    removeBtn.type      = 'button';
    removeBtn.className = 'composer-attachment-remove';
    removeBtn.setAttribute('aria-label', `Remove ${att.name || 'attachment'}`);
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
      state.composerAttachments = state.composerAttachments.filter(i => i.id !== att.id);
      renderAttachments();
      clearCapabilityHint();
      updateSendBtn();
      textarea.focus();
    });

    chip.append(preview, removeBtn);
    composerAttachmentsEl.appendChild(chip);
  });
}

/* ── Clipboard image paste ── */
function readClipboardImage(item, index) {
  return new Promise(resolve => {
    const file = item.getAsFile();
    if (!file) { resolve(null); return; }
    const reader = new FileReader();
    reader.onload  = () => resolve({
      id:       generateId('attachment'),
      type:     'image',
      mimeType: file.type || 'image/png',
      name:     file.name || `Pasted image ${index + 1}`,
      dataUrl:  String(reader.result ?? ''),
    });
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

async function handlePaste(event) {
  const items      = Array.from(event.clipboardData?.items ?? []);
  const imageItems = items.filter(i => i.type.startsWith('image/'));
  if (imageItems.length === 0) return;

  event.preventDefault();
  const pastedText = event.clipboardData?.getData('text/plain') ?? '';
  if (pastedText) {
    const start = textarea.selectionStart ?? textarea.value.length;
    const end   = textarea.selectionEnd   ?? start;
    textarea.value = `${textarea.value.slice(0, start)}${pastedText}${textarea.value.slice(end)}`;
    textarea.setSelectionRange(start + pastedText.length, start + pastedText.length);
    autoResize();
  }

  if (!modelSupportsInput('image')) {
    showHint(`${getModelName()} does not support image input.`, 'warning');
    updateSendBtn();
    return;
  }

  const attachments = (await Promise.all(imageItems.map(readClipboardImage))).filter(Boolean);
  if (!attachments.length) {
    showHint('That image could not be added from the clipboard.', 'warning');
    return;
  }

  state.composerAttachments = [...state.composerAttachments, ...attachments];
  renderAttachments();
  showHint(attachments.length === 1 ? 'Image added.' : `${attachments.length} images added.`);
  updateSendBtn();
}

/* ══════════════════════════════════════════
   PUBLIC — addAttachments
   Feature 5: Rich multi-file support.
   Handles images + CSV, JSON, YAML, MD, code, TXT, etc.
══════════════════════════════════════════ */
export async function addAttachments(files) {
  const newAttachments = [];
  let rejectedImages   = false;

  for (const file of files) {
    const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'txt';
    const mime = file.type || '';

    // ── Image files ──────────────────────────────────────────────────────
    if (mime.startsWith('image/')) {
      if (!modelSupportsInput('image')) {
        rejectedImages = true;
        continue;
      }
      const dataUrl = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload  = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
      if (dataUrl) {
        newAttachments.push({
          id: generateId('attachment'), type: 'image',
          mimeType: mime, name: file.name, dataUrl,
        });
      }
      continue;
    }

    // ── Text / data / code files ─────────────────────────────────────────
    const MAX_SIZE = 2 * 1024 * 1024; // 2 MB limit for text files
    if (file.size > MAX_SIZE) {
      showHint(`"${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 2 MB.`, 'warning');
      continue;
    }

    const rawText = await file.text().catch(() => null);
    if (rawText === null) {
      showHint(`Could not read "${file.name}" — it may be a binary file.`, 'warning');
      continue;
    }

    const lines          = rawText.split('\n').length;
    const enrichedContent = enrichFileContent(file.name, rawText);
    const meta            = getFileTypeMeta(file.name);

    // Build a short summary for the chip subtitle
    let summary = meta.label;
    if (ext === 'csv' || ext === 'tsv') {
      const dataLines = rawText.trim().split('\n').length - 1;
      summary = `${dataLines} rows`;
    } else if (ext === 'json') {
      try {
        const d = JSON.parse(rawText);
        summary = Array.isArray(d) ? `${d.length} items` : `${Object.keys(d).length} keys`;
      } catch { summary = 'JSON'; }
    } else {
      summary = `${lines} lines`;
    }

    newAttachments.push({
      id:          generateId('attachment'),
      type:        'file',
      mimeType:    mime || `text/${ext}`,
      name:        file.name,
      textContent: enrichedContent,  // enriched version for AI
      rawContent:  rawText,          // original for potential re-processing
      lines,
      summary,
      ext,
    });
  }

  if (rejectedImages) {
    showHint(`${getModelName()} does not support images. Ignoring image files.`, 'warning');
  }

  if (newAttachments.length) {
    state.composerAttachments = [...state.composerAttachments, ...newAttachments];
    renderAttachments();
    updateSendBtn();

    if (newAttachments.length === 1) {
      const a = newAttachments[0];
      if (a.type === 'file') {
        showHint(`📎 ${a.name} attached (${a.summary})`);
      }
    } else {
      showHint(`📎 ${newAttachments.length} files attached`);
    }
  }
}

/* ══════════════════════════════════════════
   PUBLIC — SYNC CAPABILITIES
══════════════════════════════════════════ */
export function syncCapabilities() {
  const supportsImages = modelSupportsInput('image');
  if (attachmentBtn) {
    attachmentBtn.classList.toggle('is-disabled', false); // files always ok
    attachmentBtn.setAttribute('aria-disabled', 'false');
    attachmentBtn.title = 'Attach files (images, CSV, JSON, YAML, code, text…)';
  }

  if (!supportsImages) {
    const hasImages = state.composerAttachments.some(a => a.type === 'image');
    if (hasImages) {
      state.composerAttachments = state.composerAttachments.filter(a => a.type !== 'image');
      renderAttachments();
      showHint(`Switched to a model that does not support images. Images were removed.`, 'warning');
    } else {
      clearCapabilityHint();
    }
  } else {
    clearCapabilityHint();
  }
  updateSendBtn();
}

/* ══════════════════════════════════════════
   PUBLIC — RESET
══════════════════════════════════════════ */
export function reset() {
  textarea.value            = '';
  textarea.style.height     = 'auto';
  state.composerAttachments = [];
  renderAttachments();
  hideHint(true);
  autoResize();
}

/* ══════════════════════════════════════════
   PUBLIC — INIT
══════════════════════════════════════════ */
export function init(onSend) {
  _onSend = onSend;

  textarea.addEventListener('input', autoResize);
  textarea.addEventListener('paste', handlePaste);
  textarea.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _onSend(); }
  });

  sendBtn.addEventListener('click', _onSend);

  // Attachment button opens native file picker for all supported types
  attachmentBtn?.addEventListener('click', () => {
    const input = Object.assign(document.createElement('input'), {
      type:     'file',
      multiple: true,
      accept:   'image/*,.csv,.tsv,.json,.yaml,.yml,.toml,.xml,.txt,.md,.mdx,.log,.env,.sh,.py,.js,.ts,.jsx,.tsx,.vue,.svelte,.rs,.go,.rb,.java,.cs,.cpp,.c,.h,.php,.sql,.graphql,.html,.css,.scss,.less',
    });
    input.addEventListener('change', async () => {
      if (input.files?.length) await addAttachments(Array.from(input.files));
    });
    input.click();
  });

  // Re-sync when model changes
  window.addEventListener('ow:model-selection-changed', syncCapabilities);

  autoResize();
}
