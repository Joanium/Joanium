import path from 'node:path';
import { getWritableDataDirectory } from '../../Shared/Storage/ResourcePaths.js';
import { createSingleFileState } from '../../Shared/Storage/SingleFileState.js';

function createModelKey(providerId, modelId) {
  return `${String(providerId ?? '').trim()}/${String(modelId ?? '').trim()}`;
}

function normalizeFavourite(entry) {
  const providerId = String(entry?.providerId ?? '').trim();
  const modelId = String(entry?.modelId ?? '').trim();
  if (!providerId || !modelId) return null;
  return {
    providerId,
    modelId,
    addedAt: String(entry?.addedAt ?? '') || new Date().toISOString(),
  };
}

function normalizeFavourites(entries) {
  const seen = new Set();
  const favourites = [];

  for (const entry of Array.isArray(entries) ? entries : []) {
    const favourite = normalizeFavourite(entry);
    if (!favourite) continue;
    const key = createModelKey(favourite.providerId, favourite.modelId);
    if (seen.has(key)) continue;
    seen.add(key);
    favourites.push(favourite);
  }

  return favourites;
}

export function createModelFavouritesState({ rootDirectory }) {
  const dataDirectory = getWritableDataDirectory(rootDirectory);
  const fileState = createSingleFileState(path.join(dataDirectory, 'ModelFavourites.json'), {
    favourites: [],
  });

  async function list() {
    const state = await fileState.read();
    return normalizeFavourites(state.favourites);
  }

  async function toggle(providerId, modelId) {
    const safeProviderId = String(providerId ?? '').trim();
    const safeModelId = String(modelId ?? '').trim();
    if (!safeProviderId || !safeModelId) {
      throw new Error('A valid provider and model are required.');
    }

    const favourites = await list();
    const key = createModelKey(safeProviderId, safeModelId);
    const exists = favourites.some(
      (favourite) => createModelKey(favourite.providerId, favourite.modelId) === key,
    );
    const next = exists
      ? favourites.filter(
          (favourite) => createModelKey(favourite.providerId, favourite.modelId) !== key,
        )
      : [
          { providerId: safeProviderId, modelId: safeModelId, addedAt: new Date().toISOString() },
          ...favourites,
        ];

    await fileState.write({ favourites: next });
    return { favourites: next, favourite: !exists };
  }

  return { list, toggle };
}
