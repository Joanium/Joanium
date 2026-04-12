import { contextBridge, ipcRenderer } from 'electron';
const ptyDataListeners = new Set(),
  ptyExitListeners = new Set(),
  browserPreviewListeners = new Set(),
  featureEventListeners = new Map(),
  updateProgressListeners = new Set(),
  updateDownloadedListeners = new Set();
(ipcRenderer.on('pty-data', (_e, pid, data) => {
  for (const callback of ptyDataListeners)
    try {
      callback(pid, data);
    } catch (err) {
      console.warn('[Preload] PTY data listener failed:', err);
    }
}),
  ipcRenderer.on('pty-exit', (_e, pid, exitCode) => {
    for (const callback of ptyExitListeners)
      try {
        callback(pid, exitCode);
      } catch (err) {
        console.warn('[Preload] PTY exit listener failed:', err);
      }
  }),
  ipcRenderer.on('browser-preview-state', (_e, payload) => {
    for (const callback of browserPreviewListeners)
      try {
        callback(payload);
      } catch (err) {
        console.warn('[Preload] Browser preview listener failed:', err);
      }
  }),
  ipcRenderer.on('feature:event', (_e, payload) => {
    const key = `${payload?.featureId}:${payload?.event}`,
      listeners = featureEventListeners.get(key);
    if (listeners?.size)
      for (const callback of listeners)
        try {
          callback(payload.payload);
        } catch (err) {
          console.warn('[Preload] Feature listener failed:', err);
        }
  }),
  ipcRenderer.on('update:download-progress', (_e, payload) => {
    for (const callback of updateProgressListeners)
      try {
        callback(payload);
      } catch (err) {
        console.warn('[Preload] Update progress listener failed:', err);
      }
  }),
  ipcRenderer.on('update:downloaded', (_e, payload) => {
    for (const callback of updateDownloadedListeners)
      try {
        callback(payload);
      } catch (err) {
        console.warn('[Preload] Update downloaded listener failed:', err);
      }
  }),
  contextBridge.exposeInMainWorld('featureAPI', {
    getBoot: () => ipcRenderer.invoke('feature:get-boot'),
    invoke: (featureId, method, payload) =>
      ipcRenderer.invoke('feature:invoke', featureId, method, payload),
    subscribe: (featureId, eventName, callback) => {
      if (!featureId || !eventName || 'function' != typeof callback) return () => {};
      const key = `${featureId}:${eventName}`,
        listeners = featureEventListeners.get(key) ?? new Set();
      return (
        listeners.add(callback),
        featureEventListeners.set(key, listeners),
        () => {
          const current = featureEventListeners.get(key);
          (current?.delete(callback), current?.size || featureEventListeners.delete(key));
        }
      );
    },
  }),
  contextBridge.exposeInMainWorld('electronAPI', {
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    send: (channel, ...args) => ipcRenderer.send(channel, ...args),
    on: (channel, callback) => {
      if ('function' != typeof callback) return () => {};
      const listener = (_e, ...data) => callback(...data);
      return (
        ipcRenderer.on(channel, listener),
        () => ipcRenderer.removeListener(channel, listener)
      );
    },
    onPtyData: (cb) => {
      'function' == typeof cb && ptyDataListeners.add(cb);
    },
    offPtyData: (cb) => ptyDataListeners.delete(cb),
    onPtyExit: (cb) => {
      'function' == typeof cb && ptyExitListeners.add(cb);
    },
    offPtyExit: (cb) => ptyExitListeners.delete(cb),
    onBrowserPreviewState: (cb) => {
      'function' == typeof cb && browserPreviewListeners.add(cb);
    },
    offBrowserPreviewState: (cb) => browserPreviewListeners.delete(cb),
    onUpdateDownloadProgress: (cb) => {
      'function' == typeof cb && updateProgressListeners.add(cb);
    },
    offUpdateDownloadProgress: (cb) => updateProgressListeners.delete(cb),
    onUpdateDownloaded: (cb) => {
      'function' == typeof cb && updateDownloadedListeners.add(cb);
    },
    offUpdateDownloaded: (cb) => updateDownloadedListeners.delete(cb),
  }));
