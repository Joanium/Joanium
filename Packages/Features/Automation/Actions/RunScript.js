import { exec } from 'child_process';
import path from 'path';
import { openTerminalAndRun } from './Terminal.js';
import { sendNotification } from './Notification.js';

export const actionType = 'run_script';
export const actionMeta = {
  label: 'Run script',
  group: 'System',
  fields: ['scriptPath', 'args', 'silent', 'notifyOnFinish'],
  requiredFields: ['scriptPath'],
};
export async function execute(action) {
  if (!action.scriptPath) throw new Error('run_script: no script path provided');
  const cmd = action.args?.trim()
    ? `${action.scriptPath} ${action.args}`
    : action.scriptPath;
  if (action.silent) {
    await new Promise((resolve, reject) => {
      exec(cmd, (err) => {
        if (action.notifyOnFinish) {
          sendNotification(
            err ? 'Script failed' : 'Script done',
            path.basename(action.scriptPath),
          );
        }
        err ? reject(err) : resolve();
      });
    });
  } else {
    await openTerminalAndRun(cmd);
    if (action.notifyOnFinish) sendNotification('Script launched', path.basename(action.scriptPath));
  }
}
