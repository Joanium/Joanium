import { powerSaveBlocker } from 'electron';

/**
 * PowerService — wraps Electron's powerSaveBlocker.
 *
 * Works identically on macOS, Windows and Linux.
 * 'prevent-app-suspension' keeps the process alive and
 * prevents system sleep while the app is running.
 */

let _id = null;

export function start() {
  if (_id !== null && powerSaveBlocker.isStarted(_id)) return; // already active
  _id = powerSaveBlocker.start('prevent-app-suspension');
}

export function stop() {
  if (_id !== null && powerSaveBlocker.isStarted(_id)) {
    powerSaveBlocker.stop(_id);
  }
  _id = null;
}

export function isActive() {
  return _id !== null && powerSaveBlocker.isStarted(_id);
}
