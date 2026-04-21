# Extension Guide

This guide explains how to add new behavior to Joanium while staying inside the
discovery-based architecture.

## Choose the Right Extension Point

| You want to add                       | Best extension point                                                    |
| ------------------------------------- | ----------------------------------------------------------------------- |
| External service integration          | `Packages/Capabilities/<Name>` with `Feature.js`                        |
| Chat tools for an existing service    | Existing capability package                                             |
| Connector setup and credentials       | Capability feature `connectors.services`                                |
| Free/no-auth connector                | `Packages/Capabilities/FreeConnectors/Feature.js`                       |
| Background runtime with timers/queues | `Packages/Features/<Name>/Core/*Engine.js`                              |
| Renderer-to-main API                  | `*IPC.js` under a discovered IPC root                                   |
| Reusable main-process helper          | `*Service.js` under `Packages/Main/Services` or another services root   |
| New top-level UI surface              | `Packages/Pages/<Page>/Page.js` and renderer folder                     |
| Feature-owned page                    | `pages` contribution from a feature                                     |
| New AI provider                       | `Config/Models`, setup provider UI, and `Packages/Features/AI/index.js` |
| Automation source/output              | Automation built-ins or feature automation contributions                |

## Discovery Metadata

Every package contribution starts in a workspace package `package.json`.

Use only the discovery roots that the package actually needs:

```json
{
  "name": "@Joanium/example",
  "private": true,
  "type": "module",
  "joanium": {
    "discovery": {
      "features": ["./Core"],
      "engines": ["./Core"],
      "ipc": ["./IPC"],
      "pages": ["."],
      "services": ["./Services"]
    }
  }
}
```

After adding or moving discovery roots, run:

```bash
npm run packages:audit
```

## Adding a Capability Feature

Use a capability feature when integrating a third-party service or contributing
cross-surface behavior such as connectors, tools, prompt context, and
automation hooks.

Minimal shape:

```js
import defineFeature from '../../Core/DefineFeature.js';

export default defineFeature({
  id: 'acme',
  name: 'Acme',

  connectors: {
    services: [
      {
        id: 'acme',
        name: 'Acme',
        description: 'Connect your Acme workspace',
        fields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }],
      },
    ],
  },

  renderer: {
    chatTools: [
      {
        name: 'acme_search',
        description: 'Search Acme',
        category: 'acme',
        connectorId: 'acme',
        parameters: {
          query: { type: 'string', required: true, description: 'Search query' },
        },
      },
    ],
  },

  main: {
    async executeChatTool(ctx, { toolName, params }) {
      if (toolName !== 'acme_search') return null;
      return `Result for ${params.query}`;
    },
  },

  prompt: {
    async getContext(ctx) {
      if (!ctx.connectorEngine?.isConnected?.('acme')) return null;
      return {
        connectedServices: ['Acme'],
        sections: [{ title: 'Acme', body: 'Acme is connected.' }],
      };
    },
  },
});
```

Rules:

- Feature IDs must be globally unique.
- Tool names must be globally unique.
- Connector IDs must be globally unique.
- Use `dependsOn` when extending a root feature, such as Google Workspace.
- Keep integration API logic close to the feature package.

## Adding a Service Connector

Service connectors appear in setup/settings and persist credentials through the
connector engine.

Connector definitions should include:

- `id`
- `name`
- `description`
- `icon`
- `fields`
- Optional `setupSteps`
- Optional `capabilities`
- Optional `validate`

Credential state is owned by `ConnectorEngine`. Do not store connector tokens in
renderer-only state.

## Adding a Google Workspace Sub-Service

Google Workspace is a root feature with ID `google-workspace`. Sub-services such
as Calendar and Gmail depend on it and extend the root connector.

Pattern:

```js
export default defineFeature({
  id: 'my-google-service',
  name: 'Google Example',
  dependsOn: ['google-workspace'],
  connectors: {
    serviceExtensions: [
      {
        target: 'google',
        subServices: [{ key: 'example', label: 'Example' }],
        capabilities: ['Example service support'],
      },
    ],
  },
});
```

Keep service-specific API helpers under the relevant Google subfolder.

## Adding Feature-Contributed Automation Pieces

Features can contribute data sources, output types, and instruction templates.

```js
automation: {
  dataSources: [
    { value: 'acme_updates', label: 'Acme - Updates', group: 'Acme' },
  ],
  dataSourceCollectors: {
    async acme_updates(ctx, dataSource) {
      return 'Collected Acme data';
    },
  },
  outputTypes: [
    { value: 'acme_create_item', label: 'Create Acme item', group: 'Acme' },
  ],
  outputHandlers: {
    async acme_create_item(ctx, payload) {
      return { ok: true };
    },
  },
  instructionTemplates: {
    acme_updates: 'Review these Acme updates and summarize anything actionable.',
  },
}
```

Use feature-contributed automation pieces for service-specific behavior. Use
`Packages/Features/Automation/DataSources` and `Actions` for generic platform
behavior.

## Adding an Engine

Use an engine for long-lived main-process behavior: scheduling, polling,
queues, runtime state, or persistent background systems.

```js
import defineEngine from '../../../System/Contracts/DefineEngine.js';

export const engineMeta = defineEngine({
  id: 'acme',
  provides: 'acmeEngine',
  needs: ['featureStorage'],
  storage: { key: 'acme', featureKey: 'acme', fileName: 'Acme.json' },

  create({ featureStorage }) {
    const storage = featureStorage.get('acme');
    let timer = null;

    return {
      start() {
        timer = setInterval(() => {}, 60_000);
      },
      stop() {
        clearInterval(timer);
      },
      getAll() {
        return storage.load(() => ({ items: [] }));
      },
    };
  },
});
```

Rules:

- `provides` must be unique.
- Declare every dependency in `needs`.
- Declare storage descriptors when persisting state.
- Implement `stop()` for timers, polling loops, queues, and pending promises.

## Adding IPC

Use IPC when renderer code needs main-process behavior.

```js
import { ipcMain } from 'electron';

export const ipcMeta = { needs: ['acmeEngine'] };

export function register(acmeEngine) {
  ipcMain.handle('acme:list', () => acmeEngine.getAll());
}
```

`DiscoverIPC.js` injects dependencies listed in `ipcMeta.needs`. Dependencies
can be engines, services, paths, feature registry, feature storage, and other
boot context values.

Rules:

- Keep channel names stable and specific.
- Return JSON-serializable data.
- Do validation in the main process for filesystem, shell, network, and credential operations.
- Use `wrapHandler` from main IPC modules when you want consistent `{ ok, error }` shapes.

## Adding a Service

Services are reusable main-process helpers loaded from discovered service roots.
Files ending in `Service.js` are imported and exposed to IPC injection by
camel-cased filename.

Example: `ProjectService.js` becomes `projectService`.

Use services for:

- File-backed data stores
- Shared API helpers
- Prompt or content library helpers
- App-wide state helpers

Avoid using services as renderer UI containers.

## Adding a Page

Top-level app pages are discovered from `Page.js` files.

```js
import definePage from '../../System/Contracts/DefinePage.js';

export default definePage({
  id: 'acme',
  label: 'Acme',
  icon: '<svg viewBox="0 0 24 24"></svg>',
  css: new URL('./UI/Styles/AcmePage.css', import.meta.url).href,
  order: 80,
  section: 'top',
  moduleUrl: new URL('./UI/Render/index.js', import.meta.url).href,
});
```

Expected renderer module shape:

```js
export function mount(outlet, context) {
  outlet.innerHTML = '<section>Acme</section>';
  return () => {};
}
```

Use `showInSidebar: false` for setup-like pages that should not appear in
navigation.

## Adding an AI Provider

Provider support touches three areas:

| Area            | Files                                                          |
| --------------- | -------------------------------------------------------------- |
| Catalog         | `Config/Models/index.json` and `Config/Models/<Provider>.json` |
| Setup UI        | `Packages/Pages/Setup/UI/Render/Providers/SetupProviders.js`   |
| Request adapter | `Packages/Features/AI/index.js`                                |

If the provider is OpenAI-compatible, add a catalog and setup entry first. If it
needs custom message, tool, streaming, or usage parsing behavior, extend the AI
adapter.

Local providers should set `requires_api_key: false` and use provider settings
for endpoint/model values.

## Adding Built-In Chat Tools

Built-in chat tools live under:

```text
Packages/Pages/Chat/Features/Capabilities/<Group>/
  Tools.js
  Executor.js
  Trigger.js
  ToolsList.js
```

Use this for generic, non-connector-specific tool groups. For service-specific
tools, prefer feature-contributed tools inside the capability package.

## Validation Checklist

After structural changes:

```text
[ ] npm run packages:audit
[ ] npm run lint
[ ] Start the app
[ ] Confirm boot logs have no duplicate feature/page/storage/engine IDs
[ ] Confirm the page/connector/tool/engine appears where expected
[ ] Verify packaged resources if new seed/config files were added
```

## Common Pitfalls

| Problem                             | Likely fix                                                                          |
| ----------------------------------- | ----------------------------------------------------------------------------------- |
| Feature not loading                 | Check workspace coverage and `joanium.discovery.features`                           |
| Engine not instantiating            | Check `needs`, `provides`, and storage descriptors                                  |
| IPC dependency undefined            | Check `ipcMeta.needs` and boot context key name                                     |
| Page missing from sidebar           | Check `Page.js`, `showInSidebar`, and page discovery root                           |
| Tool not available                  | Check connector enabled state, workspace-scoped filtering, and tool name uniqueness |
| Prompt context stale                | Call system prompt invalidation after connector/user state changes                  |
| State path wrong in packaged builds | Use `Paths`, not hardcoded repo paths                                               |
| Build changed source formatting     | `npm run build` minifies in place; inspect Git diff before committing               |
