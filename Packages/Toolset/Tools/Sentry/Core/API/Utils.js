import { tryParseJson } from '../../../../../Shared/Utils/AsyncUtils.js';

async function sRequest(BASE, path, creds, headers, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(creds),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!res.ok) {
    const data = await tryParseJson(res);
    throw new Error(data.detail ?? `Sentry API error: ${res.status}`);
  }
  return res.json();
}

export function createSentryRequestHelpers(BASE, headers) {
  return {
    fetch: (path, creds) => sRequest(BASE, path, creds, headers),
    mutate: (path, creds, method = 'PUT', body = {}) =>
      sRequest(BASE, path, creds, headers, { method, body }),
  };
}

export async function sDelete(BASE, path, creds, headers) {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE', headers: headers(creds) });
  if (!res.ok) {
    const data = await tryParseJson(res);
    throw new Error(data.detail ?? `Sentry API error: ${res.status}`);
  }
  return { deleted: true };
}

/**
 * Maps a raw Sentry project to a compact shape shared by listProjects and listTeamProjects.
 * @param {object} p - Raw project from the Sentry API.
 */
export function mapProject(p) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    platform: p.platform ?? 'unknown',
    dateCreated: p.dateCreated,
  };
}

/**
 * Maps a raw Sentry issue to the compact shape used by list/search endpoints.
 * @param {object} i - Raw issue.
 * @param {boolean} includeProject - Whether to include the `project` slug field.
 */
export function mapIssue(i, includeProject = false) {
  return {
    id: i.id,
    title: i.title,
    level: i.level,
    count: i.count,
    userCount: i.userCount,
    ...(includeProject ? { project: i.project?.slug ?? 'unknown' } : {}),
    firstSeen: i.firstSeen,
    lastSeen: i.lastSeen,
    permalink: i.permalink,
  };
}

/**
 * Maps a raw Sentry event to the compact shape shared by list event endpoints.
 * @param {object} e - Raw event.
 */
export function mapEvent(e) {
  return {
    id: e.id,
    eventID: e.eventID,
    title: e.title,
    platform: e.platform,
    dateCreated: e.dateCreated,
    groupID: e.groupID ?? undefined,
  };
}
