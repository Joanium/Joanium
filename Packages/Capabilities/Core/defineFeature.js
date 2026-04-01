function assertString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`[Feature] ${label} must be a non-empty string.`);
  }
}

function assertObject(value, label) {
  if (value == null) return;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`[Feature] ${label} must be an object.`);
  }
}

/**
 * Define a Joanium feature module.
 *
 * @param {object} feature
 * @returns {object}
 */
export function defineFeature(feature = {}) {
  assertObject(feature, 'Feature definition');
  assertString(feature.id, 'Feature id');

  const dependsOn = Array.isArray(feature.dependsOn) ? feature.dependsOn : [];
  dependsOn.forEach((dependencyId, index) => {
    assertString(dependencyId, `Feature dependency at index ${index}`);
  });

  const normalized = {
    id: feature.id.trim(),
    name: String(feature.name ?? feature.id).trim(),
    dependsOn,
    connectors: feature.connectors ?? {},
    main: feature.main ?? {},
    renderer: feature.renderer ?? {},
    automation: feature.automation ?? {},
    agents: feature.agents ?? {},
    channels: feature.channels ?? {},
    prompt: feature.prompt ?? {},
    storage: feature.storage ?? {},
  };

  return Object.freeze(normalized);
}

export default defineFeature;
