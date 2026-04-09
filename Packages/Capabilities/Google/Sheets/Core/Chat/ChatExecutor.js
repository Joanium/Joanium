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

function parseJSON(raw, label) {
  if (typeof raw === 'object' && raw !== null) return raw;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${label} must be valid JSON`);
  }
}

function renderTable(values) {
  if (!values.length) return '(empty)';
  const rows = values.map((row) =>
    (Array.isArray(row) ? row : []).map((cell) => String(cell ?? '')),
  );
  const colWidths = rows.reduce((widths, row) => {
    row.forEach((cell, i) => {
      widths[i] = Math.min(Math.max(widths[i] ?? 0, cell.length), 30);
    });
    return widths;
  }, []);
  return rows
    .map((row) => row.map((cell, i) => cell.slice(0, 30).padEnd(colWidths[i] ?? 0)).join(' | '))
    .join('\n');
}

function requireParam(params, key) {
  if (params[key] == null || (typeof params[key] === 'string' && !params[key].trim())) {
    throw new Error(`Missing required param: ${key}`);
  }
  return params[key];
}

function requireNumeric(params, key) {
  const v = requireParam(params, key);
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error(`Param ${key} must be a number`);
  return n;
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
      ]
        .filter((v) => v !== null && v !== undefined)
        .join('\n');
    }

    case 'sheets_list_sheets': {
      const { spreadsheet_id } = params;
      if (!spreadsheet_id?.trim()) throw new Error('Missing required param: spreadsheet_id');
      const sheets = await SheetsAPI.listSheets(credentials, spreadsheet_id.trim());
      if (!sheets.length) return 'No sheets found.';
      const lines = sheets.map(
        (s, i) =>
          `${i + 1}. **${s.title ?? '(Untitled)'}** — ID: ${s.sheetId} · ${s.rowCount} rows × ${s.columnCount} cols`,
      );
      return `Sheets (${sheets.length}):\n\n${lines.join('\n')}`;
    }

    case 'sheets_read_range': {
      const { spreadsheet_id, range } = params;
      if (!spreadsheet_id?.trim()) throw new Error('Missing required param: spreadsheet_id');
      if (!range?.trim()) throw new Error('Missing required param: range');
      const result = await SheetsAPI.readRange(credentials, spreadsheet_id.trim(), range.trim());
      if (!result.values.length) return `Range \`${range}\` is empty.`;
      const rowCount = result.values.length;
      const colCount = Math.max(...result.values.map((r) => r.length));
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
      const result = await SheetsAPI.writeRange(
        credentials,
        spreadsheet_id.trim(),
        range.trim(),
        values,
      );
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
      const result = await SheetsAPI.appendValues(
        credentials,
        spreadsheet_id.trim(),
        range.trim(),
        values,
      );
      const updates = result.updates ?? {};
      return [
        'Rows appended',
        updates.updatedRange ? `Appended to: \`${updates.updatedRange}\`` : '',
        updates.updatedRows ? `Rows added: ${updates.updatedRows}` : '',
        updates.updatedCells ? `Cells updated: ${updates.updatedCells}` : '',
      ]
        .filter(Boolean)
        .join('\n');
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
      const sheetTitles = sheet_titles
        ? String(sheet_titles)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
      const ss = await SheetsAPI.createSpreadsheet(credentials, title.trim(), sheetTitles);
      return [
        'Spreadsheet created',
        `Title: ${ss.properties?.title ?? title}`,
        `ID: \`${ss.spreadsheetId}\``,
        ss.spreadsheetUrl ? `Link: ${ss.spreadsheetUrl}` : '',
        sheetTitles.length ? `Sheets: ${sheetTitles.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'sheets_add_sheet': {
      const { spreadsheet_id, title } = params;
      if (!spreadsheet_id?.trim()) throw new Error('Missing required param: spreadsheet_id');
      if (!title?.trim()) throw new Error('Missing required param: title');
      const sheet = await SheetsAPI.addSheet(credentials, spreadsheet_id.trim(), title.trim());
      return [
        `Sheet "${sheet?.title ?? title}" added`,
        sheet?.sheetId != null ? `Sheet ID: ${sheet.sheetId}` : '',
      ]
        .filter(Boolean)
        .join('\n');
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
      await SheetsAPI.renameSheet(
        credentials,
        spreadsheet_id.trim(),
        Number(sheet_id),
        new_title.trim(),
      );
      return `Sheet ID ${sheet_id} renamed to "${new_title}".`;
    }

    case 'sheets_batch_write': {
      const sid = requireParam(params, 'spreadsheet_id').trim();
      const updates = parseJSON(requireParam(params, 'updates'), 'updates');
      if (!Array.isArray(updates))
        throw new Error('updates must be a JSON array of {range, values} objects');
      const result = await SheetsAPI.batchWriteRanges(credentials, sid, updates);
      const total = (result.responses ?? []).reduce((s, r) => s + (r.updatedCells ?? 0), 0);
      return [
        `Batch write complete`,
        `Ranges updated: ${result.totalUpdatedRanges ?? updates.length}`,
        `Total cells updated: ${(total || result.totalUpdatedCells) ?? '—'}`,
      ].join('\n');
    }

    case 'sheets_batch_clear': {
      const sid = requireParam(params, 'spreadsheet_id').trim();
      const ranges = String(requireParam(params, 'ranges'))
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean);
      const result = await SheetsAPI.batchClearRanges(credentials, sid, ranges);
      const cleared = (result.clearedRanges ?? ranges).join(', ');
      return `Cleared ${result.clearedRanges?.length ?? ranges.length} range(s): ${cleared}`;
    }

    case 'sheets_get_formulas': {
      const sid = requireParam(params, 'spreadsheet_id').trim();
      const range = requireParam(params, 'range').trim();
      const result = await SheetsAPI.getFormulas(credentials, sid, range);
      if (!result.values.length) return `Range \`${range}\` contains no formulas.`;
      const rowCount = result.values.length;
      const colCount = Math.max(...result.values.map((r) => r.length));
      return [
        `Formulas in \`${result.range}\` — ${rowCount} row${rowCount !== 1 ? 's' : ''} × ${colCount} col${colCount !== 1 ? 's' : ''}`,
        '',
        '```',
        renderTable(result.values),
        '```',
      ].join('\n');
    }

    case 'sheets_copy_sheet': {
      const sid = requireParam(params, 'spreadsheet_id').trim();
      const sheetId = requireNumeric(params, 'sheet_id');
      const destId = requireParam(params, 'destination_spreadsheet_id').trim();
      const props = await SheetsAPI.copySheet(credentials, sid, sheetId, destId);
      return [
        `Sheet copied successfully`,
        props?.title ? `New sheet name: "${props.title}"` : '',
        props?.sheetId != null ? `New sheet ID: ${props.sheetId}` : '',
        `Destination spreadsheet: \`${destId}\``,
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'sheets_duplicate_sheet': {
      const sid = requireParam(params, 'spreadsheet_id').trim();
      const sheetId = requireNumeric(params, 'sheet_id');
      const opts = {};
      if (params.new_sheet_name?.trim()) opts.newSheetName = params.new_sheet_name.trim();
      if (params.insert_sheet_index != null)
        opts.insertSheetIndex = Number(params.insert_sheet_index);
      const props = await SheetsAPI.duplicateSheet(credentials, sid, sheetId, opts);
      return [
        `Sheet duplicated`,
        props?.title ? `New sheet: "${props.title}"` : '',
        props?.sheetId != null ? `New sheet ID: ${props.sheetId}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'sheets_move_sheet': {
      const sid = requireParam(params, 'spreadsheet_id').trim();
      const sheetId = requireNumeric(params, 'sheet_id');
      const newIndex = requireNumeric(params, 'new_index');
      await SheetsAPI.moveSheet(credentials, sid, sheetId, newIndex);
      return `Sheet ID ${sheetId} moved to position ${newIndex}.`;
    }

    case 'sheets_insert_rows': {
      const sid = requireParam(params, 'spreadsheet_id').trim();
      const sheetId = requireNumeric(params, 'sheet_id');
      const startIndex = requireNumeric(params, 'start_index');
      const count = requireNumeric(params, 'count');
      const inherit = params.inherit_from_before === true || params.inherit_from_before === 'true';
      await SheetsAPI.insertDimension(
        credentials,
        sid,
        sheetId,
        'ROWS',
        startIndex,
        startIndex + count,
        inherit,
      );
      return `${count} row${count !== 1 ? 's' : ''} inserted at row index ${startIndex}.`;
    }

    case 'sheets_delete_rows': {
      const sid = requireParam(params, 'spreadsheet_id').trim();
      const sheetId = requireNumeric(params, 'sheet_id');
      const startIndex = requireNumeric(params, 'start_index');
      const endIndex = requireNumeric(params, 'end_index');
      await SheetsAPI.deleteDimension(credentials, sid, sheetId, 'ROWS', startIndex, endIndex);
      return `Rows ${startIndex}–${endIndex - 1} deleted (${endIndex - startIndex} row${endIndex - startIndex !== 1 ? 's' : ''}).`;
    }

    case 'sheets_insert_columns': {
      const sid = requireParam(params, 'spreadsheet_id').trim();
      const sheetId = requireNumeric(params, 'sheet_id');
      const startIndex = requireNumeric(params, 'start_index');
      const count = requireNumeric(params, 'count');
      const inherit = params.inherit_from_before === true || params.inherit_from_before === 'true';
      await SheetsAPI.insertDimension(
        credentials,
        sid,
        sheetId,
        'COLUMNS',
        startIndex,
        startIndex + count,
        inherit,
      );
      return `${count} column${count !== 1 ? 's' : ''} inserted at column index ${startIndex}.`;
    }

    case 'sheets_delete_columns': {
      const sid = requireParam(params, 'spreadsheet_id').trim();
      const sheetId = requireNumeric(params, 'sheet_id');
      const startIndex = requireNumeric(params, 'start_index');
      const endIndex = requireNumeric(params, 'end_index');
      await SheetsAPI.deleteDimension(credentials, sid, sheetId, 'COLUMNS', startIndex, endIndex);
      return `Columns ${startIndex}–${endIndex - 1} deleted (${endIndex - startIndex} column${endIndex - startIndex !== 1 ? 's' : ''}).`;
    }

    case 'sheets_auto_resize_columns': {
      const sid = requireParam(params, 'spreadsheet_id').trim();
      const sheetId = requireNumeric(params, 'sheet_id');
      const startIndex = requireNumeric(params, 'start_index');
      const endIndex = requireNumeric(params, 'end_index');
      await SheetsAPI.autoResizeDimensions(
        credentials,
        sid,
        sheetId,
        'COLUMNS',
        startIndex,
        endIndex,
      );
      return `Columns ${startIndex}–${endIndex - 1} auto-resized to fit content.`;
    }

    case 'sheets_merge_cells': {
      const sid = requireParam(params, 'spreadsheet_id').trim();
      const sheetId = requireNumeric(params, 'sheet_id');
      const r0 = requireNumeric(params, 'start_row_index');
      const r1 = requireNumeric(params, 'end_row_index');
      const c0 = requireNumeric(params, 'start_column_index');
      const c1 = requireNumeric(params, 'end_column_index');
      const mergeType = params.merge_type?.trim() || 'MERGE_ALL';
      await SheetsAPI.mergeCells(credentials, sid, sheetId, r0, r1, c0, c1, mergeType);
      return `Cells merged (rows ${r0}–${r1 - 1}, cols ${c0}–${c1 - 1}) using ${mergeType}.`;
    }

    case 'sheets_unmerge_cells': {
      const sid = requireParam(params, 'spreadsheet_id').trim();
      const sheetId = requireNumeric(params, 'sheet_id');
      const r0 = requireNumeric(params, 'start_row_index');
      const r1 = requireNumeric(params, 'end_row_index');
      const c0 = requireNumeric(params, 'start_column_index');
      const c1 = requireNumeric(params, 'end_column_index');
      await SheetsAPI.unmergeCells(credentials, sid, sheetId, r0, r1, c0, c1);
      return `Cells unmerged in range (rows ${r0}–${r1 - 1}, cols ${c0}–${c1 - 1}).`;
    }

    case 'sheets_freeze': {
      const sid = requireParam(params, 'spreadsheet_id').trim();
      const sheetId = requireNumeric(params, 'sheet_id');
      const frozenRows = params.frozen_row_count != null ? Number(params.frozen_row_count) : 0;
      const frozenCols =
        params.frozen_column_count != null ? Number(params.frozen_column_count) : 0;
      await SheetsAPI.freezeRowsColumns(credentials, sid, sheetId, frozenRows, frozenCols);
      const parts = [];
      if (frozenRows > 0) parts.push(`${frozenRows} row${frozenRows !== 1 ? 's' : ''}`);
      if (frozenCols > 0) parts.push(`${frozenCols} column${frozenCols !== 1 ? 's' : ''}`);
      if (!parts.length) return 'All rows and columns unfrozen.';
      return `Frozen: ${parts.join(' and ')}.`;
    }

    case 'sheets_format_range': {
      const sid = requireParam(params, 'spreadsheet_id').trim();
      const sheetId = requireNumeric(params, 'sheet_id');
      const r0 = requireNumeric(params, 'start_row_index');
      const r1 = requireNumeric(params, 'end_row_index');
      const c0 = requireNumeric(params, 'start_column_index');
      const c1 = requireNumeric(params, 'end_column_index');
      const format = {};
      if (params.bold != null) format.bold = params.bold === true || params.bold === 'true';
      if (params.italic != null) format.italic = params.italic === true || params.italic === 'true';
      if (params.font_size != null) format.fontSize = Number(params.font_size);
      if (params.foreground_color)
        format.foregroundColor = parseJSON(params.foreground_color, 'foreground_color');
      if (params.background_color)
        format.backgroundColor = parseJSON(params.background_color, 'background_color');
      if (params.horizontal_alignment)
        format.horizontalAlignment = params.horizontal_alignment.trim().toUpperCase();
      if (!Object.keys(format).length)
        throw new Error(
          'At least one format option (bold, italic, font_size, foreground_color, background_color, horizontal_alignment) must be supplied.',
        );
      await SheetsAPI.formatRange(credentials, sid, sheetId, r0, r1, c0, c1, format);
      const applied = Object.keys(format).join(', ');
      return `Formatting applied (${applied}) to rows ${r0}–${r1 - 1}, cols ${c0}–${c1 - 1}.`;
    }

    case 'sheets_sort_range': {
      const sid = requireParam(params, 'spreadsheet_id').trim();
      const sheetId = requireNumeric(params, 'sheet_id');
      const r0 = requireNumeric(params, 'start_row_index');
      const r1 = requireNumeric(params, 'end_row_index');
      const c0 = requireNumeric(params, 'start_column_index');
      const c1 = requireNumeric(params, 'end_column_index');
      const sortSpecs = parseJSON(requireParam(params, 'sort_specs'), 'sort_specs');
      if (!Array.isArray(sortSpecs)) throw new Error('sort_specs must be a JSON array');
      await SheetsAPI.sortRange(credentials, sid, sheetId, r0, r1, c0, c1, sortSpecs);
      const desc = sortSpecs
        .map((s) => `col ${s.dimensionIndex} ${s.sortOrder ?? 'ASCENDING'}`)
        .join(', ');
      return `Range sorted by: ${desc}.`;
    }

    case 'sheets_list_named_ranges': {
      const sid = requireParam(params, 'spreadsheet_id').trim();
      const ranges = await SheetsAPI.listNamedRanges(credentials, sid);
      if (!ranges.length) return 'No named ranges defined in this spreadsheet.';
      const lines = ranges.map((nr, i) => {
        const r = nr.range ?? {};
        return `${i + 1}. **${nr.name}** (ID: \`${nr.namedRangeId}\`) — sheet ${r.sheetId}, rows ${r.startRowIndex ?? 0}–${r.endRowIndex ?? '?'}, cols ${r.startColumnIndex ?? 0}–${r.endColumnIndex ?? '?'}`;
      });
      return `Named ranges (${ranges.length}):\n\n${lines.join('\n')}`;
    }

    case 'sheets_add_named_range': {
      const sid = requireParam(params, 'spreadsheet_id').trim();
      const name = requireParam(params, 'name').trim();
      const sheetId = requireNumeric(params, 'sheet_id');
      const r0 = requireNumeric(params, 'start_row_index');
      const r1 = requireNumeric(params, 'end_row_index');
      const c0 = requireNumeric(params, 'start_column_index');
      const c1 = requireNumeric(params, 'end_column_index');
      const nr = await SheetsAPI.addNamedRange(credentials, sid, name, sheetId, r0, r1, c0, c1);
      return [
        `Named range created`,
        `Name: **${nr?.name ?? name}**`,
        nr?.namedRangeId ? `ID: \`${nr.namedRangeId}\`` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'sheets_delete_named_range': {
      const sid = requireParam(params, 'spreadsheet_id').trim();
      const namedRangeId = requireParam(params, 'named_range_id').trim();
      await SheetsAPI.deleteNamedRange(credentials, sid, namedRangeId);
      return `Named range \`${namedRangeId}\` deleted.`;
    }

    case 'sheets_find_replace': {
      const sid = requireParam(params, 'spreadsheet_id').trim();
      const find = requireParam(params, 'find');
      const replacement = params.replacement ?? '';
      const opts = {};
      if (params.sheet_id != null) opts.sheetId = Number(params.sheet_id);
      if (params.match_case != null)
        opts.matchCase = params.match_case === true || params.match_case === 'true';
      if (params.match_entire_cell != null)
        opts.matchEntireCell =
          params.match_entire_cell === true || params.match_entire_cell === 'true';
      if (params.search_by_regex != null)
        opts.searchByRegex = params.search_by_regex === true || params.search_by_regex === 'true';
      const result = await SheetsAPI.findReplace(credentials, sid, find, replacement, opts);
      return [
        `Find & replace complete`,
        result.occurrencesChanged != null
          ? `Occurrences replaced: ${result.occurrencesChanged}`
          : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    default:
      throw new Error(`Unknown Sheets tool: ${toolName}`);
  }
}
