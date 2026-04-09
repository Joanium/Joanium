async function getFreshGoogleCreds(creds) {
  const { getFreshCreds } = await import('../../../GoogleWorkspace.js');
  return getFreshCreds(creds);
}

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

async function sheetsFetch(creds, url, options = {}) {
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
      `Sheets API error (${res.status}): ${body.error?.message ?? JSON.stringify(body)}`,
    );
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function getSpreadsheetInfo(creds, spreadsheetId) {
  return sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}?includeGridData=false`);
}

export async function listSheets(creds, spreadsheetId) {
  const info = await getSpreadsheetInfo(creds, spreadsheetId);
  return (info.sheets ?? []).map((s) => ({
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
  ranges.forEach((r) => params.append('ranges', r));
  const data = await sheetsFetch(
    creds,
    `${SHEETS_BASE}/${spreadsheetId}/values:batchGet?${params}`,
  );
  return data.valueRanges ?? [];
}

export async function writeRange(
  creds,
  spreadsheetId,
  range,
  values,
  { valueInputOption = 'USER_ENTERED' } = {},
) {
  const encoded = encodeURIComponent(range);
  const data = await sheetsFetch(
    creds,
    `${SHEETS_BASE}/${spreadsheetId}/values/${encoded}?valueInputOption=${valueInputOption}`,
    {
      method: 'PUT',
      body: JSON.stringify({ range, majorDimension: 'ROWS', values }),
    },
  );
  return data;
}

export async function appendValues(
  creds,
  spreadsheetId,
  range,
  values,
  { valueInputOption = 'USER_ENTERED' } = {},
) {
  const encoded = encodeURIComponent(range);
  const data = await sheetsFetch(
    creds,
    `${SHEETS_BASE}/${spreadsheetId}/values/${encoded}:append?valueInputOption=${valueInputOption}&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      body: JSON.stringify({ majorDimension: 'ROWS', values }),
    },
  );
  return data;
}

export async function clearRange(creds, spreadsheetId, range) {
  const encoded = encodeURIComponent(range);
  return sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}/values/${encoded}:clear`, {
    method: 'POST',
  });
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
      requests: [
        {
          updateSheetProperties: {
            properties: { sheetId, title: newTitle },
            fields: 'title',
          },
        },
      ],
    }),
  });
  return true;
}

export async function batchWriteRanges(
  creds,
  spreadsheetId,
  data = [],
  { valueInputOption = 'USER_ENTERED' } = {},
) {
  // data: [{ range, values }]
  return sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ valueInputOption, data }),
  });
}

export async function batchClearRanges(creds, spreadsheetId, ranges = []) {
  return sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}/values:batchClear`, {
    method: 'POST',
    body: JSON.stringify({ ranges }),
  });
}

export async function getFormulas(creds, spreadsheetId, range) {
  const encoded = encodeURIComponent(range);
  const data = await sheetsFetch(
    creds,
    `${SHEETS_BASE}/${spreadsheetId}/values/${encoded}?valueRenderOption=FORMULA`,
  );
  return { range: data.range, values: data.values ?? [] };
}

export async function copySheet(creds, spreadsheetId, sheetId, destinationSpreadsheetId) {
  return sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}/sheets/${sheetId}:copyTo`, {
    method: 'POST',
    body: JSON.stringify({ destinationSpreadsheetId }),
  });
}

export async function duplicateSheet(
  creds,
  spreadsheetId,
  sheetId,
  { newSheetName, insertSheetIndex } = {},
) {
  const req = { sourceSheetId: sheetId };
  if (newSheetName != null) req.newSheetName = newSheetName;
  if (insertSheetIndex != null) req.insertSheetIndex = insertSheetIndex;
  const data = await sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests: [{ duplicateSheet: req }] }),
  });
  return data.replies?.[0]?.duplicateSheet?.properties ?? null;
}

export async function moveSheet(creds, spreadsheetId, sheetId, newIndex) {
  await sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          updateSheetProperties: {
            properties: { sheetId, index: newIndex },
            fields: 'index',
          },
        },
      ],
    }),
  });
  return true;
}

export async function insertDimension(
  creds,
  spreadsheetId,
  sheetId,
  dimension,
  startIndex,
  endIndex,
  inheritFromBefore = false,
) {
  await sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          insertDimension: {
            range: { sheetId, dimension, startIndex, endIndex },
            inheritFromBefore,
          },
        },
      ],
    }),
  });
  return true;
}

export async function deleteDimension(
  creds,
  spreadsheetId,
  sheetId,
  dimension,
  startIndex,
  endIndex,
) {
  await sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: { sheetId, dimension, startIndex, endIndex },
          },
        },
      ],
    }),
  });
  return true;
}

export async function autoResizeDimensions(
  creds,
  spreadsheetId,
  sheetId,
  dimension,
  startIndex,
  endIndex,
) {
  await sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          autoResizeDimensions: {
            dimensions: { sheetId, dimension, startIndex, endIndex },
          },
        },
      ],
    }),
  });
  return true;
}

export async function mergeCells(
  creds,
  spreadsheetId,
  sheetId,
  startRowIndex,
  endRowIndex,
  startColumnIndex,
  endColumnIndex,
  mergeType = 'MERGE_ALL',
) {
  await sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          mergeCells: {
            mergeType,
            range: { sheetId, startRowIndex, endRowIndex, startColumnIndex, endColumnIndex },
          },
        },
      ],
    }),
  });
  return true;
}

export async function unmergeCells(
  creds,
  spreadsheetId,
  sheetId,
  startRowIndex,
  endRowIndex,
  startColumnIndex,
  endColumnIndex,
) {
  await sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          unmergeCells: {
            range: { sheetId, startRowIndex, endRowIndex, startColumnIndex, endColumnIndex },
          },
        },
      ],
    }),
  });
  return true;
}

export async function freezeRowsColumns(
  creds,
  spreadsheetId,
  sheetId,
  frozenRowCount = 0,
  frozenColumnCount = 0,
) {
  await sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          updateSheetProperties: {
            properties: { sheetId, gridProperties: { frozenRowCount, frozenColumnCount } },
            fields: 'gridProperties.frozenRowCount,gridProperties.frozenColumnCount',
          },
        },
      ],
    }),
  });
  return true;
}

export async function formatRange(
  creds,
  spreadsheetId,
  sheetId,
  startRowIndex,
  endRowIndex,
  startColumnIndex,
  endColumnIndex,
  format = {},
) {
  // format: { bold, italic, fontSize, foregroundColor: {red,green,blue}, backgroundColor: {red,green,blue}, horizontalAlignment }
  const userEnteredFormat = {};
  const fields = [];

  if (format.bold != null) {
    userEnteredFormat.textFormat = { ...(userEnteredFormat.textFormat ?? {}), bold: format.bold };
    fields.push('userEnteredFormat.textFormat.bold');
  }
  if (format.italic != null) {
    userEnteredFormat.textFormat = {
      ...(userEnteredFormat.textFormat ?? {}),
      italic: format.italic,
    };
    fields.push('userEnteredFormat.textFormat.italic');
  }
  if (format.fontSize != null) {
    userEnteredFormat.textFormat = {
      ...(userEnteredFormat.textFormat ?? {}),
      fontSize: format.fontSize,
    };
    fields.push('userEnteredFormat.textFormat.fontSize');
  }
  if (format.foregroundColor) {
    userEnteredFormat.textFormat = {
      ...(userEnteredFormat.textFormat ?? {}),
      foregroundColor: format.foregroundColor,
    };
    fields.push('userEnteredFormat.textFormat.foregroundColor');
  }
  if (format.backgroundColor) {
    userEnteredFormat.backgroundColor = format.backgroundColor;
    fields.push('userEnteredFormat.backgroundColor');
  }
  if (format.horizontalAlignment) {
    userEnteredFormat.horizontalAlignment = format.horizontalAlignment;
    fields.push('userEnteredFormat.horizontalAlignment');
  }

  await sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          repeatCell: {
            range: { sheetId, startRowIndex, endRowIndex, startColumnIndex, endColumnIndex },
            cell: { userEnteredFormat },
            fields: fields.join(','),
          },
        },
      ],
    }),
  });
  return true;
}

export async function sortRange(
  creds,
  spreadsheetId,
  sheetId,
  startRowIndex,
  endRowIndex,
  startColumnIndex,
  endColumnIndex,
  sortSpecs = [],
) {
  // sortSpecs: [{ dimensionIndex, sortOrder: 'ASCENDING'|'DESCENDING' }]
  await sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          sortRange: {
            range: { sheetId, startRowIndex, endRowIndex, startColumnIndex, endColumnIndex },
            sortSpecs,
          },
        },
      ],
    }),
  });
  return true;
}

export async function listNamedRanges(creds, spreadsheetId) {
  const info = await getSpreadsheetInfo(creds, spreadsheetId);
  return (info.namedRanges ?? []).map((nr) => ({
    namedRangeId: nr.namedRangeId,
    name: nr.name,
    range: nr.range,
  }));
}

export async function addNamedRange(
  creds,
  spreadsheetId,
  name,
  sheetId,
  startRowIndex,
  endRowIndex,
  startColumnIndex,
  endColumnIndex,
) {
  const data = await sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          addNamedRange: {
            namedRange: {
              name,
              range: { sheetId, startRowIndex, endRowIndex, startColumnIndex, endColumnIndex },
            },
          },
        },
      ],
    }),
  });
  return data.replies?.[0]?.addNamedRange?.namedRange ?? null;
}

export async function deleteNamedRange(creds, spreadsheetId, namedRangeId) {
  await sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteNamedRange: { namedRangeId } }] }),
  });
  return true;
}

export async function findReplace(
  creds,
  spreadsheetId,
  find,
  replacement,
  { sheetId, matchCase = false, matchEntireCell = false, searchByRegex = false } = {},
) {
  const req = { find, replacement, matchCase, matchEntireCell, searchByRegex };
  if (sheetId != null) req.sheetId = sheetId;
  else req.allSheets = true;
  const data = await sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests: [{ findReplace: req }] }),
  });
  return data.replies?.[0]?.findReplace ?? {};
}

export async function protectRange(
  creds,
  spreadsheetId,
  sheetId,
  {
    startRowIndex,
    endRowIndex,
    startColumnIndex,
    endColumnIndex,
    description = '',
    warningOnly = true,
  } = {},
) {
  const range =
    endRowIndex != null
      ? { sheetId, startRowIndex, endRowIndex, startColumnIndex, endColumnIndex }
      : { sheetId };
  const data = await sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          addProtectedRange: {
            protectedRange: { range, description, warningOnly },
          },
        },
      ],
    }),
  });
  return data.replies?.[0]?.addProtectedRange?.protectedRange ?? null;
}
