/**
 * ModelFetcher.js
 *
 * Fetches the live list of available models from each provider's API.
 * Returns Array<{ id, name, context_window?, max_output?, pricing?, inputs?, description? }>
 * or null when the provider doesn't expose a listing API.
 */

// No filtering — all models returned by the API are included (chat, image, video, audio, etc.).

import { resolveLmStudioBaseUrl, resolveOllamaBaseUrl } from './ProviderEndpointUtils.js';

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function fetchJson(url, headers = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 14000);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', ...headers },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching ${url}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

// ── Metadata helpers ──────────────────────────────────────────────────────────

/** Strip undefined/null keys so the JSON stays clean. */
function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null));
}

/**
 * Convert a raw model ID into a human-readable display name.
 * e.g. "accounts/fireworks/models/flux-1-dev"  → "Flux 1 Dev"
 *      "deepseek-ai/DeepSeek-R1-0528"          → "DeepSeek R1 0528"
 *      "meta-llama/Meta-Llama-3.3-70B-Instruct" → "Meta Llama 3.3 70B Instruct"
 */
function modelIdToName(id) {
  // Take the last path segment when the ID contains slashes.
  const slug = id.includes('/') ? id.split('/').pop() : id;

  // Known version/size/precision tokens that should be fully uppercased.
  const upperTokens = new Set([
    'v1',
    'v2',
    'v3',
    'v4',
    'v5',
    'r1',
    'r2',
    'b',
    'm',
    'k',
    'fp8',
    'fp16',
    'bf16',
    'int4',
    'int8',
    'oss',
    'moe',
    'vl',
    'vlm',
    'pro',
    'max',
    'mini',
    'plus',
    'ultra',
    'lite',
    'turbo',
    'fast',
    'flash',
    'api',
    'sdk',
    'llm',
  ]);

  return slug
    .replace(/[_\.]/g, '-')
    .split('-')
    .filter(Boolean)
    .map((token) => {
      const lower = token.toLowerCase();
      // Pure numbers stay as-is (e.g. "3", "70", "0528").
      if (/^\d+$/.test(token)) return token;
      // Size tokens like "70b", "8b", "405b", "1.5b".
      if (/^\d+(\.\d+)?[bBmMkK]$/.test(token)) return token.toUpperCase();
      // Version tokens like "v3", "v3p1", "r1".
      if (/^[vVrR]\d/.test(token)) return token.toUpperCase();
      // Known reserved words.
      if (upperTokens.has(lower)) return token.toUpperCase();
      // Default: capitalise first letter.
      return token.charAt(0).toUpperCase() + token.slice(1);
    })
    .join(' ');
}

/** Convert a per-token price to per-million-token price (2 decimal places). */
function perMillion(perToken) {
  if (perToken == null || Number.isNaN(Number(perToken))) return null;
  const v = Number(perToken) * 1_000_000;
  return Math.round(v * 100) / 100;
}

// ── Provider-specific fetchers ─────────────────────────────────────────────────

/**
 * OpenAI-compatible format: { data: [{ id, context_window?, ... }] }
 */
async function openAICompat(url, authHeader) {
  const headers = authHeader ? { Authorization: authHeader } : {};
  const body = await fetchJson(url, headers);
  const items = Array.isArray(body?.data) ? body.data : [];
  return items.map((m) =>
    compact({
      id: String(m.id),
      name: modelIdToName(String(m.id)),
      context_window: m.context_window ?? null,
    }),
  );
}

/**
 * Anthropic: GET /v1/models → { data: [{ id, display_name }] }
 */
async function fetchAnthropicModels(apiKey) {
  const body = await fetchJson('https://api.anthropic.com/v1/models', {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  });
  const items = Array.isArray(body?.data) ? body.data : [];
  return items.map((m) =>
    compact({
      id: String(m.id),
      name: String(m.display_name ?? m.id),
    }),
  );
}

/**
 * Google Generative AI: GET /v1beta/models?key=...
 * Returns inputTokenLimit and outputTokenLimit for context/output sizes.
 */
async function fetchGoogleModels(apiKey) {
  const body = await fetchJson(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=200`,
  );
  const items = Array.isArray(body?.models) ? body.models : [];
  return items
    .filter(
      (m) =>
        Array.isArray(m.supportedGenerationMethods) &&
        m.supportedGenerationMethods.includes('generateContent'),
    )
    .map((m) =>
      compact({
        id: String(m.name).replace(/^models\//, ''),
        name: String(m.displayName ?? m.name).replace(/^models\//, ''),
        context_window: m.inputTokenLimit ?? null,
        max_output: m.outputTokenLimit ?? null,
      }),
    );
}

/**
 * OpenRouter: GET /api/v1/models → { data: [{ id, name, context_length, pricing, architecture }] }
 * Richest source — returns pricing, context, and input modalities.
 */
async function fetchOpenRouterModels(apiKey) {
  const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
  const body = await fetchJson('https://openrouter.ai/api/v1/models', headers);
  const items = Array.isArray(body?.data) ? body.data : [];
  return items.map((m) => {
    const inputModalities = m.architecture?.input_modalities ?? [];
    const inputPrice = perMillion(m.pricing?.prompt);
    const outputPrice = perMillion(m.pricing?.completion);
    return compact({
      id: String(m.id),
      name: String(m.name ?? m.id),
      description: m.description ? String(m.description).slice(0, 300) : null,
      context_window: m.context_length ?? null,
      pricing:
        inputPrice != null && outputPrice != null
          ? { input: inputPrice, output: outputPrice }
          : null,
      inputs: compact({
        text: true,
        image: inputModalities.includes('image') || null,
      }),
    });
  });
}

/**
 * GitHub Models: GET /catalog/models -> [{ id, name, limits, modalities }]
 */
async function fetchGitHubModels(apiKey) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2026-03-10',
  };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const body = await fetchJson('https://models.github.ai/catalog/models', headers);
  const items = Array.isArray(body) ? body : [];
  return items
    .filter((m) => {
      const outputs = m.supported_output_modalities ?? [];
      const capabilities = m.capabilities ?? [];
      return outputs.includes('text') && capabilities.includes('streaming');
    })
    .map((m) => {
      const inputs = m.supported_input_modalities ?? [];
      return compact({
        id: String(m.id),
        name: String(m.name ?? m.id),
        description: m.summary ? String(m.summary).slice(0, 300) : null,
        context_window: m.limits?.max_input_tokens ?? null,
        max_output: m.limits?.max_output_tokens ?? null,
        inputs: compact({
          text: true,
          image: inputs.includes('image') || null,
        }),
      });
    });
}

/**
 * Vercel AI Gateway: GET /v1/models -> { data: [{ id, name, pricing, tags }] }
 */
async function fetchVercelAiGatewayModels(apiKey) {
  const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
  const body = await fetchJson('https://ai-gateway.vercel.sh/v1/models', headers);
  const items = Array.isArray(body?.data) ? body.data : [];
  return items
    .filter((m) => !m.type || m.type === 'language')
    .map((m) => {
      const inputPrice = perMillion(m.pricing?.input);
      const outputPrice = perMillion(m.pricing?.output);
      const tags = Array.isArray(m.tags) ? m.tags : [];
      return compact({
        id: String(m.id),
        name: String(m.name ?? m.id),
        description: m.description ? String(m.description).slice(0, 300) : null,
        context_window: m.context_window ?? null,
        max_output: m.max_tokens ?? null,
        pricing:
          inputPrice != null && outputPrice != null
            ? { input: inputPrice, output: outputPrice }
            : null,
        inputs: compact({
          text: true,
          image: tags.includes('vision') || null,
        }),
      });
    });
}

/**
 * Requesty: GET /v1/models -> { data: [{ id, api, pricing, capabilities }] }
 */
async function fetchRequestyModels(apiKey) {
  const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
  const body = await fetchJson('https://router.requesty.ai/v1/models', headers);
  const items = Array.isArray(body?.data) ? body.data : [];
  return items
    .filter((m) => !m.api || m.api === 'chat')
    .map((m) => {
      const inputPrice = perMillion(m.input_price);
      const outputPrice = perMillion(m.output_price);
      return compact({
        id: String(m.id),
        name: modelIdToName(String(m.id)),
        description: m.description ? String(m.description).slice(0, 300) : null,
        context_window: m.context_window ?? null,
        max_output: m.max_output_tokens ?? null,
        pricing:
          inputPrice != null && outputPrice != null
            ? { input: inputPrice, output: outputPrice }
            : null,
        inputs: compact({
          text: true,
          image: m.supports_vision || null,
        }),
      });
    });
}

/**
 * Novita AI: GET /openai/v1/models -> { data: [{ id, model_type, endpoints }] }
 */
async function fetchNovitaModels(apiKey) {
  const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
  const body = await fetchJson('https://api.novita.ai/openai/v1/models', headers);
  const items = Array.isArray(body?.data) ? body.data : [];
  return items
    .filter(
      (m) =>
        m.status !== 0 &&
        m.model_type === 'chat' &&
        Array.isArray(m.endpoints) &&
        m.endpoints.includes('chat/completions'),
    )
    .map((m) => {
      const inputs = Array.isArray(m.input_modalities) ? m.input_modalities : [];
      return compact({
        id: String(m.id),
        name: String(m.display_name ?? m.title ?? m.id),
        description: m.description ? String(m.description).slice(0, 300) : null,
        context_window: m.context_size ?? null,
        max_output: m.max_output_tokens ?? null,
        inputs: compact({
          text: true,
          image: inputs.includes('image') || null,
        }),
      });
    });
}

/**
 * Cohere: GET /v2/models -> { models: [{ name, context_length, endpoints }] }
 */
async function fetchCohereModels(apiKey) {
  const body = await fetchJson('https://api.cohere.com/v2/models', {
    Authorization: `Bearer ${apiKey}`,
  });
  const items = Array.isArray(body?.models) ? body.models : [];
  return items.map((m) =>
    compact({
      id: String(m.name),
      name: String(m.name),
      context_window: m.context_length ?? null,
    }),
  );
}

/**
 * Together AI: GET /v1/models → array [{ id, display_name, context_length, type }]
 */
async function fetchTogetherModels(apiKey) {
  const body = await fetchJson('https://api.together.xyz/v1/models', {
    Authorization: `Bearer ${apiKey}`,
  });
  const items = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
  return items
    .filter((m) => !m.type || m.type === 'chat' || m.type === 'language')
    .map((m) =>
      compact({
        id: String(m.id),
        name: String(m.display_name ?? m.id),
        context_window: m.context_length ?? null,
      }),
    );
}

/**
 * Ollama (local): GET {endpoint}/api/tags → { models: [{ name }] }
 */
async function fetchOllamaModels(endpoint) {
  const base = resolveOllamaBaseUrl(endpoint);
  const body = await fetchJson(`${base}/api/tags`);
  const items = Array.isArray(body?.models) ? body.models : [];
  return items.map((m) => compact({ id: String(m.name), name: String(m.name) }));
}

/**
 * LM Studio (local): GET {endpoint}/v1/models → { data: [{ id }] }
 */
async function fetchLmStudioModels(endpoint) {
  const base = resolveLmStudioBaseUrl(endpoint);
  const body = await fetchJson(`${base}/v1/models`);
  const items = Array.isArray(body?.data) ? body.data : [];
  return items.map((m) => compact({ id: String(m.id), name: String(m.id) }));
}

/**
 * Fireworks AI: GET /inference/v1/models → { data: [{ id, object }] }
 * Filters to chat/text models only — excludes image generation models
 * (Flux, Stable Diffusion, Playground, etc.) that don't support /chat/completions.
 */
async function fetchFireworksModels(apiKey) {
  const body = await fetchJson('https://api.fireworks.ai/inference/v1/models', {
    Authorization: `Bearer ${apiKey}`,
  });
  const items = Array.isArray(body?.data) ? body.data : [];

  // Known image/audio/video model slug patterns that don't support chat completions.
  const nonChatPatterns = [
    /flux/i,
    /stable-diffusion/i,
    /sdxl/i,
    /playground/i,
    /kandinsky/i,
    /dall-e/i,
    /whisper/i,
    /tts/i,
    /speech/i,
    /audio/i,
    /video/i,
    /image-/i,
    /-image/i,
  ];

  return items
    .filter((m) => {
      const id = String(m.id);
      return !nonChatPatterns.some((re) => re.test(id));
    })
    .map((m) =>
      compact({
        id: String(m.id),
        name: modelIdToName(String(m.id)),
        context_window: m.context_window ?? null,
      }),
    );
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch the live model list for a given provider.
 *
 * @param {string} providerId
 * @param {{ apiKey?: string, endpoint?: string }} credentials
 * @returns {Promise<Array<{ id: string, name: string, context_window?: number,
 *   max_output?: number, pricing?: { input: number, output: number },
 *   inputs?: { text: boolean, image?: boolean }, description?: string }> | null>}
 */
export async function fetchProviderModels(providerId, { apiKey = '', endpoint = '' } = {}) {
  switch (providerId) {
    case 'anthropic':
      return fetchAnthropicModels(apiKey);

    case 'openai':
      return openAICompat('https://api.openai.com/v1/models', `Bearer ${apiKey}`);

    case 'google':
      return fetchGoogleModels(apiKey);

    case 'githubmodels':
      return fetchGitHubModels(apiKey);

    case 'vercelaigateway':
      return fetchVercelAiGatewayModels(apiKey);

    case 'requesty':
      return fetchRequestyModels(apiKey);

    case 'novita':
      return fetchNovitaModels(apiKey);

    case 'stepfun':
      return openAICompat('https://api.stepfun.ai/v1/models', `Bearer ${apiKey}`);

    case 'parasail':
      return openAICompat('https://api.parasail.io/v1/models', `Bearer ${apiKey}`);

    case 'poe':
      return openAICompat('https://api.poe.com/v1/models', `Bearer ${apiKey}`);

    case 'qwen':
      return openAICompat(
        'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/models',
        `Bearer ${apiKey}`,
      );

    case 'kimi':
      return openAICompat('https://api.moonshot.ai/v1/models', `Bearer ${apiKey}`);

    case 'mistral':
      return openAICompat('https://api.mistral.ai/v1/models', `Bearer ${apiKey}`);

    case 'groq':
      return openAICompat('https://api.groq.com/openai/v1/models', `Bearer ${apiKey}`);

    case 'deepseek':
      return openAICompat('https://api.deepseek.com/models', `Bearer ${apiKey}`);

    case 'xai':
      return openAICompat('https://api.x.ai/v1/models', `Bearer ${apiKey}`);

    case 'together':
      return fetchTogetherModels(apiKey);

    case 'perplexity':
      return openAICompat('https://api.perplexity.ai/models', `Bearer ${apiKey}`);

    case 'cerebras':
      return openAICompat('https://api.cerebras.ai/v1/models', `Bearer ${apiKey}`);

    case 'nvidia':
      return openAICompat('https://integrate.api.nvidia.com/v1/models', `Bearer ${apiKey}`);

    case 'openrouter':
      return fetchOpenRouterModels(apiKey);

    case 'cohere':
      return fetchCohereModels(apiKey);

    case 'minimax':
      return openAICompat('https://api.minimax.io/v1/models', `Bearer ${apiKey}`);

    case 'ollama':
      return fetchOllamaModels(endpoint);

    case 'lmstudio':
      return fetchLmStudioModels(endpoint);

    case 'fireworks':
      return fetchFireworksModels(apiKey);

    case 'siliconflow':
      return openAICompat('https://api.siliconflow.com/v1/models', `Bearer ${apiKey}`);

    case 'huggingface':
      return openAICompat('https://router.huggingface.co/v1/models', `Bearer ${apiKey}`);

    case 'lambda':
      return openAICompat('https://api.lambda.ai/v1/models', `Bearer ${apiKey}`);

    case 'sambanova':
      return openAICompat('https://api.sambanova.ai/v1/models', `Bearer ${apiKey}`);

    // Hyperbolic, AI21, and Z.ai don't expose a public models listing endpoint —
    // returning null keeps all bundled models (fail-safe behaviour).
    case 'hyperbolic':
    case 'ai21':
    case 'zai':
      return null;

    default:
      return null;
  }
}
