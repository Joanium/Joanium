import { agentLoop, planRequest } from '../../Chat/Features/Core/Agent.js';
import { trackUsage } from '../../Chat/Features/Data/ChatPersistence.js';
import { state } from '../../../System/State.js';

const api = window.electronAPI;

function makeSilentLive() {
  return {
    push: () => ({ done: () => {} }),
    set: () => {},
    finalize: () => {},
    streamThinking: () => {},
    showPhotoGallery: () => {},
    showToolOutput: () => {},
    getAttachments: () => [],
    setAborted: () => {},
    getToolExecutionHooks: () => null,
  };
}

function buildScheduledSystemPrompt(agent) {
  return [
    state.systemPrompt?.trim() || '',
    `You are ${agent.name}, an autonomous scheduled AI agent.`,
    agent.description ? `Description: ${agent.description}` : '',
    'The user message contains your standing task for this run.',
    'You can use all available chat tools, workspace tools, connectors, MCP tools, and browser tools.',
    'Take action directly when the task calls for it.',
    'Finish with a concise plain-language summary of what you did, what changed, and any blockers.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

async function getModelSelection(agent) {
  const providers = ((await api?.invoke?.('get-models')) ?? []).filter(
    (provider) => provider.configured,
  );
  const selectedProvider = providers.find(
    (provider) => provider.provider === agent?.primaryModel?.provider,
  );

  if (!selectedProvider) {
    throw new Error('The selected primary model provider is not configured.');
  }

  if (!selectedProvider.models?.[agent?.primaryModel?.modelId]) {
    throw new Error('The selected primary model is no longer available.');
  }

  return {
    selectedProvider,
    selectedModel: agent.primaryModel.modelId,
    providers,
    fallbackModels: agent.fallbackModels ?? [],
  };
}

let initialised = false;

export function initScheduledAgentGateway() {
  if (initialised) return;
  initialised = true;

  api?.on?.('scheduled-agent-run', async ({ requestId, agent, triggerKind }) => {
    try {
      if (!state.systemPrompt) {
        state.systemPrompt = (await api?.invoke?.('get-system-prompt')) ?? '';
      }

      const modelSelection = await getModelSelection(agent);
      const messages = [{ role: 'user', content: agent.prompt ?? '', attachments: [] }];
      const plan = await planRequest(messages, modelSelection);

      const { text, usage, usedProvider, usedModel } = await agentLoop(
        messages,
        makeSilentLive(),
        plan.skills,
        plan.toolCalls,
        buildScheduledSystemPrompt(agent),
        null,
        modelSelection,
      );

      await trackUsage(usage, `scheduled-agent:${agent.id}`, usedProvider, usedModel);

      await api?.invoke?.('complete-agent-run', {
        requestId,
        ok: true,
        text,
        usage,
        usedProvider: usedProvider?.provider ?? null,
        usedModel: usedModel ?? null,
        triggerKind,
      });
    } catch (err) {
      console.error('[ScheduledAgentGateway] run failed:', err);
      try {
        await api?.invoke?.('complete-agent-run', {
          requestId,
          ok: false,
          error: err.message ?? 'Scheduled agent run failed.',
          triggerKind,
        });
      } catch (replyErr) {
        console.error('[ScheduledAgentGateway] completion reply failed:', replyErr);
      }
    }
  });
}
