import { state } from '../../../../System/State.js';
import { fetchWithTools } from '../../../../Features/AI/index.js';
import { getPromptConfigs } from '../../../../System/Prompting/PromptConfig.js';
import { buildChatPayload, currentChatScope } from '../Data/ChatPersistence.js';
let summaryChain = Promise.resolve();
const queuedSignatures = new Set();
// Abort controller for the active compaction LLM call
let _activeCompactionAbort = null;
function getSummaryTargetCount(messages = []) {
  // Trigger compaction at 20 messages (10 full exchanges).
  // Keeps the last 8 live, compacts everything before that.
  // 20 gives 12 messages: enough to capture the goal,
  // constraints, and early decisions in a meaningful way.
  return (messages?.length ?? 0) < 20 ? 0 : Math.max(0, messages.length - 8);
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
  return text ? (text.length > 500 ? `${text.slice(0, 500)}...` : text) : '';
}
function fillTemplate(template = '', values = {}) {
  return String(template ?? '').replace(/\{(\w+)\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key] ?? '') : '',
  );
}
function buildCompactionTranscript(messages = [], cp = {}) {
  const transcriptConfig = cp.transcript ?? {},
    lines = [];
  let totalChars = 0;
  for (const message of messages) {
    const attachments = Array.isArray(message?.attachments)
        ? message.attachments
            .map((attachment) => attachment?.name ?? attachment?.type ?? '')
            .filter(Boolean)
            .join(', ')
        : '',
      role =
        'assistant' === message?.role
          ? transcriptConfig.assistantLabel
          : transcriptConfig.userLabel,
      content =
        trimLineForSummary(message?.content ?? '') || transcriptConfig.emptyContentPlaceholder,
      line = attachments
        ? fillTemplate(transcriptConfig.lineWithAttachmentsTemplate, {
            role,
            content,
            attachments,
          })
        : fillTemplate(transcriptConfig.lineWithoutAttachmentsTemplate, { role, content });
    if (totalChars + line.length > 14e3 && lines.length > 0) {
      transcriptConfig.omittedChunkLabel && lines.push(transcriptConfig.omittedChunkLabel);
      break;
    }
    (lines.push(line), (totalChars += line.length));
  }
  return lines.join('\n');
}
function buildCompactionPrompt(snapshot, transcript, cp = {}) {
  return [
    cp.intro,
    '',
    cp.rulesLabel,
    ...(cp.rules ?? []).map((rule) => `- ${rule}`),
    '',
    cp.structureLabel,
    ...(cp.structure ?? []),
    '',
    cp.previousSummaryLabel,
    normalizeSummaryText(snapshot.conversationSummary) || cp.emptySummaryPlaceholder,
    '',
    cp.newTurnsLabel,
    transcript,
  ]
    .filter(Boolean)
    .join('\n');
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
              const cp = (await getPromptConfigs()).compaction ?? {},
                transcript = buildCompactionTranscript(incomingMessages, cp);
              if (!transcript.trim()) return !1;
              const prompt = buildCompactionPrompt(snapshot, transcript, cp);

              // Event-loop yield — lets channel events dispatch before LLM call
              await new Promise((r) => setTimeout(r, 0));

              // Abort any previous in-flight compaction
              _activeCompactionAbort?.abort();
              _activeCompactionAbort = new AbortController();
              const compactionSignal = _activeCompactionAbort.signal;

              const result = await fetchWithTools(
                provider,
                modelId,
                [{ role: 'user', content: prompt, attachments: [] }],
                cp.systemPrompt,
                [],
                compactionSignal,
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
