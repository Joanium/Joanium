# Build System

Build scripts, versioning, electron-builder config, CI/CD, and packaging strategy.

---

## Build Scripts

Located in `Scripts/`:

| Script | Purpose |
|---|---|
| `Build.mjs` | Production build entry point |
| `SetVersionByDate.mjs` | Date-based version stamping |
| `CheckArch.mjs` | Architecture rule validation |
| `CheckDeps.mjs` | Dependency validation |
| `Docs.mjs` | Auto-generates PACKAGES.md from source |
| `Fuses.cjs` | Electron security fuses (afterSign hook) |
| `NewPackage.mjs` | Package scaffolding |

---

## Build Commands

```bash
npm start                    # Run the app in development
npm start --debug            # Run with debug logging
npm run build                # Production build
npm run lint                 # Check for lint errors
npm run format               # Auto-format code
npm run format:check         # Check formatting
npm run lint:md              # Lint markdown files
npm run cpd                  # Check for copy-paste duplication
npm run check:arch           # Validate architecture rules
npm run check                # Run all checks
npm run test                 # Run fuzz tests
```

---

## Version Stamping

`SetVersionByDate.mjs` stamps `package.json` with a date-based version:

```text
YYYY.MMDD.patch
```

Example: `2026.715.0`

The 2-part base version is written to stdout so CI can append its own counter.

---

## electron-builder Configuration

`electron-builder.json`:

- **App ID**: `com.joanium.app`
- **ASAR**: Enabled
- **afterSign**: Runs `Scripts/Fuses.cjs`
- **extraResources**: Data, Skills, Personas
- **Targets**:
  - Windows: NSIS installer
  - macOS: DMG
  - Linux: AppImage
- **Publish**: GitHub Releases

---

## File Packaging Strategy

### Inside asar (`files`)

- `App.js` — main entry point
- `Assets/` — images, audio, video
- `Packages/` — all package code
- `Datasets/` — static datasets
- `Prompts/` — system prompts
- `Config/` — model catalogs

### Outside asar (`extraResources`)

- `Data/` — user data (ships only seed/static files)
- `Skills/` — AI skill markdown files
- `Personas/` — AI persona markdown files

### Excluded from build

User-generated data (chats, memories, agents, channels, projects, security, avatar, usage) is excluded via filters that mirror `.gitignore`.

---

## Electron Fuses

`Fuses.cjs` is an afterSign hook that flips 6 Electron security fuses:

- `RunAsNode`: OFF — disables `ELECTRON_RUN_AS_NODE`
- `CookieEncryption`: ON — encrypts session cookies at rest
- `NodeOptionsEnvironmentVariable`: OFF — blocks `NODE_OPTIONS` env var injection
- `NodeCliInspectArguments`: OFF — blocks `--inspect` debugger attachment
- `EmbeddedAsarIntegrityValidation`: ON — verifies ASAR hash at startup
- `OnlyLoadAppFromAsar`: ON — refuses to load code from outside the ASAR

---

## Architecture Validation

`CheckArch.mjs` validates architecture rules:

- Every package has `Index.js`
- No cross-package imports (except Shared/Boot)
- Package structure compliance

---

## Dependency Validation

`CheckDeps.mjs` validates:

- No unused dependencies
- No missing dependencies
- Version compatibility

---

## Documentation Generation

`Docs.mjs` generates documentation from code comments and structure.

---

## Package Scaffolding

`NewPackage.mjs` scaffolds new packages with the standard layout:

```text
Packages/<Name>/
├── Index.js
├── Core/
├── UI/
├── IPC/
├── I18n/
└── Utils.js
```

---

## CI/CD

`.github/workflows/Release.yml`:

- **Trigger**: Manual (`workflow_dispatch`)
- **Steps**:
  1. Version and tag
  2. Create a draft GitHub release
  3. Fan out to parallel jobs:
     - Windows (NSIS installer)
     - macOS (DMG)
     - Linux (AppImage)
  4. Each job calls `electron-builder --publish always` with `GH_TOKEN`
  5. Publish the release only after all platform uploads succeed

---

## Debug Mode

Start with `npm start --debug` or `JOANIUM_DEBUG=1 npm start`:

- Verbose main-process diagnostics to terminal
- Debug logs to `Build/Logs/debug.log`
- Logs: package discovery, tool inventory, prompt sizes, provider/model selection
- Logs each Toolset execution with duration and sanitized parameters

---

## Linting

### ESLint

`eslint.config.js`:

- Flat config format
- Ignores `dist/`, `node_modules/`, `Data/`
- Uses `eslint-plugin-unused-imports` to error on unused imports, warn on unused vars

### Prettier

Single quotes, semicolons, 2-space indent, LF line endings, `arrowParens: always`, max line length 100.

### Markdownlint

Lints all markdown files except `node_modules`, `Data`, `Skills`, `Personas`.

---

## Husky

Pre-commit hooks via Husky:

- `lint-staged` runs on staged files
- JS/MJS: ESLint fix + Prettier
- JSON/CSS: Prettier
- MD: Prettier + markdownlint fix
