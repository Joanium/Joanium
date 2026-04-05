import * as GitlabAPI from '../API/GitlabAPI.js';

export function getGitlabCredentials(ctx) {
  const credentials = ctx.connectorEngine?.getCredentials('gitlab');
  if (!credentials?.token) return null;
  return credentials;
}

export function requireGitlabCredentials(ctx) {
  const credentials = getGitlabCredentials(ctx);
  if (!credentials) {
    throw new Error('GitLab not connected');
  }
  return credentials;
}

export function notConnected() {
  return { ok: false, error: 'GitLab not connected' };
}

export function parseCommaList(value = '') {
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function safeDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

export { GitlabAPI };
