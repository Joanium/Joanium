# Where To Change What

Use this map when you know the behavior you need to change and want the right
starting file.

## App Boot and Windowing

| Change                                                           | Start here                                    |
| ---------------------------------------------------------------- | --------------------------------------------- |
| Electron startup, required runtime dirs, first window, shutdown  | `App.js`                                      |
| Main boot, feature registry load, engine assembly, IPC discovery | `Packages/Main/Boot.js`                       |
| Path roots and dev vs packaged state behavior                    | `Packages/Main/Core/Paths.js`                 |
| Workspace package discovery                                      | `Packages/Main/Core/WorkspacePackages.js`     |
| Discovery root collection                                        | `Packages/Main/Core/DiscoveryManifest.js`     |
| BrowserWindow creation and page loading                          | `Packages/Main/Core/Window.js`                |
| Renderer bridge                                                  | `Core/Electron/Bridge/Preload.js`             |
| Auto-updates                                                     | `Packages/Main/Services/AutoUpdateService.js` |

## Feature Registry and Discovery

| Change                                                                  | Start here                                      |
| ----------------------------------------------------------------------- | ----------------------------------------------- |
| Feature definition shape                                                | `Packages/Capabilities/Core/DefineFeature.js`   |
| Feature loading, dependency sorting, connector/tool/automation indexing | `Packages/Capabilities/Core/FeatureRegistry.js` |
| Engine discovery                                                        | `Packages/Main/Core/EngineDiscovery.js`         |
| Engine dependency assembly                                              | `Packages/Main/Core/EngineAssembly.js`          |
| Engine start/stop lifecycle                                             | `Packages/Main/Core/EngineLifecycle.js`         |
| Feature/engine JSON storage handles                                     | `Packages/Features/Core/FeatureStorage.js`      |
| Auto-discovered IPC/service loading                                     | `Packages/Main/Core/DiscoverIPC.js`             |

## Renderer Shell, Sidebar, and Pages

| Change                                     | Start here                                       |
| ------------------------------------------ | ------------------------------------------------ |
| App shell startup and navigation           | `Packages/Renderer/Application/Main.js`          |
| Built-in and feature page merging          | `Packages/Renderer/Application/PagesManifest.js` |
| Page discovery in main process             | `Packages/Main/Core/PageDiscovery.js`            |
| Sidebar rendering                          | `Packages/Pages/Shared/Navigation/Sidebar.js`    |
| Shared renderer DOM helpers                | `Packages/Pages/Shared/Core/DOM.js`              |
| Shared styles                              | `Packages/Pages/Shared/Styles`                   |
| A page label/icon/order/sidebar visibility | That page's `Page.js`                            |
| A page's UI behavior                       | That page's `UI/Render` folder                   |
| A page's styles                            | That page's `UI/Styles` folder                   |

## Setup and Providers

| Change                                          | Start here                                                     |
| ----------------------------------------------- | -------------------------------------------------------------- |
| First-run setup page                            | `Packages/Pages/Setup`                                         |
| Provider card labels, colors, icons, and fields | `Packages/Pages/Setup/UI/Render/Providers/SetupProviders.js`   |
| Provider/model catalog                          | `Config/Models/index.json` and `Config/Models/<Provider>.json` |
| API key and provider setting persistence        | `Packages/Main/Services/UserService.js`                        |
| Provider request/stream/tool formatting         | `Packages/Features/AI/index.js`                                |
| Setup IPC                                       | `Packages/Main/IPC/SetupIPC.js`                                |
| User/profile IPC                                | `Packages/Main/IPC/UserIPC.js`                                 |

## Chat

| Change                                                    | Start here                                                                                         |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Chat page mounting and top-level UI                       | `Packages/Pages/Chat/UI/Render/index.js`                                                           |
| Model calls, tool loop, failover, skills, workspace hints | `Packages/Pages/Chat/Features/Core/Agent.js`                                                       |
| Provider API adapter                                      | `Packages/Features/AI/index.js`                                                                    |
| Tool catalog and filtering                                | `Packages/Pages/Chat/Features/Capabilities/Registry/Tools.js`                                      |
| Tool execution dispatch                                   | `Packages/Pages/Chat/Features/Capabilities/Registry/Executors.js`                                  |
| Built-in tool group                                       | `Packages/Pages/Chat/Features/Capabilities/<Group>`                                                |
| Composer attachments                                      | `Packages/Pages/Chat/Features/Composer`                                                            |
| Model selector                                            | `Packages/Pages/Chat/Features/ModelSelector`                                                       |
| Chat bubble/timeline/terminal UI                          | `Packages/Pages/Chat/Features/UI`                                                                  |
| Chat persistence                                          | `Packages/Main/Services/ChatService.js` and `Packages/Pages/Chat/Features/Data/ChatPersistence.js` |
| Browser preview UI in chat                                | `Packages/Pages/Chat/UI/Render/Features/BrowserPreview.js`                                         |
| Git bar                                                   | `Packages/Pages/Chat/UI/Render/Features/GitBar.js`                                                 |

## Workspace, Files, Terminal, and Git

| Change                              | Start here                                                                       |
| ----------------------------------- | -------------------------------------------------------------------------------- |
| Workspace inspection                | `Packages/Main/IPC/TerminalIPC.js`                                               |
| File read/write/patch tools         | `Packages/Main/IPC/TerminalIPC.js`                                               |
| Shell command risk assessment       | `Packages/Main/IPC/TerminalIPC.js`                                               |
| PTY spawning and terminal events    | `Packages/Main/IPC/TerminalIPC.js` and `Core/Electron/Bridge/Preload.js`         |
| Document extraction                 | `Packages/Main/Services/DocumentExtractionService.js`                            |
| Project metadata                    | `Packages/Main/Services/ProjectService.js` and `Packages/Main/IPC/ProjectIPC.js` |
| Git status/diff/branch/checks tools | `Packages/Main/IPC/TerminalIPC.js`                                               |
| Project modal                       | `Packages/Modals/ProjectsModal.js`                                               |

## Prompting, Skills, Personas, and Memory

| Change                        | Start here                                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------------------------- |
| Base prompt config            | `SystemInstructions/SystemPrompt.json`                                                          |
| Agent loop prompt blocks      | `SystemInstructions/AgentPrompts.json` and `Agent.js`                                           |
| System prompt assembly        | `Packages/System/Prompting/SystemPrompt.js`                                                     |
| System prompt service/cache   | `Packages/Main/Services/SystemPromptService.js`                                                 |
| Prompt config loading         | `Packages/System/Prompting/PromptConfig.js` and `Packages/Main/Services/PromptConfigService.js` |
| Skill/persona library parsing | `Packages/Main/Services/ContentLibraryService.js`                                               |
| Skills page                   | `Packages/Pages/Skills`                                                                         |
| Skills IPC                    | `Packages/Features/Skills/IPC/SkillsIPC.js`                                                     |
| Personas page                 | `Packages/Pages/Personas`                                                                       |
| Personas IPC                  | `Packages/Main/IPC/PersonasIPC.js`                                                              |
| Personal memory files         | `Packages/Main/Services/MemoryService.js`                                                       |
| Memory tool behavior          | `Packages/Pages/Chat/Features/Capabilities/Memory`                                              |
| Custom instructions path      | `Instructions/CustomInstructions.md` through `UserService`/prompt services                      |

## Automations

| Change                                      | Start here                                                    |
| ------------------------------------------- | ------------------------------------------------------------- |
| Automation engine and run loop              | `Packages/Features/Automation/Core/AutomationEngine.js`       |
| Trigger scheduling                          | `Packages/Features/Automation/Scheduling/Scheduling.js`       |
| Built-in data sources                       | `Packages/Features/Automation/DataSources`                    |
| Built-in actions/output helpers             | `Packages/Features/Automation/Actions`                        |
| UI source/output constants                  | `Packages/Pages/Automations/UI/Render/Config/Constants.js`    |
| Automation page builder                     | `Packages/Pages/Automations/UI/Render/Builders/JobBuilder.js` |
| Automation page state                       | `Packages/Pages/Automations/UI/Render/State/State.js`         |
| Automation IPC                              | `Packages/Features/Automation/IPC/AutomationIPC.js`           |
| Connector-specific automation source/output | Relevant `Packages/Capabilities/<Name>/Core/Feature.js`       |

## Agents

| Change                                       | Start here                                      |
| -------------------------------------------- | ----------------------------------------------- |
| Agent scheduling, queueing, timeout, history | `Packages/Features/Agents/Core/AgentsEngine.js` |
| Agent IPC                                    | `Packages/Features/Agents/IPC/AgentsIPC.js`     |
| Renderer execution gateway                   | `Packages/Pages/Agents/Features/Gateway.js`     |
| Agents page UI                               | `Packages/Pages/Agents`                         |
| Shared execution loop used by agents         | `Packages/Pages/Chat/Features/Core/Agent.js`    |

## Connectors and Integrations

| Change                          | Start here                                             |
| ------------------------------- | ------------------------------------------------------ |
| Connector state and credentials | `Packages/Features/Connectors/Core/ConnectorEngine.js` |
| Connector IPC                   | `Packages/Features/Connectors/IPC/ConnectorIPC.js`     |
| Free connector definitions      | `Packages/Capabilities/FreeConnectors/Feature.js`      |
| Cloudflare                      | `Packages/Capabilities/Cloudflare`                     |
| Figma                           | `Packages/Capabilities/Figma`                          |
| GitHub                          | `Packages/Capabilities/Github`                         |
| GitLab                          | `Packages/Capabilities/Gitlab`                         |
| Google root connector           | `Packages/Capabilities/Google/Feature.js`              |
| Google service behavior         | Matching folder under `Packages/Capabilities/Google`   |
| HubSpot                         | `Packages/Capabilities/HubSpot`                        |
| Jira                            | `Packages/Capabilities/Jira`                           |
| Linear                          | `Packages/Capabilities/Linear`                         |
| Netlify                         | `Packages/Capabilities/Netlify`                        |
| Notion                          | `Packages/Capabilities/Notion`                         |
| Sentry                          | `Packages/Capabilities/Sentry`                         |
| Spotify                         | `Packages/Capabilities/Spotify`                        |
| Stripe                          | `Packages/Capabilities/Stripe`                         |
| Supabase                        | `Packages/Capabilities/Supabase`                       |
| Vercel                          | `Packages/Capabilities/Vercel`                         |

## MCP and Browser Preview

| Change                           | Start here                                                  |
| -------------------------------- | ----------------------------------------------------------- |
| MCP client/session behavior      | `Packages/Features/MCP/Core/MCPClient.js`                   |
| MCP IPC                          | `Packages/Features/MCP/IPC/MCPIPC.js`                       |
| Builtin browser MCP server       | `Packages/Features/MCP/Builtin/BrowserMCPServer.js`         |
| Browser preview main service     | `Packages/Main/Services/BrowserPreviewService.js`           |
| Browser preview IPC              | `Packages/Features/BrowserPreview/IPC/BrowserPreviewIPC.js` |
| Browser preview chat integration | `Packages/Pages/Chat/UI/Render/Features/BrowserPreview.js`  |

## Channels

| Change                                | Start here                                         |
| ------------------------------------- | -------------------------------------------------- |
| Channel polling/reply engine          | `Packages/Features/Channels/Core/ChannelEngine.js` |
| Channel IPC                           | `Packages/Features/Channels/IPC/ChannelsIPC.js`    |
| Renderer gateway for inbound messages | `Packages/Pages/Channels/Features/Gateway.js`      |
| Channel message persistence           | `ChannelEngine` storage and `ChannelsIPC.js`       |

## Marketplace

| Change                                        | Start here                                        |
| --------------------------------------------- | ------------------------------------------------- |
| Marketplace API fetch/install behavior in app | `Packages/Main/Services/MarketplaceService.js`    |
| Marketplace IPC                               | `Packages/Main/IPC/MarketplaceIPC.js`             |
| Marketplace page UI                           | `Packages/Pages/Marketplace`                      |
| Installed content parsing                     | `Packages/Main/Services/ContentLibraryService.js` |

## Events and Usage

| Change                    | Start here                      |
| ------------------------- | ------------------------------- |
| Usage read/write IPC      | `Packages/Main/IPC/UsageIPC.js` |
| Usage page                | `Packages/Pages/Usage`          |
| Background history page   | `Packages/Pages/Events`         |
| Automation history writes | `AutomationEngine.js`           |
| Agent history writes      | `AgentsEngine.js`               |

## Modals and Shared UI

| Change              | Start here                            |
| ------------------- | ------------------------------------- |
| Settings modal      | `Packages/Modals/SettingsModal.js`    |
| About modal         | `Packages/Modals/AboutModal.js`       |
| Chat/library modal  | `Packages/Modals/LibraryModal.js`     |
| Projects modal      | `Packages/Modals/ProjectsModal.js`    |
| History modal       | `Packages/Modals/HistoryModal.js`     |
| HTML preview modal  | `Packages/Modals/HtmlPreviewModal.js` |
| Modal factory       | `Packages/System/ModalFactory.js`     |
| Confirmation dialog | `Packages/System/ConfirmDialog.js`    |

## Packaging, Build, and Release

| Change                   | Start here                             |
| ------------------------ | -------------------------------------- |
| Packaged files/resources | `electron-builder.json`                |
| Version stamping         | `Scripts/SetVersionByDate.mjs`         |
| Build command            | `Scripts/Build.mjs`                    |
| In-place minification    | `Scripts/Minify.mjs`                   |
| Workspace audit          | `Scripts/AuditWorkspacePackages.mjs`   |
| App icons                | `Assets/Logo`                          |
| CI lint workflow         | `.github/workflows/ci.yml`             |
| Release upload           | `.github/workflows/upload-release.yml` |

## Rule of Thumb

| The change feels...                 | Start in...                                                    |
| ----------------------------------- | -------------------------------------------------------------- |
| Integration-specific                | `Packages/Capabilities`                                        |
| Runtime/background-oriented         | `Packages/Features`                                            |
| Main-process API or persistence     | `Packages/Main`                                                |
| User interface only                 | `Packages/Pages`                                               |
| App shell/navigation                | `Packages/Renderer`                                            |
| Shared contract/helper              | `Packages/System`                                              |
| Prompt/persona/skill/memory-related | Prompt and content library services                            |
| Provider/model-related              | `Config/Models`, setup provider UI, and `Packages/Features/AI` |
