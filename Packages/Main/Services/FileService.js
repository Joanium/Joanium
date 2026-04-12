import { loadJson, persistJson, scanFiles as scanDirectoryFiles } from '../Core/FileSystem.js';
export function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { meta: {}, body: content };
  const meta = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx < 1) continue;
    const key = line.slice(0, idx).trim(),
      val = line.slice(idx + 1).trim();
    key && val && (meta[key] = val);
  }
  return { meta: meta, body: content.slice(match[0].length).trim() };
}
export { loadJson, persistJson };
export function scanFiles(dirPath, filter = () => !0) {
  return scanDirectoryFiles(dirPath, (entry) => filter(entry.name));
}
