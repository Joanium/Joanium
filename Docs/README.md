# Joanium Docs

These docs are for maintainers and contributors working inside the Joanium
desktop app repository. They describe the current source layout, runtime model,
extension points, persistence rules, and daily development workflow.

This folder is intentionally technical. User-facing help belongs in the website
docs, not here.

## Recommended Reading Order

1. [Architecture.md](Architecture.md) - how the app boots and how the runtime is assembled
2. [Features.md](Features.md) - the current product surface and capability map
3. [Data-And-Persistence.md](Data-And-Persistence.md) - where local state lives
4. [Extension-Guide.md](Extension-Guide.md) - how to add features, engines, pages, services, IPC, and integrations
5. [Where-To-Change-What.md](Where-To-Change-What.md) - practical file map for maintenance
6. [Development-Workflow.md](Development-Workflow.md) - commands, checks, build notes, and contributor workflow

## Repository Mental Model

Joanium is an Electron desktop app assembled from npm workspace packages. The
root `package.json` declares workspaces and import aliases. Workspace packages
declare what they contribute through `joanium.discovery` in their own
`package.json` files. Boot-time discovery finds those contributions and wires
them together.

The important consequence: avoid adding one-off central registries. Add the
right package, manifest, page, engine, IPC module, service, or feature
definition and let discovery assemble it.

## Main Source Areas

| Area                              | Purpose                                                                                      |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| `App.js`                          | Electron entry, runtime directory creation, first window, app startup/shutdown               |
| `Core/Electron/Bridge/Preload.js` | Safe renderer bridge for IPC, feature calls, PTY events, browser preview, and updates        |
| `Packages/Main`                   | Boot, discovery, path resolution, services, IPC modules, window helpers                      |
| `Packages/Features`               | Platform systems: AI adapter, agents, automations, channels, connectors, MCP, skills, themes |
| `Packages/Capabilities`           | External integrations and free connector capability packages                                 |
| `Packages/Pages`                  | User-facing renderer pages and shared page UI                                                |
| `Packages/Renderer`               | App shell, page discovery, navigation, modal startup, gateway startup                        |
| `Packages/System`                 | Shared contracts, state, prompt assembly, utilities, modal helpers                           |
| `Config/Models`                   | Bundled model/provider catalog                                                               |
| `SystemInstructions`              | Base prompt and related prompt configuration                                                 |
| `Skills` and `Personas`           | Bundled markdown libraries used as seeds for user libraries                                  |
| `Assets`                          | Icons and app logo assets                                                                    |
| `Scripts`                         | Build, versioning, minification, workspace audit                                             |

Generated, vendor, and runtime-heavy directories such as `.git`, `node_modules`,
and `dist` are not documentation sources.

## Current Discovery Snapshot

The app currently discovers:

- 33 workspace packages
- 16 capability discovery roots
- 31 feature manifests loaded through `FeatureRegistry`
- 4 long-lived engines: connectors, automations, agents, channels
- 9 IPC discovery roots plus main-process services
- 9 built-in pages: Chat, Setup, Automations, Agents, Skills, Marketplace, Personas, Events, Usage

Run `npm run packages:audit` whenever package structure or discovery metadata
changes.

## Key Rules

- Use ESM only. The repo has `"type": "module"`.
- Use root import aliases where available instead of long cross-package relative paths.
- Keep renderer UI in `Packages/Pages` or `Packages/Renderer`.
- Keep long-lived background behavior in engines under `Packages/Features`.
- Keep external service behavior in capability packages under `Packages/Capabilities`.
- Keep main-process APIs behind IPC.
- Keep all user data local-first and inspectable.
- Be careful in development mode: mutable app state uses the repo root as its state root.

## Quick Lookup

| If you need to...                                               | Read                                               |
| --------------------------------------------------------------- | -------------------------------------------------- |
| Understand boot and runtime assembly                            | [Architecture.md](Architecture.md)                 |
| Understand what the product currently does                      | [Features.md](Features.md)                         |
| Find chats, projects, keys, memory, MCP, and feature state      | [Data-And-Persistence.md](Data-And-Persistence.md) |
| Add a connector, page, engine, service, IPC module, or provider | [Extension-Guide.md](Extension-Guide.md)           |
| Find the exact area to edit for a bug or feature                | [Where-To-Change-What.md](Where-To-Change-What.md) |
| Run, lint, package, and audit the app                           | [Development-Workflow.md](Development-Workflow.md) |
