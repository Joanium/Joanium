import fs from 'fs';
import path from 'path';

export function writeFile(filePath, content = '') {
    if (!filePath) throw new Error('writeFile: no file path provided');
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, String(content), 'utf-8');
}