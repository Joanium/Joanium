import path from 'path';
import {
  ensureDir,
  ensureParentDir,
  loadJson,
  loadText,
  persistJson,
  persistText,
} from '../Core/FileSystem.js';
import Paths from '../Core/Paths.js';
const DEFAULT_USER = {
    name: '',
    setup_complete: !1,
    created_at: null,
    api_keys: {},
    provider_settings: {},
    preferences: {
      theme: 'light',
      default_provider: null,
      default_model: null,
      default_page: 'chat',
    },
    app_settings: {
      run_on_startup: false,
      system_tray: false,
      keep_awake: false,
      app_lock_idle_minutes: 15,
      app_language: 'en',
    },
  },
  LOCAL_PROVIDER_RUNTIME = {
    lmstudio: {
      defaultEndpoint: 'http://127.0.0.1:1234/v1/chat/completions',
      modelTemplate: {
        description: 'Local model served through LM Studio',
        rank: 1,
        context_window: 128e3,
        max_output: 4096,
        inputs: { text: !0, image: !0, pdf: !1, docx: !1 },
        pricing: { input: 0, output: 0 },
      },
    },
    ollama: {
      defaultEndpoint: 'http://127.0.0.1:11434/v1/chat/completions',
      modelTemplate: {
        description: 'Local model served through Ollama',
        rank: 1,
        context_window: 128e3,
        max_output: 4096,
        inputs: { text: !0, image: !0, pdf: !1, docx: !1 },
        pricing: { input: 0, output: 0 },
      },
    },
  };
export function ensureDataDir() {
  ensureDir(Paths.DATA_DIR);
}
function merge(existing = {}, updates = {}) {
  return {
    ...DEFAULT_USER,
    ...existing,
    ...updates,
    api_keys: {
      ...DEFAULT_USER.api_keys,
      ...(existing.api_keys ?? {}),
      ...(updates.api_keys ?? {}),
    },
    provider_settings: {
      ...DEFAULT_USER.provider_settings,
      ...(existing.provider_settings ?? {}),
      ...(updates.provider_settings ?? {}),
    },
    preferences: {
      ...DEFAULT_USER.preferences,
      ...(existing.preferences ?? {}),
      ...(updates.preferences ?? {}),
    },
    app_settings: {
      ...DEFAULT_USER.app_settings,
      ...(existing.app_settings ?? {}),
      ...(updates.app_settings ?? {}),
    },
  };
}
function getLocalProviderRuntime(providerId) {
  return LOCAL_PROVIDER_RUNTIME[providerId] ?? null;
}
function toOpenAICompatibleBaseUrl(endpoint) {
  return String(endpoint ?? '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/chat\/completions$/i, '');
}
function normalizeDiscoveredLocalModels(models = []) {
  const seen = new Set();
  return models
    .map((model) => {
      const id = String(model?.id ?? model?.modelId ?? model?.name ?? '').trim();
      return !id || seen.has(id)
        ? null
        : (seen.add(id),
          {
            id: id,
            name: String(model?.name ?? id).trim() || id,
            description: String(model?.description ?? '').trim(),
            context_window: Number.isFinite(model?.context_window)
              ? Number(model.context_window)
              : null,
            max_output: Number.isFinite(model?.max_output) ? Number(model.max_output) : null,
          });
    })
    .filter(Boolean);
}
async function fetchJSON(url, { timeoutMs: timeoutMs = 400 } = {}) {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}
async function discoverOpenAICompatibleModels(endpoint) {
  const baseUrl = toOpenAICompatibleBaseUrl(endpoint);
  if (!baseUrl) return [];
  const payload = await fetchJSON(`${baseUrl}/models`);
  return Array.isArray(payload?.data)
    ? payload.data.map((model) => ({ id: model?.id, name: model?.id }))
    : [];
}
async function discoverOllamaModels(endpoint) {
  const baseUrl = (function (endpoint) {
    return toOpenAICompatibleBaseUrl(endpoint).replace(/\/v1$/i, '');
  })(endpoint);
  if (!baseUrl) return [];
  const payload = await fetchJSON(`${baseUrl}/api/tags`);
  return Array.isArray(payload?.models)
    ? payload.models.map((model) => ({
        id: model?.model ?? model?.name,
        name: model?.name ?? model?.model,
      }))
    : [];
}
export function readUser() {
  return merge(loadJson(Paths.USER_FILE, {}));
}
export function writeUser(updates = {}) {
  ensureParentDir(Paths.USER_FILE);
  const next = merge(readUser(), updates);
  return (persistJson(Paths.USER_FILE, next), next);
}
export function isFirstRun() {
  try {
    return !0 !== readUser().setup_complete;
  } catch {
    return !0;
  }
}
export function readModels() {
  var indexData;
  return ((indexData = loadJson(Paths.MODELS_INDEX_FILE, null)),
  (Array.isArray(indexData)
    ? indexData
    : Array.isArray(indexData?.files)
      ? indexData.files
      : Array.isArray(indexData?.providers)
        ? indexData.providers
        : []
  )
    .map((entry) =>
      'string' == typeof entry
        ? entry.trim()
        : entry && 'string' == typeof entry.file
          ? entry.file.trim()
          : '',
    )
    .filter(Boolean))
    .map((fileName) => loadJson(path.join(Paths.MODELS_DIR, fileName), null))
    .filter((provider) => provider && 'object' == typeof provider && !Array.isArray(provider));
}
export async function readModelsWithKeys() {
  const models = readModels(),
    user = readUser(),
    apiKeys = user.api_keys ?? {},
    providerSettings = user.provider_settings ?? {};
  return Promise.all(
    models.map(async (provider) => {
      const settings = providerSettings[provider.provider] ?? {},
        api = String(apiKeys[provider.provider] ?? '').trim(),
        localRuntime = getLocalProviderRuntime(provider.provider),
        endpoint = localRuntime
          ? (function (providerId, value) {
              const runtime = getLocalProviderRuntime(providerId),
                trimmed = String(value ?? '').trim();
              if (!trimmed) return runtime?.defaultEndpoint ?? '';
              const normalized = trimmed.replace(/\/+$/, '');
              return /\/v1\/chat\/completions$/i.test(normalized)
                ? normalized
                : /\/v1$/i.test(normalized)
                  ? `${normalized}/chat/completions`
                  : `${normalized}/v1/chat/completions`;
            })(provider.provider, settings.endpoint ?? provider.endpoint)
          : provider.endpoint,
        discoveredLocalModels =
          localRuntime && endpoint
            ? await (async function (providerId, endpoint) {
                const discoverers =
                  'ollama' === providerId
                    ? [discoverOllamaModels, discoverOpenAICompatibleModels]
                    : [discoverOpenAICompatibleModels];
                for (const discover of discoverers)
                  try {
                    const models = normalizeDiscoveredLocalModels(await discover(endpoint));
                    if (models.length) return models;
                  } catch {}
                return [];
              })(provider.provider, endpoint)
            : [],
        resolvedModels = localRuntime
          ? (function (providerId, settings = {}, baseModels = {}, discoveredModels = []) {
              const runtime = getLocalProviderRuntime(providerId);
              if (!runtime?.modelTemplate) return {};
              const preferredModelId = String(settings.modelId ?? '').trim(),
                staticModelIds = (function (models = {}) {
                  return Object.entries(models).sort(
                    ([leftId, leftInfo], [rightId, rightInfo]) =>
                      (leftInfo?.rank ?? 999) - (rightInfo?.rank ?? 999) ||
                      String(leftInfo?.name ?? leftId).localeCompare(
                        String(rightInfo?.name ?? rightId),
                      ),
                  );
                })(baseModels).map(([modelId]) => modelId),
                discovered = normalizeDiscoveredLocalModels(discoveredModels),
                discoveredById = new Map(discovered.map((model) => [model.id, model])),
                modelIds = (function (values = []) {
                  const seen = new Set();
                  return values.filter(
                    (value) => !(!value || seen.has(value) || (seen.add(value), 0)),
                  );
                })([
                  preferredModelId,
                  ...staticModelIds,
                  ...discovered
                    .map((model) => model.id)
                    .sort((left, right) =>
                      String(discoveredById.get(left)?.name ?? left).localeCompare(
                        String(discoveredById.get(right)?.name ?? right),
                      ),
                    ),
                ]);
              return modelIds.length
                ? Object.fromEntries(
                    modelIds.map((modelId, index) => {
                      const staticModel = baseModels?.[modelId] ?? {},
                        discoveredModel = discoveredById.get(modelId) ?? {},
                        model = {
                          ...runtime.modelTemplate,
                          ...staticModel,
                          name:
                            String(discoveredModel.name ?? staticModel.name ?? modelId).trim() ||
                            modelId,
                          description:
                            String(
                              discoveredModel.description ?? staticModel.description ?? '',
                            ).trim() || runtime.modelTemplate.description,
                          rank: index + 1,
                        };
                      return (
                        Number.isFinite(discoveredModel.context_window) &&
                          (model.context_window = discoveredModel.context_window),
                        Number.isFinite(discoveredModel.max_output) &&
                          (model.max_output = discoveredModel.max_output),
                        [modelId, model]
                      );
                    }),
                  )
                : {};
            })(provider.provider, settings, provider.models ?? {}, discoveredLocalModels)
          : (provider.models ?? {}),
        configured =
          !1 === provider.requires_api_key
            ? Boolean(endpoint && Object.keys(resolvedModels ?? {}).length)
            : Boolean(api);
      return {
        ...provider,
        endpoint: endpoint,
        models: resolvedModels,
        api: api || null,
        settings: settings,
        configured: configured,
      };
    }),
  );
}
export function saveApiKeys(keysMap) {
  return saveProviderConfigurations(
    Object.fromEntries(
      Object.entries(keysMap ?? {}).map(([id, value]) => [
        id,
        'string' == typeof value || null === value ? { apiKey: value } : value,
      ]),
    ),
  );
}
export function saveProviderConfigurations(configMap) {
  const user = readUser(),
    nextKeys = { ...(user.api_keys ?? {}) },
    nextSettings = { ...(user.provider_settings ?? {}) };
  (Object.entries(configMap ?? {}).forEach(([id, patch]) => {
    if (null === patch) return (delete nextKeys[id], void delete nextSettings[id]);
    if ('string' == typeof patch) {
      const trimmed = patch.trim();
      return void (trimmed ? (nextKeys[id] = trimmed) : delete nextKeys[id]);
    }
    if (!patch || 'object' != typeof patch || Array.isArray(patch)) return;
    if (Object.prototype.hasOwnProperty.call(patch, 'apiKey')) {
      const trimmedApiKey = String(patch.apiKey ?? '').trim();
      trimmedApiKey ? (nextKeys[id] = trimmedApiKey) : delete nextKeys[id];
    }
    const currentSettings = { ...(nextSettings[id] ?? {}) };
    if (Object.prototype.hasOwnProperty.call(patch, 'endpoint')) {
      const endpoint = String(patch.endpoint ?? '').trim();
      endpoint ? (currentSettings.endpoint = endpoint) : delete currentSettings.endpoint;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'modelId')) {
      const modelId = String(patch.modelId ?? '').trim();
      modelId ? (currentSettings.modelId = modelId) : delete currentSettings.modelId;
    }
    Object.keys(currentSettings).length > 0
      ? (nextSettings[id] = currentSettings)
      : delete nextSettings[id];
  }),
    ensureParentDir(Paths.USER_FILE));
  const next = { ...merge(user, {}), api_keys: nextKeys, provider_settings: nextSettings };
  return (persistJson(Paths.USER_FILE, next), next);
}
export function readText(filePath) {
  return loadText(filePath, '');
}
export function writeText(filePath, content) {
  persistText(filePath, content);
}
