import { state } from '../../../../System/State.js';
import { fetchWithTools } from '../../../../Features/AI/index.js';
import { buildChatPayload } from '../Data/ChatPersistence.js';
let _memorySyncChain = Promise.resolve();
const _queuedSignatures = new Set();
function buildSnapshotScope(projectId = null) {
  return projectId ? { projectId: projectId } : {};
}
function hasMeaningfulConversation(messages = []) {
  return (Array.isArray(messages) ? messages : []).some(
    (message) =>
      'user' === message?.role &&
      (String(message?.content ?? '').trim() || (message?.attachments?.length ?? 0) > 0),
  );
}
function normalizeForSignature(value = '') {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}
function buildMemoryCatalogBlock(entries = []) {
  const fileList = entries.map((entry) => entry.filename).join(', '),
    nonEmptyEntries = entries.filter((entry) => {
      const lines = String(entry.content ?? '')
        .replace(/\r\n/g, '\n')
        .split('\n');
      return (lines[0]?.trim().startsWith('#') && lines.shift(), lines.join('\n').trim());
    }),
    sections = [];
  return (
    fileList && sections.push(`Available files: ${fileList}`),
    nonEmptyEntries.length &&
      sections.push(
        nonEmptyEntries
          .map((entry) =>
            [`FILE: ${entry.filename}`, 'CONTENT:', entry.content?.trim() || '(empty)'].join('\n'),
          )
          .join('\n\n---\n\n'),
      ),
    sections.join('\n\n')
  );
}
function normalizeMemoryEntry(entry) {
  if (!entry || 'object' != typeof entry) return null;
  const filename = String(entry.filename ?? '').trim(),
    content = String(entry.content ?? '').trim();
  return filename && content ? { filename: filename, content: content } : null;
}
async function markSnapshotSynced(snapshot) {
  await window.electronAPI?.invoke?.(
    'mark-chat-personal-memory-synced',
    snapshot.id,
    snapshot.scope ?? {},
  );
}
function enqueueSnapshotMemorySync(snapshot, label = 'Updating memory...') {
  if (!snapshot) return Promise.resolve(!1);
  const signature = (function (snapshot = {}) {
    const lastMessage = snapshot.messages?.[snapshot.messages.length - 1];
    return [
      snapshot.id,
      snapshot.updatedAt,
      snapshot.messages?.length ?? 0,
      normalizeForSignature(lastMessage?.content ?? ''),
    ].join('::');
  })(snapshot);
  return (
    _queuedSignatures.has(signature) ||
      (_queuedSignatures.add(signature),
      (_memorySyncChain = _memorySyncChain
        .catch(() => {})
        .then(async () => {
          const hideIndicator = (function (label = 'Updating memory...') {
            const existing = document.getElementById('memory-learn-indicator');
            if (existing)
              return (
                existing
                  .querySelector('[data-memory-label]')
                  ?.replaceChildren(document.createTextNode(label)),
                () => {}
              );
            const el = document.createElement('div');
            if (
              ((el.id = 'memory-learn-indicator'),
              (el.innerHTML = `\n    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"\n         style="width:12px;height:12px;animation:spin 1.2s linear infinite;flex-shrink:0">\n      <path d="M21 12a9 9 0 11-6.219-8.56" stroke-linecap="round"/>\n    </svg>\n    <span data-memory-label>${label}</span>\n  `),
              (el.style.cssText =
                '\n    position:fixed; top:48px; left:calc(var(--sidebar-w, 52px) + 14px); transform:none;\n    display:flex; align-items:center; gap:6px;\n    background:var(--bg-tertiary); border:1px solid var(--border-subtle);\n    border-radius:999px; padding:4px 12px;\n    font-size:11px; font-family:var(--font-ui); color:var(--text-muted);\n    z-index:50; animation:fadeIn 0.2s ease both;\n    pointer-events:none;\n  '),
              !document.getElementById('mem-spin-style'))
            ) {
              const style = document.createElement('style');
              ((style.id = 'mem-spin-style'),
                (style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}'),
                document.head.appendChild(style));
            }
            return (
              document.body.appendChild(el),
              () => {
                ((el.style.transition = 'opacity 0.3s ease'),
                  (el.style.opacity = '0'),
                  setTimeout(() => el.remove(), 300));
              }
            );
          })(label);
          try {
            return await (async function (snapshot) {
              await (async function (snapshot) {
                const payload = { ...snapshot };
                (delete payload.scope,
                  delete payload.reason,
                  await window.electronAPI?.invoke?.('save-chat', payload, snapshot.scope ?? {}));
              })(snapshot);
              const { provider: provider, modelId: modelId } = (function (snapshot = {}) {
                const preferredProviderId = String(snapshot.provider ?? '').trim(),
                  preferredModelId = String(snapshot.model ?? '').trim();
                if (preferredProviderId && preferredModelId) {
                  const provider = state.providers.find(
                    (candidate) =>
                      candidate.provider === preferredProviderId &&
                      candidate.models?.[preferredModelId],
                  );
                  if (provider) return { provider: provider, modelId: preferredModelId };
                }
                return state.selectedProvider && state.selectedModel
                  ? { provider: state.selectedProvider, modelId: state.selectedModel }
                  : { provider: null, modelId: null };
              })(snapshot);
              if (!provider || !modelId) return !1;
              const catalog =
                  (await window.electronAPI?.invoke?.('get-personal-memory-catalog')) ?? [],
                transcript = (function (messages = []) {
                  return messages
                    .map((message) => {
                      const role = 'assistant' === message.role ? 'Assistant' : 'User',
                        attachments = Array.isArray(message.attachments)
                          ? message.attachments
                              .map((attachment) => attachment?.name ?? attachment?.type ?? '')
                              .filter(Boolean)
                          : [],
                        attachmentLine = attachments.length
                          ? `\nAttachments: ${attachments.join(', ')}`
                          : '';
                      return `${role}: ${String(message.content ?? '').trim() || '(no text)'}${attachmentLine}`;
                    })
                    .join('\n\n');
                })(snapshot.messages);
              if (!transcript.trim()) return (await markSnapshotSynced(snapshot), !0);
              const prompt = [
                  'You maintain a persistent personal-memory library for one user.',
                  'Use the completed conversation to decide which personal memory markdown files should change.',
                  '',
                  'Rules:',
                  '- These files are ONLY for personal information.',
                  '- Never store repo names, code, bug reports, workspace details, project tasks, file paths, stack traces, or other work/project context.',
                  '- Keep only durable personal facts: likes, dislikes, family, friends, relationships, education, career aspirations, values, wellbeing, support preferences, habits, important dates, and communication preferences.',
                  '- Do not store one-off troubleshooting requests, temporary work context, or random passing thoughts.',
                  '- Do not repeat facts that already exist anywhere in the memory library.',
                  '- Prefer updating existing files. Create a new .md file only when the current files are clearly not enough.',
                  '- When you update a file, return the FULL final markdown for that file.',
                  '- Preserve useful existing content and merge new facts cleanly.',
                  '- If nothing should change, return exactly {"updates":[],"newFiles":[]}.',
                  '',
                  'Return ONLY valid JSON with this shape:',
                  '{"updates":[{"filename":"Likes.md","content":"# Likes\\n- ..."}],"newFiles":[{"filename":"Custom.md","content":"# Custom\\n- ..."}]}',
                  '',
                  'Existing personal memory files:',
                  buildMemoryCatalogBlock(catalog),
                  '',
                  'Completed conversation transcript:',
                  transcript,
                ].join('\n'),
                result = await fetchWithTools(
                  provider,
                  modelId,
                  [{ role: 'user', content: prompt, attachments: [] }],
                  'You update a personal memory library. Return only valid JSON.',
                  [],
                );
              if ('text' !== result.type) throw new Error('Memory sync did not return text.');
              const jsonText = (function (text = '') {
                const start = text.indexOf('{'),
                  end = text.lastIndexOf('}');
                return -1 === start || -1 === end || end <= start
                  ? null
                  : text.slice(start, end + 1);
              })(result.text ?? '');
              if (!jsonText) throw new Error('Memory sync did not return valid JSON.');
              const payload = (function (payload = {}) {
                return {
                  updates: (Array.isArray(payload.updates) ? payload.updates : [])
                    .map(normalizeMemoryEntry)
                    .filter(Boolean),
                  newFiles: (Array.isArray(payload.newFiles) ? payload.newFiles : [])
                    .map(normalizeMemoryEntry)
                    .filter(Boolean),
                };
              })(JSON.parse(jsonText));
              if (payload.updates.length || payload.newFiles.length) {
                const response = await window.electronAPI?.invoke?.(
                  'apply-personal-memory-updates',
                  payload,
                );
                if (!1 === response?.ok)
                  throw new Error(response.error ?? 'Could not apply personal memory updates.');
              }
              return (await markSnapshotSynced(snapshot), !0);
            })(snapshot);
          } finally {
            hideIndicator();
          }
        })
        .catch((error) => {
          if ((_queuedSignatures.delete(signature), 'AbortError' === error?.name)) throw error;
          return (
            console.warn(
              '[Chat] Personal memory sync failed (non-fatal):',
              error?.message ?? error,
            ),
            !1
          );
        }))),
    _memorySyncChain
  );
}
export function queueCurrentSessionMemorySync(reason = 'session-end') {
  const snapshot = (function (reason = 'session-end') {
    const payload = buildChatPayload({
      chatId: state.currentChatId,
      messages: state.messages,
      provider: state.selectedProvider,
      model: state.selectedModel,
      activeProject: state.activeProject,
      workspacePath: state.workspacePath,
      conversationSummary: state.conversationSummary,
      conversationSummaryMessageCount: state.conversationSummaryMessageCount,
    });
    return payload && hasMeaningfulConversation(payload.messages)
      ? { ...payload, reason: reason, scope: buildSnapshotScope(payload.projectId) }
      : null;
  })(reason);
  return enqueueSnapshotMemorySync(snapshot, 'Updating memory...');
}
export async function flushPendingPersonalMemorySyncs(limit = 10) {
  if (!state.providers.length || (!state.selectedProvider && !state.selectedModel)) return;
  const pendingChats =
    (await window.electronAPI?.invoke?.('get-pending-personal-memory-chats', { limit: limit })) ??
    [];
  for (const chat of pendingChats) {
    if (!chat?.id || !hasMeaningfulConversation(chat.messages)) continue;
    const snapshot = {
      ...chat,
      reason: 'pending-chat',
      scope: buildSnapshotScope(chat.projectId ?? null),
    };
    await enqueueSnapshotMemorySync(snapshot, 'Catching up memory...');
  }
}
