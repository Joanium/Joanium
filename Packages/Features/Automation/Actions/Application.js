import { shell } from 'electron';

export async function openApp(appPath) {
    if (!appPath) throw new Error('openApp: no app path provided');
    const result = await shell.openPath(appPath);
    if (result) throw new Error(`openApp: ${result}`);
}

export const actionType = 'open_app';
export const actionMeta = {
  label: 'Open application',
  group: 'System',
  fields: ['appPath'],
  requiredFields: ['appPath'],
};
export async function execute(action) {
  await openApp(action.appPath);
}