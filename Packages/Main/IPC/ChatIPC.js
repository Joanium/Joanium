import { ipcMain } from 'electron';
import * as ChatService from '../Services/ChatService.js';
import { wrapHandler, wrapRead } from './IPCWrapper.js';

export const ipcMeta = { needs: [] };
export function register() {
  ipcMain.handle('save-chat', wrapHandler((chatData, opts = {}) => {
    ChatService.save(chatData, opts);
  }));

  ipcMain.handle('get-chats', wrapRead((opts = {}) => {
    return ChatService.getAll(opts);
  }));

  ipcMain.handle('load-chat', wrapRead((chatId, opts = {}) => {
    return ChatService.load(chatId, opts);
  }));

  ipcMain.handle('delete-chat', wrapHandler((chatId, opts = {}) => {
    ChatService.remove(chatId, opts);
  }));
}
