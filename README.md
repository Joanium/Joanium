# Romelson

> One interface. Every AI. Think clearly. Build faster. Create freely.

Romelson is a personal desktop AI platform built on Electron. It brings together multiple AI providers, a powerful automation engine, Gmail and GitHub integrations, custom AI personas, and a skill system — all in a single offline-first app where your data stays on your machine.

---

## What It Does

- **Chat with any AI** — Claude, GPT-4, Gemini, Mistral, DeepSeek, and more. Switch models mid-conversation. Automatic failover keeps you unblocked when one API goes down.
- **Automate your world** — Schedule actions (open sites, send emails, run scripts, create GitHub issues, hit webhooks) on startup, hourly, daily, or weekly.
- **Connect Gmail and GitHub** — Ask "read my unread emails" or "show my open PRs" directly in chat. The AI has full context of your inbox and repos.
- **Personas** — Swap AI personalities (Atlas the execution coach, Cassian the negotiator, Elio the empath, etc.) to match the kind of help you need.
- **Skills** — Markdown-defined capabilities the AI applies automatically — debugging guides, API design patterns, copywriting frameworks, and more.
- **Usage analytics** — Full token tracking, cost breakdowns by model and provider, hourly heatmaps, and auto-generated insights.
- **Free APIs out of the box** — Weather, crypto prices, exchange rates, US Treasury data, FRED economic indicators, and Unsplash photos — no key required for most.

---

## Quick Start

```bash
# Prerequisites: Node.js 18+, npm

git clone https://github.com/withinJoel/Romelson
cd Romelson
npm install
npm start
```

On first launch, a setup wizard walks you through adding your API keys. Everything is stored locally in `Data/` — nothing leaves your machine.

---

## Project Layout

```
Romelson/
├── App.js                        # Electron main process entry point
├── package.json
│
├── Packages/
│   ├── Main/                     # Main process logic
│   │   ├── IPC/                  # IPC handler modules (one file per domain)
│   │   ├── Services/             # Business logic (UserService, ChatService, etc.)
│   │   ├── Paths.js              # All file-system paths in one place
│   │   └── Window.js             # BrowserWindow management
│   ├── Automation/               # Automation engine + action executors
│   ├── Connectors/               # ConnectorEngine (credentials, free APIs)
│   └── System/                   # SystemPrompt builder, app properties
│
├── Public/                       # Renderer process (HTML + CSS + JS)
│   ├── index.html                # Main chat page
│   ├── Automations.html
│   ├── Skills.html
│   ├── Personas.html
│   ├── Usage.html
│   ├── Setup.html
│   └── Assets/
│       ├── Scripts/
│       │   ├── Pages/            # Page-level entry scripts
│       │   ├── Features/         # Feature modules (Chat, ModelSelector, etc.)
│       │   └── Shared/           # State, DOM refs, utils, modals, sidebar
│       └── Styles/               # CSS (one file per feature area)
│
├── Data/                         # All user data (gitignored in prod)
│   ├── User.json
│   ├── Models.json
│   ├── Connectors.json
│   ├── Automations.json
│   ├── ActivePersona.json
│   ├── Usage.json
│   ├── Memory.md
│   ├── CustomInstructions.md
│   └── Chats/                    # One JSON file per chat session
│
├── Skills/                       # Skill definition files (.md with frontmatter)
├── Personas/                     # Persona definition files (.md with frontmatter)
└── Docs/                         # Documentation (you are here)
```

---

## Supported AI Providers

| Provider | Models | Requires |
|---|---|---|
| Anthropic | Claude Opus 4.6, Sonnet 4.6, Haiku 4.5 | API key |
| OpenAI | GPT-4o, o1, GPT-4 Turbo, o3-mini, GPT-4o Mini | API key |
| Google | Gemini 1.5 Pro, 2.0 Flash, 1.5 Flash | API key |
| OpenRouter | DeepSeek R1, Mistral Large, Llama 3.3, Qwen 2.5, Gemma 3 | API key |
| Mistral AI | Mistral Large, Codestral, Mistral Small | API key |

---

## Documentation

See the `Docs/` folder for everything:

| Doc | What it covers |
|---|---|
| [Architecture.md](Docs/Architecture.md) | How the app is structured, data flow, IPC model |
| [Features.md](Docs/Features.md) | Every feature explained in depth |
| [Automations.md](Docs/Automations.md) | Building and debugging automations |
| [Connectors.md](Docs/Connectors.md) | Gmail, GitHub, and free API setup |
| [Skills.md](Docs/Skills.md) | Writing and installing new skills |
| [Personas.md](Docs/Personas.md) | Creating custom AI personas |
| [IPC-Reference.md](Docs/IPC-Reference.md) | All IPC channels and their signatures |
| [Development.md](Docs/Development.md) | Dev environment, adding features, conventions |

---

## Built by

[Joel Jolly](https://joeljolly.vercel.app) — Licensed MIT
