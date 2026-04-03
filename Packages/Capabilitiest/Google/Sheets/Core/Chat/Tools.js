export const SHEETS_TOOLS = [
  {
    name: 'sheets_get_info',
    description: 'Get metadata about a Google Spreadsheet — title, sheet names, dimensions.',
    category: 'sheets',
    parameters: {
      spreadsheet_id: { type: 'string', required: true, description: 'Google Spreadsheet ID (from the URL).' },
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
    description: "Read cell values from a range in a Google Spreadsheet. Use A1 notation like 'Sheet1!A1:D10' or just 'A1:D10' for the first sheet.",
    category: 'sheets',
    parameters: {
      spreadsheet_id: { type: 'string', required: true,  description: 'Google Spreadsheet ID.' },
      range:          { type: 'string', required: true,  description: "Cell range in A1 notation (e.g. 'Sheet1!A1:D20', 'A:A', 'B2:E50')." },
    },
  },
  {
    name: 'sheets_write_range',
    description: 'Write values to a range in a Google Spreadsheet, replacing existing data. Values is a 2D array (rows × columns).',
    category: 'sheets',
    parameters: {
      spreadsheet_id: { type: 'string', required: true,  description: 'Google Spreadsheet ID.' },
      range:          { type: 'string', required: true,  description: "Target range in A1 notation (e.g. 'Sheet1!A1')." },
      values:         { type: 'string', required: true,  description: 'JSON-encoded 2D array of values, e.g. [[\"Name\",\"Age\"],[\"Alice\",30]].' },
    },
  },
  {
    name: 'sheets_append_values',
    description: 'Append new rows to the end of existing data in a sheet.',
    category: 'sheets',
    parameters: {
      spreadsheet_id: { type: 'string', required: true,  description: 'Google Spreadsheet ID.' },
      range:          { type: 'string', required: true,  description: "Range or sheet name to append to (e.g. 'Sheet1')." },
      values:         { type: 'string', required: true,  description: 'JSON-encoded 2D array of rows to append, e.g. [[\"Bob\",25],[\"Carol\",31]].' },
    },
  },
  {
    name: 'sheets_clear_range',
    description: 'Clear all values from a range in a Google Spreadsheet (leaves formatting intact).',
    category: 'sheets',
    parameters: {
      spreadsheet_id: { type: 'string', required: true, description: 'Google Spreadsheet ID.' },
      range:          { type: 'string', required: true, description: "Range to clear in A1 notation (e.g. 'Sheet1!A1:Z100')." },
    },
  },
  {
    name: 'sheets_create_spreadsheet',
    description: 'Create a new Google Spreadsheet.',
    category: 'sheets',
    parameters: {
      title:        { type: 'string', required: true,  description: 'Title for the new spreadsheet.' },
      sheet_titles: { type: 'string', required: false, description: 'Comma-separated names for the initial sheets (e.g. "January,February,March").' },
    },
  },
  {
    name: 'sheets_add_sheet',
    description: 'Add a new sheet (tab) to an existing Google Spreadsheet.',
    category: 'sheets',
    parameters: {
      spreadsheet_id: { type: 'string', required: true, description: 'Google Spreadsheet ID.' },
      title:          { type: 'string', required: true, description: 'Name for the new sheet.' },
    },
  },
  {
    name: 'sheets_delete_sheet',
    description: 'Delete a sheet (tab) from a Google Spreadsheet by its sheet ID.',
    category: 'sheets',
    parameters: {
      spreadsheet_id: { type: 'string', required: true, description: 'Google Spreadsheet ID.' },
      sheet_id:       { type: 'number', required: true, description: 'Numeric sheet ID (not the name — get from sheets_list_sheets).' },
    },
  },
  {
    name: 'sheets_rename_sheet',
    description: 'Rename a sheet (tab) inside a Google Spreadsheet.',
    category: 'sheets',
    parameters: {
      spreadsheet_id: { type: 'string', required: true, description: 'Google Spreadsheet ID.' },
      sheet_id:       { type: 'number', required: true, description: 'Numeric sheet ID (get from sheets_list_sheets).' },
      new_title:      { type: 'string', required: true, description: 'New name for the sheet.' },
    },
  },
];
