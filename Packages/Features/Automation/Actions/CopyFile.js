import fs from 'fs';
import path from 'path';
export const actionType = 'copy_file';
export const actionMeta = {
  label: 'Copy file',
  group: 'File System',
  fields: ['sourcePath', 'destPath'],
  requiredFields: ['sourcePath', 'destPath'],
};
export async function execute(action) {
  if (!action.sourcePath || !action.destPath)
    throw new Error('copy_file: source and destination paths required');
  const destDir = path.dirname(action.destPath);
  (fs.existsSync(destDir) || fs.mkdirSync(destDir, { recursive: !0 }),
    fs.copyFileSync(action.sourcePath, action.destPath));
}
