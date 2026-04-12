/**
 * Build.mjs — Production build for Joanium.
 *
 * Steps:
 *   1. Set version from date
 *   2. Minify in place (git stash to undo locally)
 *   3. Package with electron-builder
 *
 * Usage:
 *   node Scripts/Build.mjs
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

console.log('╔══════════════════════════════════════╗');
console.log('║     Joanium — Production Build       ║');
console.log('╚══════════════════════════════════════╝');

run('node ./Scripts/SetVersionByDate.mjs');
run('node ./Scripts/Minify.mjs');
run('npx electron-builder');

console.log('\n[Build] ✓ Build complete.\n');
