import * as GithubAPI from '../API/GithubAPI.js';

export function getGithubCredentials(ctx) {
  const credentials = ctx.connectorEngine?.getCredentials('github');
  if (!credentials?.token) return null;
  return credentials;
}

export function requireGithubCredentials(ctx) {
  const credentials = getGithubCredentials(ctx);
  if (!credentials) {
    throw new Error('GitHub not connected');
  }
  return credentials;
}

export function notConnected() {
  return { ok: false, error: 'GitHub not connected' };
}

export function parseCommaList(value = '') {
  return String(value)
    .split(',')
    .map(item => item.trim())
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

export { GithubAPI };
