import { state } from '../../../System/State.js';
import { welcome, chatView, chatMessages } from '../../../Pages/Shared/Core/DOM.js';
import { reset as resetComposer } from './Composer/index.js';
import { agentLoop, selectSkillsForMessages } from './Core/Agent.js';
import {
  onChatMessagesClick,
  appendMessage,
  createLiveRow,
  sanitizeAssistantReply,
  sanitizeMessagesForUI,
} from './UI/ChatBubble.js';
import { updateTimeline, setupScrollFeatures, bumpScrollBadge } from './UI/ChatTimeline.js';
import { queueCurrentSessionMemorySync } from './Core/ChatMemory.js';
import {
  queueConversationCompaction,
  resetConversationSummary,
  syncConversationSummaryWithMessages,
} from './Core/ConversationSummary.js';
import {
  saveCurrentChat,
  trackUsage,
  generateChatId,
  currentChatScope,
} from './Data/ChatPersistence.js';
document.documentElement.classList.add('show-tokens');
let _currentAbortController = null;
export function stopGeneration() {
  _currentAbortController && (_currentAbortController.abort(), (_currentAbortController = null));
}
let _updateSendBtn = () => {};
export function setSendBtnUpdater(fn) {
  _updateSendBtn = fn;
}
async function resolveExecutionPlan(messages = []) {
  const lastUserMsg = [...messages].reverse().find((message) => 'user' === message?.role);
  if (!lastUserMsg) return { plannedSkills: [], plannedToolCalls: [] };
  const heuristicSkills = await selectSkillsForMessages(messages).catch(() => []);
  if (
    !(function (message = {}) {
      const planningText = (function (message = {}) {
        return `${String(message?.content ?? '').trim()} ${
          Array.isArray(message?.attachments)
            ? message.attachments
                .map((attachment) => attachment?.name ?? attachment?.type ?? '')
                .filter(Boolean)
                .join(' ')
            : ''
        }`
          .trim()
          .toLowerCase();
      })(message);
      return (
        !!planningText &&
        ((message.attachments?.length ?? 0) > 0 ||
          planningText.length >= 260 ||
          /\b(file|files|folder|workspace|project|repo|repository|branch|commit|pull request|pr|code|debug|fix|refactor|implement|build|test|lint|terminal|shell|command|browser|website|page|login|navigate|click|book|checkout|calendar|gmail|github|gitlab|drive|docs|sheets|slides|memory|sub-agent|agent)\b/i.test(
            planningText,
          ))
      );
    })(lastUserMsg)
  )
    return { plannedSkills: heuristicSkills, plannedToolCalls: [] };
  const controller = new AbortController(),
    timeoutId = window.setTimeout(() => controller.abort(), 900);
  try {
    const plan = await planRequest(messages, { signal: controller.signal });
    return {
      plannedSkills: plan.skills?.length ? plan.skills : heuristicSkills,
      plannedToolCalls: plan.toolCalls ?? [],
    };
  } catch {
    return { plannedSkills: heuristicSkills, plannedToolCalls: [] };
  } finally {
    window.clearTimeout(timeoutId);
  }
}
function showPlanningTrace(live, plannedSkills = [], plannedToolCalls = []) {
  if (
    (plannedSkills.forEach((skillName) => {
      const handle = live.push(`[SKILL] ${skillName}`);
      handle?.done?.(!0);
    }),
    plannedToolCalls.length > 0)
  ) {
    const handle = live.push('Planning...');
    handle?.done?.(!0);
  }
}
export function initChatUI() {
  (chatMessages &&
    '1' !== chatMessages.dataset.bound &&
    ((chatMessages.dataset.bound = '1'),
    chatMessages.addEventListener('click', onChatMessagesClick)),
    setupScrollFeatures(),
    updateTimeline());
}
async function doSendFromState() {
  if (!state.selectedProvider || !state.selectedModel || state.isTyping) return;
  (syncConversationSummaryWithMessages(), (state.isTyping = !0), _updateSendBtn());
  const live = createLiveRow(doSendFromState);
  live.push('Thinking…');
  let plannedSkills = [],
    plannedToolCalls = [];
  (({ plannedSkills: plannedSkills, plannedToolCalls: plannedToolCalls } =
    await resolveExecutionPlan(state.messages)),
    showPlanningTrace(live, plannedSkills, plannedToolCalls));
  try {
    _currentAbortController = new AbortController();
    const {
        text: finalReply,
        usage: usage,
        usedProvider: usedProvider,
        usedModel: usedModel,
      } = await agentLoop(
        state.messages,
        live,
        plannedSkills,
        plannedToolCalls,
        state.systemPrompt,
        _currentAbortController.signal,
      ).finally(() => {
        _currentAbortController = null;
      }),
      safeReply = sanitizeAssistantReply(finalReply);
    (safeReply !== finalReply && live.set(safeReply),
      await trackUsage(usage, state.currentChatId, usedProvider, usedModel),
      state.messages.push({
        role: 'assistant',
        content: safeReply,
        attachments: live.getAttachments?.() ?? [],
      }),
      saveCurrentChat(),
      queueConversationCompaction().catch(() => {}),
      bumpScrollBadge());
  } catch (err) {
    if (((_currentAbortController = null), 'AbortError' === err.name))
      return void live.setAborted();
    const errMsg = `Something went wrong: ${err.message}`;
    (live.set(errMsg),
      state.messages.push({
        role: 'assistant',
        content: errMsg,
        attachments: live.getAttachments?.() ?? [],
      }),
      console.error('[Chat] doSendFromState error:', err));
  } finally {
    ((state.isTyping = !1), _updateSendBtn(), updateTimeline());
  }
}
export function showChatView() {
  chatView.classList.contains('active') ||
    (welcome.getAnimations().forEach((a) => a.cancel()),
    (welcome.style.display = 'flex'),
    (welcome.animate(
      [
        { opacity: 1, transform: 'translateY(0) scale(1)' },
        { opacity: 0, transform: 'translateY(-16px) scale(0.97)' },
      ],
      { duration: 280, easing: 'cubic-bezier(0.4,0,1,1)', fill: 'forwards' },
    ).onfinish = () => {
      welcome.style.display = 'none';
    }),
    chatView.classList.add('active'));
}
export function restoreWelcome() {
  (welcome.getAnimations().forEach((a) => a.cancel()),
    (welcome.style.display = 'flex'),
    welcome.style.removeProperty('opacity'),
    welcome.style.removeProperty('transform'),
    chatView.classList.remove('active'));
  const greeting = welcome.querySelector('.welcome-greeting');
  greeting &&
    ((greeting.style.animation = 'none'),
    (greeting.style.opacity = '1'),
    (greeting.style.transform = 'none'),
    requestAnimationFrame(() => {
      (greeting.style.removeProperty('animation'),
        greeting.style.removeProperty('opacity'),
        greeting.style.removeProperty('transform'));
    }));
}
export async function sendMessage({ text: text, attachments: attachments, sendBtnEl: sendBtnEl }) {
  if ((!text && 0 === attachments.length) || state.isTyping) return;
  if (
    (syncConversationSummaryWithMessages(),
    state.currentChatId || (state.currentChatId = generateChatId()),
    showChatView(),
    appendMessage('user', text, !0, !0, attachments, doSendFromState),
    resetComposer(),
    sendBtnEl?.animate(
      [
        { transform: 'scale(1)' },
        { transform: 'scale(0.85)' },
        { transform: 'scale(1.15)' },
        { transform: 'scale(1)' },
      ],
      { duration: 350, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
    ),
    !state.selectedProvider || !state.selectedModel)
  )
    return void appendMessage(
      'assistant',
      'No AI provider configured. Add an API key, Ollama, or LM Studio in Settings.',
      !0,
      !0,
      [],
      doSendFromState,
    );
  ((state.isTyping = !0), _updateSendBtn());
  const live = createLiveRow(doSendFromState);
  live.push('Thinking…');
  let plannedSkills = [],
    plannedToolCalls = [];
  (({ plannedSkills: plannedSkills, plannedToolCalls: plannedToolCalls } =
    await resolveExecutionPlan(state.messages)),
    showPlanningTrace(live, plannedSkills, plannedToolCalls));
  try {
    _currentAbortController = new AbortController();
    const {
        text: finalReply,
        usage: usage,
        usedProvider: usedProvider,
        usedModel: usedModel,
      } = await agentLoop(
        state.messages,
        live,
        plannedSkills,
        plannedToolCalls,
        state.systemPrompt,
        _currentAbortController.signal,
      ).finally(() => {
        _currentAbortController = null;
      }),
      safeReply = sanitizeAssistantReply(finalReply);
    (safeReply !== finalReply && live.set(safeReply),
      await trackUsage(usage, state.currentChatId, usedProvider, usedModel),
      state.messages.push({
        role: 'assistant',
        content: safeReply,
        attachments: live.getAttachments?.() ?? [],
      }),
      saveCurrentChat(),
      queueConversationCompaction().catch(() => {}),
      bumpScrollBadge(),
      setTimeout(updateTimeline, 100));
  } catch (err) {
    if (((_currentAbortController = null), 'AbortError' === err.name)) live.setAborted();
    else {
      const msg = `Something went wrong: ${err.message}`;
      (live.set(msg),
        state.messages.push({
          role: 'assistant',
          content: msg,
          attachments: live.getAttachments?.() ?? [],
        }),
        console.error('[Chat] sendMessage error:', err));
    }
  } finally {
    ((state.isTyping = !1), _updateSendBtn());
  }
}
export function startNewChat(extraCleanup = () => {}) {
  (queueCurrentSessionMemorySync('new-chat').catch(() => {}),
    (state.messages = []),
    (state.currentChatId = null),
    (state.isTyping = !1),
    resetConversationSummary(),
    _currentAbortController && (_currentAbortController.abort(), (_currentAbortController = null)),
    document.getElementById('typing-row')?.remove(),
    (chatMessages.innerHTML = ''),
    restoreWelcome(),
    resetComposer());
  const timeline = document.getElementById('chat-timeline');
  timeline && timeline.classList.remove('visible');
  const scrollBtn = document.getElementById('scroll-to-bottom');
  (scrollBtn && scrollBtn.classList.remove('visible'), extraCleanup());
}
export async function loadChat(
  chatId,
  {
    updateModelLabel: updateModelLabel,
    buildModelDropdown: buildModelDropdown,
    notifyModelSelectionChanged: notifyModelSelectionChanged,
  },
) {
  try {
    queueCurrentSessionMemorySync('chat-switch').catch(() => {});
    const chat = await window.electronAPI?.invoke?.('load-chat', chatId, currentChatScope());
    if (!chat) return;
    ((state.messages = []),
      (state.currentChatId = chat.id),
      (state.isTyping = !1),
      (state.conversationSummary = String(chat.conversationSummary ?? '').trim()),
      (state.conversationSummaryMessageCount = Math.max(
        0,
        Number(chat.conversationSummaryMessageCount) || 0,
      )),
      document.getElementById('typing-row')?.remove(),
      (chatMessages.innerHTML = ''),
      resetComposer(),
      showChatView());
    const restored = sanitizeMessagesForUI(chat.messages ?? []);
    if (
      ((state.messages = restored),
      syncConversationSummaryWithMessages(restored),
      queueConversationCompaction().catch(() => {}),
      restored.forEach((m) =>
        appendMessage(m.role, m.content, !1, !1, m.attachments, doSendFromState),
      ),
      chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' }),
      chat.provider && chat.model)
    ) {
      const provider = state.providers.find((p) => p.provider === chat.provider);
      provider &&
        ((state.selectedProvider = provider),
        (state.selectedModel = chat.model),
        updateModelLabel(),
        buildModelDropdown());
    }
    (notifyModelSelectionChanged(), _updateSendBtn(), setTimeout(updateTimeline, 150));
  } catch (err) {
    console.error('[Chat] Load error:', err);
  }
}
export { saveCurrentChat, trackUsage } from './Data/ChatPersistence.js';
export { appendMessage, sanitizeMessagesForUI } from './UI/ChatBubble.js';
export { updateTimeline } from './UI/ChatTimeline.js';
export { prewarmAgentContext } from './Core/Agent.js';
