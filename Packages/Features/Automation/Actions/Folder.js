import { exec } from 'child_process';
import { shell } from 'electron';
export function openFolder(folderPath) {
  if (!folderPath) throw new Error('openFolder: no path provided');
  return new Promise((resolve, reject) => {
    'win32' === process.platform
      ? exec(`start "" "${folderPath}"`, { shell: 'cmd.exe' }, (err) => {
          if (err) return (console.error('[AutomationEngine] openFolder error:', err), reject(err));
          resolve();
        })
      : shell.openPath(folderPath).then((result) => {
          result ? reject(new Error(result)) : resolve();
        });
  });
}
export const actionType = 'open_folder';
export const actionMeta = {
  label: 'Open folder',
  group: 'System',
  fields: ['path', 'openTerminal'],
  requiredFields: ['path'],
};
export async function execute(action) {
  if ((await openFolder(action.path), action.openTerminal)) {
    const { openTerminalAtPath: openTerminalAtPath } = await import('./Terminal.js');
    await openTerminalAtPath(action.path, action.terminalCommand || '');
  }
}
