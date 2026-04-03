async function getFreshGoogleCreds(creds) {
  const { getFreshCreds } = await import('../../../GoogleWorkspace.js');
  return getFreshCreds(creds);
}

const DOCS_BASE = 'https://docs.googleapis.com/v1/documents';
const MAX_CONTENT_CHARS = 30_000;

async function docsFetch(creds, url, options = {}) {
  const fresh = await getFreshGoogleCreds(creds);
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
    throw new Error(
      `Docs API error (${res.status}): ${body.error?.message ?? JSON.stringify(body)}`,
    );
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function getDocument(creds, documentId) {
  return docsFetch(creds, `${DOCS_BASE}/${documentId}`);
}

export async function createDocument(creds, title) {
  return docsFetch(creds, DOCS_BASE, {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

export function extractText(doc) {
  const chunks = [];

  function walkContent(content = []) {
    for (const element of content) {
      if (element.paragraph) {
        const line = (element.paragraph.elements ?? [])
          .map((el) => el.textRun?.content ?? '')
          .join('');
        if (line.trim()) chunks.push(line);
      } else if (element.table) {
        for (const row of element.table.tableRows ?? []) {
          for (const cell of row.tableCells ?? []) {
            walkContent(cell.content ?? []);
          }
        }
      } else if (element.sectionBreak) {
        chunks.push('\n');
      }
    }
  }

  walkContent(doc.body?.content ?? []);
  const full = chunks.join('');
  return { text: full.slice(0, MAX_CONTENT_CHARS), truncated: full.length > MAX_CONTENT_CHARS };
}

export async function insertText(creds, documentId, text, index = 1) {
  return docsFetch(creds, `${DOCS_BASE}/${documentId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [{ insertText: { location: { index }, text } }],
    }),
  });
}

export async function appendText(creds, documentId, text) {
  const doc = await getDocument(creds, documentId);
  const bodyContent = doc.body?.content ?? [];
  const lastEl = bodyContent.at(-1);
  // endIndex of last element is the end-of-body sentinel; insert just before it
  const endIndex = lastEl?.endIndex ?? 1;
  const insertIndex = Math.max(1, endIndex - 1);
  return insertText(creds, documentId, '\n' + text, insertIndex);
}

export async function replaceAllText(creds, documentId, searchText, replacement) {
  return docsFetch(creds, `${DOCS_BASE}/${documentId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          replaceAllText: {
            containsText: { text: searchText, matchCase: true },
            replaceText: replacement,
          },
        },
      ],
    }),
  });
}

export async function deleteContentRange(creds, documentId, startIndex, endIndex) {
  return docsFetch(creds, `${DOCS_BASE}/${documentId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          deleteContentRange: {
            range: { startIndex, endIndex },
          },
        },
      ],
    }),
  });
}
