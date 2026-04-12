import path from 'path';
import { pathToFileURL } from 'url';
import { directoryExists, scanFiles, scanFilesRecursive } from './FileSystem.js';
export async function discoverAndRegisterIPC(dirs, context = {}, options = {}) {
  const enrichedContext = { ...context };
  for (const serviceDir of options.serviceDirs ?? []) {
    if (!directoryExists(serviceDir)) continue;
    const serviceFiles = scanFiles(serviceDir, (entry) => entry.name.endsWith('Service.js'));
    for (const filePath of serviceFiles) {
      const file = path.basename(filePath);
      try {
        const mod = await import(pathToFileURL(filePath).href),
          key = file.replace(/\.js$/, ''),
          camelKey = key.charAt(0).toLowerCase() + key.slice(1);
        enrichedContext[camelKey] = mod;
      } catch (err) {
        console.warn(`[DiscoverIPC] Failed to load service: ${file}`, err.message);
      }
    }
  }
  const allFiles = dirs.flatMap((dir) =>
      scanFilesRecursive(dir, (entry) => /IPC\.js$/.test(entry.name)),
    ),
    registered = [],
    warnings = [];
  for (const filePath of allFiles) {
    const mod = await import(pathToFileURL(filePath).href);
    if ('function' != typeof mod.register) continue;
    const args = (mod.ipcMeta?.needs ?? []).map((key) => {
      if (key in enrichedContext) return enrichedContext[key];
      warnings.push(`"${path.basename(filePath)}" needs "${key}" but it's not in context`);
    });
    (mod.register(...args), registered.push(path.basename(filePath)));
  }
  return (
    warnings.length &&
      console.warn(`[DiscoverIPC] Missing dependencies:\n  ${warnings.join('\n  ')}`),
    registered
  );
}
