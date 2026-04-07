import fs from 'fs';
import path from 'path';

import Paths from '../Core/Paths.js';
import { loadJson, parseFrontmatter, persistJson } from './FileService.js';

export const OFFICIAL_PUBLISHER = 'Joanium';

const MARKDOWN_FILE_REGEX = /\.md$/i;
const DEFAULT_PERSONA_FILENAME = 'Joana.md';
const INVALID_PATH_SEGMENT_REGEX = /[<>:"/\\|?*\u0000-\u001f]+/g;

function sanitizeLibrarySegment(value, fallback) {
  const sanitized = String(value ?? '')
    .replace(INVALID_PATH_SEGMENT_REGEX, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');

  return sanitized || fallback;
}

export function sanitizePublisherName(value) {
  return sanitizeLibrarySegment(value, OFFICIAL_PUBLISHER);
}

function normalizePublisherName(value) {
  return sanitizePublisherName(value);
}

export function isVerifiedPublisher(value) {
  return normalizePublisherName(value).toLowerCase() === OFFICIAL_PUBLISHER.toLowerCase();
}

export function buildContentId(kind, publisher, filename) {
  const normalizedKind = kind === 'personas' ? 'personas' : 'skills';
  const normalizedFilename = sanitizeMarkdownFileName(
    filename,
    normalizedKind === 'personas' ? 'Persona' : 'Skill',
  );
  return `${normalizedKind}:${normalizePublisherName(publisher)}/${normalizedFilename}`;
}

export function parseContentId(value) {
  const match = String(value ?? '')
    .trim()
    .match(/^(skills|personas):([^/]+)\/(.+\.md)$/i);

  if (!match) return null;

  return {
    kind: match[1].toLowerCase(),
    publisher: normalizePublisherName(match[2]),
    filename: match[3],
  };
}

export function sanitizeMarkdownFileName(value, fallback = 'Item') {
  const raw = String(value ?? '').trim();
  const withNoExtension = raw.replace(/\.md$/i, '');
  const baseName = sanitizeLibrarySegment(withNoExtension, fallback);
  return `${baseName}.md`;
}

function ensureDir(targetDir) {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
}

function scanMarkdownFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];

  const stack = [rootDir];
  const files = [];

  while (stack.length) {
    const currentDir = stack.pop();
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (entry.isFile() && MARKDOWN_FILE_REGEX.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function hasMarkdownFiles(rootDir) {
  return scanMarkdownFiles(rootDir).length > 0;
}

function deriveEntryLocation(rootDir, fullPath) {
  const segments = path.relative(rootDir, fullPath).split(path.sep).filter(Boolean);
  const filename = segments[segments.length - 1] ?? path.basename(fullPath);
  const publisher = segments.length > 1 ? normalizePublisherName(segments[0]) : OFFICIAL_PUBLISHER;

  return {
    filename,
    publisher,
    relativePath: segments.join('/'),
  };
}

function compareLibraryEntries(left, right) {
  return (
    Number(right.isVerified) - Number(left.isVerified) ||
    left.publisher.localeCompare(right.publisher) ||
    left.name.localeCompare(right.name) ||
    left.filename.localeCompare(right.filename)
  );
}

function getLibraryRoots(kind) {
  if (kind === 'personas') {
    return {
      userRoot: Paths.USER_PERSONAS_DIR,
      seedRoot: Paths.PERSONAS_SEED_DIR,
    };
  }

  return {
    userRoot: Paths.USER_SKILLS_DIR,
    seedRoot: Paths.SKILLS_SEED_DIR,
  };
}

function copyMarkdownTree(sourceRoot, targetRoot) {
  for (const fullPath of scanMarkdownFiles(sourceRoot)) {
    const relativePath = path.relative(sourceRoot, fullPath);
    const nextPath = path.join(targetRoot, relativePath);
    ensureDir(path.dirname(nextPath));
    fs.copyFileSync(fullPath, nextPath);
  }
}

export function initializeContentLibraries() {
  for (const kind of ['skills', 'personas']) {
    const { userRoot, seedRoot } = getLibraryRoots(kind);
    ensureDir(userRoot);

    if (path.resolve(userRoot) === path.resolve(seedRoot)) continue;
    if (!fs.existsSync(seedRoot)) continue;
    if (hasMarkdownFiles(userRoot)) continue;

    copyMarkdownTree(seedRoot, userRoot);
  }
}

function readMarkdownEntries(kind) {
  const { userRoot } = getLibraryRoots(kind);
  const entries = new Map();

  for (const fullPath of scanMarkdownFiles(userRoot)) {
    try {
      const raw = fs.readFileSync(fullPath, 'utf-8').replace(/^\uFEFF/, '');
      const { meta, body } = parseFrontmatter(raw);
      const { filename, publisher, relativePath } = deriveEntryLocation(userRoot, fullPath);

      if (filename.toLowerCase() === 'readme.md' && !relativePath.includes('/')) continue;
      if (!meta.name && !body.trim()) continue;

      const isVerified = isVerifiedPublisher(publisher);
      const id = buildContentId(kind, publisher, filename);
      const baseEntry = {
        id,
        type: kind === 'personas' ? 'persona' : 'skill',
        filename,
        publisher,
        isVerified,
        source: 'library',
        sourcePath: fullPath,
        relativePath,
        raw,
      };

      const entry =
        kind === 'personas'
          ? {
              ...baseEntry,
              name: meta.name || filename.replace(MARKDOWN_FILE_REGEX, ''),
              personality: meta.personality || '',
              description: meta.description || '',
              instructions: body,
            }
          : {
              ...baseEntry,
              name: meta.name || filename.replace(MARKDOWN_FILE_REGEX, ''),
              trigger: meta.trigger || '',
              description: meta.description || '',
              body,
            };

      entries.set(id, entry);
    } catch {
      // Ignore malformed markdown files so the library keeps rendering.
    }
  }

  return [...entries.values()].sort(compareLibraryEntries);
}

function persistEnabledMap(map) {
  persistJson(Paths.SKILLS_FILE, { skills: map });
}

function choosePreferredMatch(matches) {
  if (!matches.length) return null;
  return matches.find((entry) => entry.isVerified) ?? matches[0];
}

function normalizeEnabledMap(rawMap, skills) {
  const nextMap = {};
  const skillIds = new Map(skills.map((skill) => [skill.id, skill]));
  const byFilename = new Map();

  for (const skill of skills) {
    const key = skill.filename.toLowerCase();
    const matches = byFilename.get(key) ?? [];
    matches.push(skill);
    byFilename.set(key, matches);
  }

  for (const [key, enabled] of Object.entries(rawMap ?? {})) {
    if (skillIds.has(key)) {
      nextMap[key] = Boolean(enabled);
      continue;
    }

    const parsed = parseContentId(key);
    if (parsed) {
      const nextId = buildContentId(parsed.kind, parsed.publisher, parsed.filename);
      if (skillIds.has(nextId)) {
        nextMap[nextId] = Boolean(enabled);
      }
      continue;
    }

    const preferredMatch = choosePreferredMatch(byFilename.get(String(key).toLowerCase()) ?? []);
    if (preferredMatch) {
      nextMap[preferredMatch.id] = Boolean(enabled);
    }
  }

  const changed =
    JSON.stringify(
      Object.fromEntries(
        Object.entries(rawMap ?? {}).sort(([left], [right]) => left.localeCompare(right)),
      ),
    ) !==
    JSON.stringify(
      Object.fromEntries(
        Object.entries(nextMap).sort(([left], [right]) => left.localeCompare(right)),
      ),
    );

  return { map: nextMap, changed };
}

function resolveSkillSelection(idOrFilename, skills) {
  if (!idOrFilename) return null;

  const directId = String(idOrFilename).trim();
  const byId = skills.find((skill) => skill.id === directId);
  if (byId) return byId;

  const parsed = parseContentId(directId);
  if (parsed) {
    return (
      skills.find(
        (skill) =>
          skill.publisher.toLowerCase() === parsed.publisher.toLowerCase() &&
          skill.filename.toLowerCase() === parsed.filename.toLowerCase(),
      ) ?? null
    );
  }

  return choosePreferredMatch(
    skills.filter((skill) => skill.filename.toLowerCase() === directId.toLowerCase()),
  );
}

function serializePersonaSelection(persona) {
  if (!persona) return null;

  return {
    id: persona.id,
    filename: persona.filename,
    publisher: persona.publisher,
    name: persona.name,
    personality: persona.personality || '',
    description: persona.description || '',
    instructions: persona.instructions || '',
    isVerified: Boolean(persona.isVerified),
  };
}

function resolvePersonaSelection(candidate, personas) {
  if (!candidate || typeof candidate !== 'object') return null;

  const directId = String(candidate.id ?? '').trim();
  if (directId) {
    const match = personas.find((persona) => persona.id === directId);
    if (match) return match;
  }

  const publisher = normalizePublisherName(candidate.publisher);
  const filename = String(candidate.filename ?? '').trim();
  if (filename) {
    const exactMatch = personas.find(
      (persona) =>
        persona.publisher.toLowerCase() === publisher.toLowerCase() &&
        persona.filename.toLowerCase() === filename.toLowerCase(),
    );
    if (exactMatch) return exactMatch;

    const filenameMatch = choosePreferredMatch(
      personas.filter((persona) => persona.filename.toLowerCase() === filename.toLowerCase()),
    );
    if (filenameMatch) return filenameMatch;
  }

  const name = String(candidate.name ?? '').trim();
  if (name) {
    const nameMatch = choosePreferredMatch(
      personas.filter((persona) => persona.name.toLowerCase() === name.toLowerCase()),
    );
    if (nameMatch) return nameMatch;
  }

  return null;
}

export function getUserContentTarget(kind, publisher, filename) {
  const normalizedKind = kind === 'personas' ? 'personas' : 'skills';
  const safePublisher = normalizePublisherName(publisher);
  const safeFilename = sanitizeMarkdownFileName(
    filename,
    normalizedKind === 'personas' ? 'Persona' : 'Skill',
  );
  const rootDir = normalizedKind === 'personas' ? Paths.USER_PERSONAS_DIR : Paths.USER_SKILLS_DIR;

  return {
    rootDir,
    publisher: safePublisher,
    filename: safeFilename,
    filePath: path.join(rootDir, safePublisher, safeFilename),
  };
}

export function writeUserContent(kind, { publisher, filename }, markdown) {
  const target = getUserContentTarget(kind, publisher, filename);
  ensureDir(path.dirname(target.filePath));
  fs.writeFileSync(
    target.filePath,
    String(markdown ?? '')
      .replace(/\r\n/g, '\n')
      .trimEnd() + '\n',
    'utf-8',
  );
  return target;
}

export function readSkills() {
  const skills = readMarkdownEntries('skills');
  const rawMap = loadJson(Paths.SKILLS_FILE, { skills: {} }).skills ?? {};
  const { map, changed } = normalizeEnabledMap(rawMap, skills);

  if (changed) {
    persistEnabledMap(map);
  }

  return skills.map((skill) => ({
    ...skill,
    enabled: map[skill.id] === true,
  }));
}

export function setSkillEnabled(idOrFilename, enabled) {
  const skills = readSkills();
  const skill = resolveSkillSelection(idOrFilename, skills);
  if (!skill) {
    throw new Error('Skill not found.');
  }

  const rawMap = loadJson(Paths.SKILLS_FILE, { skills: {} }).skills ?? {};
  const { map } = normalizeEnabledMap(rawMap, skills);
  map[skill.id] = Boolean(enabled);
  persistEnabledMap(map);

  return skill.id;
}

export function setAllSkillsEnabled(enabled) {
  const skills = readSkills();
  const map = Object.fromEntries(skills.map((skill) => [skill.id, Boolean(enabled)]));
  persistEnabledMap(map);
  return skills.length;
}

export function readPersonas() {
  return readMarkdownEntries('personas');
}

export function getDefaultPersona(personas = readPersonas()) {
  if (!personas.length) return null;

  return (
    personas.find(
      (persona) =>
        persona.isVerified && persona.filename.trim().toLowerCase() === DEFAULT_PERSONA_FILENAME,
    ) ??
    personas.find(
      (persona) => persona.isVerified && persona.name.trim().toLowerCase() === 'joana',
    ) ??
    personas.find((persona) => persona.isVerified) ??
    personas[0]
  );
}

export function readActivePersona() {
  const personas = readPersonas();
  const defaultPersona = getDefaultPersona(personas);
  const stored = loadJson(Paths.ACTIVE_PERSONA_FILE, null);
  const resolved = resolvePersonaSelection(stored, personas) ?? defaultPersona;

  if (stored && resolved) {
    const serialized = serializePersonaSelection(resolved);
    if (JSON.stringify(stored) !== JSON.stringify(serialized)) {
      persistJson(Paths.ACTIVE_PERSONA_FILE, serialized);
    }
  }

  return resolved;
}

export function setActivePersona(candidate) {
  const personas = readPersonas();
  const resolved = resolvePersonaSelection(candidate, personas);

  if (!resolved) {
    throw new Error('Persona not found.');
  }

  persistJson(Paths.ACTIVE_PERSONA_FILE, serializePersonaSelection(resolved));
  return resolved;
}

export function resetActivePersona() {
  if (fs.existsSync(Paths.ACTIVE_PERSONA_FILE)) {
    fs.unlinkSync(Paths.ACTIVE_PERSONA_FILE);
  }
}
