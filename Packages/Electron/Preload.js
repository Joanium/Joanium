// ─────────────────────────────────────────────
//  openworld — Packages/Electron/Preload.js
//  contextBridge between main process ↔ renderer
// ─────────────────────────────────────────────

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {

  /* ── Setup ── */
  saveUser:               (userData) => ipcRenderer.invoke('save-user', userData),
  saveAPIKeys:            (keysMap)  => ipcRenderer.invoke('save-api-keys', keysMap),
  saveUserProfile:        (profile)  => ipcRenderer.invoke('save-user-profile', profile),
  launchMain:             ()         => ipcRenderer.invoke('launch-main'),

  /* ── Runtime reads ── */
  getUser:                ()         => ipcRenderer.invoke('get-user'),
  getModels:              ()         => ipcRenderer.invoke('get-models'),
  getAPIKey:              (id)       => ipcRenderer.invoke('get-api-key', id),
  getCustomInstructions:  ()         => ipcRenderer.invoke('get-custom-instructions'),
  saveCustomInstructions: (content)  => ipcRenderer.invoke('save-custom-instructions', content),
  getMemory:              ()         => ipcRenderer.invoke('get-memory'),
  saveMemory:             (content)  => ipcRenderer.invoke('save-memory', content),

  /* ── Chat storage ── */
  saveChat:   (chatData) => ipcRenderer.invoke('save-chat', chatData),
  getChats:   ()         => ipcRenderer.invoke('get-chats'),
  loadChat:   (chatId)   => ipcRenderer.invoke('load-chat', chatId),
  deleteChat: (chatId)   => ipcRenderer.invoke('delete-chat', chatId),

  /* ── Automations ── */
  launchAutomations:  ()                   => ipcRenderer.invoke('launch-automations'),
  getAutomations:     ()                   => ipcRenderer.invoke('get-automations'),
  saveAutomation:     (automation)         => ipcRenderer.invoke('save-automation', automation),
  deleteAutomation:   (id)                 => ipcRenderer.invoke('delete-automation', id),
  toggleAutomation:   (id, enabled)        => ipcRenderer.invoke('toggle-automation', id, enabled),

  /* ── Connectors (credential management) ── */
  getConnectors:          ()                       => ipcRenderer.invoke('get-connectors'),
  saveConnector:          (name, credentials)      => ipcRenderer.invoke('save-connector', name, credentials),
  removeConnector:        (name)                   => ipcRenderer.invoke('remove-connector', name),
  validateConnector:      (name)                   => ipcRenderer.invoke('validate-connector', name),

  /* ── Gmail ── */
  gmailGetBrief:          (maxResults)             => ipcRenderer.invoke('gmail-get-brief', maxResults),
  gmailGetUnread:         (maxResults)             => ipcRenderer.invoke('gmail-get-unread', maxResults),
  gmailSend:              (to, subject, body)      => ipcRenderer.invoke('gmail-send', to, subject, body),
  gmailSearch:            (query, maxResults)      => ipcRenderer.invoke('gmail-search', query, maxResults),

  /* ── GitHub ── */
  githubGetRepos:         ()                       => ipcRenderer.invoke('github-get-repos'),
  githubGetFile:          (owner, repo, filePath)  => ipcRenderer.invoke('github-get-file', owner, repo, filePath),
  githubGetTree:          (owner, repo, branch)    => ipcRenderer.invoke('github-get-tree', owner, repo, branch),
  githubGetIssues:        (owner, repo, state)     => ipcRenderer.invoke('github-get-issues', owner, repo, state),
  githubGetPRs:           (owner, repo, state)     => ipcRenderer.invoke('github-get-prs', owner, repo, state),
  githubGetNotifications: ()                       => ipcRenderer.invoke('github-get-notifications'),
  githubGetCommits:       (owner, repo)            => ipcRenderer.invoke('github-get-commits', owner, repo),

  /* ── Frameless window controls ── */
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close:    () => ipcRenderer.send('window-close'),

});
