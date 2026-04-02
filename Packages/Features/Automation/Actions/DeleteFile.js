import fs from 'fs';

export const actionType = 'delete_file';
export const actionMeta = {
  label: 'Delete file',
  group: 'File System',
  fields: ['filePath'],
  requiredFields: ['filePath'],
};
export async function execute(action) {
  if (!action.filePath) throw new Error('delete_file: no file path provided');
  fs.unlinkSync(action.filePath);
}
