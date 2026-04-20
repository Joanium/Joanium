import { ipcMain } from 'electron';
import * as ChatService from '../Services/ChatService.js';
import * as PromptConfigService from '../Services/PromptConfigService.js';
import { wrapHandler, wrapRead } from './IPCWrapper.js';
export const ipcMeta = { needs: [] };
export function register() {
  ipcMain.handle(
    'get-prompt-configs',
    wrapRead(() => PromptConfigService.getAll()),
  );
  (ipcMain.handle(
    'save-chat',
    wrapHandler((chatData, opts = {}) => {
      ChatService.save(chatData, opts);
    }),
  ),
    ipcMain.handle(
      'get-chats',
      wrapRead((opts = {}) => ChatService.getAll(opts)),
    ),
    ipcMain.handle(
      'load-chat',
      wrapRead((chatId, opts = {}) => ChatService.load(chatId, opts)),
    ),
    ipcMain.handle(
      'get-pending-personal-memory-chats',
      wrapRead((opts = {}) => ChatService.getPendingPersonalMemoryChats(opts)),
    ),
    ipcMain.handle(
      'mark-chat-personal-memory-synced',
      wrapHandler((chatId, opts = {}) => ({
        chat: ChatService.markPersonalMemorySynced(chatId, opts),
      })),
    ),
    ipcMain.handle(
      'delete-chat',
      wrapHandler((chatId, opts = {}) => {
        ChatService.remove(chatId, opts);
      }),
    ));
}
