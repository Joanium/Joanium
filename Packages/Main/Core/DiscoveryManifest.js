import fs from 'fs';
import path from 'path';
import {
  getRepoRoot,
  loadWorkspacePackages,
  resolvePackageDiscoveryRoots,
} from './WorkspacePackages.js';
const REPO_ROOT = getRepoRoot(),
  DEFAULT_PAGE_DISCOVERY_ROOT = path.join(REPO_ROOT, 'Packages', 'Pages'),
  WORKSPACE_PACKAGES = loadWorkspacePackages();
function collectRoots(kind) {
  const roots = [],
    seen = new Set();
  for (const pkg of WORKSPACE_PACKAGES)
    for (const root of resolvePackageDiscoveryRoots(pkg, kind))
      fs.existsSync(root)
        ? seen.has(root) || (seen.add(root), roots.push(root))
        : console.warn(
            `[DiscoveryManifest] Skipping missing ${kind} root for ${pkg.name}: ${root}`,
          );
  return Object.freeze(roots.sort((a, b) => a.localeCompare(b)));
}
function collectPackageDiscovery(pkg) {
  return Object.freeze({
    features: Object.freeze(resolvePackageDiscoveryRoots(pkg, 'features')),
    engines: Object.freeze(resolvePackageDiscoveryRoots(pkg, 'engines')),
    ipc: Object.freeze(resolvePackageDiscoveryRoots(pkg, 'ipc')),
    pages: Object.freeze(resolvePackageDiscoveryRoots(pkg, 'pages')),
    services: Object.freeze(resolvePackageDiscoveryRoots(pkg, 'services')),
  });
}
export const DISCOVERY_PACKAGES = Object.freeze(
  WORKSPACE_PACKAGES.map((pkg) =>
    Object.freeze({
      name: pkg.name,
      rootDir: pkg.rootDir,
      discovery: collectPackageDiscovery(pkg),
    }),
  ),
);
export const IPC_SCAN_DIRS = collectRoots('ipc');
export const SERVICE_SCAN_DIRS = collectRoots('services');
export const ENGINE_DISCOVERY_ROOTS = collectRoots('engines');
export const FEATURE_DISCOVERY_ROOTS = collectRoots('features');
export const PAGE_DISCOVERY_ROOTS = collectRoots('pages');
export const PAGE_DISCOVERY_ROOT = PAGE_DISCOVERY_ROOTS[0] ?? DEFAULT_PAGE_DISCOVERY_ROOT;
export default {
  DISCOVERY_PACKAGES: DISCOVERY_PACKAGES,
  FEATURE_DISCOVERY_ROOTS: FEATURE_DISCOVERY_ROOTS,
  ENGINE_DISCOVERY_ROOTS: ENGINE_DISCOVERY_ROOTS,
  IPC_SCAN_DIRS: IPC_SCAN_DIRS,
  PAGE_DISCOVERY_ROOT: PAGE_DISCOVERY_ROOT,
  PAGE_DISCOVERY_ROOTS: PAGE_DISCOVERY_ROOTS,
  SERVICE_SCAN_DIRS: SERVICE_SCAN_DIRS,
};
