import fs from 'fs';
import path from 'path';

export const actionType = 'move_file';
export const actionMeta = {
  label: 'Move file',
  group: 'File System',
  fields: ['sourcePath', 'destPath'],
  requiredFields: ['sourcePath', 'destPath'],
};
export async function execute(action) {
  if (!action.sourcePath || !action.destPath) throw new Error('move_file: source and destination paths required');
  const destDir = path.dirname(action.destPath);
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  fs.renameSync(action.sourcePath, action.destPath);
}
