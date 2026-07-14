import { readUserState } from '../../Shared/UserData/UserData.js';
import { tryParseJson } from '../../Shared/Utils/AsyncUtils.js';
import { clampInteger, optionalText } from '../../Shared/Utils/ValueUtils.js';

export function requireText(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`Missing required parameter: ${label}.`);
  return text;
}

export { clampInteger, optionalText };

export function parseJsonObject(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    throw new Error('Expected a valid JSON object.');
  }
}

export function parseCommaList(value = '') {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(value);
  }
}

export function truncateText(value = '', limit = 4000) {
  const text = String(value ?? '');
  return text.length > limit ? `${text.slice(0, limit)}\n...(truncated)` : text;
}

export function formatList(title, rows, empty = 'No results found.') {
  return rows.length ? [title, '', ...rows].join('\n') : [title, '', empty].join('\n');
}

// Returns a fetch-compatible body option object.
// If body is undefined, returns {} (no body). Otherwise JSON-stringifies it.
export function bodyJson(body) {
  return body === undefined ? {} : { body: JSON.stringify(body) };
}

// Builds a URL from a base + path and appends only non-empty search params.
// Skips any entry whose value is undefined, null, or blank after trimming.
export function buildUrl(base, path, searchParams = {}) {
  const url = new URL(`${base}${path}`);
  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined && value !== null && String(value).trim() !== '')
      url.searchParams.set(key, String(value));
  }
  return url;
}

// Reads the response body as text and attempts a JSON parse.
// Returns { data, text } so callers can use each independently for
// custom error message extraction before throwing.
export async function parseResponseJson(response) {
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { data, text };
}

export async function readConnectorDetails(rootDirectory, connectorId) {
  const state = await readUserState(rootDirectory);
  return state.connectors?.details?.[connectorId] ?? {};
}

export async function requireConnectorCredentials(
  rootDirectory,
  connectorId,
  keys = ['token'],
  label = connectorId,
) {
  const details = await readConnectorDetails(rootDirectory, connectorId);
  const missing = keys.find((key) => !String(details[key] ?? '').trim());
  if (missing) throw new Error(`${label} is not configured in Settings > Connectors.`);
  return details;
}

// Extracts the most meaningful error message from a parsed API error body.
// Handles nested error objects (Vercel, Stripe), detail fields (Sentry),
// plain string errors, and falls back to the raw response text or status text.
function extractErrorMessage(data, text, statusText) {
  const err = data?.error;
  return (
    (err && typeof err === 'object' ? err.message : null) ||
    data?.detail ||
    data?.message ||
    (typeof err === 'string' ? err : null) ||
    data?.err ||
    data?.error_description ||
    data?.errors?.[0]?.message ||
    text ||
    statusText
  );
}

export async function readJsonResponse(response) {
  const { data, text } = await parseResponseJson(response);

  if (!response.ok) {
    const message = extractErrorMessage(data, text, response.statusText);
    throw new Error(`${response.status} ${response.statusText}: ${message}`);
  }

  return data;
}

export async function fetchJson(url, { headers = {}, ...options } = {}) {
  return readJsonResponse(
    await fetch(url, {
      ...options,
      headers: {
        accept: 'application/json',
        ...headers,
      },
    }),
  );
}

// ─── Low-level fetch helper for direct API client files ───────────────────────
//
// Used by API-layer modules (e.g. FigmaAPI, VercelAPI) that build their own
// credential-backed header objects and call the service directly.
// For connector tool files, prefer makeConnectorRequest instead.
//
// extractError(data, response) — optional; overrides default message extraction.
// DELETE responses that return 200 become { ok: true }.
// 204 responses become {}.
export async function apiFetch(url, headers, options = {}, extractError = null) {
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const data = await tryParseJson(res);
    const message = extractError
      ? extractError(data, res)
      : extractErrorMessage(data, '', res.statusText);
    throw new Error(message);
  }
  if (res.status === 204) return {};
  if (options.method === 'DELETE') return { ok: true };
  return res.json();
}

// ─── Connector request factory ────────────────────────────────────────────────
//
// Returns an async request(path, options?) function pre-configured for a
// specific connector. Credentials are fetched on every call so they stay fresh.
//
// Options:
//   connectorId   — key used in Settings > Connectors (e.g. 'vercel')
//   keys          — credential fields that must be present (default: ['token'])
//   label         — human-readable service name shown in errors (e.g. 'Vercel')
//   baseUrl       — static base URL (e.g. 'https://api.vercel.com')
//   getBaseUrl    — (credentials) => string — dynamic base URL; takes priority over baseUrl
//   getAuthHeaders — (credentials) => object — overrides default Bearer auth
//   extraHeaders  — additional static headers merged into every request (e.g. API version)
//
// The returned function signature:
//   request(path, { method?, body?, searchParams? }?)
export function makeConnectorRequest(
  rootDirectory,
  {
    connectorId,
    keys = ['token'],
    label,
    baseUrl,
    getBaseUrl = null,
    getAuthHeaders = null,
    extraHeaders = {},
  },
) {
  return async function request(path, { method = 'GET', body, searchParams = {} } = {}) {
    const credentials = await requireConnectorCredentials(rootDirectory, connectorId, keys, label);
    const resolvedBase = getBaseUrl ? getBaseUrl(credentials) : baseUrl;
    const authHeaders = getAuthHeaders
      ? getAuthHeaders(credentials)
      : { authorization: `Bearer ${credentials.token}` };
    return fetchJson(buildUrl(resolvedBase, path, searchParams), {
      method,
      headers: { 'content-type': 'application/json', ...authHeaders, ...extraHeaders },
      ...bodyJson(body),
    });
  };
}
