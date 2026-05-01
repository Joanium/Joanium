export const BUILT_IN_SLASH_COMMAND_IDS = Object.freeze([
  'new',
  'private',
  'settings',
  'help',
  'close',
  'restart',
  'skills',
  'personas',
  'marketplace',
  'usage',
  'events',
  'chat',
  'library',
  'projects',
  'templates',
  'agents',
  'setup',
]);

export function sanitizeSlashCommandId(raw = '') {
  return String(raw ?? '')
    .replace(/^\//, '')
    .replace(/\s+/g, '_')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
}

export function isBuiltInSlashCommandId(id = '') {
  return BUILT_IN_SLASH_COMMAND_IDS.includes(sanitizeSlashCommandId(id));
}
