import { app } from 'electron';
import { readUserState, writeUserState } from '../../Shared/UserData/UserData.js';
import {
  readProviderCatalog,
  invalidateProviderCatalogCache,
} from '../../Shared/ProviderCatalog/ProviderCatalog.js';
import { backgroundSyncAllProviders } from '../../Shared/ProviderCatalog/ModelSync.js';
import { createLiveModelFilter } from '../../Shared/ProviderCatalog/LiveModelFilter.js';
import { normalizeLocalEndpoint } from '../../Shared/ProviderCatalog/ProviderEndpointUtils.js';

function isProviderConfigured(provider, details) {
  if (provider.requiresApiKey) {
    return typeof details.apiKey === 'string' && details.apiKey.length > 0;
  }

  try {
    const endpoint = normalizeLocalEndpoint(details.endpoint);
    if (!endpoint) return false;
    const url = new URL(endpoint);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function createProviderStateManager({ rootDirectory }) {
  // In-memory catalog cache — avoids re-reading 16 JSON files on every IPC call.
  // The chat:health-probe fires very frequently; without this cache it causes EMFILE.
  // Invalidated whenever provider data changes (save, remove) or after a sync writes new data.
  let catalogCache = null;
  const liveModelFilter = createLiveModelFilter();

  function invalidateCatalogCache() {
    catalogCache = null;
    invalidateProviderCatalogCache();
  }

  async function getCatalogCached(user = null) {
    if (!catalogCache) {
      catalogCache = await readProviderCatalog(rootDirectory);
    }
    return app.isPackaged && user
      ? liveModelFilter.filterProviders(catalogCache, user)
      : catalogCache;
  }

  async function readState() {
    return readUserState(rootDirectory);
  }

  async function writeState(updater) {
    const state = await readState();
    const next = updater(state);
    return writeUserState(rootDirectory, next);
  }

  return {
    async getCatalog() {
      return getCatalogCached(await readState());
    },

    async getConfigured() {
      const state = await readState();
      const catalog = await getCatalogCached(state);

      return catalog.map((provider) => {
        const details = state.providers.details[provider.id] ?? {};
        const isSelected = state.providers.selected.includes(provider.id);
        return {
          ...provider,
          configured: isSelected && isProviderConfigured(provider, details),
          apiKeySaved:
            isSelected && typeof details.apiKey === 'string' && details.apiKey.length > 0,
          endpointSaved:
            isSelected && typeof details.endpoint === 'string' && details.endpoint.length > 0,
          savedEndpoint: isSelected ? (details.endpoint ?? '') : '',
        };
      });
    },

    async saveProvider(providerId, incoming) {
      const catalog = await getCatalogCached(await readState());
      const provider = catalog.find((p) => p.id === providerId);

      if (!provider) {
        throw new Error('Unknown provider.');
      }

      await writeState((state) => {
        const existingDetails = state.providers.details[providerId] ?? {};
        const nextDetails = { ...existingDetails };

        if (provider.requiresApiKey) {
          if (typeof incoming.apiKey === 'string' && incoming.apiKey.trim()) {
            nextDetails.apiKey = incoming.apiKey.trim();
          }
        } else {
          const endpoint = normalizeLocalEndpoint(incoming.endpoint);
          if (endpoint) {
            nextDetails.endpoint = endpoint;
          }
        }

        const selected = state.providers.selected.includes(providerId)
          ? state.providers.selected
          : [...state.providers.selected, providerId];

        return {
          ...state,
          providers: {
            selected,
            details: { ...state.providers.details, [providerId]: nextDetails },
          },
        };
      });

      liveModelFilter.clear(providerId);
      const updated = await this.getConfigured();
      return updated.find((p) => p.id === providerId) ?? null;
    },

    async removeProvider(providerId) {
      const state = await readState();
      const catalog = await getCatalogCached(state);

      const configuredIds = state.providers.selected.filter((id) => {
        const provider = catalog.find((p) => p.id === id);
        const details = state.providers.details[id] ?? {};
        return provider && isProviderConfigured(provider, details);
      });

      if (configuredIds.length <= 1 && configuredIds.includes(providerId)) {
        throw new Error('last_provider');
      }

      await writeState((state) => ({
        ...state,
        providers: {
          selected: state.providers.selected.filter((id) => id !== providerId),
          details: Object.fromEntries(
            Object.entries(state.providers.details).filter(([id]) => id !== providerId),
          ),
        },
      }));

      liveModelFilter.clear(providerId);
      invalidateCatalogCache();
      return { ok: true };
    },

    /**
     * Fire-and-forget background sync of all configured providers.
     * Internally guarded: no-op when app is packaged, no-op when cache is fresh.
     * Invalidates the in-memory catalog cache after sync so next read picks up new models.
     */
    async backgroundSync() {
      const state = await readState();

      const providerCredentials = state.providers.selected
        .map((providerId) => {
          const details = state.providers.details[providerId] ?? {};
          return {
            providerId,
            credentials: {
              apiKey: details.apiKey ?? '',
              endpoint: details.endpoint ?? '',
            },
          };
        })
        .filter(({ credentials }) => credentials.apiKey || credentials.endpoint);

      if (providerCredentials.length === 0) return;

      backgroundSyncAllProviders(rootDirectory, providerCredentials)
        .then(invalidateCatalogCache)
        .catch(() => {});
    },

    invalidateCatalogCache,
  };
}
