// ─────────────────────────────────────────────
//  openworld — App.js
//  Electron main process · root entry point
// ─────────────────────────────────────────────

import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { AutomationEngine }  from './Packages/Automation/AutomationEngine.js';
import { ConnectorEngine }   from './Packages/Connectors/ConnectorEngine.js';
import * as GmailAPI         from './Packages/Automation/Gmail.js';
import * as GithubAPI        from './Packages/Automation/Github.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ── Paths ── */
const DATA_DIR                 = path.join(__dirname, 'Data');
const USER_FILE                = path.join(DATA_DIR, 'User.json');
const MODELS_FILE              = path.join(DATA_DIR, 'Models.json');
const CUSTOM_INSTRUCTIONS_FILE = path.join(DATA_DIR, 'CustomInstructions.md');
const MEMORY_FILE              = path.join(DATA_DIR, 'Memory.md');
const CHATS_DIR                = path.join(DATA_DIR, 'Chats');
const AUTOMATIONS_FILE         = path.join(DATA_DIR, 'Automations.json');
const CONNECTORS_FILE          = path.join(DATA_DIR, 'Connectors.json');
const PRELOAD                  = path.join(__dirname, 'Packages', 'Electron', 'Preload.js');
const SETUP_PAGE               = path.join(__dirname, 'Public', 'Setup.html');
const MAIN_PAGE                = path.join(__dirname, 'Public', 'index.html');
const AUTOMATIONS_PAGE         = path.join(__dirname, 'Public', 'Automations.html');

/* ── Engines (singletons) ── */
const connectorEngine  = new ConnectorEngine(CONNECTORS_FILE);
const automationEngine = new AutomationEngine(AUTOMATIONS_FILE, connectorEngine);

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */
const DEFAULT_USER = {
  name: '',
  setup_complete: false,
  created_at: null,
  api_keys: {},
  preferences: {
    theme: 'dark',
    default_provider: null,
    default_model: null,
  },
};

const ensureDataDir = () => {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
};

const readJSON  = (f) => JSON.parse(fs.readFileSync(f, 'utf-8'));
const writeJSON = (f, d) => { ensureDataDir(); fs.writeFileSync(f, JSON.stringify(d, null, 2), 'utf-8'); };
const readText  = (f) => fs.readFileSync(f, 'utf-8');
const writeText = (f, text) => { ensureDataDir(); fs.writeFileSync(f, text, 'utf-8'); };

function mergeUserData(existing = {}, updates = {}) {
  return {
    ...DEFAULT_USER,
    ...existing,
    ...updates,
    api_keys: {
      ...DEFAULT_USER.api_keys,
      ...(existing.api_keys ?? {}),
      ...(updates.api_keys ?? {}),
    },
    preferences: {
      ...DEFAULT_USER.preferences,
      ...(existing.preferences ?? {}),
      ...(updates.preferences ?? {}),
    },
  };
}

function readUserData() {
  try   { return mergeUserData(readJSON(USER_FILE)); }
  catch { return mergeUserData(); }
}

function writeUserData(updates = {}) {
  const nextUser = mergeUserData(readUserData(), updates);
  writeJSON(USER_FILE, nextUser);
  return nextUser;
}

function readCustomInstructions() {
  try   { return readText(CUSTOM_INSTRUCTIONS_FILE); }
  catch { return ''; }
}

function readMemory() {
  try   { return readText(MEMORY_FILE); }
  catch { return ''; }
}

const isFirstRun = () => {
  try { return readJSON(USER_FILE).setup_complete !== true; }
  catch { return true; }
};

/* ══════════════════════════════════════════
   WINDOW
══════════════════════════════════════════ */
let win = null;

function createWindow(page) {
  win = new BrowserWindow({
    width:    1100,
    height:   720,
    minWidth: 1100,
    minHeight: 720,
    frame:    false,
    titleBarStyle: 'hidden',
    backgroundColor: '#1a1a1a',
    show: false,
    webPreferences: {
      preload:          PRELOAD,
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,
    },
  });

  win.loadFile(page);
  win.once('ready-to-show', () => win.show());

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

/* ══════════════════════════════════════════
   LIFECYCLE
══════════════════════════════════════════ */
app.whenReady().then(() => {
  if (!fs.existsSync(CHATS_DIR)) fs.mkdirSync(CHATS_DIR, { recursive: true });
  ensureDataDir();

  automationEngine.start();

  createWindow(isFirstRun() ? SETUP_PAGE : MAIN_PAGE);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0)
      createWindow(isFirstRun() ? SETUP_PAGE : MAIN_PAGE);
  });
});

app.on('window-all-closed', () => {
  automationEngine.stop();
  if (process.platform !== 'darwin') app.quit();
});

/* ══════════════════════════════════════════
   IPC — SETUP
══════════════════════════════════════════ */
ipcMain.handle('save-user', (_e, userData) => {
  try   { return { ok: true, user: writeUserData(userData) }; }
  catch (err) { return { ok: false, error: err.message }; }
});

ipcMain.handle('save-api-keys', (_e, keysMap) => {
  try {
    const user     = readUserData();
    const nextKeys = { ...(user.api_keys ?? {}) };

    Object.entries(keysMap ?? {}).forEach(([providerId, apiKey]) => {
      if (typeof apiKey === 'string') {
        const trimmed = apiKey.trim();
        if (trimmed) nextKeys[providerId] = trimmed;
        return;
      }
      if (apiKey === null) delete nextKeys[providerId];
    });

    const nextUser = mergeUserData(user, { api_keys: nextKeys });
    writeJSON(USER_FILE, nextUser);
    return { ok: true, user: nextUser };
  } catch (err) { return { ok: false, error: err.message }; }
});

ipcMain.handle('save-user-profile', (_e, profile) => {
  try {
    const updates = {};
    if (typeof profile?.name === 'string') updates.name = profile.name.trim();
    return { ok: true, user: writeUserData(updates) };
  } catch (err) { return { ok: false, error: err.message }; }
});

ipcMain.handle('get-custom-instructions', () => readCustomInstructions());

ipcMain.handle('save-custom-instructions', (_e, content) => {
  try   { writeText(CUSTOM_INSTRUCTIONS_FILE, String(content ?? '').replace(/\r\n/g, '\n')); return { ok: true }; }
  catch (err) { return { ok: false, error: err.message }; }
});

ipcMain.handle('get-memory', () => readMemory());

ipcMain.handle('save-memory', (_e, content) => {
  try   { writeText(MEMORY_FILE, String(content ?? '').replace(/\r\n/g, '\n')); return { ok: true }; }
  catch (err) { return { ok: false, error: err.message }; }
});

ipcMain.handle('launch-main', () => { win?.loadFile(MAIN_PAGE); return { ok: true }; });

/* ══════════════════════════════════════════
   IPC — RUNTIME READS
══════════════════════════════════════════ */
ipcMain.handle('get-user', () => readUserData());

ipcMain.handle('get-models', () => {
  const models  = readJSON(MODELS_FILE);
  const apiKeys = readUserData().api_keys ?? {};
  return models.map(provider => ({ ...provider, api: apiKeys[provider.provider] ?? null }));
});

ipcMain.handle('get-api-key', (_e, providerId) => readUserData()?.api_keys?.[providerId] ?? null);

/* ══════════════════════════════════════════
   IPC — CHAT STORAGE
══════════════════════════════════════════ */
ipcMain.handle('save-chat', (_e, chatData) => {
  try {
    if (!fs.existsSync(CHATS_DIR)) fs.mkdirSync(CHATS_DIR, { recursive: true });
    writeJSON(path.join(CHATS_DIR, chatData.id + '.json'), chatData);
    return { ok: true };
  } catch (err) { return { ok: false, error: err.message }; }
});

ipcMain.handle('get-chats', () => {
  try {
    if (!fs.existsSync(CHATS_DIR)) return [];
    return fs.readdirSync(CHATS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => { try { return readJSON(path.join(CHATS_DIR, f)); } catch { return null; } })
      .filter(Boolean)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  } catch { return []; }
});

ipcMain.handle('load-chat',   (_e, chatId) => readJSON(path.join(CHATS_DIR, chatId + '.json')));

ipcMain.handle('delete-chat', (_e, chatId) => {
  try   { fs.unlinkSync(path.join(CHATS_DIR, chatId + '.json')); return { ok: true }; }
  catch (err) { return { ok: false, error: err.message }; }
});

/* ══════════════════════════════════════════
   IPC — AUTOMATIONS
══════════════════════════════════════════ */
ipcMain.handle('launch-automations', () => {
  win?.loadFile(AUTOMATIONS_PAGE);
  return { ok: true };
});

ipcMain.handle('get-automations', () => {
  try   { return { ok: true, automations: automationEngine.getAll() }; }
  catch (err) { return { ok: false, error: err.message, automations: [] }; }
});

ipcMain.handle('save-automation', (_e, automation) => {
  try {
    const saved = automationEngine.saveAutomation(automation);
    automationEngine.reload();
    return { ok: true, automation: saved };
  } catch (err) { return { ok: false, error: err.message }; }
});

ipcMain.handle('delete-automation', (_e, id) => {
  try {
    automationEngine.deleteAutomation(id);
    automationEngine.reload();
    return { ok: true };
  } catch (err) { return { ok: false, error: err.message }; }
});

ipcMain.handle('toggle-automation', (_e, id, enabled) => {
  try {
    automationEngine.toggleAutomation(id, enabled);
    automationEngine.reload();
    return { ok: true };
  } catch (err) { return { ok: false, error: err.message }; }
});

/* ══════════════════════════════════════════
   IPC — CONNECTORS (credential management)
══════════════════════════════════════════ */

/** Return status summary for all connectors (no credentials exposed). */
ipcMain.handle('get-connectors', () => {
  try   { return connectorEngine.getAll(); }
  catch (err) { console.error('[connectors] get-connectors error:', err); return {}; }
});

/** Save connector credentials. */
ipcMain.handle('save-connector', (_e, name, credentials) => {
  try {
    const result = connectorEngine.saveConnector(name, credentials);
    return { ok: true, ...result };
  } catch (err) { return { ok: false, error: err.message }; }
});

/** Remove / disconnect a connector. */
ipcMain.handle('remove-connector', (_e, name) => {
  try   { connectorEngine.removeConnector(name); return { ok: true }; }
  catch (err) { return { ok: false, error: err.message }; }
});

/** Validate stored credentials against the live API. */
ipcMain.handle('validate-connector', async (_e, name) => {
  try {
    const creds = connectorEngine.getCredentials(name);
    if (!creds) return { ok: false, error: 'No credentials stored' };

    if (name === 'gmail') {
      const email = await GmailAPI.validateCredentials(creds);
      connectorEngine.updateCredentials('gmail', { email });
      return { ok: true, email };
    }

    if (name === 'github') {
      const user = await GithubAPI.getUser(creds);
      connectorEngine.updateCredentials('github', { username: user.login });
      return { ok: true, username: user.login, avatar: user.avatar_url };
    }

    return { ok: false, error: 'Unknown connector' };
  } catch (err) { return { ok: false, error: err.message }; }
});

/* ══════════════════════════════════════════
   IPC — GMAIL
══════════════════════════════════════════ */

ipcMain.handle('gmail-get-brief', async (_e, maxResults = 15) => {
  try {
    const creds = connectorEngine.getCredentials('gmail');
    if (!creds?.accessToken) return { ok: false, error: 'Gmail not connected' };
    const brief = await GmailAPI.getEmailBrief(creds, maxResults);
    return { ok: true, ...brief };
  } catch (err) { return { ok: false, error: err.message }; }
});

ipcMain.handle('gmail-get-unread', async (_e, maxResults = 20) => {
  try {
    const creds = connectorEngine.getCredentials('gmail');
    if (!creds?.accessToken) return { ok: false, error: 'Gmail not connected' };
    const emails = await GmailAPI.getUnreadEmails(creds, maxResults);
    return { ok: true, emails };
  } catch (err) { return { ok: false, error: err.message }; }
});

ipcMain.handle('gmail-send', async (_e, to, subject, body) => {
  try {
    const creds = connectorEngine.getCredentials('gmail');
    if (!creds?.accessToken) return { ok: false, error: 'Gmail not connected' };
    await GmailAPI.sendEmail(creds, to, subject, body);
    return { ok: true };
  } catch (err) { return { ok: false, error: err.message }; }
});

ipcMain.handle('gmail-search', async (_e, query, maxResults = 10) => {
  try {
    const creds = connectorEngine.getCredentials('gmail');
    if (!creds?.accessToken) return { ok: false, error: 'Gmail not connected' };
    const emails = await GmailAPI.searchEmails(creds, query, maxResults);
    return { ok: true, emails };
  } catch (err) { return { ok: false, error: err.message }; }
});

/* ══════════════════════════════════════════
   IPC — GITHUB
══════════════════════════════════════════ */

ipcMain.handle('github-get-repos', async () => {
  try {
    const creds = connectorEngine.getCredentials('github');
    if (!creds?.token) return { ok: false, error: 'GitHub not connected' };
    const repos = await GithubAPI.getRepos(creds);
    return { ok: true, repos };
  } catch (err) { return { ok: false, error: err.message }; }
});

ipcMain.handle('github-get-file', async (_e, owner, repo, filePath) => {
  try {
    const creds = connectorEngine.getCredentials('github');
    if (!creds?.token) return { ok: false, error: 'GitHub not connected' };
    const file = await GithubAPI.getFileContent(creds, owner, repo, filePath);
    return { ok: true, ...file };
  } catch (err) { return { ok: false, error: err.message }; }
});

ipcMain.handle('github-get-tree', async (_e, owner, repo, branch) => {
  try {
    const creds = connectorEngine.getCredentials('github');
    if (!creds?.token) return { ok: false, error: 'GitHub not connected' };
    const tree = await GithubAPI.getRepoTree(creds, owner, repo, branch);
    return { ok: true, tree: tree?.tree ?? [] };
  } catch (err) { return { ok: false, error: err.message }; }
});

ipcMain.handle('github-get-issues', async (_e, owner, repo, state = 'open') => {
  try {
    const creds = connectorEngine.getCredentials('github');
    if (!creds?.token) return { ok: false, error: 'GitHub not connected' };
    const issues = await GithubAPI.getIssues(creds, owner, repo, state);
    return { ok: true, issues };
  } catch (err) { return { ok: false, error: err.message }; }
});

ipcMain.handle('github-get-prs', async (_e, owner, repo, state = 'open') => {
  try {
    const creds = connectorEngine.getCredentials('github');
    if (!creds?.token) return { ok: false, error: 'GitHub not connected' };
    const prs = await GithubAPI.getPullRequests(creds, owner, repo, state);
    return { ok: true, prs };
  } catch (err) { return { ok: false, error: err.message }; }
});

ipcMain.handle('github-get-notifications', async () => {
  try {
    const creds = connectorEngine.getCredentials('github');
    if (!creds?.token) return { ok: false, error: 'GitHub not connected' };
    const notifications = await GithubAPI.getNotifications(creds);
    return { ok: true, notifications };
  } catch (err) { return { ok: false, error: err.message }; }
});

ipcMain.handle('github-get-commits', async (_e, owner, repo) => {
  try {
    const creds = connectorEngine.getCredentials('github');
    if (!creds?.token) return { ok: false, error: 'GitHub not connected' };
    const commits = await GithubAPI.getCommits(creds, owner, repo);
    return { ok: true, commits };
  } catch (err) { return { ok: false, error: err.message }; }
});

/* ══════════════════════════════════════════
   IPC — FRAMELESS WINDOW CONTROLS
══════════════════════════════════════════ */
ipcMain.on('window-minimize', () => win?.minimize());
ipcMain.on('window-maximize', () => win?.isMaximized() ? win.unmaximize() : win.maximize());
ipcMain.on('window-close',    () => win?.close());
