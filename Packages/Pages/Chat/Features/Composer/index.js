import { state } from '../../../../System/State.js';
import { generateId } from '../../../../System/Utils.js';
import {
  textarea, sendBtn, attachmentBtn, folderBtn,
  composerAttachments as composerAttachmentsEl,
  composerHint,
} from '../../../Shared/Core/DOM.js';
import { modelSupportsInput } from '../ModelSelector/index.js';
import {
  FILE_TYPES,
  DIRECT_TEXT_EXTENSIONS,
  EXTRACTABLE_BINARY_EXTENSIONS,
  DIRECT_TEXT_MAX_SIZE,
  EXTRACTABLE_BINARY_MAX_SIZE,
  getFileTypeMeta,
  isTextLikeMime,
  isExtractableBinary,
} from './ComposerFileTypes.js';
import { enrichFileContent } from './ComposerParsers.js';

/* ══════════════════════════════════════════
   INTERNAL
══════════════════════════════════════════ */
let _onSend = () => { };
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
  composerHint.textContent = message;
  composerHint.className = `composer-hint visible ${tone}`;
  composerHint.dataset.sticky = sticky ? 'true' : 'false';
  if (!sticky)
    _hintTimer = window.setTimeout(hideHint, 2800);
}

function hideHint(force = false) {
  if (!composerHint) return;
  if (!force && composerHint.dataset.sticky === 'true') return;
  clearTimeout(_hintTimer);
  composerHint.textContent = '';
  composerHint.className = 'composer-hint';
  composerHint.dataset.sticky = 'false';
}

function clearCapabilityHint() {
  if (!hasUnsupportedImage()) hideHint(true);
}

function syncWorkspacePickerVisibility() {
  if (!folderBtn) return;
  const hidden = Boolean(state.activeProject);
  folderBtn.hidden = hidden;
  folderBtn.setAttribute('aria-hidden', hidden ? 'true' : 'false');
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
  frame.title = attachment.name || 'Pasted image';
  const img = document.createElement('img');
  img.src = attachment.dataUrl;
  img.alt = attachment.name || 'Pasted image';
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
  composerAttachmentsEl.hidden = state.composerAttachments.length === 0;

  state.composerAttachments.forEach(att => {
    const chip = document.createElement('div');
    chip.className = 'composer-attachment';
    chip.title = att.name || 'Attachment';

    let preview;
    if (att.type === 'image') {
      preview = buildImageFrame(att, 'composer-attachment-preview');
    } else {
      preview = buildFileChip(att);
    }

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
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
    reader.onload = () => resolve({
      id: generateId('attachment'),
      type: 'image',
      mimeType: file.type || 'image/png',
      name: file.name || `Pasted image ${index + 1}`,
      dataUrl: String(reader.result ?? ''),
    });
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

async function extractBinaryAttachment(file, ext, mime) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await window.electronAPI?.extractDocumentText?.({
    fileName: file.name,
    mimeType: mime,
    buffer: arrayBuffer,
  });

  if (!result?.ok) {
    throw new Error(result?.error ?? 'Text extraction failed.');
  }

  return {
    id: generateId('attachment'),
    type: 'file',
    mimeType: mime || `application/${ext || 'octet-stream'}`,
    name: file.name,
    textContent: result.text,
    rawContent: '',
    lines: result.lines,
    summary: result.summary,
    ext,
    extractedKind: result.kind,
    extractedWarnings: result.warnings ?? [],
  };
}

async function handlePaste(event) {
  const items = Array.from(event.clipboardData?.items ?? []);
  const imageItems = items.filter(i => i.type.startsWith('image/'));
  if (imageItems.length === 0) return;

  event.preventDefault();
  const pastedText = event.clipboardData?.getData('text/plain') ?? '';
  if (pastedText) {
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? start;
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
   Handles images + CSV, JSON, YAML, MD, code, TXT, PDF, DOCX, XLSX/XLSM, PPTX.
══════════════════════════════════════════ */
export async function addAttachments(files) {
  const newAttachments = [];
  let rejectedImages = false;

  for (const file of files) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'txt';
    const mime = file.type || '';

    // ── Image files ──────────────────────────────────────────────────────
    if (mime.startsWith('image/')) {
      if (!modelSupportsInput('image')) {
        rejectedImages = true;
        continue;
      }
      const dataUrl = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
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

    const binaryExtractable = isExtractableBinary(ext, mime);
    const directText = DIRECT_TEXT_EXTENSIONS.has(ext) || isTextLikeMime(mime);
    const maxSize = binaryExtractable ? EXTRACTABLE_BINARY_MAX_SIZE : DIRECT_TEXT_MAX_SIZE;

    if (file.size > maxSize) {
      const maxSizeMb = (maxSize / 1024 / 1024).toFixed(0);
      showHint(`"${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max ${maxSizeMb} MB.`, 'warning');
      continue;
    }

    if (binaryExtractable) {
      try {
        newAttachments.push(await extractBinaryAttachment(file, ext, mime));
      } catch (err) {
        showHint(`Could not extract readable text from "${file.name}": ${err.message}`, 'warning');
      }
      continue;
    }

    if (!directText) {
      showHint(`"${file.name}" is not a supported text or document format yet.`, 'warning');
      continue;
    }

    // ── Text / data / code files ─────────────────────────────────────────
    const rawText = await file.text().catch(() => null);
    if (rawText === null) {
      showHint(`Could not read "${file.name}" — it may be a binary file.`, 'warning');
      continue;
    }

    const lines = rawText.split('\n').length;
    const enrichedContent = enrichFileContent(file.name, rawText);
    const meta = getFileTypeMeta(file.name);

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
      id: generateId('attachment'),
      type: 'file',
      mimeType: mime || `text/${ext}`,
      name: file.name,
      textContent: enrichedContent,  // enriched version for AI
      rawContent: rawText,          // original for potential re-processing
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
    attachmentBtn.title = 'Attach files (images, PDF, Word, Excel, slides, code, text…)';
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
  textarea.value = '';
  textarea.style.height = 'auto';
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
      type: 'file',
      multiple: true,
      accept: 'image/*,.pdf,.docx,.xlsx,.xlsm,.pptx,.csv,.tsv,.json,.yaml,.yml,.toml,.xml,.txt,.md,.mdx,.log,.env,.rtf,.sh,.py,.js,.ts,.jsx,.tsx,.vue,.svelte,.rs,.go,.rb,.java,.cs,.cpp,.c,.h,.hpp,.php,.sql,.graphql,.gql,.html,.css,.scss,.less,.astro',
    });
    input.addEventListener('change', async () => {
      if (input.files?.length) await addAttachments(Array.from(input.files));
    });
    input.click();
  });

  // Open Folder Button logic
  if (folderBtn) {
    folderBtn.addEventListener('click', async () => {
      if (state.activeProject) return;
      const result = await window.electronAPI?.selectDirectory?.();
      if (result && result.ok && result.path) {
        state.workspacePath = result.path;
        window.dispatchEvent(new CustomEvent('ow:workspace-changed', {
          detail: { workspacePath: result.path },
        }));
        showHint(`📂 Workpace Set: ${result.path}`, 'info', { sticky: true });
        updateSendBtn();
      }
    });

    // Clear workspace state if user double clicks folder btn
    folderBtn.addEventListener('dblclick', () => {
      if (state.activeProject) return;
      if (state.workspacePath) {
        state.workspacePath = null;
        window.dispatchEvent(new CustomEvent('ow:workspace-changed', {
          detail: { workspacePath: null },
        }));
        showHint(`Workspace cleared.`, 'info');
      }
    });
  }

  // Re-sync when model changes
  window.addEventListener('ow:model-selection-changed', syncCapabilities);
  window.addEventListener('ow:project-changed', syncWorkspacePickerVisibility);

  syncWorkspacePickerVisibility();
  autoResize();
}

export { syncWorkspacePickerVisibility };
