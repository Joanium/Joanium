import { Notification, shell } from 'electron';

export function sendNotification(title, body = '', clickUrl = '') {
    if (!Notification.isSupported()) {
        console.warn('[AutomationEngine] Notifications not supported on this platform');
        return;
    }
    if (!title) throw new Error('sendNotification: no title provided');
    const n = new Notification({ title, body });
    if (clickUrl) n.on('click', () => shell.openExternal(clickUrl));
    n.show();
}
