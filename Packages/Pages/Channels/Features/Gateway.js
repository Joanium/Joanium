import { agentLoop, planRequest, selectSkillsForMessages } from '../../Chat/Features/Core/Agent.js';
import { trackUsage } from '../../Chat/Features/Data/ChatPersistence.js';
import { state } from '../../../System/State.js';

const api = window.electronAPI;

let _initialised = false;

// Serial queue — channel messages processed one at a time, no contention with chat
let _channelChain = Promise.resolve();

// Stub live object — channels have no UI to stream into
const _stubLive = {
  push: () => ({ done: () => {} }),
  set: () => {},
  finalize: () => {},
  stream: () => {},
  clearReply: () => {},
  streamThinking: () => {},
  showPhotoGallery: () => {},
  showToolOutput: () => {},
  getAttachments: () => [],
  setAborted: () => {},
  getToolExecutionHooks: () => null,
};

export function initChannelGateway() {
  if (_initialised) return;
  _initialised = true;

  api?.on?.('channel-incoming', ({ id, channelName, from, text }) => {
    // Enqueue — guarantees serial processing, prevents AI provider saturation
    _channelChain = _channelChain
      .catch(() => {})
      .then(() => _processChannelMessage(id, channelName, from, text));
  });
}

async function _processChannelMessage(id, channelName, from, text) {
  // Per-message abort controller — 1800-second hard cap
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 1_800_000); // 30mins

  try {
    // Ensure persona / system prompt is loaded (same pattern as Agents Gateway)
    if (!state.systemPrompt) {
      state.systemPrompt = (await api?.invoke?.('get-system-prompt')) ?? '';
    }

    if (!state.selectedProvider || !state.selectedModel) {
      await api.invoke(
        'channel-reply',
        id,
        'No AI provider is configured yet. Open Settings → AI Providers to add one.',
      );
      return;
    }

    const messages = [{ role: 'user', content: text, attachments: [] }];

    // No default workspace — but absolute paths in messages still work with tools
    const runtimeOptions = {
      workspacePath: null,
      activeProject: null,
      conversationSummary: '',
      conversationSummaryMessageCount: 0,
    };

    // Step 1: Match skills (same as chat resolveExecutionPlan)
    let plannedSkills = [];
    let plannedToolCalls = [];

    try {
      plannedSkills = await selectSkillsForMessages(messages).catch(() => []);
    } catch {
      /* non-fatal */
    }

    // Step 2: Planning step (same as Agents Gateway — identifies tools + skills)
    try {
      const plan = await planRequest(messages, {
        ...runtimeOptions,
        signal: abort.signal,
      });
      if (plan.skills?.length) plannedSkills = plan.skills;
      plannedToolCalls = plan.toolCalls ?? [];
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      // Non-fatal — fall through with heuristic skills, no planned tool calls
      console.warn('[ChannelGateway] planRequest failed (non-fatal):', err?.message);
    }

    // Step 3: Build channel-aware system prompt with persona
    const channelSystemPrompt = [
      state.systemPrompt?.trim() || '',
      [
        `You are receiving this message from ${from} via ${channelName}.`,
        'You have the same full agentic capabilities as in the main chat — all tools, skills,',
        'workspace tools, browser tools, and MCP integrations are available.',
        'If the user provides a file path or directory, use your tools to work with it directly.',
        'Be concise in your replies since this is a messaging channel, but be thorough when the task requires it.',
      ].join(' '),
    ]
      .filter(Boolean)
      .join('\n\n');

    // Step 4: Full agentLoop — identical to chat, with tools, planning, skill matching
    const {
      text: reply,
      usage,
      usedProvider,
      usedModel,
    } = await agentLoop(
      messages,
      _stubLive,
      plannedSkills,
      plannedToolCalls,
      channelSystemPrompt,
      abort.signal,
      runtimeOptions,
    );

    await trackUsage(usage, `channel:${channelName}`, usedProvider, usedModel);
    await api.invoke('channel-reply', id, reply ?? '(no response)');
  } catch (err) {
    console.error('[ChannelGateway] processing error:', err);
    const msg =
      err?.name === 'AbortError'
        ? 'Sorry, the response took too long. Please try again.'
        : `Sorry, something went wrong: ${err.message}`;
    try {
      await api.invoke('channel-reply', id, msg);
    } catch {
      /* best-effort */
    }
  } finally {
    clearTimeout(timer);
  }
}
