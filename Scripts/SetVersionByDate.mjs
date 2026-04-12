import fs from 'fs';
import path from 'path';

function dateBase(date) {
  // Returns the 2-part date prefix, e.g. "2026.406" for April 6th.
  // Concatenating month+day avoids leading zeros (406, not 0406).
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}.${month * 100 + day}`;
}

const repoRoot = process.cwd();
const manifestPath = path.join(repoRoot, 'package.json');

if (!fs.existsSync(manifestPath)) {
  console.error(`Could not find package.json at ${manifestPath}`);
  process.exit(1);
}

const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
const manifest = JSON.parse(manifestRaw);

const base = dateBase(new Date()); // e.g. "2026.406"
const prevVersion = manifest.version ?? ''; // e.g. "2026.406.0"

// Determine the patch component:
//   - Same day  → reuse the existing patch so local builds are idempotent.
//   - New day   → reset patch to 0.
let patch = 0;
const prefix = `${base}.`;
if (prevVersion.startsWith(prefix)) {
  const prevPatch = parseInt(prevVersion.slice(prefix.length), 10);
  if (!Number.isNaN(prevPatch)) patch = prevPatch;
}

const fullVersion = `${base}.${patch}`; // valid 3-part semver, e.g. "2026.406.0"

// Always write the full 3-part version to package.json so that electron-builder
// never sees a 2-part string and rejects it during a local build.
if (prevVersion !== fullVersion) {
  manifest.version = fullVersion;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

// Output only the 2-part base to stdout.
// The CI workflow reads this and appends its own counter to form the release tag,
// then overwrites package.json with the final version before building.
process.stdout.write(`${base}\n`);
