import { getFreshCreds } from '../../../GoogleWorkspace.js';

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

async function sheetsFetch(creds, url, options = {}) {
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
    throw new Error(`Sheets API error (${res.status}): ${body.error?.message ?? JSON.stringify(body)}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function getSpreadsheetInfo(creds, spreadsheetId) {
  return sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}?includeGridData=false`);
}

export async function listSheets(creds, spreadsheetId) {
  const info = await getSpreadsheetInfo(creds, spreadsheetId);
  return (info.sheets ?? []).map(s => ({
    sheetId: s.properties?.sheetId,
    title: s.properties?.title,
    index: s.properties?.index,
    rowCount: s.properties?.gridProperties?.rowCount,
    columnCount: s.properties?.gridProperties?.columnCount,
  }));
}

export async function readRange(creds, spreadsheetId, range) {
  const encoded = encodeURIComponent(range);
  const data = await sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}/values/${encoded}`);
  return {
    range: data.range,
    values: data.values ?? [],
    majorDimension: data.majorDimension,
  };
}

export async function readMultipleRanges(creds, spreadsheetId, ranges = []) {
  const params = new URLSearchParams();
  ranges.forEach(r => params.append('ranges', r));
  const data = await sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}/values:batchGet?${params}`);
  return data.valueRanges ?? [];
}

export async function writeRange(creds, spreadsheetId, range, values, { valueInputOption = 'USER_ENTERED' } = {}) {
  const encoded = encodeURIComponent(range);
  const data = await sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}/values/${encoded}?valueInputOption=${valueInputOption}`, {
    method: 'PUT',
    body: JSON.stringify({ range, majorDimension: 'ROWS', values }),
  });
  return data;
}

export async function appendValues(creds, spreadsheetId, range, values, { valueInputOption = 'USER_ENTERED' } = {}) {
  const encoded = encodeURIComponent(range);
  const data = await sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}/values/${encoded}:append?valueInputOption=${valueInputOption}&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    body: JSON.stringify({ majorDimension: 'ROWS', values }),
  });
  return data;
}

export async function clearRange(creds, spreadsheetId, range) {
  const encoded = encodeURIComponent(range);
  return sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}/values/${encoded}:clear`, { method: 'POST' });
}

export async function createSpreadsheet(creds, title, sheetTitles = []) {
  const body = { properties: { title } };
  if (sheetTitles.length) {
    body.sheets = sheetTitles.map((t, i) => ({ properties: { title: t, index: i } }));
  }
  return sheetsFetch(creds, SHEETS_BASE, { method: 'POST', body: JSON.stringify(body) });
}

export async function addSheet(creds, spreadsheetId, title) {
  const data = await sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title } } }],
    }),
  });
  return data.replies?.[0]?.addSheet?.properties ?? null;
}

export async function deleteSheet(creds, spreadsheetId, sheetId) {
  await sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteSheet: { sheetId } }] }),
  });
  return true;
}

export async function renameSheet(creds, spreadsheetId, sheetId, newTitle) {
  await sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [{
        updateSheetProperties: {
          properties: { sheetId, title: newTitle },
          fields: 'title',
        },
      }],
    }),
  });
  return true;
}
