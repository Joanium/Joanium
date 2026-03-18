// ─────────────────────────────────────────────
//  openworld — Packages/Main/IPC/ChatIPC.js
//  Handlers for saving, loading, listing, and deleting chats.
// ─────────────────────────────────────────────

import { ipcMain }    from 'electron';
import * as ChatService from '../Services/ChatService.js';

export function register() {
  ipcMain.handle('save-chat', (_e, chatData) => {
    try   { ChatService.save(chatData); return { ok: true }; }
    catch (err) { return { ok: false, error: err.message }; }
  });

  ipcMain.handle('get-chats', () => {
    try   { return ChatService.getAll(); }
    catch { return []; }
  });

  ipcMain.handle('load-chat', (_e, chatId) => {
    try   { return ChatService.load(chatId); }
    catch { return null; }
  });

  ipcMain.handle('delete-chat', (_e, chatId) => {
    try   { ChatService.remove(chatId); return { ok: true }; }
    catch (err) { return { ok: false, error: err.message }; }
  });
}
