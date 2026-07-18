# SubAgents Tool

Delegates complex tasks to multiple focused read-only sub-agents.

---

## Architecture

```text
Packages/Toolset/Tools/SubAgents/
├── Index.js        — Tool package entry
├── Tools.js        — Tool definitions
├── Executors.js    — Tool execution handlers
├── Prompt.js       — Prompt section builder
├── API.js          — Task normalization
└── I18n/
    └── en.js       — Tool definitions and strings
```

---

## Tool: `spawn_sub_agents`

Delegates a medium or high complexity request into multiple focused read-only research sub-agents.

### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `tasks` | string | Yes | JSON array of task objects with title, goal, and optional context/deliverable |
| `coordination_goal` | string | No | Overall objective explaining how tasks fit together |
| `synthesis_style` | string | No | Preferred synthesis: `brief`, `detailed`, `action_items`, or `comparison` |

### Task Object Shape

```json
{
  "title": "Research API alternatives",
  "goal": "Find the best REST API framework for Node.js",
  "context": "We need something with good TypeScript support",
  "deliverable": "Comparison table of top 3 frameworks"
}
```

### Example AI Invocation

````markdown
```joanium-tool
{"tool":"spawn_sub_agents","parameters":{"tasks":"[{\"title\":\"Research React frameworks\",\"goal\":\"Compare Next.js vs Remix vs Astro\"},{\"title\":\"Research backend options\",\"goal\":\"Compare Express vs Fastify vs Hono\"}]","coordination_goal":"Choose the best full-stack setup","synthesis_style":"comparison"}}
```
````

---

## Execution Flow

1. AI invokes `spawn_sub_agents` with task JSON
2. `Executors.js` normalizes the tasks via `API.js`
3. Returns a summary of queued tasks
4. Chat package handles actual sub-agent execution:
   - Creates sub-agent context with restricted terminal tools
   - Each sub-agent gets `inspect_workspace`, `search_workspace`, `read_local_file`, `list_directory`
   - Sub-agents run in parallel via the assistant pipeline
   - Results are collected and synthesized

---

## Sub-Agent Restrictions

Sub-agents are read-only:

- Can inspect and search the workspace
- Can read files
- Cannot write, delete, or execute commands
- Limited to `SUB_AGENT_TERMINAL_TOOL_NAMES`

---

## Task Normalization

`API.js` normalizes raw AI task JSON into structured objects:

```js
import { normalizeSubAgentTasks } from './API.js';

const tasks = normalizeSubAgentTasks({
  tasks: '[{"title":"Task 1","goal":"Goal 1"}]',
  coordination_goal: 'Overall goal',
});
```

Supports multiple input shapes:

- JSON string in `tasks` parameter
- Array of task objects
- Single task object

Maximum 8 tasks per invocation.

---

## Prompt Section

`Prompt.js` builds the prompt section that tells the AI about the sub-agent tool:

```js
export function buildSubAgentPromptSection(subAgentPrompt) {
  return subAgentPrompt;
}
```

The prompt is loaded from `Prompts/SubAgentTool.md`.
