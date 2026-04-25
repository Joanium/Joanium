import { createGoogleJsonFetch } from '../../../Core/API/GoogleApiFetch.js';

const DOCS_BASE = 'https://docs.googleapis.com/v1/documents';
const docsFetch = createGoogleJsonFetch('Docs');
export async function getDocument(creds, documentId) {
  return docsFetch(creds, `${DOCS_BASE}/${documentId}`);
}
export function extractText(doc) {
  const chunks = [];
  !(function walkContent(content = []) {
    for (const element of content)
      if (element.paragraph) {
        const line = (element.paragraph.elements ?? [])
          .map((el) => el.textRun?.content ?? '')
          .join('');
        line.trim() && chunks.push(line);
      } else if (element.table)
        for (const row of element.table.tableRows ?? [])
          for (const cell of row.tableCells ?? []) walkContent(cell.content ?? []);
      else element.sectionBreak && chunks.push('\n');
  })(doc.body?.content ?? []);
  const full = chunks.join('');
  return { text: full.slice(0, 3e4), truncated: full.length > 3e4 };
}
export function extractOutline(doc) {
  const headings = [];
  for (const element of doc.body?.content ?? []) {
    if (!element.paragraph) continue;
    const style = element.paragraph.paragraphStyle?.namedStyleType ?? '';
    if (!style.startsWith('HEADING_')) continue;
    const text = (element.paragraph.elements ?? [])
      .map((el) => el.textRun?.content ?? '')
      .join('')
      .replace(/\n$/, '');
    text &&
      headings.push({
        level: parseInt(style.replace('HEADING_', ''), 10),
        text: text,
        startIndex: element.startIndex,
        endIndex: element.endIndex,
      });
  }
  return headings;
}
export function extractNamedRanges(doc) {
  return Object.entries(doc.namedRanges ?? {}).map(([name, nr]) => ({
    name: name,
    namedRangeId: nr.namedRanges?.[0]?.namedRangeId,
    ranges: nr.namedRanges?.flatMap((r) => r.ranges ?? []),
  }));
}
export async function createDocument(creds, title) {
  return docsFetch(creds, DOCS_BASE, { method: 'POST', body: JSON.stringify({ title: title }) });
}
export async function insertText(creds, documentId, text, index = 1) {
  return docsFetch(creds, `${DOCS_BASE}/${documentId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [{ insertText: { location: { index: index }, text: text } }],
    }),
  });
}
export async function appendText(creds, documentId, text) {
  const doc = await getDocument(creds, documentId),
    lastEl = (doc.body?.content ?? []).at(-1),
    endIndex = lastEl?.endIndex ?? 1;
  return insertText(creds, documentId, '\n' + text, Math.max(1, endIndex - 1));
}
export async function batchInsertText(creds, documentId, insertions) {
  const sorted = [...insertions].sort((a, b) => b.index - a.index);
  return docsFetch(creds, `${DOCS_BASE}/${documentId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: sorted.map(({ index: index, text: text }) => ({
        insertText: { location: { index: index }, text: text },
      })),
    }),
  });
}
export async function replaceAllText(creds, documentId, searchText, replacement) {
  return docsFetch(creds, `${DOCS_BASE}/${documentId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          replaceAllText: {
            containsText: { text: searchText, matchCase: !0 },
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
      requests: [{ deleteContentRange: { range: { startIndex: startIndex, endIndex: endIndex } } }],
    }),
  });
}
export async function applyTextStyle(creds, documentId, startIndex, endIndex, textStyle) {
  const fields = Object.keys(textStyle).join(',');
  return docsFetch(creds, `${DOCS_BASE}/${documentId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          updateTextStyle: {
            range: { startIndex: startIndex, endIndex: endIndex },
            textStyle: textStyle,
            fields: fields,
          },
        },
      ],
    }),
  });
}
export async function applyParagraphStyle(creds, documentId, startIndex, endIndex, paragraphStyle) {
  const fields = Object.keys(paragraphStyle).join(',');
  return docsFetch(creds, `${DOCS_BASE}/${documentId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          updateParagraphStyle: {
            range: { startIndex: startIndex, endIndex: endIndex },
            paragraphStyle: paragraphStyle,
            fields: fields,
          },
        },
      ],
    }),
  });
}
export async function createBulletList(
  creds,
  documentId,
  startIndex,
  endIndex,
  bulletPreset = 'BULLET_DISC_CIRCLE_SQUARE',
) {
  return docsFetch(creds, `${DOCS_BASE}/${documentId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          createParagraphBullets: {
            range: { startIndex: startIndex, endIndex: endIndex },
            bulletPreset: bulletPreset,
          },
        },
      ],
    }),
  });
}
export async function removeBulletList(creds, documentId, startIndex, endIndex) {
  return docsFetch(creds, `${DOCS_BASE}/${documentId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        { deleteParagraphBullets: { range: { startIndex: startIndex, endIndex: endIndex } } },
      ],
    }),
  });
}
export async function insertTable(creds, documentId, rows, columns, index) {
  return docsFetch(creds, `${DOCS_BASE}/${documentId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [{ insertTable: { rows: rows, columns: columns, location: { index: index } } }],
    }),
  });
}
export async function insertPageBreak(creds, documentId, index) {
  return docsFetch(creds, `${DOCS_BASE}/${documentId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests: [{ insertPageBreak: { location: { index: index } } }] }),
  });
}
export async function insertInlineImage(creds, documentId, imageUri, index, widthPt, heightPt) {
  const objectSize = {};
  return (
    null != widthPt && (objectSize.width = { magnitude: widthPt, unit: 'PT' }),
    null != heightPt && (objectSize.height = { magnitude: heightPt, unit: 'PT' }),
    docsFetch(creds, `${DOCS_BASE}/${documentId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            insertInlineImage: {
              uri: imageUri,
              location: { index: index },
              ...(Object.keys(objectSize).length ? { objectSize: objectSize } : {}),
            },
          },
        ],
      }),
    })
  );
}
export async function createNamedRange(creds, documentId, name, startIndex, endIndex) {
  return docsFetch(creds, `${DOCS_BASE}/${documentId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        { createNamedRange: { name: name, range: { startIndex: startIndex, endIndex: endIndex } } },
      ],
    }),
  });
}
export async function deleteNamedRange(creds, documentId, name) {
  return docsFetch(creds, `${DOCS_BASE}/${documentId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteNamedRange: { name: name } }] }),
  });
}
export async function updateDocumentStyle(creds, documentId, documentStyle, fields) {
  return docsFetch(creds, `${DOCS_BASE}/${documentId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [{ updateDocumentStyle: { documentStyle: documentStyle, fields: fields } }],
    }),
  });
}
