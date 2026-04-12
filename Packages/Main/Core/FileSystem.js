import fs from 'fs';
import path from 'path';
import { cloneValue } from '../../System/Utils/CloneValue.js';
export function resolveFallback(fallback) {
  return 'function' == typeof fallback ? fallback() : cloneValue(fallback);
}
export function pathExists(targetPath) {
  return Boolean(targetPath) && fs.existsSync(targetPath);
}
export function directoryExists(dirPath) {
  if (!pathExists(dirPath)) return !1;
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return !1;
  }
}
export function fileExists(filePath) {
  if (!pathExists(filePath)) return !1;
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return !1;
  }
}
export function ensureDir(dirPath) {
  return dirPath
    ? (directoryExists(dirPath) || fs.mkdirSync(dirPath, { recursive: !0 }), dirPath)
    : dirPath;
}
export function ensureParentDir(filePath) {
  return filePath ? ensureDir(path.dirname(filePath)) : '';
}
export function loadText(filePath, fallback = '', options = {}) {
  const { stripBom: stripBom = !0 } = options;
  try {
    if (!fileExists(filePath)) return resolveFallback(fallback);
    const raw = fs.readFileSync(filePath, 'utf-8');
    return stripBom ? raw.replace(/^\uFEFF/, '') : raw;
  } catch {
    return resolveFallback(fallback);
  }
}
export function loadJson(filePath, fallback = null) {
  try {
    return fileExists(filePath)
      ? JSON.parse(loadText(filePath, '', { stripBom: !0 }))
      : resolveFallback(fallback);
  } catch {
    return resolveFallback(fallback);
  }
}
export function persistText(filePath, content, options = {}) {
  const { normalizeLineEndings: normalizeLineEndings = !1, finalNewline: finalNewline = !1 } =
    options;
  ensureParentDir(filePath);
  let next = String(content ?? '');
  return (
    normalizeLineEndings && (next = next.replace(/\r\n/g, '\n')),
    finalNewline && !next.endsWith('\n') && (next += '\n'),
    fs.writeFileSync(filePath, next, 'utf-8'),
    next
  );
}
export function persistJson(filePath, data, options = {}) {
  const { space: space = 2 } = options;
  return (
    ensureParentDir(filePath),
    fs.writeFileSync(filePath, JSON.stringify(data, null, space), 'utf-8'),
    data
  );
}
function readSortedEntries(dirPath) {
  return (function (entries = []) {
    return [...entries].sort((left, right) => left.name.localeCompare(right.name));
  })(fs.readdirSync(dirPath, { withFileTypes: !0 }));
}
export function scanFiles(dirPath, predicate = () => !0) {
  return directoryExists(dirPath)
    ? readSortedEntries(dirPath).flatMap((entry) => {
        if (!entry.isFile()) return [];
        const fullPath = path.join(dirPath, entry.name);
        return predicate(entry, fullPath) ? [fullPath] : [];
      })
    : [];
}
export function scanFilesRecursive(rootDir, predicate = () => !0) {
  const results = [];
  return directoryExists(rootDir)
    ? ((function visit(currentDir) {
        for (const entry of readSortedEntries(currentDir)) {
          const fullPath = path.join(currentDir, entry.name);
          entry.isDirectory()
            ? visit(fullPath)
            : entry.isFile() && predicate(entry, fullPath) && results.push(fullPath);
        }
      })(rootDir),
      results)
    : results;
}
