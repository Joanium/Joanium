# Conventions

Code style, commit conventions, and common patterns.

For architecture rules and forbidden patterns, see [Rules.md](Rules.md).

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

## Running Checks

```bash
npm run lint       # ESLint
npm run format     # Prettier
npm run check      # All checks (lint + format + cpd + lint:md + check:arch + check:deps)
```

Always run `npm run lint` and `npm run format` before finishing any changes.

---

## Helpers and Utils

- If a file has helper functions supporting main logic, keep it in `Utils.js`
- Small single-line prompts go in `Prompts/Prompts.js`
- Longer prompts go in `Prompts/` folder as separate markdown files
