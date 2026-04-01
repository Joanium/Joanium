import http from 'http';
import { shell } from 'electron';

/* ══════════════════════════════════════════
   CONFIG
══════════════════════════════════════════ */
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL       = 'https://oauth2.googleapis.com/token';
const USERINFO_URL    = 'https://www.googleapis.com/oauth2/v2/userinfo';

const CALLBACK_PORT = 42813;
const REDIRECT_URI  = `http://localhost:${CALLBACK_PORT}/oauth/callback`;

// All scopes in one shot — user only grants once
const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/calendar',
].join(' ');

// Per-service probe endpoints (fast, minimal data)
const SERVICE_PROBES = {
  gmail:    { url: 'https://gmail.googleapis.com/gmail/v1/users/me/profile',      label: 'Gmail' },
  drive:    { url: 'https://www.googleapis.com/drive/v3/about?fields=user',        label: 'Google Drive' },
  calendar: { url: 'https://www.googleapis.com/calendar/v3/calendars/primary',     label: 'Google Calendar' },
};

/* ══════════════════════════════════════════
   CONNECTOR ENGINE REF
══════════════════════════════════════════ */
let _connectorEngine = null;
export function setConnectorEngine(engine) { _connectorEngine = engine; }

/* ══════════════════════════════════════════
   OAUTH FLOW
══════════════════════════════════════════ */
export function startOAuthFlow(clientId, clientSecret) {
  return new Promise((resolve, reject) => {
    let settled = false;
    function settle(fn) { if (settled) return; settled = true; fn(); }

    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url, `http://localhost:${CALLBACK_PORT}`);
        if (url.pathname !== '/oauth/callback') return res.end();

        const code  = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;text-align:center">
          <h2>${error ? '❌ Connection failed' : '✅ Google Workspace connected!'}</h2>
          <p>You can close this tab and return to Joanium.</p>
        </body></html>`);

        server.close();
        if (error || !code) return settle(() => reject(new Error(error || 'No auth code returned')));
        const tokens = await exchangeCode(code, clientId, clientSecret);
        settle(() => resolve(tokens));
      } catch (err) {
        server.close();
        settle(() => reject(err));
      }
    });

    server.listen(CALLBACK_PORT, 'localhost', () => {
      const authUrl = new URL(GOOGLE_AUTH_URL);
      authUrl.searchParams.set('client_id',     clientId);
      authUrl.searchParams.set('redirect_uri',  REDIRECT_URI);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope',         SCOPES);
      authUrl.searchParams.set('access_type',   'offline');
      authUrl.searchParams.set('prompt',        'consent');
      shell.openExternal(authUrl.toString());
    });
  });
}

async function exchangeCode(code, clientId, clientSecret) {
  const res = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: clientId, client_secret: clientSecret,
      redirect_uri: REDIRECT_URI, grant_type: 'authorization_code',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(data.error_description ?? data.error ?? 'Token exchange failed');

  const profileRes = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  const profile = await profileRes.json();

  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    tokenExpiry:  Date.now() + (data.expires_in ?? 3600) * 1000,
    email:        profile.email,
    clientId,
    clientSecret,
    services: {},  // filled in after detectServices()
  };
}

/* ══════════════════════════════════════════
   SERVICE DETECTION
   Returns { gmail: bool, drive: bool, calendar: bool }
   Each probe is a lightweight HEAD/GET — fast.
══════════════════════════════════════════ */
export async function detectServices(creds) {
  const fresh = await getFreshCreds(creds);
  const results = {};

  await Promise.all(
    Object.entries(SERVICE_PROBES).map(async ([key, { url }]) => {
      try {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${fresh.accessToken}` },
        });
        // 200 = enabled, 403 = API not enabled in project, 401 = scope missing
        results[key] = res.ok;
      } catch {
        results[key] = false;
      }
    }),
  );

  return results;
}

/* ══════════════════════════════════════════
   TOKEN REFRESH
══════════════════════════════════════════ */
export async function getFreshCreds(creds) {
  const bufferMs = 2 * 60 * 1000;
  const isExpired = !creds.tokenExpiry || Date.now() > (creds.tokenExpiry - bufferMs);
  if (!isExpired) return creds;

  if (!creds.refreshToken) {
    throw new Error('Google token expired and no refresh token. Please reconnect Google Workspace in Settings → Connectors.');
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: creds.refreshToken,
      grant_type:    'refresh_token',
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Token refresh failed: ${err.error_description ?? err.error ?? res.status}. Please reconnect Google Workspace.`);
  }

  const data = await res.json();
  const updated = {
    ...creds,
    accessToken: data.access_token,
    tokenExpiry: Date.now() + (data.expires_in ?? 3600) * 1000,
    ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
  };

  _connectorEngine?.updateCredentials('google', {
    accessToken: updated.accessToken,
    tokenExpiry: updated.tokenExpiry,
    ...(data.refresh_token ? { refreshToken: updated.refreshToken } : {}),
  });

  return updated;
}

/* ══════════════════════════════════════════
   SHARED FETCH HELPER  (used by Gmail/Drive/Calendar APIs)
   Pass the service key for a clear error message.
══════════════════════════════════════════ */
export async function googleFetch(creds, url, options = {}) {
  const fresh = await getFreshCreds(creds);
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${fresh.accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body.error?.message ?? JSON.stringify(body);
    if (res.status === 403) {
      throw new Error(`Google API access denied (403). Make sure the required API is enabled in your Google Cloud project. Detail: ${message}`);
    }
    throw new Error(`Google API error (${res.status}): ${message}`);
  }

  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') ?? '';
  return ct.includes('json') ? res.json() : res.text();
}

export const SERVICE_LABELS = {
  gmail:    { icon: '📧', name: 'Gmail' },
  drive:    { icon: '🗂️', name: 'Google Drive' },
  calendar: { icon: '📅', name: 'Google Calendar' },
};
