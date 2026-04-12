import fs from 'fs';
import path from 'path';
import { cloneValue as deepClone } from '../../System/Utils/CloneValue.js';
export function createFeatureJsonStorage(
  paths,
  { featureKey: featureKey, fileName: fileName } = {},
) {
  const featureDir = path.join(paths.FEATURES_DATA_DIR, featureKey),
    filePath = path.join(featureDir, fileName);
  return {
    featureDir: featureDir,
    featureKey: featureKey,
    filePath: filePath,
    load: (fallback = null) =>
      (function (filePath) {
        try {
          return filePath && fs.existsSync(filePath)
            ? JSON.parse(fs.readFileSync(filePath, 'utf-8'))
            : null;
        } catch {
          return null;
        }
      })(filePath) ??
      (function (fallback) {
        return 'function' == typeof fallback ? fallback() : deepClone(fallback);
      })(fallback),
    save: (data) => (
      (function (filePath) {
        const dir = path.dirname(filePath);
        fs.existsSync(dir) || fs.mkdirSync(dir, { recursive: !0 });
      })(filePath),
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8'),
      data
    ),
    exists: () => fs.existsSync(filePath),
  };
}
function normalizeRawDescriptors(raw = []) {
  return null == raw ? [] : Array.isArray(raw) ? raw : [raw];
}
function normalizeDescriptor(paths, descriptor = {}) {
  const key = String(descriptor.key ?? descriptor.id ?? '').trim(),
    fileName = String(descriptor.fileName ?? '').trim();
  return key && fileName
    ? {
        key: key,
        featureKey: String(descriptor.featureKey ?? key).trim() || key,
        fileName: fileName,
      }
    : null;
}
export function createFeatureStorageMap(paths, options = {}) {
  const storages = Object.create(null);
  for (const descriptor of (function (
    paths,
    { featureRegistry: featureRegistry = null, engines: engines = [] } = {},
  ) {
    const collected = [];
    for (const engine of engines) collected.push(...normalizeRawDescriptors(engine.meta?.storage));
    'function' == typeof featureRegistry?.getStorageDescriptors &&
      collected.push(...featureRegistry.getStorageDescriptors());
    const byKey = new Map();
    for (const descriptor of collected) {
      const normalized = normalizeDescriptor(0, descriptor);
      if (normalized) {
        if (byKey.has(normalized.key))
          throw new Error(`[FeatureStorage] Duplicate storage key "${normalized.key}".`);
        byKey.set(normalized.key, normalized);
      }
    }
    return [...byKey.values()].sort((left, right) => left.key.localeCompare(right.key));
  })(0, options))
    storages[descriptor.key] = createFeatureJsonStorage(paths, descriptor);
  return Object.freeze({
    ...storages,
    get: (key) => storages[key] ?? null,
    keys: () => Object.keys(storages),
    entries: () => Object.entries(storages),
  });
}
export default createFeatureStorageMap;
