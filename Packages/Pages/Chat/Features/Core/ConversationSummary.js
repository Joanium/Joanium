import { state } from '../../../../System/State.js';
import { fetchWithTools } from '../../../../Features/AI/index.js';
import { buildChatPayload, currentChatScope } from '../Data/ChatPersistence.js';
let summaryChain = Promise.resolve();
const queuedSignatures = new Set();
function getSummaryTargetCount(messages = []) {
  return (messages?.length ?? 0) < 14 ? 0 : Math.max(0, messages.length - 8);
}
function normalizeSummaryText(text = '') {
  return String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 6e3);
}
function trimLineForSummary(value = '') {
  const text = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? (text.length > 500 ? `${text.slice(0, 500)}...` : text) : '(empty)';
}
export function resetConversationSummary() {
  ((state.conversationSummary = ''), (state.conversationSummaryMessageCount = 0));
}
export function syncConversationSummaryWithMessages(messages = state.messages) {
  const targetCount = getSummaryTargetCount(messages),
    currentCount = (function (value, messageCount) {
      const numeric = Math.max(0, Number(value) || 0);
      return Math.min(numeric, Math.max(0, messageCount));
    })(state.conversationSummaryMessageCount, messages.length);
  !targetCount || currentCount > targetCount
    ? resetConversationSummary()
    : ((state.conversationSummaryMessageCount = currentCount),
      currentCount || (state.conversationSummary = ''));
}
export function queueConversationCompaction() {
  const snapshot = (function () {
    syncConversationSummaryWithMessages();
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
    const targetCount = getSummaryTargetCount(payload.messages);
    return !targetCount || targetCount <= payload.conversationSummaryMessageCount
      ? null
      : { ...payload, targetCount: targetCount, scope: currentChatScope() };
  })();
  if (!snapshot) return Promise.resolve(!1);
  const signature = [
    snapshot.id,
    snapshot.messages.length,
    snapshot.conversationSummaryMessageCount,
    snapshot.targetCount,
  ].join(':');
  return (
    queuedSignatures.has(signature) ||
      (queuedSignatures.add(signature),
      (summaryChain = summaryChain
        .catch(() => {})
        .then(async () => {
          try {
            return await (async function (snapshot) {
              if (!snapshot?.id || state.isTyping) return !1;
              const { provider: provider, modelId: modelId } =
                state.selectedProvider && state.selectedModel
                  ? { provider: state.selectedProvider, modelId: state.selectedModel }
                  : { provider: null, modelId: null };
              if (!provider || !modelId) return !1;
              const incomingMessages = snapshot.messages.slice(
                snapshot.conversationSummaryMessageCount,
                snapshot.targetCount,
              );
              if (!incomingMessages.length) return !1;
              const transcript = (function (messages = []) {
                const lines = [];
                let totalChars = 0;
                for (const message of messages) {
                  const attachments = Array.isArray(message?.attachments)
                      ? message.attachments
                          .map((attachment) => attachment?.name ?? attachment?.type ?? '')
                          .filter(Boolean)
                          .join(', ')
                      : '',
                    prefix = 'assistant' === message?.role ? 'Assistant' : 'User',
                    content = trimLineForSummary(message?.content ?? ''),
                    line = attachments
                      ? `${prefix}: ${content} [Attachments: ${attachments}]`
                      : `${prefix}: ${content}`;
                  if (totalChars + line.length > 14e3 && lines.length > 0) {
                    lines.push('...(older turns omitted from this update chunk)');
                    break;
                  }
                  (lines.push(line), (totalChars += line.length));
                }
                return lines.join('\n');
              })(incomingMessages);
              if (!transcript.trim()) return !1;
              const prompt = [
                  'You maintain a compact hidden conversation summary for an AI assistant.',
                  'Merge the previous summary with the newly provided older chat turns.',
                  '',
                  'Rules:',
                  '- Preserve the user goal, constraints, preferences, project/workspace context, file paths, technical findings, decisions, and unresolved threads.',
                  '- Keep concrete facts that matter for future turns.',
                  '- Do not include tool chatter, UI logs, or internal execution details.',
                  '- Prefer crisp markdown bullet points and short sections.',
                  '- Return ONLY the updated summary in markdown.',
                  '- Keep it dense and high-signal.',
                  '',
                  'Recommended structure:',
                  '## Goal',
                  '- ...',
                  '## Constraints',
                  '- ...',
                  '## Decisions',
                  '- ...',
                  '## Open Threads',
                  '- ...',
                  '',
                  'Previous summary:',
                  normalizeSummaryText(snapshot.conversationSummary) || '(none)',
                  '',
                  'New older chat turns to merge:',
                  transcript,
                ].join('\n'),
                result = await fetchWithTools(
                  provider,
                  modelId,
                  [{ role: 'user', content: prompt, attachments: [] }],
                  'You compress chat history into a compact, high-retention markdown summary.',
                  [],
                );
              if ('text' !== result.type)
                throw new Error('Conversation compaction did not return text.');
              const nextSummary = normalizeSummaryText(result.text);
              return (
                !!nextSummary &&
                (state.currentChatId === snapshot.id &&
                  ((state.conversationSummary = nextSummary),
                  (state.conversationSummaryMessageCount = snapshot.targetCount)),
                await (async function (snapshot) {
                  const payload = { ...snapshot };
                  (delete payload.scope,
                    delete payload.targetCount,
                    await window.electronAPI?.invoke?.('save-chat', payload, snapshot.scope ?? {}));
                })({
                  ...snapshot,
                  conversationSummary: nextSummary,
                  conversationSummaryMessageCount: snapshot.targetCount,
                }),
                !0)
              );
            })(snapshot);
          } finally {
            queuedSignatures.delete(signature);
          }
        })
        .catch(
          (error) => (
            queuedSignatures.delete(signature),
            console.warn(
              '[Chat] Conversation compaction failed (non-fatal):',
              error?.message ?? error,
            ),
            !1
          ),
        ))),
    summaryChain
  );
}
