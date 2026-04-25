import { state } from '../../../../System/State.js';
import { fetchWithTools, fetchStreamingWithTools } from '../../../../Features/AI/index.js';
import { getPromptConfigs } from '../../../../System/Prompting/PromptConfig.js';
import { fillTemplate } from '../../../../System/Utils.js';
import {
  buildToolsPrompt,
  getAvailableTools,
  filterToolsByUserText,
  REQUEST_TOOL_CATEGORIES_NAME,
  parseRequestedCategories,
  getToolsForCategories,
  buildCategoryLoadResult,
  buildToolCatalog,
} from '../Capabilities/Registry/Tools.js';
const REQUEST_ALL_TOOLS_TOOL_NAME = 'request_all_tools';
function dedupeTools(tools = []) {
  const byName = new Map();
  for (const tool of tools) tool?.name && (byName.has(tool.name) || byName.set(tool.name, tool));
  return [...byName.values()];
}
import { executeTool } from '../Capabilities/Registry/Executors.js';
const INTERNAL_TOOL_LEAK_PATTERNS = [
    /^\s*I\s+(?:used|called|ran|invoked)\s+(?:the\s+)?[A-Za-z0-9_.\-\s/]+\s+tool\b[\s.,;:!?\u2026]*$/i,
    /^\s*Tool result for\b/i,
    /^\s*Internal execution context for the assistant only\b/i,
  ],
  BROWSER_TOOL_HINTS = [
    'browser',
    'playwright',
    'web page',
    'website',
    'navigate',
    'goto',
    'go_to',
    'click',
    'fill',
    'type',
    'select',
    'press',
    'locator',
    'screenshot',
    'snapshot',
    'tab',
  ],
  HIGH_RISK_BROWSER_TERMS = [
    'checkout',
    'payment',
    'pay ',
    'paynow',
    'purchase',
    'buy now',
    'buy_ticket',
    'book now',
    'booking confirmation',
    'confirm booking',
    'reserve now',
    'place order',
    'complete order',
    'submit order',
    'finalize',
  ],
  RATE_LIMIT_BACKOFF_MS = [5e3, 1e4, 15e3],
  PERSONAL_MEMORY_TOOL_NAMES = new Set([
    'list_personal_memory_files',
    'search_personal_memory',
    'read_personal_memory_files',
  ]),
  SEARCH_ENGINE_BLOCK_PATTERNS = [
    // codeql[js/regex/missing-regexp-anchor] - Intentional: patterns scan full page content text, not URLs. Unanchored substring matching is required here.
    /google\.com\/sorry/i, // codeql[js/regex/missing-regexp-anchor]
    /\bunusual traffic\b/i, // codeql[js/regex/missing-regexp-anchor]
    /\brecaptcha\b/i, // codeql[js/regex/missing-regexp-anchor]
    /\bi am not a robot\b/i, // codeql[js/regex/missing-regexp-anchor]
    /\bi'm not a robot\b/i, // codeql[js/regex/missing-regexp-anchor]
  ],
  skillsCache = { value: null, expiresAt: 0, promise: null },
  toolsCache = new Map(),
  workspaceSummaryCache = new Map();

// Maximum number of agentic loop turns before forcing a final answer.
// Raised from 100 to 1000 to support long-running, multi-step agent sessions.
const MAX_AGENT_LOOP_TURNS = 1000;

// Maximum number of times the loop will retry a leaky/internal reply before
// giving up and surfacing the best available answer. Raised from 5 to 100.
const MAX_REWRITE_ATTEMPTS = 100;

function isRateLimitError(err) {
  const message = String(err?.message ?? '').toLowerCase();
  return (
    message.includes('429') ||
    message.includes('rate limit') ||
    message.includes('too many requests')
  );
}
function createAbortError() {
  const err = new Error('Aborted');
  return ((err.name = 'AbortError'), err);
}
async function waitWithAbort(delayMs, signal = null) {
  if (delayMs)
    if (signal) {
      if (signal.aborted) throw createAbortError();
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            (cleanup(), resolve());
          }, delayMs),
          onAbort = () => {
            (cleanup(), reject(createAbortError()));
          },
          cleanup = () => {
            (clearTimeout(timer), signal.removeEventListener('abort', onAbort));
          };
        signal.addEventListener('abort', onAbort, { once: !0 });
      });
    } else await new Promise((resolve) => setTimeout(resolve, delayMs));
}
function getModelDisplayName(provider, modelId) {
  return provider?.models?.[modelId]?.name ?? modelId ?? 'model';
}
function resolveModelSelection(options = {}) {
  return {
    selectedProvider: options.selectedProvider ?? state.selectedProvider,
    selectedModel: options.selectedModel ?? state.selectedModel,
    providers: Array.isArray(options.providers) ? options.providers : state.providers,
    fallbackModels: Array.isArray(options.fallbackModels) ? options.fallbackModels : [],
    allowImplicitFailover: !1 !== options.allowImplicitFailover,
  };
}
function hasOwnOption(options = {}, key) {
  return Object.prototype.hasOwnProperty.call(options, key);
}
function resolveRuntimeContext(options = {}) {
  return {
    workspacePath: hasOwnOption(options, 'workspacePath')
      ? String(options.workspacePath ?? '').trim() || null
      : state.workspacePath,
    activeProject: hasOwnOption(options, 'activeProject')
      ? (options.activeProject ?? null)
      : state.activeProject,
  };
}
export function buildFailoverCandidates(
  selectedProvider,
  selectedModel,
  providers = state.providers,
  fallbackModels = [],
  allowImplicitFailover = !0,
) {
  if (!selectedProvider || !selectedModel) return [];
  const candidates = [];
  if (fallbackModels.length) {
    const seen = new Set();
    for (const fallback of fallbackModels) {
      const provider = providers.find((item) => item.provider === fallback?.provider),
        modelId = fallback?.modelId;
      if (!provider || !modelId) continue;
      const key = `${provider.provider}::${modelId}`;
      seen.has(key) ||
        (seen.add(key),
        candidates.push({
          provider: provider,
          modelId: modelId,
          note: `Falling back to ${provider.label ?? provider.provider} - ${getModelDisplayName(provider, modelId)}...`,
        }));
    }
    return candidates;
  }
  if (!allowImplicitFailover) return candidates;
  const sameProviderModels = Object.entries(selectedProvider.models ?? {})
    .filter(([id]) => id !== selectedModel)
    .sort(([, a], [, b]) => (a.rank ?? 999) - (b.rank ?? 999));
  for (const [modelId, info] of sameProviderModels)
    candidates.push({
      provider: selectedProvider,
      modelId: modelId,
      note: `Trying ${info.name ?? modelId}...`,
    });
  const otherBests = providers
    .filter((provider) => provider.provider !== selectedProvider.provider)
    .map((provider) => {
      const entries = Object.entries(provider.models ?? {}).sort(
        ([, a], [, b]) => (a.rank ?? 999) - (b.rank ?? 999),
      );
      if (!entries.length) return null;
      const [bestId, bestInfo] = entries[0];
      return { provider: provider, modelId: bestId, rank: bestInfo.rank ?? 999 };
    })
    .filter(Boolean)
    .sort((a, b) => a.rank - b.rank);
  for (const { provider: provider, modelId: modelId } of otherBests) {
    const name = provider.models?.[modelId]?.name ?? modelId;
    candidates.push({
      provider: provider,
      modelId: modelId,
      note: `Falling back to ${provider.label ?? provider.provider} - ${name}...`,
    });
  }
  return candidates;
}
async function loadEnabledSkills() {
  const now = Date.now();
  return null !== skillsCache.value && now < skillsCache.expiresAt
    ? skillsCache.value
    : (skillsCache.promise ||
        (skillsCache.promise = (async () => {
          try {
            const res = await window.electronAPI?.invoke?.('get-skills'),
              value = (res?.skills ?? []).filter((skill) => !0 === skill.enabled);
            return ((skillsCache.value = value), (skillsCache.expiresAt = Date.now() + 3e4), value);
          } catch {
            return ((skillsCache.value = []), (skillsCache.expiresAt = Date.now() + 3e4), []);
          } finally {
            skillsCache.promise = null;
          }
        })()),
      skillsCache.promise);
}
async function loadWorkspaceSummary(workspacePath = state.workspacePath) {
  if (!workspacePath) return null;
  const key = String(workspacePath ?? '').trim(),
    now = Date.now(),
    cached = workspaceSummaryCache.get(key);
  if (cached && !cached.promise && now < cached.expiresAt) return cached.value;
  if (cached?.promise) return cached.promise;
  const promise = (async () => {
    try {
      const res = await window.electronAPI?.invoke?.('inspect-workspace', {
          rootPath: workspacePath,
        }),
        value = res?.ok ? res.summary : null;
      // Cap cache at 5 entries — evict oldest when full
      if (workspaceSummaryCache.size >= 5) {
        const [oldKey] = workspaceSummaryCache.keys();
        workspaceSummaryCache.delete(oldKey);
      }
      return (
        workspaceSummaryCache.set(key, {
          value: value,
          expiresAt: Date.now() + 6e4,
          promise: null,
        }),
        value
      );
    } catch {
      return null;
    } finally {
      const latest = workspaceSummaryCache.get(key);
      latest?.promise &&
        workspaceSummaryCache.set(key, {
          value: latest.value ?? null,
          expiresAt: latest.expiresAt ?? 0,
          promise: null,
        });
    }
  })();
  if (workspaceSummaryCache.size >= 5) {
    const [oldKey] = workspaceSummaryCache.keys();
    workspaceSummaryCache.delete(oldKey);
  }
  return (
    workspaceSummaryCache.set(key, {
      value: cached?.value ?? null,
      expiresAt: cached?.expiresAt ?? 0,
      promise: promise,
    }),
    promise
  );
}
async function loadAvailableToolsCached(options = {}) {
  const workspacePath = Object.prototype.hasOwnProperty.call(options, 'workspacePath')
      ? String(options.workspacePath ?? '').trim()
      : String(state.workspacePath ?? '').trim(),
    key = workspacePath || '__global__',
    now = Date.now(),
    cached = toolsCache.get(key);
  if (cached && !cached.promise && now < cached.expiresAt) return cached.value;
  if (cached?.promise) return cached.promise;
  const promise = (async () => {
    try {
      const value = await getAvailableTools({ workspacePath: workspacePath });
      // Cap cache at 10 entries — evict oldest when full
      if (toolsCache.size >= 10) {
        const [oldKey] = toolsCache.keys();
        toolsCache.delete(oldKey);
      }
      return (
        toolsCache.set(key, { value: value, expiresAt: Date.now() + 1e4, promise: null }),
        value
      );
    } catch {
      return [];
    } finally {
      const latest = toolsCache.get(key);
      latest?.promise &&
        toolsCache.set(key, {
          value: latest.value ?? [],
          expiresAt: latest.expiresAt ?? 0,
          promise: null,
        });
    }
  })();
  if (toolsCache.size >= 10) {
    const [oldKey] = toolsCache.keys();
    toolsCache.delete(oldKey);
  }
  return (
    toolsCache.set(key, {
      value: cached?.value ?? [],
      expiresAt: cached?.expiresAt ?? 0,
      promise: promise,
    }),
    promise
  );
}
function tokenizeForSkillMatching(value = '') {
  return (
    String(value ?? '')
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter((token) => token.length >= 4) ?? []
  );
}
function scoreSkillMatch(skill = {}, text = '', tokens = []) {
  if (!text) return 0;
  let score = 0;
  const searchable = (function (skill = {}) {
    return [skill.name, skill.trigger, skill.description].filter(Boolean).join(' ').toLowerCase();
  })(skill);
  if (!searchable) return score;
  const triggerPhrases = String(skill.trigger ?? '')
    .split(',')
    .map((phrase) => phrase.trim().toLowerCase())
    .filter(Boolean);
  for (const phrase of triggerPhrases) phrase.length >= 5 && text.includes(phrase) && (score += 8);
  const name = String(skill.name ?? '')
    .trim()
    .toLowerCase();
  name && text.includes(name) && (score += 6);
  const matchedTokens = new Set();
  for (const token of tokenizeForSkillMatching(searchable))
    matchedTokens.has(token) ||
      (tokens.includes(token) && (matchedTokens.add(token), (score += 1)));
  return score;
}
export async function selectSkillsForMessages(messages = []) {
  const lastUserMessage = [...messages]
      .reverse()
      .find((message) => 'user' === message?.role && String(message?.content ?? '').trim()),
    userText = String(lastUserMessage?.content ?? '')
      .trim()
      .toLowerCase();
  if (!userText) return [];
  const skills = await loadEnabledSkills();
  if (!skills.length) return [];
  const tokens = tokenizeForSkillMatching(userText);
  return skills
    .map((skill) => ({ name: skill.name, score: scoreSkillMatch(skill, userText, tokens) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
    .slice(0, 3)
    .map((entry) => entry.name);
}
export function invalidateAgentRuntimeCaches() {
  ((skillsCache.value = null),
    (skillsCache.expiresAt = 0),
    (skillsCache.promise = null),
    toolsCache.clear(),
    workspaceSummaryCache.clear());
}
export function prewarmAgentContext(options = {}) {
  const { workspacePath: workspacePath } = resolveRuntimeContext(options);
  return Promise.all([
    loadEnabledSkills(),
    loadAvailableToolsCached({ workspacePath: workspacePath }),
    loadWorkspaceSummary(workspacePath),
  ]);
}
function joinPromptLines(lines = []) {
  return Array.isArray(lines)
    ? lines
        .map((line) => String(line ?? ''))
        .filter(Boolean)
        .join('\n')
    : String(lines ?? '');
}
function buildActiveProjectHint(activeProject = state.activeProject, mode = 'runtime', ap = {}) {
  if (!activeProject) return '';
  const config = ap.activeProject ?? {},
    lines = [
      config.title,
      fillTemplate(config.nameTemplate, { name: activeProject.name }),
      fillTemplate(config.workspaceTemplate, { workspace: activeProject.rootPath }),
    ];
  if (activeProject.context) {
    config.contextLabel && lines.push(config.contextLabel);
    lines.push(activeProject.context);
  }
  lines.push('planning' === mode ? config.planningNote : config.runtimeNote);
  return lines.filter(Boolean).join('\n');
}
function buildSkillsCatalogue(skills, ap = {}) {
  const config = ap.skillsCatalogue ?? {};
  return skills.length
    ? skills
        .map((skill) =>
          fillTemplate(config.entryTemplate, {
            name: skill.name,
            description:
              skill.trigger?.trim() || skill.description?.trim() || config.defaultDescription || '',
          }),
        )
        .join('\n')
    : String(config.emptyLabel ?? '');
}
function buildWorkspaceHint(summary, mode = 'runtime', ap = {}) {
  if (!summary) return '';
  const config = ap.workspace ?? {},
    lines = [config.title, fillTemplate(config.pathTemplate, { path: summary.path })];
  (summary.languages?.length &&
    lines.push(fillTemplate(config.languagesTemplate, { value: summary.languages.join(', ') })),
    summary.frameworks?.length &&
      lines.push(fillTemplate(config.frameworksTemplate, { value: summary.frameworks.join(', ') })),
    summary.testing?.length &&
      lines.push(fillTemplate(config.testingTemplate, { value: summary.testing.join(', ') })),
    summary.infra?.length &&
      lines.push(fillTemplate(config.infraTemplate, { value: summary.infra.join(', ') })),
    summary.packageManager &&
      lines.push(fillTemplate(config.packageManagerTemplate, { value: summary.packageManager })));
  const scriptEntries = Object.entries(summary.packageScripts ?? {}).slice(0, 12);
  return (
    scriptEntries.length &&
      (config.scriptsLabel && lines.push(config.scriptsLabel),
      lines.push(
        ...scriptEntries.map(([name, value]) =>
          fillTemplate(config.scriptEntryTemplate, { name, value }),
        ),
      )),
    summary.ciWorkflows?.length &&
      lines.push(
        fillTemplate(config.ciWorkflowsTemplate, { value: summary.ciWorkflows.join(', ') }),
      ),
    summary.dockerFiles?.length &&
      lines.push(
        fillTemplate(config.dockerFilesTemplate, { value: summary.dockerFiles.join(', ') }),
      ),
    summary.notes?.length &&
      (config.notesLabel && lines.push(config.notesLabel),
      lines.push(...summary.notes.map((note) => fillTemplate(config.noteEntryTemplate, { note })))),
    'planning' === mode
      ? lines.push(config.planningNote ?? '')
      : lines.push(...(config.runtimeNotes ?? [])),
    lines.filter(Boolean).join('\n')
  );
}
function buildWorkspaceFilePolicyHint(workspacePath = state.workspacePath, ap = {}) {
  if (workspacePath) {
    const lines = ap.workspaceFilePolicyWithWorkspace;
    return lines?.length
      ? joinPromptLines(lines.map((line) => fillTemplate(line, { workspacePath })))
      : '';
  }
  return joinPromptLines(ap.workspaceFilePolicyWithoutWorkspace ?? []);
}
function resolveConversationSummary(options = {}) {
  return {
    summary: hasOwnOption(options, 'conversationSummary')
      ? String(options.conversationSummary ?? '').trim()
      : String(state.conversationSummary ?? '').trim(),
    messageCount: hasOwnOption(options, 'conversationSummaryMessageCount')
      ? Math.max(0, Number(options.conversationSummaryMessageCount) || 0)
      : Math.max(0, Number(state.conversationSummaryMessageCount) || 0),
  };
}
function buildConversationSummaryBlock(summary = '', messageCount = 0, ap = {}) {
  const normalized = String(summary ?? '').trim();
  if (!normalized || messageCount <= 0) return '';
  const config = ap.conversationSummary ?? {},
    intro = fillTemplate(config.introTemplate, {
      n: messageCount,
      s: messageCount === 1 ? '' : 's',
    });
  return [config.title, intro, config.trustNote, '', normalized].filter(Boolean).join('\n');
}
function filterToolsForRun(tools = [], options = {}) {
  const filter = 'function' == typeof options.toolFilter ? options.toolFilter : null;
  return filter ? tools.filter((tool) => filter(tool)) : tools;
}
function buildPersonalMemoryPolicyBlock(tools = [], ap = {}) {
  if (!tools.some((tool) => PERSONAL_MEMORY_TOOL_NAMES.has(tool.name))) return '';
  return joinPromptLines(ap.personalMemoryPolicy ?? []);
}
function stringifyForAnalysis(value) {
  if ('string' == typeof value) return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value ?? '');
  }
}
function looksLikeBrowserAutomationTool(tool = {}) {
  if (!tool || 'mcp' !== tool.source) return !1;
  const haystack = [
    tool.name,
    tool.description,
    ...Object.keys(tool.parameters ?? {}),
    ...Object.values(tool.parameters ?? {}).map((param) => param?.description ?? ''),
  ]
    .join(' ')
    .toLowerCase();
  return BROWSER_TOOL_HINTS.some((hint) => haystack.includes(hint));
}
function getBrowserAutomationTools(tools = []) {
  return tools.filter(looksLikeBrowserAutomationTool);
}
function buildBrowserConfirmationPrompt(ap = {}) {
  return [ap.browserConfirmationSentinel, ap.browserConfirmationSuffix].filter(Boolean).join(' ');
}
function isBrowserConfirmationPromptText(text, ap = {}) {
  return (
    !!ap.browserConfirmationSentinel && String(text ?? '').includes(ap.browserConfirmationSentinel)
  );
}
function isPotentiallyIrreversibleBrowserAction(tool, params) {
  if (!looksLikeBrowserAutomationTool(tool)) return !1;
  const haystack = [tool.name, tool.description, stringifyForAnalysis(params)]
    .join(' ')
    .toLowerCase();
  if (HIGH_RISK_BROWSER_TERMS.some((term) => haystack.includes(term))) return !0;
  const hasSubmitWord = /\b(submit|confirm|complete|reserve|book)\b/.test(haystack),
    hasCommerceWord = /\b(ticket|booking|reservation|checkout|order|payment|purchase)\b/.test(
      haystack,
    );
  return hasSubmitWord && hasCommerceWord;
}
function stringifyToolResult(toolResult) {
  if ('string' == typeof toolResult) return toolResult;
  try {
    return JSON.stringify(toolResult, null, 2);
  } catch {
    return String(toolResult);
  }
}
function looksLikeInternalToolLeak(text) {
  const value = String(text ?? '').trim();
  return !!value && INTERNAL_TOOL_LEAK_PATTERNS.some((pattern) => pattern.test(value));
}
function tryRecoverLeakyAssistantReply(text) {
  const withoutTerminal = (function (text) {
    return String(text ?? '')
      .replace(/\[TERMINAL:[^\]]+\]/gi, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  })(text);
  return withoutTerminal.length >= 32 && !looksLikeInternalToolLeak(withoutTerminal)
    ? withoutTerminal
    : null;
}
function normalizeToolLogText(value, maxLength = 120) {
  const text = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? (text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text) : '';
}
const TOOLS_WITH_COMMAND_LOG = new Set([
  'run_shell_command',
  'assess_shell_command',
  'start_local_server',
]);
function buildToolLogVisiblePart(name, params = null) {
  const n = String(name ?? '').trim() || 'unknown_tool',
    detail = (function (toolName, params) {
      return params && 'object' == typeof params && TOOLS_WITH_COMMAND_LOG.has(toolName)
        ? normalizeToolLogText(
            String(params.command ?? '')
              .replace(/\s+/g, ' ')
              .trim(),
            220,
          )
        : '';
    })(n, params);
  return detail ? `${n} : ${detail}` : n;
}
function buildToolLogLabel(name, params = null) {
  return `[TOOL] ${buildToolLogVisiblePart(name, params)}`;
}
function buildToolFailureLabel(name, err, params = null) {
  const message = normalizeToolLogText(err?.message ?? 'Unknown error');
  return `${buildToolLogVisiblePart(name, params)} failed${message ? `: ${message}` : ''}`;
}
function buildBrowserResultInstruction(toolMeta = null, toolResult = '', ap = {}) {
  if (!looksLikeBrowserAutomationTool(toolMeta)) return '';
  const isCaptcha = (function (toolResult) {
    const text = stringifyToolResult(toolResult);
    return SEARCH_ENGINE_BLOCK_PATTERNS.some((pattern) => pattern.test(text));
  })(toolResult);
  return isCaptcha
    ? String(ap.browserResultCaptchaInstruction ?? '')
    : String(ap.browserResultNormalInstruction ?? '');
}
function buildToolResultContext(
  name,
  toolResult,
  success,
  remainingPlanned,
  extraInstruction = '',
  ap = {},
) {
  const resultText = stringifyToolResult(toolResult),
    config = ap.toolResultContext ?? {},
    lines = [
      config.header,
      fillTemplate(config.backgroundStepTemplate, { name }),
      fillTemplate(config.statusTemplate, {
        status: success ? config.statusSuccess : config.statusError,
      }),
      '',
      config.resultLabel,
      resultText,
      '',
    ];
  if (extraInstruction) {
    lines.push(extraInstruction);
    lines.push('');
  }
  if ('spawn_sub_agents' === name && success) {
    const followUp = config.subAgentFollowUp ?? [];
    lines.push(...followUp);
    lines.push(remainingPlanned > 0 ? config.subAgentRemainingPlanned : config.subAgentFinalStep);
    lines.push('');
  }
  if (remainingPlanned > 0) {
    lines.push(fillTemplate(config.stillHaveTemplate, { n: remainingPlanned }));
    lines.push(config.callNext);
  } else {
    lines.push(config.decideLine1, config.decideLine2, config.decideLine3Single);
  }
  resultText.includes('[TERMINAL:') && lines.push(config.terminalNote);
  return lines.filter(Boolean).join('\n');
}
function postProcessToolResult(name, toolResult, success, live, ap = {}) {
  const config = ap.toolResultPostProcess ?? {},
    subAgentConfig = config.subAgent ?? {};
  let llmToolResult = toolResult;
  if ('string' == typeof toolResult && toolResult.startsWith('[PHOTO_RESULT]'))
    try {
      const parsed = JSON.parse(toolResult.slice(14));
      live.showPhotoGallery?.(parsed);
      const count = parsed.photos?.length ?? 0,
        names = (parsed.photos ?? [])
          .slice(0, 3)
          .map((p) => `${p.photographer} — "${p.description?.slice(0, 60)}"`)
          .join('; ');
      llmToolResult = fillTemplate(config.photoSummaryTemplate, {
        count,
        query: parsed.query,
        total: parsed.total?.toLocaleString() ?? '?',
        names,
      });
    } catch {}
  else if ('string' == typeof toolResult && toolResult.startsWith('[SUBAGENT_RESULT]'))
    try {
      llmToolResult = (function (run = {}) {
        const agents = Array.isArray(run?.agents) ? run.agents : [],
          completed = agents.filter((agent) => 'completed' === agent?.status).length,
          errored = agents.filter((agent) => 'error' === agent?.status).length,
          aborted = agents.filter((agent) => 'aborted' === agent?.status).length,
          lines = [
            fillTemplate(subAgentConfig.completionTemplate, {
              total: agents.length,
              plural: 1 === agents.length ? '' : 's',
              completed,
              errored: errored ? `, ${errored} errored` : '',
              aborted: aborted ? `, ${aborted} stopped` : '',
            }),
          ];
        (run.coordinationGoal &&
          lines.push(
            fillTemplate(subAgentConfig.teamObjectiveTemplate, { goal: run.coordinationGoal }),
          ),
          run.summary &&
            lines.push(fillTemplate(subAgentConfig.runStatusTemplate, { summary: run.summary })),
          run.synthesis &&
            (lines.push(''),
            subAgentConfig.coordinatorHandoffLabel &&
              lines.push(subAgentConfig.coordinatorHandoffLabel),
            lines.push(run.synthesis)));
        const visibleAgents = agents.slice(0, 4);
        return (
          visibleAgents.length &&
            (lines.push(''),
            subAgentConfig.keyFindingsLabel && lines.push(subAgentConfig.keyFindingsLabel),
            visibleAgents.forEach((agent) => {
              const summary = String(agent?.summary ?? agent?.finalReply ?? '')
                  .replace(/\s+/g, ' ')
                  .trim(),
                compact = summary.length > 180 ? `${summary.slice(0, 177)}...` : summary;
              lines.push(
                fillTemplate(subAgentConfig.agentFindingTemplate, {
                  title: agent?.title ?? agent?.id ?? subAgentConfig.emptyAgentTitle ?? '',
                  summary: compact || subAgentConfig.emptyAgentSummary || '',
                }),
              );
            })),
          agents.length > visibleAgents.length &&
            lines.push(
              fillTemplate(subAgentConfig.additionalFindingsTemplate, {
                count: agents.length - visibleAgents.length,
              }),
            ),
          lines.push(''),
          subAgentConfig.detailsVisible && lines.push(subAgentConfig.detailsVisible),
          subAgentConfig.continueLocal && lines.push(subAgentConfig.continueLocal),
          lines.filter(Boolean).join('\n')
        );
      })(JSON.parse(toolResult.slice(17)));
    } catch {
      llmToolResult = subAgentConfig.parseFailure ?? '';
    }
  else
    'string' == typeof toolResult &&
      toolResult.includes('[TERMINAL:') &&
      (live.showToolOutput?.(toolResult),
      success &&
        'start_local_server' === name &&
        config.serverListeningInstruction &&
        (llmToolResult = `${toolResult}\n\n${config.serverListeningInstruction}`));
  return llmToolResult;
}
function buildMultiToolResultContext(resultEntries, remainingPlanned, ap = {}) {
  const config = ap.toolResultContext ?? {},
    lines = [
      config.header,
      fillTemplate(config.parallelHeaderTemplate, { n: resultEntries.length }),
      '',
    ];
  for (let i = 0; i < resultEntries.length; i++) {
    const {
        name: name,
        result: result,
        success: success,
        browserInstruction: browserInstruction,
      } = resultEntries[i],
      resultText = stringifyToolResult(result);
    (lines.push(fillTemplate(config.parallelStepTemplate, { index: i + 1, name })),
      lines.push(
        fillTemplate(config.statusTemplate, {
          status: success ? config.statusSuccess : config.statusError,
        }),
      ),
      lines.push(''),
      lines.push(config.resultLabel),
      lines.push(resultText),
      browserInstruction && (lines.push(''), lines.push(browserInstruction)),
      resultText.includes('[TERMINAL:') && config.terminalNote && lines.push(config.terminalNote),
      lines.push(''));
  }
  return (
    remainingPlanned > 0
      ? (lines.push(fillTemplate(config.stillHaveTemplate, { n: remainingPlanned })),
        lines.push(config.callNext))
      : (lines.push(config.decideLine1),
        lines.push(config.decideLine2),
        lines.push(config.decideLine3Multi)),
    lines.filter(Boolean).join('\n')
  );
}
export async function planRequest(messages, options = {}) {
  const { selectedProvider: selectedProvider, selectedModel: selectedModel } =
      resolveModelSelection(options),
    { workspacePath: workspacePath, activeProject: activeProject } = resolveRuntimeContext(options),
    { summary: conversationSummary, messageCount: conversationSummaryMessageCount } =
      resolveConversationSummary(options);
  if (!selectedProvider || !selectedModel || !messages?.length)
    return { skills: [], toolCalls: [] };
  const ap = (await getPromptConfigs()).agent ?? {};
  const planLabels = ap.planLabels ?? {};
  const recentMessages = messages
      .slice(-12)
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n'),
    _plannerLastUserMsg = [...messages].reverse().find((m) => 'user' === m?.role),
    _plannerUserText = String(_plannerLastUserMsg?.content ?? '').trim(),
    [skills, rawPlannerTools, workspaceSummary] = await Promise.all([
      loadEnabledSkills(),
      loadAvailableToolsCached({ workspacePath: workspacePath }),
      loadWorkspaceSummary(workspacePath),
    ]),
    availableTools = filterToolsByUserText(rawPlannerTools, _plannerUserText),
    browserPlanningHint = (function (browserTools = []) {
      return browserTools.length ? joinPromptLines(ap.browserPlanningLines ?? []) : '';
    })(getBrowserAutomationTools(availableTools)),
    subAgentPlanningHint = (function (tools = []) {
      return tools.some((tool) => 'spawn_sub_agents' === tool.name)
        ? String(ap.subAgentPlanningHint ?? '')
        : '';
    })(availableTools),
    workspaceFilePolicyHint = buildWorkspaceFilePolicyHint(workspacePath, ap),
    conversationSummaryBlock = buildConversationSummaryBlock(
      conversationSummary,
      conversationSummaryMessageCount,
      ap,
    ),
    personalMemoryPolicyBlock = buildPersonalMemoryPolicyBlock(availableTools, ap),
    planPrompt = [
      ...(ap.plannerIntro ?? []),
      '',
      planLabels.recentConversation,
      recentMessages,
      conversationSummaryBlock ? `\n${conversationSummaryBlock}` : '',
      activeProject ? `\n${buildActiveProjectHint(activeProject, 'planning', ap)}` : '',
      workspaceSummary ? `\n${buildWorkspaceHint(workspaceSummary, 'planning', ap)}` : '',
      `\n${workspaceFilePolicyHint}`,
      browserPlanningHint ? `\n${browserPlanningHint}` : '',
      subAgentPlanningHint ? `\n${subAgentPlanningHint}` : '',
      personalMemoryPolicyBlock ? `\n${personalMemoryPolicyBlock}` : '',
      '',
      planLabels.availableSkills,
      buildSkillsCatalogue(skills, ap),
      '',
      planLabels.availableTools,
      buildToolsPrompt(availableTools),
      '',
      ...(ap.plannerOutputFormat ?? []),
    ].join('\n');
  try {
    const result = await fetchWithTools(
      selectedProvider,
      selectedModel,
      [{ role: 'user', content: planPrompt, attachments: [] }],
      ap.plannerSystemPrompt,
      [],
      options.signal ?? null,
    );
    if ('text' !== result.type) return { skills: [], toolCalls: [] };
    const start = result.text.indexOf('{'),
      end = result.text.lastIndexOf('}');
    return -1 === start || -1 === end
      ? { skills: [], toolCalls: [] }
      : (function (parsed, validSkillNames, validToolNames) {
          const toolCalls = (parsed.toolCalls ?? parsed.tools ?? [])
            .map((entry) =>
              'string' == typeof entry
                ? { name: entry, params: {} }
                : 'string' == typeof entry?.name
                  ? { name: entry.name, params: entry.params ?? {} }
                  : null,
            )
            .filter((toolCall) => toolCall && validToolNames.has(toolCall.name));
          return {
            skills: (parsed.skills ?? []).filter(
              (name) => 'string' == typeof name && validSkillNames.has(name),
            ),
            toolCalls: toolCalls,
          };
        })(
          JSON.parse(result.text.slice(start, end + 1)),
          new Set(skills.map((skill) => skill.name)),
          new Set(availableTools.map((tool) => tool.name)),
        );
  } catch (err) {
    return (
      'AbortError' === err?.name || console.warn('[Agent] Planning failed:', err.message),
      { skills: [], toolCalls: [] }
    );
  }
}
export async function agentLoop(
  messages,
  live,
  plannedSkills = [],
  plannedToolCalls = [],
  systemPrompt,
  signal = null,
  options = {},
) {
  const {
      selectedProvider: selectedProvider,
      selectedModel: selectedModel,
      providers: providers,
      fallbackModels: fallbackModels,
      allowImplicitFailover: allowImplicitFailover,
    } = resolveModelSelection(options),
    { workspacePath: workspacePath, activeProject: activeProject } = resolveRuntimeContext(options),
    { summary: conversationSummary, messageCount: conversationSummaryMessageCount } =
      resolveConversationSummary(options),
    loopMessages = [...messages];
  let executedToolCount = 0,
    rewriteAttempts = 0;
  const totalUsage = { inputTokens: 0, outputTokens: 0 },
    _lastUserMsg = [...messages].reverse().find((m) => 'user' === m?.role),
    _userTextForTriggers = String(_lastUserMsg?.content ?? '').trim(),
    [rawAvailableTools, allSkills, workspaceSummary] = await Promise.all([
      loadAvailableToolsCached({ workspacePath: workspacePath }),
      loadEnabledSkills(),
      loadWorkspaceSummary(workspacePath),
    ]);
  const ap = (await getPromptConfigs()).agent ?? {};
  let availableTools = filterToolsForRun(
    filterToolsByUserText(rawAvailableTools, _userTextForTriggers),
    options,
  );
  const selectedSkillsConfig = ap.selectedSkills ?? {},
    toolPrivacyBlock = joinPromptLines(ap.toolPrivacyPolicy ?? []),
    personalMemoryPolicyBlock = buildPersonalMemoryPolicyBlock(availableTools, ap),
    subAgentCapabilityBlock = (function (tools = []) {
      return tools.some((tool) => 'spawn_sub_agents' === tool.name)
        ? joinPromptLines(ap.subAgentCapability ?? [])
        : '';
    })(availableTools),
    browserAutomationBlock = (function (browserTools = []) {
      if (!browserTools.length) return '';
      const listedTools = browserTools
        .slice(0, 12)
        .map(
          (tool) =>
            `- ${tool.name}: ${tool.description || ap.browserAutomationDefaultToolDescription || ''}`,
        )
        .join('\n');
      return [
        ...(ap.browserAutomationLines ?? []),
        listedTools
          ? [ap.browserAutomationAvailableToolsLabel, listedTools].filter(Boolean).join('\n')
          : '',
      ]
        .filter(Boolean)
        .join('\n');
    })(getBrowserAutomationTools(availableTools)),
    selectedSkillBlock = (function (selectedSkillNames, skills) {
      const selected = skills.filter((skill) => selectedSkillNames.includes(skill.name));
      return selected.length
        ? [
            selectedSkillsConfig.title,
            selectedSkillsConfig.intro,
            '',
            ...selected.map((skill) =>
              [
                fillTemplate(selectedSkillsConfig.headingTemplate, { name: skill.name }),
                skill.trigger
                  ? fillTemplate(selectedSkillsConfig.whenToUseTemplate, { value: skill.trigger })
                  : '',
                skill.description
                  ? fillTemplate(selectedSkillsConfig.descriptionTemplate, {
                      value: skill.description,
                    })
                  : '',
                skill.body?.trim() || '',
              ]
                .filter(Boolean)
                .join('\n\n'),
            ),
          ].join('\n\n')
        : '';
    })(plannedSkills, allSkills),
    projectHint = buildActiveProjectHint(activeProject, 'runtime', ap),
    workspaceHint = buildWorkspaceHint(workspaceSummary, 'runtime', ap),
    workspaceFilePolicyHint = buildWorkspaceFilePolicyHint(workspacePath, ap),
    conversationSummaryBlock = buildConversationSummaryBlock(
      conversationSummary,
      conversationSummaryMessageCount,
      ap,
    ),
    toolDiscoveryBlock = joinPromptLines(ap.toolDiscovery ?? []),
    parallelCallingBlock = joinPromptLines(ap.parallelCalling ?? []),
    basePrompt = [
      systemPrompt,
      toolPrivacyBlock,
      joinPromptLines(ap.agenticWorkflow ?? []),
      personalMemoryPolicyBlock,
      subAgentCapabilityBlock,
      browserAutomationBlock,
      toolDiscoveryBlock,
      parallelCallingBlock,
      selectedSkillBlock,
      conversationSummaryBlock,
      projectHint,
      workspaceHint,
      workspaceFilePolicyHint,
    ]
      .filter(Boolean)
      .join('\n\n');
  let toolMetaByName = new Map(availableTools.map((tool) => [tool.name, tool])),
    browserApprovalAvailable = (function (messages = []) {
      let lastUserIndex = -1;
      for (let index = messages.length - 1; index >= 0; index -= 1)
        if ('user' === messages[index]?.role) {
          lastUserIndex = index;
          break;
        }
      if (lastUserIndex < 1) return !1;
      if (
        !(function (text) {
          const normalized = String(text ?? '')
            .trim()
            .toLowerCase();
          return (
            !!normalized &&
            [
              'confirm',
              'confirmed',
              'yes',
              'yes confirm',
              'yes continue',
              'continue',
              'go ahead',
              'go ahead and continue',
              'proceed',
              'do it',
              'book it',
              'submit it',
              'complete it',
            ].some((phrase) => normalized === phrase || normalized.includes(phrase))
          );
        })(messages[lastUserIndex]?.content)
      )
        return !1;
      for (let index = lastUserIndex - 1; index >= 0; index -= 1)
        if ('assistant' === messages[index]?.role)
          return isBrowserConfirmationPromptText(messages[index]?.content, ap);
      return !1;
    })(loopMessages);
  const candidates = [
    { provider: selectedProvider, modelId: selectedModel, note: null },
    ...buildFailoverCandidates(
      selectedProvider,
      selectedModel,
      providers,
      fallbackModels,
      allowImplicitFailover,
    ),
  ].filter((candidate) => candidate.provider && candidate.modelId);
  let usedProvider = selectedProvider,
    usedModel = selectedModel;
  const sysPromptWithPlan = [
    basePrompt,
    plannedToolCalls?.length
      ? [
          ap.callPlanHeader,
          ...plannedToolCalls.map((toolCall, index) => {
            const params = Object.entries(toolCall.params ?? {})
              .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
              .join(', ');
            return `${index + 1}. ${toolCall.name}(${params})`;
          }),
        ].join('\n')
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');
  for (let turn = 0; turn < MAX_AGENT_LOOP_TURNS; turn++) {
    if (state.queuedSteeringMessages?.length) {
      const msgs = state.queuedSteeringMessages.splice(0, state.queuedSteeringMessages.length);
      for (const msg of msgs) {
        loopMessages.push({
          role: 'user',
          content: `[USER STEERING INTERVENTION]:\n${msg.text}`,
          attachments: msg.attachments || [],
        });
      }
    }
    const forceFinalAnswer = turn >= MAX_AGENT_LOOP_TURNS - 1,
      toolsThisTurn = forceFinalAnswer ? [] : availableTools,
      allPlannedToolsDone =
        !plannedToolCalls?.length || executedToolCount >= plannedToolCalls.length,
      sysPromptThisTurn = `${forceFinalAnswer || allPlannedToolsDone ? basePrompt : sysPromptWithPlan}${forceFinalAnswer ? joinPromptLines(ap.finalTurn ?? []) : ''}`;
    let result = null,
      lastErr = null,
      streamingStarted = !1,
      bufferedReply = '',
      steeringInterrupted = !1;
    const onToken = (chunk) => {
        chunk && ((streamingStarted = !0), (bufferedReply += chunk), live.stream?.(chunk));
      },
      onReasoning = (chunk) => {
        chunk && live.streamThinking?.(chunk);
      };
    // Per-turn steering controller: aborted when the user sends a new message
    // mid-stream, allowing the loop to pick it up immediately without killing
    // the entire agent run.
    const steeringController = new AbortController();
    const onSteeringInterrupt = () => steeringController.abort();
    window.addEventListener('jo:steering-interrupt', onSteeringInterrupt, { once: !0 });
    const turnSignal = (function combineSignals(a, b) {
      if (!a) return b;
      if (!b) return a;
      if (typeof AbortSignal.any === 'function') return AbortSignal.any([a, b]);
      // Fallback for environments without AbortSignal.any
      const ctrl = new AbortController();
      const abort = () => ctrl.abort();
      if (a.aborted || b.aborted) {
        ctrl.abort();
      } else {
        a.addEventListener('abort', abort, { once: !0 });
        b.addEventListener('abort', abort, { once: !0 });
      }
      return ctrl.signal;
    })(signal, steeringController.signal);
    for (const [
      candidateIndex,
      { provider: provider, modelId: modelId, note: note },
    ] of candidates.entries()) {
      note && live.push(note);
      const modelName = getModelDisplayName(provider, modelId);
      for (let attempt = 0; attempt <= RATE_LIMIT_BACKOFF_MS.length; attempt += 1) {
        ((streamingStarted = !1), (bufferedReply = ''));
        try {
          ((result = await fetchStreamingWithTools(
            provider,
            modelId,
            loopMessages,
            sysPromptThisTurn,
            toolsThisTurn,
            onToken,
            onReasoning,
            turnSignal,
          )),
            (usedProvider = provider),
            (usedModel = modelId));
          break;
        } catch (err) {
          lastErr = err;
          if ('AbortError' === err.name) {
            if (signal?.aborted) {
              // Main abort (user clicked Stop) — propagate as fatal.
              window.removeEventListener('jo:steering-interrupt', onSteeringInterrupt);
              throw err;
            }
            // Steering interrupt — user sent a message while the AI was streaming.
            // Break out of the retry/candidate loops and re-enter the turn loop
            // so the queued message is injected at the top of the next iteration.
            steeringInterrupted = !0;
            break;
          }
          if (streamingStarted) {
            live.push(`Stream error: ${err.message.slice(0, 60)}`);
            break;
          }
          const hasMoreCandidates = candidateIndex < candidates.length - 1,
            rateLimited = isRateLimitError(err);
          if (rateLimited && attempt < RATE_LIMIT_BACKOFF_MS.length) {
            const delayMs = RATE_LIMIT_BACKOFF_MS[attempt];
            (live.push(
              `HTTP 429 on ${modelName} - waiting ${Math.round(delayMs / 1e3)}s before retrying...`,
            ),
              await waitWithAbort(delayMs, signal));
            continue;
          }
          rateLimited
            ? live.push(
                hasMoreCandidates
                  ? `HTTP 429 kept happening on ${modelName} - trying the next model...`
                  : `HTTP 429 kept happening on ${modelName} after multiple retries.`,
              )
            : live.push(
                hasMoreCandidates
                  ? `${err.message.slice(0, 55)} - trying fallback...`
                  : `${err.message.slice(0, 55)}`,
              );
          break;
        }
      }
      if (result || steeringInterrupted) break;
    }
    window.removeEventListener('jo:steering-interrupt', onSteeringInterrupt);
    if (steeringInterrupted) {
      // Discard any partial streamed reply and let the next turn handle everything
      // with the user's new steering message injected at its top.
      live.clearReply?.();
      continue;
    }
    if (!result) {
      const message = `API error: ${lastErr?.message ?? 'Unknown error'}`;
      return (
        live.set(message),
        { text: message, usage: totalUsage, usedProvider: usedProvider, usedModel: usedModel }
      );
    }
    if (
      (result.usage &&
        ((totalUsage.inputTokens += result.usage.inputTokens ?? 0),
        (totalUsage.outputTokens += result.usage.outputTokens ?? 0)),
      'text' === result.type)
    ) {
      const finalText = String(bufferedReply || result.text || '').trim() || '(empty response)';
      if (looksLikeInternalToolLeak(finalText)) {
        if (((rewriteAttempts += 1), rewriteAttempts > MAX_REWRITE_ATTEMPTS)) {
          const recovered = tryRecoverLeakyAssistantReply(finalText);
          if (recovered)
            return (
              live.finalize(recovered, result.usage, usedProvider, usedModel),
              {
                text: recovered,
                usage: totalUsage,
                usedProvider: usedProvider,
                usedModel: usedModel,
              }
            );
          const fallback =
            'I ran into an internal formatting issue while preparing the answer. Please try again.';
          return (
            live.finalize(fallback, result.usage, usedProvider, usedModel),
            { text: fallback, usage: totalUsage, usedProvider: usedProvider, usedModel: usedModel }
          );
        }
        (live.push('Polishing the reply…'),
          loopMessages.push({ role: 'assistant', content: finalText, attachments: [] }),
          loopMessages.push({
            role: 'user',
            content: joinPromptLines(ap.rewritePrompt ?? []),
            attachments: [],
          }));
        continue;
      }
      return (
        live.finalize(finalText, result.usage, usedProvider, usedModel),
        { text: finalText, usage: totalUsage, usedProvider: usedProvider, usedModel: usedModel }
      );
    }
    if ('tool_call' === result.type) {
      live.clearReply?.();
      const { name: name, params: params } = result,
        logHandle = live.push(buildToolLogLabel(name, params)),
        toolMeta = toolMetaByName.get(name) ?? null;
      let toolResult,
        success = !0;
      try {
        if (name === REQUEST_TOOL_CATEGORIES_NAME) {
          const requested = parseRequestedCategories(params.categories);
          if (requested.includes('all'))
            availableTools = filterToolsForRun(rawAvailableTools, options);
          else {
            const newTools = getToolsForCategories(rawAvailableTools, requested);
            availableTools = dedupeTools([...availableTools, ...newTools]);
          }
          ((toolMetaByName = new Map(availableTools.map((tool) => [tool.name, tool]))),
            (toolResult = buildCategoryLoadResult(requested, availableTools)));
        } else if (name === REQUEST_ALL_TOOLS_TOOL_NAME)
          ((availableTools = filterToolsForRun(rawAvailableTools, options)),
            (toolMetaByName = new Map(availableTools.map((tool) => [tool.name, tool]))),
            (toolResult = buildToolCatalog(availableTools)));
        else {
          if (isPotentiallyIrreversibleBrowserAction(toolMeta, params)) {
            if (!browserApprovalAvailable) {
              const confirmationPrompt = buildBrowserConfirmationPrompt(ap);
              return (
                live.finalize(confirmationPrompt, result.usage, usedProvider, usedModel),
                {
                  text: confirmationPrompt,
                  usage: totalUsage,
                  usedProvider: usedProvider,
                  usedModel: usedModel,
                }
              );
            }
            browserApprovalAvailable = !1;
          }
          const executionHooks = live.getToolExecutionHooks?.(name);
          toolResult = await executeTool(name, params, {
            ...('function' == typeof executionHooks
              ? { onStage: executionHooks }
              : executionHooks && 'object' == typeof executionHooks
                ? executionHooks
                : {}),
            workspacePath: workspacePath,
            signal: signal,
          });
        }
      } catch (err) {
        ((success = !1),
          (toolResult = `Error: ${err.message}`),
          logHandle?.done && logHandle.done(!1, buildToolFailureLabel(name, err, params)));
      }
      success && logHandle?.done && logHandle.done(!0);
      const llmToolResult = postProcessToolResult(name, toolResult, success, live, ap),
        totalPlanned = plannedToolCalls?.length ?? 0;
      executedToolCount += 1;
      const remainingPlanned = totalPlanned > 0 ? Math.max(0, totalPlanned - executedToolCount) : 0,
        browserResultInstruction = buildBrowserResultInstruction(toolMeta, llmToolResult, ap);
      loopMessages.push({
        role: 'user',
        content: buildToolResultContext(
          name,
          llmToolResult,
          success,
          remainingPlanned,
          browserResultInstruction,
          ap,
        ),
        attachments: [],
      });
    }
    if ('tool_calls' === result.type) {
      live.clearReply?.();
      const calls = result.calls,
        metaCalls = calls.filter(
          (c) => c.name === REQUEST_TOOL_CATEGORIES_NAME || c.name === REQUEST_ALL_TOOLS_TOOL_NAME,
        ),
        regularCalls = calls.filter(
          (c) => c.name !== REQUEST_TOOL_CATEGORIES_NAME && c.name !== REQUEST_ALL_TOOLS_TOOL_NAME,
        );
      for (const metaCall of metaCalls) {
        const metaHandle = live.push(buildToolLogLabel(metaCall.name, metaCall.params));
        try {
          if (metaCall.name === REQUEST_TOOL_CATEGORIES_NAME) {
            const requested = parseRequestedCategories(metaCall.params?.categories);
            if (requested.includes('all'))
              availableTools = filterToolsForRun(rawAvailableTools, options);
            else {
              const newTools = getToolsForCategories(rawAvailableTools, requested);
              availableTools = dedupeTools([...availableTools, ...newTools]);
            }
          } else availableTools = filterToolsForRun(rawAvailableTools, options);
          ((toolMetaByName = new Map(availableTools.map((tool) => [tool.name, tool]))),
            metaHandle?.done?.(!0));
        } catch (err) {
          metaHandle?.done?.(!1, buildToolFailureLabel(metaCall.name, err, metaCall.params));
        }
      }
      const riskyCall = regularCalls.find((c) =>
        isPotentiallyIrreversibleBrowserAction(toolMetaByName.get(c.name) ?? null, c.params),
      );
      if (riskyCall && !browserApprovalAvailable) {
        const confirmationPrompt = buildBrowserConfirmationPrompt(ap);
        return (
          live.finalize(confirmationPrompt, result.usage, usedProvider, usedModel),
          {
            text: confirmationPrompt,
            usage: totalUsage,
            usedProvider: usedProvider,
            usedModel: usedModel,
          }
        );
      }
      riskyCall && browserApprovalAvailable && (browserApprovalAvailable = !1);
      const logEntries = regularCalls.map((c) => ({
          call: c,
          handle: live.push(buildToolLogLabel(c.name, c.params)),
          toolMeta: toolMetaByName.get(c.name) ?? null,
        })),
        resultEntries = (
          await Promise.allSettled(
            logEntries.map(async ({ call: call, handle: handle }) => {
              const executionHooks = live.getToolExecutionHooks?.(call.name),
                rawResult = await executeTool(call.name, call.params, {
                  ...('function' == typeof executionHooks
                    ? { onStage: executionHooks }
                    : executionHooks && 'object' == typeof executionHooks
                      ? executionHooks
                      : {}),
                  workspacePath: workspacePath,
                  signal: signal,
                });
              return (handle?.done?.(!0), rawResult);
            }),
          )
        ).map((s, i) => {
          const { call: call, handle: handle, toolMeta: toolMeta } = logEntries[i];
          if ('fulfilled' === s.status) {
            const llmResult = postProcessToolResult(call.name, s.value, !0, live, ap);
            return {
              name: call.name,
              result: llmResult,
              success: !0,
              toolMeta: toolMeta,
              browserInstruction: buildBrowserResultInstruction(toolMeta, llmResult, ap),
            };
          }
          const errMsg = `Error: ${s.reason?.message ?? 'Unknown error'}`;
          return (
            handle?.done?.(!1, buildToolFailureLabel(call.name, s.reason, call.params)),
            {
              name: call.name,
              result: errMsg,
              success: !1,
              toolMeta: toolMeta,
              browserInstruction: '',
            }
          );
        }),
        totalPlanned = plannedToolCalls?.length ?? 0;
      executedToolCount += regularCalls.length;
      const remainingPlanned = totalPlanned > 0 ? Math.max(0, totalPlanned - executedToolCount) : 0;
      loopMessages.push({
        role: 'user',
        content: buildMultiToolResultContext(resultEntries, remainingPlanned, ap),
        attachments: [],
      });
    }
  }
  const exhausted =
    'I reached the maximum number of tool rounds for this reply. If you still need more work, send a short follow-up (for example what to continue or verify) and I can pick up from there.';
  return (
    live.set(exhausted),
    { text: exhausted, usage: totalUsage, usedProvider: usedProvider, usedModel: usedModel }
  );
}
