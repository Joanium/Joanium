import { ipcMain } from 'electron';
import { discoverPages } from '../Core/PageDiscovery.js';
import { wrapRead } from './IPCWrapper.js';
export const ipcMeta = { needs: [] };
export function register() {
  ipcMain.handle(
    'get-pages',
    wrapRead(() => discoverPages()),
  );
}
