import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import Paths from '../Paths.js';
import { invalidate as invalidateSysPrompt } from '../Services/SystemPromptService.js';

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

export function register() {
  /* ── List all personas ── */
  ipcMain.handle('get-personas', () => {
    try {
      if (!fs.existsSync(Paths.PERSONAS_DIR)) return { ok: true, personas: [] };

      const files = fs.readdirSync(Paths.PERSONAS_DIR).filter(f => f.endsWith('.md'));
      const personas = files.map(filename => {
        try {
          const raw = fs.readFileSync(path.join(Paths.PERSONAS_DIR, filename), 'utf-8');
          const { meta, body } = parseFrontmatter(raw);
          return {
            filename,
            name: meta.name || filename.replace('.md', ''),
            personality: meta.personality || '',
            description: meta.description || '',
            instructions: body,
          };
        } catch { return null; }
      }).filter(Boolean);

      return { ok: true, personas };
    } catch (err) {
      return { ok: false, error: err.message, personas: [] };
    }
  });

  /* ── Get active persona ── */
  ipcMain.handle('get-active-persona', () => {
    try {
      if (!fs.existsSync(Paths.ACTIVE_PERSONA_FILE)) return { ok: true, persona: null };

      const data = JSON.parse(fs.readFileSync(Paths.ACTIVE_PERSONA_FILE, 'utf-8'));

      // Verify the persona file still exists — if deleted, clear active
      if (data?.filename) {
        const personaPath = path.join(Paths.PERSONAS_DIR, data.filename);
        if (!fs.existsSync(personaPath)) {
          fs.unlinkSync(Paths.ACTIVE_PERSONA_FILE);
          invalidateSysPrompt();
          return { ok: true, persona: null };
        }
      }

      return { ok: true, persona: data };
    } catch {
      return { ok: true, persona: null };
    }
  });

  /* ── Set active persona ── */
  ipcMain.handle('set-active-persona', (_e, personaData) => {
    try {
      const dir = path.dirname(Paths.ACTIVE_PERSONA_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        Paths.ACTIVE_PERSONA_FILE,
        JSON.stringify(personaData, null, 2),
        'utf-8',
      );
      invalidateSysPrompt();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  /* ── Reset to default assistant ── */
  ipcMain.handle('reset-active-persona', () => {
    try {
      if (fs.existsSync(Paths.ACTIVE_PERSONA_FILE))
        fs.unlinkSync(Paths.ACTIVE_PERSONA_FILE);
      invalidateSysPrompt();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}
