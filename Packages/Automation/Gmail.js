// ─────────────────────────────────────────────
//  openworld — Packages/Automation/Gmail.js
//  Gmail REST API integration (main-process safe)
//  Pure functions: accept a credentials object, return data or throw.
// ─────────────────────────────────────────────

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';
const TOKEN_URL  = 'https://oauth2.googleapis.com/token';

/* ══════════════════════════════════════════
   INTERNAL HELPERS
══════════════════════════════════════════ */

async function gmailFetch(endpoint, accessToken, options = {}) {
  const res = await fetch(`${GMAIL_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Gmail API ${res.status}`);
  }
  return res.json();
}

function parseHeaders(headers = []) {
  const get = (name) =>
    headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
  return { from: get('From'), subject: get('Subject'), date: get('Date') };
}

function decodeBase64(data = '') {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

function extractBody(payload) {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data)
    return decodeBase64(payload.body.data);
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractBody(part);
      if (text) return text;
    }
  }
  return '';
}

/* ══════════════════════════════════════════
   TOKEN REFRESH
══════════════════════════════════════════ */

/**
 * Attempt to refresh the access token using a stored refresh token.
 * Returns updated credentials object. Throws if refresh fails.
 */
export async function refreshAccessToken(credentials) {
  const { refreshToken, clientId, clientSecret } = credentials;
  if (!refreshToken || !clientId || !clientSecret) return credentials;

  const res = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
      client_id:     clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error_description ?? 'Could not refresh Gmail token');
  }

  const data = await res.json();
  return {
    ...credentials,
    accessToken: data.access_token,
    tokenExpiry: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}

/* ══════════════════════════════════════════
   PUBLIC API
══════════════════════════════════════════ */

/**
 * Validate credentials by fetching the Gmail profile.
 * Returns the authenticated email address or throws.
 */
export async function validateCredentials(credentials) {
  const profile = await gmailFetch('/profile', credentials.accessToken);
  return profile.emailAddress;
}

/**
 * Fetch lightweight metadata for unread inbox messages.
 */
export async function getUnreadEmails(credentials, maxResults = 20) {
  const { accessToken } = credentials;
  if (!accessToken) throw new Error('Gmail not connected');

  const list = await gmailFetch(
    `/messages?q=is:unread+in:inbox&maxResults=${maxResults}`,
    accessToken,
  );
  if (!list.messages?.length) return [];

  const emails = await Promise.all(
    list.messages.map(msg =>
      gmailFetch(
        `/messages/${msg.id}?format=metadata` +
        `&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        accessToken,
      ),
    ),
  );

  return emails.map(email => ({
    id:      email.id,
    snippet: email.snippet ?? '',
    ...parseHeaders(email.payload?.headers),
  }));
}

/**
 * Fetch the full content of a single email by ID.
 */
export async function getEmailById(credentials, messageId) {
  const email = await gmailFetch(
    `/messages/${messageId}?format=full`,
    credentials.accessToken,
  );
  return {
    id:      email.id,
    snippet: email.snippet ?? '',
    body:    extractBody(email.payload),
    ...parseHeaders(email.payload?.headers),
  };
}

/**
 * Return a structured brief of unread emails (count + formatted text).
 */
export async function getEmailBrief(credentials, maxResults = 15) {
  const emails = await getUnreadEmails(credentials, maxResults);
  return {
    count:  emails.length,
    emails,
    text:   emails.length === 0
      ? 'No unread emails.'
      : emails
          .map((e, i) =>
            `${i + 1}. From: ${e.from}\n   Subject: ${e.subject}\n   Preview: ${e.snippet}`,
          )
          .join('\n\n'),
  };
}

/**
 * Send a plain-text email via Gmail.
 */
export async function sendEmail(credentials, to, subject, body) {
  const { accessToken, email: fromEmail } = credentials;
  const raw = Buffer.from(
    `From: ${fromEmail ?? 'me'}\r\nTo: ${to}\r\n` +
    `Subject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`,
  )
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return gmailFetch('/messages/send', accessToken, {
    method: 'POST',
    body:   JSON.stringify({ raw }),
  });
}

/**
 * Search emails using Gmail search syntax (e.g. "from:boss@co.com is:unread").
 */
export async function searchEmails(credentials, query, maxResults = 10) {
  const { accessToken } = credentials;
  const list = await gmailFetch(
    `/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
    accessToken,
  );
  if (!list.messages?.length) return [];

  return Promise.all(
    list.messages.map(msg =>
      gmailFetch(
        `/messages/${msg.id}?format=metadata` +
        `&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        accessToken,
      ).then(email => ({
        id:      email.id,
        snippet: email.snippet ?? '',
        ...parseHeaders(email.payload?.headers),
      })),
    ),
  );
}

/**
 * Mark a message as read (removes UNREAD label).
 */
export async function markAsRead(credentials, messageId) {
  return gmailFetch(`/messages/${messageId}/modify`, credentials.accessToken, {
    method: 'POST',
    body:   JSON.stringify({ removeLabelIds: ['UNREAD'] }),
  });
}

/**
 * Move a message to Trash.
 */
export async function trashEmail(credentials, messageId) {
  return gmailFetch(`/messages/${messageId}/trash`, credentials.accessToken, {
    method: 'POST',
  });
}
