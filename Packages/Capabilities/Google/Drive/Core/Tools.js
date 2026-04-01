export const DRIVE_TOOLS = [
  {
    name: 'drive_list_files',
    description: "List files in the user's Google Drive. Can filter by folder or file type.",
    category: 'drive',
    parameters: {
      folder_id: { type: 'string', required: false, description: 'Optional folder ID to list files inside. Omit for root.' },
      max_results: { type: 'number', required: false, description: 'Max number of files to return (default: 20).' },
    },
  },
  {
    name: 'drive_search_files',
    description: "Search for files in the user's Google Drive by name or content.",
    category: 'drive',
    parameters: {
      query: { type: 'string', required: true, description: 'Search term - matches file names and content.' },
      max_results: { type: 'number', required: false, description: 'Max number of results (default: 20).' },
    },
  },
  {
    name: 'drive_read_file',
    description: 'Read the text content of a Google Drive file. Works for Docs, Sheets, plain text, JSON, CSV, and code files.',
    category: 'drive',
    parameters: {
      file_id: { type: 'string', required: true, description: 'Google Drive file ID.' },
    },
  },
  {
    name: 'drive_get_storage',
    description: "Check the user's Google Drive storage quota - how much space is used and available.",
    category: 'drive',
    parameters: {},
  },
  {
    name: 'drive_create_file',
    description: 'Create a new text file in Google Drive.',
    category: 'drive',
    parameters: {
      name: { type: 'string', required: true, description: 'File name (e.g. "notes.txt").' },
      content: { type: 'string', required: true, description: 'Text content of the file.' },
      folder_id: { type: 'string', required: false, description: 'Optional folder ID to create the file in.' },
    },
  },
  {
    name: 'drive_list_folders',
    description: "List folders in the user's Google Drive.",
    category: 'drive',
    parameters: {
      max_results: { type: 'number', required: false, description: 'Max folders to return (default: 20).' },
    },
  },
];
