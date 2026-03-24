// ─────────────────────────────────────────────
//  Romelson — Packages/Main/IPC/SkillsIPC.js
//  Reads skill .md files from Skills/ directory.
//  Manages per-skill enabled state in Data/Skills.json.
//  All skills are DISABLED by default.
// ─────────────────────────────────────────────

import { ipcMain } from 'electron';
import fs   from 'fs';
import path from 'path';
import Paths from '../Paths.js';
import { invalidate as invalidateSysPrompt } from '../Services/SystemPromptService.js';

/* ── Frontmatter parser ── */
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { meta: {}, body: content };
  const meta = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx < 1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (key && val) meta[key] = val;
  }
  return { meta, body: content.slice(match[0].length).trim() };
}

/* ── Files to skip — internal/empty stubs ── */
const SKIP_FILES = new Set(['Debug.md']);

/* ── Skills.json helpers ── */

/**
 * Load the enabled map from Data/Skills.json.
 * Returns a plain object: { "FileName.md": true | false }
 * Missing entries default to false (disabled).
 */
function loadEnabledMap() {
  try {
    if (fs.existsSync(Paths.SKILLS_FILE)) {
      const data = JSON.parse(fs.readFileSync(Paths.SKILLS_FILE, 'utf-8'));
      return data.skills ?? {};
    }
  } catch { /* fall through */ }
  return {};
}

/**
 * Persist the enabled map back to Data/Skills.json.
 */
function saveEnabledMap(map) {
  const dir = path.dirname(Paths.SKILLS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    Paths.SKILLS_FILE,
    JSON.stringify({ skills: map }, null, 2),
    'utf-8',
  );
}

/* ── IPC registration ── */

export function register() {

  /* ── List all skills (with enabled state) ── */
  ipcMain.handle('get-skills', () => {
    try {
      if (!fs.existsSync(Paths.SKILLS_DIR)) return { ok: true, skills: [] };

      const enabledMap = loadEnabledMap();

      const files = fs.readdirSync(Paths.SKILLS_DIR)
        .filter(f => f.endsWith('.md') && !SKIP_FILES.has(f));

      const skills = files.map(filename => {
        try {
          const raw  = fs.readFileSync(path.join(Paths.SKILLS_DIR, filename), 'utf-8');
          const { meta, body } = parseFrontmatter(raw);

          // Skip files that have no name and no body content
          if (!meta.name && !body.trim()) return null;

          return {
            filename,
            name:        meta.name        || filename.replace('.md', ''),
            trigger:     meta.trigger     || '',
            description: meta.description || '',
            body,
            raw,
            // Default: disabled (must be explicitly enabled in Skills.json)
            enabled: enabledMap[filename] === true,
          };
        } catch { return null; }
      }).filter(Boolean);

      return { ok: true, skills };
    } catch (err) {
      return { ok: false, error: err.message, skills: [] };
    }
  });

  /* ── Toggle a single skill on or off ── */
  ipcMain.handle('toggle-skill', (_e, filename, enabled) => {
    try {
      if (!filename || typeof filename !== 'string') {
        return { ok: false, error: 'Invalid filename' };
      }
      const map = loadEnabledMap();
      map[filename] = Boolean(enabled);
      saveEnabledMap(map);
      invalidateSysPrompt();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  /* ── Enable all skills at once ── */
  ipcMain.handle('enable-all-skills', () => {
    try {
      if (!fs.existsSync(Paths.SKILLS_DIR)) return { ok: true };

      const files = fs.readdirSync(Paths.SKILLS_DIR)
        .filter(f => f.endsWith('.md') && !SKIP_FILES.has(f));

      const map = loadEnabledMap();
      for (const f of files) map[f] = true;
      saveEnabledMap(map);
      invalidateSysPrompt();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  /* ── Disable all skills at once ── */
  ipcMain.handle('disable-all-skills', () => {
    try {
      if (!fs.existsSync(Paths.SKILLS_DIR)) return { ok: true };

      const files = fs.readdirSync(Paths.SKILLS_DIR)
        .filter(f => f.endsWith('.md') && !SKIP_FILES.has(f));

      const map = loadEnabledMap();
      for (const f of files) map[f] = false;
      saveEnabledMap(map);
      invalidateSysPrompt();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  /* ── Return only the enabled map (lightweight, for SystemPrompt use) ── */
  ipcMain.handle('get-skills-enabled-map', () => {
    try {
      return { ok: true, map: loadEnabledMap() };
    } catch (err) {
      return { ok: false, map: {}, error: err.message };
    }
  });
}
