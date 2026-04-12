import { ipcMain } from 'electron';
import { invalidate as invalidateSysPrompt } from '../../../Main/Services/SystemPromptService.js';
import * as ContentLibraryService from '../../../Main/Services/ContentLibraryService.js';
export const ipcMeta = { needs: [] };
export function register() {
  (ipcMain.handle('get-skills', () => {
    try {
      return { ok: !0, skills: ContentLibraryService.readSkills() };
    } catch (err) {
      return { ok: !1, error: err.message, skills: [] };
    }
  }),
    ipcMain.handle('toggle-skill', (_e, idOrFilename, enabled) => {
      try {
        return idOrFilename && 'string' == typeof idOrFilename
          ? (ContentLibraryService.setSkillEnabled(idOrFilename, enabled),
            invalidateSysPrompt(),
            { ok: !0 })
          : { ok: !1, error: 'Invalid skill id' };
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }),
    ipcMain.handle('enable-all-skills', () => {
      try {
        return (ContentLibraryService.setAllSkillsEnabled(!0), invalidateSysPrompt(), { ok: !0 });
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }),
    ipcMain.handle('disable-all-skills', () => {
      try {
        return (ContentLibraryService.setAllSkillsEnabled(!1), invalidateSysPrompt(), { ok: !0 });
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }));
}
