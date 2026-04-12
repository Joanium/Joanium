/**
 * Build.mjs — Production build for Joanium.
 *
 * Steps:
 *   1. Set version from date     (skipped with --skip-version in CI)
 *   2. Minify in place
 *   3. Package with electron-builder
 *
 * Usage:
 *   node Scripts/Build.mjs                                          # local — current platform
 *   node Scripts/Build.mjs --win   --publish always --skip-version  # CI — Windows
 *   node Scripts/Build.mjs --linux --publish always --skip-version  # CI — Linux
 *   node Scripts/Build.mjs --mac   --publish always --skip-version  # CI — macOS
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function run(cmd) {
  console.log(`\n[Build] > ${cmd}\n`);
  execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
}

// ── Argument parsing ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);

const skipVersion = args.includes('--skip-version');
const publishIdx = args.indexOf('--publish');
const publishMode = publishIdx !== -1 ? args[publishIdx + 1] : null;
const platformArgs = args.filter(a => ['--win', '--linux', '--mac'].includes(a));

if (publishIdx !== -1 && !publishMode) {
  console.error('[Build] ✗ --publish requires a mode, e.g. --publish always');
  process.exit(1);
}

if (platformArgs.length > 1) {
  console.error('[Build] ✗ Specify at most one platform flag: --win, --linux, or --mac');
  process.exit(1);
}

// ── Banner ────────────────────────────────────────────────────────────────────

console.log('╔══════════════════════════════════════╗');
console.log('║     Joanium — Production Build       ║');
console.log('╚══════════════════════════════════════╝');

console.log(`\n[Build] Platform : ${platformArgs[0] ?? '(current)'}`);
console.log(`[Build] Publish  : ${publishMode ?? '(none)'}`);
console.log(`[Build] Version  : ${skipVersion ? 'skip (CI managed)' : 'set from date'}\n`);

// ── Step 1 — Version ──────────────────────────────────────────────────────────

if (!skipVersion) {
  run('node ./Scripts/SetVersionByDate.mjs');
} else {
  console.log('[Build] Skipping version bump (--skip-version)\n');
}

// ── Step 2 — Minify ───────────────────────────────────────────────────────────

run('node ./Scripts/Minify.mjs');

// ── Step 3 — Electron Builder ─────────────────────────────────────────────────

const builderFlags = [
  ...platformArgs,
  publishMode ? `--publish ${publishMode}` : '',
].filter(Boolean).join(' ');

run(`npx electron-builder${builderFlags ? ' ' + builderFlags : ''}`);

// ── Done ──────────────────────────────────────────────────────────────────────

console.log('\n[Build] ✓ Build complete.\n');