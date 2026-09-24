function trimTrailingSlashes(value) {
  return value.replace(/\/+$/, '');
}

export function normalizeLocalEndpoint(endpoint = '') {
  const candidate = typeof endpoint === 'string' ? endpoint.trim() : '';

  if (!candidate || /^[a-z][a-z\d+.-]*:\/\//i.test(candidate)) {
    return candidate;
  }

  return `http://${candidate}`;
}

/**
 * Resolves an Ollama server URL from either its base URL or one of its API
 * endpoints. Ollama exposes its native model registry at /api/tags but its
 * OpenAI-compatible chat API at /v1/chat/completions.
 */
export function resolveOllamaBaseUrl(endpoint = '') {
  const fallback = 'http://localhost:11434';
  const candidate = normalizeLocalEndpoint(endpoint) || fallback;
  const base = trimTrailingSlashes(candidate);
  const knownEndpointPattern =
    /\/(?:api\/(?:tags|chat|generate)|v1(?:\/(?:models|chat\/completions))?)$/i;

  return base.replace(knownEndpointPattern, '');
}

export function resolveOllamaChatEndpoint(endpoint = '') {
  return `${resolveOllamaBaseUrl(endpoint)}/v1/chat/completions`;
}

export function resolveLmStudioBaseUrl(endpoint = '') {
  const fallback = 'http://localhost:1234';
  const candidate = normalizeLocalEndpoint(endpoint) || fallback;
  const base = trimTrailingSlashes(candidate);
  const knownEndpointPattern = /\/v1(?:\/(?:models|chat\/completions))?$/i;

  return base.replace(knownEndpointPattern, '');
}

export function resolveLmStudioChatEndpoint(endpoint = '') {
  return `${resolveLmStudioBaseUrl(endpoint)}/v1/chat/completions`;
}
