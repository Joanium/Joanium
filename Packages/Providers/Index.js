import { createProviderStateManager } from './Core/ProviderState.js';
import { createModelFavouritesState } from './Core/ModelFavouritesState.js';
import { syncProvider } from '../Shared/ProviderCatalog/ModelSync.js';
import { readUserState } from '../Shared/UserData/UserData.js';

export async function createPackage({ rootDirectory }) {
  const providerStateManager = createProviderStateManager({ rootDirectory });
  const modelFavouritesState = createModelFavouritesState({ rootDirectory });

  // Delay startup sync by 15 s so the app fully boots before we touch the JSON files.
  // No-op when app is packaged (guarded inside ModelSync).
  // No-op when all caches are fresh (24-hour TTL checked per-provider).
  setTimeout(() => {
    providerStateManager.backgroundSync().catch(() => {});
  }, 15_000);

  return {
    id: 'Providers',
    ipcHandlers: [
      {
        channel: 'providers:list-catalog',
        handler: async () => providerStateManager.getCatalog(),
      },
      {
        channel: 'providers:list-configured',
        handler: async () => providerStateManager.getConfigured(),
      },
      {
        channel: 'providers:save',
        handler: async (_event, providerId, incoming) => {
          const result = await providerStateManager.saveProvider(providerId, incoming);

          // Immediately sync this provider's models after connecting.
          // No-op when packaged. Fire-and-forget.
          const state = await readUserState(rootDirectory);
          const details = state.providers.details[providerId] ?? {};
          syncProvider(rootDirectory, providerId, {
            apiKey: details.apiKey ?? '',
            endpoint: details.endpoint ?? '',
          })
            .then(() => providerStateManager.invalidateCatalogCache())
            .catch(() => {});

          return result;
        },
      },
      {
        channel: 'providers:remove',
        handler: async (_event, providerId) => providerStateManager.removeProvider(providerId),
      },
      {
        channel: 'providers:list-model-favourites',
        handler: async () => modelFavouritesState.list(),
      },
      {
        channel: 'providers:toggle-model-favourite',
        handler: async (_event, providerId, modelId) =>
          modelFavouritesState.toggle(providerId, modelId),
      },
    ],
  };
}
