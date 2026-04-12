import fs from 'fs';
import path from 'path';
import { directoryExists, ensureDir, loadJson, persistJson } from '../Core/FileSystem.js';
import Paths from '../Core/Paths.js';
const PROJECT_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
function ensureProjectsDir() {
  ensureDir(Paths.PROJECTS_DIR);
}
function projectDir(projectId) {
  return path.join(
    Paths.PROJECTS_DIR,
    (function (projectId) {
      const id = String(projectId ?? '').trim();
      if (!PROJECT_ID_RE.test(id) || id.includes('..')) throw new Error('Invalid project id.');
      return id;
    })(projectId),
  );
}
function metaPath(projectId) {
  return path.join(projectDir(projectId), 'Project.json');
}
export function getProjectChatsDir(projectId) {
  return path.join(projectDir(projectId), 'Chats');
}
function uniqueProjectId(name) {
  ensureProjectsDir();
  const base = (function (name) {
    return (
      String(name ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'project'
    );
  })(name);
  let candidate = base,
    suffix = 2;
  for (; fs.existsSync(projectDir(candidate)); ) ((candidate = `${base}-${suffix}`), (suffix += 1));
  return candidate;
}
function normalizeProject(project, projectId = project?.id) {
  const id = String(projectId ?? '').trim(),
    createdAt = String(project?.createdAt ?? new Date().toISOString());
  return {
    id: id,
    name: String(project?.name ?? '').trim() || id,
    rootPath: project?.rootPath ? path.resolve(String(project.rootPath)) : '',
    context: String(project?.context ?? '').trim(),
    createdAt: createdAt,
    updatedAt: String(project?.updatedAt ?? createdAt),
    lastOpenedAt: project?.lastOpenedAt ? String(project.lastOpenedAt) : null,
  };
}
function withStatus(project) {
  return { ...project, folderExists: ((rootPath = project.rootPath), directoryExists(rootPath)) };
  var rootPath;
}
function writeProject(project) {
  (!(function (projectId) {
    const dir = projectDir(projectId),
      chatsDir = getProjectChatsDir(projectId);
    (ensureDir(dir), ensureDir(chatsDir));
  })(project.id),
    persistJson(metaPath(project.id), project));
}
function readProject(projectId) {
  const filePath = metaPath(projectId),
    project = loadJson(filePath, null);
  if (!project) throw new Error(`Project "${projectId}" does not exist.`);
  return normalizeProject(project, projectId);
}
function assertValidProjectInput({ name: name, rootPath: rootPath }) {
  if (!String(name ?? '').trim()) throw new Error('Project name is required.');
  if (!String(rootPath ?? '').trim()) throw new Error('Project folder is required.');
}
export function list() {
  return (
    ensureProjectsDir(),
    fs
      .readdirSync(Paths.PROJECTS_DIR, { withFileTypes: !0 })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        try {
          return withStatus(readProject(entry.name));
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => {
        const left = new Date(a.lastOpenedAt ?? a.updatedAt).getTime();
        return new Date(b.lastOpenedAt ?? b.updatedAt).getTime() - left;
      })
  );
}
export function get(projectId) {
  return withStatus(readProject(projectId));
}
export function create({ name: name, rootPath: rootPath, context: context = '' } = {}) {
  assertValidProjectInput({ name: name, rootPath: rootPath });
  const now = new Date().toISOString(),
    project = normalizeProject({
      id: uniqueProjectId(name),
      name: name,
      rootPath: rootPath,
      context: context,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
    });
  return (writeProject(project), withStatus(project));
}
export function update(projectId, patch = {}) {
  const current = readProject(projectId),
    next = normalizeProject(
      { ...current, ...patch, id: current.id, updatedAt: new Date().toISOString() },
      current.id,
    );
  return (assertValidProjectInput(next), writeProject(next), withStatus(next));
}
export function remove(projectId) {
  ensureProjectsDir();
  const target = path.resolve(projectDir(projectId)),
    root = path.resolve(Paths.PROJECTS_DIR);
  if (!target.startsWith(`${root}${path.sep}`))
    throw new Error('Refusing to delete a path outside the projects directory.');
  fs.existsSync(target) && fs.rmSync(target, { recursive: !0, force: !0 });
}
