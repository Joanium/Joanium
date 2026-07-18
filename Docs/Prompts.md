# Prompts System

System prompts, persona modes, and the prompt assembly pipeline.

---

## Prompt Files

All prompt files live in `Prompts/` at the project root:

| File | Purpose |
|---|---|
| `System.md` | Core AI behavior instructions — loaded into every chat session |
| `Toolset.md` | Tool usage instructions with `{{TOOL_LIST}}` and `{{PROMPT_SECTIONS}}` placeholders |
| `Terminal.md` | Terminal tool usage instructions with `{{TERMINAL_TOOL_NAMES}}` placeholder |
| `Memory.md` | Instructions for memory extraction from chat sessions |
| `ProjectContext.md` | Instructions for reading and using project documentation |
| `PromptEnhance.md` | Instructions for AI-powered prompt rewriting |
| `SubAgent.md` | Instructions for sub-agent task delegation |
| `SubAgentTool.md` | Sub-agent tool description and usage |
| `SubAgentTerminal.md` | Sub-agent terminal tool subset with `{{SUB_AGENT_TERMINAL_TOOL_NAMES}}` placeholder |
| `ProductKnowledge.md` | Product knowledge for the AI |
| `TriageMemory.md` | Memory triage and consolidation instructions |
| `DeduplicateMemory.md` | Memory deduplication instructions |
| `ImportMemory.md` | Memory import instructions |
| `ExportProfile.md` | Profile export instructions |
| `Location.md` | Location tool prompt |
| `LiveBrowser.md` | Live browser tool prompt |
| `Knowledge.md` | Knowledge tool prompt |
| `GitCommit.md` | Git commit message generation |
| `GitCommitDiff.md` | Git commit diff formatting |
| `Modes/*.md` | 101 persona mode instruction files |

---

## Prompt Assembly

`ChatState.js` assembles the system prompt from multiple sources. The final prompt is built by concatenating:

```text
1. System.md + Runtime info (merged via buildBaseSystemPrompt)
2. Active persona (from Personas/ directory)
3. Mode instruction (if a slash command mode is active)
4. Custom user instructions (from user profile)
5. Project context (from project documentation)
6. Memory context (from Data/Memories/ via memory:get-context)
7. Terminal tool instructions (from Terminal.md)
8. Toolset tool instructions (from Toolset.md with tool list injected)
9. Skills context (from Skills/ directory)
10. "No Project Context" instruction (if source is 'chat' and no project is open)
```

When no project is open (source is `'chat'` and no `projectInfo`), a "No Project Context" instruction is appended that restricts the AI to conversational responses only.

The final system prompt is then prepended with `CHAT_PROMPTS.latestUserMessageAnchor` — a lightweight multi-turn anchor so weaker models always know which message they should respond to.

### Assembly in ChatState.js

The `buildBaseSystemPrompt()` function reads `System.md` and appends runtime metadata:

```js
const prompt = await readSystemPromptFile(rootDirectory);
return [
  prompt || CHAT_PROMPTS.fallbackSystem,
  '# Runtime And User Info',
  `- User: ${displayName}`,
  `- Joanium version: ${appVersion} (yyyy.month-date.sub version)`,
  `- Local time: ${now.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}`,
  `- Timezone: ${timezone} (Do not assume this is the user's location...)`,
  `- Locale: ${locale}`,
  `- Platform: ${os.type()} ${os.release()} (${os.platform()} ${os.arch()})`,
  `- Home directory: ${os.homedir()}`,
].join('\n');
```

### Template Placeholders

Several prompt files use double-brace placeholders that get replaced at runtime:

| Placeholder | Replaced with |
|---|---|
| `{{TOOL_LIST}}` | Dynamic tool catalogue from Toolset |
| `{{PROMPT_SECTIONS}}` | Tool-specific prompt sections |
| `{{TERMINAL_TOOL_NAMES}}` | Comma-separated list from `TerminalToolNames.js` |
| `{{SUB_AGENT_TERMINAL_TOOL_NAMES}}` | Subset of terminal tools for sub-agents |

---

## Persona Modes

Modes are activated via slash commands (e.g., `/judge`, `/pirate`, `/eli5`). Each mode has a corresponding file in `Prompts/Modes/<id>.md`.

### How Modes Work

1. User types `/judge` in chat input
2. `SlashCommands` package resolves `judge` to a mode command
3. `getModeInstruction('judge')` reads `Prompts/Modes/judge.md`
4. The mode instruction is prepended to the system prompt for that session
5. The AI adopts the persona described in the mode file

### Mode Categories

Modes are defined in `Packages/SlashCommands/Core/Commands.js` with type `'mode'`. Categories include:

- **Professional**: `judge`, `expert`, `ceo`, `lawyer`, `engineer`, `scientist`, `journalist`
- **Creative**: `poet`, `creative`, `shakespeare`, `pirate`, `surrealist`
- **Personality**: `therapist`, `coach`, `mentor`, `stoic`, `optimist`, `pessimist`
- **Humor**: `roast`, `comedian`, `unhinged`, `drunk`, `gossip`
- **Fictional**: `yoda`, `wizard`, `villain`, `samurai`, `oracle`
- **Teaching**: `teacher`, `eli5`, `socratic`, `librarian`
- **Technical**: `hacker`, `nerd`, `detective`, `futurist`

---

## Chat-Specific Prompts

`Packages/Chat/Prompts/Prompts.js` defines chat-specific prompt fragments:

```js
export const CHAT_PROMPTS = {
  fallbackSystem: '...',  // Fallback if System.md is unreadable
  latestUserMessageAnchor: '...',  // Multi-turn anchor for weak models
  // ... other chat-specific prompt templates
};
```

---

## Prompt Loading

Prompt files are loaded via two paths:

**Most packages** use `Shared/Utils/PromptUtils.js`:

```js
import { readBundledPromptFile } from '../Shared/Utils/PromptUtils.js';

const prompt = await readBundledPromptFile(rootDirectory, 'System.md');
```

**ChatState.js** (the primary prompt assembler) calls the underlying `readTextResource` directly:

```js
import { readTextResource } from '../../Shared/Storage/ResourcePaths.js';

const prompt = await readTextResource(rootDirectory, 'Prompts', 'System.md');
```

Both paths read from `Prompts/` using the resource path resolution system (works in both dev and packaged builds).

---

## Prompt Size Management

The system includes mechanisms to manage prompt size:

- `memory:get-context` limits memory context to a maximum character count
- Tool lists are dynamically generated and filtered by connector availability
- Skills context is loaded on-demand and cached
- Terminal tool names are injected as a compact comma-separated list

---

## Adding a New Prompt

1. Create the `.md` file in `Prompts/`
2. Add a reader function in `ChatState.js` (e.g., `readMyPromptFile()`)
3. Include the prompt content in the system prompt assembly
4. Use `{{PLACEHOLDER}}` syntax if dynamic content needs injection
5. Replace the placeholder in the reader function using `.replace()`
