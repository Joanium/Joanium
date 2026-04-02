import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

export async function loadActions(actionsDir) {
  const dispatchMap = new Map();

  if (!fs.existsSync(actionsDir)) return dispatchMap;

  const entries = fs.readdirSync(actionsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.js')) continue;

    const fullPath = path.join(actionsDir, entry.name);
    try {
      const mod = await import(pathToFileURL(fullPath).href);
      if (mod.actionType && typeof mod.execute === 'function') {
        dispatchMap.set(mod.actionType, mod.execute);
      }
    } catch (err) {
      console.warn(`[loadActions] Failed to load "${entry.name}":`, err.message);
    }
  }

  return dispatchMap;
}
