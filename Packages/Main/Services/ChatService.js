import fs from 'fs';
import path from 'path';
import Paths from '../Paths.js';
import * as ProjectService from './ProjectService.js';

function ensureGlobalChatsDir() {
  if (!fs.existsSync(Paths.CHATS_DIR)) {
    fs.mkdirSync(Paths.CHATS_DIR, { recursive: true });
  }
}

function resolveProjectId(chatData, opts = {}) {
  return String(opts.projectId ?? chatData?.projectId ?? '').trim() || null;
}

function chatsDir(projectId = null, createIfMissing = true) {
  if (!projectId) {
    if (createIfMissing) ensureGlobalChatsDir();
    return Paths.CHATS_DIR;
  }

  ProjectService.get(projectId);
  const dir = ProjectService.getProjectChatsDir(projectId);
  if (createIfMissing && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function chatPath(chatId, projectId = null) {
  return path.join(chatsDir(projectId), `${chatId}.json`);
}

function readChatsFromDirectory(dirPath) {
  return fs.readdirSync(dirPath)
    .filter(file => file.endsWith('.json'))
    .map(file => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dirPath, file), 'utf-8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/** Persist a chat object to disk. */
export function save(chatData, opts = {}) {
  const projectId = resolveProjectId(chatData, opts);
  const payload = {
    ...chatData,
    projectId,
  };

  fs.writeFileSync(
    chatPath(chatData.id, projectId),
    JSON.stringify(payload, null, 2),
    'utf-8',
  );
}

/** Return all chats sorted newest-first. */
export function getAll(opts = {}) {
  const projectId = resolveProjectId(null, opts);
  const dirPath = chatsDir(projectId, !projectId || fs.existsSync(ProjectService.getProjectChatsDir(projectId)));
  if (!fs.existsSync(dirPath)) return [];

  return readChatsFromDirectory(dirPath)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

/** Load a single chat by ID. Throws if not found. */
export function load(chatId, opts = {}) {
  const projectId = resolveProjectId(null, opts);
  return JSON.parse(fs.readFileSync(chatPath(chatId, projectId), 'utf-8'));
}

/** Delete a chat by ID. */
export function remove(chatId, opts = {}) {
  const projectId = resolveProjectId(null, opts);
  fs.unlinkSync(chatPath(chatId, projectId));
}
