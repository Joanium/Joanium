export const SHEETS_TOOLS = [
  {
    name: 'sheets_get_info',
    description: 'Get metadata about a Google Spreadsheet — title, sheet names, dimensions.',
    category: 'sheets',
    parameters: {
      spreadsheet_id: {
        type: 'string',
        required: true,
        description: 'Google Spreadsheet ID (from the URL).',
      },
    },
  },
  {
    name: 'sheets_list_sheets',
    description: 'List all individual sheets (tabs) inside a Google Spreadsheet.',
    category: 'sheets',
    parameters: {
      spreadsheet_id: { type: 'string', required: true, description: 'Google Spreadsheet ID.' },
    },
  },
  {
    name: 'sheets_read_range',
    description:
      "Read cell values from a range in a Google Spreadsheet. Use A1 notation like 'Sheet1!A1:D10' or just 'A1:D10' for the first sheet.",
    category: 'sheets',
    parameters: {
      spreadsheet_id: { type: 'string', required: true, description: 'Google Spreadsheet ID.' },
      range: {
        type: 'string',
        required: true,
        description: "Cell range in A1 notation (e.g. 'Sheet1!A1:D20', 'A:A', 'B2:E50').",
      },
    },
  },
  {
    name: 'sheets_write_range',
    description:
      'Write values to a range in a Google Spreadsheet, replacing existing data. Values is a 2D array (rows × columns).',
    category: 'sheets',
    parameters: {
      spreadsheet_id: { type: 'string', required: true, description: 'Google Spreadsheet ID.' },
      range: {
        type: 'string',
        required: true,
        description: "Target range in A1 notation (e.g. 'Sheet1!A1').",
      },
      values: {
        type: 'string',
        required: true,
        description: 'JSON-encoded 2D array of values, e.g. [[\"Name\",\"Age\"],[\"Alice\",30]].',
      },
    },
  },
  {
    name: 'sheets_append_values',
    description: 'Append new rows to the end of existing data in a sheet.',
    category: 'sheets',
    parameters: {
      spreadsheet_id: { type: 'string', required: true, description: 'Google Spreadsheet ID.' },
      range: {
        type: 'string',
        required: true,
        description: "Range or sheet name to append to (e.g. 'Sheet1').",
      },
      values: {
        type: 'string',
        required: true,
        description: 'JSON-encoded 2D array of rows to append, e.g. [[\"Bob\",25],[\"Carol\",31]].',
      },
    },
  },
  {
    name: 'sheets_clear_range',
    description:
      'Clear all values from a range in a Google Spreadsheet (leaves formatting intact).',
    category: 'sheets',
    parameters: {
      spreadsheet_id: { type: 'string', required: true, description: 'Google Spreadsheet ID.' },
      range: {
        type: 'string',
        required: true,
        description: "Range to clear in A1 notation (e.g. 'Sheet1!A1:Z100').",
      },
    },
  },
  {
    name: 'sheets_create_spreadsheet',
    description: 'Create a new Google Spreadsheet.',
    category: 'sheets',
    parameters: {
      title: { type: 'string', required: true, description: 'Title for the new spreadsheet.' },
      sheet_titles: {
        type: 'string',
        required: false,
        description:
          'Comma-separated names for the initial sheets (e.g. "January,February,March").',
      },
    },
  },
  {
    name: 'sheets_add_sheet',
    description: 'Add a new sheet (tab) to an existing Google Spreadsheet.',
    category: 'sheets',
    parameters: {
      spreadsheet_id: { type: 'string', required: true, description: 'Google Spreadsheet ID.' },
      title: { type: 'string', required: true, description: 'Name for the new sheet.' },
    },
  },
  {
    name: 'sheets_delete_sheet',
    description: 'Delete a sheet (tab) from a Google Spreadsheet by its sheet ID.',
    category: 'sheets',
    parameters: {
      spreadsheet_id: { type: 'string', required: true, description: 'Google Spreadsheet ID.' },
      sheet_id: {
        type: 'number',
        required: true,
        description: 'Numeric sheet ID (not the name — get from sheets_list_sheets).',
      },
    },
  },
  {
    name: 'sheets_rename_sheet',
    description: 'Rename a sheet (tab) inside a Google Spreadsheet.',
    category: 'sheets',
    parameters: {
      spreadsheet_id: { type: 'string', required: true, description: 'Google Spreadsheet ID.' },
      sheet_id: {
        type: 'number',
        required: true,
        description: 'Numeric sheet ID (get from sheets_list_sheets).',
      },
      new_title: { type: 'string', required: true, description: 'New name for the sheet.' },
    },
  },
  {
    name: 'sheets_batch_write',
    description:
      'Write values to multiple ranges at once in a single API call. More efficient than calling sheets_write_range repeatedly.',
    category: 'sheets',
    parameters: {
      spreadsheet_id: { type: 'string', required: true, description: 'Google Spreadsheet ID.' },
      updates: {
        type: 'string',
        required: true,
        description:
          'JSON-encoded array of {range, values} objects, e.g. [{"range":"Sheet1!A1","values":[["Hello"]]},{"range":"Sheet2!B2","values":[[42]]}].',
      },
    },
  },
  {
    name: 'sheets_batch_clear',
    description: 'Clear values from multiple ranges at once in a single API call.',
    category: 'sheets',
    parameters: {
      spreadsheet_id: { type: 'string', required: true, description: 'Google Spreadsheet ID.' },
      ranges: {
        type: 'string',
        required: true,
        description: 'Comma-separated list of ranges to clear, e.g. "Sheet1!A1:B10,Sheet2!C3:D5".',
      },
    },
  },
  {
    name: 'sheets_get_formulas',
    description:
      'Read the raw formulas (not computed values) from a range. Returns =SUM(A1:A10) style strings where formulas exist.',
    category: 'sheets',
    parameters: {
      spreadsheet_id: { type: 'string', required: true, description: 'Google Spreadsheet ID.' },
      range: {
        type: 'string',
        required: true,
        description: "Cell range in A1 notation (e.g. 'Sheet1!A1:D10').",
      },
    },
  },
  {
    name: 'sheets_copy_sheet',
    description:
      'Copy a sheet to another spreadsheet (or the same one). Returns the new sheet properties.',
    category: 'sheets',
    parameters: {
      spreadsheet_id: {
        type: 'string',
        required: true,
        description: 'Source Google Spreadsheet ID.',
      },
      sheet_id: { type: 'number', required: true, description: 'Numeric ID of the sheet to copy.' },
      destination_spreadsheet_id: {
        type: 'string',
        required: true,
        description:
          'Target spreadsheet ID. Use the same as spreadsheet_id to copy within the same file.',
      },
    },
  },
  {
    name: 'sheets_duplicate_sheet',
    description: 'Duplicate a sheet within the same spreadsheet.',
    category: 'sheets',
    parameters: {
      spreadsheet_id: { type: 'string', required: true, description: 'Google Spreadsheet ID.' },
      sheet_id: {
        type: 'number',
        required: true,
        description: 'Numeric ID of the sheet to duplicate.',
      },
      new_sheet_name: {
        type: 'string',
        required: false,
        description: 'Name for the duplicated sheet. Defaults to "Copy of <original>".',
      },
      insert_sheet_index: {
        type: 'number',
        required: false,
        description: 'Zero-based position to insert the duplicate. Defaults to end.',
      },
    },
  },
  {
    name: 'sheets_move_sheet',
    description: 'Reorder a sheet by moving it to a different position (index) in the spreadsheet.',
    category: 'sheets',
    parameters: {
      spreadsheet_id: { type: 'string', required: true, description: 'Google Spreadsheet ID.' },
      sheet_id: { type: 'number', required: true, description: 'Numeric ID of the sheet to move.' },
      new_index: {
        type: 'number',
        required: true,
        description: 'Zero-based target position (0 = first tab).',
      },
    },
  },
  {
    name: 'sheets_insert_rows',
    description: 'Insert blank rows into a sheet at a specified position.',
    category: 'sheets',
    parameters: {
      spreadsheet_id: { type: 'string', required: true, description: 'Google Spreadsheet ID.' },
      sheet_id: { type: 'number', required: true, description: 'Numeric sheet ID.' },
      start_index: {
        type: 'number',
        required: true,
        description: 'Zero-based row index where insertion begins (0 = before first row).',
      },
      count: { type: 'number', required: true, description: 'Number of rows to insert.' },
      inherit_from_before: {
        type: 'boolean',
        required: false,
        description: 'Copy formatting from the row above. Defaults to false.',
      },
    },
  },
  {
    name: 'sheets_delete_rows',
    description: 'Delete a range of rows from a sheet.',
    category: 'sheets',
    parameters: {
      spreadsheet_id: { type: 'string', required: true, description: 'Google Spreadsheet ID.' },
      sheet_id: { type: 'number', required: true, description: 'Numeric sheet ID.' },
      start_index: {
        type: 'number',
        required: true,
        description: 'Zero-based index of the first row to delete.',
      },
      end_index: {
        type: 'number',
        required: true,
        description:
          'Zero-based index after the last row to delete (exclusive). To delete row 3 only, use start=2, end=3.',
      },
    },
  },
  {
    name: 'sheets_insert_columns',
    description: 'Insert blank columns into a sheet at a specified position.',
    category: 'sheets',
    parameters: {
      spreadsheet_id: { type: 'string', required: true, description: 'Google Spreadsheet ID.' },
      sheet_id: { type: 'number', required: true, description: 'Numeric sheet ID.' },
      start_index: {
        type: 'number',
        required: true,
        description: 'Zero-based column index where insertion begins (0 = before column A).',
      },
      count: { type: 'number', required: true, description: 'Number of columns to insert.' },
      inherit_from_before: {
        type: 'boolean',
        required: false,
        description: 'Copy formatting from the column to the left. Defaults to false.',
      },
    },
  },
  {
    name: 'sheets_delete_columns',
    description: 'Delete a range of columns from a sheet.',
    category: 'sheets',
    parameters: {
      spreadsheet_id: { type: 'string', required: true, description: 'Google Spreadsheet ID.' },
      sheet_id: { type: 'number', required: true, description: 'Numeric sheet ID.' },
      start_index: {
        type: 'number',
        required: true,
        description: 'Zero-based index of the first column to delete (0 = column A).',
      },
      end_index: {
        type: 'number',
        required: true,
        description: 'Zero-based index after the last column to delete (exclusive).',
      },
    },
  },
  {
    name: 'sheets_auto_resize_columns',
    description: 'Auto-resize column widths to fit their content.',
    category: 'sheets',
    parameters: {
      spreadsheet_id: { type: 'string', required: true, description: 'Google Spreadsheet ID.' },
      sheet_id: { type: 'number', required: true, description: 'Numeric sheet ID.' },
      start_index: {
        type: 'number',
        required: true,
        description: 'Zero-based index of first column to resize (0 = column A).',
      },
      end_index: {
        type: 'number',
        required: true,
        description: 'Zero-based index after the last column to resize (exclusive).',
      },
    },
  },
  {
    name: 'sheets_merge_cells',
    description: 'Merge a rectangular range of cells into one.',
    category: 'sheets',
    parameters: {
      spreadsheet_id: { type: 'string', required: true, description: 'Google Spreadsheet ID.' },
      sheet_id: { type: 'number', required: true, description: 'Numeric sheet ID.' },
      start_row_index: {
        type: 'number',
        required: true,
        description: 'Zero-based start row (inclusive).',
      },
      end_row_index: {
        type: 'number',
        required: true,
        description: 'Zero-based end row (exclusive).',
      },
      start_column_index: {
        type: 'number',
        required: true,
        description: 'Zero-based start column (inclusive).',
      },
      end_column_index: {
        type: 'number',
        required: true,
        description: 'Zero-based end column (exclusive).',
      },
      merge_type: {
        type: 'string',
        required: false,
        description: 'MERGE_ALL (default), MERGE_COLUMNS, or MERGE_ROWS.',
      },
    },
  },
  {
    name: 'sheets_unmerge_cells',
    description: 'Unmerge previously merged cells in a range.',
    category: 'sheets',
    parameters: {
      spreadsheet_id: { type: 'string', required: true, description: 'Google Spreadsheet ID.' },
      sheet_id: { type: 'number', required: true, description: 'Numeric sheet ID.' },
      start_row_index: {
        type: 'number',
        required: true,
        description: 'Zero-based start row (inclusive).',
      },
      end_row_index: {
        type: 'number',
        required: true,
        description: 'Zero-based end row (exclusive).',
      },
      start_column_index: {
        type: 'number',
        required: true,
        description: 'Zero-based start column (inclusive).',
      },
      end_column_index: {
        type: 'number',
        required: true,
        description: 'Zero-based end column (exclusive).',
      },
    },
  },
  {
    name: 'sheets_freeze',
    description:
      'Freeze rows and/or columns so they stay visible when scrolling. Set counts to 0 to unfreeze.',
    category: 'sheets',
    parameters: {
      spreadsheet_id: { type: 'string', required: true, description: 'Google Spreadsheet ID.' },
      sheet_id: { type: 'number', required: true, description: 'Numeric sheet ID.' },
      frozen_row_count: {
        type: 'number',
        required: false,
        description: 'Number of rows to freeze from the top. 0 unfreezes rows.',
      },
      frozen_column_count: {
        type: 'number',
        required: false,
        description: 'Number of columns to freeze from the left. 0 unfreezes columns.',
      },
    },
  },
  {
    name: 'sheets_format_range',
    description:
      'Apply text formatting and/or background colour to a range of cells. All format fields are optional — only supplied ones are changed.',
    category: 'sheets',
    parameters: {
      spreadsheet_id: { type: 'string', required: true, description: 'Google Spreadsheet ID.' },
      sheet_id: { type: 'number', required: true, description: 'Numeric sheet ID.' },
      start_row_index: {
        type: 'number',
        required: true,
        description: 'Zero-based start row (inclusive).',
      },
      end_row_index: {
        type: 'number',
        required: true,
        description: 'Zero-based end row (exclusive).',
      },
      start_column_index: {
        type: 'number',
        required: true,
        description: 'Zero-based start column (inclusive).',
      },
      end_column_index: {
        type: 'number',
        required: true,
        description: 'Zero-based end column (exclusive).',
      },
      bold: { type: 'boolean', required: false, description: 'Make text bold.' },
      italic: { type: 'boolean', required: false, description: 'Make text italic.' },
      font_size: { type: 'number', required: false, description: 'Font size in points.' },
      foreground_color: {
        type: 'string',
        required: false,
        description:
          'Text colour as JSON {red,green,blue} with 0–1 values, e.g. {"red":1,"green":0,"blue":0} for red.',
      },
      background_color: {
        type: 'string',
        required: false,
        description: 'Cell background colour as JSON {red,green,blue} with 0–1 values.',
      },
      horizontal_alignment: {
        type: 'string',
        required: false,
        description: 'LEFT, CENTER, or RIGHT.',
      },
    },
  },
  {
    name: 'sheets_sort_range',
    description: 'Sort a range of cells by one or more columns.',
    category: 'sheets',
    parameters: {
      spreadsheet_id: { type: 'string', required: true, description: 'Google Spreadsheet ID.' },
      sheet_id: { type: 'number', required: true, description: 'Numeric sheet ID.' },
      start_row_index: {
        type: 'number',
        required: true,
        description: 'Zero-based start row (inclusive). Usually 1 to skip a header row.',
      },
      end_row_index: {
        type: 'number',
        required: true,
        description: 'Zero-based end row (exclusive).',
      },
      start_column_index: {
        type: 'number',
        required: true,
        description: 'Zero-based start column (inclusive).',
      },
      end_column_index: {
        type: 'number',
        required: true,
        description: 'Zero-based end column (exclusive).',
      },
      sort_specs: {
        type: 'string',
        required: true,
        description:
          'JSON-encoded array of sort specs, e.g. [{"dimensionIndex":0,"sortOrder":"ASCENDING"}]. dimensionIndex is relative to start_column_index.',
      },
    },
  },
  {
    name: 'sheets_list_named_ranges',
    description: 'List all named ranges defined in a Google Spreadsheet.',
    category: 'sheets',
    parameters: {
      spreadsheet_id: { type: 'string', required: true, description: 'Google Spreadsheet ID.' },
    },
  },
  {
    name: 'sheets_add_named_range',
    description: 'Create a named range (e.g. "SalesData") pointing to a specific cell range.',
    category: 'sheets',
    parameters: {
      spreadsheet_id: { type: 'string', required: true, description: 'Google Spreadsheet ID.' },
      name: {
        type: 'string',
        required: true,
        description:
          'Name for the range (letters, numbers, underscores; must start with a letter).',
      },
      sheet_id: { type: 'number', required: true, description: 'Numeric sheet ID.' },
      start_row_index: {
        type: 'number',
        required: true,
        description: 'Zero-based start row (inclusive).',
      },
      end_row_index: {
        type: 'number',
        required: true,
        description: 'Zero-based end row (exclusive).',
      },
      start_column_index: {
        type: 'number',
        required: true,
        description: 'Zero-based start column (inclusive).',
      },
      end_column_index: {
        type: 'number',
        required: true,
        description: 'Zero-based end column (exclusive).',
      },
    },
  },
  {
    name: 'sheets_delete_named_range',
    description:
      'Delete a named range by its ID. Use sheets_list_named_ranges to find the namedRangeId.',
    category: 'sheets',
    parameters: {
      spreadsheet_id: { type: 'string', required: true, description: 'Google Spreadsheet ID.' },
      named_range_id: {
        type: 'string',
        required: true,
        description: 'The namedRangeId of the range to delete (from sheets_list_named_ranges).',
      },
    },
  },
  {
    name: 'sheets_find_replace',
    description: 'Find and replace text values across a sheet or the entire spreadsheet.',
    category: 'sheets',
    parameters: {
      spreadsheet_id: { type: 'string', required: true, description: 'Google Spreadsheet ID.' },
      find: { type: 'string', required: true, description: 'Text (or regex) to search for.' },
      replacement: { type: 'string', required: true, description: 'Text to replace matches with.' },
      sheet_id: {
        type: 'number',
        required: false,
        description: 'Limit search to this numeric sheet ID. Omit to search all sheets.',
      },
      match_case: {
        type: 'boolean',
        required: false,
        description: 'Case-sensitive search. Defaults to false.',
      },
      match_entire_cell: {
        type: 'boolean',
        required: false,
        description:
          'Only match cells whose entire value equals the search string. Defaults to false.',
      },
      search_by_regex: {
        type: 'boolean',
        required: false,
        description: 'Treat the find string as a regular expression. Defaults to false.',
      },
    },
  },
];
