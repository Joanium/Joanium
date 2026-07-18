# Rules

Architecture rules, code style, and forbidden patterns. Never break these.

---

## Architecture Rules

### 1. No Cross-Package Imports

Packages are microservices. `Packages/Chat` must never import from `Packages/Memory`. If something is shared, it lives in `Packages/Shared`.

```js
// WRONG
import { something } from '../Memory/Core/SomeFile.js';

// RIGHT
import { something } from '../Shared/SomeModule.js';
```

### 2. ESM Only

Never use `require()` or `module.exports`. Always use `import`/`export`.

```js
// WRONG
const fs = require('fs');
module.exports = { something };

// RIGHT
import fs from 'node:fs';
export { something };
```

### 3. No i18n Hardcoding

No user-facing strings in JS or HTML. All text comes from `I18n/` files inside each package. English is the default and fallback.

```js
// WRONG
element.textContent = 'Settings';

// RIGHT
import { t } from '../I18n/Index.js';
element.textContent = t('settings');
```

### 4. No AI Prompts or Tool Schemas in I18n

`I18n/` is only for user-facing UI text and runtime messages. AI-facing prompt text, tool
descriptions, parameter descriptions, and tool schemas must live in `Prompt.js`, `Tools.js`, or
`Core/Chat/Tools.js` depending on the package pattern.

```js
// WRONG
const strings = {
  tools: [{ name: 'service_action', description: 'AI-facing tool description.' }],
};

// RIGHT
export const SERVICE_TOOLS = [
  { name: 'service_action', description: 'AI-facing tool description.' },
];
```

### 5. No HTML Attributes That Expose the DOM

No `data-*` attributes, no `title` attributes (triggers native browser tooltip — looks wrong in a desktop app).

```html
<!-- WRONG -->
<div data-id="123" title="Click here">

<!-- RIGHT -->
<div class="item">
```

### 6. Index.js Is the Only Public Entry

Every package has an `Index.js`. It is the only public entry point. Nothing outside a package imports its inner files (`Core/`, `UI/`, `IPC/`).

```js
// WRONG (from another package)
import { something } from '../Chat/Core/ChatState.js';

// RIGHT
import ChatPackage from '../Chat/Index.js';
```

### 7. Auto-Discovery, Never Hardcoding

Packages are discovered dynamically. Do not hardcode package names in the bootstrap or registry.

```js
// WRONG
const packages = ['Chat', 'Memory', 'Toolset'];

// RIGHT
const packages = discoverPackages(packagesDirectory);
```

### 8. Helpers Go in Utils.js

If a file has helper functions supporting main logic, they go in `Utils.js` alongside it.

### 9. Update Docs

Always update the docs if you make any major changes.

### 10. Test

Always test your changes.

---

## Code Style

- **Quotes**: Single quotes
- **Semicolons**: Yes
- **Indentation**: 2 spaces
- **Line endings**: LF
- **Arrow parens**: Always (`(x) => x`)
- **Max line length**: 100 characters
- **Dead code**: None — no commented-out blocks
- **Formatting**: Prettier + ESLint

---

## Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
feat: add Gemini provider support
fix: resolve crash on empty chat history
chore: bump electron to 43.1.1
docs: update README setup steps
refactor: simplify package bootstrap logic
```

| Type | Description |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `chore` | Maintenance task |
| `docs` | Documentation |
| `refactor` | Code restructuring |
| `test` | Adding tests |
| `style` | Formatting changes |

---

## What Not To Do

- Do not add React, Vue, or any UI framework
- Do not use CommonJS (`require`/`module.exports`)
- Do not hardcode user-facing strings in JS or HTML
- Do not import across packages — use `Packages/Shared` instead
- Do not add `data-*` or `title` attributes to DOM elements
- Do not skip `Index.js` and import inner package files directly
- Do not hardcode package names — use auto-discovery
- Do not keep unused code
- Do not take shortcuts
- Do not add comments unless asked
- Do not add features, refactor, or introduce abstractions beyond what the task requires

---

## Running Checks

```bash
npm run lint       # ESLint
npm run format     # Prettier
npm run check      # All checks (lint + format + cpd + lint:md + check:arch + check:deps)
```

Always run `npm run lint` and `npm run format` before finishing any changes.

---

## File Structure Cheatsheet

```text
Packages/<Name>/
├── Index.js        ← only file other code may import
├── Core/           ← backend logic
├── UI/             ← renderer process (HTML/CSS/JS)
├── IPC/            ← IPC handlers
├── I18n/           ← all user-facing strings
└── Utils.js        ← helpers (only if needed)
```

---

## Common Patterns

### IPC Handler (main process)

```js
ipcMain.handle('package:action', async (_event, payload) => {
  // logic
  return result;
});
```

### IPC Call (renderer process)

```js
const result = await window.Joanium.ipc.invoke('package:action', payload);
```

### I18n Usage

```js
import { t } from '../I18n/Index.js';
element.textContent = t('key');
```

### Package Factory

```js
export function createPackage() {
  return {
    id: 'PackageName',
    ipcHandlers: [
      {
        channel: 'package:action',
        handler: async (_event, payload) => {
          // logic
          return result;
        },
      },
    ],
  };
}
```

---

## Path Resolution

In packaged builds, `extraResources` files (Data, Skills, Personas) are at `process.resourcesPath`, not the app root. Always use:

```js
import { getWritableDataDirectory } from '../Shared/Storage/ResourcePaths.js';
const dataDir = getWritableDataDirectory(rootDirectory);
```

---

## Folder Roles

| Folder | Purpose | Read/Write | Packaging |
|---|---|---|---|
| `Packages/` | All features. Each is an independent package. | Read (code) | Inside asar |
| `Packages/Shared/` | Code used by more than one package. | Read (code) | Inside asar |
| `Assets/` | Images, audio, video. | Read-only | Inside asar |
| `Config/` | App config files (model catalogs). | Read-only | Inside asar |
| `Data/` | User data. | Read-write | Outside asar |
| `Datasets/` | Static datasets (greetings, suggestions). | Read-only | Inside asar |
| `Personas/` | AI persona markdown files. | Read-write | Outside asar |
| `Prompts/` | System prompt markdown files. | Read-only | Inside asar |
| `Scripts/` | Build scripts only. | Read-only | N/A |
| `Skills/` | AI skill markdown files. | Read-write | Outside asar |
| `Docs/` | Developer documentation. | Read-only | N/A |

---

## Helpers and Utils

- If a file has helper functions supporting main logic, keep it in `Utils.js`
- Small single-line prompts go in `Prompts/Prompts.js`
- Longer prompts go in `Prompts/` folder as separate markdown files
