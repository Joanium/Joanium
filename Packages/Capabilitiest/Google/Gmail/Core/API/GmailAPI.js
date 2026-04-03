import { getFreshCreds } from '../../../GoogleWorkspace.js';

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

// ─── PASTE THESE EXPORTS AT THE BOTTOM OF GmailAPI.js ───────────────────────

// ── Messages ──────────────────────────────────────────────────────────────────

export async function getMessageFull(creds, messageId) {
  const detail = await gmailFetch(creds, `${GMAIL_BASE}/messages/${messageId}?format=full`);
  const headers = parseHeaders(detail.payload.headers);

  let body = '';
  const walk = (parts = []) => {
    for (const part of parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        body = Buffer.from(part.body.data, 'base64').toString('utf-8');
        return;
      }
      if (part.parts) walk(part.parts);
    }
  };

  if (detail.payload.body?.data) {
    body = Buffer.from(detail.payload.body.data, 'base64').toString('utf-8');
  } else {
    walk(detail.payload.parts ?? []);
  }

  return { id: detail.id, threadId: detail.threadId, ...headers, body, snippet: detail.snippet, labelIds: detail.labelIds ?? [] };
}

export async function deleteMessage(creds, messageId) {
  await gmailFetch(creds, `${GMAIL_BASE}/messages/${messageId}`, { method: 'DELETE' });
  return true;
}

export async function batchDeleteByQuery(creds, query, maxResults = 50) {
  const list = await gmailFetch(creds, `${GMAIL_BASE}/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`);
  const messages = list.messages ?? [];
  if (!messages.length) return 0;

  await gmailFetch(creds, `${GMAIL_BASE}/messages/batchDelete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: messages.map(m => m.id) }),
  });

  return messages.length;
}

export async function listAttachments(creds, messageId) {
  const detail = await gmailFetch(creds, `${GMAIL_BASE}/messages/${messageId}?format=full`);
  const attachments = [];

  const walk = (parts = []) => {
    for (const part of parts) {
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          attachmentId: part.body.attachmentId,
          filename: part.filename,
          mimeType: part.mimeType,
          size: part.body.size ?? 0,
        });
      }
      if (part.parts) walk(part.parts);
    }
  };

  walk(detail.payload.parts ?? []);
  return attachments;
}

// ── Threads ───────────────────────────────────────────────────────────────────

export async function listThreads(creds, query = '', maxResults = 10) {
  const q = query ? `&q=${encodeURIComponent(query)}` : '';
  const data = await gmailFetch(creds, `${GMAIL_BASE}/threads?maxResults=${maxResults}${q}`);
  const threads = data.threads ?? [];

  return Promise.all(threads.map(async t => {
    const detail = await gmailFetch(creds, `${GMAIL_BASE}/threads/${t.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`);
    const first = detail.messages?.[0];
    const headers = parseHeaders(first?.payload?.headers ?? []);
    return { id: t.id, messageCount: detail.messages?.length ?? 1, subject: headers.subject, from: headers.from, snippet: detail.snippet };
  }));
}

export async function getThread(creds, threadId) {
  const detail = await gmailFetch(creds, `${GMAIL_BASE}/threads/${threadId}?format=full`);
  return {
    id: detail.id,
    historyId: detail.historyId,
    messages: (detail.messages ?? []).map(msg => {
      const headers = parseHeaders(msg.payload.headers);
      return { id: msg.id, ...headers, snippet: msg.snippet, labelIds: msg.labelIds ?? [] };
    }),
  };
}

export async function modifyThread(creds, threadId, { addLabels = [], removeLabels = [] }) {
  return gmailFetch(creds, `${GMAIL_BASE}/threads/${threadId}/modify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ addLabelIds: addLabels, removeLabelIds: removeLabels }),
  });
}

export async function trashThread(creds, threadId) {
  return gmailFetch(creds, `${GMAIL_BASE}/threads/${threadId}/trash`, { method: 'POST' });
}

export async function archiveThread(creds, threadId) {
  return modifyThread(creds, threadId, { removeLabels: ['INBOX'] });
}

// ── Drafts ────────────────────────────────────────────────────────────────────

export async function listDrafts(creds, maxResults = 10) {
  const data = await gmailFetch(creds, `${GMAIL_BASE}/drafts?maxResults=${maxResults}`);
  const drafts = data.drafts ?? [];

  return Promise.all(drafts.map(async d => {
    const detail = await gmailFetch(creds, `${GMAIL_BASE}/drafts/${d.id}`);
    const headers = parseHeaders(detail.message?.payload?.headers ?? []);
    return { id: d.id, messageId: detail.message?.id, subject: headers.subject, to: headers.to, snippet: detail.message?.snippet };
  }));
}

export async function deleteDraft(creds, draftId) {
  await gmailFetch(creds, `${GMAIL_BASE}/drafts/${draftId}`, { method: 'DELETE' });
  return true;
}

export async function sendDraft(creds, draftId) {
  const fresh = await getFreshCreds(creds);
  const res = await fetch(`${GMAIL_BASE}/drafts/send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${fresh.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: draftId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Failed to send draft: ${err.error?.message ?? res.status}`);
  }

  return res.json();
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function getVacationResponder(creds) {
  return gmailFetch(creds, `${GMAIL_BASE}/settings/vacation`);
}

export async function setVacationResponder(creds, { subject, body, startTime, endTime, enableAutoReply = true, sendAsDefault = true }) {
  return gmailFetch(creds, `${GMAIL_BASE}/settings/vacation`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      enableAutoReply,
      responseSubject: subject,
      responseBodyPlainText: body,
      restrictToContacts: false,
      restrictToDomain: false,
      sendAsDefault,
      ...(startTime ? { startTime } : {}),
      ...(endTime ? { endTime } : {}),
    }),
  });
}

export async function disableVacationResponder(creds) {
  const current = await getVacationResponder(creds);
  return gmailFetch(creds, `${GMAIL_BASE}/settings/vacation`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...current, enableAutoReply: false }),
  });
}

export async function listFilters(creds) {
  const data = await gmailFetch(creds, `${GMAIL_BASE}/settings/filters`);
  return data.filter ?? [];
}

export async function createFilter(creds, { from, to, subject, hasWords, doesNotHaveWords }, { addLabelIds = [], removeLabelIds = [], markAsRead = false, archive = false } = {}) {
  const criteria = {
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(subject ? { subject } : {}),
    ...(hasWords ? { query: hasWords } : {}),
    ...(doesNotHaveWords ? { negatedQuery: doesNotHaveWords } : {}),
  };

  const action = {
    addLabelIds,
    removeLabelIds: [...removeLabelIds, ...(markAsRead ? ['UNREAD'] : []), ...(archive ? ['INBOX'] : [])],
  };

  return gmailFetch(creds, `${GMAIL_BASE}/settings/filters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ criteria, action }),
  });
}

// ── Labels (extended) ─────────────────────────────────────────────────────────

export async function deleteLabel(creds, labelId) {
  await gmailFetch(creds, `${GMAIL_BASE}/labels/${labelId}`, { method: 'DELETE' });
  return true;
}

export async function renameLabel(creds, labelId, newName) {
  return gmailFetch(creds, `${GMAIL_BASE}/labels/${labelId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newName }),
  });
}

// ── Send-As Aliases ───────────────────────────────────────────────────────────

export async function listSendAs(creds) {
  const data = await gmailFetch(creds, `${GMAIL_BASE}/settings/sendAs`);
  return data.sendAs ?? [];
}