export { AutomationEngine, runAction } from './Core/AutomationEngine.js';

export { openApp } from './Actions/Application.js';
export { copyToClipboard } from './Actions/Clipboard.js';
export { writeFile } from './Actions/File.js';
export { openFolder } from './Actions/Folder.js';
export { sendNotification } from './Actions/Notification.js';
export { openSite } from './Actions/Site.js';
export { openTerminalAtPath, openTerminalAndRun } from './Actions/Terminal.js';

export * as GmailAPI from './Integrations/Gmail.js';
export * as GithubAPI from './Integrations/Github.js';

export { shouldRunNow } from './Scheduling/Scheduling.js';
