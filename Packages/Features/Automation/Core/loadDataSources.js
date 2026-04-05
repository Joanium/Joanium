import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

export async function loadDataSources(sourcesDir) {
  const collectMap = new Map();
  const labelMap = {};

  if (!fs.existsSync(sourcesDir)) return { collectMap, labelMap };

  const entries = fs.readdirSync(sourcesDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.js')) continue;

    const fullPath = path.join(sourcesDir, entry.name);
    try {
      const mod = await import(pathToFileURL(fullPath).href);
      if (mod.type && typeof mod.collect === 'function') {
        collectMap.set(mod.type, mod.collect);
        if (mod.meta?.label) labelMap[mod.type] = mod.meta.label;
      }
    } catch (err) {
      console.warn(`[loadDataSources] Failed to load "${entry.name}":`, err.message);
    }
  }

  return { collectMap, labelMap };
}
