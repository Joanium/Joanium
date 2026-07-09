export function buildAvailableModelOptions(
  providers,
  userProviderDetails,
  { defaultOption = null, modelFavourites = [] } = {},
) {
  const options = defaultOption ? [defaultOption] : [];
  const favouriteKeys = new Set(
    (Array.isArray(modelFavourites) ? modelFavourites : [])
      .map((favourite) => `${favourite?.providerId ?? ''}/${favourite?.modelId ?? ''}`)
      .filter((key) => key !== '/'),
  );

  for (const provider of providers) {
    if (!provider.models?.length) continue;

    const details = userProviderDetails?.[provider.id] ?? {};
    const endpoint = (details.endpoint ?? '').trim() || (provider.endpoint ?? '').trim();
    if (!endpoint) continue;
    if (provider.requiresApiKey && !(details.apiKey ?? '').trim()) continue;

    for (const model of provider.models) {
      const favourite = favouriteKeys.has(`${provider.id}/${model.id}`);
      options.push({
        value: `${provider.id}/${model.id}`,
        label: model.name ?? model.id,
        iconPath: provider.iconPath ?? null,
        favourite,
        // Pass through full objects so dropdowns can show model info popovers.
        model,
        provider,
      });
    }
  }

  return options.sort((left, right) => {
    if (left.value === defaultOption?.value) return -1;
    if (right.value === defaultOption?.value) return 1;
    if (left.favourite && !right.favourite) return -1;
    if (!left.favourite && right.favourite) return 1;
    return 0;
  });
}

export function encodeModelValue(model, fallbackValue = '') {
  if (!model?.providerId || !model?.modelId) return fallbackValue;
  return `${model.providerId}/${model.modelId}`;
}

export function decodeModelValue(value, defaultValue = '') {
  if (!value || value === defaultValue) return null;
  const slashIndex = value.indexOf('/');
  if (slashIndex < 0) return null;
  return {
    providerId: value.slice(0, slashIndex),
    modelId: value.slice(slashIndex + 1),
  };
}
