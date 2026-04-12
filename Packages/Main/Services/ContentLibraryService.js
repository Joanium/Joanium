import fs from 'fs';
import path from 'path';
import Paths from '../Core/Paths.js';
import {
  directoryExists,
  ensureDir,
  loadText,
  persistText,
  scanFilesRecursive,
} from '../Core/FileSystem.js';
import { loadJson, parseFrontmatter, persistJson } from './FileService.js';
export const OFFICIAL_PUBLISHER = 'Joanium';
const MARKDOWN_FILE_REGEX = /\.md$/i,
  INVALID_PATH_SEGMENT_REGEX = /[<>:"/\\|?*\u0000-\u001f]+/g;
function sanitizeLibrarySegment(value, fallback) {
  return (
    String(value ?? '')
      .replace(INVALID_PATH_SEGMENT_REGEX, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[. ]+$/g, '') || fallback
  );
}
export function sanitizePublisherName(value) {
  return sanitizeLibrarySegment(value, 'Joanium');
}
function normalizePublisherName(value) {
  return sanitizePublisherName(value);
}
export function isVerifiedPublisher(value) {
  return normalizePublisherName(value).toLowerCase() === 'Joanium'.toLowerCase();
}
export function buildContentId(kind, publisher, filename) {
  const normalizedKind = 'personas' === kind ? 'personas' : 'skills',
    normalizedFilename = sanitizeMarkdownFileName(
      filename,
      'personas' === normalizedKind ? 'Persona' : 'Skill',
    );
  return `${normalizedKind}:${normalizePublisherName(publisher)}/${normalizedFilename}`;
}
export function parseContentId(value) {
  const match = String(value ?? '')
    .trim()
    .match(/^(skills|personas):([^/]+)\/(.+\.md)$/i);
  return match
    ? {
        kind: match[1].toLowerCase(),
        publisher: normalizePublisherName(match[2]),
        filename: match[3],
      }
    : null;
}
export function sanitizeMarkdownFileName(value, fallback = 'Item') {
  return `${sanitizeLibrarySegment(
    String(value ?? '')
      .trim()
      .replace(/\.md$/i, ''),
    fallback,
  )}.md`;
}
function scanMarkdownFiles(rootDir) {
  return scanFilesRecursive(rootDir, (entry) => MARKDOWN_FILE_REGEX.test(entry.name));
}
function hasMarkdownFiles(rootDir) {
  return scanMarkdownFiles(rootDir).length > 0;
}
function deriveEntryLocation(rootDir, fullPath) {
  const segments = path.relative(rootDir, fullPath).split(path.sep).filter(Boolean);
  return {
    filename: segments[segments.length - 1] ?? path.basename(fullPath),
    publisher: segments.length > 1 ? normalizePublisherName(segments[0]) : 'Joanium',
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
  return 'personas' === kind
    ? { userRoot: Paths.USER_PERSONAS_DIR, seedRoot: Paths.PERSONAS_SEED_DIR }
    : { userRoot: Paths.USER_SKILLS_DIR, seedRoot: Paths.SKILLS_SEED_DIR };
}
function copyMarkdownTree(sourceRoot, targetRoot) {
  for (const fullPath of scanMarkdownFiles(sourceRoot)) {
    const relativePath = path.relative(sourceRoot, fullPath),
      nextPath = path.join(targetRoot, relativePath);
    (ensureDir(path.dirname(nextPath)), fs.copyFileSync(fullPath, nextPath));
  }
}
export function initializeContentLibraries() {
  for (const kind of ['skills', 'personas']) {
    const { userRoot: userRoot, seedRoot: seedRoot } = getLibraryRoots(kind);
    (ensureDir(userRoot),
      path.resolve(userRoot) !== path.resolve(seedRoot) &&
        directoryExists(seedRoot) &&
        (hasMarkdownFiles(userRoot) || copyMarkdownTree(seedRoot, userRoot)));
  }
}
function readMarkdownEntries(kind) {
  const { userRoot: userRoot } = getLibraryRoots(kind),
    entries = new Map();
  for (const fullPath of scanMarkdownFiles(userRoot))
    try {
      const raw = loadText(fullPath, ''),
        { meta: meta, body: body } = parseFrontmatter(raw),
        {
          filename: filename,
          publisher: publisher,
          relativePath: relativePath,
        } = deriveEntryLocation(userRoot, fullPath);
      if ('readme.md' === filename.toLowerCase() && !relativePath.includes('/')) continue;
      if (!meta.name && !body.trim()) continue;
      const isVerified = isVerifiedPublisher(publisher),
        id = buildContentId(kind, publisher, filename),
        baseEntry = {
          id: id,
          type: 'personas' === kind ? 'persona' : 'skill',
          filename: filename,
          publisher: publisher,
          isVerified: isVerified,
          source: 'library',
          sourcePath: fullPath,
          relativePath: relativePath,
          raw: raw,
        },
        entry =
          'personas' === kind
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
                body: body,
              };
      entries.set(id, entry);
    } catch {}
  return [...entries.values()].sort(compareLibraryEntries);
}
function persistEnabledMap(map) {
  persistJson(Paths.SKILLS_FILE, { skills: map });
}
function choosePreferredMatch(matches) {
  return matches.length ? (matches.find((entry) => entry.isVerified) ?? matches[0]) : null;
}
function normalizeEnabledMap(rawMap, skills) {
  const nextMap = {},
    skillIds = new Map(skills.map((skill) => [skill.id, skill])),
    byFilename = new Map();
  for (const skill of skills) {
    const key = skill.filename.toLowerCase(),
      matches = byFilename.get(key) ?? [];
    (matches.push(skill), byFilename.set(key, matches));
  }
  for (const [key, enabled] of Object.entries(rawMap ?? {})) {
    if (skillIds.has(key)) {
      nextMap[key] = Boolean(enabled);
      continue;
    }
    const parsed = parseContentId(key);
    if (parsed) {
      const nextId = buildContentId(parsed.kind, parsed.publisher, parsed.filename);
      skillIds.has(nextId) && (nextMap[nextId] = Boolean(enabled));
      continue;
    }
    const preferredMatch = choosePreferredMatch(byFilename.get(String(key).toLowerCase()) ?? []);
    preferredMatch && (nextMap[preferredMatch.id] = Boolean(enabled));
  }
  return {
    map: nextMap,
    changed:
      JSON.stringify(
        Object.fromEntries(
          Object.entries(rawMap ?? {}).sort(([left], [right]) => left.localeCompare(right)),
        ),
      ) !==
      JSON.stringify(
        Object.fromEntries(
          Object.entries(nextMap).sort(([left], [right]) => left.localeCompare(right)),
        ),
      ),
  };
}
function serializePersonaSelection(persona) {
  return persona
    ? {
        id: persona.id,
        filename: persona.filename,
        publisher: persona.publisher,
        name: persona.name,
        personality: persona.personality || '',
        description: persona.description || '',
        instructions: persona.instructions || '',
        isVerified: Boolean(persona.isVerified),
      }
    : null;
}
function resolvePersonaSelection(candidate, personas) {
  if (!candidate || 'object' != typeof candidate) return null;
  const directId = String(candidate.id ?? '').trim();
  if (directId) {
    const match = personas.find((persona) => persona.id === directId);
    if (match) return match;
  }
  const publisher = normalizePublisherName(candidate.publisher),
    filename = String(candidate.filename ?? '').trim();
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
  const normalizedKind = 'personas' === kind ? 'personas' : 'skills',
    safePublisher = normalizePublisherName(publisher),
    safeFilename = sanitizeMarkdownFileName(
      filename,
      'personas' === normalizedKind ? 'Persona' : 'Skill',
    ),
    rootDir = 'personas' === normalizedKind ? Paths.USER_PERSONAS_DIR : Paths.USER_SKILLS_DIR;
  return {
    rootDir: rootDir,
    publisher: safePublisher,
    filename: safeFilename,
    filePath: path.join(rootDir, safePublisher, safeFilename),
  };
}
export function writeUserContent(kind, { publisher: publisher, filename: filename }, markdown) {
  const target = getUserContentTarget(kind, publisher, filename);
  return (
    persistText(target.filePath, String(markdown ?? '').trimEnd(), {
      normalizeLineEndings: !0,
      finalNewline: !0,
    }),
    target
  );
}
export function readSkills() {
  const skills = readMarkdownEntries('skills'),
    rawMap = loadJson(Paths.SKILLS_FILE, { skills: {} }).skills ?? {},
    { map: map, changed: changed } = normalizeEnabledMap(rawMap, skills);
  return (
    changed && persistEnabledMap(map),
    skills.map((skill) => ({ ...skill, enabled: !0 === map[skill.id] }))
  );
}
export function setSkillEnabled(idOrFilename, enabled) {
  const skills = readSkills(),
    skill = (function (idOrFilename, skills) {
      if (!idOrFilename) return null;
      const directId = String(idOrFilename).trim(),
        byId = skills.find((skill) => skill.id === directId);
      if (byId) return byId;
      const parsed = parseContentId(directId);
      return parsed
        ? (skills.find(
            (skill) =>
              skill.publisher.toLowerCase() === parsed.publisher.toLowerCase() &&
              skill.filename.toLowerCase() === parsed.filename.toLowerCase(),
          ) ?? null)
        : choosePreferredMatch(
            skills.filter((skill) => skill.filename.toLowerCase() === directId.toLowerCase()),
          );
    })(idOrFilename, skills);
  if (!skill) throw new Error('Skill not found.');
  const rawMap = loadJson(Paths.SKILLS_FILE, { skills: {} }).skills ?? {},
    { map: map } = normalizeEnabledMap(rawMap, skills);
  return ((map[skill.id] = Boolean(enabled)), persistEnabledMap(map), skill.id);
}
export function setAllSkillsEnabled(enabled) {
  const skills = readSkills();
  return (
    persistEnabledMap(Object.fromEntries(skills.map((skill) => [skill.id, Boolean(enabled)]))),
    skills.length
  );
}
export function readPersonas() {
  return readMarkdownEntries('personas');
}
export function getDefaultPersona(personas = readPersonas()) {
  return personas.length
    ? (personas.find(
        (persona) => persona.isVerified && 'Joana.md' === persona.filename.trim().toLowerCase(),
      ) ??
        personas.find(
          (persona) => persona.isVerified && 'joana' === persona.name.trim().toLowerCase(),
        ) ??
        personas.find((persona) => persona.isVerified) ??
        personas[0])
    : null;
}
export function readActivePersona() {
  const personas = readPersonas(),
    defaultPersona = getDefaultPersona(personas),
    stored = loadJson(Paths.ACTIVE_PERSONA_FILE, null),
    resolved = resolvePersonaSelection(stored, personas) ?? defaultPersona;
  if (stored && resolved) {
    const serialized = serializePersonaSelection(resolved);
    JSON.stringify(stored) !== JSON.stringify(serialized) &&
      persistJson(Paths.ACTIVE_PERSONA_FILE, serialized);
  }
  return resolved;
}
export function setActivePersona(candidate) {
  const resolved = resolvePersonaSelection(candidate, readPersonas());
  if (!resolved) throw new Error('Persona not found.');
  return (persistJson(Paths.ACTIVE_PERSONA_FILE, serializePersonaSelection(resolved)), resolved);
}
export function resetActivePersona() {
  fs.existsSync(Paths.ACTIVE_PERSONA_FILE) && fs.unlinkSync(Paths.ACTIVE_PERSONA_FILE);
}
