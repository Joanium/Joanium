import http from 'http';
import { shell } from 'electron';
const TOKEN_URL = 'https://oauth2.googleapis.com/token',
  REDIRECT_URI = 'http://localhost:42813/oauth/callback',
  SCOPES = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/youtube',
    'https://www.googleapis.com/auth/tasks',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/contacts',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/presentations',
    'https://www.googleapis.com/auth/photoslibrary.readonly',
    'https://www.googleapis.com/auth/forms.body.readonly',
    'https://www.googleapis.com/auth/forms.responses.readonly',
  ].join(' '),
  SERVICE_PROBES = {
    gmail: { url: 'https://gmail.googleapis.com/gmail/v1/users/me/profile', label: 'Gmail' },
    drive: { url: 'https://www.googleapis.com/drive/v3/about?fields=user', label: 'Google Drive' },
    calendar: {
      url: 'https://www.googleapis.com/calendar/v3/calendars/primary',
      label: 'Google Calendar',
    },
    youtube: {
      url: 'https://www.googleapis.com/youtube/v3/channels?part=id&mine=true',
      label: 'YouTube',
    },
    tasks: {
      url: 'https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=1',
      label: 'Google Tasks',
    },
    contacts: {
      url: 'https://people.googleapis.com/v1/people/me?personFields=names',
      label: 'Google Contacts',
    },
    sheets: {
      url: "https://www.googleapis.com/drive/v3/files?q=mimeType%3D'application%2Fvnd.google-apps.spreadsheet'+and+trashed%3Dfalse&pageSize=1&fields=files(id)",
      label: 'Google Sheets',
    },
    docs: {
      url: "https://www.googleapis.com/drive/v3/files?q=mimeType%3D'application%2Fvnd.google-apps.document'+and+trashed%3Dfalse&pageSize=1&fields=files(id)",
      label: 'Google Docs',
    },
    slides: {
      url: "https://www.googleapis.com/drive/v3/files?q=mimeType%3D'application%2Fvnd.google-apps.presentation'+and+trashed%3Dfalse&pageSize=1&fields=files(id)",
      label: 'Google Slides',
    },
    photos: {
      url: 'https://photoslibrary.googleapis.com/v1/albums?pageSize=1',
      label: 'Google Photos',
    },
    forms: { url: 'https://forms.googleapis.com/v1/forms', label: 'Google Forms' },
  };
let _connectorEngine = null;
export function setConnectorEngine(engine) {
  _connectorEngine = engine;
}
export function startOAuthFlow(clientId, clientSecret) {
  return new Promise((resolve, reject) => {
    let settled = !1;
    function settle(fn) {
      settled || ((settled = !0), fn());
    }
    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url, 'http://localhost:42813');
        if ('/oauth/callback' !== url.pathname) return res.end();
        const code = url.searchParams.get('code'),
          error = url.searchParams.get('error');
        if (
          (res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }),
          res.end(
            `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;text-align:center">\n          <h2>${error ? '❌ Connection failed' : '✅ Google Workspace connected!'}</h2>\n          <p>You can close this tab and return to Joanium.</p>\n        </body></html>`,
          ),
          server.close(),
          error || !code)
        )
          return settle(() => reject(new Error(error || 'No auth code returned')));
        const tokens = await (async function (code, clientId, clientSecret) {
          const res = await fetch(TOKEN_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                code: code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: REDIRECT_URI,
                grant_type: 'authorization_code',
              }),
            }),
            data = await res.json();
          if (!data.access_token)
            throw new Error(data.error_description ?? data.error ?? 'Token exchange failed');
          const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
              headers: { Authorization: `Bearer ${data.access_token}` },
            }),
            profile = await profileRes.json();
          return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            tokenExpiry: Date.now() + 1e3 * (data.expires_in ?? 3600),
            email: profile.email,
            clientId: clientId,
            clientSecret: clientSecret,
            services: {},
          };
        })(code, clientId, clientSecret);
        settle(() => resolve(tokens));
      } catch (err) {
        (server.close(), settle(() => reject(err)));
      }
    });
    server.listen(42813, 'localhost', () => {
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      (authUrl.searchParams.set('client_id', clientId),
        authUrl.searchParams.set('redirect_uri', REDIRECT_URI),
        authUrl.searchParams.set('response_type', 'code'),
        authUrl.searchParams.set('scope', SCOPES),
        authUrl.searchParams.set('access_type', 'offline'),
        authUrl.searchParams.set('prompt', 'consent'),
        shell.openExternal(authUrl.toString()));
    });
  });
}
export async function detectServices(creds) {
  const fresh = await getFreshCreds(creds),
    results = {};
  return (
    await Promise.all(
      Object.entries(SERVICE_PROBES).map(async ([key, { url: url }]) => {
        try {
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${fresh.accessToken}` },
          });
          results[key] = res.ok;
        } catch {
          results[key] = !1;
        }
      }),
    ),
    results
  );
}
export async function getFreshCreds(creds) {
  if (creds.tokenExpiry && !(Date.now() > creds.tokenExpiry - 12e4)) return creds;
  if (!creds.refreshToken)
    throw new Error(
      'Google token expired and no refresh token. Please reconnect Google Workspace in Settings → Connectors.',
    );
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: creds.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `Token refresh failed: ${err.error_description ?? err.error ?? res.status}. Please reconnect Google Workspace.`,
    );
  }
  const data = await res.json(),
    updated = {
      ...creds,
      accessToken: data.access_token,
      tokenExpiry: Date.now() + 1e3 * (data.expires_in ?? 3600),
      ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
    };
  return (
    _connectorEngine?.updateCredentials('google', {
      accessToken: updated.accessToken,
      tokenExpiry: updated.tokenExpiry,
      ...(data.refresh_token ? { refreshToken: updated.refreshToken } : {}),
    }),
    updated
  );
}
export async function googleFetch(creds, url, options = {}) {
  const fresh = await getFreshCreds(creds),
    res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${fresh.accessToken}`,
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
    });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})),
      message = body.error?.message ?? JSON.stringify(body);
    if (403 === res.status)
      throw new Error(
        `Google API access denied (403). Make sure the required API is enabled in your Google Cloud project. Detail: ${message}`,
      );
    throw new Error(`Google API error (${res.status}): ${message}`);
  }
  return 204 === res.status
    ? null
    : (res.headers.get('content-type') ?? '').includes('json')
      ? res.json()
      : res.text();
}
export const SERVICE_LABELS = {
  gmail: { icon: '📧', name: 'Gmail' },
  drive: { icon: '🗂️', name: 'Google Drive' },
  calendar: { icon: '📅', name: 'Google Calendar' },
  youtube: { icon: '▶️', name: 'YouTube' },
  tasks: { icon: '✅', name: 'Google Tasks' },
  sheets: { icon: '📊', name: 'Google Sheets' },
  contacts: { icon: '👤', name: 'Google Contacts' },
  docs: { icon: '📄', name: 'Google Docs' },
  slides: { icon: '🖼️', name: 'Google Slides' },
  photos: { icon: '🖼️', name: 'Google Photos' },
  forms: { icon: '📋', name: 'Google Forms' },
};
