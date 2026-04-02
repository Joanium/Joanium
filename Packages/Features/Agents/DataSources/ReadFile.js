import fs from 'fs';

export const type = 'read_file';
export const meta = { label: 'File', group: 'File System' };
export async function collect(ds) {
  if (!ds.filePath) return 'No file path specified.';
  if (!fs.existsSync(ds.filePath)) return `File not found: ${ds.filePath}`;
  const stat = fs.statSync(ds.filePath);
  if (stat.size > 500_000) return 'File too large (>500 KB).';
  const content = fs.readFileSync(ds.filePath, 'utf-8').trim();
  if (!content) return `EMPTY: File ${ds.filePath} is empty.`;
  return `File: ${ds.filePath}\n\n${content.slice(0, 6000)}`;
}
