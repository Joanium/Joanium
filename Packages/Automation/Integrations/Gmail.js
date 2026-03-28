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

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

/* ══════════════════════════════════════════
   OAUTH FLOW
══════════════════════════════════════════ */
export function startGmailOAuthFlow(clientId, clientSecret) {
  return new Promise((resolve, reject) => {
    let settled = false;

    function settle(fn) {
      if (settled) return;
      settled = true;
      fn();
    }

    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url, `http://localhost:${CALLBACK_PORT}`);
        if (url.pathname !== '/oauth/callback') return res.end();

        const code  = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<h2>${error ? '❌ Failed' : '✅ Connected'}</h2>`);

        server.close();

        if (error || !code) {
          return settle(() => reject(new Error(error || 'No code')));
        }

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
      code,
      client_id:     clientId,
      client_secret: clientSecret,
      redirect_uri:  REDIRECT_URI,
      grant_type:    'authorization_code',
    }),
  });

  const data = await res.json();

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
  };
}

/* ══════════════════════════════════════════
   TOKEN REFRESH
   Google tokens expire after 1 hour.
   Always call getFreshCreds() before any API call.
══════════════════════════════════════════ */

// connectorEngine reference — set once in GmailIPC.js via setConnectorEngine()
let _connectorEngine = null;
export function setConnectorEngine(engine) { _connectorEngine = engine; }

/**
 * Return creds with a valid (non-expired) access token.
 * Refreshes automatically if expiry is within 2 minutes.
 */
async function getFreshCreds(creds) {
  const bufferMs = 2 * 60 * 1000; // refresh 2 min before expiry
  const isExpired = !creds.tokenExpiry || Date.now() > (creds.tokenExpiry - bufferMs);

  if (!isExpired) return creds;

  // Need to refresh
  if (!creds.refreshToken) {
    throw new Error('Gmail token expired and no refresh token available. Please reconnect Gmail in Settings → Connectors.');
  }

  console.warn('[Gmail] Access token expired - refreshing...');

  const res = await fetch(TOKEN_URL, {
    method:  'POST',
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
    throw new Error(`Token refresh failed: ${err.error_description ?? err.error ?? res.status}. Please reconnect Gmail.`);
  }

  const data = await res.json();

  const updated = {
    ...creds,
    accessToken:  data.access_token,
    tokenExpiry:  Date.now() + (data.expires_in ?? 3600) * 1000,
    // refresh_token is sometimes rotated — update if provided
    ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
  };

  // Persist the new token so we don't re-refresh on the next call
  _connectorEngine?.updateCredentials('gmail', {
    accessToken:  updated.accessToken,
    tokenExpiry:  updated.tokenExpiry,
    ...(data.refresh_token ? { refreshToken: updated.refreshToken } : {}),
  });

  console.info('[Gmail] Token refreshed successfully.');
  return updated;
}

/* ══════════════════════════════════════════
   INTERNAL FETCH HELPER
   Always refreshes token before calling.
══════════════════════════════════════════ */
async function gmailFetch(creds, url, options = {}) {
  const fresh = await getFreshCreds(creds);

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${fresh.accessToken}`,
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Gmail API error (${res.status}): ${body.error?.message ?? JSON.stringify(body)}`);
  }

  return res.json();
}

/* ══════════════════════════════════════════
   VALIDATE
══════════════════════════════════════════ */
export async function validateCredentials(creds) {
  const data = await gmailFetch(creds,
    'https://gmail.googleapis.com/gmail/v1/users/me/profile'
  );
  return data.emailAddress;
}

/* ══════════════════════════════════════════
   GET UNREAD EMAILS
══════════════════════════════════════════ */
export async function getUnreadEmails(creds, maxResults = 10) {
  const list = await gmailFetch(
    creds,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread&maxResults=${maxResults}`
  );

  const messages = list.messages || [];
  const emails   = [];

  for (const msg of messages) {
    const detail  = await gmailFetch(
      creds,
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`
    );
    const headers = detail.payload.headers;
    emails.push({
      id:      msg.id,
      subject: headers.find(h => h.name === 'Subject')?.value ?? '(No subject)',
      from:    headers.find(h => h.name === 'From')?.value    ?? '(Unknown)',
      snippet: detail.snippet,
    });
  }

  return emails;
}

/* ══════════════════════════════════════════
   EMAIL BRIEF
══════════════════════════════════════════ */
export async function getEmailBrief(creds, maxResults = 10) {
  const emails = await getUnreadEmails(creds, maxResults);
  if (!emails.length) return { count: 0, text: '' };
  const text = emails.map((e, i) =>
    `${i + 1}. ${e.subject} — ${e.from}\n${e.snippet}`
  ).join('\n\n');
  return { count: emails.length, text };
}

/* ══════════════════════════════════════════
   SEARCH EMAILS
══════════════════════════════════════════ */
export async function searchEmails(creds, query, maxResults = 10) {
  const list = await gmailFetch(
    creds,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`
  );

  const messages = list.messages || [];
  const emails   = [];

  for (const msg of messages) {
    const detail  = await gmailFetch(
      creds,
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`
    );
    const headers = detail.payload.headers;
    emails.push({
      id:      msg.id,
      subject: headers.find(h => h.name === 'Subject')?.value ?? '(No subject)',
      from:    headers.find(h => h.name === 'From')?.value    ?? '(Unknown)',
      snippet: detail.snippet,
    });
  }

  return emails;
}

/* ══════════════════════════════════════════
   SEND EMAIL
══════════════════════════════════════════ */
export async function sendEmail(creds, to, subject, body, cc = '', bcc = '') {
  const fresh = await getFreshCreds(creds);

  // Build a proper RFC 2822 message with UTF-8 encoding
  const message = [
    `To: ${to}`,
    ...(cc ? [`Cc: ${cc}`] : []),
    ...(bcc ? [`Bcc: ${bcc}`] : []),
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=UTF-8',
    'MIME-Version: 1.0',
    '',
    body,
  ].join('\r\n');

  const raw = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${fresh.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Failed to send email: ${err.error?.message ?? res.status}`);
  }

  return true;
}
