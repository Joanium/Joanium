import { Notification, shell } from 'electron';
export function sendNotification(title, body = '', clickUrl = '') {
  if (!Notification.isSupported())
    return void console.warn('[AutomationEngine] Notifications not supported on this platform');
  if (!title) throw new Error('sendNotification: no title provided');
  const n = new Notification({ title: title, body: body });
  (clickUrl && n.on('click', () => shell.openExternal(clickUrl)), n.show());
}
export const actionType = 'send_notification';
export const actionMeta = {
  label: 'Send notification',
  group: 'System',
  fields: ['title', 'body', 'clickUrl'],
  requiredFields: ['title'],
};
export async function execute(action) {
  sendNotification(action.title, action.body ?? '', action.clickUrl ?? '');
}
