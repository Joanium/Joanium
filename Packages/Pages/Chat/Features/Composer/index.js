import { state } from '../../../../System/State.js';
import { generateId } from '../../../../System/Utils.js';
import { triggerSendBtnUpdate } from '../index.js';
import {
  textarea,
  sendBtn,
  attachmentBtn,
  folderBtn,
  composerAttachments as composerAttachmentsEl,
  composerHint,
} from '../../../Shared/Core/DOM.js';
import { modelSupportsInput } from '../ModelSelector/index.js';
import {
  DIRECT_TEXT_EXTENSIONS,
  DIRECT_TEXT_MAX_SIZE,
  EXTRACTABLE_BINARY_MAX_SIZE,
  getFileTypeMeta,
  isTextLikeMime,
  isExtractableBinary,
} from './ComposerFileTypes.js';
import { enrichFileContent } from './ComposerParsers.js';
import {
  clearToolChips,
  getActiveToolScopes,
  isSlashMenuVisible,
} from './SlashCommands.js';
let _onSend = () => {},
  _hintTimer = null;
function getModelName() {
  return state.selectedProvider?.models?.[state.selectedModel]?.name ?? 'This model';
}
function hasUnsupportedImage() {
  return state.composerAttachments.some((a) => 'image' === a.type && !modelSupportsInput('image'));
}
function updateSendBtn() {
  triggerSendBtnUpdate();
}
function showHint(message, tone = 'info', { sticky: sticky = !1 } = {}) {
  composerHint &&
    (clearTimeout(_hintTimer),
    (composerHint.textContent = message),
    (composerHint.className = `composer-hint visible ${tone}`),
    (composerHint.dataset.sticky = sticky ? 'true' : 'false'),
    sticky || (_hintTimer = window.setTimeout(hideHint, 2800)));
}
function hideHint(force = !1) {
  composerHint &&
    (force || 'true' !== composerHint.dataset.sticky) &&
    (clearTimeout(_hintTimer),
    (composerHint.textContent = ''),
    (composerHint.className = 'composer-hint'),
    (composerHint.dataset.sticky = 'false'));
}
function clearCapabilityHint() {
  hasUnsupportedImage() || hideHint(!0);
}
function syncWorkspacePickerVisibility() {
  if (!folderBtn) return;
  const hidden = Boolean(state.activeProject);
  ((folderBtn.hidden = hidden), folderBtn.setAttribute('aria-hidden', hidden ? 'true' : 'false'));
}
function autoResize() {
  ((textarea.style.height = 'auto'),
    (textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px'),
    updateSendBtn());
}
function renderAttachments() {
  composerAttachmentsEl &&
    ((composerAttachmentsEl.innerHTML = ''),
    (composerAttachmentsEl.hidden = 0 === state.composerAttachments.length),
    state.composerAttachments.forEach((att) => {
      const chip = document.createElement('div');
      let preview;
      ((chip.className = 'composer-attachment'),
        (chip.title = att.name || 'Attachment'),
        (preview =
          'image' === att.type
            ? (function (attachment) {
                const frame = document.createElement('div');
                ((frame.className = 'composer-attachment-preview'),
                  (frame.title = attachment.name || 'Pasted image'));
                const img = document.createElement('img');
                return (
                  (img.src = attachment.dataUrl),
                  (img.alt = attachment.name || 'Pasted image'),
                  (img.loading = 'lazy'),
                  frame.appendChild(img),
                  frame
                );
              })(att)
            : (function (att) {
                const meta = getFileTypeMeta(att.name || 'file.txt'),
                  extMatch = (att.name || '').match(/\.([^.]+)$/),
                  ext = extMatch ? extMatch[1].toUpperCase() : 'FILE',
                  preview = document.createElement('div');
                preview.className = 'composer-file-preview';
                const badge = document.createElement('div');
                ((badge.style.cssText = `\n    display:inline-flex;align-items:center;justify-content:center;\n    width:32px;height:32px;border-radius:8px;font-size:10px;font-weight:700;\n    background:${meta.color}22;color:${meta.color};\n    border:1px solid ${meta.color}44;margin-bottom:6px;flex-shrink:0;\n    font-family:var(--font-mono);letter-spacing:-0.5px;\n  `),
                  (badge.textContent = ext.slice(0, 4)));
                const nameEl = document.createElement('div');
                ((nameEl.style.cssText =
                  'font-size:11px;font-weight:600;color:var(--text-primary);\n    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;'),
                  (nameEl.textContent = att.name));
                const meta2 = document.createElement('div');
                return (
                  (meta2.style.cssText = 'font-size:10px;color:var(--text-muted);margin-top:2px;'),
                  (meta2.textContent =
                    att.summary || (att.lines ? `${att.lines} lines` : meta.label)),
                  (preview.style.cssText =
                    '\n    display:flex;flex-direction:column;align-items:flex-start;\n    width:100%;height:100%;padding:10px;box-sizing:border-box;\n  '),
                  preview.append(badge, nameEl, meta2),
                  preview
                );
              })(att)));
      const removeBtn = document.createElement('button');
      ((removeBtn.type = 'button'),
        (removeBtn.className = 'composer-attachment-remove'),
        removeBtn.setAttribute('aria-label', `Remove ${att.name || 'attachment'}`),
        (removeBtn.textContent = '×'),
        removeBtn.addEventListener('click', () => {
          ((state.composerAttachments = state.composerAttachments.filter((i) => i.id !== att.id)),
            renderAttachments(),
            clearCapabilityHint(),
            updateSendBtn(),
            textarea.focus());
        }),
        chip.append(preview, removeBtn),
        composerAttachmentsEl.appendChild(chip));
    }));
}
function readClipboardImage(item, index) {
  return new Promise((resolve) => {
    const file = item.getAsFile();
    if (!file) return void resolve(null);
    const reader = new FileReader();
    ((reader.onload = () =>
      resolve({
        id: generateId('attachment'),
        type: 'image',
        mimeType: file.type || 'image/png',
        name: file.name || `Pasted image ${index + 1}`,
        dataUrl: String(reader.result ?? ''),
      })),
      (reader.onerror = () => resolve(null)),
      reader.readAsDataURL(file));
  });
}
async function extractBinaryAttachment(file, ext, mime) {
  const arrayBuffer = await file.arrayBuffer(),
    result = await window.electronAPI?.invoke?.('extract-document-text', {
      fileName: file.name,
      mimeType: mime,
      buffer: arrayBuffer,
    });
  if (!result?.ok) throw new Error(result?.error ?? 'Text extraction failed.');
  return {
    id: generateId('attachment'),
    type: 'file',
    mimeType: mime || `application/${ext || 'octet-stream'}`,
    name: file.name,
    textContent: result.text,
    rawContent: '',
    lines: result.lines,
    summary: result.summary,
    ext: ext,
    extractedKind: result.kind,
    extractedWarnings: result.warnings ?? [],
  };
}
async function handlePaste(event) {
  const imageItems = Array.from(event.clipboardData?.items ?? []).filter((i) =>
    i.type.startsWith('image/'),
  );
  if (0 === imageItems.length) return;
  event.preventDefault();
  const pastedText = event.clipboardData?.getData('text/plain') ?? '';
  if (pastedText) {
    const start = textarea.selectionStart ?? textarea.value.length,
      end = textarea.selectionEnd ?? start;
    ((textarea.value = `${textarea.value.slice(0, start)}${pastedText}${textarea.value.slice(end)}`),
      textarea.setSelectionRange(start + pastedText.length, start + pastedText.length),
      autoResize());
  }
  if (!modelSupportsInput('image'))
    return (
      showHint(`${getModelName()} does not support image input.`, 'warning'),
      void updateSendBtn()
    );
  const attachments = (await Promise.all(imageItems.map(readClipboardImage))).filter(Boolean);
  attachments.length
    ? ((state.composerAttachments = [...state.composerAttachments, ...attachments]),
      renderAttachments(),
      showHint(1 === attachments.length ? 'Image added.' : `${attachments.length} images added.`),
      updateSendBtn())
    : showHint('That image could not be added from the clipboard.', 'warning');
}
export async function addAttachments(files) {
  const newAttachments = [];
  let rejectedImages = !1;
  for (const file of files) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'txt',
      mime = file.type || '';
    if (mime.startsWith('image/')) {
      if (!modelSupportsInput('image')) {
        rejectedImages = !0;
        continue;
      }
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        ((reader.onload = () => resolve(reader.result)),
          (reader.onerror = () => resolve(null)),
          reader.readAsDataURL(file));
      });
      dataUrl &&
        newAttachments.push({
          id: generateId('attachment'),
          type: 'image',
          mimeType: mime,
          name: file.name,
          dataUrl: dataUrl,
        });
      continue;
    }
    const binaryExtractable = isExtractableBinary(ext, mime),
      directText = DIRECT_TEXT_EXTENSIONS.has(ext) || isTextLikeMime(mime),
      maxSize = binaryExtractable ? EXTRACTABLE_BINARY_MAX_SIZE : DIRECT_TEXT_MAX_SIZE;
    if (file.size > maxSize) {
      const maxSizeMb = (maxSize / 1024 / 1024).toFixed(0);
      showHint(
        `"${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max ${maxSizeMb} MB.`,
        'warning',
      );
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
    const rawText = await file.text().catch(() => null);
    if (null === rawText) {
      showHint(`Could not read "${file.name}" — it may be a binary file.`, 'warning');
      continue;
    }
    const lines = rawText.split('\n').length,
      enrichedContent = enrichFileContent(file.name, rawText);
    let summary = getFileTypeMeta(file.name).label;
    if ('csv' === ext || 'tsv' === ext) summary = rawText.trim().split('\n').length - 1 + ' rows';
    else if ('json' === ext)
      try {
        const d = JSON.parse(rawText);
        summary = Array.isArray(d) ? `${d.length} items` : `${Object.keys(d).length} keys`;
      } catch {
        summary = 'JSON';
      }
    else summary = `${lines} lines`;
    newAttachments.push({
      id: generateId('attachment'),
      type: 'file',
      mimeType: mime || `text/${ext}`,
      name: file.name,
      textContent: enrichedContent,
      rawContent: rawText,
      lines: lines,
      summary: summary,
      ext: ext,
    });
  }
  if (
    (rejectedImages &&
      showHint(`${getModelName()} does not support images. Ignoring image files.`, 'warning'),
    newAttachments.length)
  )
    if (
      ((state.composerAttachments = [...state.composerAttachments, ...newAttachments]),
      renderAttachments(),
      updateSendBtn(),
      1 === newAttachments.length)
    ) {
      const a = newAttachments[0];
      'file' === a.type && showHint(`📎 ${a.name} attached (${a.summary})`);
    } else showHint(`📎 ${newAttachments.length} files attached`);
}
export function syncCapabilities() {
  const supportsImages = modelSupportsInput('image');
  (attachmentBtn &&
    (attachmentBtn.classList.toggle('is-disabled', !1),
    attachmentBtn.setAttribute('aria-disabled', 'false'),
    (attachmentBtn.title = 'Attach files (images, PDF, Word, Excel, slides, code, text…)')),
    supportsImages
      ? clearCapabilityHint()
      : state.composerAttachments.some((a) => 'image' === a.type)
        ? ((state.composerAttachments = state.composerAttachments.filter(
            (a) => 'image' !== a.type,
          )),
          renderAttachments(),
          showHint(
            'Switched to a model that does not support images. Images were removed.',
            'warning',
          ))
        : clearCapabilityHint(),
    updateSendBtn());
}
export function reset() {
  ((textarea.value = ''),
    (textarea.style.height = 'auto'),
    (state.composerAttachments = []),
    renderAttachments(),
    clearToolChips(),
    hideHint(!0),
    autoResize());
}
export function init(onSend) {
  ((_onSend = onSend),
    textarea.addEventListener('input', autoResize),
    textarea.addEventListener('paste', handlePaste),
    textarea.addEventListener('keydown', (e) => {
      // Don't send when the slash command menu is open — it handles its own Enter/Tab/Esc
      if (isSlashMenuVisible()) return;
      'Enter' !== e.key || e.shiftKey || (e.preventDefault(), _onSend());
    }),
    sendBtn.addEventListener('click', _onSend),
    attachmentBtn?.addEventListener('click', () => {
      const input = Object.assign(document.createElement('input'), {
        type: 'file',
        multiple: !0,
        accept:
          'image/*,.pdf,.docx,.xlsx,.xlsm,.pptx,.csv,.tsv,.json,.yaml,.yml,.toml,.xml,.txt,.md,.mdx,.log,.env,.rtf,.sh,.py,.js,.ts,.jsx,.tsx,.vue,.svelte,.rs,.go,.rb,.java,.cs,.cpp,.c,.h,.hpp,.php,.sql,.graphql,.gql,.html,.css,.scss,.less,.astro',
      });
      (input.addEventListener('change', async () => {
        input.files?.length && (await addAttachments(Array.from(input.files)));
      }),
        input.click());
    }),
    folderBtn &&
      (folderBtn.addEventListener('click', async () => {
        if (state.activeProject) return;
        const result = await window.electronAPI?.invoke?.('select-directory');
        result &&
          result.ok &&
          result.path &&
          ((state.workspacePath = result.path),
          window.dispatchEvent(
            new CustomEvent('ow:workspace-changed', { detail: { workspacePath: result.path } }),
          ),
          showHint(`📂 Workpace Set: ${result.path}`, 'info', { sticky: !0 }),
          updateSendBtn());
      }),
      folderBtn.addEventListener('dblclick', () => {
        state.activeProject ||
          (state.workspacePath &&
            ((state.workspacePath = null),
            window.dispatchEvent(
              new CustomEvent('ow:workspace-changed', { detail: { workspacePath: null } }),
            ),
            showHint('Workspace cleared.', 'info')));
      })),
    window.addEventListener('ow:model-selection-changed', syncCapabilities),
    window.addEventListener('ow:project-changed', syncWorkspacePickerVisibility),
    syncWorkspacePickerVisibility(),
    autoResize());
}
export { syncWorkspacePickerVisibility };
export { getActiveToolScopes, clearToolChips, isSlashMenuVisible };
