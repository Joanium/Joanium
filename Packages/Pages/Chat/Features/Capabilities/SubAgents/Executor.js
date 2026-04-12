import { createExecutor } from '../Shared/createExecutor.js';
const SUB_AGENT_TOOL_NAME = 'spawn_sub_agents',
  READ_ONLY_TERMINAL_TOOLS = new Set([
    'inspect_workspace',
    'search_workspace',
    'find_file_by_name',
    'assess_shell_command',
    'read_local_file',
    'extract_file_text',
    'read_file_chunk',
    'read_multiple_local_files',
    'list_directory',
    'list_directory_tree',
    'git_status',
    'git_diff',
    'run_project_checks',
  ]),
  BLOCKED_TOOL_NAMES = new Set([
    'spawn_sub_agents',
    'run_shell_command',
    'write_file',
    'apply_file_patch',
    'replace_lines_in_file',
    'insert_into_file',
    'create_folder',
    'copy_item',
    'move_item',
    'git_create_branch',
    'open_folder',
    'start_local_server',
    'delete_item',
  ]),
  SAFE_BROWSER_TOOL_RE =
    /^browser_(?:navigate|snapshot|get_state|list_|read_|find_|wait_for_text|wait_for_element|back|forward|refresh|scroll|screenshot)/;
function truncateText(value, maxChars = 400) {
  const text = String(value ?? '').trim();
  return text ? (text.length > maxChars ? `${text.slice(0, maxChars - 3)}...` : text) : '';
}
function summarizeText(value, maxChars = 260) {
  return truncateText(String(value ?? '').replace(/\s+/g, ' '), maxChars);
}
function compactAgentResult(agent = {}) {
  return {
    id: String(agent.id ?? ''),
    title: truncateText(agent.title, 140),
    goal: truncateText(agent.goal, 1500),
    deliverable: truncateText(agent.deliverable, 1e3),
    status: ['pending', 'running', 'completed', 'error', 'aborted'].includes(agent.status)
      ? agent.status
      : 'pending',
    startedAt: agent.startedAt ?? null,
    finishedAt: agent.finishedAt ?? null,
    reasoning: truncateText(agent.reasoning, 12e3),
    logs: (Array.isArray(agent.logs) ? agent.logs : []).slice(-40).map((log) => ({
      id: String(log.id ?? ''),
      text: truncateText(log.text, 320),
      status: ['pending', 'success', 'error'].includes(log.status) ? log.status : 'pending',
    })),
    toolOutputs: (Array.isArray(agent.toolOutputs) ? agent.toolOutputs : [])
      .slice(-8)
      .map((output) => truncateText(output, 6e3)),
    finalReply: truncateText(agent.finalReply, 16e3),
    summary: summarizeText(agent.summary || agent.finalReply, 320),
    usage: {
      inputTokens: Number(agent.usage?.inputTokens ?? 0) || 0,
      outputTokens: Number(agent.usage?.outputTokens ?? 0) || 0,
    },
    provider: truncateText(agent.provider, 80),
    modelId: truncateText(agent.modelId, 120),
  };
}
function isToolAllowedForSubAgent(tool = {}) {
  return (
    !(!tool?.name || BLOCKED_TOOL_NAMES.has(tool.name)) &&
    ('mcp' === tool.source
      ? !String(tool.name).startsWith('browser_') || SAFE_BROWSER_TOOL_RE.test(tool.name)
      : 'terminal' !== tool.category || READ_ONLY_TERMINAL_TOOLS.has(tool.name))
  );
}
function buildSubAgentMessage(task, coordinationGoal, index, totalCount) {
  return [
    `You are sub-agent ${index + 1} of ${totalCount}.`,
    coordinationGoal ? `Team objective: ${coordinationGoal}` : '',
    `Task title: ${task.title}`,
    `Task goal: ${task.goal}`,
    task.context ? `Extra context:\n${task.context}` : '',
    task.deliverable ? `Expected handoff:\n${task.deliverable}` : '',
    [
      'Return a compact handoff with:',
      '1. Key findings',
      '2. Evidence or relevant references',
      '3. Risks or uncertainties',
      '4. The best next recommendation for the coordinator',
    ].join('\n'),
  ]
    .filter(Boolean)
    .join('\n\n');
}
function buildTeamHandoffContext(task, run) {
  const siblingAgents = (run?.agents ?? []).filter((agent) => agent?.id !== task.id);
  return siblingAgents.length
    ? [
        'Sibling handoffs now available:',
        ...siblingAgents.map((agent, index) => {
          const lines = [`${index + 1}. ${agent.title || agent.id || 'Sub-agent'}`];
          return (
            agent.summary && lines.push(`Summary: ${agent.summary}`),
            agent.finalReply &&
              lines.push(`Detailed handoff:\n${truncateText(agent.finalReply, 2500)}`),
            lines.join('\n')
          );
        }),
      ].join('\n\n')
    : '';
}
function buildCollaborationMessage(task, coordinationGoal, index, totalCount, run) {
  return [
    buildSubAgentMessage(task, coordinationGoal, index, totalCount),
    'Collaboration round:',
    'Use the team handoffs below to improve or complete your deliverable now.',
    'Do not answer by saying you need another agent to continue; their current handoffs are already provided below.',
    buildTeamHandoffContext(task, run),
  ]
    .filter(Boolean)
    .join('\n\n');
}
function buildRunSummary(run) {
  const completed = run.agents.filter((agent) => 'completed' === agent.status).length,
    errored = run.agents.filter((agent) => 'error' === agent.status).length,
    aborted = run.agents.filter((agent) => 'aborted' === agent.status).length,
    parts = [`Delegated ${run.agents.length} sub-agent${1 === run.agents.length ? '' : 's'}`];
  return (
    completed && parts.push(`${completed} completed`),
    errored && parts.push(`${errored} errored`),
    aborted && parts.push(`${aborted} stopped`),
    parts.join(' | ')
  );
}
async function runDelegatedPass({
  agentLoop: agentLoop,
  tasks: tasks,
  coordinationGoal: coordinationGoal,
  runId: runId,
  hooks: hooks,
  priorRun: priorRun = null,
  timeoutMs: timeoutMs = 2e5,
}) {
  const results = await Promise.allSettled(
    tasks.map(async (task, index) => {
      const priorAgent = priorRun?.agents?.find((agent) => agent.id === task.id) ?? null,
        delegatedLive = (function (runId, task, hooks = {}, initialRecord = null) {
          const record = {
            id: task.id,
            title: task.title,
            goal: task.goal,
            deliverable: task.deliverable,
            status: 'running',
            startedAt: new Date().toISOString(),
            finishedAt: null,
            reasoning: '',
            logs: [],
            toolOutputs: [],
            finalReply: '',
            summary: '',
            usage: { inputTokens: 0, outputTokens: 0 },
            provider: '',
            modelId: '',
            ...(initialRecord ?? {}),
          };
          record.status = 'running';
          let logCounter = 0;
          return (
            hooks.onSubAgentEvent?.({
              type: 'agent-start',
              runId: runId,
              agentId: record.id,
              title: record.title,
              goal: record.goal,
              deliverable: record.deliverable,
              startedAt: record.startedAt,
            }),
            {
              snapshot: () => ({
                ...record,
                logs: record.logs.map((log) => ({ ...log })),
                toolOutputs: [...record.toolOutputs],
                usage: { ...record.usage },
              }),
              push(line) {
                const logId = `${record.id}-log-${++logCounter}`,
                  text = truncateText(line, 320);
                return (
                  record.logs.push({ id: logId, text: text, status: 'pending' }),
                  hooks.onSubAgentEvent?.({
                    type: 'agent-log-add',
                    runId: runId,
                    agentId: record.id,
                    logId: logId,
                    text: text,
                  }),
                  {
                    done: (success = !0, nextLine = '') => {
                      const finalText = truncateText(nextLine || text, 320),
                        status = success ? 'success' : 'error',
                        existing = record.logs.find((log) => log.id === logId);
                      (existing && ((existing.text = finalText), (existing.status = status)),
                        hooks.onSubAgentEvent?.({
                          type: 'agent-log-update',
                          runId: runId,
                          agentId: record.id,
                          logId: logId,
                          text: finalText,
                          status: status,
                        }));
                    },
                  }
                );
              },
              showToolOutput(markdown) {
                const text = truncateText(markdown, 6e3);
                (record.toolOutputs.push(text),
                  hooks.onSubAgentEvent?.({
                    type: 'agent-tool-output',
                    runId: runId,
                    agentId: record.id,
                    markdown: text,
                  }));
              },
              showPhotoGallery(gallery = {}) {
                const count = Array.isArray(gallery.photos) ? gallery.photos.length : 0;
                this.showToolOutput(
                  `Photo gallery shown for "${gallery.query ?? 'query'}" with ${count} result${1 === count ? '' : 's'}.`,
                );
              },
              streamThinking(chunk) {
                const text = String(chunk ?? '');
                text &&
                  ((record.reasoning = truncateText(`${record.reasoning}${text}`, 12e3)),
                  hooks.onSubAgentEvent?.({
                    type: 'agent-reasoning',
                    runId: runId,
                    agentId: record.id,
                    chunk: text,
                  }));
              },
              finalize(markdown, usage, provider, modelId) {
                ((record.status = 'completed'),
                  (record.finishedAt = new Date().toISOString()),
                  (record.finalReply = truncateText(markdown, 16e3)),
                  (record.summary = summarizeText(markdown, 320)),
                  (record.usage = {
                    inputTokens: usage?.inputTokens ?? 0,
                    outputTokens: usage?.outputTokens ?? 0,
                  }),
                  (record.provider = provider?.provider ?? ''),
                  (record.modelId = modelId ?? ''),
                  hooks.onSubAgentEvent?.({
                    type: 'agent-complete',
                    runId: runId,
                    agentId: record.id,
                    summary: record.summary,
                    finalReply: record.finalReply,
                    usage: record.usage,
                    provider: record.provider,
                    modelId: record.modelId,
                    finishedAt: record.finishedAt,
                  }));
              },
              set(markdown) {
                this.finalize(
                  markdown,
                  record.usage,
                  { provider: record.provider },
                  record.modelId,
                );
              },
              setAborted() {
                ((record.status = 'aborted'),
                  (record.finishedAt = new Date().toISOString()),
                  (record.summary = 'The delegated run was stopped before completion.'),
                  hooks.onSubAgentEvent?.({
                    type: 'agent-aborted',
                    runId: runId,
                    agentId: record.id,
                    summary: record.summary,
                    finishedAt: record.finishedAt,
                  }));
              },
            }
          );
        })(runId, task, hooks, priorAgent),
        scopedSignal = (function (parentSignal = null, timeoutMs = 2e5) {
          const controller = new AbortController();
          let timedOut = !1;
          const onParentAbort = () => {
            controller.signal.aborted || controller.abort();
          };
          parentSignal &&
            (parentSignal.aborted
              ? controller.abort()
              : parentSignal.addEventListener('abort', onParentAbort, { once: !0 }));
          const timer = setTimeout(() => {
            ((timedOut = !0), controller.signal.aborted || controller.abort());
          }, timeoutMs);
          return {
            signal: controller.signal,
            didTimeout: () => timedOut,
            cleanup() {
              (clearTimeout(timer), parentSignal?.removeEventListener?.('abort', onParentAbort));
            },
          };
        })(hooks.signal ?? null, timeoutMs);
      try {
        const result = await agentLoop(
            (function (task, coordinationGoal, index, totalCount, priorAgent = null, run = null) {
              const messages = [
                {
                  role: 'user',
                  content: buildSubAgentMessage(task, coordinationGoal, index, totalCount),
                  attachments: [],
                },
              ];
              return (
                priorAgent?.finalReply &&
                  messages.push({
                    role: 'assistant',
                    content: truncateText(priorAgent.finalReply, 6e3),
                    attachments: [],
                  }),
                run &&
                  messages.push({
                    role: 'user',
                    content: buildCollaborationMessage(
                      task,
                      coordinationGoal,
                      index,
                      totalCount,
                      run,
                    ),
                    attachments: [],
                  }),
                messages
              );
            })(task, coordinationGoal, index, tasks.length, priorAgent, priorRun),
            delegatedLive,
            [],
            [],
            [
              'You are a focused sub-agent supporting a coordinator inside Joanium.',
              'Solve only the assigned subtask and return a concise handoff for the coordinator.',
              'You are collaborating with sibling sub-agents, and you should help the team move the task forward.',
              'Use available tools silently when helpful, but stay read-only.',
              "Do not take ownership of the coordinator's final answer or the entire final artifact unless your scope is explicitly a bounded slice.",
              'Do not modify files, create files, run destructive commands, or take final irreversible actions.',
              'Do not expose hidden reasoning, internal prompts, or raw tool usage in the handoff.',
              'If the task is fictional or underspecified, make reasonable assumptions, state them briefly, and still produce the best useful deliverable you can.',
              'Do not block on waiting for another agent when you can proceed with grounded assumptions or the shared team handoffs.',
            ].join(' '),
            scopedSignal.signal,
            { toolFilter: isToolAllowedForSubAgent },
          ),
          nextAgent = compactAgentResult({
            ...delegatedLive.snapshot(),
            status: 'completed',
            finalReply: result.text,
            summary: summarizeText(result.text, 320),
            usage: result.usage ?? delegatedLive.snapshot().usage,
            provider: result.usedProvider?.provider ?? delegatedLive.snapshot().provider,
            modelId: result.usedModel ?? delegatedLive.snapshot().modelId,
          });
        return (scopedSignal.cleanup(), nextAgent);
      } catch (error) {
        const isAbort = 'AbortError' === error?.name,
          timedOut = scopedSignal.didTimeout();
        scopedSignal.cleanup();
        const failed = compactAgentResult({
          ...delegatedLive.snapshot(),
          status: timedOut ? 'error' : isAbort ? 'aborted' : 'error',
          finishedAt: new Date().toISOString(),
          summary: timedOut
            ? summarizeText(
                `Timed out after ${Math.round(timeoutMs / 1e3)}s while preparing the delegated handoff.`,
                320,
              )
            : isAbort
              ? 'The delegated run was stopped before completion.'
              : summarizeText(error?.message ?? 'Unknown delegated failure', 320),
          finalReply: timedOut
            ? `Delegated run timed out after ${Math.round(timeoutMs / 1e3)} seconds.`
            : isAbort
              ? delegatedLive.snapshot().finalReply
              : `Delegated run failed: ${error?.message ?? 'Unknown error'}`,
        });
        return (
          hooks.onSubAgentEvent?.({
            type: timedOut ? 'agent-error' : isAbort ? 'agent-aborted' : 'agent-error',
            runId: runId,
            agentId: task.id,
            summary: failed.summary,
            error: failed.finalReply,
            finishedAt: failed.finishedAt,
          }),
          'completed' === priorAgent?.status ? priorAgent : failed
        );
      }
    }),
  );
  return results.map((result, index) => {
    if ('fulfilled' === result.status) return result.value;
    const priorAgent = priorRun?.agents?.find((agent) => agent.id === tasks[index]?.id);
    return 'completed' === priorAgent?.status
      ? priorAgent
      : compactAgentResult({
          id: tasks[index]?.id ?? `sub-agent-${index + 1}`,
          title: tasks[index]?.title ?? `Sub-agent ${index + 1}`,
          goal: tasks[index]?.goal ?? '',
          deliverable: tasks[index]?.deliverable ?? '',
          status: 'error',
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          reasoning: '',
          logs: [],
          toolOutputs: [],
          finalReply: `Delegated run failed: ${result.reason?.message ?? 'Unknown error'}`,
          summary: summarizeText(result.reason?.message ?? 'Unknown delegated failure', 320),
          usage: { inputTokens: 0, outputTokens: 0 },
          provider: '',
          modelId: '',
        });
  });
}
export const { handles: handles, execute: execute } = createExecutor({
  name: 'SubAgentsExecutor',
  tools: ['spawn_sub_agents'],
  handlers: {
    [SUB_AGENT_TOOL_NAME]: async (params, onStage, hooks = {}) => {
      const tasks = (function (rawTasks) {
        let parsed = rawTasks;
        if ('string' == typeof rawTasks) {
          const text = rawTasks.trim();
          if (!text) return [];
          try {
            parsed = JSON.parse(text);
          } catch {
            parsed = text
              .split('\n')
              .map((line) => line.replace(/^[\-\*\d\.\)\s]+/, '').trim())
              .filter(Boolean)
              .map((goal, index) => ({ title: `Sub-agent ${index + 1}`, goal: goal }));
          }
        }
        return Array.isArray(parsed)
          ? parsed
              .map((task, index) => {
                if ('string' == typeof task) {
                  const goal = task.trim();
                  return goal
                    ? {
                        id: `sub-agent-${index + 1}`,
                        title: `Sub-agent ${index + 1}`,
                        goal: goal,
                        context: '',
                        deliverable: '',
                      }
                    : null;
                }
                if (!task || 'object' != typeof task) return null;
                const title = String(task.title ?? task.name ?? `Sub-agent ${index + 1}`).trim(),
                  goal = String(
                    task.goal ?? task.objective ?? task.task ?? task.prompt ?? '',
                  ).trim(),
                  context = String(task.context ?? task.notes ?? task.background ?? '').trim(),
                  deliverable = String(
                    task.deliverable ?? task.output ?? task.success_criteria ?? '',
                  ).trim();
                return goal
                  ? {
                      id: String(task.id ?? `sub-agent-${index + 1}`),
                      title: title || `Sub-agent ${index + 1}`,
                      goal: goal,
                      context: context,
                      deliverable: deliverable,
                    }
                  : null;
              })
              .filter(Boolean)
              .slice(0, 20)
          : [];
      })(params.tasks);
      if (!tasks.length)
        throw new Error('spawn_sub_agents requires at least one valid delegated task.');
      const coordinationGoal =
          String(params.coordination_goal ?? '').trim() ||
          'Help the coordinator finish the user request by combining focused delegated handoffs.',
        synthesisStyle = String(params.synthesis_style ?? 'brief').trim() || 'brief',
        runId = `delegation-${Date.now()}`;
      (hooks.onSubAgentEvent?.({
        type: 'session-start',
        runId: runId,
        coordinationGoal: coordinationGoal,
        summary: `Launching ${tasks.length} focused sub-agent${1 === tasks.length ? '' : 's'}...`,
      }),
        onStage(`Delegating to ${tasks.length} sub-agent${1 === tasks.length ? '' : 's'}...`));
      const { agentLoop: agentLoop } = await import('../../Core/Agent.js'),
        run = {
          type: 'subagent_run',
          runId: runId,
          coordinationGoal: coordinationGoal,
          summary: '',
          synthesis: '',
          agents: [],
        };
      run.agents = await runDelegatedPass({
        agentLoop: agentLoop,
        tasks: tasks,
        coordinationGoal: coordinationGoal,
        runId: runId,
        hooks: hooks,
        timeoutMs: 2e5,
      });
      const collaborationTasks = tasks.filter((task) =>
        (function (agent = {}) {
          if (!agent) return !1;
          if ('error' === agent.status || 'aborted' === agent.status) return !0;
          const haystack = `${agent.summary ?? ''}\n${agent.finalReply ?? ''}`.toLowerCase();
          return (
            !!haystack.trim() &&
            [
              'waiting for',
              'need another agent',
              'need the other agent',
              'need agent 1',
              'need agent 2',
              'need agent 3',
              'need sibling',
              'missing source materials',
              'missing source material',
              'missing required inputs',
              'required inputs',
              'from agent 1',
              'from agent 2',
              'from agent 3',
              'from agents 1 and 2',
              'cannot proceed',
              'lack the required inputs',
              'lack the required input',
              'once these materials are provided',
              'coordinator action required',
            ].some((pattern) => haystack.includes(pattern))
          );
        })(run.agents.find((agent) => agent.id === task.id)),
      );
      if (collaborationTasks.length > 0) {
        hooks.onSubAgentEvent?.({
          type: 'session-start',
          runId: runId,
          coordinationGoal: coordinationGoal,
          summary: `Initial handoffs complete. Running a collaboration pass for ${collaborationTasks.length} sub-agent${1 === collaborationTasks.length ? '' : 's'}...`,
        });
        const collaborationResults = await runDelegatedPass({
            agentLoop: agentLoop,
            tasks: collaborationTasks,
            coordinationGoal: coordinationGoal,
            runId: runId,
            hooks: hooks,
            priorRun: run,
            timeoutMs: 2e5,
          }),
          collaborationMap = new Map(collaborationResults.map((agent) => [agent.id, agent]));
        run.agents = run.agents.map((agent) => collaborationMap.get(agent.id) ?? agent);
      }
      return (
        (run.summary = buildRunSummary(run)),
        (run.synthesis = (function (run, synthesisStyle = 'brief') {
          const lines = [],
            style = String(synthesisStyle ?? 'brief')
              .trim()
              .toLowerCase();
          ('comparison' === style
            ? lines.push('Delegated comparisons:')
            : 'action_items' === style
              ? lines.push('Delegated action items:')
              : lines.push('Delegated handoff:'),
            run.agents.forEach((agent) => {
              const summary =
                agent.summary || summarizeText(agent.finalReply, 320) || buildRunSummary(run);
              lines.push(`- ${agent.title}: ${summary}`);
            }));
          const issues = run.agents.filter(
            (agent) => 'error' === agent.status || 'aborted' === agent.status,
          );
          return (
            issues.length &&
              (lines.push(''),
              lines.push('Open issues:'),
              issues.forEach((agent) => {
                lines.push(
                  `- ${agent.title}: ${agent.summary || 'The delegated run did not complete cleanly.'}`,
                );
              })),
            lines.join('\n')
          );
        })(run, synthesisStyle)),
        hooks.onSubAgentEvent?.({
          type: 'session-complete',
          runId: runId,
          summary: run.summary,
          synthesis: run.synthesis,
        }),
        `[SUBAGENT_RESULT]${JSON.stringify(run)}`
      );
    },
  },
});
