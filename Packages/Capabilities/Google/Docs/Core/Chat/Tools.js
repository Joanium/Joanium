export const DOCS_TOOLS = [
  {
    name: 'docs_get_info',
    description:
      'Get metadata about a Google Doc — title, document ID, character count, and a direct edit link.',
    category: 'docs',
    parameters: {
      document_id: {
        type: 'string',
        required: true,
        description: 'Google Doc document ID (from the URL).',
      },
    },
  },
  {
    name: 'docs_read',
    description:
      'Read the full text content of a Google Doc, including table text. Returns up to 30,000 characters.',
    category: 'docs',
    parameters: {
      document_id: { type: 'string', required: true, description: 'Google Doc document ID.' },
    },
  },
  {
    name: 'docs_create',
    description: 'Create a new blank Google Doc with a given title.',
    category: 'docs',
    parameters: {
      title: { type: 'string', required: true, description: 'Title for the new document.' },
    },
  },
  {
    name: 'docs_append_text',
    description: 'Append text to the end of an existing Google Doc.',
    category: 'docs',
    parameters: {
      document_id: { type: 'string', required: true, description: 'Google Doc document ID.' },
      text: { type: 'string', required: true, description: 'Text content to append.' },
    },
  },
  {
    name: 'docs_replace_text',
    description: 'Find and replace all occurrences of a string in a Google Doc.',
    category: 'docs',
    parameters: {
      document_id: { type: 'string', required: true, description: 'Google Doc document ID.' },
      search_text: {
        type: 'string',
        required: true,
        description: 'The text to search for (case-sensitive).',
      },
      replacement: { type: 'string', required: true, description: 'The text to replace it with.' },
    },
  },
];
