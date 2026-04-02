import fs from 'fs';

export const actionType = 'create_folder';
export const actionMeta = {
  label: 'Create folder',
  group: 'File System',
  fields: ['path'],
  requiredFields: ['path'],
};
export async function execute(action) {
  if (!action.path) throw new Error('create_folder: no path provided');
  fs.mkdirSync(action.path, { recursive: true });
}
