import { exec } from 'child_process';
import { openTerminalAndRun } from './Terminal.js';
import { sendNotification } from './Notification.js';
export const actionType = 'run_command';
export const actionMeta = {
  label: 'Run command',
  group: 'System',
  fields: ['command', 'silent', 'notifyOnFinish'],
  requiredFields: ['command'],
};
export async function execute(action) {
  if (!action.command) throw new Error('run_command: no command provided');
  action.silent
    ? await new Promise((resolve, reject) => {
        exec(action.command, (err) => {
          (action.notifyOnFinish &&
            sendNotification(err ? 'Command failed' : 'Command done', action.command.slice(0, 80)),
            err ? reject(err) : resolve());
        });
      })
    : (await openTerminalAndRun(action.command),
      action.notifyOnFinish && sendNotification('Command launched', action.command.slice(0, 80)));
}
