import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { wrapHandler, wrapRead } from './IPCWrapper.js';

export const ipcMeta = { needs: [] };

const DATA_DIR = path.join(process.cwd(), 'Data', 'Templates');
const INDEX_FILE = path.join(DATA_DIR, 'Index.json');

// Built-in command IDs that must never be overridden by a user template.
const BUILT_IN_IDS = new Set([
  'new',
  'private',
  'settings',
  'help',
  'close',
  'restart',
  'skills',
  'personas',
  'marketplace',
  'usage',
  'events',
  'chat',
  'library',
  'projects',
  'templates',
  'automations',
  'agents',
  'setup',
]);

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(INDEX_FILE)) fs.writeFileSync(INDEX_FILE, '[]', 'utf-8');
}

function readIndex() {
  ensureDir();
  try {
    return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeIndex(index) {
  ensureDir();
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), 'utf-8');
}

function sanitizeId(trigger) {
  return trigger
    .replace(/^\//, '')
    .replace(/\s+/g, '_')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
}

function readTemplate(id) {
  const filePath = path.join(DATA_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function writeTemplate(data) {
  const filePath = path.join(DATA_DIR, `${data.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function deleteTemplateFile(id) {
  const filePath = path.join(DATA_DIR, `${id}.json`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

export function register() {
  // List all templates (metadata only, no prompt bodies)
  ipcMain.handle(
    'get-templates',
    wrapRead(() => readIndex()),
  );

  // Get a single template with its full prompt
  ipcMain.handle(
    'get-template',
    wrapRead((id) => readTemplate(id)),
  );

  // Create a new template
  ipcMain.handle(
    'create-template',
    wrapHandler(({ trigger, label, description, prompt }) => {
      const id = sanitizeId(trigger);
      if (!id || id.length < 2) throw new Error('Trigger must be at least 2 characters.');
      if (BUILT_IN_IDS.has(id))
        throw new Error(`"/${id}" conflicts with a built-in command. Choose a different trigger.`);
      const index = readIndex();
      if (index.some((t) => t.id === id))
        throw new Error(`A template with trigger "/${id}" already exists.`);
      const now = new Date().toISOString();
      const entry = {
        id,
        trigger: `/${id}`,
        label: label || id,
        description: description || '',
        fileName: `${id}.json`,
        createdAt: now,
        updatedAt: now,
      };
      writeTemplate({ ...entry, prompt: prompt || '' });
      index.push(entry);
      writeIndex(index);
      return entry;
    }),
  );

  // Update an existing template
  ipcMain.handle(
    'update-template',
    wrapHandler(({ id, label, description, prompt }) => {
      const index = readIndex();
      const idx = index.findIndex((t) => t.id === id);
      if (idx === -1) throw new Error(`Template "${id}" not found.`);
      const now = new Date().toISOString();
      index[idx] = {
        ...index[idx],
        label: label || id,
        description: description || '',
        updatedAt: now,
      };
      writeIndex(index);
      const existing = readTemplate(id) || {};
      writeTemplate({ ...existing, ...index[idx], prompt: prompt || '', updatedAt: now });
      return index[idx];
    }),
  );

  // Delete a template
  ipcMain.handle(
    'delete-template',
    wrapHandler((id) => {
      let index = readIndex();
      index = index.filter((t) => t.id !== id);
      writeIndex(index);
      deleteTemplateFile(id);
    }),
  );

  // Get all templates with full prompts (for slash command loading)
  ipcMain.handle(
    'get-templates-full',
    wrapRead(() => {
      const index = readIndex();
      return index.map((entry) => {
        const full = readTemplate(entry.id);
        return full || { ...entry, prompt: '' };
      });
    }),
  );
}
