# Development Workflow

This document covers day-to-day development, validation, packaging, and release
checks for the Joanium desktop app.

## Requirements

- Node.js 24 or newer
- npm workspaces
- Git
- Platform requirements for Electron builds when packaging locally

The app is ESM-only JavaScript. Do not add TypeScript or a bundler unless that
is an explicit architecture decision.

## Install and Run

```bash
npm install
npm start
npm run dev
```

`npm start` launches Electron normally. `npm run dev` launches Electron with the
`--dev` flag.

On Windows PowerShell, if script execution blocks npm shims, use:

```bash
cmd /c npm run dev
```

## Available Scripts

| Script                   | Purpose                                                            |
| ------------------------ | ------------------------------------------------------------------ |
| `npm start`              | Launch Electron                                                    |
| `npm run dev`            | Launch Electron with `--dev`                                       |
| `npm run lint`           | Run ESLint across the repo                                         |
| `npm run format`         | Run Prettier across the repo                                       |
| `npm run packages:audit` | Validate workspace discovery metadata and print package edges      |
| `npm run version:date`   | Set date-based package version                                     |
| `npm run minify:dry`     | Preview in-place minification savings                              |
| `npm run build`          | Date-stamp version, minify in place, package with electron-builder |

There is no root `test` script at the moment, even though Jest is installed.
Use targeted Jest commands only when tests exist for the touched area.

## Normal Contributor Flow

1. Read the relevant doc in this folder.
2. Reproduce or inspect the current behavior.
3. Identify the owning area: Main, Features, Capabilities, Pages, Renderer, or System.
4. Make the smallest coherent change in the owning package.
5. Run `npm run packages:audit` if package structure, discovery roots, pages, IPC, services, features, or engines changed.
6. Run `npm run lint` after JavaScript changes.
7. Manually verify the affected flow in the Electron app.
8. Check `git status` for runtime files before committing.

## Discovery Hygiene

Run `npm run packages:audit` after:

- Adding a workspace package
- Moving package folders
- Adding `Feature.js`
- Adding `*Engine.js`
- Adding `*IPC.js`
- Adding `Page.js`
- Adding `*Service.js`
- Changing any `joanium.discovery` root

The audit script checks:

- Workspace package count
- Discovery summary
- Missing discovery declarations for detected contribution files
- Missing discovery roots
- Cross-package relative imports

## Development State Hygiene

Development mode uses the repo root as the mutable state root.

Watch for accidental changes in:

```text
Config/User.json
Config/System.json
Config/WindowState.json
Data/
Instructions/
Memories/
Skills/
Personas/
```

Before committing:

```bash
git status --short
git diff --staged
```

Do not commit personal API keys, chat history, connector credentials, MCP
servers, usage records, or personal memory.

## Linting

Run:

```bash
npm run lint
```

CI runs the same lint command on Node 24.

Common lint-sensitive areas:

- ESM import ordering and unused imports
- Browser globals in renderer code
- Electron/main-process globals
- Minified source that is still tracked in Git

## Formatting

Run:

```bash
npm run format
```

The repo uses Prettier and Husky/lint-staged. Avoid formatting unrelated files
when making focused changes unless the formatting command is part of the task.

## Manual Verification Matrix

| Change area     | Suggested manual checks                                                  |
| --------------- | ------------------------------------------------------------------------ |
| Boot/discovery  | Start app, inspect boot logs, open sidebar pages                         |
| Setup/providers | First-run setup, save keys, local provider endpoint/model discovery      |
| Chat            | Send message, stream response, run at least one relevant tool            |
| Files/workspace | Open project, inspect workspace, read/write safe test file               |
| Automations     | Save automation, run now, inspect job history                            |
| Agents          | Save agent, run now, inspect agent history                               |
| Connectors      | Connect/disconnect test connector, verify prompt/tool availability       |
| MCP             | Add/connect server, list tools, call simple tool                         |
| Channels        | Validate credentials and check gateway behavior with a safe test channel |
| Skills/personas | Enable skill, activate persona, verify prompt behavior                   |
| Marketplace     | Load list, open detail, install item                                     |
| Usage/events    | Run something that records usage/history and confirm UI updates          |

## Packaging

`electron-builder.json` controls packaging.

Current targets:

- Windows: NSIS installer, x64, artifact `Joanium.exe`
- macOS: DMG, x64 and arm64, artifact `Joanium.dmg`
- Linux: AppImage, x64, artifact `Joanium.AppImage`

Packaged source files:

- `App.js`
- `Core/**/*`
- `Packages/**/*`
- `Public/**/*`
- `Assets/**/*`
- `SystemInstructions/**/*`

Extra resources:

- `Config/Models`
- `Config/WindowState.json`
- `Skills/**/*.md`
- `Personas/**/*.md`

## Build Warning

`npm run build` runs:

```text
node ./Scripts/SetVersionByDate.mjs
node ./Scripts/Minify.mjs
npx electron-builder
```

`Scripts/Minify.mjs` minifies JavaScript, CSS, and HTML in place under `App.js`,
`Core`, and `Packages`. Inspect the Git diff after building. If you only needed
to package locally, do not accidentally commit minified source changes unless
that is intended.

Use `npm run minify:dry` to preview minification without writing files.

## Versioning

`Scripts/SetVersionByDate.mjs` writes a three-part date-based semver to
`package.json`.

Format:

```text
YYYY.<month*100+day>.<patch>
```

Example for April 21, 2026:

```text
2026.421.0
```

If the package already has the same date prefix, the patch component is reused.

## CI

`.github/workflows/ci.yml` currently:

- Checks out the repo
- Sets up Node 24
- Runs `npm install`
- Runs `npm run lint`

Keep local lint passing before opening a pull request.

## Packaging and Release Files

| Purpose              | File                                     |
| -------------------- | ---------------------------------------- |
| Build script         | `Scripts/Build.mjs`                      |
| Minification         | `Scripts/Minify.mjs`                     |
| Versioning           | `Scripts/SetVersionByDate.mjs`           |
| Packaging config     | `electron-builder.json`                  |
| Release upload       | `.github/workflows/upload-release.yml`   |
| Release announcement | `.github/workflows/announce-release.yml` |
| Changelog sync       | `.github/workflows/sync-changelog.yml`   |

## Common Debug Starting Points

| Symptom                       | Start here                                                          |
| ----------------------------- | ------------------------------------------------------------------- |
| App fails on launch           | `App.js` and `Packages/Main/Boot.js`                                |
| Page missing or sidebar wrong | `Packages/Renderer/Application/PagesManifest.js` and page `Page.js` |
| IPC handler unavailable       | `Packages/Main/Core/DiscoverIPC.js` and owning `*IPC.js`            |
| Connector not shown           | Owning `Feature.js` and `FeatureRegistry.js`                        |
| Tool not available            | `Tools.js`, connector state, `Registry/Tools.js`                    |
| Model call failing            | `Packages/Features/AI/index.js` and provider catalog                |
| Automation not running        | `AutomationEngine.js` and `Scheduling.js`                           |
| Agent not running             | `AgentsEngine.js` and renderer gateway                              |
| MCP tools missing             | `MCPClient.js`, `MCPIPC.js`, and `Data/MCPServers.json`             |
| State saved in wrong place    | `Paths.js`                                                          |

## Good Habits

- Keep package boundaries clear.
- Prefer discovery metadata over central wiring.
- Keep connector API behavior in capability packages.
- Keep renderer pages focused on UI and user interaction.
- Keep persistent runtime systems in engines.
- Use `Paths` for all state/resource locations.
- Invalidate prompt cache when prompt-affecting data changes.
- Treat chat orchestration changes as high-impact.
