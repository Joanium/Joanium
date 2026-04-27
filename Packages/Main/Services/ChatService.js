import fs from 'fs';
import path from 'path';
import {
  directoryExists,
  ensureDir,
  loadJson,
  persistJson,
  scanFiles,
} from '../Core/FileSystem.js';
import Paths from '../Core/Paths.js';
import * as ProjectService from './ProjectService.js';
const INTERNAL_ASSISTANT_TOOL_PATTERNS = [
    /^\s*I\s+(?:used|called|ran|invoked)\s+(?:the\s+)?[A-Za-z0-9_.\-\s/]+\s+tool\b[\s.,;:!?\u2026]*$/i,
    /^\s*Tool result for\b/i,
    /^\s*Internal execution context for the assistant only\b/i,
  ],
  CHAT_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
function normalizeChatId(chatId) {
  const id = String(chatId ?? '').trim();
  if (!CHAT_ID_RE.test(id) || id.includes('..')) throw new Error('Invalid chat id.');
  return id;
}
function resolveProjectId(chatData, opts = {}) {
  return String(opts.projectId ?? chatData?.projectId ?? '').trim() || null;
}
function chatsDir(projectId = null, createIfMissing = !0) {
  if (!projectId) return (createIfMissing && ensureDir(Paths.CHATS_DIR), Paths.CHATS_DIR);
  ProjectService.get(projectId);
  const dir = ProjectService.getProjectChatsDir(projectId);
  return (createIfMissing && ensureDir(dir), dir);
}
function chatPath(chatId, projectId = null) {
  const id = normalizeChatId(chatId);
  return path.join(chatsDir(projectId), `${id}.json`);
}
function sanitizeMessages(messages = []) {
  return (Array.isArray(messages) ? messages : [])
    .map((message) => ({
      role: message?.role ?? 'user',
      content: String(message?.content ?? ''),
      attachments: Array.isArray(message?.attachments) ? message.attachments : [],
      ...(message?.starred ? { starred: true } : {}),
    }))
    .filter(
      (message) =>
        !(function (message = {}) {
          const role = String(message?.role ?? 'user'),
            content = String(message?.content ?? '').trim();
          return (
            !!content &&
            ('assistant' === role
              ? INTERNAL_ASSISTANT_TOOL_PATTERNS.some((pattern) => pattern.test(content))
              : 'user' === role &&
                /^(?:Tool result for|Internal execution context for the assistant only)\b/i.test(
                  content,
                ))
          );
        })(message),
    );
}
function sanitizeChatData(chatData = {}) {
  return { ...chatData, messages: sanitizeMessages(chatData.messages) };
}
function buildPersonalMemoryState(existingChat = null, chatData = {}) {
  const shouldTrack = (function (chatData = {}) {
      return sanitizeMessages(chatData.messages).some(
        (message) => 'user' === message.role && String(message.content ?? '').trim(),
      );
    })(chatData),
    updatedAt = String(chatData?.updatedAt ?? ''),
    syncedForUpdatedAt = String(existingChat?.personalMemorySyncedForUpdatedAt ?? '').trim(),
    alreadySynced = Boolean(updatedAt && syncedForUpdatedAt && syncedForUpdatedAt === updatedAt);
  return {
    personalMemoryPending: shouldTrack && !alreadySynced,
    personalMemorySyncedAt: existingChat?.personalMemorySyncedAt ?? null,
    personalMemorySyncedForUpdatedAt: alreadySynced ? syncedForUpdatedAt : null,
  };
}
function readChatsFromDirectory(dirPath) {
  return scanFiles(dirPath, (entry) => entry.name.endsWith('.json'))
    .map((filePath) => {
      const chat = loadJson(filePath, null);
      return chat ? sanitizeChatData(chat) : null;
    })
    .filter(Boolean);
}
export function save(chatData, opts = {}) {
  const projectId = resolveProjectId(chatData, opts),
    chatId = normalizeChatId(chatData?.id),
    existingChat = loadJson(chatPath(chatId, projectId), null),
    payload = {
      ...sanitizeChatData(chatData),
      id: chatId,
      projectId: projectId,
      ...buildPersonalMemoryState(existingChat, chatData),
    };
  persistJson(chatPath(chatId, projectId), payload);
}
export function getAll(opts = {}) {
  const projectId = resolveProjectId(null, opts),
    dirPath = chatsDir(
      projectId,
      !projectId || directoryExists(ProjectService.getProjectChatsDir(projectId)),
    );
  return directoryExists(dirPath)
    ? readChatsFromDirectory(dirPath).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    : [];
}
export function load(chatId, opts = {}) {
  const projectId = resolveProjectId(null, opts),
    id = normalizeChatId(chatId),
    chat = loadJson(chatPath(id, projectId), null);
  if (!chat) throw new Error(`Chat "${id}" does not exist.`);
  return sanitizeChatData(chat);
}
export function markPersonalMemorySynced(chatId, opts = {}) {
  const projectId = resolveProjectId(null, opts),
    id = normalizeChatId(chatId),
    filePath = chatPath(id, projectId),
    chat = loadJson(filePath, null);
  if (!chat) throw new Error(`Chat "${id}" does not exist.`);
  const next = {
    ...sanitizeChatData(chat),
    personalMemoryPending: !1,
    personalMemorySyncedAt: new Date().toISOString(),
    personalMemorySyncedForUpdatedAt: String(chat.updatedAt ?? '').trim() || null,
  };
  return (persistJson(filePath, next), next);
}
function readPendingChatsFromDirectory(dirPath, projectId = null) {
  return directoryExists(dirPath)
    ? readChatsFromDirectory(dirPath)
        .filter((chat) => !0 === chat.personalMemoryPending)
        .filter(
          (chat) =>
            Array.isArray(chat.messages) &&
            chat.messages.some(
              (message) => 'user' === message.role && String(message.content ?? '').trim(),
            ),
        )
        .map((chat) => ({ ...chat, projectId: projectId }))
    : [];
}
export function getPendingPersonalMemoryChats(opts = {}) {
  const limit = Math.min(Math.max(Number(opts?.limit) || 10, 1), 50),
    pending = [
      ...readPendingChatsFromDirectory(chatsDir(null, directoryExists(Paths.CHATS_DIR)), null),
    ];
  for (const project of ProjectService.list())
    pending.push(
      ...readPendingChatsFromDirectory(ProjectService.getProjectChatsDir(project.id), project.id),
    );
  return pending
    .sort((left, right) => new Date(left.updatedAt) - new Date(right.updatedAt))
    .slice(0, limit);
}
export function remove(chatId, opts = {}) {
  const projectId = resolveProjectId(null, opts);
  fs.unlinkSync(chatPath(chatId, projectId));
}
