import { shell } from 'electron';

export async function openSite(url) {
    if (!url) throw new Error('openSite: no URL provided');
    let target = url.trim();
    if (/^https?:[^/]/i.test(target)) target = target.replace(/^https?:/i, 'https://');
    if (!/^https?:\/\//i.test(target)) target = `https://${target}`;
    await shell.openExternal(target);
}