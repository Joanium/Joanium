export { parseCommaList } from '../../Core/ConnectorHttp.js';

function getErrorMessage(error, fallback = 'Unknown error') {
  if (error instanceof Error && error.message) return error.message;
  return typeof error === 'string' && error ? error : fallback;
}

function normalizeCredentialKeys(credentialKey) {
  if (Array.isArray(credentialKey)) return credentialKey.filter(Boolean);
  return credentialKey ? [credentialKey] : ['token'];
}

function hasCredentialValue(credentials, key) {
  const value = credentials?.[key];
  return typeof value === 'string' ? Boolean(value.trim()) : value != null;
}

function createCredentialValidator(credentialKey, validateCredentials) {
  if (typeof validateCredentials === 'function') return validateCredentials;
  const requiredKeys = normalizeCredentialKeys(credentialKey);
  return (credentials) => requiredKeys.every((key) => hasCredentialValue(credentials, key));
}

export function createConnectorCredentialHelpers({
  connectorId,
  credentialKey = 'token',
  validateCredentials,
  requiredErrorMessage = 'Connector not connected',
  notConnectedErrorMessage = requiredErrorMessage,
} = {}) {
  const isValidCredential = createCredentialValidator(credentialKey, validateCredentials);

  function getCredentials(ctx) {
    const credentials = ctx.connectorEngine?.getCredentials(connectorId);
    return isValidCredential(credentials) ? credentials : null;
  }

  function requireCredentials(ctx) {
    const credentials = getCredentials(ctx);
    if (!credentials) throw new Error(requiredErrorMessage);
    return credentials;
  }

  function notConnected() {
    return { ok: false, error: notConnectedErrorMessage };
  }

  async function withCredentials(ctx, callback) {
    const credentials = getCredentials(ctx);
    if (!credentials) return notConnected();
    try {
      return await callback(credentials);
    } catch (error) {
      return { ok: false, error: getErrorMessage(error) };
    }
  }

  return Object.freeze({
    getCredentials,
    requireCredentials,
    notConnected,
    withCredentials,
  });
}

export async function runCredentialedChatTool(ctx, getCredentials, notConnected, handler) {
  const credentials = getCredentials(ctx);
  if (!credentials) return notConnected();
  try {
    return await handler(credentials);
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export function formatDate(value, fallback = 'unknown date') {
  if (!value) return fallback;
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return String(value);
  }
}

export function formatDateTime(value, fallback = '') {
  if (!value) return fallback;
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

export function formatUnknownDateTime(value) {
  return formatDateTime(value, 'unknown');
}

export const SOURCE_EXTS = new Set([
  'js',
  'ts',
  'jsx',
  'tsx',
  'mjs',
  'cjs',
  'py',
  'rb',
  'go',
  'rs',
  'java',
  'kt',
  'swift',
  'c',
  'cpp',
  'h',
  'hpp',
  'cs',
  'vue',
  'svelte',
  'astro',
  'css',
  'scss',
  'less',
  'html',
  'ejs',
  'hbs',
  'json',
  'yaml',
  'yml',
  'toml',
  'sh',
  'bash',
  'zsh',
  'md',
  'mdx',
  'sql',
  'graphql',
  'gql',
  'env',
  'dockerfile',
  'makefile',
]);

export const ALWAYS_LOAD = new Set([
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'README.md',
  'readme.md',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  '.env.example',
  'Makefile',
  'Justfile',
  'pyproject.toml',
  'setup.py',
  'requirements.txt',
  'Cargo.toml',
  'go.mod',
  'tsconfig.json',
  'jsconfig.json',
  'vite.config.js',
  'vite.config.ts',
  'webpack.config.js',
  'rollup.config.js',
  '.eslintrc.js',
  '.prettierrc',
]);

export const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '__pycache__',
  '.pytest_cache',
  'venv',
  '.venv',
  'env',
  'coverage',
  '.nyc_output',
  '.cache',
  'tmp',
  'temp',
  'vendor',
  'target',
  'bin',
  'obj',
  '.gradle',
]);

export function scoreFile(filePath) {
  const parts = filePath.split('/'),
    filename = parts[parts.length - 1],
    ext = filename.includes('.') ? filename.split('.').pop().toLowerCase() : filename.toLowerCase();
  if (parts.some((part) => SKIP_DIRS.has(part))) return -1;
  let score = 0;
  if ((ALWAYS_LOAD.has(filename) && (score += 100), SOURCE_EXTS.has(ext))) score += 30;
  else if (!ALWAYS_LOAD.has(filename)) return -1;
  return (
    (score -= 2 * Math.max(0, parts.length - 4)),
    /\.(test|spec)\.|__tests__|\/tests?\//.test(filePath) && (score -= 10),
    /^(index|main|app|server|entry)\.\w+$/.test(filename) && (score += 20),
    /config|setup|bootstrap|init/.test(filename.toLowerCase()) && (score += 10),
    score
  );
}

export function requireRepo(owner, repo) {
  if (!owner || !repo) throw new Error('Missing required params: owner, repo');
}

export function requirePullRequest(owner, repo, prNumber) {
  if ((requireRepo(owner, repo), !prNumber))
    throw new Error('Missing required params: owner, repo, pr_number');
}

export function mimeSafeString(value, fallback = 'unknown') {
  return null == value || '' === value ? fallback : String(value);
}

export function parseInlineComments(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
