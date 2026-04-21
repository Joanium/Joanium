# Joanium Features

This document maps the current Joanium product surface to the source code that
implements it.

## Product Surfaces

| Surface     | Location                     | User-facing role                                                          |
| ----------- | ---------------------------- | ------------------------------------------------------------------------- |
| Chat        | `Packages/Pages/Chat`        | Main AI workspace with models, files, tools, project context, and history |
| Setup       | `Packages/Pages/Setup`       | First-run profile and model provider setup                                |
| Automations | `Packages/Pages/Automations` | Scheduled jobs that collect data, run AI, and perform outputs             |
| Agents      | `Packages/Pages/Agents`      | Reusable scheduled prompts that can run against projects                  |
| Skills      | `Packages/Pages/Skills`      | Enable, disable, delete, and manage local skill markdown files            |
| Marketplace | `Packages/Pages/Marketplace` | Browse and install marketplace skills/personas                            |
| Personas    | `Packages/Pages/Personas`    | Activate personas and start chats with a chosen voice/behavior            |
| Events      | `Packages/Pages/Events`      | Unified history for background runs and failures                          |
| Usage       | `Packages/Pages/Usage`       | Local token and model usage analytics                                     |

## Model Providers

Provider setup is defined in
`Packages/Pages/Setup/UI/Render/Providers/SetupProviders.js`. Provider catalogs
are loaded from `Config/Models`.

Current providers:

- Anthropic
- OpenAI
- Google Gemini
- OpenRouter
- Mistral
- NVIDIA
- DeepSeek
- MiniMax
- Groq
- xAI
- Cohere
- Together AI
- Perplexity
- Cerebras
- Ollama
- LM Studio

Cloud providers store API keys in `Config/User.json`. Local providers store
endpoint/model preferences in `provider_settings` and do not require API keys.
Ollama defaults to `http://127.0.0.1:11434`. LM Studio defaults to
`http://127.0.0.1:1234`.

## Chat

Chat is both the primary user experience and the shared orchestration layer for
agents and channel replies.

Current chat capabilities:

- Provider/model selection and model failover
- Streaming text responses
- Reasoning stream support where providers expose it
- Tool calling for Anthropic, Google, and OpenAI-compatible APIs
- Single and parallel tool call execution
- Tool category expansion with `request_tool_categories`
- MCP tool discovery and execution
- Feature-contributed integration tools
- Workspace-aware prompts when a project is active
- Git and filesystem tools when a workspace is active
- File attachments and document text extraction
- Personal memory search/read tools
- Conversation summary context
- Skills selected by enabled skill trigger matching
- Persona-driven prompt behavior
- Sub-agent orchestration tools
- Browser preview/tool support
- Guardrails for irreversible browser actions
- Local chat persistence and usage tracking

Important files:

- `Packages/Pages/Chat/Features/Core/Agent.js`
- `Packages/Features/AI/index.js`
- `Packages/Pages/Chat/Features/Capabilities/Registry/Tools.js`
- `Packages/Pages/Chat/Features/Capabilities/Registry/Executors.js`
- `Packages/Pages/Chat/Features/Composer`
- `Packages/Main/Services/ChatService.js`
- `Packages/Main/Services/DocumentExtractionService.js`

## Built-In Chat Tool Groups

Built-in tool groups are under
`Packages/Pages/Chat/Features/Capabilities`.

Major groups:

- Workspace and terminal tools
- Search tools for web and package registries
- Utility tools for math, units, time, UUID, hashes, base64, JSON, and text stats
- Personal memory tools
- Sub-agent tools
- Weather
- Crypto
- Finance
- Wikipedia
- Geolocation
- Fun facts
- Jokes
- Quotes
- Countries
- Astronomy and NASA imagery
- Hacker News
- URL helpers
- Dictionary
- Date/time helpers
- Password generation
- npm registry
- Stack Overflow

Workspace-scoped tools are hidden unless a project/workspace path is active.
Connector-scoped tools are filtered by connector enabled state.

## Automations

Automations are scheduled workflows. Each automation has one primary model and
up to five jobs. Each job has a trigger, one or more data sources, an
instruction, an output, history, and last-run metadata.

Supported triggers:

- Interval, with minutes
- Hourly
- Daily at a time
- Weekly by day and time
- On startup
- Manual "run now"

Built-in data sources:

- RSS / Atom feed
- Reddit subreddit posts
- Hacker News top stories
- Fetch URL
- Weather
- Crypto price
- System stats
- Read local file
- Custom context

Built-in outputs:

- Send email through Gmail
- Desktop notification
- Write to a file
- Append to personal memory
- HTTP webhook / POST

Feature packages can add more data sources and outputs. Current
connector-contributed automation sources include GitHub, GitLab, Gmail,
Cloudflare, Figma, HubSpot, Jira, Linear, Netlify, Notion, Sentry, Spotify,
Stripe, Supabase, and Vercel.

Important files:

- `Packages/Features/Automation/Core/AutomationEngine.js`
- `Packages/Features/Automation/Scheduling/Scheduling.js`
- `Packages/Features/Automation/DataSources`
- `Packages/Pages/Automations/UI/Render/Config/Constants.js`
- `Packages/Features/Automation/IPC/AutomationIPC.js`

## Agents

Agents are scheduled prompts. They use the renderer-side chat/agent loop for
execution, so they have access to the same models, tools, skills, personas, and
project context behavior as chat.

An agent stores:

- Name
- Description
- Prompt
- Enabled state
- Primary model
- Trigger
- Optional workspace path or project snapshot
- Last run
- Up to 30 history entries

The agents engine queues runs, allows up to three concurrent runs, dispatches
work to the renderer through `scheduled-agent-run`, and records the final
result. A single agent run has a 24-hour timeout.

Important files:

- `Packages/Features/Agents/Core/AgentsEngine.js`
- `Packages/Features/Agents/IPC/AgentsIPC.js`
- `Packages/Pages/Agents/Features/Gateway.js`
- `Packages/Pages/Agents`

## Connectors

The connector engine stores connector state and credentials in local JSON. The
setup and settings UI are built from feature registry connector payloads.

Current service connectors:

- Cloudflare
- Figma
- GitHub
- GitLab
- Google Workspace
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

Google Workspace includes service extensions for Calendar, Contacts, Docs,
Drive, Forms, Gmail, Photos, Sheets, Slides, Tasks, and YouTube.

Free connectors:

- No key: Open-Meteo, CoinGecko, Exchange Rate, US Treasury Rates, Wikipedia, IP Geolocation, Fun Facts, Jokes, Quotes, Countries, Hacker News, CleanURI URL Shortener
- Key required: NASA, FRED Economic Data, OpenWeatherMap, Unsplash

Important files:

- `Packages/Features/Connectors/Core/ConnectorEngine.js`
- `Packages/Features/Connectors/IPC/ConnectorIPC.js`
- `Packages/Capabilities/*/Core/Feature.js`
- `Packages/Capabilities/FreeConnectors/Feature.js`

## Integration Tool Coverage

Feature inspection shows broad chat tool coverage across integrations:

- Cloudflare: zones, accounts, DNS, cache, firewall, workers, pages, analytics
- Figma: files, nodes, thumbnails, comments, components, styles, projects
- GitHub: repos, issues, PRs, commits, releases, workflows, reviews, actions, orgs
- GitLab: projects, issues, merge requests, files, commits, releases, pipelines
- Google Calendar: events, free slots, recurring events, attendees, calendar settings
- Google Contacts: profiles, contacts, birthdays, companies, groups
- Google Docs: read/write documents, styles, lists, tables, named ranges
- Google Drive: list/search/read/create files and folders, storage
- Google Forms: forms, responses, summaries, answer analysis
- Gmail: send/read/search/reply/forward/drafts/labels/thread actions
- Google Photos: albums, media items, shared albums, search by date/category
- Google Sheets: read/write ranges, sheets, rows, columns, formulas, formatting
- Google Slides: read/create/edit slides, text, images, shapes, tables, notes
- Google Tasks: task lists, tasks, bulk actions, due date views
- YouTube: channels, videos, playlists, subscriptions, comments, analytics-style actions
- HubSpot: contacts, deals, companies, tickets, pipelines, owners
- Jira: issues, comments, projects, boards, sprints, backlogs, users
- Linear: issues, teams, projects, cycles, comments, labels, states, priorities
- Netlify: sites, deploys, hooks, forms, functions, domains, env vars
- Notion: pages, blocks, databases, properties, comments, users
- Sentry: issues, events, projects, releases, alert rules, teams, orgs
- Spotify: playback, playlists, tracks, artists, albums, recommendations
- Stripe: balance, charges, customers, subscriptions, invoices, payments, products, events
- Supabase: projects, orgs, schemas, tables, SQL, functions, storage
- Vercel: projects, deployments, domains, env vars, teams, aliases, logs

## MCP

MCP support lives under `Packages/Features/MCP`.

Supported MCP behavior:

- Builtin browser MCP server
- Custom stdio servers
- Custom HTTP servers
- Server persistence in `Data/MCPServers.json`
- Auto-connect at startup
- Tool listing and tool calls through IPC
- MCP tools merged into chat's available tool list

Important files:

- `Packages/Features/MCP/Core/MCPClient.js`
- `Packages/Features/MCP/IPC/MCPIPC.js`
- `Packages/Features/MCP/Builtin/BrowserMCPServer.js`

## Channels

Channels let external messages route into the same renderer orchestration used
by chat.

Supported channels:

- Telegram
- WhatsApp through Twilio
- Discord
- Slack

The channel engine polls enabled channels, sends inbound messages to the
renderer through `channel-incoming`, waits for the renderer-generated reply, and
sends the reply back through the platform API.

Important files:

- `Packages/Features/Channels/Core/ChannelEngine.js`
- `Packages/Features/Channels/IPC/ChannelsIPC.js`
- `Packages/Pages/Channels/Features/Gateway.js`

## Skills, Personas, and Marketplace

Skills and personas are markdown libraries.

Skills:

- Stored in `Skills/**/*.md`
- Enablement persisted in `Data/Skills.json`
- Enabled skills are matched to user text by trigger/name/description
- Up to three matched skills are injected into the runtime prompt

Personas:

- Stored in `Personas/**/*.md`
- Active persona stored in `Data/ActivePersona.json`
- A default persona is chosen from the local library when no explicit persona is active

Marketplace:

- Fetches marketplace skills/personas from `https://www.joanium.com/api/marketplace`
- Installs content into local user libraries
- Uses the same markdown parsing and library services as local content

Important files:

- `Packages/Main/Services/ContentLibraryService.js`
- `Packages/Features/Skills/IPC/SkillsIPC.js`
- `Packages/Main/IPC/PersonasIPC.js`
- `Packages/Main/Services/MarketplaceService.js`
- `Packages/Pages/Skills`
- `Packages/Pages/Personas`
- `Packages/Pages/Marketplace`

## Usage and Observability

Joanium stores local usage and background history.

- Chat usage records are written through `UsageIPC`
- Automation usage records are written by `AutomationEngine`
- Agent and automation history is stored with each agent/job
- Events page combines running/background history
- Usage page reads `Data/Usage.json`

Important files:

- `Packages/Main/IPC/UsageIPC.js`
- `Packages/Pages/Usage`
- `Packages/Pages/Events`
- `Packages/Features/Automation/Core/AutomationEngine.js`
- `Packages/Features/Agents/Core/AgentsEngine.js`
