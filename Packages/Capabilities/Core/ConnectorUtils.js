function getErrorMessage(error, fallback = 'Unknown error') {
  if (error instanceof Error && error.message) return error.message;
  return 'string' == typeof error && error ? error : fallback;
}

function createCredentialValidator(credentialKey, validateCredentials) {
  if ('function' == typeof validateCredentials) return validateCredentials;
  if (Array.isArray(credentialKey))
    return (credentials) => credentialKey.every((key) => Boolean(credentials?.[key]));
  return (credentials) => Boolean(credentials?.[credentialKey]);
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

export function parseCommaList(value = '') {
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
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
