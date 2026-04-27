import { agentLoop, planRequest, selectSkillsForMessages } from '../../Chat/Features/Core/Agent.js';
import { trackUsage } from '../../Chat/Features/Data/ChatPersistence.js';
import { state } from '../../../System/State.js';

const api = window.electronAPI;

let _initialised = false;

// Strip thinking blocks emitted by extended-thinking models.
// Covers all common tag variants across model families:
//   <think>        — DeepSeek R1, Qwen QwQ
//   <thinking>     — Claude extended thinking, Grok
//   <reasoning>    — various open-source models
//   <reflection>   — various fine-tunes
// The \1 backreference ensures the closing tag always matches the opening one.
function stripThinking(text) {
  return String(text ?? '')
    .replace(/<(think|thinking|reasoning|reflection)>[\s\S]*?<\/\1>/gi, '')
    .trim();
}

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

function toIso(value, fallback = Date.now()) {
  const date = value ? new Date(value) : new Date(fallback);
  return Number.isNaN(date.getTime()) ? new Date(fallback).toISOString() : date.toISOString();
}

// Resolves the provider/model channels should use.
// Priority:
//   1. Workspace default (preferences.default_provider / default_model)
//   2. Current UI selection (state.selectedProvider / state.selectedModel)
//   3. First available configured provider+model
// Returns { provider, model } or null if nothing is configured.
async function resolveChannelProviderModel() {
  // Ensure providers are populated in state — if the chat page hasn't been
  // visited yet they may be empty.
  if (!state.providers?.length) {
    try {
      const all = (await api?.invoke?.('get-models')) ?? [];
      state.allProviders = all;
      state.providers = all.filter((p) => p.configured);
    } catch {
      /* non-fatal — fall through */
    }
  }

  // 1. Workspace default from user preferences
  try {
    const user = (await api?.invoke?.('get-user')) ?? null;
    const defaultProviderId = user?.preferences?.default_provider ?? null;
    const defaultModelId = user?.preferences?.default_model ?? null;

    if (defaultProviderId && defaultModelId) {
      const provider = (state.providers ?? []).find((p) => p.provider === defaultProviderId);
      if (provider && provider.models?.[defaultModelId]) {
        return { provider, model: defaultModelId };
      }
    }
  } catch {
    /* non-fatal — fall through */
  }

  // 2. Current UI selection
  if (state.selectedProvider && state.selectedModel) {
    return { provider: state.selectedProvider, model: state.selectedModel };
  }

  // 3. First available
  const fallbackProvider = (state.providers ?? [])[0] ?? null;
  const fallbackModel = fallbackProvider
    ? (Object.keys(fallbackProvider.models ?? {})[0] ?? null)
    : null;
  if (fallbackProvider && fallbackModel) {
    return { provider: fallbackProvider, model: fallbackModel };
  }

  return null;
}

async function persistChannelMessage({
  channelName,
  from,
  incoming,
  reply,
  status = 'success',
  error = null,
  metadata = {},
  provider = null,
  model = null,
}) {
  try {
    const repliedAt = new Date().toISOString();
    await api?.invoke?.('save-channel-message', {
      channel: channelName,
      from: from || 'User',
      incoming: incoming || '',
      reply: reply || '',
      status: status,
      error: error,
      provider: provider,
      model: model,
      receivedAt: toIso(metadata?.receivedAt),
      repliedAt: repliedAt,
      timestamp: repliedAt,
      externalId: metadata?.externalId ?? null,
      targetId: metadata?.targetId ?? null,
      conversationId: metadata?.conversationId ?? null,
    });
  } catch (persistError) {
    console.warn('[ChannelGateway] message persistence failed:', persistError?.message);
  }
}

export function initChannelGateway() {
  if (_initialised) return;
  _initialised = true;

  api?.on?.('channel-incoming', ({ id, channelName, from, text, metadata }) => {
    // Enqueue — guarantees serial processing, prevents AI provider saturation
    _channelChain = _channelChain
      .catch(() => {})
      .then(() => _processChannelMessage(id, channelName, from, text, metadata));
  });
}

async function _processChannelMessage(id, channelName, from, text, metadata = {}) {
  // Per-message abort controller — 1800-second hard cap
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 1_800_000); // 30mins

  try {
    // Ensure persona / system prompt is loaded (same pattern as Agents Gateway)
    if (!state.systemPrompt) {
      state.systemPrompt = (await api?.invoke?.('get-system-prompt')) ?? '';
    }

    // Resolve provider/model using workspace default, not just the current UI selection.
    const resolved = await resolveChannelProviderModel();
    if (!resolved) {
      const reply = 'No AI provider is configured yet. Open Settings → AI Providers to add one.';
      await persistChannelMessage({
        channelName,
        from,
        incoming: text,
        reply: reply,
        status: 'error',
        error: 'No AI provider is configured yet.',
        metadata,
      });
      await api.invoke('channel-reply', id, reply);
      return;
    }

    const { provider: channelProvider, model: channelModel } = resolved;

    const messages = [{ role: 'user', content: text, attachments: [] }];

    // No default workspace — but absolute paths in messages still work with tools
    const runtimeOptions = {
      workspacePath: null,
      activeProject: null,
      conversationSummary: '',
      conversationSummaryMessageCount: 0,
      // Pin provider/model so channels always use the workspace default,
      // regardless of what the user has selected in the chat UI.
      selectedProvider: channelProvider,
      selectedModel: channelModel,
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

    await trackUsage(usage, `channel:${channelName}`, usedProvider, usedModel).catch((error) => {
      console.warn('[ChannelGateway] trackUsage failed:', error?.message);
    });

    // Strip any thinking blocks before sending — no user on any channel should see those
    const finalReply = stripThinking(reply ?? '(no response)');
    await persistChannelMessage({
      channelName,
      from,
      incoming: text,
      reply: finalReply,
      status: 'success',
      metadata,
      provider: usedProvider,
      model: usedModel,
    });
    await api.invoke('channel-reply', id, finalReply);
  } catch (err) {
    console.error('[ChannelGateway] processing error:', err);
    const msg =
      err?.name === 'AbortError'
        ? 'Sorry, the response took too long. Please try again.'
        : `Sorry, something went wrong: ${err.message}`;
    await persistChannelMessage({
      channelName,
      from,
      incoming: text,
      reply: msg,
      status: 'error',
      error: err?.message ?? 'Unknown error',
      metadata,
    });
    try {
      await api.invoke('channel-reply', id, msg);
    } catch {
      /* best-effort */
    }
  } finally {
    clearTimeout(timer);
  }
}
