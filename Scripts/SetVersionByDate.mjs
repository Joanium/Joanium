import fs from 'fs';
import path from 'path';

function pad2(value) {
  return String(value).padStart(2, '0');
}

function formatDateVersion(date) {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  return `${year}.${month}.${day}`;
}

const repoRoot = process.cwd();
const manifestPath = path.join(repoRoot, 'package.json');

if (!fs.existsSync(manifestPath)) {
  console.error(`Could not find package.json at ${manifestPath}`);
  process.exit(1);
}

const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
const manifest = JSON.parse(manifestRaw);

const nextVersion = formatDateVersion(new Date());
const prevVersion = manifest.version;

manifest.version = nextVersion;

if (prevVersion === nextVersion) {
  process.stdout.write(`${nextVersion}\n`);
  process.exit(0);
}

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
process.stdout.write(`${nextVersion}\n`);
