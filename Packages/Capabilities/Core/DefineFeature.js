function assertString(value, label) {
  if ('string' != typeof value || !value.trim())
    throw new Error(`[Feature] ${label} must be a non-empty string.`);
}
export function defineFeature(feature = {}) {
  (!(function (value) {
    if (null != value && ('object' != typeof value || Array.isArray(value)))
      throw new Error('[Feature] Feature definition must be an object.');
  })(feature),
    assertString(feature.id, 'Feature id'));
  const dependsOn = Array.isArray(feature.dependsOn) ? feature.dependsOn : [];
  dependsOn.forEach((dependencyId, index) => {
    assertString(dependencyId, `Feature dependency at index ${index}`);
  });
  const normalized = {
    id: feature.id.trim(),
    name: String(feature.name ?? feature.id).trim(),
    dependsOn: dependsOn,
    connectors: feature.connectors ?? {},
    pages: Array.isArray(feature.pages) ? feature.pages : [],
    lifecycle: feature.lifecycle ?? {},
    main: feature.main ?? {},
    renderer: feature.renderer ?? {},
    automation: feature.automation ?? {},
    channels: feature.channels ?? {},
    prompt: feature.prompt ?? {},
    storage: feature.storage ?? {},
  };
  return Object.freeze(normalized);
}
export default defineFeature;
