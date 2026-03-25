import { ipcMain } from 'electron';
import * as ChatService from '../Services/ChatService.js';

export function register() {
  ipcMain.handle('save-chat', (_e, chatData, opts = {}) => {
    try { ChatService.save(chatData, opts); return { ok: true }; }
    catch (err) { return { ok: false, error: err.message }; }
  });

  ipcMain.handle('get-chats', (_e, opts = {}) => {
    try { return ChatService.getAll(opts); }
    catch { return []; }
  });

  ipcMain.handle('load-chat', (_e, chatId, opts = {}) => {
    try { return ChatService.load(chatId, opts); }
    catch { return null; }
  });

  ipcMain.handle('delete-chat', (_e, chatId, opts = {}) => {
    try { ChatService.remove(chatId, opts); return { ok: true }; }
    catch (err) { return { ok: false, error: err.message }; }
  });
}
