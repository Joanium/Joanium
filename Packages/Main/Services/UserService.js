import fs from 'fs';
import Paths from '../Core/Paths.js';

const DEFAULT_USER = {
  name: '',
  setup_complete: false,
  created_at: null,
  api_keys: {},
  provider_settings: {},
  preferences: {
    theme: 'light',
    default_provider: null,
    default_model: null,
  },
};

const LOCAL_PROVIDER_RUNTIME = {
  lmstudio: {
    defaultEndpoint: 'http://127.0.0.1:1234/v1/chat/completions',
    modelTemplate: {
      description: 'Local model served through LM Studio',
      rank: 1,
      context_window: 128000,
      max_output: 4096,
      inputs: {
        text: true,
        image: true,
        pdf: false,
        docx: false,
      },
      pricing: {
        input: 0,
        output: 0,
      },
    },
  },
  ollama: {
    defaultEndpoint: 'http://127.0.0.1:11434/v1/chat/completions',
    modelTemplate: {
      description: 'Local model served through Ollama',
      rank: 1,
      context_window: 128000,
      max_output: 4096,
      inputs: {
        text: true,
        image: true,
        pdf: false,
        docx: false,
      },
      pricing: {
        input: 0,
        output: 0,
      },
    },
  },
};

export function ensureDataDir() {
  if (!fs.existsSync(Paths.DATA_DIR)) {
    fs.mkdirSync(Paths.DATA_DIR, { recursive: true });
  }
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
  };
}

function getLocalProviderRuntime(providerId) {
  return LOCAL_PROVIDER_RUNTIME[providerId] ?? null;
}

function normalizeLocalEndpoint(providerId, value) {
  const runtime = getLocalProviderRuntime(providerId);
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return runtime?.defaultEndpoint ?? '';

  const normalized = trimmed.replace(/\/+$/, '');
  if (/\/v1\/chat\/completions$/i.test(normalized)) return normalized;
  if (/\/v1$/i.test(normalized)) return `${normalized}/chat/completions`;
  return `${normalized}/v1/chat/completions`;
}

function buildLocalModels(providerId, settings = {}) {
  const modelId = String(settings.modelId ?? '').trim();
  const runtime = getLocalProviderRuntime(providerId);
  if (!modelId || !runtime?.modelTemplate) return {};

  return {
    [modelId]: {
      ...runtime.modelTemplate,
      name: modelId,
    },
  };
}

export function readUser() {
  try {
    return merge(JSON.parse(fs.readFileSync(Paths.USER_FILE, 'utf-8')));
  } catch {
    return merge();
  }
}

export function writeUser(updates = {}) {
  ensureDataDir();
  const next = merge(readUser(), updates);
  fs.writeFileSync(Paths.USER_FILE, JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

export function isFirstRun() {
  try {
    return readUser().setup_complete !== true;
  } catch {
    return true;
  }
}

export function readModels() {
  return JSON.parse(fs.readFileSync(Paths.MODELS_FILE, 'utf-8'));
}

export function readModelsWithKeys() {
  const models = readModels();
  const user = readUser();
  const apiKeys = user.api_keys ?? {};
  const providerSettings = user.provider_settings ?? {};

  return models.map((provider) => {
    const settings = providerSettings[provider.provider] ?? {};
    const api = String(apiKeys[provider.provider] ?? '').trim();
    const localRuntime = getLocalProviderRuntime(provider.provider);
    const endpoint = localRuntime
      ? normalizeLocalEndpoint(provider.provider, settings.endpoint ?? provider.endpoint)
      : provider.endpoint;
    const resolvedModels = localRuntime
      ? buildLocalModels(provider.provider, settings)
      : provider.models;
    const configured = provider.requires_api_key === false
      ? Boolean(endpoint && Object.keys(resolvedModels ?? {}).length)
      : Boolean(api);

    return {
      ...provider,
      endpoint,
      models: resolvedModels,
      api: api || null,
      settings,
      configured,
    };
  });
}

export function saveApiKeys(keysMap) {
  const normalized = Object.fromEntries(
    Object.entries(keysMap ?? {}).map(([id, value]) => [
      id,
      typeof value === 'string' || value === null ? { apiKey: value } : value,
    ]),
  );
  return saveProviderConfigurations(normalized);
}

export function saveProviderConfigurations(configMap) {
  const user = readUser();
  const nextKeys = { ...(user.api_keys ?? {}) };
  const nextSettings = { ...(user.provider_settings ?? {}) };

  Object.entries(configMap ?? {}).forEach(([id, patch]) => {
    if (patch === null) {
      delete nextKeys[id];
      delete nextSettings[id];
      return;
    }

    if (typeof patch === 'string') {
      const trimmed = patch.trim();
      if (trimmed) nextKeys[id] = trimmed;
      else delete nextKeys[id];
      return;
    }

    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return;

    if (Object.prototype.hasOwnProperty.call(patch, 'apiKey')) {
      const trimmedApiKey = String(patch.apiKey ?? '').trim();
      if (trimmedApiKey) nextKeys[id] = trimmedApiKey;
      else delete nextKeys[id];
    }

    const currentSettings = { ...(nextSettings[id] ?? {}) };
    if (Object.prototype.hasOwnProperty.call(patch, 'endpoint')) {
      const endpoint = String(patch.endpoint ?? '').trim();
      if (endpoint) currentSettings.endpoint = endpoint;
      else delete currentSettings.endpoint;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'modelId')) {
      const modelId = String(patch.modelId ?? '').trim();
      if (modelId) currentSettings.modelId = modelId;
      else delete currentSettings.modelId;
    }

    if (Object.keys(currentSettings).length > 0) nextSettings[id] = currentSettings;
    else delete nextSettings[id];
  });

  ensureDataDir();
  const next = {
    ...merge(user, {}),
    api_keys: nextKeys,
    provider_settings: nextSettings,
  };
  fs.writeFileSync(Paths.USER_FILE, JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

export function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

export function writeText(filePath, content) {
  ensureDataDir();
  fs.writeFileSync(filePath, content, 'utf-8');
}
