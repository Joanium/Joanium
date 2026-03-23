import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {

  // Setup
  saveUser: (userData) => ipcRenderer.invoke('save-user', userData),
  saveAPIKeys: (keysMap) => ipcRenderer.invoke('save-api-keys', keysMap),
  saveUserProfile: (profile) => ipcRenderer.invoke('save-user-profile', profile),
  launchMain: () => ipcRenderer.invoke('launch-main'),
  launchSkills: () => ipcRenderer.invoke('launch-skills'),
  launchPersonas: () => ipcRenderer.invoke('launch-personas'),

  // Runtime reads
  getUser: () => ipcRenderer.invoke('get-user'),
  getModels: () => ipcRenderer.invoke('get-models'),
  getAPIKey: (id) => ipcRenderer.invoke('get-api-key', id),
  getCustomInstructions: () => ipcRenderer.invoke('get-custom-instructions'),
  saveCustomInstructions: (content) => ipcRenderer.invoke('save-custom-instructions', content),
  getMemory: () => ipcRenderer.invoke('get-memory'),
  saveMemory: (content) => ipcRenderer.invoke('save-memory', content),

  // System prompt
  getSystemPrompt: () => ipcRenderer.invoke('get-system-prompt'),

  // Chat storage
  saveChat: (chatData) => ipcRenderer.invoke('save-chat', chatData),
  getChats: () => ipcRenderer.invoke('get-chats'),
  loadChat: (chatId) => ipcRenderer.invoke('load-chat', chatId),
  deleteChat: (chatId) => ipcRenderer.invoke('delete-chat', chatId),

  // Automations
  launchAutomations: () => ipcRenderer.invoke('launch-automations'),
  getAutomations: () => ipcRenderer.invoke('get-automations'),
  saveAutomation: (automation) => ipcRenderer.invoke('save-automation', automation),
  deleteAutomation: (id) => ipcRenderer.invoke('delete-automation', id),
  toggleAutomation: (id, enabled) => ipcRenderer.invoke('toggle-automation', id, enabled),

  // Connectors — service
  getConnectors: () => ipcRenderer.invoke('get-connectors'),
  saveConnector: (name, credentials) => ipcRenderer.invoke('save-connector', name, credentials),
  removeConnector: (name) => ipcRenderer.invoke('remove-connector', name),
  validateConnector: (name) => ipcRenderer.invoke('validate-connector', name),

  // Connectors — free APIs
  getFreeConnectorConfig: (name) => ipcRenderer.invoke('get-free-connector-config', name),
  toggleFreeConnector: (name, enabled) => ipcRenderer.invoke('toggle-free-connector', name, enabled),
  saveFreeConnectorKey: (name, apiKey) => ipcRenderer.invoke('save-free-connector-key', name, apiKey),

  // Gmail
  gmailOAuthStart: (clientId, clientSecret) => ipcRenderer.invoke('gmail-oauth-start', clientId, clientSecret),
  gmailGetBrief: (maxResults) => ipcRenderer.invoke('gmail-get-brief', maxResults),
  gmailGetUnread: (maxResults) => ipcRenderer.invoke('gmail-get-unread', maxResults),
  gmailSend: (to, subject, body) => ipcRenderer.invoke('gmail-send', to, subject, body),
  gmailSearch: (query, maxResults) => ipcRenderer.invoke('gmail-search', query, maxResults),

  // GitHub
  githubGetRepos: () => ipcRenderer.invoke('github-get-repos'),
  githubGetFile: (owner, repo, filePath) => ipcRenderer.invoke('github-get-file', owner, repo, filePath),
  githubGetTree: (owner, repo, branch) => ipcRenderer.invoke('github-get-tree', owner, repo, branch),
  githubGetIssues: (owner, repo, state) => ipcRenderer.invoke('github-get-issues', owner, repo, state),
  githubGetPRs: (owner, repo, state) => ipcRenderer.invoke('github-get-prs', owner, repo, state),
  githubGetNotifications: () => ipcRenderer.invoke('github-get-notifications'),
  githubGetCommits: (owner, repo) => ipcRenderer.invoke('github-get-commits', owner, repo),

  // Skills
  getSkills: () => ipcRenderer.invoke('get-skills'),
  toggleSkill: (filename, enabled) => ipcRenderer.invoke('toggle-skill', filename, enabled),
  enableAllSkills: () => ipcRenderer.invoke('enable-all-skills'),
  disableAllSkills: () => ipcRenderer.invoke('disable-all-skills'),

  // Personas
  getPersonas: () => ipcRenderer.invoke('get-personas'),
  getActivePersona: () => ipcRenderer.invoke('get-active-persona'),
  setActivePersona: (personaData) => ipcRenderer.invoke('set-active-persona', personaData),
  resetActivePersona: () => ipcRenderer.invoke('reset-active-persona'),

  // Usage analytics
  trackUsage: (record) => ipcRenderer.invoke('track-usage', record),
  getUsage: () => ipcRenderer.invoke('get-usage'),
  clearUsage: () => ipcRenderer.invoke('clear-usage'),
  launchUsage: () => ipcRenderer.invoke('launch-usage'),

  // Agents
  getAgents: () => ipcRenderer.invoke('get-agents'),
  saveAgent: (agent) => ipcRenderer.invoke('save-agent', agent),
  deleteAgent: (id) => ipcRenderer.invoke('delete-agent', id),
  toggleAgent: (id, enabled) => ipcRenderer.invoke('toggle-agent', id, enabled),
  runAgentNow: (agentId) => ipcRenderer.invoke('run-agent-now', agentId),
  launchAgents: () => ipcRenderer.invoke('launch-agents'),

  // Events
  launchEvents: () => ipcRenderer.invoke('launch-events'),
  getRunningJobs: () => ipcRenderer.invoke('get-running-jobs'),
  clearEventsHistory: () => ipcRenderer.invoke('clear-events-history'),

  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  // File System & Terminal
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  runShellCommand: (params) => ipcRenderer.invoke('run-shell-command', params),
  readLocalFile: (params) => ipcRenderer.invoke('read-local-file', params),
  listDirectory: (params) => ipcRenderer.invoke('list-directory', params),
  writeAIFile: (params) => ipcRenderer.invoke('write-ai-file', params),
  createDirectory: (params) => ipcRenderer.invoke('create-directory', params),
  openFolderOS: (params) => ipcRenderer.invoke('open-folder-os', params),
  openTerminalOS: (params) => ipcRenderer.invoke('open-terminal-os', params),
  deleteItem: (params) => ipcRenderer.invoke('delete-item', params),
  
  // PTY / Embedded Terminal
  spawnPty: (opts) => ipcRenderer.invoke('pty-spawn', opts),
  writePty: (pid, data) => ipcRenderer.invoke('pty-write', pid, data),
  resizePty: (pid, cols, rows) => ipcRenderer.invoke('pty-resize', pid, cols, rows),
  killPty: (pid) => ipcRenderer.invoke('pty-kill', pid),
  onPtyData: (callback) => {
    // Only register once
    ipcRenderer.removeAllListeners('pty-data');
    ipcRenderer.on('pty-data', (_e, pid, data) => callback(pid, data));
  },
  onPtyExit: (callback) => {
    ipcRenderer.removeAllListeners('pty-exit');
    ipcRenderer.on('pty-exit', (_e, pid, exitCode) => callback(pid, exitCode));
  },

});
