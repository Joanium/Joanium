import { shell } from 'electron';

export async function openApp(appPath) {
    if (!appPath) throw new Error('openApp: no app path provided');
    const result = await shell.openPath(appPath);
    if (result) throw new Error(`openApp: ${result}`);
}