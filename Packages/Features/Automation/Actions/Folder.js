import { exec } from 'child_process';
import { shell } from 'electron';

export function openFolder(folderPath) {
    if (!folderPath) throw new Error('openFolder: no path provided');
    return new Promise((resolve, reject) => {
        if (process.platform === 'win32') {
            exec(`start "" "${folderPath}"`, { shell: 'cmd.exe' }, (err) => {
                if (err) { console.error('[AutomationEngine] openFolder error:', err); return reject(err); }
                resolve();
            });
        } else {
            shell.openPath(folderPath).then((result) => {
                if (result) reject(new Error(result));
                else resolve();
            });
        }
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
  await openFolder(action.path);
  if (action.openTerminal) {
    const { openTerminalAtPath } = await import('./Terminal.js');
    await openTerminalAtPath(action.path, action.terminalCommand || '');
  }
}