/**
 * LiveModelFilter.js
 *
 * Fetches the live model list from each provider API in memory and refreshes
 * the bundled provider catalog with the models that are currently active.
 *
 * Design rules:
 *  - One HTTP request per provider, not one per model.
 *  - Results are cached in memory for 1 hour (no disk writes).
 *  - If a provider fetch fails or returns null (no listing API), all its
 *    bundled models are kept — fail-safe, never removes too aggressively.
 *  - Concurrent calls for the same provider share a single in-flight fetch.
 *  - Intended for packaged builds only; dev mode uses ModelSync instead
 *    (which writes filtered results back to Config/Models JSON files).
 */

import { fetchProviderModels } from './ModelFetcher.js';
import { normalizeLocalEndpoint } from './ProviderEndpointUtils.js';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export function createLiveModelFilter() {
  // Map<credentialsKey, { models: Array, cachedAt: number }>
  const cache = new Map();

  // Map<credentialsKey, Promise<Array | null>> — deduplicates concurrent fetches.
  const pending = new Map();

  function credentialsKey(providerId, credentials) {
    return `${providerId}\u0000${credentials.apiKey}\u0000${credentials.endpoint}`;
  }

  async function fetchLiveModels(providerId, credentials) {
    const key = credentialsKey(providerId, credentials);

    // Return cached result if still fresh.
    const cached = cache.get(key);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return cached.models;
    }

    // Reuse an in-flight fetch for the same provider and connection.
    if (pending.has(key)) {
      return pending.get(key);
    }

    const promise = fetchProviderModels(providerId, credentials)
      .then((models) => {
        if (!Array.isArray(models) || models.length === 0) return null;
        cache.set(key, { models, cachedAt: Date.now() });
        return models;
      })
      .catch(() => null) // fail-safe: keep all models on error
      .finally(() => pending.delete(key));

    pending.set(key, promise);
    return promise;
  }

  return {
    /**
     * Returns a new providers array where each provider's model list is
     * replaced with models present in the provider's live API response.
     * Providers whose API doesn't support listing (null) or whose fetch fails
     * are returned unchanged.
     *
     * @param {Array} providers   - Full provider catalog from readProviderCatalog()
     * @param {object} user       - User state (for API keys / custom endpoints)
     * @returns {Promise<Array>}  - Filtered providers (same shape, fewer models)
     */
    async filterProviders(providers, user) {
      const userDetails = user?.providers?.details ?? {};
      const selectedProviderIds = new Set(user?.providers?.selected ?? []);

      const results = await Promise.all(
        providers.map(async (provider) => {
          if (!selectedProviderIds.has(provider.id)) return provider;

          const details = userDetails[provider.id] ?? {};
          const apiKey = (details.apiKey ?? '').trim();
          const savedEndpoint = (details.endpoint ?? '').trim();
          const endpoint = provider.requiresApiKey
            ? savedEndpoint || (provider.endpoint ?? '').trim()
            : normalizeLocalEndpoint(savedEndpoint || (provider.endpoint ?? '').trim());

          // Skip providers the user hasn't configured — nothing to filter against.
          if (provider.requiresApiKey && !apiKey) return provider;
          if (!endpoint && !provider.requiresApiKey) return provider;

          const credentials = { apiKey, endpoint };
          const liveModels = await fetchLiveModels(provider.id, credentials);

          // No live list available — return provider unchanged (fail-safe).
          if (!liveModels) return provider;

          const bundledModels = new Map((provider.models ?? []).map((model) => [model.id, model]));
          const models = liveModels.map((model) => ({
            ...model,
            ...(bundledModels.get(model.id) ?? {}),
          }));

          return {
            ...provider,
            models,
            modelCount: models.length,
            featuredModels: models.slice(0, 3).map((model) => model.name ?? model.id),
            summary: models[0]?.description ?? provider.summary,
          };
        }),
      );

      return results;
    },
    clear(providerId) {
      const prefix = `${providerId}\u0000`;

      for (const key of cache.keys()) {
        if (key.startsWith(prefix)) {
          cache.delete(key);
        }
      }
    },
  };
}
