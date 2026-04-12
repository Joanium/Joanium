import defineFeature from '../../../Core/DefineFeature.js';
import * as SheetsAPI from './API/SheetsAPI.js';
import { SHEETS_TOOLS } from './Chat/Tools.js';
import { executeSheetsChatTool } from './Chat/ChatExecutor.js';
import { withGoogle } from '../../Common.js';
export default defineFeature({
  id: 'sheets',
  name: 'Google Sheets',
  dependsOn: ['google-workspace'],
  connectors: {
    serviceExtensions: [
      {
        target: 'google',
        subServices: [
          {
            key: 'sheets',
            icon: '<img src="../../../Assets/Icons/Sheets.png" alt="Google Sheets" style="width: 26px; height: 26px; object-fit: contain;" />',
            name: 'Google Sheets',
            apiUrl: 'https://console.cloud.google.com/apis/library/sheets.googleapis.com',
          },
        ],
        capabilities: [
          'Read and write Google Spreadsheet data',
          'Create spreadsheets and manage sheets',
        ],
      },
    ],
  },
  main: {
    methods: {
      getSpreadsheetInfo: async (ctx, { spreadsheetId: spreadsheetId }) =>
        withGoogle(ctx, async (credentials) =>
          spreadsheetId
            ? { ok: !0, info: await SheetsAPI.getSpreadsheetInfo(credentials, spreadsheetId) }
            : { ok: !1, error: 'spreadsheetId is required' },
        ),
      listSheets: async (ctx, { spreadsheetId: spreadsheetId }) =>
        withGoogle(ctx, async (credentials) =>
          spreadsheetId
            ? { ok: !0, sheets: await SheetsAPI.listSheets(credentials, spreadsheetId) }
            : { ok: !1, error: 'spreadsheetId is required' },
        ),
      readRange: async (ctx, { spreadsheetId: spreadsheetId, range: range }) =>
        withGoogle(ctx, async (credentials) =>
          spreadsheetId && range
            ? { ok: !0, ...(await SheetsAPI.readRange(credentials, spreadsheetId, range)) }
            : { ok: !1, error: 'spreadsheetId and range are required' },
        ),
      writeRange: async (ctx, { spreadsheetId: spreadsheetId, range: range, values: values }) =>
        withGoogle(ctx, async (credentials) =>
          spreadsheetId && range && values
            ? {
                ok: !0,
                result: await SheetsAPI.writeRange(credentials, spreadsheetId, range, values),
              }
            : { ok: !1, error: 'spreadsheetId, range, and values are required' },
        ),
      appendValues: async (ctx, { spreadsheetId: spreadsheetId, range: range, values: values }) =>
        withGoogle(ctx, async (credentials) =>
          spreadsheetId && range && values
            ? {
                ok: !0,
                result: await SheetsAPI.appendValues(credentials, spreadsheetId, range, values),
              }
            : { ok: !1, error: 'spreadsheetId, range, and values are required' },
        ),
      clearRange: async (ctx, { spreadsheetId: spreadsheetId, range: range }) =>
        withGoogle(ctx, async (credentials) =>
          spreadsheetId && range
            ? { ok: !0, result: await SheetsAPI.clearRange(credentials, spreadsheetId, range) }
            : { ok: !1, error: 'spreadsheetId and range are required' },
        ),
      createSpreadsheet: async (ctx, { title: title, sheetTitles: sheetTitles = [] }) =>
        withGoogle(ctx, async (credentials) =>
          title
            ? {
                ok: !0,
                spreadsheet: await SheetsAPI.createSpreadsheet(credentials, title, sheetTitles),
              }
            : { ok: !1, error: 'title is required' },
        ),
      addSheet: async (ctx, { spreadsheetId: spreadsheetId, title: title }) =>
        withGoogle(ctx, async (credentials) =>
          spreadsheetId && title
            ? { ok: !0, sheet: await SheetsAPI.addSheet(credentials, spreadsheetId, title) }
            : { ok: !1, error: 'spreadsheetId and title are required' },
        ),
      executeChatTool: async (ctx, { toolName: toolName, params: params }) =>
        executeSheetsChatTool(ctx, toolName, params),
    },
  },
  renderer: { chatTools: SHEETS_TOOLS },
});
