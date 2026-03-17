// ─────────────────────────────────────────────
//  openworld — Packages/Electron/preload.js
//  contextBridge between main process ↔ renderer
// ─────────────────────────────────────────────

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {

  /* ── Setup ── */
  saveUser:    (userData)    => ipcRenderer.invoke('save-user', userData),
  saveAPIKeys: (keysMap)     => ipcRenderer.invoke('save-api-keys', keysMap),
  launchMain:  ()            => ipcRenderer.invoke('launch-main'),

  /* ── Runtime reads ── */
  getUser:     ()            => ipcRenderer.invoke('get-user'),
  getModels:   ()            => ipcRenderer.invoke('get-models'),
  getAPIKey:   (providerId)  => ipcRenderer.invoke('get-api-key', providerId),

  /* ── Frameless window controls ── */
  minimize:    ()            => ipcRenderer.send('window-minimize'),
  maximize:    ()            => ipcRenderer.send('window-maximize'),
  close:       ()            => ipcRenderer.send('window-close'),

});
