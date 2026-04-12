import { exec } from 'child_process';
export const actionType = 'lock_screen';
export const actionMeta = { label: 'Lock screen', group: 'System', fields: [], requiredFields: [] };
export async function execute() {
  'darwin' === process.platform
    ? exec('pmset displaysleepnow')
    : 'win32' === process.platform
      ? exec('rundll32.exe user32.dll,LockWorkStation')
      : exec(
          'xdg-screensaver lock 2>/dev/null || gnome-screensaver-command -l 2>/dev/null || loginctl lock-session',
        );
}
