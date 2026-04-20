import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const INSTRUCTIONS_DIR = path.resolve(__dirname, '..', '..', '..', 'SystemInstructions');

let _cache = null;

function readJson(filename) {
  try {
    return JSON.parse(fs.readFileSync(path.join(INSTRUCTIONS_DIR, filename), 'utf-8'));
  } catch {
    return {};
  }
}

export function getAll() {
  if (_cache) return _cache;
  _cache = {
    agent: readJson('AgentPrompts.json'),
    memory: readJson('MemoryPrompts.json'),
    compaction: readJson('CompactionPrompts.json'),
  };
  return _cache;
}

export function invalidate() {
  _cache = null;
}
