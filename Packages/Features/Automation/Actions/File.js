import fs from 'fs';
import path from 'path';
export function writeFile(filePath, content = '') {
  if (!filePath) throw new Error('writeFile: no file path provided');
  const dir = path.dirname(filePath);
  (fs.existsSync(dir) || fs.mkdirSync(dir, { recursive: !0 }),
    fs.writeFileSync(filePath, String(content), 'utf-8'));
}
export const actionType = 'write_file';
export const actionMeta = {
  label: 'Write file',
  group: 'File System',
  fields: ['filePath', 'content', 'append'],
  requiredFields: ['filePath'],
};
export async function execute(action) {
  if (!action.filePath) throw new Error('write_file: no file path provided');
  const dir = path.dirname(action.filePath);
  (fs.existsSync(dir) || fs.mkdirSync(dir, { recursive: !0 }),
    action.append
      ? fs.appendFileSync(action.filePath, String(action.content ?? ''), 'utf-8')
      : fs.writeFileSync(action.filePath, String(action.content ?? ''), 'utf-8'));
}
