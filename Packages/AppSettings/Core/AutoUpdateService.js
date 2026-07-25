import path from 'node:path';
import process from 'node:process';
import { app, BrowserWindow } from 'electron';
import electronUpdater from 'electron-updater';
import { createTimestampedFileLogger } from '../../Shared/Debug/FileLogger.js';

const CHECK_DELAY_MS = 15000;
const UPDATE_CHANNELS = {
  progress: 'auto-update:download-progress',
  state: 'auto-update:state',
  downloaded: 'auto-update:downloaded',
};

let autoUpdater = null;
let initialized = false;
let checkTimer = null;
let logFilePath = null;
const writeTimestampedLog = createTimestampedFileLogger(() => logFilePath);

const state = {
  enabled: true,
  supported: false,
  status: 'idle',
  version: null,
  progress: null,
  downloaded: false,
  error: null,
};

function writeLog(message, details = '') {
  writeTimestampedLog(message, details);
}

function snapshot() {
  return {
    ...state,
    progress: state.progress ? { ...state.progress } : null,
  };
}

function broadcast(channel = UPDATE_CHANNELS.state, payload = snapshot()) {
  for (const windowRef of BrowserWindow.getAllWindows()) {
    if (!windowRef.isDestroyed() && !windowRef.webContents.isDestroyed()) {
      windowRef.webContents.send(channel, payload);
    }
  }
}

function setState(patch) {
  Object.assign(state, patch);
  broadcast();
  return snapshot();
}

function canCheck() {
  return Boolean(state.enabled && state.supported && autoUpdater && app.isPackaged);
}

function clearScheduledCheck() {
  if (checkTimer) {
    clearTimeout(checkTimer);
    checkTimer = null;
  }
}

function getLogFilePath(rootDirectory) {
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), 'Logs', 'auto-update.log');
  }
  return path.join(rootDirectory, 'Build', 'Logs', 'auto-update.log');
}

async function checkForUpdatesNow() {
  clearScheduledCheck();

  if (!canCheck()) {
    return setState({
      status: state.enabled ? 'unsupported' : 'disabled',
      progress: null,
      error: null,
    });
  }

  setState({ status: 'checking', error: null });
  writeLog('check:start');

  try {
    await autoUpdater.checkForUpdates();
    return snapshot();
  } catch (error) {
    const message = error?.stack ?? error?.message ?? String(error);
    writeLog('check:error', message);
    return setState({ status: 'error', error: error?.message ?? String(error) });
  }
}

function scheduleCheck() {
  clearScheduledCheck();
  if (!canCheck()) {
    return;
  }
  checkTimer = setTimeout(() => {
    void checkForUpdatesNow();
  }, CHECK_DELAY_MS);
}

function bindUpdaterEvents() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.channel = 'latest';

  autoUpdater.on('checking-for-update', () => {
    writeLog('checking-for-update');
    setState({ status: 'checking', error: null });
  });

  autoUpdater.on('update-not-available', () => {
    writeLog('update-not-available');
    setState({ status: 'current', progress: null, downloaded: false, error: null });
  });

  autoUpdater.on('update-available', (info) => {
    const version = info?.version ?? info?.releaseName ?? null;
    writeLog('update-available', version ?? '');
    setState({
      status: 'downloading',
      version,
      progress: { percent: 0, bytesPerSecond: 0, transferred: 0, total: 0 },
      downloaded: false,
      error: null,
    });
    autoUpdater.downloadUpdate().catch((error) => {
      const message = error?.stack ?? error?.message ?? String(error);
      writeLog('download:error', message);
      setState({ status: 'error', error: error?.message ?? String(error) });
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    const nextProgress = {
      percent: progress?.percent ?? 0,
      bytesPerSecond: progress?.bytesPerSecond ?? 0,
      transferred: progress?.transferred ?? 0,
      total: progress?.total ?? 0,
    };
    state.progress = nextProgress;
    state.status = 'downloading';
    writeLog('download-progress', String(Math.round(nextProgress.percent)));
    broadcast(UPDATE_CHANNELS.progress, nextProgress);
    broadcast();
  });

  autoUpdater.on('update-downloaded', (info) => {
    const version = info?.version ?? state.version;
    writeLog('update-downloaded', version ?? '');
    setState({
      status: 'downloaded',
      version,
      progress: { ...(state.progress ?? {}), percent: 100 },
      downloaded: true,
      error: null,
    });
    broadcast(UPDATE_CHANNELS.downloaded, snapshot());
  });

  autoUpdater.on('error', (error) => {
    const message = error?.stack ?? error?.message ?? String(error);
    writeLog('updater:error', message);
    setState({ status: 'error', error: error?.message ?? String(error) });
  });
}

export function setupAutoUpdates({ rootDirectory, enabled = true } = {}) {
  logFilePath = getLogFilePath(rootDirectory);
  state.enabled = Boolean(enabled);
  state.supported = app.isPackaged && !process.argv.includes('--dev');

  if (!state.supported) {
    state.status = state.enabled ? 'unsupported' : 'disabled';
    return snapshot();
  }

  if (!initialized) {
    initialized = true;
    try {
      autoUpdater = electronUpdater.autoUpdater;
      bindUpdaterEvents();
    } catch (error) {
      const message = error?.stack ?? error?.message ?? String(error);
      writeLog('setup:error', message);
      state.supported = false;
      state.status = 'unsupported';
      state.error = error?.message ?? String(error);
      return snapshot();
    }
  }

  if (state.enabled) {
    state.status = state.downloaded ? 'downloaded' : 'idle';
    scheduleCheck();
  } else {
    state.status = 'disabled';
    clearScheduledCheck();
  }

  return snapshot();
}

export function setAutoUpdateEnabled(enabled) {
  state.enabled = Boolean(enabled);
  if (state.enabled) {
    state.status = state.supported ? 'idle' : 'unsupported';
    scheduleCheck();
  } else {
    clearScheduledCheck();
    state.status = 'disabled';
  }
  return setState({ enabled: state.enabled, status: state.status });
}

export function getAutoUpdateState() {
  return snapshot();
}

export function checkForAppUpdates() {
  return checkForUpdatesNow();
}

export function installDownloadedUpdate() {
  if (!autoUpdater || !state.downloaded) {
    return false;
  }
  autoUpdater.quitAndInstall(false, true);
  return true;
}
