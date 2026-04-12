import fs from 'fs';
import path from 'path';
import { DISCOVERY_PACKAGES } from '../Packages/Main/Core/DiscoveryManifest.js';
import { getRepoRoot, loadWorkspacePackages } from '../Packages/Main/Core/WorkspacePackages.js';

const REPO_ROOT = getRepoRoot();
const WORKSPACE_PACKAGES = loadWorkspacePackages();
const IMPORT_PATTERN =
  /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"](\.{1,2}\/[^'"]+)['"]|import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g;
const JS_FILE_PATTERN = /\.(?:m?js)$/i;
const CONTRIBUTION_PATTERNS = {
  engines: (filePath) => {
    if (!path.basename(filePath).endsWith('Engine.js')) return false;
    return /\bengineMeta\b/.test(fs.readFileSync(filePath, 'utf8'));
  },
  ipc: (filePath) => /IPC\.js$/i.test(path.basename(filePath)),
  pages: (filePath) => path.basename(filePath) === 'Page.js',
  services: (filePath) => path.basename(filePath).endsWith('Service.js'),
};

function walkFiles(dir, predicate, results = []) {
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, predicate, results);
      continue;
    }

    if (entry.isFile() && predicate(fullPath)) {
      results.push(fullPath);
    }
  }

  return results;
}

function relativeToRepo(filePath) {
  return path.relative(REPO_ROOT, filePath).replace(/\\/g, '/');
}

function findPackageForPath(filePath) {
  return (
    WORKSPACE_PACKAGES.find((pkg) => {
      const relative = path.relative(pkg.rootDir, filePath);
      return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
    }) ?? null
  );
}

function resolveImportTarget(sourceFile, specifier) {
  const baseTarget = path.resolve(path.dirname(sourceFile), specifier);
  const candidates = [
    baseTarget,
    `${baseTarget}.js`,
    `${baseTarget}.mjs`,
    path.join(baseTarget, 'index.js'),
    path.join(baseTarget, 'index.mjs'),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? baseTarget;
}

function detectCrossPackageImports(pkg) {
  const jsFiles = walkFiles(pkg.rootDir, (filePath) => JS_FILE_PATTERN.test(filePath));
  const crossings = [];

  for (const filePath of jsFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    let match;
    IMPORT_PATTERN.lastIndex = 0;

    while ((match = IMPORT_PATTERN.exec(content)) !== null) {
      const specifier = match[1] ?? match[2];
      if (!specifier) continue;

      const targetPath = resolveImportTarget(filePath, specifier);
      const targetPackage = findPackageForPath(targetPath);
      if (!targetPackage || targetPackage.name === pkg.name) continue;

      crossings.push({
        from: pkg.name,
        specifier,
        source: filePath,
        target: targetPackage.name,
        targetPath,
      });
    }
  }

  return crossings;
}

function summarizeDiscovery(pkg) {
  const discovery = DISCOVERY_PACKAGES.find((entry) => entry.name === pkg.name)?.discovery;
  if (!discovery) return [];

  return Object.entries(discovery)
    .filter(([, roots]) => roots.length > 0)
    .map(([kind, roots]) => `${kind}:${roots.length}`);
}

function validateDeclaredDiscovery(pkg, errors) {
  const discovery = DISCOVERY_PACKAGES.find((entry) => entry.name === pkg.name)?.discovery;
  const allFiles = walkFiles(pkg.rootDir, () => true);

  for (const [kind, hasContribution] of Object.entries(CONTRIBUTION_PATTERNS)) {
    const detected = allFiles.some((filePath) => hasContribution(filePath));
    const declared = Boolean(discovery?.[kind]?.length);

    if (detected && !declared) {
      errors.push(
        `${pkg.name} contains ${kind} contributions but does not declare joanium.discovery.${kind} in ${relativeToRepo(pkg.manifestPath)}`,
      );
    }
  }

  if (!discovery) return;

  for (const [kind, roots] of Object.entries(discovery)) {
    for (const root of roots) {
      if (!fs.existsSync(root)) {
        errors.push(`${pkg.name} declares missing ${kind} root: ${relativeToRepo(root)}`);
      }
    }
  }
}

function printSummary(crossings) {
  console.log(`Workspace packages: ${WORKSPACE_PACKAGES.length}`);
  console.log('');
  console.log('Discovery summary:');

  for (const pkg of WORKSPACE_PACKAGES) {
    const summary = summarizeDiscovery(pkg);
    const suffix = summary.length ? summary.join(', ') : 'no discovery hooks';
    console.log(`- ${pkg.name}: ${suffix}`);
  }

  console.log('');
  console.log(`Cross-package relative imports: ${crossings.length}`);

  if (!crossings.length) return;

  const edgeCounts = new Map();
  for (const crossing of crossings) {
    const key = `${crossing.from} -> ${crossing.target}`;
    edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
  }

  const sortedEdges = [...edgeCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10);

  console.log('Top package edges:');
  for (const [edge, count] of sortedEdges) {
    console.log(`- ${edge}: ${count}`);
  }
}

const errors = [];
for (const pkg of WORKSPACE_PACKAGES) {
  validateDeclaredDiscovery(pkg, errors);
}

const crossings = WORKSPACE_PACKAGES.flatMap(detectCrossPackageImports);
printSummary(crossings);

if (errors.length) {
  console.error('');
  console.error('Discovery configuration issues:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
}
