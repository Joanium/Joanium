import { contextBridge, ipcRenderer } from 'electron';

const ptyDataListeners = new Set();
const ptyExitListeners = new Set();
const browserPreviewListeners = new Set();

ipcRenderer.on('pty-data', (_e, pid, data) => {
  for (const callback of ptyDataListeners) {
    try { callback(pid, data); }
    catch (err) { console.warn('[Preload] PTY data listener failed:', err); }
  }
});

ipcRenderer.on('pty-exit', (_e, pid, exitCode) => {
  for (const callback of ptyExitListeners) {
    try { callback(pid, exitCode); }
    catch (err) { console.warn('[Preload] PTY exit listener failed:', err); }
  }
});

ipcRenderer.on('browser-preview-state', (_e, payload) => {
  for (const callback of browserPreviewListeners) {
    try { callback(payload); }
    catch (err) { console.warn('[Preload] Browser preview listener failed:', err); }
  }
});

contextBridge.exposeInMainWorld('electronAPI', {
  onNavigate: (callback) => {
    if (typeof callback !== 'function') return;
    ipcRenderer.on('navigate', (_e, page) => callback(page));
  },

  // Setup
  saveUser: (userData) => ipcRenderer.invoke('save-user', userData),
  saveAPIKeys: (keysMap) => ipcRenderer.invoke('save-api-keys', keysMap),
  saveProviderConfigs: (configMap) => ipcRenderer.invoke('save-provider-configs', configMap),
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
  saveChat: (chatData, opts) => ipcRenderer.invoke('save-chat', chatData, opts),
  getChats: (opts) => ipcRenderer.invoke('get-chats', opts),
  loadChat: (chatId, opts) => ipcRenderer.invoke('load-chat', chatId, opts),
  deleteChat: (chatId, opts) => ipcRenderer.invoke('delete-chat', chatId, opts),

  // Projects
  getProjects: () => ipcRenderer.invoke('get-projects'),
  getProject: (projectId) => ipcRenderer.invoke('get-project', projectId),
  createProject: (projectData) => ipcRenderer.invoke('create-project', projectData),
  updateProject: (projectId, patch) => ipcRenderer.invoke('update-project', projectId, patch),
  deleteProject: (projectId) => ipcRenderer.invoke('delete-project', projectId),
  validateProject: (projectId) => ipcRenderer.invoke('validate-project', projectId),

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
  githubSearchCode: (owner, repo, query) => ipcRenderer.invoke('github-search-code', owner, repo, query),
  githubGetPRDiff: (owner, repo, prNumber) => ipcRenderer.invoke('github-get-pr-diff', owner, repo, prNumber),
  githubGetPRDetails: (owner, repo, prNumber) => ipcRenderer.invoke('github-get-pr-details', owner, repo, prNumber),
  githubCreatePRReview: (owner, repo, prNumber, review) => ipcRenderer.invoke('github-create-pr-review', owner, repo, prNumber, review),
  githubGetPRChecks: (owner, repo, prNumber) => ipcRenderer.invoke('github-get-pr-checks', owner, repo, prNumber),
  githubGetWorkflowRuns: (owner, repo, branch, event, perPage) => ipcRenderer.invoke('github-get-workflow-runs', owner, repo, branch, event, perPage),
  githubGetPRComments: (owner, repo, prNumber) => ipcRenderer.invoke('github-get-pr-comments', owner, repo, prNumber),

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

  // Channel gateway — main → renderer event + reply back
  onChannelIncoming: (cb) => ipcRenderer.on('channel-incoming', (_e, data) => cb(data)),
  channelReply: (id, text) => ipcRenderer.invoke('channel-reply', id, text),

  // MCP
  mcpListServers: () => ipcRenderer.invoke('mcp-list-servers'),
  mcpSaveServer: (serverConfig) => ipcRenderer.invoke('mcp-save-server', serverConfig),
  mcpRemoveServer: (serverId) => ipcRenderer.invoke('mcp-remove-server', serverId),
  mcpConnectServer: (serverId) => ipcRenderer.invoke('mcp-connect-server', serverId),
  mcpDisconnectServer: (serverId) => ipcRenderer.invoke('mcp-disconnect-server', serverId),
  mcpGetTools: () => ipcRenderer.invoke('mcp-get-tools'),
  mcpCallTool: (payload) => ipcRenderer.invoke('mcp-call-tool', payload),

  // Browser preview
  browserPreviewGetState: () => ipcRenderer.invoke('browser-preview-get-state'),
  browserPreviewSetVisible: (visible) => ipcRenderer.invoke('browser-preview-set-visible', visible),
  browserPreviewSetBounds: (bounds) => ipcRenderer.invoke('browser-preview-set-bounds', bounds),
  onBrowserPreviewState: (callback) => {
    if (typeof callback === 'function') browserPreviewListeners.add(callback);
  },
  offBrowserPreviewState: (callback) => browserPreviewListeners.delete(callback),

  // Channels
  getChannels: () => ipcRenderer.invoke('get-channels'),
  getChannelConfig: (name) => ipcRenderer.invoke('get-channel-config', name),
  saveChannel: (name, config) => ipcRenderer.invoke('save-channel', name, config),
  removeChannel: (name) => ipcRenderer.invoke('remove-channel', name),
  toggleChannel: (name, enabled) => ipcRenderer.invoke('toggle-channel', name, enabled),
  updateChannelPrompt: (name, prompt) => ipcRenderer.invoke('update-channel-prompt', name, prompt),
  validateChannel: (name, credentials) => ipcRenderer.invoke('validate-channel', name, credentials),

  // Events
  launchEvents: () => ipcRenderer.invoke('launch-events'),
  getRunningJobs: () => ipcRenderer.invoke('get-running-jobs'),
  clearEventsHistory: () => ipcRenderer.invoke('clear-events-history'),

  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  // File System & Terminal
  selectDirectory: (opts) => ipcRenderer.invoke('select-directory', opts),
  findFileByName: (params) => ipcRenderer.invoke('find-file-by-name', params),
  runShellCommand: (params) => ipcRenderer.invoke('run-shell-command', params),
  assessCommandRisk: (params) => ipcRenderer.invoke('assess-command-risk', params),
  readLocalFile: (params) => ipcRenderer.invoke('read-local-file', params),
  extractDocumentText: (params) => ipcRenderer.invoke('extract-document-text', params),
  readFileChunk: (params) => ipcRenderer.invoke('read-file-chunk', params),
  readMultipleLocalFiles: (params) => ipcRenderer.invoke('read-multiple-local-files', params),
  listDirectory: (params) => ipcRenderer.invoke('list-directory', params),
  listDirectoryTree: (params) => ipcRenderer.invoke('list-directory-tree', params),
  writeAIFile: (params) => ipcRenderer.invoke('write-ai-file', params),
  applyFilePatch: (params) => ipcRenderer.invoke('apply-file-patch', params),
  replaceLinesInFile: (params) => ipcRenderer.invoke('replace-lines-in-file', params),
  insertIntoFile: (params) => ipcRenderer.invoke('insert-into-file', params),
  createDirectory: (params) => ipcRenderer.invoke('create-directory', params),
  copyItem: (params) => ipcRenderer.invoke('copy-item', params),
  moveItem: (params) => ipcRenderer.invoke('move-item', params),
  inspectWorkspace: (params) => ipcRenderer.invoke('inspect-workspace', params),
  searchWorkspace: (params) => ipcRenderer.invoke('search-workspace', params),
  gitStatus: (params) => ipcRenderer.invoke('git-status', params),
  gitDiff: (params) => ipcRenderer.invoke('git-diff', params),
  gitCreateBranch: (params) => ipcRenderer.invoke('git-create-branch', params),
  runProjectChecks: (params) => ipcRenderer.invoke('run-project-checks', params),
  openFolderOS: (params) => ipcRenderer.invoke('open-folder-os', params),
  openTerminalOS: (params) => ipcRenderer.invoke('open-terminal-os', params),
  deleteItem: (params) => ipcRenderer.invoke('delete-item', params),
  
  // PTY / Embedded Terminal
  spawnPty: (opts) => ipcRenderer.invoke('pty-spawn', opts),
  writePty: (pid, data) => ipcRenderer.invoke('pty-write', pid, data),
  resizePty: (pid, cols, rows) => ipcRenderer.invoke('pty-resize', pid, cols, rows),
  killPty: (pid) => ipcRenderer.invoke('pty-kill', pid),
  onPtyData: (callback) => {
    if (typeof callback === 'function') ptyDataListeners.add(callback);
  },
  offPtyData: (callback) => ptyDataListeners.delete(callback),
  onPtyExit: (callback) => {
    if (typeof callback === 'function') ptyExitListeners.add(callback);
  },
  offPtyExit: (callback) => ptyExitListeners.delete(callback),

});
