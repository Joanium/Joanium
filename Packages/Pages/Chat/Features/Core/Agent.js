import { state } from '../../../../System/State.js';
import { fetchWithTools, fetchStreamingWithTools } from '../../../../Features/AI/index.js';
import { buildToolsPrompt, getAvailableTools } from '../Capabilities/Registry/Tools.js';
import { executeTool } from '../Capabilities/Registry/Executors.js';

// Only treat as a leak when the model is *only* meta (or echoes our hidden user blocks).
// Do NOT use "I used … tool" + .*$ — that flags every normal answer that opens with that phrase.
const INTERNAL_TOOL_LEAK_PATTERNS = [
  /^\s*I\s+(?:used|called|ran|invoked)\s+(?:the\s+)?[A-Za-z0-9_.\-\s/]+\s+tool\b[\s.,;:!?\u2026]*$/i,
  /^\s*Tool result for\b/i,
  /^\s*Internal execution context for the assistant only\b/i,
];

const BROWSER_TOOL_HINTS = [
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
];

const HIGH_RISK_BROWSER_TERMS = [
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
];

const BROWSER_CONFIRMATION_SENTINEL = 'Potentially irreversible website action pending.';
const RATE_LIMIT_BACKOFF_MS = [5000, 10000, 15000];
const SUB_AGENT_TOOL_NAME = 'spawn_sub_agents';
const SEARCH_ENGINE_BLOCK_PATTERNS = [
  /google\.com\/sorry/i,
  /\bunusual traffic\b/i,
  /\brecaptcha\b/i,
  /\bi am not a robot\b/i,
  /\bi'm not a robot\b/i,
];

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
  err.name = 'AbortError';
  return err;
}

async function waitWithAbort(delayMs, signal = null) {
  if (!delayMs) return;
  if (!signal) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return;
  }

  if (signal.aborted) throw createAbortError();

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, delayMs);

    const onAbort = () => {
      cleanup();
      reject(createAbortError());
    };

    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
    };

    signal.addEventListener('abort', onAbort, { once: true });
  });
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
  };
}

export function buildFailoverCandidates(
  selectedProvider,
  selectedModel,
  providers = state.providers,
  fallbackModels = [],
) {
  if (!selectedProvider || !selectedModel) return [];
  const candidates = [];

  if (fallbackModels.length) {
    const seen = new Set();
    for (const fallback of fallbackModels) {
      const provider = providers.find((item) => item.provider === fallback?.provider);
      const modelId = fallback?.modelId;
      if (!provider || !modelId) continue;
      const key = `${provider.provider}::${modelId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({
        provider,
        modelId,
        note: `Falling back to ${provider.label ?? provider.provider} - ${getModelDisplayName(provider, modelId)}...`,
      });
    }
    return candidates;
  }

  const sameProviderModels = Object.entries(selectedProvider.models ?? {})
    .filter(([id]) => id !== selectedModel)
    .sort(([, a], [, b]) => (a.rank ?? 999) - (b.rank ?? 999));

  for (const [modelId, info] of sameProviderModels) {
    candidates.push({
      provider: selectedProvider,
      modelId,
      note: `Trying ${info.name ?? modelId}...`,
    });
  }

  const otherBests = providers
    .filter((provider) => provider.provider !== selectedProvider.provider)
    .map((provider) => {
      const entries = Object.entries(provider.models ?? {}).sort(
        ([, a], [, b]) => (a.rank ?? 999) - (b.rank ?? 999),
      );
      if (!entries.length) return null;
      const [bestId, bestInfo] = entries[0];
      return { provider, modelId: bestId, rank: bestInfo.rank ?? 999 };
    })
    .filter(Boolean)
    .sort((a, b) => a.rank - b.rank);

  for (const { provider, modelId } of otherBests) {
    const name = provider.models?.[modelId]?.name ?? modelId;
    candidates.push({
      provider,
      modelId,
      note: `Falling back to ${provider.label ?? provider.provider} - ${name}...`,
    });
  }

  return candidates;
}

async function loadEnabledSkills() {
  try {
    const res = await window.electronAPI?.invoke?.('get-skills');
    return (res?.skills ?? []).filter((skill) => skill.enabled === true);
  } catch {
    return [];
  }
}

async function loadWorkspaceSummary() {
  if (!state.workspacePath) return null;
  try {
    const res = await window.electronAPI?.invoke?.('inspect-workspace', {
      rootPath: state.workspacePath,
    });
    return res?.ok ? res.summary : null;
  } catch {
    return null;
  }
}

function buildActiveProjectHint(mode = 'runtime') {
  if (!state.activeProject) return '';

  const lines = [
    '[ACTIVE PROJECT]',
    `Name: ${state.activeProject.name}`,
    `Workspace: ${state.activeProject.rootPath}`,
  ];

  if (state.activeProject.context) {
    lines.push('Project info to keep in mind:');
    lines.push(state.activeProject.context);
  }

  if (mode === 'planning') {
    lines.push(
      'Treat this project folder as the default workspace for file, code, and terminal requests.',
    );
  } else {
    lines.push(
      'This project is currently open. Treat this workspace as the default directory unless the user asks for another one.',
    );
  }

  return lines.join('\n');
}

function buildSkillsCatalogue(skills) {
  if (!skills.length) return '  (none)';
  return skills
    .map(
      (skill) =>
        `  - "${skill.name}": ${skill.trigger?.trim() || skill.description?.trim() || 'general assistant skill'}`,
    )
    .join('\n');
}

function buildSelectedSkillsBlock(selectedSkillNames, skills) {
  const selected = skills.filter((skill) => selectedSkillNames.includes(skill.name));
  if (!selected.length) return '';

  return [
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
  ].join('\n\n');
}

function buildWorkspaceHint(summary, mode = 'runtime') {
  if (!summary) return '';

  const lines = ['[USER WORKSPACE]', `Path: ${summary.path}`];

  if (summary.languages?.length) lines.push(`Languages: ${summary.languages.join(', ')}`);
  if (summary.frameworks?.length) lines.push(`Frameworks: ${summary.frameworks.join(', ')}`);
  if (summary.testing?.length) lines.push(`Testing: ${summary.testing.join(', ')}`);
  if (summary.infra?.length) lines.push(`Infra: ${summary.infra.join(', ')}`);
  if (summary.packageManager) lines.push(`Package manager: ${summary.packageManager}`);

  const scriptEntries = Object.entries(summary.packageScripts ?? {}).slice(0, 12);
  if (scriptEntries.length) {
    lines.push('Scripts:');
    lines.push(...scriptEntries.map(([name, value]) => `- ${name}: ${value}`));
  }

  if (summary.ciWorkflows?.length) {
    lines.push(`CI workflows: ${summary.ciWorkflows.join(', ')}`);
  }

  if (summary.dockerFiles?.length) {
    lines.push(`Docker files: ${summary.dockerFiles.join(', ')}`);
  }

  if (summary.notes?.length) {
    lines.push('Notes:');
    lines.push(...summary.notes.map((note) => `- ${note}`));
  }

  if (mode === 'planning') {
    lines.push(
      'For coding, QA, or DevOps requests, strongly prefer inspect_workspace, search_workspace, extract_file_text, read_file_chunk, read_multiple_local_files, list_directory_tree, replace_lines_in_file, insert_into_file, git_status, git_diff, run_project_checks, and GitHub/MCP tools over guessing.',
    );
  } else {
    lines.push(
      'When the user asks you to code, debug, test, review, or deploy, use the local workspace tools and stay inside this directory unless the user says otherwise.',
    );
    lines.push(
      'Prefer inspect_workspace, search_workspace, extract_file_text, read_file_chunk, read_multiple_local_files, list_directory_tree, replace_lines_in_file, insert_into_file, copy_item, move_item, git_status, git_diff, run_project_checks, and apply_file_patch before falling back to raw shell commands.',
    );
    lines.push(
      'Use assess_shell_command before risky shell work. Only set allow_risky=true when the user explicitly requested the risky action.',
    );
    lines.push(
      'Use start_local_server for long-running dev servers or watchers instead of run_shell_command. If the tool succeeds, read the embedded terminal output (or run a quick check) before claiming the URL works — the tool fails if the process exits during startup (e.g. EADDRINUSE).',
    );
  }

  return lines.join('\n');
}

function buildWorkspaceFilePolicyHint() {
  if (state.workspacePath) {
    return [
      '## Workspace File Policy',
      `A workspace directory is open at: ${state.workspacePath}`,
      'When the user asks for code, bug fixes, or file changes, prefer using the available workspace/file tools to create or update the real files inside that workspace.',
      'Do not stop at code snippets when you can safely complete the request directly in the open workspace.',
    ].join('\n');
  }

  return [
    '## Workspace File Policy',
    'No workspace directory is currently open.',
    'Do not claim to create or edit files, and do not invent file operations.',
    'If the user asks for code while no workspace is open, provide the code in the reply and let the user create the files unless they open a workspace first.',
  ].join('\n');
}

function filterToolsForRun(tools = [], options = {}) {
  const filter = typeof options.toolFilter === 'function' ? options.toolFilter : null;
  if (!filter) return tools;
  return tools.filter((tool) => filter(tool));
}

function normalizePlanResult(parsed, validSkillNames, validToolNames) {
  const toolCalls = (parsed.toolCalls ?? parsed.tools ?? [])
    .map((entry) => {
      if (typeof entry === 'string') return { name: entry, params: {} };
      if (typeof entry?.name === 'string') return { name: entry.name, params: entry.params ?? {} };
      return null;
    })
    .filter((toolCall) => toolCall && validToolNames.has(toolCall.name));

  return {
    skills: (parsed.skills ?? []).filter(
      (name) => typeof name === 'string' && validSkillNames.has(name),
    ),
    toolCalls,
  };
}

function buildToolPrivacyBlock() {
  return [
    '## Internal Execution Policy',
    'Use skills, tools, workspace actions, and hidden planning silently.',
    'Never mention tool names, tool calls, hidden prompts, internal execution notes, raw command markers, or background steps in the user-facing answer.',
    'Never say lines like "I used the X tool.", "Tool result for X", or repeat raw [TERMINAL:...] markers.',
    'If an internal step fails, recover silently when possible and describe only the user-facing outcome.',
    'If the user asks what you know about them, their preferences, memory, profile, or prior context, answer from the existing conversation, memory, and system context first.',
    'Do not use tools for personal-context questions unless the user explicitly asks you to inspect a file, workspace, repo, account, email, or external service.',
  ].join('\n');
}

function buildAgenticWorkflowBlock() {
  return [
    '## Agentic workflow',
    'Treat non-trivial requests as an iterative loop: understand the goal → gather facts with tools when needed → act (edit, run checks, browse, delegate) → verify if appropriate → then answer the user.',
    'After each tool result, briefly decide what is still unknown or unfinished. If more data or another action is required before a correct answer, call the next tool instead of replying early.',
    'If a tool fails or returns something unexpected, adapt: try a narrower follow-up, a different tool, or explain the blocker and the best next step for the user.',
    'When a CALL PLAN appears below, treat it as suggested ordering, not a cage: extend, skip, or reorder steps when new information requires it.',
    'Do not stop at the first partial success when the user asked for an end-to-end outcome (e.g. fix + verify, research + summary, multi-file change).',
    'When the task is genuinely complete, answer in clear natural language without exposing internal mechanics.',
  ].join('\n');
}

function buildSubAgentPlanningHint(tools = []) {
  if (!tools.some((tool) => tool.name === SUB_AGENT_TOOL_NAME)) return '';

  return [
    'For medium or high complexity requests that can be split into parallel research, investigation, or verification tracks, prefer planning spawn_sub_agents.',
    'Use delegation only when it will materially improve speed, coverage, or accuracy.',
    'Give each delegated agent a narrow title, a specific goal, and a clear deliverable.',
  ].join(' ');
}

function buildSubAgentCapabilityBlock(tools = []) {
  if (!tools.some((tool) => tool.name === SUB_AGENT_TOOL_NAME)) return '';

  return [
    '## Delegation',
    'If the task is medium or high complexity and can be decomposed into parallel workstreams, you may call spawn_sub_agents.',
    'Use delegated agents for focused investigation, verification, and analysis when that will improve speed or coverage.',
    'Give each sub-agent a clear title, a narrow goal, and a concrete deliverable.',
    'Reserve the final synthesis, user communication, and any write actions for yourself.',
    'Avoid delegation for trivial or tightly serial tasks.',
  ].join('\n');
}

function stringifyForAnalysis(value) {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value ?? '');
  }
}

function looksLikeBrowserAutomationTool(tool = {}) {
  if (tool.source !== 'mcp') return false;

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

function buildBrowserPlanningHint(browserTools = []) {
  if (!browserTools.length) return '';

  return [
    'Browser-control MCP tools are connected right now.',
    'If the user needs live website work such as browsing, navigation, ticket lookup, reservations, form filling, or account actions, plan those browser tools before guessing from static knowledge.',
    'Do not plan a final purchase, booking confirmation, reservation submit, or payment action unless the user has explicitly confirmed that exact irreversible step in the current conversation.',
  ].join('\n');
}

function buildBrowserAutomationBlock(browserTools = []) {
  if (!browserTools.length) return '';

  const listedTools = browserTools
    .slice(0, 12)
    .map((tool) => `- ${tool.name}: ${tool.description || 'MCP browser tool'}`)
    .join('\n');

  return [
    '## Browser Automation',
    'Connected MCP browser tools are available for live website work.',
    'Use them when the user needs real-time browsing, ticket availability checks, reservations, form filling, or other website navigation.',
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

function looksLikeBrowserConfirmationReply(text) {
  const normalized = String(text ?? '')
    .trim()
    .toLowerCase();
  if (!normalized) return false;

  return [
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
  ].some((phrase) => normalized === phrase || normalized.includes(phrase));
}

function hasPendingBrowserApproval(messages = []) {
  let lastUserIndex = -1;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') {
      lastUserIndex = index;
      break;
    }
  }

  if (lastUserIndex < 1) return false;
  if (!looksLikeBrowserConfirmationReply(messages[lastUserIndex]?.content)) return false;

  for (let index = lastUserIndex - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'assistant') {
      return isBrowserConfirmationPromptText(messages[index]?.content);
    }
  }

  return false;
}

function isPotentiallyIrreversibleBrowserAction(tool, params) {
  if (!looksLikeBrowserAutomationTool(tool)) return false;

  const haystack = [tool.name, tool.description, stringifyForAnalysis(params)]
    .join(' ')
    .toLowerCase();

  if (HIGH_RISK_BROWSER_TERMS.some((term) => haystack.includes(term))) return true;

  const hasSubmitWord = /\b(submit|confirm|complete|reserve|book)\b/.test(haystack);
  const hasCommerceWord = /\b(ticket|booking|reservation|checkout|order|payment|purchase)\b/.test(
    haystack,
  );
  return hasSubmitWord && hasCommerceWord;
}

function stringifyToolResult(toolResult) {
  if (typeof toolResult === 'string') return toolResult;
  try {
    return JSON.stringify(toolResult, null, 2);
  } catch {
    return String(toolResult);
  }
}

function looksLikeInternalToolLeak(text) {
  const value = String(text ?? '').trim();
  if (!value) return false;
  return INTERNAL_TOOL_LEAK_PATTERNS.some((pattern) => pattern.test(value));
}

/** Raw [TERMINAL:pid] is rendered in the UI; answers may cite it without being a leak. */
function stripTerminalMountMarkers(text) {
  return String(text ?? '')
    .replace(/\[TERMINAL:[^\]]+\]/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function tryRecoverLeakyAssistantReply(text) {
  const withoutTerminal = stripTerminalMountMarkers(text);
  if (withoutTerminal.length >= 32 && !looksLikeInternalToolLeak(withoutTerminal)) {
    return withoutTerminal;
  }
  return null;
}

function normalizeToolLogText(value, maxLength = 120) {
  const text = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

const TOOLS_WITH_COMMAND_LOG = new Set([
  'run_shell_command',
  'assess_shell_command',
  'start_local_server',
]);

function summarizeToolLogCommandDetail(toolName, params) {
  if (!params || typeof params !== 'object') return '';
  if (!TOOLS_WITH_COMMAND_LOG.has(toolName)) return '';
  const cmd = String(params.command ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return normalizeToolLogText(cmd, 220);
}

/** Visible log line after the `[TOOL] ` prefix (used for success + failure rows). */
function buildToolLogVisiblePart(name, params = null) {
  const n = String(name ?? '').trim() || 'unknown_tool';
  const detail = summarizeToolLogCommandDetail(n, params);
  return detail ? `${n} : ${detail}` : n;
}

function buildToolLogLabel(name, params = null) {
  return `[TOOL] ${buildToolLogVisiblePart(name, params)}`;
}

function buildToolFailureLabel(name, err, params = null) {
  const message = normalizeToolLogText(err?.message ?? 'Unknown error');
  const vis = buildToolLogVisiblePart(name, params);
  return `${vis} failed${message ? `: ${message}` : ''}`;
}

function hasSearchEngineBlocker(toolResult) {
  const text = stringifyToolResult(toolResult);
  return SEARCH_ENGINE_BLOCK_PATTERNS.some((pattern) => pattern.test(text));
}

function buildBrowserResultInstruction(toolMeta = null, toolResult = '') {
  if (!looksLikeBrowserAutomationTool(toolMeta)) return '';

  if (hasSearchEngineBlocker(toolResult)) {
    return [
      'The current page is a search-engine CAPTCHA or unusual-traffic blocker page.',
      'Do not pretend the browsing task succeeded.',
      'If the destination site is obvious from the user request, navigate there directly or use that site search instead of the search engine.',
      'If the blocker still prevents progress, tell the user exactly that the search-engine route is blocked.',
    ].join(' ');
  }

  return [
    'For browser work, only describe the page that is explicitly confirmed in the Result block below.',
    'If the Result block does not clearly confirm the current URL, title, or visible text, call browser_get_state or browser_snapshot before answering the user.',
  ].join(' ');
}

function buildSubAgentResultSummary(run = {}) {
  const agents = Array.isArray(run?.agents) ? run.agents : [];
  const completed = agents.filter((agent) => agent?.status === 'completed').length;
  const errored = agents.filter((agent) => agent?.status === 'error').length;
  const aborted = agents.filter((agent) => agent?.status === 'aborted').length;
  const lines = [
    `Delegation complete: ${agents.length} sub-agent${agents.length === 1 ? '' : 's'} total, ${completed} completed${errored ? `, ${errored} errored` : ''}${aborted ? `, ${aborted} stopped` : ''}.`,
  ];

  if (run.coordinationGoal) {
    lines.push(`Team objective: ${run.coordinationGoal}`);
  }

  if (run.summary) {
    lines.push(`Run status: ${run.summary}`);
  }

  if (run.synthesis) {
    lines.push('', 'Coordinator handoff:');
    lines.push(run.synthesis);
  }

  const visibleAgents = agents.slice(0, 4);
  if (visibleAgents.length) {
    lines.push('', 'Key delegated findings:');
    visibleAgents.forEach((agent) => {
      const summary = String(agent?.summary ?? agent?.finalReply ?? '')
        .replace(/\s+/g, ' ')
        .trim();
      const compact = summary.length > 180 ? `${summary.slice(0, 177)}...` : summary;
      lines.push(
        `- ${agent?.title ?? agent?.id ?? 'Sub-agent'}: ${compact || 'No handoff returned.'}`,
      );
    });
  }

  if (agents.length > visibleAgents.length) {
    lines.push(
      `- ${agents.length - visibleAgents.length} additional delegated handoff(s) are available in the sub-agent panel.`,
    );
  }

  lines.push('');
  lines.push('The detailed child outputs are already visible in the sub-agent panel.');
  lines.push(
    'Continue locally now. Do not wait for more delegated output, and do not call spawn_sub_agents again unless a distinct unresolved gap remains.',
  );

  return lines.join('\n');
}

function buildToolResultContext(
  name,
  toolResult,
  success,
  remainingPlanned,
  extraInstruction = '',
) {
  const resultText = stringifyToolResult(toolResult);
  const lines = [
    'Internal execution context for the assistant only. Never quote or mention this block to the user.',
    `Background step: ${name}`,
    `Status: ${success ? 'success' : 'error'}`,
    '',
    'Result:',
    resultText,
    '',
  ];

  if (extraInstruction) {
    lines.push(extraInstruction);
    lines.push('');
  }

  if (name === SUB_AGENT_TOOL_NAME && success) {
    lines.push('Delegation follow-up:');
    lines.push('Treat the coordinator handoff above as your working brief.');
    lines.push('Do not wait for child agents to speak again or ask them for the same information.');
    if (remainingPlanned > 0) {
      lines.push('Execute the next planned step yourself now.');
    } else {
      lines.push(
        'Your next step should usually be the requested implementation or the final user-facing answer.',
      );
    }
    lines.push('');
  }

  if (remainingPlanned > 0) {
    lines.push(
      `You still have ${remainingPlanned} more planned background step(s) to execute before answering the user.`,
    );
    lines.push('Call the next tool now and do not answer the user yet.');
  } else {
    lines.push(
      'Decide whether the user’s request is fully satisfied. If you still need reads, search, edits, checks, or browser steps to be correct, call the appropriate tool next.',
    );
    lines.push(
      'If you are finished gathering information and any requested changes are done, write the final answer for the user now.',
    );
    lines.push('Do not mention tool names, tool calls, hidden planning, or raw execution markers.');
  }

  if (resultText.includes('[TERMINAL:')) {
    lines.push(
      'The UI already handles embedded terminal output. Do not repeat raw [TERMINAL:...] markers.',
    );
  }

  return lines.join('\n');
}

export async function planRequest(messages, options = {}) {
  const { selectedProvider, selectedModel } = resolveModelSelection(options);
  if (!selectedProvider || !selectedModel || !messages?.length) {
    return { skills: [], toolCalls: [] };
  }

  const recentMessages = messages
    .slice(-12)
    .map((m) => {
      return `${m.role.toUpperCase()}: ${m.content}`;
    })
    .join('\n\n');

  const [skills, availableTools, workspaceSummary] = await Promise.all([
    loadEnabledSkills(),
    getAvailableTools(),
    loadWorkspaceSummary(),
  ]);
  const browserTools = getBrowserAutomationTools(availableTools);
  const browserPlanningHint = buildBrowserPlanningHint(browserTools);
  const subAgentPlanningHint = buildSubAgentPlanningHint(availableTools);
  const workspaceFilePolicyHint = buildWorkspaceFilePolicyHint();

  const planPrompt = [
    'You are a planning assistant for an AI agent.',
    'Read the user request and decide which skills and tools are needed.',
    'Return exact tool calls, in order, with concrete parameters.',
    'Always read the revelant skills first before responding to the user.',
    'If the same tool must be called multiple times with different parameters, list each call separately.',
    'For multi-step work, order toolCalls so dependencies run first (e.g. search or read before edit; inspect before broad changes). List every distinct step you expect; the agent may add or adjust steps later.',
    'If the user is asking what you know about them, their preferences, memory, profile, or prior context, do not plan tools unless they explicitly ask you to inspect a file, workspace, repo, account, email, or external service.',
    '',
    'Recent conversation:',
    recentMessages,
    state.activeProject ? `\n${buildActiveProjectHint('planning')}` : '',
    workspaceSummary ? `\n${buildWorkspaceHint(workspaceSummary, 'planning')}` : '',
    `\n${workspaceFilePolicyHint}`,
    browserPlanningHint ? `\n${browserPlanningHint}` : '',
    subAgentPlanningHint ? `\n${subAgentPlanningHint}` : '',
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
    );

    if (result.type !== 'text') return { skills: [], toolCalls: [] };

    const start = result.text.indexOf('{');
    const end = result.text.lastIndexOf('}');
    if (start === -1 || end === -1) return { skills: [], toolCalls: [] };

    const parsed = JSON.parse(result.text.slice(start, end + 1));
    return normalizePlanResult(
      parsed,
      new Set(skills.map((skill) => skill.name)),
      new Set(availableTools.map((tool) => tool.name)),
    );
  } catch (err) {
    console.warn('[Agent] Planning failed:', err.message);
    return { skills: [], toolCalls: [] };
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
  const { selectedProvider, selectedModel, providers, fallbackModels } =
    resolveModelSelection(options);
  const loopMessages = [...messages];
  const MAX_TURNS = 100;
  const MAX_REWRITE_ATTEMPTS = 5;
  let executedToolCount = 0;
  let rewriteAttempts = 0;
  const totalUsage = { inputTokens: 0, outputTokens: 0 };

  const [rawAvailableTools, allSkills, workspaceSummary] = await Promise.all([
    getAvailableTools(),
    loadEnabledSkills(),
    loadWorkspaceSummary(),
  ]);
  const availableTools = filterToolsForRun(rawAvailableTools, options);

  const toolPrivacyBlock = buildToolPrivacyBlock();
  const subAgentCapabilityBlock = buildSubAgentCapabilityBlock(availableTools);
  const browserAutomationBlock = buildBrowserAutomationBlock(
    getBrowserAutomationTools(availableTools),
  );
  const selectedSkillBlock = buildSelectedSkillsBlock(plannedSkills, allSkills);
  const projectHint = buildActiveProjectHint('runtime');
  const workspaceHint = buildWorkspaceHint(workspaceSummary, 'runtime');
  const workspaceFilePolicyHint = buildWorkspaceFilePolicyHint();
  const basePrompt = [
    systemPrompt,
    toolPrivacyBlock,
    buildAgenticWorkflowBlock(),
    subAgentCapabilityBlock,
    browserAutomationBlock,
    selectedSkillBlock,
    projectHint,
    workspaceHint,
    workspaceFilePolicyHint,
  ]
    .filter(Boolean)
    .join('\n\n');
  const toolMetaByName = new Map(availableTools.map((tool) => [tool.name, tool]));
  let browserApprovalAvailable = hasPendingBrowserApproval(loopMessages);

  const candidates = [
    { provider: selectedProvider, modelId: selectedModel, note: null },
    ...buildFailoverCandidates(selectedProvider, selectedModel, providers, fallbackModels),
  ].filter((candidate) => candidate.provider && candidate.modelId);

  let usedProvider = selectedProvider;
  let usedModel = selectedModel;

  const callPlanHint = plannedToolCalls?.length
    ? [
        'CALL PLAN (guidance — follow this order when sensible, but add, skip, or reorder steps if results show a better path):',
        ...plannedToolCalls.map((toolCall, index) => {
          const params = Object.entries(toolCall.params ?? {})
            .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
            .join(', ');
          return `${index + 1}. ${toolCall.name}(${params})`;
        }),
      ].join('\n')
    : '';

  const sysPromptWithPlan = [basePrompt, callPlanHint].filter(Boolean).join('\n\n');

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const forceFinalAnswer = turn >= MAX_TURNS - 1;
    const toolsThisTurn = forceFinalAnswer ? [] : availableTools;
    const allPlannedToolsDone =
      !plannedToolCalls?.length || executedToolCount >= plannedToolCalls.length;
    const planPromptThisTurn =
      forceFinalAnswer || allPlannedToolsDone ? basePrompt : sysPromptWithPlan;
    const finalTurnBlock = forceFinalAnswer
      ? [
          '',
          '## Final turn',
          'No further tools are available this round. Using the conversation and any prior tool results, write the most complete, accurate answer you can.',
          'If something is still unknown, state what is missing and what the user can do next. Do not mention tools or internal steps.',
        ].join('\n')
      : '';
    const sysPromptThisTurn = `${planPromptThisTurn}${finalTurnBlock}`;

    let result = null;
    let lastErr = null;
    let streamingStarted = false;
    let bufferedReply = '';

    const onToken = (chunk) => {
      streamingStarted = true;
      bufferedReply += chunk;
    };

    const onReasoning = (chunk) => {
      if (!chunk) return;
      live.streamThinking?.(chunk);
    };

    for (const [candidateIndex, { provider, modelId, note }] of candidates.entries()) {
      if (note) live.push(note);
      const modelName = getModelDisplayName(provider, modelId);

      for (let attempt = 0; attempt <= RATE_LIMIT_BACKOFF_MS.length; attempt += 1) {
        streamingStarted = false;
        bufferedReply = '';

        try {
          result = await fetchStreamingWithTools(
            provider,
            modelId,
            loopMessages,
            sysPromptThisTurn,
            toolsThisTurn,
            onToken,
            onReasoning,
            signal,
          );

          usedProvider = provider;
          usedModel = modelId;
          break;
        } catch (err) {
          lastErr = err;
          if (err.name === 'AbortError') throw err;

          if (streamingStarted) {
            live.push(`Stream error: ${err.message.slice(0, 60)}`);
            break;
          }

          const hasMoreCandidates = candidateIndex < candidates.length - 1;
          const rateLimited = isRateLimitError(err);

          if (rateLimited && attempt < RATE_LIMIT_BACKOFF_MS.length) {
            const delayMs = RATE_LIMIT_BACKOFF_MS[attempt];
            live.push(
              `HTTP 429 on ${modelName} - waiting ${Math.round(delayMs / 1000)}s before retrying...`,
            );
            await waitWithAbort(delayMs, signal);
            continue;
          }

          if (rateLimited) {
            live.push(
              hasMoreCandidates
                ? `HTTP 429 kept happening on ${modelName} - trying the next model...`
                : `HTTP 429 kept happening on ${modelName} after multiple retries.`,
            );
          } else {
            live.push(
              hasMoreCandidates
                ? `${err.message.slice(0, 55)} - trying fallback...`
                : `${err.message.slice(0, 55)}`,
            );
          }
          break;
        }
      }

      if (result) break;
    }

    if (!result) {
      const message = `API error: ${lastErr?.message ?? 'Unknown error'}`;
      live.set(message);
      return { text: message, usage: totalUsage, usedProvider, usedModel };
    }

    if (result.usage) {
      totalUsage.inputTokens += result.usage.inputTokens ?? 0;
      totalUsage.outputTokens += result.usage.outputTokens ?? 0;
    }

    if (result.type === 'text') {
      const finalText = String(bufferedReply || result.text || '').trim() || '(empty response)';

      if (looksLikeInternalToolLeak(finalText)) {
        rewriteAttempts += 1;

        if (rewriteAttempts > MAX_REWRITE_ATTEMPTS) {
          const recovered = tryRecoverLeakyAssistantReply(finalText);
          if (recovered) {
            live.finalize(recovered, result.usage, usedProvider, usedModel);
            return { text: recovered, usage: totalUsage, usedProvider, usedModel };
          }
          const fallback =
            'I ran into an internal formatting issue while preparing the answer. Please try again.';
          live.finalize(fallback, result.usage, usedProvider, usedModel);
          return { text: fallback, usage: totalUsage, usedProvider, usedModel };
        }

        live.push('Polishing the reply…');
        loopMessages.push({
          role: 'assistant',
          content: finalText,
          attachments: [],
        });
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
        });
        continue;
      }

      live.finalize(finalText, result.usage, usedProvider, usedModel);
      return { text: finalText, usage: totalUsage, usedProvider, usedModel };
    }

    if (result.type === 'tool_call') {
      const { name, params } = result;
      const logHandle = live.push(buildToolLogLabel(name, params));
      const toolMeta = toolMetaByName.get(name) ?? null;

      let toolResult;
      let success = true;

      try {
        if (isPotentiallyIrreversibleBrowserAction(toolMeta, params)) {
          if (browserApprovalAvailable) {
            browserApprovalAvailable = false;
          } else {
            const confirmationPrompt = buildBrowserConfirmationPrompt();
            live.finalize(confirmationPrompt, result.usage, usedProvider, usedModel);
            return { text: confirmationPrompt, usage: totalUsage, usedProvider, usedModel };
          }
        }

        const executionHooks = live.getToolExecutionHooks?.(name);
        toolResult = await executeTool(name, params, {
          ...(typeof executionHooks === 'function'
            ? { onStage: executionHooks }
            : executionHooks && typeof executionHooks === 'object'
              ? executionHooks
              : {}),
          signal,
        });
      } catch (err) {
        success = false;
        toolResult = `Error: ${err.message}`;
        if (logHandle?.done) logHandle.done(false, buildToolFailureLabel(name, err, params));
      }

      if (success && logHandle?.done) logHandle.done(true);

      // Rich photo gallery rendering
      let llmToolResult = toolResult;
      if (typeof toolResult === 'string' && toolResult.startsWith('[PHOTO_RESULT]')) {
        try {
          const parsed = JSON.parse(toolResult.slice('[PHOTO_RESULT]'.length));
          live.showPhotoGallery?.(parsed);
          // Give LLM a clean text summary instead of raw JSON
          const count = parsed.photos?.length ?? 0;
          const names = (parsed.photos ?? [])
            .slice(0, 3)
            .map((p) => `${p.photographer} — "${p.description?.slice(0, 60)}"`)
            .join('; ');
          llmToolResult = `Found ${count} photos on Unsplash for "${parsed.query}" (${parsed.total?.toLocaleString() ?? '?'} total available). Top results: ${names}. A visual gallery has already been displayed to the user in the chat.`;
        } catch {
          // fallback: treat as plain text
        }
      } else if (typeof toolResult === 'string' && toolResult.startsWith('[SUBAGENT_RESULT]')) {
        try {
          const parsed = JSON.parse(toolResult.slice('[SUBAGENT_RESULT]'.length));
          llmToolResult = buildSubAgentResultSummary(parsed);
        } catch {
          llmToolResult =
            'Delegated sub-agent run completed, but the handoff payload could not be parsed cleanly.';
        }
      } else if (typeof toolResult === 'string' && toolResult.includes('[TERMINAL:')) {
        live.showToolOutput?.(toolResult);
        if (success && name === 'start_local_server') {
          llmToolResult = `${toolResult}\n\nConfirm from the terminal output that the server is listening before telling the user to open a preview URL; bind failures such as EADDRINUSE can appear after compile finishes.`;
        }
      }

      const totalPlanned = plannedToolCalls?.length ?? 0;
      executedToolCount += 1;
      const remainingPlanned = totalPlanned > 0 ? Math.max(0, totalPlanned - executedToolCount) : 0;
      const browserResultInstruction = buildBrowserResultInstruction(toolMeta, llmToolResult);

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
  }

  const exhausted =
    'I reached the maximum number of tool rounds for this reply. If you still need more work, send a short follow-up (for example what to continue or verify) and I can pick up from there.';
  live.set(exhausted);
  return { text: exhausted, usage: totalUsage, usedProvider, usedModel };
}
