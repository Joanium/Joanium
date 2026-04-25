import { ipcMain } from 'electron';
import { invalidate as invalidateSysPrompt } from '../../../Main/Services/SystemPromptService.js';
import { wrapHandler } from '../../../Main/IPC/IPCWrapper.js';
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
    ipcMain.handle(
      'toggle-skill',
      wrapHandler((idOrFilename, enabled) => {
        if (!idOrFilename || 'string' != typeof idOrFilename)
          return { ok: !1, error: 'Invalid skill id' };
        ContentLibraryService.setSkillEnabled(idOrFilename, enabled);
        invalidateSysPrompt();
      }),
    ),
    ipcMain.handle(
      'enable-all-skills',
      wrapHandler(() => {
        ContentLibraryService.setAllSkillsEnabled(!0);
        invalidateSysPrompt();
      }),
    ),
    ipcMain.handle(
      'disable-all-skills',
      wrapHandler(() => {
        ContentLibraryService.setAllSkillsEnabled(!1);
        invalidateSysPrompt();
      }),
    ),
    ipcMain.handle(
      'delete-skill',
      wrapHandler((id) => {
        ContentLibraryService.deleteUserContent('skills', id);
        invalidateSysPrompt();
      }),
    ));
}
