import { ipcMain } from 'electron';
import {
  invalidate as invalidateSysPrompt,
  getDefaultPersona,
} from '../Services/SystemPromptService.js';
import * as ContentLibraryService from '../Services/ContentLibraryService.js';
export const ipcMeta = { needs: [] };
export function register() {
  (ipcMain.handle('get-personas', () => {
    try {
      return { ok: !0, personas: ContentLibraryService.readPersonas() };
    } catch (err) {
      return { ok: !1, error: err.message, personas: [] };
    }
  }),
    ipcMain.handle('get-active-persona', () => {
      try {
        return {
          ok: !0,
          persona: ContentLibraryService.readActivePersona() ?? getDefaultPersona(),
        };
      } catch {
        return { ok: !0, persona: getDefaultPersona() };
      }
    }),
    ipcMain.handle('set-active-persona', (_e, personaData) => {
      try {
        return (
          ContentLibraryService.setActivePersona(personaData),
          invalidateSysPrompt(),
          { ok: !0 }
        );
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }),
    ipcMain.handle('reset-active-persona', () => {
      try {
        return (ContentLibraryService.resetActivePersona(), invalidateSysPrompt(), { ok: !0 });
      } catch (err) {
        return { ok: !1, error: err.message };
      }
    }));
}
