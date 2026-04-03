export const GOOGLE_NOT_CONNECTED_MESSAGE = 'Google Workspace not connected - connect it in Settings -> Connectors';

export function getGoogleCredentials(ctx) {
  const credentials = ctx.connectorEngine?.getCredentials('google');
  return credentials?.accessToken ? credentials : null;
}

export function requireGoogleCredentials(ctx) {
  const credentials = getGoogleCredentials(ctx);
  if (!credentials) throw new Error(GOOGLE_NOT_CONNECTED_MESSAGE);
  return credentials;
}

export function googleNotConnected() {
  return { ok: false, error: GOOGLE_NOT_CONNECTED_MESSAGE };
}

export async function withGoogle(ctx, callback) {
  const credentials = getGoogleCredentials(ctx);
  if (!credentials) return googleNotConnected();

  try {
    return await callback(credentials);
  } catch (error) {
    return { ok: false, error: error.message };
  }
}
