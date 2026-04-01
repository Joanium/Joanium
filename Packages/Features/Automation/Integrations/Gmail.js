import { getFreshCreds } from './GoogleWorkspace.js';

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

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

  if (res.status === 204) return null;
  return res.json();
}

function parseHeaders(headers = []) {
  const get = name => headers.find(header => header.name.toLowerCase() === name.toLowerCase())?.value ?? '';
  return {
    subject: get('Subject'),
    from: get('From'),
    to: get('To'),
    date: get('Date'),
    messageId: get('Message-ID'),
  };
}

export async function getUnreadEmails(creds, maxResults = 10) {
  const list = await gmailFetch(creds, `${GMAIL_BASE}/messages?q=is:unread&maxResults=${maxResults}`);
  const messages = list.messages || [];
  const emails = [];

  for (const msg of messages) {
    const detail = await gmailFetch(creds, `${GMAIL_BASE}/messages/${msg.id}`);
    const headers = parseHeaders(detail.payload.headers);
    emails.push({ id: msg.id, threadId: detail.threadId, ...headers, snippet: detail.snippet });
  }

  return emails;
}

export async function getEmailBrief(creds, maxResults = 10) {
  const emails = await getUnreadEmails(creds, maxResults);
  if (!emails.length) return { count: 0, text: '' };
  return {
    count: emails.length,
    text: emails.map((email, index) => `${index + 1}. ${email.subject} - ${email.from}\n${email.snippet}`).join('\n\n'),
  };
}

export async function searchEmails(creds, query, maxResults = 10) {
  const list = await gmailFetch(creds, `${GMAIL_BASE}/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`);
  const messages = list.messages || [];
  const emails = [];

  for (const msg of messages) {
    const detail = await gmailFetch(creds, `${GMAIL_BASE}/messages/${msg.id}`);
    const headers = parseHeaders(detail.payload.headers);
    emails.push({ id: msg.id, threadId: detail.threadId, ...headers, snippet: detail.snippet });
  }

  return emails;
}

export async function sendEmail(creds, to, subject, body, cc = '', bcc = '') {
  const fresh = await getFreshCreds(creds);
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

  const res = await fetch(`${GMAIL_BASE}/messages/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${fresh.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Failed to send email: ${err.error?.message ?? res.status}`);
  }

  return true;
}

export async function replyToEmail(creds, messageId, replyBody) {
  const fresh = await getFreshCreds(creds);
  const detail = await gmailFetch(creds, `${GMAIL_BASE}/messages/${messageId}?format=full`);
  const headers = parseHeaders(detail.payload.headers);

  const replyTo = headers.from || '';
  const subject = headers.subject.startsWith('Re:') ? headers.subject : `Re: ${headers.subject}`;
  const refs = headers.messageId;
  const message = [
    `To: ${replyTo}`,
    `Subject: ${subject}`,
    `In-Reply-To: ${refs}`,
    `References: ${refs}`,
    'Content-Type: text/plain; charset=UTF-8',
    'MIME-Version: 1.0',
    '',
    replyBody,
  ].join('\r\n');

  const raw = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await fetch(`${GMAIL_BASE}/messages/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${fresh.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw, threadId: detail.threadId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Failed to send reply: ${err.error?.message ?? res.status}`);
  }

  return true;
}

export async function forwardEmail(creds, messageId, forwardTo, extraNote = '') {
  const fresh = await getFreshCreds(creds);
  const detail = await gmailFetch(creds, `${GMAIL_BASE}/messages/${messageId}?format=full`);
  const headers = parseHeaders(detail.payload.headers);

  let originalBody = '';
  const walk = (parts = []) => {
    for (const part of parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        originalBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
        return;
      }
      if (part.parts) walk(part.parts);
    }
  };

  if (detail.payload.body?.data) {
    originalBody = Buffer.from(detail.payload.body.data, 'base64').toString('utf-8');
  } else {
    walk(detail.payload.parts ?? []);
  }

  const message = [
    `To: ${forwardTo}`,
    `Subject: ${headers.subject.startsWith('Fwd:') ? headers.subject : `Fwd: ${headers.subject}`}`,
    'Content-Type: text/plain; charset=UTF-8',
    'MIME-Version: 1.0',
    '',
    [
      ...(extraNote ? [extraNote, ''] : []),
      '---------- Forwarded message ----------',
      `From: ${headers.from}`,
      `Date: ${headers.date}`,
      `Subject: ${headers.subject}`,
      `To: ${headers.to}`,
      '',
      originalBody,
    ].join('\n'),
  ].join('\r\n');

  const raw = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await fetch(`${GMAIL_BASE}/messages/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${fresh.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Failed to forward email: ${err.error?.message ?? res.status}`);
  }

  return true;
}

export async function modifyMessage(creds, messageId, { addLabels = [], removeLabels = [] }) {
  return gmailFetch(creds, `${GMAIL_BASE}/messages/${messageId}/modify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ addLabelIds: addLabels, removeLabelIds: removeLabels }),
  });
}

export async function markAsRead(creds, messageId) {
  return modifyMessage(creds, messageId, { removeLabels: ['UNREAD'] });
}

export async function markAsUnread(creds, messageId) {
  return modifyMessage(creds, messageId, { addLabels: ['UNREAD'] });
}

export async function archiveMessage(creds, messageId) {
  return modifyMessage(creds, messageId, { removeLabels: ['INBOX'] });
}

export async function trashMessage(creds, messageId) {
  return gmailFetch(creds, `${GMAIL_BASE}/messages/${messageId}/trash`, { method: 'POST' });
}

export async function untrashMessage(creds, messageId) {
  return gmailFetch(creds, `${GMAIL_BASE}/messages/${messageId}/untrash`, { method: 'POST' });
}

export async function markAllRead(creds) {
  const list = await gmailFetch(creds, `${GMAIL_BASE}/messages?q=is:unread&maxResults=500`);
  const messages = list.messages ?? [];
  if (!messages.length) return 0;

  await gmailFetch(creds, `${GMAIL_BASE}/messages/batchModify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ids: messages.map(message => message.id),
      removeLabelIds: ['UNREAD'],
    }),
  });

  return messages.length;
}

export async function archiveReadEmails(creds, maxResults = 100) {
  const list = await gmailFetch(creds, `${GMAIL_BASE}/messages?q=in:inbox -is:unread&maxResults=${maxResults}`);
  const messages = list.messages ?? [];
  if (!messages.length) return 0;

  await gmailFetch(creds, `${GMAIL_BASE}/messages/batchModify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ids: messages.map(message => message.id),
      removeLabelIds: ['INBOX'],
    }),
  });

  return messages.length;
}

export async function trashEmailsByQuery(creds, query, maxResults = 50) {
  const list = await gmailFetch(creds, `${GMAIL_BASE}/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`);
  const messages = list.messages ?? [];
  if (!messages.length) return 0;

  await gmailFetch(creds, `${GMAIL_BASE}/messages/batchModify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ids: messages.map(message => message.id),
      addLabelIds: ['TRASH'],
    }),
  });

  return messages.length;
}

export async function listLabels(creds) {
  const data = await gmailFetch(creds, `${GMAIL_BASE}/labels`);
  return data.labels ?? [];
}

export async function createLabel(creds, name, { textColor = '#ffffff', backgroundColor = '#16a766' } = {}) {
  return gmailFetch(creds, `${GMAIL_BASE}/labels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
      color: { textColor, backgroundColor },
    }),
  });
}

export async function getLabelId(creds, labelName) {
  const labels = await listLabels(creds);
  return labels.find(label => label.name.toLowerCase() === labelName.toLowerCase())?.id ?? null;
}

export async function createDraft(creds, to, subject, body, cc = '') {
  const fresh = await getFreshCreds(creds);
  const message = [
    `To: ${to}`,
    ...(cc ? [`Cc: ${cc}`] : []),
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

  const res = await fetch(`${GMAIL_BASE}/drafts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${fresh.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: { raw } }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Failed to create draft: ${err.error?.message ?? res.status}`);
  }

  return res.json();
}

export async function getInboxStats(creds) {
  const [profile, unreadList, inboxList] = await Promise.all([
    gmailFetch(creds, `${GMAIL_BASE}/profile`),
    gmailFetch(creds, `${GMAIL_BASE}/messages?q=is:unread&maxResults=1`),
    gmailFetch(creds, `${GMAIL_BASE}/messages?q=in:inbox&maxResults=1`),
  ]);

  return {
    email: profile.emailAddress,
    totalMessages: profile.messagesTotal,
    totalThreads: profile.threadsTotal,
    unreadEstimate: unreadList.resultSizeEstimate ?? 0,
    inboxEstimate: inboxList.resultSizeEstimate ?? 0,
  };
}
