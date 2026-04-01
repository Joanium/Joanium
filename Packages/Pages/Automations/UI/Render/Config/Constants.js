import { getFeatureBoot } from '../../../../../Features/Core/FeatureBoot.js';

export const ACTION_META = {
  open_site: { label: 'Open website', fields: ['url'], group: 'System' },
  open_multiple_sites: { label: 'Open multiple websites', fields: ['urls'], group: 'System' },
  open_folder: { label: 'Open folder', fields: ['path'], group: 'System' },
  run_command: { label: 'Run command', fields: ['command'], group: 'System' },
  run_script: { label: 'Run script file', fields: ['scriptPath', 'args'], group: 'System' },
  open_app: { label: 'Open app', fields: ['appPath'], group: 'System' },
  send_notification: { label: 'Send notification', fields: ['notifTitle', 'notifBody'], group: 'System' },
  copy_to_clipboard: { label: 'Copy to clipboard', fields: ['text'], group: 'System' },
  write_file: { label: 'Write to file', fields: ['filePath', 'content'], group: 'System' },
  move_file: { label: 'Move / rename file', fields: ['sourcePath', 'destPath'], group: 'System' },
  copy_file: { label: 'Copy file', fields: ['sourcePath', 'destPath'], group: 'System' },
  delete_file: { label: 'Delete file', fields: ['filePath'], group: 'System' },
  create_folder: { label: 'Create folder', fields: ['path'], group: 'System' },
  lock_screen: { label: 'Lock screen', fields: [], group: 'System' },
  http_request: { label: 'HTTP request / webhook', fields: ['url', 'httpMethod'], group: 'System' },
};

export const FIELD_META = {
  url: { placeholder: 'https://example.com', textarea: false },
  urls: { placeholder: 'https://example.com\nhttps://github.com\none per line...', textarea: true },
  path: { placeholder: '/Users/you/Documents or C:\\Users\\you', textarea: false },
  command: { placeholder: 'npm run build', textarea: false },
  scriptPath: { placeholder: '/Users/you/scripts/backup.sh or script.py', textarea: false },
  args: { placeholder: '--verbose --output /tmp (optional)', textarea: false },
  appPath: { placeholder: '/Applications/VS Code.app or C:\\...\\code.exe', textarea: false },
  notifTitle: { placeholder: 'Notification title', textarea: false },
  notifBody: { placeholder: 'Notification body (optional)', textarea: false },
  text: { placeholder: 'Text to copy to clipboard...', textarea: false },
  filePath: { placeholder: '/Users/you/Desktop/output.txt', textarea: false },
  content: { placeholder: 'File content...', textarea: true },
  sourcePath: { placeholder: '/Users/you/file.txt', textarea: false },
  destPath: { placeholder: '/Users/you/moved/file.txt', textarea: false },
  httpMethod: { type: 'select', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'], textarea: false },
  httpHeaders: { placeholder: 'Content-Type: application/json\nAuthorization: Bearer ...', textarea: true },
  httpBody: { placeholder: '{"key": "value"} or form=data&key=val', textarea: true },
  clickUrl: { placeholder: 'https://open-this.com on notification click (optional)', textarea: false },
  terminalCommand: { placeholder: 'npm run dev (leave blank to just open terminal)', textarea: false },
};

export const FIELD_LABELS = {
  url: 'URL',
  urls: 'URLs (one per line)',
  path: 'Folder path',
  command: 'Command',
  scriptPath: 'Script path',
  args: 'Arguments',
  appPath: 'App path',
  notifTitle: 'Title',
  notifBody: 'Body',
  text: 'Text',
  filePath: 'File path',
  content: 'Content',
  sourcePath: 'Source path',
  destPath: 'Destination path',
  httpMethod: 'Method',
  httpHeaders: 'Headers',
  httpBody: 'Request body',
  clickUrl: 'Open URL on click',
  terminalCommand: 'Then run (optional)',
};

let automationsBootLoaded = false;

export async function loadAutomationFeatureRegistry() {
  if (automationsBootLoaded) return;
  automationsBootLoaded = true;

  try {
    const boot = await getFeatureBoot();
    for (const action of boot?.automations?.actions ?? []) {
      if (!action?.type) continue;
      ACTION_META[action.type] = {
        ...(ACTION_META[action.type] ?? {}),
        ...action,
      };
    }
    Object.assign(FIELD_META, boot?.automations?.fieldMeta ?? {});
    Object.assign(FIELD_LABELS, boot?.automations?.fieldLabels ?? {});
  } catch (error) {
    console.warn('[AutomationsConstants] Failed to load feature automations:', error);
  }
}
