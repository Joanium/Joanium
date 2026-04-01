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