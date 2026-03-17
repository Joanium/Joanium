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

  /* ── Frameless window controls ── */
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close:    () => ipcRenderer.send('window-close'),

});
