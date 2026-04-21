import { state } from '../../../../System/State.js';
import { sanitizeMessagesForUI } from '../UI/ChatBubble.js';
export function generateChatId() {
  const now = new Date(),
    p = (v) => String(v).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}_${p(now.getHours())}-${p(now.getMinutes())}-${p(now.getSeconds())}`;
}
export function currentChatScope() {
  return state.activeProject ? { projectId: state.activeProject.id } : {};
}
function deriveChatTitle(messages = []) {
  const first = messages.find((message) => 'user' === message.role),
    hasFileAttachment = first?.attachments?.some((attachment) => 'file' === attachment?.type),
    hasImageAttachment = first?.attachments?.some((attachment) => 'image' === attachment?.type);
  return (
    first?.content?.trim().slice(0, 70) ||
    (hasFileAttachment ? 'File attachment' : hasImageAttachment ? 'Image attachment' : 'Untitled')
  );
}
export function buildChatPayload({
  chatId: chatId,
  messages: messages,
  provider: provider = null,
  model: model = null,
  activeProject: activeProject = null,
  workspacePath: workspacePath = null,
  conversationSummary: conversationSummary = '',
  conversationSummaryMessageCount: conversationSummaryMessageCount = 0,
  updatedAt: updatedAt = new Date().toISOString(),
} = {}) {
  if (!chatId || !messages?.length) return null;
  const sanitizedMessages = sanitizeMessagesForUI(messages);
  return sanitizedMessages.length
    ? {
        id: chatId,
        title: deriveChatTitle(sanitizedMessages),
        updatedAt: updatedAt,
        provider: provider?.provider ?? provider ?? null,
        model: model ?? null,
        projectId: activeProject?.id ?? null,
        projectName: activeProject?.name ?? null,
        workspacePath: workspacePath ?? null,
        projectContext: activeProject?.context ?? '',
        conversationSummary: String(conversationSummary ?? '').trim(),
        conversationSummaryMessageCount: Math.max(0, Number(conversationSummaryMessageCount) || 0),
        messages: sanitizedMessages,
      }
    : void 0;
}
export async function saveCurrentChat() {
  if (state.isIncognito) return null;
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
  if (!payload) return null;
  try {
    return (await window.electronAPI?.invoke?.('save-chat', payload, currentChatScope()), payload);
  } catch (err) {
    console.warn('[Chat] Could not save chat:', err);
  }
  return null;
}
export async function trackUsage(usage, chatId, provider = null, modelId = null) {
  if (!usage || (!usage.inputTokens && !usage.outputTokens)) return;
  const p = provider ?? state.selectedProvider,
    m = modelId ?? state.selectedModel;
  if (p && m)
    try {
      const modelInfo = p.models?.[m];
      await window.electronAPI?.invoke?.('track-usage', {
        provider: p.provider,
        model: m,
        modelName: modelInfo?.name ?? m,
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
        chatId: chatId ?? state.currentChatId ?? null,
      });
    } catch (err) {
      console.warn('[Chat] Could not track usage:', err);
    }
}
