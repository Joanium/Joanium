# Agent Internals

Background agent scheduling, execution, and replay system.

---

## Architecture

```text
Packages/Agents/
├── Index.js              — IPC handlers, renderer-delegated tool loop
├── Core/
│   ├── AgentState.js     — CRUD + run management
│   ├── AgentScheduler.js — Cron-like scheduling
│   └── ReplayStore.js   — Run replay storage
├── IPC/
│   └── ReplayIpc.js     — Replay IPC handlers
├── UI/
│   ├── AgentGateway.js   — Renderer-side execution
│   ├── AgentsPanel.js    — Agent list UI
│   ├── ExecutionReplay.js — Replay viewer
│   └── Prompts.js        — Agent-specific prompts
└── I18n/
    └── en.js             — Agent strings
```

---

## Agent Data Model

Each agent is a JSON file in `Data/Agents/`:

```js
{
  id: 'daily-digest-abc123',
  name: 'Daily Digest',
  avatar: 'digest',
  schedule: { type: 'daily', time: '09:00' },
  model: { providerId: 'openai', modelId: 'gpt-4o' },
  prompt: 'Summarize today's news and events...',
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-06-15T12:00:00.000Z',
  lastRunAt: '2026-06-15T09:00:00.000Z',
}
```

### Schedule Types

| Type | Behavior |
|---|---|
| `startup` | Runs once when the app starts |
| `daily` | Runs every day at `HH:MM` |
| `weekly` | Runs on a specific day at `HH:MM` (0=Sun, 6=Sat) |
| `weekdays` | Runs Mon–Fri at `HH:MM` |
| `weekends` | Runs Sat–Sun at `HH:MM` |

---

## AgentScheduler

`AgentScheduler.js` manages timing:

- Ticks every 60 seconds
- Checks each enabled agent's schedule against current time
- Runs agents sequentially with 5-second gaps (prevents rate limiting)
- Pre-queues agents so the Events feed shows pending status immediately
- Waits for renderer-ready handshake before dispatching startup agents

### Schedule Matching

```js
function shouldRunNow(schedule, now) {
  const hh = now.getHours();
  const mm = now.getMinutes();
  const dow = now.getDay();

  switch (schedule.type) {
    case 'daily':   return timeMatches;
    case 'weekly':  return timeMatches && dow === schedule.day;
    case 'weekdays': return timeMatches && dow >= 1 && dow <= 5;
    case 'weekends': return timeMatches && (dow === 0 || dow === 6);
  }
}
```

---

## Agent Execution

### Renderer-Delegated Pattern

Agents use the same renderer-delegated tool loop as Channels:

1. Main process scheduler sends `agents:run-with-tools` to the renderer
2. `AgentGateway.js` runs the shared assistant pipeline
3. Results flow back via `agents:tool-reply` IPC handler
4. 30-minute timeout per agent

### AgentGateway.js

The renderer-side execution engine:

```js
async function processRun({ id, agentName, prompt, providerId, modelId }) {
  const result = await runAssistantPipeline({
    messages: [{ role: 'user', content: prompt }],
    contextCache,
    personaParts: [activePersona?.content ?? '', AGENT_PROMPTS.agentContext],
    maxToolCalls: 1000,
    supportedTerminalTools: AGENT_TERMINAL_TOOLS,
    source: 'agent',
    isNewSession: true,
    completeMessage: streamChatForAgent,
  });

  await invokeIpc('agents:tool-reply', id, result);
}
```

Key differences from Chat:

- `maxToolCalls` is 1000 (vs 10 for Chat)
- Uses `AGENT_TERMINAL_TOOLS` (all terminal tools)
- Includes agent-specific prompt context
- Streams progress via `agents:progress`

### Streaming

Agent execution streams progress back to the main process:

```js
disposeChunk = onIpc('agents:stream-chunk', ({ streamId, type, text }) => {
  // Accumulate text and thinking tokens
  // Report progress every 1 second
});
```

Progress is written to the run log so the Events panel picks it up on its next poll.

---

## Run Management

### Run History

Each agent run is logged in `Data/Agents/Runs/`:

```js
{
  id: 'daily-digest-abc123-2026-06-15T09-00-00-000Z',
  agentId: 'daily-digest-abc123',
  agentName: 'Daily Digest',
  agentAvatar: 'digest',
  prompt: 'Summarize...',
  schedule: { type: 'daily', time: '09:00' },
  firedAt: '2026-06-15T09:00:00.000Z',
  startedAt: '2026-06-15T09:00:01.000Z',
  finishedAt: '2026-06-15T09:02:30.000Z',
  status: 'completed',  // or 'running', 'error', 'queued'
  fullResponse: '...',
  thinking: '...',
  terminals: [...],
  provider: 'OpenAI',
  model: 'GPT-4o',
  inputTokens: 1234,
  outputTokens: 567,
  error: null,
}
```

### Queue → Run Flow

1. `queueAgent(agent)` — Pre-writes a 'queued' log entry
2. `runAgent(agent, preAllocated)` — Promotes the queued entry to 'running'
3. Writes final status ('completed' or 'error') with full response and token counts

### ReplayStore.js

Stores run data for execution replay:

- Saves full execution trace (tool calls, results, timing)
- Allows replaying past agent runs in the UI
- Stored in `Data/Agents/Runs/`

### Interrupted Run Recovery

On startup, `agentStateManager.recoverInterruptedRuns()` recovers runs that were interrupted by the app closing unexpectedly.

---

## IPC Handlers (13 channels)

| Channel | Purpose |
|---|---|
| `agents:renderer-ready` | Handshake — unblocks startup agents |
| `agents:tool-reply` | Resolves pending agent runs |
| `agents:progress` | Streaming progress to run log |
| `agents:save-agent` | Create/update an agent |
| `agents:list-agents` | List all agents |
| `agents:load-agent` | Load a specific agent |
| `agents:delete-agent` | Delete an agent |
| `agents:run-agent` | Manually trigger an agent |
| `agents:list-runs` | List run history |
| `agents:clear-runs` | Clear run history |
| `agents:list-avatars` | List agent avatar images |
| `agents:load-run-detail` | Load a single run log enriched with steps |
| `agents:list-run-ids` | Lightweight list of run IDs + metadata |

---

## Execution Replay

`ExecutionReplay.js` provides a viewer for past agent runs:

- Shows tool calls in sequence
- Displays inputs and outputs
- Timeline visualization
- Collapsible detail sections

---

## Adding a New Agent

1. Open Agents panel
2. Click "New Agent"
3. Set name, schedule, prompt, model
4. Save — scheduler picks it up automatically
