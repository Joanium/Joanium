import * as SheetsAPI from '../API/SheetsAPI.js';
import { requireGoogleCredentials } from '../../../Common.js';
import { parseValues, parseJSON, renderTable, requireParam, requireNumeric } from './Utils.js';
export async function executeSheetsChatTool(ctx, toolName, params = {}) {
  const credentials = requireGoogleCredentials(ctx);
  switch (toolName) {
    case 'sheets_get_info': {
      const { spreadsheet_id: spreadsheet_id } = params;
      if (!spreadsheet_id?.trim()) throw new Error('Missing required param: spreadsheet_id');
      const info = await SheetsAPI.getSpreadsheetInfo(credentials, spreadsheet_id.trim()),
        sheets = (info.sheets ?? []).map((s, i) => {
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
        .filter((v) => null != v)
        .join('\n');
    }
    case 'sheets_list_sheets': {
      const { spreadsheet_id: spreadsheet_id } = params;
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
      const { spreadsheet_id: spreadsheet_id, range: range } = params;
      if (!spreadsheet_id?.trim()) throw new Error('Missing required param: spreadsheet_id');
      if (!range?.trim()) throw new Error('Missing required param: range');
      const result = await SheetsAPI.readRange(credentials, spreadsheet_id.trim(), range.trim());
      if (!result.values.length) return `Range \`${range}\` is empty.`;
      const rowCount = result.values.length,
        colCount = Math.max(...result.values.map((r) => r.length));
      return [
        `Range: \`${result.range}\` — ${rowCount} row${1 !== rowCount ? 's' : ''} × ${colCount} col${1 !== colCount ? 's' : ''}`,
        '',
        '```',
        renderTable(result.values),
        '```',
      ].join('\n');
    }
    case 'sheets_write_range': {
      const { spreadsheet_id: spreadsheet_id, range: range, values: rawValues } = params;
      if (!spreadsheet_id?.trim()) throw new Error('Missing required param: spreadsheet_id');
      if (!range?.trim()) throw new Error('Missing required param: range');
      if (null == rawValues) throw new Error('Missing required param: values');
      const values = parseValues(rawValues),
        result = await SheetsAPI.writeRange(
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
      const { spreadsheet_id: spreadsheet_id, range: range, values: rawValues } = params;
      if (!spreadsheet_id?.trim()) throw new Error('Missing required param: spreadsheet_id');
      if (!range?.trim()) throw new Error('Missing required param: range');
      if (null == rawValues) throw new Error('Missing required param: values');
      const values = parseValues(rawValues),
        updates =
          (await SheetsAPI.appendValues(credentials, spreadsheet_id.trim(), range.trim(), values))
            .updates ?? {};
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
      const { spreadsheet_id: spreadsheet_id, range: range } = params;
      if (!spreadsheet_id?.trim()) throw new Error('Missing required param: spreadsheet_id');
      if (!range?.trim()) throw new Error('Missing required param: range');
      return `Range \`${(await SheetsAPI.clearRange(credentials, spreadsheet_id.trim(), range.trim())).clearedRange ?? range}\` cleared.`;
    }
    case 'sheets_create_spreadsheet': {
      const { title: title, sheet_titles: sheet_titles } = params;
      if (!title?.trim()) throw new Error('Missing required param: title');
      const sheetTitles = sheet_titles
          ? String(sheet_titles)
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        ss = await SheetsAPI.createSpreadsheet(credentials, title.trim(), sheetTitles);
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
      const { spreadsheet_id: spreadsheet_id, title: title } = params;
      if (!spreadsheet_id?.trim()) throw new Error('Missing required param: spreadsheet_id');
      if (!title?.trim()) throw new Error('Missing required param: title');
      const sheet = await SheetsAPI.addSheet(credentials, spreadsheet_id.trim(), title.trim());
      return [
        `Sheet "${sheet?.title ?? title}" added`,
        null != sheet?.sheetId ? `Sheet ID: ${sheet.sheetId}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'sheets_delete_sheet': {
      const { spreadsheet_id: spreadsheet_id, sheet_id: sheet_id } = params;
      if (!spreadsheet_id?.trim()) throw new Error('Missing required param: spreadsheet_id');
      if (null == sheet_id) throw new Error('Missing required param: sheet_id');
      return (
        await SheetsAPI.deleteSheet(credentials, spreadsheet_id.trim(), Number(sheet_id)),
        `Sheet ID ${sheet_id} deleted from spreadsheet.`
      );
    }
    case 'sheets_rename_sheet': {
      const { spreadsheet_id: spreadsheet_id, sheet_id: sheet_id, new_title: new_title } = params;
      if (!spreadsheet_id?.trim()) throw new Error('Missing required param: spreadsheet_id');
      if (null == sheet_id) throw new Error('Missing required param: sheet_id');
      if (!new_title?.trim()) throw new Error('Missing required param: new_title');
      return (
        await SheetsAPI.renameSheet(
          credentials,
          spreadsheet_id.trim(),
          Number(sheet_id),
          new_title.trim(),
        ),
        `Sheet ID ${sheet_id} renamed to "${new_title}".`
      );
    }
    case 'sheets_batch_write': {
      const sid = requireParam(params, 'spreadsheet_id').trim(),
        updates = parseJSON(requireParam(params, 'updates'), 'updates');
      if (!Array.isArray(updates))
        throw new Error('updates must be a JSON array of {range, values} objects');
      const result = await SheetsAPI.batchWriteRanges(credentials, sid, updates),
        total = (result.responses ?? []).reduce((s, r) => s + (r.updatedCells ?? 0), 0);
      return [
        'Batch write complete',
        `Ranges updated: ${result.totalUpdatedRanges ?? updates.length}`,
        `Total cells updated: ${(total || result.totalUpdatedCells) ?? '—'}`,
      ].join('\n');
    }
    case 'sheets_batch_clear': {
      const sid = requireParam(params, 'spreadsheet_id').trim(),
        ranges = String(requireParam(params, 'ranges'))
          .split(',')
          .map((r) => r.trim())
          .filter(Boolean),
        result = await SheetsAPI.batchClearRanges(credentials, sid, ranges),
        cleared = (result.clearedRanges ?? ranges).join(', ');
      return `Cleared ${result.clearedRanges?.length ?? ranges.length} range(s): ${cleared}`;
    }
    case 'sheets_get_formulas': {
      const sid = requireParam(params, 'spreadsheet_id').trim(),
        range = requireParam(params, 'range').trim(),
        result = await SheetsAPI.getFormulas(credentials, sid, range);
      if (!result.values.length) return `Range \`${range}\` contains no formulas.`;
      const rowCount = result.values.length,
        colCount = Math.max(...result.values.map((r) => r.length));
      return [
        `Formulas in \`${result.range}\` — ${rowCount} row${1 !== rowCount ? 's' : ''} × ${colCount} col${1 !== colCount ? 's' : ''}`,
        '',
        '```',
        renderTable(result.values),
        '```',
      ].join('\n');
    }
    case 'sheets_copy_sheet': {
      const sid = requireParam(params, 'spreadsheet_id').trim(),
        sheetId = requireNumeric(params, 'sheet_id'),
        destId = requireParam(params, 'destination_spreadsheet_id').trim(),
        props = await SheetsAPI.copySheet(credentials, sid, sheetId, destId);
      return [
        'Sheet copied successfully',
        props?.title ? `New sheet name: "${props.title}"` : '',
        null != props?.sheetId ? `New sheet ID: ${props.sheetId}` : '',
        `Destination spreadsheet: \`${destId}\``,
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'sheets_duplicate_sheet': {
      const sid = requireParam(params, 'spreadsheet_id').trim(),
        sheetId = requireNumeric(params, 'sheet_id'),
        opts = {};
      (params.new_sheet_name?.trim() && (opts.newSheetName = params.new_sheet_name.trim()),
        null != params.insert_sheet_index &&
          (opts.insertSheetIndex = Number(params.insert_sheet_index)));
      const props = await SheetsAPI.duplicateSheet(credentials, sid, sheetId, opts);
      return [
        'Sheet duplicated',
        props?.title ? `New sheet: "${props.title}"` : '',
        null != props?.sheetId ? `New sheet ID: ${props.sheetId}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'sheets_move_sheet': {
      const sid = requireParam(params, 'spreadsheet_id').trim(),
        sheetId = requireNumeric(params, 'sheet_id'),
        newIndex = requireNumeric(params, 'new_index');
      return (
        await SheetsAPI.moveSheet(credentials, sid, sheetId, newIndex),
        `Sheet ID ${sheetId} moved to position ${newIndex}.`
      );
    }
    case 'sheets_insert_rows': {
      const sid = requireParam(params, 'spreadsheet_id').trim(),
        sheetId = requireNumeric(params, 'sheet_id'),
        startIndex = requireNumeric(params, 'start_index'),
        count = requireNumeric(params, 'count'),
        inherit = !0 === params.inherit_from_before || 'true' === params.inherit_from_before;
      return (
        await SheetsAPI.insertDimension(
          credentials,
          sid,
          sheetId,
          'ROWS',
          startIndex,
          startIndex + count,
          inherit,
        ),
        `${count} row${1 !== count ? 's' : ''} inserted at row index ${startIndex}.`
      );
    }
    case 'sheets_delete_rows': {
      const sid = requireParam(params, 'spreadsheet_id').trim(),
        sheetId = requireNumeric(params, 'sheet_id'),
        startIndex = requireNumeric(params, 'start_index'),
        endIndex = requireNumeric(params, 'end_index');
      return (
        await SheetsAPI.deleteDimension(credentials, sid, sheetId, 'ROWS', startIndex, endIndex),
        `Rows ${startIndex}–${endIndex - 1} deleted (${endIndex - startIndex} row${endIndex - startIndex !== 1 ? 's' : ''}).`
      );
    }
    case 'sheets_insert_columns': {
      const sid = requireParam(params, 'spreadsheet_id').trim(),
        sheetId = requireNumeric(params, 'sheet_id'),
        startIndex = requireNumeric(params, 'start_index'),
        count = requireNumeric(params, 'count'),
        inherit = !0 === params.inherit_from_before || 'true' === params.inherit_from_before;
      return (
        await SheetsAPI.insertDimension(
          credentials,
          sid,
          sheetId,
          'COLUMNS',
          startIndex,
          startIndex + count,
          inherit,
        ),
        `${count} column${1 !== count ? 's' : ''} inserted at column index ${startIndex}.`
      );
    }
    case 'sheets_delete_columns': {
      const sid = requireParam(params, 'spreadsheet_id').trim(),
        sheetId = requireNumeric(params, 'sheet_id'),
        startIndex = requireNumeric(params, 'start_index'),
        endIndex = requireNumeric(params, 'end_index');
      return (
        await SheetsAPI.deleteDimension(credentials, sid, sheetId, 'COLUMNS', startIndex, endIndex),
        `Columns ${startIndex}–${endIndex - 1} deleted (${endIndex - startIndex} column${endIndex - startIndex !== 1 ? 's' : ''}).`
      );
    }
    case 'sheets_auto_resize_columns': {
      const sid = requireParam(params, 'spreadsheet_id').trim(),
        sheetId = requireNumeric(params, 'sheet_id'),
        startIndex = requireNumeric(params, 'start_index'),
        endIndex = requireNumeric(params, 'end_index');
      return (
        await SheetsAPI.autoResizeDimensions(
          credentials,
          sid,
          sheetId,
          'COLUMNS',
          startIndex,
          endIndex,
        ),
        `Columns ${startIndex}–${endIndex - 1} auto-resized to fit content.`
      );
    }
    case 'sheets_merge_cells': {
      const sid = requireParam(params, 'spreadsheet_id').trim(),
        sheetId = requireNumeric(params, 'sheet_id'),
        r0 = requireNumeric(params, 'start_row_index'),
        r1 = requireNumeric(params, 'end_row_index'),
        c0 = requireNumeric(params, 'start_column_index'),
        c1 = requireNumeric(params, 'end_column_index'),
        mergeType = params.merge_type?.trim() || 'MERGE_ALL';
      return (
        await SheetsAPI.mergeCells(credentials, sid, sheetId, r0, r1, c0, c1, mergeType),
        `Cells merged (rows ${r0}–${r1 - 1}, cols ${c0}–${c1 - 1}) using ${mergeType}.`
      );
    }
    case 'sheets_unmerge_cells': {
      const sid = requireParam(params, 'spreadsheet_id').trim(),
        sheetId = requireNumeric(params, 'sheet_id'),
        r0 = requireNumeric(params, 'start_row_index'),
        r1 = requireNumeric(params, 'end_row_index'),
        c0 = requireNumeric(params, 'start_column_index'),
        c1 = requireNumeric(params, 'end_column_index');
      return (
        await SheetsAPI.unmergeCells(credentials, sid, sheetId, r0, r1, c0, c1),
        `Cells unmerged in range (rows ${r0}–${r1 - 1}, cols ${c0}–${c1 - 1}).`
      );
    }
    case 'sheets_freeze': {
      const sid = requireParam(params, 'spreadsheet_id').trim(),
        sheetId = requireNumeric(params, 'sheet_id'),
        frozenRows = null != params.frozen_row_count ? Number(params.frozen_row_count) : 0,
        frozenCols = null != params.frozen_column_count ? Number(params.frozen_column_count) : 0;
      await SheetsAPI.freezeRowsColumns(credentials, sid, sheetId, frozenRows, frozenCols);
      const parts = [];
      return (
        frozenRows > 0 && parts.push(`${frozenRows} row${1 !== frozenRows ? 's' : ''}`),
        frozenCols > 0 && parts.push(`${frozenCols} column${1 !== frozenCols ? 's' : ''}`),
        parts.length ? `Frozen: ${parts.join(' and ')}.` : 'All rows and columns unfrozen.'
      );
    }
    case 'sheets_format_range': {
      const sid = requireParam(params, 'spreadsheet_id').trim(),
        sheetId = requireNumeric(params, 'sheet_id'),
        r0 = requireNumeric(params, 'start_row_index'),
        r1 = requireNumeric(params, 'end_row_index'),
        c0 = requireNumeric(params, 'start_column_index'),
        c1 = requireNumeric(params, 'end_column_index'),
        format = {};
      if (
        (null != params.bold && (format.bold = !0 === params.bold || 'true' === params.bold),
        null != params.italic && (format.italic = !0 === params.italic || 'true' === params.italic),
        null != params.font_size && (format.fontSize = Number(params.font_size)),
        params.foreground_color &&
          (format.foregroundColor = parseJSON(params.foreground_color, 'foreground_color')),
        params.background_color &&
          (format.backgroundColor = parseJSON(params.background_color, 'background_color')),
        params.horizontal_alignment &&
          (format.horizontalAlignment = params.horizontal_alignment.trim().toUpperCase()),
        !Object.keys(format).length)
      )
        throw new Error(
          'At least one format option (bold, italic, font_size, foreground_color, background_color, horizontal_alignment) must be supplied.',
        );
      return (
        await SheetsAPI.formatRange(credentials, sid, sheetId, r0, r1, c0, c1, format),
        `Formatting applied (${Object.keys(format).join(', ')}) to rows ${r0}–${r1 - 1}, cols ${c0}–${c1 - 1}.`
      );
    }
    case 'sheets_sort_range': {
      const sid = requireParam(params, 'spreadsheet_id').trim(),
        sheetId = requireNumeric(params, 'sheet_id'),
        r0 = requireNumeric(params, 'start_row_index'),
        r1 = requireNumeric(params, 'end_row_index'),
        c0 = requireNumeric(params, 'start_column_index'),
        c1 = requireNumeric(params, 'end_column_index'),
        sortSpecs = parseJSON(requireParam(params, 'sort_specs'), 'sort_specs');
      if (!Array.isArray(sortSpecs)) throw new Error('sort_specs must be a JSON array');
      return (
        await SheetsAPI.sortRange(credentials, sid, sheetId, r0, r1, c0, c1, sortSpecs),
        `Range sorted by: ${sortSpecs.map((s) => `col ${s.dimensionIndex} ${s.sortOrder ?? 'ASCENDING'}`).join(', ')}.`
      );
    }
    case 'sheets_list_named_ranges': {
      const sid = requireParam(params, 'spreadsheet_id').trim(),
        ranges = await SheetsAPI.listNamedRanges(credentials, sid);
      if (!ranges.length) return 'No named ranges defined in this spreadsheet.';
      const lines = ranges.map((nr, i) => {
        const r = nr.range ?? {};
        return `${i + 1}. **${nr.name}** (ID: \`${nr.namedRangeId}\`) — sheet ${r.sheetId}, rows ${r.startRowIndex ?? 0}–${r.endRowIndex ?? '?'}, cols ${r.startColumnIndex ?? 0}–${r.endColumnIndex ?? '?'}`;
      });
      return `Named ranges (${ranges.length}):\n\n${lines.join('\n')}`;
    }
    case 'sheets_add_named_range': {
      const sid = requireParam(params, 'spreadsheet_id').trim(),
        name = requireParam(params, 'name').trim(),
        sheetId = requireNumeric(params, 'sheet_id'),
        r0 = requireNumeric(params, 'start_row_index'),
        r1 = requireNumeric(params, 'end_row_index'),
        c0 = requireNumeric(params, 'start_column_index'),
        c1 = requireNumeric(params, 'end_column_index'),
        nr = await SheetsAPI.addNamedRange(credentials, sid, name, sheetId, r0, r1, c0, c1);
      return [
        'Named range created',
        `Name: **${nr?.name ?? name}**`,
        nr?.namedRangeId ? `ID: \`${nr.namedRangeId}\`` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'sheets_delete_named_range': {
      const sid = requireParam(params, 'spreadsheet_id').trim(),
        namedRangeId = requireParam(params, 'named_range_id').trim();
      return (
        await SheetsAPI.deleteNamedRange(credentials, sid, namedRangeId),
        `Named range \`${namedRangeId}\` deleted.`
      );
    }
    case 'sheets_find_replace': {
      const sid = requireParam(params, 'spreadsheet_id').trim(),
        find = requireParam(params, 'find'),
        replacement = params.replacement ?? '',
        opts = {};
      (null != params.sheet_id && (opts.sheetId = Number(params.sheet_id)),
        null != params.match_case &&
          (opts.matchCase = !0 === params.match_case || 'true' === params.match_case),
        null != params.match_entire_cell &&
          (opts.matchEntireCell =
            !0 === params.match_entire_cell || 'true' === params.match_entire_cell),
        null != params.search_by_regex &&
          (opts.searchByRegex =
            !0 === params.search_by_regex || 'true' === params.search_by_regex));
      const result = await SheetsAPI.findReplace(credentials, sid, find, replacement, opts);
      return [
        'Find & replace complete',
        null != result.occurrencesChanged
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
