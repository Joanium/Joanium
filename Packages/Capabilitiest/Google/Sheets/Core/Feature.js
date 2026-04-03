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
            icon: '📊',
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
      async getSpreadsheetInfo(ctx, { spreadsheetId }) {
        return withGoogle(ctx, async credentials => {
          if (!spreadsheetId) return { ok: false, error: 'spreadsheetId is required' };
          return { ok: true, info: await SheetsAPI.getSpreadsheetInfo(credentials, spreadsheetId) };
        });
      },

      async listSheets(ctx, { spreadsheetId }) {
        return withGoogle(ctx, async credentials => {
          if (!spreadsheetId) return { ok: false, error: 'spreadsheetId is required' };
          return { ok: true, sheets: await SheetsAPI.listSheets(credentials, spreadsheetId) };
        });
      },

      async readRange(ctx, { spreadsheetId, range }) {
        return withGoogle(ctx, async credentials => {
          if (!spreadsheetId || !range) return { ok: false, error: 'spreadsheetId and range are required' };
          return { ok: true, ...(await SheetsAPI.readRange(credentials, spreadsheetId, range)) };
        });
      },

      async writeRange(ctx, { spreadsheetId, range, values }) {
        return withGoogle(ctx, async credentials => {
          if (!spreadsheetId || !range || !values) return { ok: false, error: 'spreadsheetId, range, and values are required' };
          return { ok: true, result: await SheetsAPI.writeRange(credentials, spreadsheetId, range, values) };
        });
      },

      async appendValues(ctx, { spreadsheetId, range, values }) {
        return withGoogle(ctx, async credentials => {
          if (!spreadsheetId || !range || !values) return { ok: false, error: 'spreadsheetId, range, and values are required' };
          return { ok: true, result: await SheetsAPI.appendValues(credentials, spreadsheetId, range, values) };
        });
      },

      async clearRange(ctx, { spreadsheetId, range }) {
        return withGoogle(ctx, async credentials => {
          if (!spreadsheetId || !range) return { ok: false, error: 'spreadsheetId and range are required' };
          return { ok: true, result: await SheetsAPI.clearRange(credentials, spreadsheetId, range) };
        });
      },

      async createSpreadsheet(ctx, { title, sheetTitles = [] }) {
        return withGoogle(ctx, async credentials => {
          if (!title) return { ok: false, error: 'title is required' };
          return { ok: true, spreadsheet: await SheetsAPI.createSpreadsheet(credentials, title, sheetTitles) };
        });
      },

      async addSheet(ctx, { spreadsheetId, title }) {
        return withGoogle(ctx, async credentials => {
          if (!spreadsheetId || !title) return { ok: false, error: 'spreadsheetId and title are required' };
          return { ok: true, sheet: await SheetsAPI.addSheet(credentials, spreadsheetId, title) };
        });
      },

      async executeChatTool(ctx, { toolName, params }) {
        return executeSheetsChatTool(ctx, toolName, params);
      },
    },
  },
  renderer: {
    chatTools: SHEETS_TOOLS,
  },
});
