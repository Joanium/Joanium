import { agentLoop, planRequest } from '../../Chat/Features/Core/Agent.js';
import { trackUsage } from '../../Chat/Features/Data/ChatPersistence.js';
import { state } from '../../../System/State.js';
const api = window.electronAPI;
let initialised = !1;
export function initScheduledAgentGateway() {
  initialised ||
    ((initialised = !0),
    api?.on?.(
      'scheduled-agent-run',
      async ({ requestId: requestId, agent: agent, triggerKind: triggerKind }) => {
        try {
          state.systemPrompt ||
            (state.systemPrompt = (await api?.invoke?.('get-system-prompt')) ?? '');
          const modelSelection = await (async function (agent) {
              const providers = ((await api?.invoke?.('get-models')) ?? []).filter(
                  (provider) => provider.configured,
                ),
                selectedProvider = providers.find(
                  (provider) => provider.provider === agent?.primaryModel?.provider,
                );
              if (!selectedProvider)
                throw new Error('The selected primary model provider is not configured.');
              if (!selectedProvider.models?.[agent?.primaryModel?.modelId])
                throw new Error('The selected primary model is no longer available.');
              return {
                selectedProvider: selectedProvider,
                selectedModel: agent.primaryModel.modelId,
                providers: providers,
                allowImplicitFailover: !1,
              };
            })(agent),
            runtimeContext = {
              workspacePath: agent.workspacePath ?? agent.project?.rootPath ?? null,
              activeProject: agent.project ?? null,
            },
            messages = [{ role: 'user', content: agent.prompt ?? '', attachments: [] }],
            plan = await planRequest(messages, { ...modelSelection, ...runtimeContext }),
            {
              text: text,
              usage: usage,
              usedProvider: usedProvider,
              usedModel: usedModel,
            } = await agentLoop(
              messages,
              {
                push: () => ({ done: () => {} }),
                set: () => {},
                finalize: () => {},
                streamThinking: () => {},
                showPhotoGallery: () => {},
                showToolOutput: () => {},
                getAttachments: () => [],
                setAborted: () => {},
                getToolExecutionHooks: () => null,
              },
              plan.skills,
              plan.toolCalls,
              (function (agent) {
                return [
                  state.systemPrompt?.trim() || '',
                  `You are ${agent.name}, an autonomous scheduled AI agent.`,
                  agent.description ? `Description: ${agent.description}` : '',
                  'The user message contains your standing task for this run.',
                  agent.workspacePath
                    ? `Default workspace for this run: ${agent.workspacePath}`
                    : 'No default workspace is bound for this run. Do not assume access to the currently open folder or project.',
                  'You can use all available chat tools, connectors, MCP tools, and browser tools. Workspace-specific tools are only available when this agent has a bound workspace.',
                  'Take action directly when the task calls for it.',
                  'Finish with a concise plain-language summary of what you did, what changed, and any blockers.',
                ]
                  .filter(Boolean)
                  .join('\n\n');
              })(agent),
              null,
              { ...modelSelection, ...runtimeContext },
            );
          (await trackUsage(usage, `scheduled-agent:${agent.id}`, usedProvider, usedModel),
            await api?.invoke?.('complete-agent-run', {
              requestId: requestId,
              ok: !0,
              text: text,
              usage: usage,
              usedProvider: usedProvider?.provider ?? null,
              usedModel: usedModel ?? null,
              triggerKind: triggerKind,
            }));
        } catch (err) {
          console.error('[ScheduledAgentGateway] run failed:', err);
          try {
            await api?.invoke?.('complete-agent-run', {
              requestId: requestId,
              ok: !1,
              error: err.message ?? 'Scheduled agent run failed.',
              triggerKind: triggerKind,
            });
          } catch (replyErr) {
            console.error('[ScheduledAgentGateway] completion reply failed:', replyErr);
          }
        }
      },
    ));
}
