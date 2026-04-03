import * as SheetsAPI from '../API/SheetsAPI.js';
import { requireGoogleCredentials } from '../../../Common.js';

function parseValues(raw) {
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('Values must be a 2D array');
    return parsed;
  } catch {
    throw new Error('values must be a valid JSON 2D array, e.g. [["Name","Age"],["Alice",30]]');
  }
}

function renderTable(values) {
  if (!values.length) return '(empty)';
  const rows = values.map(row => (Array.isArray(row) ? row : []).map(cell => String(cell ?? '')));
  const colWidths = rows.reduce((widths, row) => {
    row.forEach((cell, i) => { widths[i] = Math.min(Math.max(widths[i] ?? 0, cell.length), 30); });
    return widths;
  }, []);
  return rows.map(row =>
    row.map((cell, i) => cell.slice(0, 30).padEnd(colWidths[i] ?? 0)).join(' | ')
  ).join('\n');
}

export async function executeSheetsChatTool(ctx, toolName, params = {}) {
  const credentials = requireGoogleCredentials(ctx);

  switch (toolName) {
    case 'sheets_get_info': {
      const { spreadsheet_id } = params;
      if (!spreadsheet_id?.trim()) throw new Error('Missing required param: spreadsheet_id');
      const info = await SheetsAPI.getSpreadsheetInfo(credentials, spreadsheet_id.trim());
      const sheets = (info.sheets ?? []).map((s, i) => {
        const p = s.properties ?? {};
        return `${i + 1}. **${p.title ?? '(Untitled)'}** — ${p.gridProperties?.rowCount ?? '?'} rows × ${p.gridProperties?.columnCount ?? '?'} cols (Sheet ID: ${p.sheetId})`;
      });
      return [
        `**${info.properties?.title ?? 'Untitled Spreadsheet'}**`,
        `Spreadsheet ID: \`${info.spreadsheetId}\``,
        info.spreadsheetUrl ? `Link: ${info.spreadsheetUrl}` : '',
        '',
        `Sheets (${sheets.length}):`,
        ...sheets,
      ].filter(v => v !== null && v !== undefined).join('\n');
    }

    case 'sheets_list_sheets': {
      const { spreadsheet_id } = params;
      if (!spreadsheet_id?.trim()) throw new Error('Missing required param: spreadsheet_id');
      const sheets = await SheetsAPI.listSheets(credentials, spreadsheet_id.trim());
      if (!sheets.length) return 'No sheets found.';
      const lines = sheets.map((s, i) => `${i + 1}. **${s.title ?? '(Untitled)'}** — ID: ${s.sheetId} · ${s.rowCount} rows × ${s.columnCount} cols`);
      return `Sheets (${sheets.length}):\n\n${lines.join('\n')}`;
    }

    case 'sheets_read_range': {
      const { spreadsheet_id, range } = params;
      if (!spreadsheet_id?.trim()) throw new Error('Missing required param: spreadsheet_id');
      if (!range?.trim()) throw new Error('Missing required param: range');
      const result = await SheetsAPI.readRange(credentials, spreadsheet_id.trim(), range.trim());
      if (!result.values.length) return `Range \`${range}\` is empty.`;
      const rowCount = result.values.length;
      const colCount = Math.max(...result.values.map(r => r.length));
      return [
        `Range: \`${result.range}\` — ${rowCount} row${rowCount !== 1 ? 's' : ''} × ${colCount} col${colCount !== 1 ? 's' : ''}`,
        '',
        '```',
        renderTable(result.values),
        '```',
      ].join('\n');
    }

    case 'sheets_write_range': {
      const { spreadsheet_id, range, values: rawValues } = params;
      if (!spreadsheet_id?.trim()) throw new Error('Missing required param: spreadsheet_id');
      if (!range?.trim()) throw new Error('Missing required param: range');
      if (rawValues == null) throw new Error('Missing required param: values');
      const values = parseValues(rawValues);
      const result = await SheetsAPI.writeRange(credentials, spreadsheet_id.trim(), range.trim(), values);
      return [
        'Range updated',
        `Updated range: \`${result.updatedRange}\``,
        `Rows updated: ${result.updatedRows}`,
        `Columns updated: ${result.updatedColumns}`,
        `Cells updated: ${result.updatedCells}`,
      ].join('\n');
    }

    case 'sheets_append_values': {
      const { spreadsheet_id, range, values: rawValues } = params;
      if (!spreadsheet_id?.trim()) throw new Error('Missing required param: spreadsheet_id');
      if (!range?.trim()) throw new Error('Missing required param: range');
      if (rawValues == null) throw new Error('Missing required param: values');
      const values = parseValues(rawValues);
      const result = await SheetsAPI.appendValues(credentials, spreadsheet_id.trim(), range.trim(), values);
      const updates = result.updates ?? {};
      return [
        'Rows appended',
        updates.updatedRange ? `Appended to: \`${updates.updatedRange}\`` : '',
        updates.updatedRows ? `Rows added: ${updates.updatedRows}` : '',
        updates.updatedCells ? `Cells updated: ${updates.updatedCells}` : '',
      ].filter(Boolean).join('\n');
    }

    case 'sheets_clear_range': {
      const { spreadsheet_id, range } = params;
      if (!spreadsheet_id?.trim()) throw new Error('Missing required param: spreadsheet_id');
      if (!range?.trim()) throw new Error('Missing required param: range');
      const result = await SheetsAPI.clearRange(credentials, spreadsheet_id.trim(), range.trim());
      return `Range \`${result.clearedRange ?? range}\` cleared.`;
    }

    case 'sheets_create_spreadsheet': {
      const { title, sheet_titles } = params;
      if (!title?.trim()) throw new Error('Missing required param: title');
      const sheetTitles = sheet_titles ? String(sheet_titles).split(',').map(s => s.trim()).filter(Boolean) : [];
      const ss = await SheetsAPI.createSpreadsheet(credentials, title.trim(), sheetTitles);
      return [
        'Spreadsheet created',
        `Title: ${ss.properties?.title ?? title}`,
        `ID: \`${ss.spreadsheetId}\``,
        ss.spreadsheetUrl ? `Link: ${ss.spreadsheetUrl}` : '',
        sheetTitles.length ? `Sheets: ${sheetTitles.join(', ')}` : '',
      ].filter(Boolean).join('\n');
    }

    case 'sheets_add_sheet': {
      const { spreadsheet_id, title } = params;
      if (!spreadsheet_id?.trim()) throw new Error('Missing required param: spreadsheet_id');
      if (!title?.trim()) throw new Error('Missing required param: title');
      const sheet = await SheetsAPI.addSheet(credentials, spreadsheet_id.trim(), title.trim());
      return [
        `Sheet "${sheet?.title ?? title}" added`,
        sheet?.sheetId != null ? `Sheet ID: ${sheet.sheetId}` : '',
      ].filter(Boolean).join('\n');
    }

    case 'sheets_delete_sheet': {
      const { spreadsheet_id, sheet_id } = params;
      if (!spreadsheet_id?.trim()) throw new Error('Missing required param: spreadsheet_id');
      if (sheet_id == null) throw new Error('Missing required param: sheet_id');
      await SheetsAPI.deleteSheet(credentials, spreadsheet_id.trim(), Number(sheet_id));
      return `Sheet ID ${sheet_id} deleted from spreadsheet.`;
    }

    case 'sheets_rename_sheet': {
      const { spreadsheet_id, sheet_id, new_title } = params;
      if (!spreadsheet_id?.trim()) throw new Error('Missing required param: spreadsheet_id');
      if (sheet_id == null) throw new Error('Missing required param: sheet_id');
      if (!new_title?.trim()) throw new Error('Missing required param: new_title');
      await SheetsAPI.renameSheet(credentials, spreadsheet_id.trim(), Number(sheet_id), new_title.trim());
      return `Sheet ID ${sheet_id} renamed to "${new_title}".`;
    }

    default:
      throw new Error(`Unknown Sheets tool: ${toolName}`);
  }
}
