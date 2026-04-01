/* ══════════════════════════════════════════
   CHAT PERSISTENCE
   Save, load, and start new chats.
   Helpers: chat ID, chat scope, message
   sanitisation for storage.
══════════════════════════════════════════ */
import { state } from '../../../../System/State.js';
import { sanitizeMessagesForUI } from '../UI/ChatBubble.js';

export function generateChatId() {
  const now = new Date();
  const p = v => String(v).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}_${p(now.getHours())}-${p(now.getMinutes())}-${p(now.getSeconds())}`;
}

export function currentChatScope() {
  return state.activeProject ? { projectId: state.activeProject.id } : {};
}

export async function saveCurrentChat() {
  if (!state.currentChatId || !state.messages.length) return;
  const sanitizedMessages = sanitizeMessagesForUI(state.messages);
  if (!sanitizedMessages.length) return;
  const first = sanitizedMessages.find(m => m.role === 'user');
  const hasFileAttachment = first?.attachments?.some(a => a?.type === 'file');
  const hasImageAttachment = first?.attachments?.some(a => a?.type === 'image');
  const title = first?.content?.trim().slice(0, 70) ||
    (hasFileAttachment ? 'File attachment' : hasImageAttachment ? 'Image attachment' : 'Untitled');
  try {
    await window.electronAPI?.saveChat({
      id: state.currentChatId,
      title,
      updatedAt: new Date().toISOString(),
      provider: state.selectedProvider?.provider ?? null,
      model: state.selectedModel ?? null,
      projectId: state.activeProject?.id ?? null,
      projectName: state.activeProject?.name ?? null,
      workspacePath: state.workspacePath ?? null,
      projectContext: state.activeProject?.context ?? '',
      messages: sanitizedMessages,
    }, currentChatScope());
  } catch (err) { console.warn('[Chat] Could not save chat:', err); }
}

export async function trackUsage(usage, chatId, provider = null, modelId = null) {
  if (!usage || (!usage.inputTokens && !usage.outputTokens)) return;
  const p = provider ?? state.selectedProvider;
  const m = modelId ?? state.selectedModel;
  if (!p || !m) return;
  try {
    const modelInfo = p.models?.[m];
    await window.electronAPI?.trackUsage?.({
      provider: p.provider,
      model: m,
      modelName: modelInfo?.name ?? m,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      chatId: chatId ?? state.currentChatId ?? null,
    });
  } catch (err) { console.warn('[Chat] Could not track usage:', err); }
}
