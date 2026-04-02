import { exec } from 'child_process';

export const actionType = 'lock_screen';
export const actionMeta = {
  label: 'Lock screen',
  group: 'System',
  fields: [],
  requiredFields: [],
};
export async function execute() {
  if (process.platform === 'darwin') {
    exec('pmset displaysleepnow');
  } else if (process.platform === 'win32') {
    exec('rundll32.exe user32.dll,LockWorkStation');
  } else {
    exec('xdg-screensaver lock 2>/dev/null || gnome-screensaver-command -l 2>/dev/null || loginctl lock-session');
  }
}
