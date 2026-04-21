# Joanium Architecture

This document explains how Joanium is assembled, what runs in each process, and
how the main surfaces connect to providers, tools, integrations, and local
state.

## Big Idea

Joanium is a local-first Electron desktop app composed from discoverable
workspace packages. It is not organized around one large app file or one manual
registry. The boot layer discovers package contributions, builds the runtime
context, starts engines, registers IPC, then lets the renderer discover and
mount pages.

The architecture is built around five composition points:

- Workspace package discovery from the root `package.json`
- Feature manifests loaded by `FeatureRegistry`
- Engine metadata loaded from `*Engine.js`
- IPC modules loaded from `*IPC.js`
- Page manifests loaded from `Page.js`

## Runtime Layers

| Layer               | Main location                                                      | Responsibility                                                                       |
| ------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Electron entry      | `App.js`                                                           | App lifecycle, runtime directories, first window, auto-updates, boot handoff         |
| Main process        | `Packages/Main`                                                    | Discovery, engine assembly, services, IPC, paths, window creation                    |
| Platform features   | `Packages/Features`                                                | AI calls, agents, automations, channels, connectors, MCP, skills                     |
| Capability packages | `Packages/Capabilities`                                            | External integrations, free connectors, chat tools, automation hooks, prompt context |
| Renderer shell      | `Packages/Renderer`                                                | Page discovery, sidebar, modals, navigation, channel/agent gateways                  |
| Renderer pages      | `Packages/Pages`                                                   | Chat, setup, automations, agents, skills, personas, marketplace, events, usage       |
| Shared system       | `Packages/System`                                                  | Contracts, prompt assembly, state, utility helpers                                   |
| Local state         | `Config`, `Data`, `Memories`, `Skills`, `Personas`, `Instructions` | User-owned and runtime-owned local files                                             |

## Boot Sequence

Startup begins in `App.js`.

1. Electron flags are set, including HTTP/2 disablement and the app user agent.
2. External navigation is guarded so external URLs open in the system browser.
3. Runtime directories are created under the current state root.
4. A first window is created immediately. It loads setup on first run and chat otherwise.
5. Content libraries are initialized.
6. Personal memory files are initialized.
7. `boot()` from `Packages/Main/Boot.js` runs discovery and engine assembly.
8. Engines are started.
9. Existing windows receive attached services and a `backend-ready` event.
10. The system prompt is warmed in the background.
11. MCP auto-connect runs in the background.
12. Shutdown stops engines before the app quits.

## Main Boot

`Packages/Main/Boot.js` is the main assembly point.

It performs these steps:

- Loads feature manifests from `FEATURE_DISCOVERY_ROOTS`
- Discovers engines from `ENGINE_DISCOVERY_ROOTS`
- Builds feature and engine storage handles with `createFeatureStorageMap`
- Creates the base boot context containing paths, feature registry, storage, user service, and prompt invalidation
- Instantiates engines in dependency order using their `needs` and `provides`
- Sets feature registry base context so features can access connectors, storage, paths, and events
- Runs feature lifecycle hooks such as `onBoot`
- Discovers and registers IPC modules, injecting requested services and engines
- Returns the runtime context used by `App.js`

## Discovery Pipeline

Discovery starts in `Packages/Main/Core/WorkspacePackages.js`.

The root `package.json` declares workspace globs:

```json
["Core/Electron", "Packages/*", "Packages/Capabilities/*", "Packages/Features/*"]
```

Each workspace package can declare a `joanium.discovery` section:

```json
{
  "joanium": {
    "discovery": {
      "features": ["./Core"],
      "engines": ["./Core"],
      "ipc": ["./IPC"],
      "pages": ["."],
      "services": ["./Services"]
    }
  }
}
```

`DiscoveryManifest.js` collects existing roots for each discovery kind. The rest
of the app consumes those frozen root lists.

## Feature Registry

`Packages/Capabilities/Core/FeatureRegistry.js` loads all discovered
`Feature.js` files, validates feature IDs, topologically sorts features by
`dependsOn`, and indexes what each feature contributes.

A feature can contribute:

- Service connectors for setup and settings
- Free connectors that are enabled by default or require only optional keys
- Chat tools exposed to the renderer-side agent loop
- Automation data sources
- Automation output types
- Automation instruction templates
- Feature-owned pages
- Prompt context sections
- Lifecycle hooks
- Storage descriptors
- Main-process methods invoked through `feature:invoke`

This is why one integration package can show up in many product surfaces at
once. For example, GitHub contributes connector setup, chat tools, prompt
context, automation data sources, and automation outputs from one feature
package.

## Engines

Engines are long-lived runtime systems discovered from files ending in
`Engine.js`. Engine metadata is normalized through `defineEngine`.

Current engines:

| Engine       | Provides           | Storage key                   | Main responsibility                                                  |
| ------------ | ------------------ | ----------------------------- | -------------------------------------------------------------------- |
| `connectors` | `connectorEngine`  | `connectors`                  | Connector credential state and enabled/free connector state          |
| `automation` | `automationEngine` | `automations`                 | Scheduled job execution, data collection, AI calls, outputs, history |
| `agents`     | `agentsEngine`     | `agenticAgents`               | Scheduled autonomous prompts, renderer dispatch, run history         |
| `channels`   | `channelEngine`    | `channels`, `channelMessages` | Telegram, WhatsApp, Discord, and Slack polling/replies               |

Engines may depend on context values using `needs`. `EngineAssembly.js`
instantiates them only when their dependencies are available.

## IPC and Preload

Main-process IPC modules are discovered from `*IPC.js` files. Each module exports
`register(...)`, and optionally `ipcMeta.needs` to request dependencies from the
boot context.

`Core/Electron/Bridge/Preload.js` exposes two renderer bridges:

- `window.electronAPI` for generic IPC calls, sends, event listeners, PTY events, browser preview events, and update events
- `window.featureAPI` for feature boot payloads, feature method invocation, and feature event subscriptions

The renderer should not import main-process services directly. Use IPC.

## Renderer Shell

The renderer starts in `Packages/Renderer/Application/Main.js`.

It:

- Loads feature boot payloads
- Registers feature-contributed pages
- Discovers built-in pages from the main process
- Builds the page map and sidebar navigation
- Initializes settings, about, library, and projects modals
- Starts channel and scheduled-agent gateways
- Opens a fresh chat
- Handles keyboard shortcuts

`PagesManifest.js` merges built-in pages and feature pages, then sorts them by
page order.

## Built-In Pages

| Page        | Purpose                                                                    |
| ----------- | -------------------------------------------------------------------------- |
| Chat        | Main AI workspace, model switching, project context, tools, files, history |
| Setup       | First-run profile and provider setup                                       |
| Automations | Scheduled data-driven jobs                                                 |
| Agents      | Scheduled autonomous prompts                                               |
| Skills      | Local skill library controls                                               |
| Marketplace | Remote skills and personas browser/install flow                            |
| Personas    | Persona activation and library management                                  |
| Events      | Background execution history                                               |
| Usage       | Local usage analytics                                                      |

## Chat Runtime

The chat page is the main orchestration surface and is reused by scheduled
agents and channel replies.

The main loop in `Packages/Pages/Chat/Features/Core/Agent.js`:

- Resolves selected provider/model and fallback candidates
- Loads enabled skills and matches relevant skills by trigger text
- Loads workspace/project summary when a project is active
- Builds a prompt from system instructions, persona, skills, workspace state, connected service context, memory policy, and tool policy
- Loads available tools from built-ins, feature-contributed tools, and MCP servers
- Filters tools by connected connector state and active workspace state
- Streams model responses
- Handles single and parallel tool calls
- Supports tool category expansion through `request_tool_categories`
- Supports model failover and rate-limit backoff
- Guards potentially irreversible browser actions with confirmation
- Tracks usage and returns final text to the UI

## AI Provider Adapter

`Packages/Features/AI/index.js` handles provider-specific request formatting and
stream parsing.

Current provider catalogs live in `Config/Models`:

- Anthropic
- OpenAI
- Google
- OpenRouter
- Mistral
- NVIDIA
- DeepSeek
- MiniMax
- Groq
- xAI
- Cohere
- Together
- Perplexity
- Cerebras
- Ollama
- LM Studio

Anthropic, Google, and OpenAI-compatible providers have separate message/tool
formatters. Ollama and LM Studio use local OpenAI-compatible endpoints and can
discover local models at runtime.

## Capabilities and Connectors

Capability packages live under `Packages/Capabilities`.

Current service connectors:

- Cloudflare
- Figma
- GitHub
- GitLab
- Google Workspace and its service extensions
- HubSpot
- Jira
- Linear
- Netlify
- Notion
- Sentry
- Spotify
- Stripe
- Supabase
- Vercel

Google Workspace is a root feature. Calendar, Contacts, Docs, Drive, Forms,
Gmail, Photos, Sheets, Slides, Tasks, and YouTube extend it through service
extensions and `dependsOn: ["google-workspace"]`.

Free connectors are defined in `Packages/Capabilities/FreeConnectors/Feature.js`.
Some require no key, while NASA, FRED, OpenWeatherMap, and Unsplash require API
keys.

## Local-First State

`Packages/Main/Core/Paths.js` controls state and bundled resource roots.

- Development state root: repo root
- Packaged state root: Electron `app.getPath("userData")`
- Development bundled root: repo root
- Packaged bundled root: `process.resourcesPath`

See [Data-And-Persistence.md](Data-And-Persistence.md) before changing state
paths, seed libraries, storage descriptors, or prompt-related data.

## Architectural Risks

- Development mode writes runtime state into the repo root.
- Chat orchestration changes affect chat, scheduled agents, channels, tools, MCP, memory, and usage tracking.
- Feature storage keys must be globally unique across features and engines.
- Discovery relies on naming conventions: `Feature.js`, `*Engine.js`, `*IPC.js`, `Page.js`, `*Service.js`.
- Connector-specific behavior can span setup UI, connector state, prompt context, chat tools, and automation hooks.
- Minification is in-place during production builds. Keep source readable in Git and verify build scripts carefully.
