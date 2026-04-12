import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url),
  __dirname = path.dirname(__filename),
  REPO_ROOT = path.resolve(__dirname, '..', '..', '..'),
  ROOT_PACKAGE_PATH = path.join(REPO_ROOT, 'package.json');
let workspacePackagesCache = null;
function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
function expandWorkspacePattern(pattern) {
  const normalized = pattern.replace(/\\/g, '/');
  if (!normalized.includes('*')) return [path.resolve(REPO_ROOT, normalized)];
  if (!normalized.endsWith('/*') || normalized.indexOf('*') !== normalized.length - 1)
    return (console.warn(`[WorkspacePackages] Unsupported workspace pattern "${pattern}"`), []);
  const parentDir = path.resolve(REPO_ROOT, normalized.slice(0, -2));
  return fs.existsSync(parentDir)
    ? fs
        .readdirSync(parentDir, { withFileTypes: !0 })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(parentDir, entry.name))
    : [];
}
function toPackageDescriptor(rootDir) {
  const manifestPath = path.join(rootDir, 'package.json');
  if (!fs.existsSync(manifestPath)) return null;
  const manifest = readJson(manifestPath);
  return Object.freeze({
    name: manifest.name ?? path.basename(rootDir),
    manifest: manifest,
    manifestPath: manifestPath,
    rootDir: rootDir,
  });
}
export function getRepoRoot() {
  return REPO_ROOT;
}
export function loadWorkspacePackages() {
  if (workspacePackagesCache) return workspacePackagesCache;
  const packageDirs = ((workspaces = readJson(ROOT_PACKAGE_PATH).workspaces),
  Array.isArray(workspaces)
    ? workspaces.filter((pattern) => 'string' == typeof pattern && pattern.trim())
    : [])
    .flatMap(expandWorkspacePattern)
    .map((dir) => path.resolve(dir))
    .filter((dir, index, values) => values.indexOf(dir) === index)
    .sort((a, b) => a.localeCompare(b));
  var workspaces;
  return (
    (workspacePackagesCache = Object.freeze(packageDirs.map(toPackageDescriptor).filter(Boolean))),
    workspacePackagesCache
  );
}
export function resolvePackageDiscoveryRoots(pkg, kind) {
  const value = pkg?.manifest?.joanium?.discovery?.[kind];
  return (Array.isArray(value) ? value : value ? [value] : [])
    .filter((root) => 'string' == typeof root && root.trim())
    .map((root) => path.resolve(pkg.rootDir, root))
    .filter((root, index, values) => values.indexOf(root) === index);
}
