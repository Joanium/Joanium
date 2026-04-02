import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

function scanRecursive(dir, predicate) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...scanRecursive(fullPath, predicate));
    } else if (entry.isFile() && predicate(entry.name, fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

export async function discoverAndRegisterIPC(dirs, context = {}) {
  const allFiles = [];
  for (const dir of dirs) {
    allFiles.push(...scanRecursive(dir, name => /IPC\.js$/.test(name)));
  }

  allFiles.sort((a, b) => a.localeCompare(b));

  const registered = [];

  for (const filePath of allFiles) {
    const mod = await import(pathToFileURL(filePath).href);
    if (typeof mod.register !== 'function') continue;

    const needs = mod.ipcMeta?.needs ?? [];
    const args = needs.map(key => {
      if (!(key in context)) {
        console.warn(`[DiscoverIPC] "${path.basename(filePath)}" needs "${key}" but it's not in context`);
        return undefined;
      }
      return context[key];
    });

    mod.register(...args);
    registered.push(path.basename(filePath));
  }

  return registered;
}
