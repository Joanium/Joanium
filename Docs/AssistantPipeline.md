# Assistant Pipeline

The shared prompt execution pipeline used by Chat, Channels, and Agents.

---

## Architecture

```text
Shared/AssistantRuntime/
├── AssistantPipeline.js   — Pipeline orchestration
├── AssistantContext.js     — Context caching and loading
└── Utils.js               — Optional-value helpers
```

---

## Purpose

The AssistantPipeline provides a unified way to:

1. Load runtime context (memory, terminal tools, toolset tools, skills)
2. Assemble a complete AI request with all context
3. Execute the bounded renderer tool loop

Used by three surfaces:

- **Chat**: Direct user conversations
- **Channels**: External messaging (Telegram, Discord, etc.)
- **Agents**: Background scheduled tasks

---

## Key Functions

### `loadAssistantPipelineRuntime()`

Loads and caches runtime context:

```js
const runtime = await loadAssistantPipelineRuntime({
  contextCache,
  includeMemory: true,
  includeTerminalPrompt: true,
  includeToolsetPrompt: true,
  includeSkillsContext: true,
});
```

Returns:

```js
{
  memoryContext,    // Memory from Data/Memories/
  terminalTools,   // Terminal tool instructions from Terminal.md
  toolsetTools,    // Toolset instructions from Toolset.md
  skillsContext,   // Skills from Skills/ directory
}
```

### `createAssistantPipelineRequest()`

Assembles a complete request object:

```js
const request = await createAssistantPipelineRequest({
  messages: [{ role: 'user', content: 'Hello' }],
  persona: 'Active persona content',
  memoryContext: '...',
  providerId: 'openai',
  modelId: 'gpt-4o',
  source: 'chat',
  isNewSession: true,
});
```

Returns a request object with all context merged.

### `runAssistantPipeline()`

Executes the full pipeline — loads context, assembles request, runs tool loop:

```js
const result = await runAssistantPipeline({
  messages: [{ role: 'user', content: 'Hello' }],
  completeMessage: streamChatForAgent,
  maxToolCalls: 10,
  supportedTerminalTools: TERMINAL_TOOL_NAMES,
  executeTerminal: executeTerminalTool,
  executeToolset: executeToolsetTool,
  formatTerminalResult: formatResult,
  formatToolsetResult: formatToolsetResult,
  onProgress: (data) => { /* ... */ },
  source: 'chat',
});
```

---

## Context Caching

`AssistantContext.js` provides a cache to avoid reloading context between messages:

```js
const cache = createAssistantContextCache();
// Cache stores: terminalPrompt, toolsetPrompt, skillsContext
// Memory is NOT cached (changes between sessions)
```

Cache is reset when connectors change:

```js
resetAssistantContextCache(cache);
```

---

## Request Shape

The assembled request object:

```js
{
  messages: [...],           // Conversation history
  isNewSession: boolean,     // Whether this is a new session
  source: 'chat' | 'agent' | 'channel',
  persona: '...',            // Active persona content
  memoryContext: '...',      // Memory context
  terminalTools: '...',     // Terminal tool instructions
  toolsetTools: '...',      // Toolset instructions
  skillsContext: '...',     // Skills context
  providerId: '...',        // Selected provider
  modelId: '...',           // Selected model
  projectInfo: {...},       // Project context
  modeInstruction: '...',   // Active mode instruction
}
```

---

## Tool Loop Integration

The pipeline feeds into `runRendererToolLoop()` from `Shared/ToolLoop/RendererToolLoop.js`:

1. AI response is parsed for `joanium-terminal` and `joanium-tool` blocks
2. Terminal tools execute via IPC (`toolset:execute-tool`)
3. Toolset tools execute via IPC (`toolset:execute-tool`)
4. Results are fed back to the AI
5. Loop repeats up to `maxToolCalls`
6. Final response is returned

---

## Usage by Surface

### Chat (ChatApp.js)

```js
const result = await runAssistantPipeline({
  messages: conversationMessages,
  completeMessage: streamChatMessage,
  source: 'chat',
  // ... other options
});
```

### Channels (ChannelRuntime.js)

```js
const result = await runAssistantPipeline({
  messages: [{ role: 'user', content: incomingMessage }],
  persona: channelSystemPrompt,
  source: 'channel',
  maxToolCalls: 5,
});
```

### Agents (AgentGateway.js)

```js
const result = await runAssistantPipeline({
  messages: [{ role: 'user', content: agentPrompt }],
  completeMessage: streamChatForAgent,
  maxToolCalls: 1000,
  source: 'agent',
});
```

---

## Constants

```js
DEFAULT_ASSISTANT_MAX_TOOL_CALLS = 10;
DEFAULT_ASSISTANT_TERMINAL_TOOLS = new Set(TERMINAL_TOOL_NAMES);
```

Agents override `maxToolCalls` to 1000 for extended task execution.
