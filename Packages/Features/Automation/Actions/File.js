import fs from 'fs';
import path from 'path';

export function writeFile(filePath, content = '') {
    if (!filePath) throw new Error('writeFile: no file path provided');
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, String(content), 'utf-8');
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
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (action.append) {
    fs.appendFileSync(action.filePath, String(action.content ?? ''), 'utf-8');
  } else {
    fs.writeFileSync(action.filePath, String(action.content ?? ''), 'utf-8');
  }
}