import { shell } from 'electron';

export async function openSite(url) {
    if (!url) throw new Error('openSite: no URL provided');
    let target = url.trim();
    if (/^https?:[^/]/i.test(target)) target = target.replace(/^https?:/i, 'https://');
    if (!/^https?:\/\//i.test(target)) target = `https://${target}`;
    await shell.openExternal(target);
}

export const actionType = 'open_site';
export const actionMeta = {
  label: 'Open site',
  group: 'System',
  fields: ['url'],
  requiredFields: ['url'],
};
export async function execute(action) {
  await openSite(action.url);
}