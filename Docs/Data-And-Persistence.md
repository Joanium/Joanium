# Data and Persistence

Joanium is local-first. User settings, chats, projects, connector credentials,
skills, personas, memory, MCP servers, usage records, agents, automations, and
channel state are stored as local files.

## State Roots

`Packages/Main/Core/Paths.js` defines two important roots.

| Root         | Development | Packaged build                     |
| ------------ | ----------- | ---------------------------------- |
| Bundled root | Repo root   | `process.resourcesPath`            |
| State root   | Repo root   | Electron `app.getPath("userData")` |

The bundled root is used for read-only packaged resources such as model
catalogs, prompt configuration, seed skills, and seed personas.

The state root is used for mutable runtime files such as settings, chats,
projects, MCP server config, usage, memory, and feature state.

## Development Warning

In development mode, the repo root is the state root. Running the app locally can
create or modify runtime files inside the repository.

Before committing, check for accidental runtime data such as:

- `Config/User.json`
- `Config/System.json`
- `Config/WindowState.json`
- `Data/**`
- `Instructions/CustomInstructions.md`
- `Memories/**`
- Edited or installed `Skills/**`
- Edited or installed `Personas/**`

Never commit personal API keys, chats, connector tokens, or personal memory.

## Main Storage Map

| Path                                             | Purpose                                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `Config/User.json`                               | User profile, setup status, API keys, local provider endpoint/model preferences, app preferences |
| `Config/System.json`                             | Reserved system-level config path                                                                |
| `Config/WindowState.json`                        | Window dimensions and placement                                                                  |
| `Config/Models/index.json`                       | Provider catalog file list                                                                       |
| `Config/Models/*.json`                           | Bundled provider/model definitions                                                               |
| `Data/Chats/*.json`                              | Global chat history                                                                              |
| `Data/Projects/<projectId>/Project.json`         | Project metadata                                                                                 |
| `Data/Projects/<projectId>/Chats/*.json`         | Project-scoped chat history                                                                      |
| `Data/Skills.json`                               | Skill enablement map                                                                             |
| `Data/ActivePersona.json`                        | Current persona selection                                                                        |
| `Data/Usage.json`                                | Token/model usage records                                                                        |
| `Data/MCPServers.json`                           | User-configured MCP servers                                                                      |
| `Data/Features/connectors/Connectors.json`       | Connector state and credentials                                                                  |
| `Data/Features/automations/Automations.json`     | Automation definitions, job history, last-run metadata                                           |
| `Data/Features/agenticAgents/AgenticAgents.json` | Agent definitions, history, last-run metadata                                                    |
| `Data/Features/channels/Channels.json`           | Channel credentials/state                                                                        |
| `Data/Features/channels/ChannelMessages.json`    | Channel message history                                                                          |
| `Instructions/CustomInstructions.md`             | User custom instructions                                                                         |
| `Memories/*.md`                                  | Personal memory markdown files                                                                   |
| `Skills/**/*.md`                                 | Installed and custom skills                                                                      |
| `Personas/**/*.md`                               | Installed and custom personas                                                                    |

Storage descriptors are declared by engines and features, then normalized by
`Packages/Features/Core/FeatureStorage.js`. Do not assume a storage folder name
always matches a package name.

## User Service

`Packages/Main/Services/UserService.js` owns:

- Default user shape
- First-run detection
- API key persistence
- Provider setting persistence
- Provider/model catalog loading
- Local model endpoint normalization
- Ollama and LM Studio model discovery

Cloud provider configuration is considered complete when an API key exists.
Local provider configuration is considered complete when the endpoint is valid
and at least one model is available or configured.

## Chat Persistence

`Packages/Main/Services/ChatService.js` stores chats as JSON files.

There are two chat buckets:

- Global chats under `Data/Chats`
- Project chats under `Data/Projects/<projectId>/Chats`

Chat save behavior:

- Validates chat IDs
- Resolves optional project ID
- Sanitizes internal tool-only messages before writing
- Marks chats for personal memory sync when user messages exist
- Stores sync markers after memory processing

## Project Persistence

`Packages/Main/Services/ProjectService.js` stores project metadata.

Each project gets:

```text
Data/Projects/<projectId>/
  Project.json
  Chats/
```

Project IDs are sanitized and path-checked before deletion. Project metadata
includes name, root path, optional context, created/updated timestamps, and
last-opened timestamp.

## Feature and Engine Storage

Feature/engine storage lives under `Data/Features`.

The storage process:

1. Engines declare `engineMeta.storage`.
2. Features declare `feature.storage`.
3. Boot collects all descriptors.
4. Duplicate storage keys throw at startup.
5. Each descriptor becomes a JSON storage handle.

Current important storage keys:

- `connectors`
- `automations`
- `agenticAgents`
- `channels`
- `channelMessages`

## Connector State

`Packages/Features/Connectors/Core/ConnectorEngine.js` stores connector state.

It merges feature-provided defaults with existing saved connector data. Service
connectors store credentials and connected timestamps. Free connectors store
enabled state, no-key flags, optional API keys, and credentials.

`getSafeCredentials()` removes sensitive fields such as access tokens, refresh
tokens, API keys, and client secrets before exposing credential previews.

## Automation State

`AutomationEngine` stores automation definitions and job history in
`Data/Features/automations/Automations.json`.

Each job keeps up to 30 history entries. Usage records from automation model
calls are written to `Data/Usage.json` and capped to the latest 20,000 records.

## Agent State

`AgentsEngine` stores agent definitions and history in
`Data/Features/agenticAgents/AgenticAgents.json`.

Each agent keeps up to 30 history entries. Runtime-only queue/running state is
not persisted.

## Channel State

`ChannelEngine` stores channel configuration in
`Data/Features/channels/Channels.json`.

Runtime-only fields such as seen WhatsApp IDs and cached Discord/Slack bot IDs
are stripped before persistence.

## Content Libraries

`Packages/Main/Services/ContentLibraryService.js` manages skills and personas.

In packaged builds:

- Seed libraries are read from `process.resourcesPath/Skills` and `process.resourcesPath/Personas`
- User libraries live under the state root in `Skills` and `Personas`
- Seed files are copied only when the user library is empty

In development:

- Seed and user library roots both resolve to the repo folders
- Editing `Skills` or `Personas` changes the active development library

Skills and personas are markdown files with optional frontmatter. Publisher
folders are part of the content ID, for example:

```text
skills:Joanium/APIDesign.md
personas:Joanium/Joana.md
```

## Personal Memory

`Packages/Main/Services/MemoryService.js` initializes and manages the
`Memories` folder.

The app creates a set of markdown memory files such as:

- `Memory.md`
- `User.md`
- `Likes.md`
- `Dislikes.md`
- `Family.md`
- `Friends.md`
- `Relationships.md`
- `Education.md`
- `Career.md`
- `Goals.md`
- `Health.md`
- `Wellbeing.md`
- `Projects.md`
- `Context.md`

Memory is plain markdown by design. It is readable, editable, and easy to back
up. Hidden files beginning with `Archive-`, `Legacy-`, or `_` are reserved and
not shown as visible memory files.

## MCP Server State

Custom MCP servers are stored in `Data/MCPServers.json`.

The builtin browser MCP server is added at runtime, so the user file represents
only custom server entries.

## Prompt Data

Runtime prompt assembly draws from:

- `SystemInstructions/SystemPrompt.json`
- `SystemInstructions/AgentPrompts.json`
- `SystemInstructions/CompactionPrompts.json`
- `SystemInstructions/MemoryPrompts.json`
- `Config/User.json`
- `Instructions/CustomInstructions.md`
- Active persona markdown
- Enabled/matched skills
- Connector and feature prompt context
- Personal memory files
- Runtime system info and date/time

Prompt caching is in `SystemPromptService`. Call prompt invalidation when
changing connector state or prompt-affecting user data.

## Packaged Resources

`electron-builder.json` packages:

- `App.js`
- `Core/**/*`
- `Packages/**/*`
- `Public/**/*`
- `Assets/**/*`
- `SystemInstructions/**/*`

It also adds these extra resources:

- `Config/Models`
- `Config/WindowState.json`
- `Skills/**/*.md`
- `Personas/**/*.md`

Packaged resources are used to bootstrap first-run state and libraries without
requiring network access.

## Backup Guidance

For a full user backup, copy these from the packaged state root:

```text
Config/User.json
Config/WindowState.json
Data/
Instructions/
Memories/
Skills/
Personas/
```

For a safer minimal backup, copy:

```text
Data/
Instructions/
Memories/
Skills/
Personas/
```

Avoid sharing `Config/User.json` publicly because it may contain API keys.

## Safe Manual Editing

When editing runtime files directly:

- Stop the app first when possible.
- Edit the smallest file needed.
- Preserve valid JSON.
- Preserve expected top-level keys.
- Back up files before changing connector, automation, agent, or channel state.
- Expect the app to rewrite some files after the next run.
