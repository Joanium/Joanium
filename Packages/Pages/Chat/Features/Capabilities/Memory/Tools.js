export const MEMORY_TOOLS = [
  {
    name: 'list_personal_memory_files',
    description: 'List personal memory files and how much each file contains.',
    category: 'utility',
    parameters: {},
  },
  {
    name: 'search_personal_memory',
    description: "Search the user's personal memory files for relevant topics.",
    category: 'utility',
    parameters: {
      query: { type: 'string', required: !0, description: 'What to look for in personal memory.' },
      limit: {
        type: 'number',
        required: !1,
        description: 'Max matching files (default 5, max 12).',
      },
    },
  },
  {
    name: 'read_personal_memory_files',
    description: 'Read one or more personal memory files by filename.',
    category: 'utility',
    parameters: {
      files: { type: 'array', required: !0, description: 'Array of memory filenames to read.' },
    },
  },
];
