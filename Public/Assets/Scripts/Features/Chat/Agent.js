// Romelson — Public/Assets/Scripts/Features/Chat/Agent.js
// Owns planning, failover, and the multi-step tool execution loop.

import { state } from '../../Shared/State.js';
import { fetchWithTools, fetchStreamingWithTools, withRetry } from '../AI/AIProvider.js';
import { buildToolsPrompt, getAvailableTools } from './Tools/Index.js';
import { executeTool } from './Executors/Index.js';

export function buildFailoverCandidates(selectedProvider, selectedModel) {
  if (!selectedProvider || !selectedModel) return [];
  const candidates = [];

  const sameProviderModels = Object.entries(selectedProvider.models ?? {})
    .filter(([id]) => id !== selectedModel)
    .sort(([, a], [, b]) => (a.rank ?? 999) - (b.rank ?? 999));

  for (const [modelId, info] of sameProviderModels) {
    candidates.push({
      provider: selectedProvider,
      modelId,
      note: `Trying ${info.name ?? modelId}…`,
    });
  }

  const otherBests = state.providers
    .filter(provider => provider.provider !== selectedProvider.provider)
    .map(provider => {
      const entries = Object.entries(provider.models ?? {})
        .sort(([, a], [, b]) => (a.rank ?? 999) - (b.rank ?? 999));
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
      note: `Falling back to ${provider.label ?? provider.provider} — ${name}…`,
    });
  }

  return candidates;
}

async function loadEnabledSkills() {
  try {
    const res = await window.electronAPI?.getSkills?.();
    return (res?.skills ?? []).filter(skill => skill.enabled === true);
  } catch {
    return [];
  }
}

async function loadWorkspaceSummary() {
  if (!state.workspacePath) return null;
  try {
    const res = await window.electronAPI?.inspectWorkspace?.({ rootPath: state.workspacePath });
    return res?.ok ? res.summary : null;
  } catch {
    return null;
  }
}

function buildSkillsCatalogue(skills) {
  if (!skills.length) return '  (none)';
  return skills.map(skill =>
    `  - "${skill.name}": ${skill.trigger?.trim() || skill.description?.trim() || 'general assistant skill'}`,
  ).join('\n');
}

function buildSelectedSkillsBlock(selectedSkillNames, skills) {
  const selected = skills.filter(skill => selectedSkillNames.includes(skill.name));
  if (!selected.length) return '';

  return [
    '## Selected Skills',
    'Apply the following skill docs for this specific request. Ignore non-selected skills unless the user explicitly asks for them.',
    '',
    ...selected.map(skill => [
      `### ${skill.name}`,
      skill.trigger ? `When to use: ${skill.trigger}` : '',
      skill.description ? `Description: ${skill.description}` : '',
      skill.body?.trim() || '',
    ].filter(Boolean).join('\n\n')),
  ].join('\n\n');
}

function buildWorkspaceHint(summary, mode = 'runtime') {
  if (!summary) return '';

  const lines = [
    '[USER WORKSPACE]',
    `Path: ${summary.path}`,
  ];

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
    lines.push(...summary.notes.map(note => `- ${note}`));
  }

  if (mode === 'planning') {
    lines.push('For coding, QA, or DevOps requests, strongly prefer inspect_workspace, search_workspace, read_file_chunk, git_status, git_diff, run_project_checks, and GitHub/MCP tools over guessing.');
  } else {
    lines.push('When the user asks you to code, debug, test, review, or deploy, use the local workspace tools and stay inside this directory unless the user says otherwise.');
    lines.push('Prefer inspect_workspace, search_workspace, read_file_chunk, git_status, git_diff, run_project_checks, and apply_file_patch before falling back to raw shell commands.');
    lines.push('Use assess_shell_command before risky shell work. Only set allow_risky=true when the user explicitly requested the risky action.');
    lines.push("Use start_local_server for long-running dev servers or watchers instead of run_shell_command.");
  }

  return lines.join('\n');
}

function normalizePlanResult(parsed, validSkillNames, validToolNames) {
  const toolCalls = (parsed.toolCalls ?? parsed.tools ?? [])
    .map(entry => {
      if (typeof entry === 'string') return { name: entry, params: {} };
      if (typeof entry?.name === 'string') return { name: entry.name, params: entry.params ?? {} };
      return null;
    })
    .filter(toolCall => toolCall && validToolNames.has(toolCall.name));

  return {
    skills: (parsed.skills ?? []).filter(name => typeof name === 'string' && validSkillNames.has(name)),
    toolCalls,
  };
}

export async function planRequest(userText) {
  if (!state.selectedProvider || !state.selectedModel || !userText?.trim()) {
    return { skills: [], toolCalls: [] };
  }

  const [skills, availableTools, workspaceSummary] = await Promise.all([
    loadEnabledSkills(),
    getAvailableTools(),
    loadWorkspaceSummary(),
  ]);

  const planPrompt = [
    'You are a planning assistant for an AI agent.',
    'Read the user request and decide which skills and tools are needed.',
    'Return exact tool calls, in order, with concrete parameters.',
    'If the same tool must be called multiple times with different parameters, list each call separately.',
    '',
    `User request: "${userText}"`,
    workspaceSummary ? `\n${buildWorkspaceHint(workspaceSummary, 'planning')}` : '',
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
      state.selectedProvider,
      state.selectedModel,
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
      new Set(skills.map(skill => skill.name)),
      new Set(availableTools.map(tool => tool.name)),
    );
  } catch (err) {
    console.warn('[Agent] Planning failed:', err.message);
    return { skills: [], toolCalls: [] };
  }
}

export async function agentLoop(messages, live, plannedSkills = [], plannedToolCalls = [], systemPrompt, signal = null) {
  const loopMessages = [...messages];
  const MAX_TURNS = 10;
  let toolsUsed = false;
  const totalUsage = { inputTokens: 0, outputTokens: 0 };

  const [availableTools, allSkills, workspaceSummary] = await Promise.all([
    getAvailableTools(),
    loadEnabledSkills(),
    loadWorkspaceSummary(),
  ]);

  const selectedSkillBlock = buildSelectedSkillsBlock(plannedSkills, allSkills);
  const workspaceHint = buildWorkspaceHint(workspaceSummary, 'runtime');
  const basePrompt = [systemPrompt, selectedSkillBlock, workspaceHint].filter(Boolean).join('\n\n');

  const candidates = [
    { provider: state.selectedProvider, modelId: state.selectedModel, note: null },
    ...buildFailoverCandidates(state.selectedProvider, state.selectedModel),
  ].filter(candidate => candidate.provider && candidate.modelId);

  let usedProvider = state.selectedProvider;
  let usedModel = state.selectedModel;

  const plannedToolNames = [...new Set((plannedToolCalls ?? []).map(toolCall => toolCall.name))];
  const filteredPlannedTools = plannedToolNames.length
    ? availableTools.filter(tool => plannedToolNames.includes(tool.name))
    : [];
  const plannedTools = filteredPlannedTools.length ? filteredPlannedTools : availableTools;

  const callPlanHint = plannedToolCalls?.length
    ? [
        'CALL PLAN — execute these tool calls in order before writing the final answer:',
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
    const toolsThisTurn = toolsUsed ? availableTools : (turn === 0 ? plannedTools : availableTools);
    const usedToolCount = loopMessages.filter(message =>
      message.role === 'assistant' && message.content.startsWith('I used the '),
    ).length;
    const allPlannedToolsDone = !plannedToolCalls?.length || usedToolCount >= plannedToolCalls.length;
    const sysPromptThisTurn = allPlannedToolsDone ? basePrompt : sysPromptWithPlan;

    let result = null;
    let lastErr = null;
    let streamingStarted = false;

    const onToken = chunk => {
      streamingStarted = true;
      live.stream(chunk);
    };

    for (const { provider, modelId, note } of candidates) {
      if (note) live.push(note);
      streamingStarted = false;

      try {
        result = await withRetry(async () => {
          if (streamingStarted) {
            const err = new Error('Stream interrupted after start — not retrying');
            err.noRetry = true;
            throw err;
          }
          return fetchStreamingWithTools(
            provider,
            modelId,
            loopMessages,
            sysPromptThisTurn,
            toolsThisTurn,
            onToken,
            signal,
          );
        }, 3, 600);

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
        live.push(`${err.message.slice(0, 55)} — trying fallback…`);
      }
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
      live.finalize(result.text, result.usage, usedProvider, usedModel);
      return { text: result.text, usage: totalUsage, usedProvider, usedModel };
    }

    if (result.type === 'tool_call') {
      const { name, params } = result;
      toolsUsed = true;
      const logHandle = live.push(`Calling ${name.replace(/_/g, ' ')}…`);

      let toolResult;
      let success = true;

      try {
        toolResult = await executeTool(name, params, message => {
          const subLog = live.push(message);
          if (subLog?.done) subLog.done(true);
        });
      } catch (err) {
        success = false;
        toolResult = `Error: ${err.message}`;
        const errLog = live.push(`Tool error: ${err.message}`);
        if (errLog?.done) errLog.done(false);
      }

      if (logHandle?.done) logHandle.done(success);

      if (typeof toolResult === 'string' && toolResult.includes('[TERMINAL:')) {
        live.showToolOutput?.(toolResult);
      }

      loopMessages.push({
        role: 'assistant',
        content: `I used the ${name} tool.`,
        attachments: [],
      });

      const calledSoFar = loopMessages.filter(message =>
        message.role === 'assistant' && message.content.startsWith('I used the '),
      ).length;
      const totalPlanned = plannedToolCalls?.length ?? 0;
      const moreToolsLeft = totalPlanned > 0 && calledSoFar < totalPlanned;

      let nextInstruction = '';
      if (moreToolsLeft) {
        nextInstruction = `You still have ${totalPlanned - calledSoFar} more planned tool call(s) to make before writing the final response. Call the next tool now and do not answer the user yet.`;
      } else {
        nextInstruction = 'Tool call complete. You may call another tool if needed. If you are finished using tools, write the final response using everything gathered above.';
      }
      if (typeof toolResult === 'string' && toolResult.includes('[TERMINAL:')) {
        nextInstruction += ' The embedded terminal is already visible to the user. Do not repeat raw [TERMINAL:...] markers.';
      }

      loopMessages.push({
        role: 'user',
        content: `Tool result for ${name}:\n${toolResult}\n\n${nextInstruction}`,
        attachments: [],
      });
    }
  }

  live.set('Done.');
  return { text: 'Done.', usage: totalUsage, usedProvider, usedModel };
}
