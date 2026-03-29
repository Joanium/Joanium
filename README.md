# Joanium

> Your desktop AI workspace. Local-first, project-aware, and built to actually help you get work done. ⚡

**Website:** [Joanium.com](https://joanium.com)

Joanium is a desktop AI app built with Electron for people who want more than a chat box in a shiny wrapper. It brings together multi-model chat, real project folders, automations, AI agents, MCP servers, connectors, skills, personas, and local data storage in one focused workspace.

It is serious software with range. Fast when you need speed, flexible when your workflow gets weird, and local-first by default so your machine still feels like yours.

## What Joanium Actually Gives You

- 🤖 **Multi-model chat** that does more than answer prompts.
- 📁 **Project-aware tooling** with files, terminal, git, and workspace context.
- ⏱️ **Automations** for repeatable tasks you do not want to babysit.
- 🧠 **AI agents** for monitoring, summaries, triage, and recurring analysis.
- 🔌 **Live connectors** like Gmail and GitHub that bring real context into the app.
- 🛠️ **MCP servers, skills, and personas** so the app can adapt to how you work.
- 🔒 **Local-first storage** under `Data/`, so your chats and runtime state stay on your machine.

## Why It Hits Different

- **Not another disposable AI tab**  
  Joanium is designed like a workspace, not a demo.

- **Built for real workflows**  
  Chat connects to projects, tools, automations, agents, and external context instead of living in isolation.

- **Power without turning into chaos**  
  The architecture stays modular, so the app can grow without becoming a spaghetti pile.

- **Personality without losing credibility**  
  It is flexible, expressive, and useful without feeling gimmicky.

## Core Areas

- 💬 **Chat** - multi-model conversations with tools, connectors, and MCP support.
- 🗂️ **Projects** - workspace-aware context with project-scoped chats and tooling.
- ⚙️ **Automations** - scheduled action chains for deterministic work.
- 🧠 **Agents** - scheduled AI jobs that collect data, reason over it, and produce outputs.
- 📡 **Events** - a live operational timeline for runs, failures, skips, and active jobs.
- 📚 **Skills** - local Markdown-based behavior packs that shape how the assistant works.
- 🎭 **Personas** - switch the assistant's identity, tone, and framing.
- 📈 **Usage** - local visibility into model activity and cost.

## Quick Start

```bash
# Prerequisites: Node.js 18+ and npm

git clone <repository-url>
cd <repository-folder>
npm install
npm start
```

On first launch, Joanium walks through setup and stores local app data inside `Data/`.

## Project Structure

```text
Joanium/
|-- App.js
|-- package.json
|-- Packages/
|   |-- Main/          # Electron-facing services, IPC, paths, windows
|   |-- Renderer/      # SPA shell, pages, shared state, feature modules
|   |-- Automation/    # Scheduler and action execution
|   |-- Agents/        # Scheduled AI jobs and job history
|   |-- Channels/      # External channel responders
|   |-- Connectors/    # AI providers, Gmail, GitHub, and other integrations
|   |-- MCP/           # MCP runtime support
|   `-- System/        # Shared system prompt and app-level logic
|-- Public/            # App shells and static assets
|-- Data/              # Local user data, chats, projects, usage, config
|-- Skills/            # Installed skill definitions
|-- Personas/          # Persona definitions
`-- Docs/              # Architecture and feature documentation
```

## Documentation

The [`Docs/`](Docs/) folder covers the current runtime and feature set in depth.

- [`Docs/Architecture.md`](Docs/Architecture.md) - startup flow, package boundaries, renderer routing, and persistence
- [`Docs/Features.md`](Docs/Features.md) - chat, projects, automations, agents, events, skills, personas, and usage
- [`Docs/Projects.md`](Docs/Projects.md) - workspace behavior and project-scoped chat storage
- [`Docs/Automations.md`](Docs/Automations.md) - triggers, actions, and execution rules
- [`Docs/Agents.md`](Docs/Agents.md) - scheduled AI jobs, inputs, outputs, and history
- [`Docs/Connectors.md`](Docs/Connectors.md) - providers, Gmail, GitHub, and connector setup
- [`Docs/Channels.md`](Docs/Channels.md) - external channel reply flow
- [`Docs/MCP.md`](Docs/MCP.md) - MCP server support and tool surfacing
- [`Docs/Development.md`](Docs/Development.md) - extension patterns and implementation guidance

## Current Status

Joanium is actively being built and sharpened. The foundation is already here: the app shell, project-aware workflows, scheduled runtimes, connector support, and the local-first persistence model that ties everything together.

## Built By

[Joel Jolly](https://joeljolly.vercel.app)  
MIT License
