import { ipcMain } from 'electron';
import * as UserService from '../Services/UserService.js';
import * as MemoryService from '../Services/MemoryService.js';
import { invalidate as invalidateSysPrompt } from '../Services/SystemPromptService.js';
import Paths from '../Core/Paths.js';
import { wrapHandler, wrapRead } from './IPCWrapper.js';
export const ipcMeta = { needs: [] };
export function register() {
  (ipcMain.handle(
    'get-user',
    wrapRead(() => UserService.readUser()),
  ),
    ipcMain.handle(
      'get-models',
      wrapRead(() => UserService.readModelsWithKeys()),
    ),
    ipcMain.handle(
      'get-api-key',
      wrapRead((providerId) => UserService.readUser()?.api_keys?.[providerId] ?? null),
    ),
    ipcMain.handle(
      'save-user-profile',
      wrapHandler((profile) => {
        const updates = {};
        return (
          'string' == typeof profile?.name && (updates.name = profile.name.trim()),
          invalidateSysPrompt(),
          { user: UserService.writeUser(updates) }
        );
      }),
    ),
    ipcMain.handle(
      'get-custom-instructions',
      wrapRead(() => UserService.readText(Paths.CUSTOM_INSTRUCTIONS_FILE)),
    ),
    ipcMain.handle(
      'save-custom-instructions',
      wrapHandler((content) => {
        (UserService.writeText(
          Paths.CUSTOM_INSTRUCTIONS_FILE,
          String(content ?? '').replace(/\r\n/g, '\n'),
        ),
          invalidateSysPrompt());
      }),
    ),
    ipcMain.handle(
      'get-memory',
      wrapRead(() => MemoryService.readPinnedMemory()),
    ),
    ipcMain.handle(
      'save-memory',
      wrapHandler((content) => {
        (MemoryService.writePinnedMemory(String(content ?? '').replace(/\r\n/g, '\n')),
          invalidateSysPrompt());
      }),
    ),
    ipcMain.handle(
      'list-personal-memory-files',
      wrapRead(() => MemoryService.listPersonalMemoryFiles()),
    ),
    ipcMain.handle(
      'search-personal-memory',
      wrapRead((query, opts = {}) => MemoryService.searchPersonalMemory(query, opts?.limit)),
    ),
    ipcMain.handle(
      'read-personal-memory-files',
      wrapRead((filenames) => MemoryService.readPersonalMemoryFiles(filenames)),
    ),
    ipcMain.handle(
      'get-personal-memory-catalog',
      wrapRead(() => MemoryService.readPersonalMemoryCatalog()),
    ),
    ipcMain.handle(
      'apply-personal-memory-updates',
      wrapHandler((payload) => ({ files: MemoryService.applyPersonalMemoryUpdates(payload) })),
    ),
    ipcMain.handle(
      'save-default-model',
      wrapHandler(({ provider = null, model = null } = {}) => {
        const user = UserService.writeUser({
          preferences: {
            default_provider: provider ?? null,
            default_model: model ?? null,
          },
        });
        return { user };
      }),
    ),
    ipcMain.handle(
      'save-default-page',
      wrapHandler((pageId) => {
        const user = UserService.writeUser({
          preferences: { default_page: pageId ?? 'chat' },
        });
        return { user };
      }),
    ));
}
