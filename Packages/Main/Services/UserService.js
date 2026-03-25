import fs from 'fs';
import Paths from '../Paths.js';

/* ══════════════════════════════════════════
   DEFAULTS
══════════════════════════════════════════ */
const DEFAULT_USER = {
  name: '',
  setup_complete: false,
  created_at: null,
  api_keys: {},
  preferences: {
    theme: 'dark',
    default_provider: null,
    default_model: null,
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
      ...(existing.api_keys ?? {}),
      ...(updates.api_keys ?? {}),
    },
    preferences: {
      ...DEFAULT_USER.preferences,
      ...(existing.preferences ?? {}),
      ...(updates.preferences ?? {}),
    },
  };
}

/* ══════════════════════════════════════════
   USER JSON
══════════════════════════════════════════ */
export function readUser() {
  try { return merge(JSON.parse(fs.readFileSync(Paths.USER_FILE, 'utf-8'))); }
  catch { return merge(); }
}

export function writeUser(updates = {}) {
  ensureDataDir();
  const next = merge(readUser(), updates);
  fs.writeFileSync(Paths.USER_FILE, JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

export function isFirstRun() {
  try { return readUser().setup_complete !== true; }
  catch { return true; }
}

/* ══════════════════════════════════════════
   MODELS JSON
══════════════════════════════════════════ */
export function readModels() {
  return JSON.parse(fs.readFileSync(Paths.MODELS_FILE, 'utf-8'));
}

export function readModelsWithKeys() {
  const models = readModels();
  const apiKeys = readUser().api_keys ?? {};
  return models.map(p => ({ ...p, api: apiKeys[p.provider] ?? null }));
}

/* ══════════════════════════════════════════
   API KEYS
   FIX: merge() spreads existing.api_keys before updates.api_keys, so
   deleted keys (absent from nextKeys) still survive via the existing spread.
   We bypass merge entirely for the api_keys field and write it directly.
══════════════════════════════════════════ */
export function saveApiKeys(keysMap) {
  const user = readUser();
  const nextKeys = { ...(user.api_keys ?? {}) };

  Object.entries(keysMap ?? {}).forEach(([id, key]) => {
    if (typeof key === 'string') {
      const trimmed = key.trim();
      if (trimmed) nextKeys[id] = trimmed;
    } else if (key === null) {
      // Explicitly delete — do NOT use merge() after this because
      // merge spreads existing.api_keys first, which re-adds the deleted key.
      delete nextKeys[id];
    }
  });

  // Build the full user object with the final api_keys, bypassing the
  // merge() spread that would resurrect deleted keys.
  ensureDataDir();
  const next = {
    ...merge(user, {}),   // apply all defaults / preferences merges
    api_keys: nextKeys,   // then stamp the correct final api_keys on top
  };
  fs.writeFileSync(Paths.USER_FILE, JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

/* ══════════════════════════════════════════
   TEXT FILES (custom instructions, memory)
══════════════════════════════════════════ */
export function readText(filePath) {
  try { return fs.readFileSync(filePath, 'utf-8'); }
  catch { return ''; }
}

export function writeText(filePath, content) {
  ensureDataDir();
  fs.writeFileSync(filePath, content, 'utf-8');
}
