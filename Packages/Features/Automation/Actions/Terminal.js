import { exec } from 'child_process';

function sq(str) {
  return `'${String(str ?? '').replace(/'/g, "'\\''")}'`;
}

export function openTerminalAtPath(folderPath, command = '') {
    if (!folderPath) throw new Error('openTerminalAtPath: no path provided');
    return new Promise((resolve, reject) => {
        let launcher;
        const cdAndRun = command ? `cd ${sq(folderPath)} && ${command}` : `cd ${sq(folderPath)}`;
        if (process.platform === 'darwin') {
            const escaped = cdAndRun.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            launcher = `osascript -e 'tell application "Terminal" to do script "${escaped}"'`;
        } else if (process.platform === 'win32') {
            const winPath = folderPath.replace(/"/g, '');
            launcher = command
                ? `start cmd.exe /k "cd /d "${winPath}" && ${command}"`
                : `start cmd.exe /k "cd /d "${winPath}""`;
        } else {
            launcher = `x-terminal-emulator -e bash -c "${cdAndRun}; exec bash" || gnome-terminal -- bash -c "${cdAndRun}; exec bash"`;
        }
        exec(launcher, (err) => {
            if (err) { console.error('[AutomationEngine] openTerminalAtPath error:', err); reject(err); }
            else resolve();
        });
    });
}

export function openTerminalAndRun(command) {
    if (!command) throw new Error('openTerminalAndRun: no command provided');
    return new Promise((resolve, reject) => {
        let launcher;
        if (process.platform === 'darwin') {
            const escaped = command.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            launcher = `osascript -e 'tell application "Terminal" to do script "${escaped}"'`;
        } else if (process.platform === 'win32') {
            launcher = `start cmd.exe /k "${command}"`;
        } else {
            launcher = `x-terminal-emulator -e bash -c "${command}; read" || gnome-terminal -- bash -c "${command}; read"`;
        }
        exec(launcher, (err) => {
            if (err) { console.error('[AutomationEngine] openTerminalAndRun error:', err); reject(err); }
            else resolve();
        });
    });
}