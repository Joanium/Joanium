import path from 'path';
import Paths from '../Core/Paths.js';
import { ensureDir, fileExists, loadText, persistText, scanFiles } from '../Core/FileSystem.js';
const MARKDOWN_FILE_REGEX = /\.md$/i,
  HIDDEN_FILE_PREFIXES = ['Archive-', 'Legacy-', '_'],
  INVALID_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]+/g,
  DEFAULT_MEMORY_FILES = [
    {
      filename: 'Memory.md',
      title: 'Pinned Memory',
      description: 'Pinned notes.',
      content: '# Pinned Memory\n',
    },
    {
      filename: 'User.md',
      title: 'User Profile',
      description: 'Profile.',
      content: '# User Profile\n',
    },
    { filename: 'Likes.md', title: 'Likes', description: 'Likes.', content: '# Likes\n' },
    {
      filename: 'Dislikes.md',
      title: 'Dislikes',
      description: 'Dislikes.',
      content: '# Dislikes\n',
    },
    { filename: 'Family.md', title: 'Family', description: 'Family.', content: '# Family\n' },
    { filename: 'Friends.md', title: 'Friends', description: 'Friends.', content: '# Friends\n' },
    {
      filename: 'Relationships.md',
      title: 'Relationships',
      description: 'Relationships.',
      content: '# Relationships\n',
    },
    {
      filename: 'Education.md',
      title: 'Education',
      description: 'Education.',
      content: '# Education\n',
    },
    { filename: 'Career.md', title: 'Career', description: 'Career.', content: '# Career\n' },
    { filename: 'Goals.md', title: 'Goals', description: 'Goals.', content: '# Goals\n' },
    { filename: 'Health.md', title: 'Health', description: 'Health.', content: '# Health\n' },
    {
      filename: 'Wellbeing.md',
      title: 'Wellbeing',
      description: 'Wellbeing.',
      content: '# Wellbeing\n',
    },
    { filename: 'Support.md', title: 'Support', description: 'Support.', content: '# Support\n' },
    {
      filename: 'Communication.md',
      title: 'Communication',
      description: 'Style.',
      content: '# Communication\n',
    },
    { filename: 'Values.md', title: 'Values', description: 'Values.', content: '# Values\n' },
    { filename: 'Habits.md', title: 'Habits', description: 'Habits.', content: '# Habits\n' },
    {
      filename: 'ImportantDates.md',
      title: 'Important Dates',
      description: 'Dates.',
      content: '# Important Dates\n',
    },
    { filename: 'Finance.md', title: 'Finance', description: 'Finance.', content: '# Finance\n' },
    {
      filename: 'Astrology.md',
      title: 'Astrology',
      description: 'Astrology.',
      content: '# Astrology\n',
    },
  ],
  DEFAULT_FILE_ORDER = new Map(
    DEFAULT_MEMORY_FILES.map((entry, index) => [entry.filename.toLowerCase(), index]),
  ),
  DEFAULT_FILE_META = new Map(
    DEFAULT_MEMORY_FILES.map((entry) => [entry.filename.toLowerCase(), entry]),
  );
function normalizeFilename(value, fallback = '') {
  const cleaned = String(value ?? '')
    .trim()
    .replace(/\.md$/i, '')
    .replace(INVALID_FILENAME_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');
  if (!cleaned && !fallback) throw new Error('Memory filename is required.');
  const filename = `${cleaned || String(fallback).replace(/\.md$/i, '')}.md`;
  if (!MARKDOWN_FILE_REGEX.test(filename)) throw new Error('Memory filename must end with .md');
  if (HIDDEN_FILE_PREFIXES.some((prefix) => filename.startsWith(prefix)))
    throw new Error('Hidden memory filenames are reserved.');
  return filename;
}
function buildMemoryPath(filename) {
  return (
    initializePersonalMemoryLibrary(),
    path.join(Paths.MEMORIES_DIR, normalizeFilename(filename))
  );
}
function isVisibleMemoryFilename(filename) {
  return (
    MARKDOWN_FILE_REGEX.test(filename) &&
    !HIDDEN_FILE_PREFIXES.some((prefix) => filename.startsWith(prefix))
  );
}
function getTemplateMeta(filename) {
  const normalized = String(filename ?? '').toLowerCase();
  return DEFAULT_FILE_META.get(normalized) ?? null;
}
function countBulletLines(content = '') {
  return String(content)
    .split('\n')
    .filter((line) => /^\s*[-*]\s+/.test(line)).length;
}
function stripHeading(content = '') {
  const lines = String(content).replace(/\r\n/g, '\n').split('\n');
  return (lines[0]?.trim().startsWith('#') && lines.shift(), lines.join('\n').trim());
}
function hasMeaningfulMemoryContent(content = '') {
  return Boolean(stripHeading(content));
}
function buildTitleFromFilename(filename) {
  return String(filename ?? '')
    .replace(/\.md$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();
}
function normalizeForComparison(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function finalizeMemoryContent(content, filename) {
  const meta = getTemplateMeta(filename),
    fallbackHeading = `# ${meta?.title ?? buildTitleFromFilename(filename)}`,
    base =
      String(content ?? '')
        .replace(/\r\n/g, '\n')
        .trim() ||
      String(meta?.content ?? `${fallbackHeading}\n\n`)
        .replace(/\r\n/g, '\n')
        .trim();
  return `${(function (lines = []) {
    const next = [];
    let previousBlank = !1;
    for (const line of lines) {
      const isBlank = !line.trim();
      (isBlank && previousBlank) || (next.push(line), (previousBlank = isBlank));
    }
    return next;
  })(
    (function (lines = []) {
      const seen = new Set(),
        next = [];
      for (const line of lines) {
        const match = line.match(/^(\s*[-*]\s+)(.+)$/);
        if (!match) {
          next.push(line);
          continue;
        }
        const normalized = normalizeForComparison(match[2]);
        normalized &&
          !seen.has(normalized) &&
          (seen.add(normalized), next.push(`${match[1]}${match[2].trim()}`));
      }
      return next;
    })((base.startsWith('#') ? base : `${fallbackHeading}\n\n${base}`).split('\n')),
  )
    .join('\n')
    .trim()}\n`;
}
function getVisibleMemoryEntries() {
  const filenames = (initializePersonalMemoryLibrary(),
  scanFiles(Paths.MEMORIES_DIR, (entry) => MARKDOWN_FILE_REGEX.test(entry.name)).map((fullPath) =>
    path.basename(fullPath),
  )).filter(isVisibleMemoryFilename);
  return [...new Set(filenames)]
    .map((filename) => {
      const meta = getTemplateMeta(filename),
        content = loadText(path.join(Paths.MEMORIES_DIR, filename), ''),
        trimmed = content.trim();
      return {
        filename: filename,
        title: meta?.title ?? buildTitleFromFilename(filename),
        description: meta?.description ?? 'Custom personal memory file.',
        content: content,
        empty: !hasMeaningfulMemoryContent(trimmed),
        bulletCount: countBulletLines(trimmed),
        lineCount: hasMeaningfulMemoryContent(trimmed)
          ? stripHeading(trimmed).split(/\r?\n/).length
          : 0,
      };
    })
    .sort(
      (left, right) =>
        (DEFAULT_FILE_ORDER.get(left.filename.toLowerCase()) ?? Number.MAX_SAFE_INTEGER) -
          (DEFAULT_FILE_ORDER.get(right.filename.toLowerCase()) ?? Number.MAX_SAFE_INTEGER) ||
        left.filename.localeCompare(right.filename),
    );
}
export function initializePersonalMemoryLibrary() {
  ensureDir(Paths.MEMORIES_DIR);
  for (const entry of DEFAULT_MEMORY_FILES) {
    const filePath = path.join(Paths.MEMORIES_DIR, entry.filename);
    fileExists(filePath) ||
      persistText(filePath, entry.content, { normalizeLineEndings: !0, finalNewline: !0 });
  }
}
export function listPersonalMemoryFiles() {
  return getVisibleMemoryEntries().map(({ content: content, ...entry }) => entry);
}
export function searchPersonalMemory(query, limit = 5) {
  const terms = (function (query = '') {
    return normalizeForComparison(query)
      .split(' ')
      .map((term) => term.trim())
      .filter(Boolean);
  })(query);
  return terms.length
    ? getVisibleMemoryEntries()
        .map((entry) => {
          const haystacks = [
            normalizeForComparison(entry.filename),
            normalizeForComparison(stripHeading(entry.content)),
          ];
          let score = 0;
          for (const term of terms)
            (haystacks[0].includes(term) && (score += 6),
              haystacks[1].includes(term) && (score += 5));
          const matchingLines = (function (content = '', terms = []) {
            if (!terms.length) return [];
            const matches = [];
            for (const line of String(content).split(/\r?\n/)) {
              const normalized = normalizeForComparison(line);
              if (
                normalized &&
                (terms.some((term) => normalized.includes(term)) && matches.push(line.trim()),
                matches.length >= 3)
              )
                break;
            }
            return matches;
          })(entry.content, terms);
          return (
            (score += 3 * matchingLines.length),
            {
              filename: entry.filename,
              title: entry.title,
              description: entry.description,
              score: score,
              matches: matchingLines,
            }
          );
        })
        .filter((entry) => entry.score > 0)
        .sort(
          (left, right) => right.score - left.score || left.filename.localeCompare(right.filename),
        )
        .slice(0, Math.min(Math.max(Number(limit) || 5, 1), 12))
    : [];
}
export function readPersonalMemoryFiles(filenames = []) {
  const requested = Array.isArray(filenames) ? filenames : [filenames];
  return [...new Set(requested.map((filename) => normalizeFilename(filename)))].map((filename) => {
    const filePath = buildMemoryPath(filename),
      meta = getTemplateMeta(filename);
    return {
      filename: filename,
      title: meta?.title ?? buildTitleFromFilename(filename),
      description: meta?.description ?? 'Custom personal memory file.',
      content: loadText(filePath, ''),
    };
  });
}
export function readPersonalMemoryCatalog() {
  return getVisibleMemoryEntries();
}
export function applyPersonalMemoryUpdates(payload = {}) {
  const entries = [
      ...(Array.isArray(payload.updates) ? payload.updates : []),
      ...(Array.isArray(payload.newFiles) ? payload.newFiles : []),
    ],
    touched = [];
  for (const entry of entries) {
    const filename = normalizeFilename(entry?.filename),
      filePath = buildMemoryPath(filename),
      created = !fileExists(filePath),
      nextContent = finalizeMemoryContent(entry?.content, filename);
    persistText(filePath, nextContent, { normalizeLineEndings: !0, finalNewline: !0 });
    const meta = getTemplateMeta(filename);
    touched.push({
      filename: filename,
      title: meta?.title ?? buildTitleFromFilename(filename),
      created: created,
    });
  }
  return touched;
}
export function readPinnedMemory() {
  return (initializePersonalMemoryLibrary(), loadText(Paths.MEMORY_FILE, ''));
}
export function writePinnedMemory(content) {
  (initializePersonalMemoryLibrary(),
    persistText(Paths.MEMORY_FILE, finalizeMemoryContent(content, 'Memory.md'), {
      normalizeLineEndings: !0,
      finalNewline: !0,
    }));
}
