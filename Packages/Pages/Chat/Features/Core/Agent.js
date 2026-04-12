import { state } from '../../../../System/State.js';
import { fetchWithTools, fetchStreamingWithTools } from '../../../../Features/AI/index.js';
import {
  buildToolsPrompt,
  getAvailableTools,
  filterToolsByUserText,
  REQUEST_TOOL_CATEGORIES_NAME,
  parseRequestedCategories,
  getToolsForCategories,
  buildCategoryLoadResult,
} from '../Capabilities/Registry/Tools.js';
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
  BROWSER_CONFIRMATION_SENTINEL = 'Potentially irreversible website action pending.',
  RATE_LIMIT_BACKOFF_MS = [5e3, 1e4, 15e3],
  PERSONAL_MEMORY_TOOL_NAMES = new Set([
    'list_personal_memory_files',
    'search_personal_memory',
    'read_personal_memory_files',
  ]),
  SEARCH_ENGINE_BLOCK_PATTERNS = [
    /google\.com\/sorry/i,
    /\bunusual traffic\b/i,
    /\brecaptcha\b/i,
    /\bi am not a robot\b/i,
    /\bi'm not a robot\b/i,
  ],
  skillsCache = { value: null, expiresAt: 0, promise: null },
  toolsCache = new Map(),
  workspaceSummaryCache = new Map();
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
function buildActiveProjectHint(activeProject = state.activeProject, mode = 'runtime') {
  if (!activeProject) return '';
  const lines = [
    '[ACTIVE PROJECT]',
    `Name: ${activeProject.name}`,
    `Workspace: ${activeProject.rootPath}`,
  ];
  return (
    activeProject.context &&
      (lines.push('Project info to keep in mind:'), lines.push(activeProject.context)),
    'planning' === mode
      ? lines.push(
          'Treat this project folder as the default workspace for file, code, and terminal requests.',
        )
      : lines.push(
          'This project is currently open. Treat this workspace as the default directory unless the user asks for another one.',
        ),
    lines.join('\n')
  );
}
function buildSkillsCatalogue(skills) {
  return skills.length
    ? skills
        .map(
          (skill) =>
            `  - "${skill.name}": ${skill.trigger?.trim() || skill.description?.trim() || 'general assistant skill'}`,
        )
        .join('\n')
    : '  (none)';
}
function buildWorkspaceHint(summary, mode = 'runtime') {
  if (!summary) return '';
  const lines = ['[USER WORKSPACE]', `Path: ${summary.path}`];
  (summary.languages?.length && lines.push(`Languages: ${summary.languages.join(', ')}`),
    summary.frameworks?.length && lines.push(`Frameworks: ${summary.frameworks.join(', ')}`),
    summary.testing?.length && lines.push(`Testing: ${summary.testing.join(', ')}`),
    summary.infra?.length && lines.push(`Infra: ${summary.infra.join(', ')}`),
    summary.packageManager && lines.push(`Package manager: ${summary.packageManager}`));
  const scriptEntries = Object.entries(summary.packageScripts ?? {}).slice(0, 12);
  return (
    scriptEntries.length &&
      (lines.push('Scripts:'),
      lines.push(...scriptEntries.map(([name, value]) => `- ${name}: ${value}`))),
    summary.ciWorkflows?.length && lines.push(`CI workflows: ${summary.ciWorkflows.join(', ')}`),
    summary.dockerFiles?.length && lines.push(`Docker files: ${summary.dockerFiles.join(', ')}`),
    summary.notes?.length &&
      (lines.push('Notes:'), lines.push(...summary.notes.map((note) => `- ${note}`))),
    'planning' === mode
      ? lines.push(
          'For coding, QA, or DevOps requests, strongly prefer inspect_workspace, search_workspace, extract_file_text, read_file_chunk, read_multiple_local_files, list_directory_tree, replace_lines_in_file, insert_into_file, git_status, git_diff, run_project_checks, and GitHub/MCP tools over guessing.',
        )
      : (lines.push(
          'When the user asks you to code, debug, test, review, or deploy, use the local workspace tools and stay inside this directory unless the user says otherwise.',
        ),
        lines.push(
          'Prefer inspect_workspace, search_workspace, extract_file_text, read_file_chunk, read_multiple_local_files, list_directory_tree, replace_lines_in_file, insert_into_file, copy_item, move_item, git_status, git_diff, run_project_checks, and apply_file_patch before falling back to raw shell commands.',
        ),
        lines.push(
          'Use assess_shell_command before risky shell work. Only set allow_risky=true when the user explicitly requested the risky action.',
        ),
        lines.push(
          'Use start_local_server for long-running dev servers or watchers instead of run_shell_command. If the tool succeeds, read the embedded terminal output (or run a quick check) before claiming the URL works — the tool fails if the process exits during startup (e.g. EADDRINUSE).',
        )),
    lines.join('\n')
  );
}
function buildWorkspaceFilePolicyHint(workspacePath = state.workspacePath) {
  return workspacePath
    ? [
        '## Workspace File Policy',
        `A workspace directory is open at: ${workspacePath}`,
        'When the user asks for code, bug fixes, or file changes, prefer using the available workspace/file tools to create or update the real files inside that workspace.',
        'Do not stop at code snippets when you can safely complete the request directly in the open workspace.',
      ].join('\n')
    : [
        '## Workspace File Policy',
        'No workspace directory is currently open.',
        'Do not claim to create or edit files, and do not invent file operations.',
        'If the user asks for code while no workspace is open, provide the code in the reply and let the user create the files unless they open a workspace first.',
      ].join('\n');
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
function buildConversationSummaryBlock(summary = '', messageCount = 0) {
  const normalized = String(summary ?? '').trim();
  return !normalized || messageCount <= 0
    ? ''
    : [
        '## Conversation Summary',
        `Older turns have been compacted for speed. This summary covers approximately ${messageCount} earlier message${1 === messageCount ? '' : 's'}.`,
        'Treat it as trusted context unless newer messages clearly override it.',
        '',
        normalized,
      ].join('\n');
}
function filterToolsForRun(tools = [], options = {}) {
  const filter = 'function' == typeof options.toolFilter ? options.toolFilter : null;
  return filter ? tools.filter((tool) => filter(tool)) : tools;
}
function buildPersonalMemoryPolicyBlock(tools = []) {
  return tools.some((tool) => PERSONAL_MEMORY_TOOL_NAMES.has(tool.name))
    ? [
        '## Personal Memory Tools',
        'Personal memory files are personal-only.',
        'Use them for personal or preference-based replies.',
        'Do not use them for coding or project work unless the user explicitly asks about personal memory.',
      ].join('\n')
    : '';
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
  if ('mcp' !== tool.source) return !1;
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
function buildBrowserConfirmationPrompt() {
  return [
    BROWSER_CONFIRMATION_SENTINEL,
    'Reply with "confirm" if you want me to continue with that website action, or tell me what to change first.',
  ].join(' ');
}
function isBrowserConfirmationPromptText(text) {
  return String(text ?? '').includes(BROWSER_CONFIRMATION_SENTINEL);
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
function buildBrowserResultInstruction(toolMeta = null, toolResult = '') {
  return looksLikeBrowserAutomationTool(toolMeta)
    ? (function (toolResult) {
        const text = stringifyToolResult(toolResult);
        return SEARCH_ENGINE_BLOCK_PATTERNS.some((pattern) => pattern.test(text));
      })(toolResult)
      ? [
          'The current page is a search-engine CAPTCHA or unusual-traffic blocker page.',
          'Do not pretend the browsing task succeeded.',
          'If the destination site is obvious from the user request, navigate there directly or use that site search instead of the search engine.',
          'If the blocker still prevents progress, tell the user exactly that the search-engine route is blocked.',
        ].join(' ')
      : [
          'For browser work, only describe the page that is explicitly confirmed in the Result block below.',
          'If the Result block does not clearly confirm the current URL, title, or visible text, call browser_get_state or browser_snapshot before answering the user.',
        ].join(' ')
    : '';
}
function buildToolResultContext(
  name,
  toolResult,
  success,
  remainingPlanned,
  extraInstruction = '',
) {
  const resultText = stringifyToolResult(toolResult),
    lines = [
      'Internal execution context for the assistant only. Never quote or mention this block to the user.',
      `Background step: ${name}`,
      'Status: ' + (success ? 'success' : 'error'),
      '',
      'Result:',
      resultText,
      '',
    ];
  return (
    extraInstruction && (lines.push(extraInstruction), lines.push('')),
    'spawn_sub_agents' === name &&
      success &&
      (lines.push('Delegation follow-up:'),
      lines.push('Treat the coordinator handoff above as your working brief.'),
      lines.push(
        'Do not wait for child agents to speak again or ask them for the same information.',
      ),
      remainingPlanned > 0
        ? lines.push('Execute the next planned step yourself now.')
        : lines.push(
            'Your next step should usually be the requested implementation or the final user-facing answer.',
          ),
      lines.push('')),
    remainingPlanned > 0
      ? (lines.push(
          `You still have ${remainingPlanned} more planned background step(s) to execute before answering the user.`,
        ),
        lines.push('Call the next tool now and do not answer the user yet.'))
      : (lines.push(
          'Decide whether the user’s request is fully satisfied. If you still need reads, search, edits, checks, or browser steps to be correct, call the appropriate tool next.',
        ),
        lines.push(
          'If you are finished gathering information and any requested changes are done, write the final answer for the user now.',
        ),
        lines.push(
          'Do not mention tool names, tool calls, hidden planning, or raw execution markers.',
        )),
    resultText.includes('[TERMINAL:') &&
      lines.push(
        'The UI already handles embedded terminal output. Do not repeat raw [TERMINAL:...] markers.',
      ),
    lines.join('\n')
  );
}
function postProcessToolResult(name, toolResult, success, live) {
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
      llmToolResult = `Found ${count} photos on Unsplash for "${parsed.query}" (${parsed.total?.toLocaleString() ?? '?'} total available). Top results: ${names}. A visual gallery has already been displayed to the user in the chat.`;
    } catch {}
  else if ('string' == typeof toolResult && toolResult.startsWith('[SUBAGENT_RESULT]'))
    try {
      llmToolResult = (function (run = {}) {
        const agents = Array.isArray(run?.agents) ? run.agents : [],
          completed = agents.filter((agent) => 'completed' === agent?.status).length,
          errored = agents.filter((agent) => 'error' === agent?.status).length,
          aborted = agents.filter((agent) => 'aborted' === agent?.status).length,
          lines = [
            `Delegation complete: ${agents.length} sub-agent${1 === agents.length ? '' : 's'} total, ${completed} completed${errored ? `, ${errored} errored` : ''}${aborted ? `, ${aborted} stopped` : ''}.`,
          ];
        (run.coordinationGoal && lines.push(`Team objective: ${run.coordinationGoal}`),
          run.summary && lines.push(`Run status: ${run.summary}`),
          run.synthesis && (lines.push('', 'Coordinator handoff:'), lines.push(run.synthesis)));
        const visibleAgents = agents.slice(0, 4);
        return (
          visibleAgents.length &&
            (lines.push('', 'Key delegated findings:'),
            visibleAgents.forEach((agent) => {
              const summary = String(agent?.summary ?? agent?.finalReply ?? '')
                  .replace(/\s+/g, ' ')
                  .trim(),
                compact = summary.length > 180 ? `${summary.slice(0, 177)}...` : summary;
              lines.push(
                `- ${agent?.title ?? agent?.id ?? 'Sub-agent'}: ${compact || 'No handoff returned.'}`,
              );
            })),
          agents.length > visibleAgents.length &&
            lines.push(
              `- ${agents.length - visibleAgents.length} additional delegated handoff(s) are available in the sub-agent panel.`,
            ),
          lines.push(''),
          lines.push('The detailed child outputs are already visible in the sub-agent panel.'),
          lines.push(
            'Continue locally now. Do not wait for more delegated output, and do not call spawn_sub_agents again unless a distinct unresolved gap remains.',
          ),
          lines.join('\n')
        );
      })(JSON.parse(toolResult.slice(17)));
    } catch {
      llmToolResult =
        'Delegated sub-agent run completed, but the handoff payload could not be parsed cleanly.';
    }
  else
    'string' == typeof toolResult &&
      toolResult.includes('[TERMINAL:') &&
      (live.showToolOutput?.(toolResult),
      success &&
        'start_local_server' === name &&
        (llmToolResult = `${toolResult}\n\nConfirm from the terminal output that the server is listening before telling the user to open a preview URL; bind failures such as EADDRINUSE can appear after compile finishes.`));
  return llmToolResult;
}
function buildMultiToolResultContext(resultEntries, remainingPlanned) {
  const lines = [
    'Internal execution context for the assistant only. Never quote or mention this block to the user.',
    `${resultEntries.length} background steps executed in parallel:`,
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
    (lines.push(`--- Step ${i + 1}: ${name} ---`),
      lines.push('Status: ' + (success ? 'success' : 'error')),
      lines.push(''),
      lines.push('Result:'),
      lines.push(resultText),
      browserInstruction && (lines.push(''), lines.push(browserInstruction)),
      resultText.includes('[TERMINAL:') &&
        lines.push(
          'The UI already handles embedded terminal output. Do not repeat raw [TERMINAL:...] markers.',
        ),
      lines.push(''));
  }
  return (
    remainingPlanned > 0
      ? (lines.push(
          `You still have ${remainingPlanned} more planned background step(s) to execute before answering the user.`,
        ),
        lines.push('Call the next tool now and do not answer the user yet.'))
      : (lines.push(
          "Decide whether the user's request is fully satisfied. If you still need reads, search, edits, checks, or browser steps to be correct, call the appropriate tool next.",
        ),
        lines.push(
          'If you are finished gathering information and any requested changes are done, write the final answer for the user now.',
        ),
        lines.push(
          'Do not mention tool names, tool calls, hidden planning, or raw execution markers.',
        )),
    lines.join('\n')
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
      return browserTools.length
        ? [
            'Browser-control MCP tools are connected right now.',
            'IMPORTANT: BEFORE planning browser tools, ALWAYS check your tool catalog to see if a specialized tool (e.g. weather, stocks, crypto, flight info) can retrieve the data directly.',
            'ONLY use browser automation as a fallback if no specialized tool is available, or if the user explicitly asks you to browse a website.',
            'If the user needs live website work such as browsing, navigation, ticket lookup, reservations, form filling, or account actions (and no API tool is available), plan those browser tools before guessing from static knowledge.',
            'Do not plan a final purchase, booking confirmation, reservation submit, or payment action unless the user has explicitly confirmed that exact irreversible step in the current conversation.',
          ].join('\n')
        : '';
    })(getBrowserAutomationTools(availableTools)),
    subAgentPlanningHint = (function (tools = []) {
      return tools.some((tool) => 'spawn_sub_agents' === tool.name)
        ? [
            'For medium or high complexity requests that can be split into parallel research, investigation, or verification tracks, prefer planning spawn_sub_agents.',
            'Use delegation only when it will materially improve speed, coverage, or accuracy.',
            'Give each delegated agent a narrow title, a specific goal, and a clear deliverable.',
          ].join(' ')
        : '';
    })(availableTools),
    workspaceFilePolicyHint = buildWorkspaceFilePolicyHint(workspacePath),
    conversationSummaryBlock = buildConversationSummaryBlock(
      conversationSummary,
      conversationSummaryMessageCount,
    ),
    planPrompt = [
      'You are a planning assistant for an AI agent.',
      'Read the user request and decide which skills and tools are needed.',
      'Return exact tool calls, in order, with concrete parameters.',
      'Always read the revelant skills first before responding to the user.',
      'If the same tool must be called multiple times with different parameters, list each call separately.',
      'For multi-step work, order toolCalls so dependencies run first (e.g. search or read before edit; inspect before broad changes). List every distinct step you expect; the agent may add or adjust steps later.',
      'If the user is asking what you know about them, their preferences, memory, profile, or prior context, planning personal memory tools is appropriate when helpful.',
      'Do not plan workspace, repo, account, email, or external-service tools for personal-context questions unless the user explicitly asks for those sources.',
      '',
      'Recent conversation:',
      recentMessages,
      conversationSummaryBlock ? `\n${conversationSummaryBlock}` : '',
      activeProject ? `\n${buildActiveProjectHint(activeProject, 'planning')}` : '',
      workspaceSummary ? `\n${buildWorkspaceHint(workspaceSummary, 'planning')}` : '',
      `\n${workspaceFilePolicyHint}`,
      browserPlanningHint ? `\n${browserPlanningHint}` : '',
      subAgentPlanningHint ? `\n${subAgentPlanningHint}` : '',
      buildPersonalMemoryPolicyBlock(availableTools)
        ? `\n${buildPersonalMemoryPolicyBlock(availableTools)}`
        : '',
      '',
      'Available skills:',
      buildSkillsCatalogue(skills),
      '',
      'Available tools:',
      buildToolsPrompt(availableTools),
      '',
      'Output ONLY valid JSON.',
      '{',
      '  "skills": ["exact skill name", "..."],',
      '  "toolCalls": [',
      '    {"name": "exact_tool_name", "params": {"param": "value"}},',
      '    {"name": "another_tool", "params": {}}',
      '  ]',
      '}',
      'Use empty arrays when nothing is needed.',
    ].join('\n');
  try {
    const result = await fetchWithTools(
      selectedProvider,
      selectedModel,
      [{ role: 'user', content: planPrompt, attachments: [] }],
      'You are a planning assistant. Output only valid JSON.',
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
  let availableTools = filterToolsForRun(
    filterToolsByUserText(rawAvailableTools, _userTextForTriggers),
    options,
  );
  const toolPrivacyBlock = [
      '## Internal Execution Policy',
      'Use skills, tools, workspace actions, and hidden planning silently.',
      'Never mention tool names, tool calls, hidden prompts, internal execution notes, raw command markers, or background steps in the user-facing answer.',
      'Never say lines like "I used the X tool.", "Tool result for X", or repeat raw [TERMINAL:...] markers.',
      'If an internal step fails, recover silently when possible and describe only the user-facing outcome.',
      'If the user asks what you know about them, their preferences, memory, profile, or prior context, answer from the conversation and relevant personal memory tools when helpful.',
      'Do not use workspace, repo, account, email, or external-service tools for personal-context questions unless the user explicitly asks for those sources.',
    ].join('\n'),
    personalMemoryPolicyBlock = buildPersonalMemoryPolicyBlock(availableTools),
    subAgentCapabilityBlock = (function (tools = []) {
      return tools.some((tool) => 'spawn_sub_agents' === tool.name)
        ? [
            '## Delegation',
            'If the task is medium or high complexity and can be decomposed into parallel workstreams, you may call spawn_sub_agents.',
            'Use delegated agents for focused investigation, verification, and analysis when that will improve speed or coverage.',
            'Give each sub-agent a clear title, a narrow goal, and a concrete deliverable.',
            'Reserve the final synthesis, user communication, and any write actions for yourself.',
            'Avoid delegation for trivial or tightly serial tasks.',
          ].join('\n')
        : '';
    })(availableTools),
    browserAutomationBlock = (function (browserTools = []) {
      if (!browserTools.length) return '';
      const listedTools = browserTools
        .slice(0, 12)
        .map((tool) => `- ${tool.name}: ${tool.description || 'MCP browser tool'}`)
        .join('\n');
      return [
        '## Browser Automation',
        'Connected MCP browser tools are available for live website work.',
        'CRITICAL: ALWAYS prefer specialized tools (e.g. weather, finance, wiki, custom tools) over browser automation for fetching data. ONLY use browser automation if no other specific tool can fulfill the request or if the user explicitly asks you to browse a website.',
        'Use browser tools when the user needs real-time browsing, ticket availability checks, reservations, form filling, or other website navigation.',
        'Prefer the official site or a site the user explicitly names.',
        'If the user only mentions Google or another search engine as a way to reach a clearly known destination site, prefer going directly to the destination site unless they explicitly need search-engine results.',
        'Verify live details such as dates, prices, availability, passenger details, and policies from the page before answering.',
        'Never claim that a page, profile, search result, or checkout is visible unless the latest browser tool result explicitly confirms the current URL, title, or visible page text.',
        'If the current page is not explicit in the latest result, call browser_get_state or browser_snapshot before answering.',
        'If a search engine shows a CAPTCHA, unusual-traffic page, or robot check, stop using that search engine and either navigate directly to the destination site or tell the user the route is blocked.',
        'Stop and ask for explicit confirmation before any irreversible website action such as a final booking, reservation, checkout, purchase, or payment submission.',
        'If login, CAPTCHA, OTP, 2FA, or payment details are required, ask the user for that step clearly and continue after they reply.',
        listedTools ? `Browser-capable tools currently available:\n${listedTools}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    })(getBrowserAutomationTools(availableTools)),
    selectedSkillBlock = (function (selectedSkillNames, skills) {
      const selected = skills.filter((skill) => selectedSkillNames.includes(skill.name));
      return selected.length
        ? [
            '## Selected Skills',
            'Apply the following skill docs for this specific request. Ignore non-selected skills unless the user explicitly asks for them.',
            '',
            ...selected.map((skill) =>
              [
                `### ${skill.name}`,
                skill.trigger ? `When to use: ${skill.trigger}` : '',
                skill.description ? `Description: ${skill.description}` : '',
                skill.body?.trim() || '',
              ]
                .filter(Boolean)
                .join('\n\n'),
            ),
          ].join('\n\n')
        : '';
    })(plannedSkills, allSkills),
    projectHint = buildActiveProjectHint(activeProject, 'runtime'),
    workspaceHint = buildWorkspaceHint(workspaceSummary, 'runtime'),
    workspaceFilePolicyHint = buildWorkspaceFilePolicyHint(workspacePath),
    conversationSummaryBlock = buildConversationSummaryBlock(
      conversationSummary,
      conversationSummaryMessageCount,
    ),
    toolDiscoveryBlock = [
      '## Tool Discovery',
      'Your current toolset is filtered for relevance. Additional specialized categories are available.',
      "If the user's request requires capabilities not in your current tools (GitHub, GitLab, Weather, Finance, Google services, etc.), call `request_tool_categories` with the specific categories you need BEFORE responding.",
      'You can request multiple categories in one call (e.g. categories="github,finance").',
      'NEVER tell the user you cannot do something because you lack tools — always try loading the right category first.',
    ].join('\n'),
    parallelCallingBlock = [
      '## Parallel Tool Calling',
      "When your current step requires multiple tools that DO NOT depend on each other's output, call them ALL in a single response.",
      'This executes them in parallel and saves significant time.',
      "Only call tools sequentially when a later tool needs an earlier tool's result as input.",
      'Example: Looking up weather AND crypto price → call both at once.',
      'Counter-example: Search for a file, THEN read its contents → must be sequential.',
    ].join('\n'),
    basePrompt = [
      systemPrompt,
      toolPrivacyBlock,
      [
        '## Agentic workflow',
        'Treat non-trivial requests as an iterative loop: understand the goal → gather facts with tools when needed → act (edit, run checks, browse, delegate) → verify if appropriate → then answer the user.',
        'After each tool result, briefly decide what is still unknown or unfinished. If more data or another action is required before a correct answer, call the next tool instead of replying early.',
        'If a tool fails or returns something unexpected, adapt: try a narrower follow-up, a different tool, or explain the blocker and the best next step for the user.',
        'When a CALL PLAN appears below, treat it as suggested ordering, not a cage: extend, skip, or reorder steps when new information requires it.',
        'Do not stop at the first partial success when the user asked for an end-to-end outcome (e.g. fix + verify, research + summary, multi-file change).',
        'When the task is genuinely complete, answer in clear natural language without exposing internal mechanics.',
      ].join('\n'),
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
          return isBrowserConfirmationPromptText(messages[index]?.content);
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
          'CALL PLAN (guidance — follow this order when sensible, but add, skip, or reorder steps if results show a better path):',
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
  for (let turn = 0; turn < 100; turn++) {
    const forceFinalAnswer = turn >= 99,
      toolsThisTurn = forceFinalAnswer ? [] : availableTools,
      allPlannedToolsDone =
        !plannedToolCalls?.length || executedToolCount >= plannedToolCalls.length,
      sysPromptThisTurn = `${forceFinalAnswer || allPlannedToolsDone ? basePrompt : sysPromptWithPlan}${forceFinalAnswer ? ['', '## Final turn', 'No further tools are available this round. Using the conversation and any prior tool results, write the most complete, accurate answer you can.', 'If something is still unknown, state what is missing and what the user can do next. Do not mention tools or internal steps.'].join('\n') : ''}`;
    let result = null,
      lastErr = null,
      streamingStarted = !1,
      bufferedReply = '';
    const onToken = (chunk) => {
        chunk && ((streamingStarted = !0), (bufferedReply += chunk), live.stream?.(chunk));
      },
      onReasoning = (chunk) => {
        chunk && live.streamThinking?.(chunk);
      };
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
            signal,
          )),
            (usedProvider = provider),
            (usedModel = modelId));
          break;
        } catch (err) {
          if (((lastErr = err), 'AbortError' === err.name)) throw err;
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
      if (result) break;
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
        if (((rewriteAttempts += 1), rewriteAttempts > 5)) {
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
            content: [
              'Your last draft exposed internal execution details or was only meta (e.g. admitting tool use with no substance).',
              'Rewrite for the user now.',
              'Rules:',
              '- Start directly with the useful answer, findings, or explanation — not with "I used", "I called", or any tool name.',
              '- Do not quote lines that begin with "Internal execution context" or "Tool result for".',
              '- Omit raw [TERMINAL:...] markers; the UI already shows terminal output when relevant.',
              '- If more work is needed, say what is missing in plain language without naming tools.',
            ].join('\n'),
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
              const confirmationPrompt = buildBrowserConfirmationPrompt();
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
      const llmToolResult = postProcessToolResult(name, toolResult, success, live),
        totalPlanned = plannedToolCalls?.length ?? 0;
      executedToolCount += 1;
      const remainingPlanned = totalPlanned > 0 ? Math.max(0, totalPlanned - executedToolCount) : 0,
        browserResultInstruction = buildBrowserResultInstruction(toolMeta, llmToolResult);
      loopMessages.push({
        role: 'user',
        content: buildToolResultContext(
          name,
          llmToolResult,
          success,
          remainingPlanned,
          browserResultInstruction,
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
        const confirmationPrompt = buildBrowserConfirmationPrompt();
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
            const llmResult = postProcessToolResult(call.name, s.value, !0, live);
            return {
              name: call.name,
              result: llmResult,
              success: !0,
              toolMeta: toolMeta,
              browserInstruction: buildBrowserResultInstruction(toolMeta, llmResult),
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
        content: buildMultiToolResultContext(resultEntries, remainingPlanned),
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
