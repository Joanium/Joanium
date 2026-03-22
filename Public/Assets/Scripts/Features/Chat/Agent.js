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
   Returns an ordered list of { provider, modelId, note }
   to try when the primary model fails.

   Order:
     a) Same provider — other models sorted best→worst (lower rank = better)
     b) Other providers — best model from each, sorted by rank
══════════════════════════════════════════ */
export function buildFailoverCandidates(selectedProvider, selectedModel) {
  if (!selectedProvider || !selectedModel) return [];
  const candidates = [];

  // ── Same provider, other models ──────────────────────────────────────
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

  // ── Best model from every other provider ─────────────────────────────
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
   One AI call reads all available skills and
   tools and returns exactly:
     • which skill docs to surface in the log
     • which tool calls to make, WITH their params

   The AI decides — no regex, no hardcoded rules.
   Returns: { skills: string[], toolCalls: { name, params }[] }
══════════════════════════════════════════ */
export async function planRequest(userText) {
  if (!state.selectedProvider || !state.selectedModel || !userText?.trim()) {
    return { skills: [], toolCalls: [] };
  }

  // ── Load skill catalogue ──────────────────────────────────────────────
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

  // ── Build tool catalogue with required params ─────────────────────────
  const toolsCatalogue = TOOLS.length
    ? TOOLS.map(t => {
      const requiredParams = Object.entries(t.parameters ?? {})
        .filter(([, p]) => p.required)
        .map(([k, p]) => `${k} (${p.type}): ${p.description}`)
        .join(', ');
      return `  - "${t.name}": ${t.description}${requiredParams ? ` | Required: ${requiredParams}` : ''}`;
    }).join('\n')
    : '  (none)';

  // ── Planning prompt ───────────────────────────────────────────────────
  const planPrompt = [
    'You are a planning assistant for an AI agent.',
    'Read the user request. Decide which skills and tools are needed,',
    'AND what exact parameters each tool call requires.',
    'If the same tool needs to be called multiple times with different params',
    '(e.g. get_fred_data for GDP and again for UNRATE), list each call separately.',
    '',
    `User request: "${userText}"`,
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

    // Extract JSON by brace positions — no regex
    const start = result.text.indexOf('{');
    const end = result.text.lastIndexOf('}');
    if (start === -1 || end === -1) return { skills: [], toolCalls: [] };

    const parsed = JSON.parse(result.text.slice(start, end + 1));

    const validSkillNames = new Set(skills.map(s => s.name));
    const validToolNames = new Set(TOOLS.map(t => t.name));

    // Support both {name, params} objects and bare name strings
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
   Streams the response with:
     • Retry (up to 3× on transient errors)
     • Model failover (same-provider first, then cross-provider)
     • Tool execution with result injection
     • Call plan injected into system prompt on turn 0

   Parameters:
     messages        — full conversation history
     live            — live bubble controller from Chat.js (push/stream/finalize/set)
     plannedToolCalls — [{name, params}] from planRequest
     systemPrompt    — base system prompt from state

   Returns: { text, usage, usedProvider, usedModel }
══════════════════════════════════════════ */
export async function agentLoop(messages, live, plannedToolCalls, systemPrompt) {
  const loopMessages = [...messages];
  const MAX_TURNS = 10;
  let toolsUsed = false;
  const totalUsage = { inputTokens: 0, outputTokens: 0 };

  // ── Candidate model list ──────────────────────────────────────────────
  const candidates = [
    { provider: state.selectedProvider, modelId: state.selectedModel, note: null },
    ...buildFailoverCandidates(state.selectedProvider, state.selectedModel),
  ].filter(c => c.provider && c.modelId);

  let usedProvider = state.selectedProvider;
  let usedModel = state.selectedModel;

  // ── Tool subsets ──────────────────────────────────────────────────────
  // Turn 0: only the tools the planner asked for (focused, avoids distractions)
  // Turn 1+: all tools (AI can chain freely after first tool use)
  const plannedToolNames = [...new Set((plannedToolCalls ?? []).map(tc => tc.name))];
  const plannedTools = plannedToolNames.length
    ? TOOLS.filter(t => plannedToolNames.includes(t.name))
    : TOOLS;

  // ── Call plan hint injected into system prompt on turn 0 ─────────────
  // Tells the model exactly what to call and with what args,
  // eliminating "missing required param" errors.
  const callPlanHint = plannedToolCalls?.length
    ? '\n\nCALL PLAN — execute these tool calls in order:\n' +
    plannedToolCalls.map((tc, i) => {
      const paramsStr = Object.entries(tc.params ?? {})
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ');
      return `${i + 1}. ${tc.name}(${paramsStr})`;
    }).join('\n')
    : '';

  const sysPromptWithPlan = systemPrompt + callPlanHint;

  // ── Main loop ─────────────────────────────────────────────────────────
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const toolsThisTurn = toolsUsed ? TOOLS : (turn === 0 ? plannedTools : TOOLS);

    // Keep the call plan in the system prompt for EVERY turn until all planned
    // tools have been called. Without this the AI loses context of what to call
    // next and just says "not available" instead of executing remaining tools.
    const calledCount = loopMessages.filter(m => m.role === 'assistant' && m.content.startsWith('I used the')).length;
    const allToolsDone = !plannedToolCalls?.length || calledCount >= plannedToolCalls.length;
    const sysPromptThisTurn = allToolsDone ? systemPrompt : sysPromptWithPlan;
    let result = null;
    let lastErr = null;
    let streamingStarted = false;

    const onToken = (chunk) => {
      streamingStarted = true;
      live.stream(chunk);
    };

    // Try each candidate in order
    for (const { provider, modelId, note } of candidates) {
      if (!provider || !modelId) continue;
      if (note) live.push(note);
      streamingStarted = false;

      try {
        result = await withRetry(async () => {
          // Once streaming has started, do NOT retry — would duplicate visible tokens
          if (streamingStarted) {
            const e = new Error('Stream interrupted after start — not retrying');
            e.noRetry = true;
            throw e;
          }
          return fetchStreamingWithTools(
            provider, modelId, loopMessages, sysPromptThisTurn, toolsThisTurn, onToken,
          );
        }, 3, 600);

        usedProvider = provider;
        usedModel = modelId;
        break; // success — stop trying candidates

      } catch (err) {
        lastErr = err;
        if (streamingStarted) {
          live.push(`Stream error: ${err.message.slice(0, 60)}`);
          break; // partial stream already visible — don't try another model
        }
        live.push(`${err.message.slice(0, 55)} — trying fallback…`);
      }
    }

    // All candidates exhausted with no result
    if (!result) {
      const msg = `API error: ${lastErr?.message ?? 'Unknown error'}`;
      live.set(msg);
      return { text: msg, usage: totalUsage, usedProvider, usedModel };
    }

    // Accumulate usage across all turns
    if (result.usage) {
      totalUsage.inputTokens += result.usage.inputTokens ?? 0;
      totalUsage.outputTokens += result.usage.outputTokens ?? 0;
    }

    // ── Text response → done ─────────────────────────────────────────
    if (result.type === 'text') {
      live.finalize(result.text, result.usage, usedProvider, usedModel);
      return { text: result.text, usage: totalUsage, usedProvider, usedModel };
    }

    // ── Tool call → execute, inject result, loop ─────────────────────
    if (result.type === 'tool_call') {
      const { name, params } = result;
      toolsUsed = true;
      live.push(`Calling ${name.replace(/_/g, ' ')}…`);

      let toolResult;
      try {
        toolResult = await executeTool(name, params, msg => live.push(msg));
      } catch (err) {
        toolResult = `Error: ${err.message}`;
        live.push(`Tool error: ${err.message}`);
      }

      loopMessages.push({
        role: 'assistant',
        content: `I used the ${name} tool.`,
        attachments: [],
      });

      // How many planned tools are still outstanding?
      const calledSoFar = loopMessages.filter(m => m.role === 'assistant' && m.content.startsWith('I used the')).length;
      const totalPlanned = plannedToolCalls?.length ?? 0;
      const moreToolsLeft = totalPlanned > 0 && calledSoFar < totalPlanned;
      // Note: sysPromptThisTurn will automatically include the call plan
      // on the next turn because calledCount is re-evaluated at the top of the loop.

      loopMessages.push({
        role: 'user',
        content: moreToolsLeft
          // Still have planned tools to run — tell the AI to keep going
          ? `Tool result for ${name}:\n${toolResult}\n\n` +
          `You still have ${totalPlanned - calledSoFar} more tool call(s) to make before writing the final response. ` +
          `Call the next tool now. Do not write a response yet.`
          // All tools done — synthesize using persona/tone from the system prompt
          : `Tool result for ${name}:\n${toolResult}\n\n` +
          `All tool calls are complete. Now write your response to the user incorporating ALL the data gathered above. No raw JSON or code blocks.`,
        attachments: [],
      });
    }
  }

  // MAX_TURNS reached
  live.set('Done.');
  return { text: 'Done.', usage: totalUsage, usedProvider, usedModel };
}
