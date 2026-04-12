const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
async function sheetsFetch(creds, url, options = {}) {
  const fresh = await (async function (creds) {
      const { getFreshCreds: getFreshCreds } = await import('../../../GoogleWorkspace.js');
      return getFreshCreds(creds);
    })(creds),
    res = await fetch(url, {
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
  return 204 === res.status ? null : res.json();
}
export async function getSpreadsheetInfo(creds, spreadsheetId) {
  return sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}?includeGridData=false`);
}
export async function listSheets(creds, spreadsheetId) {
  return ((await getSpreadsheetInfo(creds, spreadsheetId)).sheets ?? []).map((s) => ({
    sheetId: s.properties?.sheetId,
    title: s.properties?.title,
    index: s.properties?.index,
    rowCount: s.properties?.gridProperties?.rowCount,
    columnCount: s.properties?.gridProperties?.columnCount,
  }));
}
export async function readRange(creds, spreadsheetId, range) {
  const encoded = encodeURIComponent(range),
    data = await sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}/values/${encoded}`);
  return { range: data.range, values: data.values ?? [], majorDimension: data.majorDimension };
}
export async function readMultipleRanges(creds, spreadsheetId, ranges = []) {
  const params = new URLSearchParams();
  return (
    ranges.forEach((r) => params.append('ranges', r)),
    (await sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}/values:batchGet?${params}`))
      .valueRanges ?? []
  );
}
export async function writeRange(
  creds,
  spreadsheetId,
  range,
  values,
  { valueInputOption: valueInputOption = 'USER_ENTERED' } = {},
) {
  const encoded = encodeURIComponent(range);
  return await sheetsFetch(
    creds,
    `${SHEETS_BASE}/${spreadsheetId}/values/${encoded}?valueInputOption=${valueInputOption}`,
    {
      method: 'PUT',
      body: JSON.stringify({ range: range, majorDimension: 'ROWS', values: values }),
    },
  );
}
export async function appendValues(
  creds,
  spreadsheetId,
  range,
  values,
  { valueInputOption: valueInputOption = 'USER_ENTERED' } = {},
) {
  const encoded = encodeURIComponent(range);
  return await sheetsFetch(
    creds,
    `${SHEETS_BASE}/${spreadsheetId}/values/${encoded}:append?valueInputOption=${valueInputOption}&insertDataOption=INSERT_ROWS`,
    { method: 'POST', body: JSON.stringify({ majorDimension: 'ROWS', values: values }) },
  );
}
export async function clearRange(creds, spreadsheetId, range) {
  const encoded = encodeURIComponent(range);
  return sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}/values/${encoded}:clear`, {
    method: 'POST',
  });
}
export async function createSpreadsheet(creds, title, sheetTitles = []) {
  const body = { properties: { title: title } };
  return (
    sheetTitles.length &&
      (body.sheets = sheetTitles.map((t, i) => ({ properties: { title: t, index: i } }))),
    sheetsFetch(creds, SHEETS_BASE, { method: 'POST', body: JSON.stringify(body) })
  );
}
export async function addSheet(creds, spreadsheetId, title) {
  const data = await sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: title } } }] }),
  });
  return data.replies?.[0]?.addSheet?.properties ?? null;
}
export async function deleteSheet(creds, spreadsheetId, sheetId) {
  return (
    await sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ requests: [{ deleteSheet: { sheetId: sheetId } }] }),
    }),
    !0
  );
}
export async function renameSheet(creds, spreadsheetId, sheetId, newTitle) {
  return (
    await sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            updateSheetProperties: {
              properties: { sheetId: sheetId, title: newTitle },
              fields: 'title',
            },
          },
        ],
      }),
    }),
    !0
  );
}
export async function batchWriteRanges(
  creds,
  spreadsheetId,
  data = [],
  { valueInputOption: valueInputOption = 'USER_ENTERED' } = {},
) {
  return sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ valueInputOption: valueInputOption, data: data }),
  });
}
export async function batchClearRanges(creds, spreadsheetId, ranges = []) {
  return sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}/values:batchClear`, {
    method: 'POST',
    body: JSON.stringify({ ranges: ranges }),
  });
}
export async function getFormulas(creds, spreadsheetId, range) {
  const encoded = encodeURIComponent(range),
    data = await sheetsFetch(
      creds,
      `${SHEETS_BASE}/${spreadsheetId}/values/${encoded}?valueRenderOption=FORMULA`,
    );
  return { range: data.range, values: data.values ?? [] };
}
export async function copySheet(creds, spreadsheetId, sheetId, destinationSpreadsheetId) {
  return sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}/sheets/${sheetId}:copyTo`, {
    method: 'POST',
    body: JSON.stringify({ destinationSpreadsheetId: destinationSpreadsheetId }),
  });
}
export async function duplicateSheet(
  creds,
  spreadsheetId,
  sheetId,
  { newSheetName: newSheetName, insertSheetIndex: insertSheetIndex } = {},
) {
  const req = { sourceSheetId: sheetId };
  (null != newSheetName && (req.newSheetName = newSheetName),
    null != insertSheetIndex && (req.insertSheetIndex = insertSheetIndex));
  const data = await sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests: [{ duplicateSheet: req }] }),
  });
  return data.replies?.[0]?.duplicateSheet?.properties ?? null;
}
export async function moveSheet(creds, spreadsheetId, sheetId, newIndex) {
  return (
    await sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            updateSheetProperties: {
              properties: { sheetId: sheetId, index: newIndex },
              fields: 'index',
            },
          },
        ],
      }),
    }),
    !0
  );
}
export async function insertDimension(
  creds,
  spreadsheetId,
  sheetId,
  dimension,
  startIndex,
  endIndex,
  inheritFromBefore = !1,
) {
  return (
    await sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            insertDimension: {
              range: {
                sheetId: sheetId,
                dimension: dimension,
                startIndex: startIndex,
                endIndex: endIndex,
              },
              inheritFromBefore: inheritFromBefore,
            },
          },
        ],
      }),
    }),
    !0
  );
}
export async function deleteDimension(
  creds,
  spreadsheetId,
  sheetId,
  dimension,
  startIndex,
  endIndex,
) {
  return (
    await sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: dimension,
                startIndex: startIndex,
                endIndex: endIndex,
              },
            },
          },
        ],
      }),
    }),
    !0
  );
}
export async function autoResizeDimensions(
  creds,
  spreadsheetId,
  sheetId,
  dimension,
  startIndex,
  endIndex,
) {
  return (
    await sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: sheetId,
                dimension: dimension,
                startIndex: startIndex,
                endIndex: endIndex,
              },
            },
          },
        ],
      }),
    }),
    !0
  );
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
  return (
    await sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            mergeCells: {
              mergeType: mergeType,
              range: {
                sheetId: sheetId,
                startRowIndex: startRowIndex,
                endRowIndex: endRowIndex,
                startColumnIndex: startColumnIndex,
                endColumnIndex: endColumnIndex,
              },
            },
          },
        ],
      }),
    }),
    !0
  );
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
  return (
    await sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            unmergeCells: {
              range: {
                sheetId: sheetId,
                startRowIndex: startRowIndex,
                endRowIndex: endRowIndex,
                startColumnIndex: startColumnIndex,
                endColumnIndex: endColumnIndex,
              },
            },
          },
        ],
      }),
    }),
    !0
  );
}
export async function freezeRowsColumns(
  creds,
  spreadsheetId,
  sheetId,
  frozenRowCount = 0,
  frozenColumnCount = 0,
) {
  return (
    await sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId: sheetId,
                gridProperties: {
                  frozenRowCount: frozenRowCount,
                  frozenColumnCount: frozenColumnCount,
                },
              },
              fields: 'gridProperties.frozenRowCount,gridProperties.frozenColumnCount',
            },
          },
        ],
      }),
    }),
    !0
  );
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
  const userEnteredFormat = {},
    fields = [];
  return (
    null != format.bold &&
      ((userEnteredFormat.textFormat = {
        ...(userEnteredFormat.textFormat ?? {}),
        bold: format.bold,
      }),
      fields.push('userEnteredFormat.textFormat.bold')),
    null != format.italic &&
      ((userEnteredFormat.textFormat = {
        ...(userEnteredFormat.textFormat ?? {}),
        italic: format.italic,
      }),
      fields.push('userEnteredFormat.textFormat.italic')),
    null != format.fontSize &&
      ((userEnteredFormat.textFormat = {
        ...(userEnteredFormat.textFormat ?? {}),
        fontSize: format.fontSize,
      }),
      fields.push('userEnteredFormat.textFormat.fontSize')),
    format.foregroundColor &&
      ((userEnteredFormat.textFormat = {
        ...(userEnteredFormat.textFormat ?? {}),
        foregroundColor: format.foregroundColor,
      }),
      fields.push('userEnteredFormat.textFormat.foregroundColor')),
    format.backgroundColor &&
      ((userEnteredFormat.backgroundColor = format.backgroundColor),
      fields.push('userEnteredFormat.backgroundColor')),
    format.horizontalAlignment &&
      ((userEnteredFormat.horizontalAlignment = format.horizontalAlignment),
      fields.push('userEnteredFormat.horizontalAlignment')),
    await sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: startRowIndex,
                endRowIndex: endRowIndex,
                startColumnIndex: startColumnIndex,
                endColumnIndex: endColumnIndex,
              },
              cell: { userEnteredFormat: userEnteredFormat },
              fields: fields.join(','),
            },
          },
        ],
      }),
    }),
    !0
  );
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
  return (
    await sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            sortRange: {
              range: {
                sheetId: sheetId,
                startRowIndex: startRowIndex,
                endRowIndex: endRowIndex,
                startColumnIndex: startColumnIndex,
                endColumnIndex: endColumnIndex,
              },
              sortSpecs: sortSpecs,
            },
          },
        ],
      }),
    }),
    !0
  );
}
export async function listNamedRanges(creds, spreadsheetId) {
  return ((await getSpreadsheetInfo(creds, spreadsheetId)).namedRanges ?? []).map((nr) => ({
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
              name: name,
              range: {
                sheetId: sheetId,
                startRowIndex: startRowIndex,
                endRowIndex: endRowIndex,
                startColumnIndex: startColumnIndex,
                endColumnIndex: endColumnIndex,
              },
            },
          },
        },
      ],
    }),
  });
  return data.replies?.[0]?.addNamedRange?.namedRange ?? null;
}
export async function deleteNamedRange(creds, spreadsheetId, namedRangeId) {
  return (
    await sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ requests: [{ deleteNamedRange: { namedRangeId: namedRangeId } }] }),
    }),
    !0
  );
}
export async function findReplace(
  creds,
  spreadsheetId,
  find,
  replacement,
  {
    sheetId: sheetId,
    matchCase: matchCase = !1,
    matchEntireCell: matchEntireCell = !1,
    searchByRegex: searchByRegex = !1,
  } = {},
) {
  const req = {
    find: find,
    replacement: replacement,
    matchCase: matchCase,
    matchEntireCell: matchEntireCell,
    searchByRegex: searchByRegex,
  };
  null != sheetId ? (req.sheetId = sheetId) : (req.allSheets = !0);
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
    startRowIndex: startRowIndex,
    endRowIndex: endRowIndex,
    startColumnIndex: startColumnIndex,
    endColumnIndex: endColumnIndex,
    description: description = '',
    warningOnly: warningOnly = !0,
  } = {},
) {
  const range =
      null != endRowIndex
        ? {
            sheetId: sheetId,
            startRowIndex: startRowIndex,
            endRowIndex: endRowIndex,
            startColumnIndex: startColumnIndex,
            endColumnIndex: endColumnIndex,
          }
        : { sheetId: sheetId },
    data = await sheetsFetch(creds, `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            addProtectedRange: {
              protectedRange: { range: range, description: description, warningOnly: warningOnly },
            },
          },
        ],
      }),
    });
  return data.replies?.[0]?.addProtectedRange?.protectedRange ?? null;
}
