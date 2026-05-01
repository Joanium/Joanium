import { agentLoop, selectSkillsForMessages } from '../../../Pages/Chat/Features/Core/Agent.js';
import { sanitizeAssistantReply } from '../../../Pages/Chat/Features/UI/ChatBubble.js';

const BLOCKED_WORKSPACE_AGENT_TOOLS = new Set([
  'run_shell_command',
  'assess_shell_command',
  'open_folder',
  'start_local_server',
  'read_terminal_output',
  'delete_item',
]);

function createSilentLive() {
  return {
    push() {
      return { done() {} };
    },
    stream() {},
    streamThinking() {},
    finalize() {},
    clearReply() {},
    set() {},
    clear() {},
    getAttachments() {
      return [];
    },
    getToolExecutionHooks() {
      return {};
    },
  };
}

function normalizeModelRef(value = null) {
  const provider = String(value?.provider ?? '').trim(),
    modelId = String(value?.modelId ?? '').trim();
  return provider && modelId ? { provider, modelId } : null;
}

async function loadConfiguredProviders() {
  const allProviders = (await window.electronAPI?.invoke?.('get-models')) ?? [];
  return Array.isArray(allProviders) ? allProviders.filter((provider) => provider?.configured) : [];
}

async function loadSystemPrompt() {
  return String((await window.electronAPI?.invoke?.('get-system-prompt')) ?? '').trim();
}

function resolvePrimaryProvider(providers = [], primaryModel = null) {
  const ref = normalizeModelRef(primaryModel);
  if (!ref) throw new Error('Primary model is not configured.');
  const provider = providers.find((entry) => entry.provider === ref.provider);
  if (!provider) throw new Error(`Provider "${ref.provider}" is not available.`);
  if (!provider.models?.[ref.modelId]) {
    throw new Error(`Model "${ref.modelId}" is not available for provider "${ref.provider}".`);
  }
  return { provider, modelId: ref.modelId };
}

function resolveFallbackModels(providers = [], items = []) {
  return (Array.isArray(items) ? items : [])
    .map(normalizeModelRef)
    .filter(Boolean)
    .map((item) => {
      const provider = providers.find((entry) => entry.provider === item.provider);
      return provider?.models?.[item.modelId]
        ? { provider: item.provider, modelId: item.modelId }
        : null;
    })
    .filter(Boolean);
}

function buildWorkspaceToolFilter(workspacePath = '') {
  return String(workspacePath ?? '').trim()
    ? (tool = {}) => !BLOCKED_WORKSPACE_AGENT_TOOLS.has(String(tool?.name ?? '').trim())
    : null;
}

export async function trackSavedAgentUsage(
  agent,
  usage,
  usedProvider,
  usedModel,
  { chatId = null } = {},
) {
  if (!usage || (!usage.inputTokens && !usage.outputTokens) || !usedProvider || !usedModel) return;
  const modelInfo = usedProvider.models?.[usedModel] ?? {};
  await window.electronAPI?.invoke?.('track-usage', {
    provider: usedProvider.provider,
    model: usedModel,
    modelName: modelInfo.name ?? usedModel,
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
    chatId,
    sourceType: 'agent',
    sourceId: agent?.id ?? null,
    sourceName: agent?.name ?? agent?.id ?? 'Agent',
  });
}

export async function executeSavedAgent(agent, options = {}) {
  const live = options.live ?? createSilentLive(),
    providers = await loadConfiguredProviders(),
    { provider: selectedProvider, modelId: selectedModel } = resolvePrimaryProvider(
      providers,
      agent?.primaryModel,
    ),
    fallbackModels = resolveFallbackModels(providers, agent?.fallbackModels),
    systemPrompt = await loadSystemPrompt(),
    workspacePath = String(agent?.workspace?.workspacePath ?? '').trim() || null,
    plannedSkills = await selectSkillsForMessages([
      { role: 'user', content: agent?.prompt ?? '' },
    ]).catch(() => []),
    activeProject = workspacePath
      ? {
          id: agent?.workspace?.projectId ?? null,
          name: agent?.workspace?.projectName ?? agent?.name ?? 'Workspace',
          rootPath: workspacePath,
          context: '',
        }
      : null,
    toolFilter = [buildWorkspaceToolFilter(workspacePath), options.toolFilter]
      .filter((entry) => 'function' == typeof entry)
      .reduce(
        (combined, predicate) =>
          combined ? (tool) => combined(tool) && predicate(tool) : predicate,
        null,
      ),
    { text, usage, usedProvider, usedModel } = await agentLoop(
      [{ role: 'user', content: String(agent?.prompt ?? '').trim(), attachments: [] }],
      live,
      plannedSkills,
      [],
      systemPrompt,
      options.signal ?? null,
      {
        selectedProvider,
        selectedModel,
        providers,
        fallbackModels,
        allowImplicitFailover: false,
        workspacePath,
        activeProject,
        workspaceFencePath: workspacePath,
        toolFilter: toolFilter || undefined,
        conversationSummary: '',
        conversationSummaryMessageCount: 0,
      },
    );
  return {
    text: sanitizeAssistantReply(text),
    usage,
    usedProvider,
    usedModel,
    workspacePath,
    activeProject,
  };
}
