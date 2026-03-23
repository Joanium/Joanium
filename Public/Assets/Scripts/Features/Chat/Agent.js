// ─────────────────────────────────────────────
//  openworld — Public/Assets/Scripts/Features/Chat/Agent.js
//
//  This is the single file you edit to change agent behaviour.
//  It owns three things:
//
//    1. buildFailoverCandidates  — which models to try and in what order
//    2. planRequest              — the AI planning step (skills + tool params)
//    3. agentLoop                — the streaming execution loop with retry
//
//  Chat.js imports and calls these; it never contains agent logic itself.
// ─────────────────────────────────────────────

import { state } from '../../Shared/State.js';
import { fetchWithTools, fetchStreamingWithTools, withRetry } from '../AI/AIProvider.js';
import { TOOLS } from './Tools/Index.js';
import { executeTool } from './Executors/Index.js';

/* ══════════════════════════════════════════
   1. FAILOVER CANDIDATES
══════════════════════════════════════════ */
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
    .filter(p => p.provider !== selectedProvider.provider)
    .map(p => {
      const entries = Object.entries(p.models ?? {})
        .sort(([, a], [, b]) => (a.rank ?? 999) - (b.rank ?? 999));
      if (!entries.length) return null;
      const [bestId, bestInfo] = entries[0];
      return { provider: p, modelId: bestId, rank: bestInfo.rank ?? 999 };
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

/* ══════════════════════════════════════════
   2. PLANNING STEP
══════════════════════════════════════════ */
export async function planRequest(userText) {
  if (!state.selectedProvider || !state.selectedModel || !userText?.trim()) {
    return { skills: [], toolCalls: [] };
  }

  let skills = [];
  try {
    const res = await window.electronAPI?.getSkills?.();
    skills = (res?.skills ?? []).filter(s => s.enabled === true);
  } catch { /* non-fatal */ }

  const skillsCatalogue = skills.length
    ? skills.map(s =>
      `  - "${s.name}": ${s.trigger?.trim() || s.description?.trim() || 'general assistant skill'}`
    ).join('\n')
    : '  (none)';

  const toolsCatalogue = TOOLS.length
    ? TOOLS.map(t => {
      const requiredParams = Object.entries(t.parameters ?? {})
        .filter(([, p]) => p.required)
        .map(([k, p]) => `${k} (${p.type}): ${p.description}`)
        .join(', ');
      return `  - "${t.name}": ${t.description}${requiredParams ? ` | Required: ${requiredParams}` : ''}`;
    }).join('\n')
    : '  (none)';

  let dirContext = '';
  if (state.workspacePath) {
    try {
      const dirRes = await window.electronAPI?.listDirectory?.({ dirPath: state.workspacePath });
      if (dirRes?.ok && dirRes.entries) {
        dirContext = '\nCurrent Folder Contents:\n' + dirRes.entries.map(e => `- ${e.name} (${e.type})`).join('\n');
      }
    } catch(e) {}
  }

  const planPrompt = [
    'You are a planning assistant for an AI agent.',
    'Read the user request. Decide which skills and tools are needed,',
    'AND what exact parameters each tool call requires.',
    'If the same tool needs to be called multiple times with different params',
    '(e.g. get_fred_data for GDP and again for UNRATE), list each call separately.',
    '',
    `User request: "${userText}"`,
    state.workspacePath ? `\n[IMPORTANT WORKSPACE CONTEXT]\nThe user has opened a local folder: ${state.workspacePath}${dirContext}\nYou MUST use tools (write_file, run_shell_command) to build and deploy exactly as requested inside this folder. You are FULLY AUTONOMOUS. Do not ask for permission, just plan the tool calls.` : '',
    '',
    'Available skills (reference docs injected into agent context):',
    skillsCatalogue,
    '',
    'Available tools (live-data functions, with required parameters):',
    toolsCatalogue,
    '',
    'Output ONLY a JSON object — no markdown, no prose, no explanation.',
    'Format:',
    '{',
    '  "skills": ["exact skill name", ...],',
    '  "toolCalls": [',
    '    {"name": "exact_tool_name", "params": {"param1": "value1", ...}},',
    '    ...',
    '  ]',
    '}',
    'Use empty arrays when nothing is needed.',
  ].join('\n');

  try {
    const result = await fetchWithTools(
      state.selectedProvider,
      state.selectedModel,
      [{ role: 'user', content: planPrompt, attachments: [] }],
      'You are a planning assistant. Output ONLY valid JSON, nothing else.',
      [],
    );

    if (result.type !== 'text') return { skills: [], toolCalls: [] };

    const start = result.text.indexOf('{');
    const end = result.text.lastIndexOf('}');
    if (start === -1 || end === -1) return { skills: [], toolCalls: [] };

    const parsed = JSON.parse(result.text.slice(start, end + 1));

    const validSkillNames = new Set(skills.map(s => s.name));
    const validToolNames = new Set(TOOLS.map(t => t.name));

    const toolCalls = (parsed.toolCalls ?? parsed.tools ?? [])
      .map(entry => {
        if (typeof entry === 'string') return { name: entry, params: {} };
        if (typeof entry?.name === 'string') return { name: entry.name, params: entry.params ?? {} };
        return null;
      })
      .filter(tc => tc && validToolNames.has(tc.name));

    return {
      skills: (parsed.skills ?? []).filter(n => typeof n === 'string' && validSkillNames.has(n)),
      toolCalls,
    };
  } catch (err) {
    console.warn('[Agent] Planning failed:', err.message);
    return { skills: [], toolCalls: [] };
  }
}

/* ══════════════════════════════════════════
   3. AGENTIC LOOP
   signal param wires AbortController from Chat.js
   through to fetchStreamingWithTools so the user
   can cancel mid-stream via the stop button.
══════════════════════════════════════════ */
export async function agentLoop(messages, live, plannedToolCalls, systemPrompt, signal = null) {
  const loopMessages = [...messages];
  const MAX_TURNS = 10;
  let toolsUsed = false;
  const totalUsage = { inputTokens: 0, outputTokens: 0 };

  const candidates = [
    { provider: state.selectedProvider, modelId: state.selectedModel, note: null },
    ...buildFailoverCandidates(state.selectedProvider, state.selectedModel),
  ].filter(c => c.provider && c.modelId);

  let usedProvider = state.selectedProvider;
  let usedModel = state.selectedModel;

  const plannedToolNames = [...new Set((plannedToolCalls ?? []).map(tc => tc.name))];
  const plannedTools = plannedToolNames.length
    ? TOOLS.filter(t => plannedToolNames.includes(t.name))
    : TOOLS;

  const callPlanHint = plannedToolCalls?.length
    ? '\n\nCALL PLAN — execute these tool calls in order:\n' +
    plannedToolCalls.map((tc, i) => {
      const paramsStr = Object.entries(tc.params ?? {})
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ');
      return `${i + 1}. ${tc.name}(${paramsStr})`;
    }).join('\n')
    : '';

  let workspaceHint = '';
  if (state.workspacePath) {
    let dirDetails = '';
    try {
      const res = await window.electronAPI?.listDirectory?.({ dirPath: state.workspacePath });
      if (res?.ok && res.entries) {
        dirDetails = '\n\nCurrent Folder Contents:\n' + res.entries.map(e => `- ${e.name} (${e.type})`).join('\n');
      }
    } catch(e) {}
    workspaceHint = `\n\n[USER WORKSPACE]\nThe user has explicitly opened the following local workspace directory: ${state.workspacePath}${dirDetails}\nWhen the user asks you to create files, build an app, or run commands, you MUST execute them inside this directory using your tools (e.g. write_file, run_shell_command, start_local_server). You are a FULLY AUTONOMOUS agent. DO NOT ask for permission. ALWAYS use the tools to write the code to disk. CRITICAL: To start a server or UI, YOU MUST use the 'start_local_server' tool. NEVER use 'run_shell_command' with tools like "start cmd" or open external windows. Servers must be embedded using start_local_server.`;
  }

  const basePromptWithWorkspace = systemPrompt + workspaceHint;
  const sysPromptWithPlan = basePromptWithWorkspace + callPlanHint;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const toolsThisTurn = TOOLS;

    const calledCount = loopMessages.filter(m => m.role === 'assistant' && m.content.startsWith('I used the')).length;
    const allToolsDone = !plannedToolCalls?.length || calledCount >= plannedToolCalls.length;
    const sysPromptThisTurn = allToolsDone ? basePromptWithWorkspace : sysPromptWithPlan;
    let result = null;
    let lastErr = null;
    let streamingStarted = false;

    const onToken = (chunk) => {
      streamingStarted = true;
      live.stream(chunk);
    };

    for (const { provider, modelId, note } of candidates) {
      if (!provider || !modelId) continue;
      if (note) live.push(note);
      streamingStarted = false;

      try {
        result = await withRetry(async () => {
          if (streamingStarted) {
            const e = new Error('Stream interrupted after start — not retrying');
            e.noRetry = true;
            throw e;
          }
          return fetchStreamingWithTools(
            provider, modelId, loopMessages, sysPromptThisTurn, toolsThisTurn, onToken, signal,
          );
        }, 3, 600);

        usedProvider = provider;
        usedModel = modelId;
        break;

      } catch (err) {
        lastErr = err;
        // Propagate abort immediately — don't try fallbacks
        if (err.name === 'AbortError') throw err;
        if (streamingStarted) {
          live.push(`Stream error: ${err.message.slice(0, 60)}`);
          break;
        }
        live.push(`${err.message.slice(0, 55)} — trying fallback…`);
      }
    }

    if (!result) {
      const msg = `API error: ${lastErr?.message ?? 'Unknown error'}`;
      live.set(msg);
      return { text: msg, usage: totalUsage, usedProvider, usedModel };
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
        toolResult = await executeTool(name, params, msg => {
          const subLog = live.push(msg);
          // If the tool emits intermediate logs, mark them as checked too
          if (subLog && subLog.done) subLog.done(true);
        });
      } catch (err) {
        success = false;
        toolResult = `Error: ${err.message}`;
        const errLog = live.push(`Tool error: ${err.message}`);
        if (errLog && errLog.done) errLog.done(false);
      }

      if (logHandle && logHandle.done) logHandle.done(success);

      loopMessages.push({
        role: 'assistant',
        content: `I used the ${name} tool.`,
        attachments: [],
      });

      const calledSoFar = loopMessages.filter(m => m.role === 'assistant' && m.content.startsWith('I used the')).length;
      const totalPlanned = plannedToolCalls?.length ?? 0;
      const moreToolsLeft = totalPlanned > 0 && calledSoFar < totalPlanned;

      let nextInstruction = '';
      if (moreToolsLeft) {
        nextInstruction = `You still have ${totalPlanned - calledSoFar} more planned tool call(s) to make before writing the final response. Call the next tool now. Do not write a response yet.`;
      } else {
        nextInstruction = `Tool call complete. You may call another tool if needed to complete the user's request. If you are finished using tools, write your final response to the user incorporating ALL the data gathered above. No raw JSON or raw code blocks unless requested.`;
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
