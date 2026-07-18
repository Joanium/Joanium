# Memory System

Long-term personal memory stored as markdown files in `Data/Memories/`.

---

## Architecture

```text
Memory Package
├── Index.js              — IPC handlers
├── Core/
│   ├── MemoryState.js    — CRUD operations
│   └── MemoryCleanup.js  — Automatic deduplication and dream journal
└── I18n/
    └── en.js             — Memory strings
```

---

## Memory Storage

Memory files are stored as markdown in `Data/Memories/`. Each file represents a memory topic or category.

### Memory File Format

```markdown
# Memory Topic

## Key Facts
- Fact 1
- Fact 2

## Preferences
- Preference 1
- Preference 2

## Context
- Contextual information
```

---

## IPC Handlers (16 channels)

| Channel | Purpose |
|---|---|
| `memory:list` | List all memory files |
| `memory:read` | Read a memory file |
| `memory:save` | Save/update a memory file |
| `memory:search` | Search memories by query |
| `memory:get-context` | Get memory context for AI (max chars) |
| `memory:get-catalog` | Memory catalog |
| `memory:get-export-prompt` | Prompt for exporting memory |
| `memory:get-triage-prompt` | Prompt for triaging memory |
| `memory:get-import-prompt` | Prompt for importing memory |
| `memory:apply-updates` | Apply AI-generated memory updates |
| `memory:delete` | Delete a memory file |
| `memory:cleanup-ai-reply` | Handle AI cleanup response |
| `memory:cleanup-renderer-ready` | Renderer ready for cleanup |
| `memory:run-cleanup` | Trigger memory cleanup |
| `memory:list-dreams` | List dream journal entries |
| `memory:read-dream` | Read a dream journal entry |

---

## Memory Context for AI

`memory:get-context` returns a compact representation of memories for the AI's system context. This is limited to a maximum number of characters to avoid overwhelming the AI.

The memory context is included in the system prompt by `ChatState.js`.

---

## Auto Memory Updates

After saved non-private chat sessions, `History` marks sessions as pending memory sync:

1. Session is saved to history
2. `History` marks session as pending memory sync (`history:list-memory-pending`)
3. Background sync uses `Prompts/Memory.md` to extract durable user facts
4. `memory:apply-updates` writes facts back to `Data/Memories`
5. Session is marked as memory-synced (`history:mark-memory-synced`)

This ensures the AI remembers important information across conversations.

---

## Memory Triage

The triage system (`memory:get-triage-prompt`) helps organize and consolidate memories:

- Identifies duplicate information
- Merges related memories
- Removes outdated information
- Maintains a clean, useful memory store

---

## Memory Cleanup

`MemoryCleanup.js` handles automatic deduplication:

- Cleanup service starts automatically on package creation
- Triggered via `memory:run-cleanup` (force mode)
- Uses AI to identify redundant memories
- Merges or removes duplicates
- Maintains memory quality over time

The cleanup flow:

1. `memory:run-cleanup` triggers cleanup
2. Cleanup service loads memory catalog
3. AI identifies redundant/duplicate memories
4. `memory:cleanup-ai-reply` processes AI response
5. Updates are applied via `memory:apply-updates`

---

## Dream Journal

The dream system provides periodic AI consolidation of memories:

- `memory:list-dreams` — List dream journal entries
- `memory:read-dream` — Read a dream journal entry

Dreams are stored in `Data/Dreams/` and represent AI-generated summaries of memory patterns.

---

## Memory Export/Import

- `memory:get-export-prompt` — Generates a prompt for exporting memories
- `memory:get-import-prompt` — Generates a prompt for importing memories

This allows users to move memories between installations.

---

## Memory Search

`memory:search` provides full-text search across all memory files. Used by the AI to recall specific information when needed.

---

## Memory in System Prompt

`ChatState.js` includes memory context in the system prompt:

```text
## Memory
<compact memory context from memory:get-context>
```

This gives the AI access to long-term memory during conversations.

---

## Memory Privacy

- Memory sync only happens for non-private sessions
- Users can disable auto memory updates in settings
- Memory files are stored locally, never sent to cloud
- Users can manually edit memory files in `Data/Memories/`
