// ─────────────────────────────────────────────
//  openworld — Packages/Main/Services/ChatService.js
//  Chat persistence — save, load, list, delete.
//  No Electron imports — pure Node.js, easily testable.
// ─────────────────────────────────────────────

import fs   from 'fs';
import path from 'path';
import Paths from '../Paths.js';

function ensureChatsDir() {
  if (!fs.existsSync(Paths.CHATS_DIR))
    fs.mkdirSync(Paths.CHATS_DIR, { recursive: true });
}

function chatPath(chatId) {
  return path.join(Paths.CHATS_DIR, `${chatId}.json`);
}

/** Persist a chat object to disk. */
export function save(chatData) {
  ensureChatsDir();
  fs.writeFileSync(chatPath(chatData.id), JSON.stringify(chatData, null, 2), 'utf-8');
}

/** Return all chats sorted newest-first. */
export function getAll() {
  ensureChatsDir();
  return fs.readdirSync(Paths.CHATS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try   { return JSON.parse(fs.readFileSync(path.join(Paths.CHATS_DIR, f), 'utf-8')); }
      catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

/** Load a single chat by ID. Throws if not found. */
export function load(chatId) {
  return JSON.parse(fs.readFileSync(chatPath(chatId), 'utf-8'));
}

/** Delete a chat by ID. */
export function remove(chatId) {
  fs.unlinkSync(chatPath(chatId));
}
