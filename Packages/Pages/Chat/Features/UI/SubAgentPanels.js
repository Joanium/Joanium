import { render as renderMarkdown } from '../../../Shared/Content/Markdown.js';
function truncateText(value, maxChars) {
  const text = String(value ?? '');
  return text ? (text.length > maxChars ? `${text.slice(0, maxChars - 3)}...` : text) : '';
}
function sanitizeId(value, fallback = 'sub-agent') {
  return String(value ?? '').trim() || fallback;
}
function normalizeUsage(usage = {}) {
  return {
    inputTokens: Number(usage?.inputTokens ?? 0) || 0,
    outputTokens: Number(usage?.outputTokens ?? 0) || 0,
  };
}
function normalizeLog(log = {}) {
  return {
    id: sanitizeId(log.id, `log-${Date.now()}`),
    text: truncateText(log.text, 400),
    status: ['pending', 'success', 'error'].includes(log.status) ? log.status : 'pending',
  };
}
function normalizeAgent(agent = {}) {
  return {
    id: sanitizeId(agent.id),
    title: truncateText(agent.title, 140) || 'Sub-agent',
    goal: truncateText(agent.goal, 1500),
    deliverable: truncateText(agent.deliverable, 1e3),
    status: ['pending', 'running', 'completed', 'error', 'aborted'].includes(agent.status)
      ? agent.status
      : 'pending',
    startedAt: agent.startedAt ?? null,
    finishedAt: agent.finishedAt ?? null,
    reasoning: truncateText(agent.reasoning, 12e3),
    logs: (Array.isArray(agent.logs) ? agent.logs : []).slice(-40).map(normalizeLog),
    toolOutputs: (Array.isArray(agent.toolOutputs) ? agent.toolOutputs : [])
      .slice(-8)
      .map((output) => truncateText(output, 6e3)),
    finalReply: truncateText(agent.finalReply, 16e3),
    summary: truncateText(agent.summary, 1500),
    usage: normalizeUsage(agent.usage),
    provider: truncateText(agent.provider, 80),
    modelId: truncateText(agent.modelId, 120),
  };
}
export function isSubAgentRunAttachment(attachment) {
  return 'subagent_run' === attachment?.type && Array.isArray(attachment?.agents);
}
export function cloneSubAgentRunAttachment(run = {}) {
  return {
    type: 'subagent_run',
    runId: sanitizeId(run.runId, `run-${Date.now()}`),
    coordinationGoal: truncateText(run.coordinationGoal, 1800),
    summary: truncateText(run.summary, 1500),
    synthesis: truncateText(run.synthesis, 16e3),
    agents: (Array.isArray(run.agents) ? run.agents : []).map(normalizeAgent),
  };
}
function formatUsage(usage = {}) {
  const total = (Number(usage?.inputTokens ?? 0) || 0) + (Number(usage?.outputTokens ?? 0) || 0);
  return total
    ? total >= 1e6
      ? `${(total / 1e6).toFixed(2)}M tok`
      : total >= 1e3
        ? `${(total / 1e3).toFixed(1)}K tok`
        : `${total} tok`
    : '';
}
function createLogItem() {
  const item = document.createElement('div');
  item.className = 'agent-subagent-log-item';
  const status = document.createElement('span');
  status.className = 'agent-subagent-log-status';
  const dot = document.createElement('span');
  ((dot.className = 'agent-subagent-log-dot'), status.appendChild(dot));
  const text = document.createElement('span');
  return (
    (text.className = 'agent-subagent-log-text'),
    item.append(status, text),
    {
      root: item,
      set(nextText, status = 'pending') {
        ((item.dataset.status = status),
          (dot.dataset.status = status),
          (text.textContent = String(nextText ?? '')));
      },
    }
  );
}
function createMarkdownBlock(markdown = '', className = '') {
  const block = document.createElement('div');
  return ((block.className = className), (block.innerHTML = renderMarkdown(markdown)), block);
}
function setDisclosureState(root, toggle, body, expanded) {
  const isExpanded = Boolean(expanded);
  ((root.dataset.expanded = isExpanded ? 'true' : 'false'),
    toggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false'),
    (body.hidden = !isExpanded));
}
function createAgentCardShell(initialAgent = {}) {
  const snapshot = normalizeAgent(initialAgent),
    root = document.createElement('section');
  ((root.className = 'agent-subagent-card'), (root.dataset.status = snapshot.status));
  const toggle = document.createElement('button');
  ((toggle.type = 'button'), (toggle.className = 'agent-subagent-toggle'));
  const headerMain = document.createElement('span');
  headerMain.className = 'agent-subagent-head-main';
  const title = document.createElement('span');
  title.className = 'agent-subagent-title';
  const meta = document.createElement('span');
  ((meta.className = 'agent-subagent-meta'), headerMain.append(title, meta));
  const headerRight = document.createElement('span');
  headerRight.className = 'agent-subagent-head-right';
  const status = document.createElement('span');
  status.className = 'agent-subagent-status';
  const caret = document.createElement('span');
  ((caret.className = 'agent-subagent-caret'),
    caret.setAttribute('aria-hidden', 'true'),
    (caret.innerHTML =
      '\n    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">\n      <path d="M6 8l4 4 4-4"></path>\n    </svg>\n  '),
    headerRight.append(status, caret),
    toggle.append(headerMain, headerRight));
  const body = document.createElement('div');
  body.className = 'agent-subagent-body';
  const task = document.createElement('div');
  ((task.className = 'agent-subagent-task'), (task.hidden = !0));
  const summary = document.createElement('div');
  ((summary.className = 'agent-subagent-summary'), (summary.hidden = !0));
  const reasoningSection = document.createElement('div');
  ((reasoningSection.className = 'agent-subagent-section'),
    (reasoningSection.hidden = !0),
    (reasoningSection.innerHTML = '<div class="agent-subagent-section-label">Thinking</div>'));
  const reasoningContent = document.createElement('pre');
  ((reasoningContent.className = 'agent-subagent-reasoning'),
    reasoningSection.appendChild(reasoningContent));
  const logsSection = document.createElement('div');
  ((logsSection.className = 'agent-subagent-section'),
    (logsSection.hidden = !0),
    (logsSection.innerHTML = '<div class="agent-subagent-section-label">Activity</div>'));
  const logsList = document.createElement('div');
  ((logsList.className = 'agent-subagent-logs'), logsSection.appendChild(logsList));
  const outputsSection = document.createElement('div');
  ((outputsSection.className = 'agent-subagent-section'),
    (outputsSection.hidden = !0),
    (outputsSection.innerHTML = '<div class="agent-subagent-section-label">Tool Output</div>'));
  const outputsList = document.createElement('div');
  ((outputsList.className = 'agent-subagent-tool-outputs'),
    outputsSection.appendChild(outputsList));
  const resultSection = document.createElement('div');
  ((resultSection.className = 'agent-subagent-section'),
    (resultSection.hidden = !0),
    (resultSection.innerHTML = '<div class="agent-subagent-section-label">Handoff</div>'));
  const resultBody = document.createElement('div');
  ((resultBody.className = 'agent-subagent-result'),
    resultSection.appendChild(resultBody),
    body.append(task, summary, reasoningSection, logsSection, outputsSection, resultSection),
    root.append(toggle, body),
    setDisclosureState(root, toggle, body, !1),
    toggle.addEventListener('click', () => {
      const isOpen = 'true' === toggle.getAttribute('aria-expanded');
      setDisclosureState(root, toggle, body, !isOpen);
    }));
  const logMap = new Map();
  function renderHeader() {
    ((title.textContent = snapshot.title || 'Sub-agent'),
      (status.textContent = (function (status) {
        switch (status) {
          case 'running':
            return 'Running';
          case 'completed':
            return 'Complete';
          case 'error':
            return 'Error';
          case 'aborted':
            return 'Stopped';
          default:
            return 'Queued';
        }
      })(snapshot.status)),
      (root.dataset.status = snapshot.status));
    const metaParts = [
      snapshot.provider && snapshot.modelId ? `${snapshot.provider}/${snapshot.modelId}` : '',
      formatUsage(snapshot.usage),
    ].filter(Boolean);
    ((meta.textContent = metaParts.join(' | ')), (meta.hidden = 0 === metaParts.length));
  }
  function renderSummary() {
    ((summary.textContent = snapshot.summary), (summary.hidden = !snapshot.summary));
  }
  function renderReasoning() {
    ((reasoningContent.textContent = snapshot.reasoning),
      (reasoningSection.hidden = !snapshot.reasoning));
  }
  function renderResult() {
    if (!snapshot.finalReply)
      return ((resultSection.hidden = !0), void (resultBody.innerHTML = ''));
    ((resultSection.hidden = !1), (resultBody.innerHTML = renderMarkdown(snapshot.finalReply)));
  }
  function renderOutputs() {
    ((outputsList.innerHTML = ''),
      snapshot.toolOutputs.forEach((output) => {
        outputsList.appendChild(createMarkdownBlock(output, 'agent-subagent-tool-output'));
      }),
      (outputsSection.hidden = 0 === snapshot.toolOutputs.length));
  }
  function rerenderAll() {
    (renderHeader(),
      (function () {
        if (((task.innerHTML = ''), snapshot.goal)) {
          const goalLine = document.createElement('div');
          ((goalLine.innerHTML = '<strong>Goal:</strong> '),
            goalLine.appendChild(document.createTextNode(snapshot.goal)),
            task.appendChild(goalLine));
        }
        if (snapshot.deliverable) {
          const deliverableLine = document.createElement('div');
          ((deliverableLine.innerHTML = '<strong>Deliverable:</strong> '),
            deliverableLine.appendChild(document.createTextNode(snapshot.deliverable)),
            task.appendChild(deliverableLine));
        }
        task.hidden = 0 === task.childElementCount;
      })(),
      renderSummary(),
      renderReasoning(),
      (logsList.innerHTML = ''),
      logMap.clear(),
      snapshot.logs.forEach((log) => {
        const item = createLogItem(log);
        (item.set(log.text, log.status), logMap.set(log.id, item), logsList.appendChild(item.root));
      }),
      (logsSection.hidden = 0 === snapshot.logs.length),
      renderOutputs(),
      renderResult());
  }
  return (
    rerenderAll(),
    {
      root: root,
      get snapshot() {
        return normalizeAgent(snapshot);
      },
      setIdentity(agent = {}) {
        (Object.assign(snapshot, normalizeAgent({ ...snapshot, ...agent })), rerenderAll());
      },
      setStatus(nextStatus) {
        ((snapshot.status = ['pending', 'running', 'completed', 'error', 'aborted'].includes(
          nextStatus,
        )
          ? nextStatus
          : snapshot.status),
          renderHeader());
      },
      setUsage(usage, provider = '', modelId = '') {
        ((snapshot.usage = normalizeUsage(usage)),
          provider && (snapshot.provider = truncateText(provider, 80)),
          modelId && (snapshot.modelId = truncateText(modelId, 120)),
          renderHeader());
      },
      setSummary(text) {
        ((snapshot.summary = truncateText(text, 1500)), renderSummary());
      },
      appendReasoning(chunk) {
        ((snapshot.reasoning = truncateText(`${snapshot.reasoning}${String(chunk ?? '')}`, 12e3)),
          renderReasoning());
      },
      setReasoning(text) {
        ((snapshot.reasoning = truncateText(text, 12e3)), renderReasoning());
      },
      upsertLog(logId, text, logStatus = 'pending') {
        const normalized = normalizeLog({ id: logId, text: text, status: logStatus }),
          existingIndex = snapshot.logs.findIndex((log) => log.id === normalized.id);
        existingIndex >= 0
          ? (snapshot.logs[existingIndex] = normalized)
          : (snapshot.logs.push(normalized),
            snapshot.logs.length > 40 && (snapshot.logs = snapshot.logs.slice(-40)));
        let item = logMap.get(normalized.id);
        (item ||
          ((item = createLogItem(normalized)),
          logMap.set(normalized.id, item),
          logsList.appendChild(item.root)),
          item.set(normalized.text, normalized.status),
          (logsSection.hidden = 0 === snapshot.logs.length));
      },
      addToolOutput(markdown) {
        const next = truncateText(markdown, 6e3);
        if ((snapshot.toolOutputs.push(next), snapshot.toolOutputs.length > 8))
          return ((snapshot.toolOutputs = snapshot.toolOutputs.slice(-8)), void renderOutputs());
        (outputsList.appendChild(createMarkdownBlock(next, 'agent-subagent-tool-output')),
          (outputsSection.hidden = !1));
      },
      setFinalReply(markdown) {
        ((snapshot.finalReply = truncateText(markdown, 16e3)), renderResult());
      },
    }
  );
}
function createRunShell(initialRun = {}) {
  const snapshot = cloneSubAgentRunAttachment(initialRun),
    root = document.createElement('section');
  root.className = 'agent-subagent-run';
  const toggle = document.createElement('button');
  ((toggle.type = 'button'), (toggle.className = 'agent-subagent-run-toggle'));
  const head = document.createElement('div');
  head.className = 'agent-subagent-run-head';
  const titleRow = document.createElement('div');
  titleRow.className = 'agent-subagent-run-title-row';
  const title = document.createElement('div');
  ((title.className = 'agent-subagent-run-title'),
    (title.innerHTML =
      '<span class="agent-subagent-run-icon">\n    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">\n      <path d="M16 18l6-6-6-6"></path>\n      <path d="M8 6l-6 6 6 6"></path>\n      <path d="M13 4l-2 16"></path>\n    </svg>\n  </span><span>Sub-agents</span>'));
  const badge = document.createElement('span');
  badge.className = 'agent-subagent-run-badge';
  const titleRight = document.createElement('span');
  titleRight.className = 'agent-subagent-run-title-right';
  const caret = document.createElement('span');
  ((caret.className = 'agent-subagent-run-caret'),
    caret.setAttribute('aria-hidden', 'true'),
    (caret.innerHTML =
      '\n    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">\n      <path d="M6 8l4 4 4-4"></path>\n    </svg>\n  '),
    titleRight.append(badge, caret),
    titleRow.append(title, titleRight));
  const preview = document.createElement('p');
  ((preview.className = 'agent-subagent-run-preview'), (preview.hidden = !0));
  const goal = document.createElement('p');
  ((goal.className = 'agent-subagent-run-goal'), (goal.hidden = !0));
  const summary = document.createElement('div');
  ((summary.className = 'agent-subagent-run-summary'), (summary.hidden = !0));
  const synthesis = document.createElement('div');
  ((synthesis.className = 'agent-subagent-run-synthesis'),
    (synthesis.hidden = !0),
    head.append(titleRow, preview),
    toggle.appendChild(head));
  const grid = document.createElement('div');
  grid.className = 'agent-subagent-run-grid';
  const body = document.createElement('div');
  ((body.className = 'agent-subagent-run-body'),
    body.append(goal, summary, grid, synthesis),
    root.append(toggle, body),
    setDisclosureState(root, toggle, body, !1));
  const cardMap = new Map();
  function renderHeader() {
    const agentCount = snapshot.agents.length;
    badge.textContent = `${agentCount} sub-agent${1 === agentCount ? '' : 's'}`;
    const previewText = snapshot.summary || snapshot.coordinationGoal;
    ((preview.textContent = previewText),
      (preview.hidden = !previewText),
      (goal.textContent = snapshot.coordinationGoal),
      (goal.hidden = !snapshot.coordinationGoal),
      (summary.textContent = snapshot.summary),
      (summary.hidden = !snapshot.summary),
      snapshot.synthesis
        ? ((synthesis.hidden = !1), (synthesis.innerHTML = renderMarkdown(snapshot.synthesis)))
        : ((synthesis.hidden = !0), (synthesis.innerHTML = '')));
  }
  return (
    toggle.addEventListener('click', () => {
      const isOpen = 'true' === toggle.getAttribute('aria-expanded');
      setDisclosureState(root, toggle, body, !isOpen);
    }),
    (snapshot.agents ?? []).forEach((agent) => {
      const card = createAgentCardShell(agent);
      (cardMap.set(agent.id, card), grid.appendChild(card.root));
    }),
    renderHeader(),
    {
      root: root,
      get snapshot() {
        return cloneSubAgentRunAttachment({
          ...snapshot,
          agents: [...cardMap.values()].map((card) => card.snapshot),
        });
      },
      ensureCard(agent) {
        const card = (function (agent = {}) {
          const normalized = normalizeAgent(agent);
          if (cardMap.has(normalized.id)) return cardMap.get(normalized.id);
          snapshot.agents.push(normalized);
          const card = createAgentCardShell(normalized);
          return (
            cardMap.set(normalized.id, card),
            grid.appendChild(card.root),
            renderHeader(),
            card
          );
        })(agent);
        return ((snapshot.agents = [...cardMap.values()].map((current) => current.snapshot)), card);
      },
      setCoordinationGoal(text) {
        ((snapshot.coordinationGoal = truncateText(text, 1800)), renderHeader());
      },
      setSummary(text) {
        ((snapshot.summary = truncateText(text, 1500)), renderHeader());
      },
      setSynthesis(markdown) {
        ((snapshot.synthesis = truncateText(markdown, 16e3)), renderHeader());
      },
    }
  );
}
export function createSubAgentRunElement(run = {}) {
  return createRunShell(run).root;
}
export function createLiveSubAgentRunTracker(hostEl) {
  const sessions = new Map();
  function ensureSession(event = {}) {
    const runId = sanitizeId(event.runId, `run-${Date.now()}`);
    if (sessions.has(runId)) return sessions.get(runId);
    const shell = createRunShell({
      runId: runId,
      coordinationGoal: event.coordinationGoal ?? '',
      summary: event.summary ?? '',
      synthesis: event.synthesis ?? '',
      agents: [],
    });
    hostEl.appendChild(shell.root);
    const session = { runId: runId, shell: shell };
    return (sessions.set(runId, session), session);
  }
  function resolveAgentCard(event = {}) {
    const session = ensureSession(event);
    return {
      session: session,
      card: session.shell.ensureCard({
        id: event.agentId,
        title: event.title,
        goal: event.goal,
        deliverable: event.deliverable,
        status: event.status ?? 'pending',
        startedAt: event.startedAt ?? null,
      }),
    };
  }
  return {
    onEvent(event = {}) {
      if (event?.type)
        switch (event.type) {
          case 'session-start': {
            const session = ensureSession(event);
            (session.shell.setCoordinationGoal(event.coordinationGoal ?? ''),
              session.shell.setSummary(event.summary ?? ''));
            break;
          }
          case 'session-complete': {
            const session = ensureSession(event);
            (session.shell.setSummary(event.summary ?? session.shell.snapshot.summary ?? ''),
              session.shell.setSynthesis(event.synthesis ?? ''));
            break;
          }
          case 'agent-start': {
            const { card: card } = resolveAgentCard({ ...event, status: 'running' });
            (card.setIdentity({
              id: event.agentId,
              title: event.title,
              goal: event.goal,
              deliverable: event.deliverable,
              status: 'running',
              startedAt: event.startedAt ?? null,
            }),
              card.setStatus('running'));
            break;
          }
          case 'agent-log-add': {
            const { card: card } = resolveAgentCard(event);
            card.upsertLog(event.logId, event.text, 'pending');
            break;
          }
          case 'agent-log-update': {
            const { card: card } = resolveAgentCard(event);
            card.upsertLog(event.logId, event.text, event.status ?? 'pending');
            break;
          }
          case 'agent-reasoning': {
            const { card: card } = resolveAgentCard(event);
            event.reasoning
              ? card.setReasoning(event.reasoning)
              : card.appendReasoning(event.chunk ?? '');
            break;
          }
          case 'agent-tool-output': {
            const { card: card } = resolveAgentCard(event);
            card.addToolOutput(event.markdown ?? '');
            break;
          }
          case 'agent-complete': {
            const { card: card } = resolveAgentCard(event);
            (card.setSummary(event.summary ?? ''),
              card.setFinalReply(event.finalReply ?? ''),
              card.setUsage(event.usage, event.provider, event.modelId),
              card.setStatus('completed'));
            break;
          }
          case 'agent-error': {
            const { card: card } = resolveAgentCard(event);
            (event.error && (card.setSummary(event.error), card.setFinalReply(event.error)),
              card.setStatus('error'));
            break;
          }
          case 'agent-aborted': {
            const { card: card } = resolveAgentCard(event);
            (card.setSummary(event.summary ?? 'The sub-agent run was stopped before completion.'),
              card.setStatus('aborted'));
            break;
          }
        }
    },
    getAttachments: () => [...sessions.values()].map((session) => session.shell.snapshot),
  };
}
