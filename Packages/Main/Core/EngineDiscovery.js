import path from 'path';
import { pathToFileURL } from 'url';
import { scanFilesRecursive } from './FileSystem.js';
function normalizeEngineMeta(name, rawMeta) {
  if (!rawMeta || 'object' != typeof rawMeta || Array.isArray(rawMeta))
    throw new Error(`[EngineDiscovery] "${name}" must export engineMeta.`);
  if (!rawMeta.id || !rawMeta.provides || 'function' != typeof rawMeta.create)
    throw new Error(
      `[EngineDiscovery] "${name}" must export engineMeta with id, provides, and create(context).`,
    );
  return rawMeta;
}
export async function discoverEngines(scanRoots = []) {
  const engineFiles = scanRoots.flatMap((root) =>
      scanFilesRecursive(root, (entry) => entry.name.endsWith('Engine.js')),
    ),
    engines = [];
  for (const fullPath of engineFiles.sort((a, b) => a.localeCompare(b)))
    try {
      const mod = await import(pathToFileURL(fullPath).href),
        name = path.basename(fullPath, '.js'),
        meta = normalizeEngineMeta(name, mod.engineMeta);
      engines.push({
        id: meta.id,
        name: name,
        module: mod,
        meta: meta,
        provides: meta.provides,
        filePath: fullPath,
      });
    } catch (err) {
      console.warn(`[EngineDiscovery] Failed to load: ${fullPath}`, err.message);
    }
  return engines.sort((a, b) => a.name.localeCompare(b.name));
}
