// ─────────────────────────────────────────────
//  openworld — Packages/Main/Services/UserService.js
//  All user data, model data, and plain-text file I/O.
//  No Electron imports — pure Node.js, easily testable.
// ─────────────────────────────────────────────

import fs   from 'fs';
import Paths from '../Paths.js';

/* ══════════════════════════════════════════
   DEFAULTS
══════════════════════════════════════════ */
const DEFAULT_USER = {
  name:           '',
  setup_complete: false,
  created_at:     null,
  api_keys:       {},
  preferences: {
    theme:            'dark',
    default_provider: null,
    default_model:    null,
  },
};

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */
export function ensureDataDir() {
  if (!fs.existsSync(Paths.DATA_DIR))
    fs.mkdirSync(Paths.DATA_DIR, { recursive: true });
}

function merge(existing = {}, updates = {}) {
  return {
    ...DEFAULT_USER,
    ...existing,
    ...updates,
    api_keys: {
      ...DEFAULT_USER.api_keys,
      ...(existing.api_keys  ?? {}),
      ...(updates.api_keys   ?? {}),
    },
    preferences: {
      ...DEFAULT_USER.preferences,
      ...(existing.preferences ?? {}),
      ...(updates.preferences  ?? {}),
    },
  };
}

/* ══════════════════════════════════════════
   USER JSON
══════════════════════════════════════════ */
export function readUser() {
  try   { return merge(JSON.parse(fs.readFileSync(Paths.USER_FILE, 'utf-8'))); }
  catch { return merge(); }
}

export function writeUser(updates = {}) {
  ensureDataDir();
  const next = merge(readUser(), updates);
  fs.writeFileSync(Paths.USER_FILE, JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

export function isFirstRun() {
  try   { return readUser().setup_complete !== true; }
  catch { return true; }
}

/* ══════════════════════════════════════════
   MODELS JSON
══════════════════════════════════════════ */
export function readModels() {
  return JSON.parse(fs.readFileSync(Paths.MODELS_FILE, 'utf-8'));
}

export function readModelsWithKeys() {
  const models  = readModels();
  const apiKeys = readUser().api_keys ?? {};
  return models.map(p => ({ ...p, api: apiKeys[p.provider] ?? null }));
}

/* ══════════════════════════════════════════
   API KEYS
══════════════════════════════════════════ */
export function saveApiKeys(keysMap) {
  const user     = readUser();
  const nextKeys = { ...(user.api_keys ?? {}) };

  Object.entries(keysMap ?? {}).forEach(([id, key]) => {
    if (typeof key === 'string') {
      const trimmed = key.trim();
      if (trimmed) nextKeys[id] = trimmed;
    } else if (key === null) {
      delete nextKeys[id];
    }
  });

  return writeUser({ api_keys: nextKeys });
}

/* ══════════════════════════════════════════
   TEXT FILES (custom instructions, memory)
══════════════════════════════════════════ */
export function readText(filePath) {
  try   { return fs.readFileSync(filePath, 'utf-8'); }
  catch { return ''; }
}

export function writeText(filePath, content) {
  ensureDataDir();
  fs.writeFileSync(filePath, content, 'utf-8');
}
