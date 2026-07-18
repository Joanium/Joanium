# Providers

AI provider management — configuration, model catalogs, and runtime selection.

---

## Architecture

```text
Providers Package
├── Index.js                      — IPC bootstrap and handler registration
├── Core/
│   ├── ProviderState.js         — Reads and writes provider state; runs background sync
│   └── ModelFavouritesState.js — Persists per-provider model favourites
├── I18n/
│   └── en.js                    — Provider UI strings
└── UI/
    └── ProvidersPanel.js        — Provider connection and catalog UI
```

The catalog builder itself lives in `Packages/Shared/ProviderCatalog/` and is consumed by chat, setup, and UI flows.

---

## Supported Providers

The current catalog contains 35 provider definitions from `Config/Models/index.json`.

### Cloud providers

| Provider | Type |
|---|---|
| OpenAI | Cloud |
| Anthropic | Cloud |
| Google (Gemini) | Cloud |
| xAI (Grok) | Cloud |
| Mistral | Cloud |
| Cohere | Cloud |
| DeepSeek | Cloud |
| Groq | Cloud |
| Fireworks | Cloud |
| Together | Cloud |
| Perplexity | Cloud |
| AI21 | Cloud |
| Alibaba | Cloud |
| MiniMax | Cloud |
| Moonshot | Cloud |
| Writer | Cloud |
| StepFun | Cloud |
| ZAI | Cloud |

### Aggregators

| Provider | Type |
|---|---|
| OpenRouter | Aggregator |
| Requesty | Aggregator |
| GitHub Models | Gateway |
| Vercel AI Gateway | Gateway |
| MuleRouter | Gateway |
| Poe | Gateway |

### Local providers

| Provider | Type |
|---|---|
| Ollama | Local |
| LM Studio | Local |

### Specialized

| Provider | Type |
|---|---|
| Cerebras | Specialized |
| HuggingFace | Specialized |
| Hyperbolic | Specialized |
| Lambda | Specialized |
| Novita | Specialized |
| Nvidia | Specialized |
| Parasail | Specialized |
| SambaNova | Specialized |
| SiliconFlow | Specialized |

---

## Provider Catalog

`Config/Models/index.json` is an array of provider JSON filenames. Each provider is read from `Config/Models/<ProviderName>/<ProviderName>.json` and converted into a runtime catalog record with:

- provider ID and display label
- endpoint and auth metadata
- model list and summary fields
- tint/glow palette for the UI
- requirements metadata (`apiKey` or `endpoint`)

The runtime builder in `Packages/Shared/ProviderCatalog/ProviderCatalog.js` exposes fields such as `id`, `label`, `endpoint`, `requiresApiKey`, `type`, `modelCount`, `models`, `featuredModels`, `summary`, `iconPath`, `palette`, and `requirements`.

---

## Provider State

`ProviderState.js` manages the persisted provider configuration in `Data/User.json` via `readUserState()` and `writeUserState()`.

It stores:

- `providers.selected` — the list of enabled provider IDs
- `providers.details` — per-provider credentials, currently consisting of `apiKey` and/or `endpoint`

### State Shape

```js
{
  providers: {
    selected: ['openai', 'anthropic'],
    details: {
      openai: {
        apiKey: 'sk-...',
        endpoint: 'https://api.openai.com/v1/chat/completions',
      },
      anthropic: {
        apiKey: 'sk-ant-...',
      },
    },
  },
}
```

`saveProvider()` writes only the relevant field for the provider type: `apiKey` for providers that require one, or `endpoint` for local providers. The implementation does not persist a `selectedModel` field.

### Background Sync

- delayed by 15 seconds on startup to avoid boot interference
- no-op in packaged builds
- runs with a 1-hour TTL per provider (tracked by `_syncedAt` inside each provider JSON)
- fetches the latest model list from the provider API
- invalidates the in-memory catalog cache after sync

---

## Model Favourites

`ModelFavouritesState.js` manages favourited model IDs per provider:

- persists to `Data/ModelFavourites.json` in the writable data directory
- returns a normalized `{ providerId, modelId, addedAt }` list
- supports toggle on/off per model

---

## IPC Handlers (6 channels)

| Channel | Purpose |
|---|---|
| `providers:list-catalog` | Return the full provider catalog with model metadata |
| `providers:list-configured` | Return configured providers plus their saved credentials state |
| `providers:save` | Save provider config and trigger a provider-model sync |
| `providers:remove` | Remove provider config |
| `providers:list-model-favourites` | List favourited models |
| `providers:toggle-model-favourite` | Toggle model favourite status |

---

## Model Sync

When a provider is saved, `Packages/Shared/ProviderCatalog/ModelSync.js` can immediately sync that provider's model catalog from its API. The sync logic:

- runs only in unpackaged builds
- merges live provider models into the curated JSON while preserving existing metadata
- skips non-chat model slugs such as image and audio models
- uses `_syncedAt` to avoid re-syncing until the 1-hour TTL expires

---

## Provider Selection in Chat

`ChatState.js` resolves the provider catalog and then routes requests through one of three paths:

1. `streamGoogleMessage()` for Google-style providers
2. `streamAnthropicMessage()` for Anthropic
3. `streamOpenAiCompatibleMessage()` for the rest of the OpenAI-compatible providers

The provider list is determined from the runtime catalog, and the chat layer uses the provider's endpoint plus auth headers to format requests.

---

## Provider Utils

`ProviderUtils.js` provides:

- `orderProvidersBySelection(user, providers)` — sorts providers according to the persisted selection order
- `providerIsConfigured(provider, details = {})` — checks whether a provider has the required endpoint/API key and at least one model entry

---

## Provider Catalog UI

The provider UI consumes the catalog data from the IPC layer and renders:

- tint/glow palette cards for each provider
- provider connection state and credentials form
- model lists and favourite toggles
