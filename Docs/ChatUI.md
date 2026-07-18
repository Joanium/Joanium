# Chat UI Components

Renderer-side UI components for the chat interface.

---

## Architecture

```text
Packages/Chat/UI/
├── ChatApp.js              — Main chat orchestrator (message management, tool loop, streaming)
├── ChatApp.css             — Chat styles
├── MessageElements.js      — Message rendering, avatars, streaming updates
├── TerminalPanel.js        — Terminal tool output display
├── ThinkingBlock.js        — AI thinking/reasoning block display
├── SubAgentSections.js     — Sub-agent task cards and results
├── ModelPickerPanel.js     — Provider/model selection panel
├── AttachmentPill.js       — File attachment pills
├── BrowserPreviewPanel.js  — Live browser preview in chat
├── TechFeedPanel.js        — Tech news feed panel
├── DiagnosticPanel.js      — Provider diagnostics and latency testing
├── DropZoneOverlay.js      — Drag-and-drop file overlay
├── FileDiffTracker.js      — File change tracking and diff display
├── GitBranchPickerPanel.js — Git branch selection panel
├── WhatsNewOverlay.js      — What's new changelog overlay
├── Utils.js                — Chat UI utilities
└── Shared/
    └── DefaultSearchInfo.js — Search info display
```

---

## ChatApp.js

The main chat orchestrator. Responsibilities:

- **Message management**: User/assistant message history, streaming state
- **Tool loop execution**: Parses AI tool calls, executes via IPC, feeds results back
- **Sub-agent delegation**: Spawns sub-agents for complex tasks
- **Provider streaming**: Handles SSE streaming from AI providers
- **Session management**: Save/load/fork chat sessions
- **Attachment handling**: File picker, drag-and-drop, image attachments
- **Mode management**: Slash command modes, persona activation
- **Project context**: Loads project documentation for context

### Key Methods

- `sendMessage()` — Sends user message, triggers AI completion
- `streamMessage()` — Streams AI response with tool loop
- `executeToolLoop()` — Parses and executes tool calls from AI response
- `saveSession()` — Persists chat to `Data/Chats/`
- `loadSession()` — Loads a previous chat session
- `forkSession()` — Creates a branch from a previous message

---

## MessageElements.js

Handles rendering of chat messages:

- `createMessageElement()` — Creates a user or assistant message bubble
- `createAssistantGroupElement()` — Groups consecutive assistant messages
- `createUserAvatar()` — Renders user avatar
- `updateLastStreamingMessage()` — Updates assistant message during streaming
- `updateSubAgentCard()` — Updates sub-agent task card with results

---

## TerminalPanel.js

Displays terminal tool output in chat:

- `createChatTerminalPanel()` — Creates the terminal output panel
- `createTerminalCallElement()` — Creates a single terminal call card (used by MessageElements.js)
- `formatTerminalResultForModel()` — Formats terminal output for AI context
- `getTerminalActionSummary()` — Short summary of terminal action
- `getTerminalToolLabel()` — Human-readable tool name

Terminal tools are displayed as collapsible cards showing:

- Tool name and parameters
- Execution output
- Success/error status

---

## ThinkingBlock.js

Renders AI thinking/reasoning blocks:

- Extracts `<think>` tags from AI responses
- Displays thinking as a collapsible section
- Supports streaming thinking updates

---

## SubAgentSections.js

Renders sub-agent task cards:

- Task title and goal
- Progress indicators
- Result synthesis
- Collapsible detail sections

---

## ModelPickerPanel.js

Provider and model selection:

- `createModelPickerPanel()` — Creates the model picker UI
- `getPreferredProvider()` — Resolves the preferred provider/model

Shows configured providers with model selection, tint/glow colors, and capability badges.

---

## AttachmentPill.js

File attachment display:

- Shows attached files as pills in the chat input
- Supports images, documents, code files
- Click to remove attachment

---

## BrowserPreviewPanel.js

Live browser preview embedded in chat:

- Renders the LiveBrowser view within the chat layout
- Shows current URL, navigation controls
- AI can interact with the browser via tools

---

## DiagnosticPanel.js

Provider diagnostics and latency testing:

- `createDiagnosticPanel()` — Creates the diagnostic UI
- `measureFetch()` — Measures API endpoint latency
- `resolveProviderBaseUrl()` — Resolves provider API base URL

Tests provider connectivity, measures response times, and displays diagnostics.

---

## FileDiffTracker.js

Tracks file changes made by AI tools:

- Shows before/after content for modified files
- Diff visualization
- File change history within a session

---

## GitBranchPickerPanel.js

Git branch selection:

- `createGitBranchPickerPanel()` — Creates branch picker UI
- `orderGitBranches()` — Sorts branches (current first, then alphabetically)

---

## WhatsNewOverlay.js

Changelog display:

- Shows new features and changes
- Marks as seen to avoid repeat display
- Reads from changelog data

---

## DropZoneOverlay.js

Drag-and-drop file handling:

- Visual overlay when files are dragged over the chat
- Processes dropped files for attachment

---

## Utils.js

Shared chat UI utilities:

- Text formatting helpers
- Date/time formatting
- Clipboard operations

---

## Component Lifecycle

All UI components follow the same pattern:

```js
export function createComponent(container, options) {
  const element = document.createElement('div');
  // ... setup
  container.appendChild(element);

  return {
    update(newData) { /* ... */ },
    destroy() { element.remove(); },
  };
}
```

Components are created by `ChatApp.js` and destroyed when the chat session changes.
