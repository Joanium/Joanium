export const DOCS_TOOLS = [
  {
    name: 'docs_get_info',
    description:
      'Get metadata about a Google Doc — title, document ID, character count, and a direct edit link.',
    category: 'docs',
    parameters: {
      document_id: {
        type: 'string',
        required: !0,
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
      document_id: { type: 'string', required: !0, description: 'Google Doc document ID.' },
    },
  },
  {
    name: 'docs_word_count',
    description: 'Return word count, character count, and paragraph count for a Google Doc.',
    category: 'docs',
    parameters: {
      document_id: { type: 'string', required: !0, description: 'Google Doc document ID.' },
    },
  },
  {
    name: 'docs_get_outline',
    description:
      'Extract all headings from a Google Doc and return them as a structured outline with heading level and character indices.',
    category: 'docs',
    parameters: {
      document_id: { type: 'string', required: !0, description: 'Google Doc document ID.' },
    },
  },
  {
    name: 'docs_search_text',
    description:
      'Find all occurrences of a search string in a Google Doc and return each match with its start and end character index. Useful before calling docs_delete_range or docs_apply_text_style.',
    category: 'docs',
    parameters: {
      document_id: { type: 'string', required: !0, description: 'Google Doc document ID.' },
      query: {
        type: 'string',
        required: !0,
        description: 'The string to search for (case-sensitive).',
      },
    },
  },
  {
    name: 'docs_list_named_ranges',
    description:
      'List all named ranges defined in a Google Doc, including their character indices.',
    category: 'docs',
    parameters: {
      document_id: { type: 'string', required: !0, description: 'Google Doc document ID.' },
    },
  },
  {
    name: 'docs_create',
    description: 'Create a new blank Google Doc with a given title.',
    category: 'docs',
    parameters: {
      title: { type: 'string', required: !0, description: 'Title for the new document.' },
    },
  },
  {
    name: 'docs_append_text',
    description: 'Append text to the end of an existing Google Doc.',
    category: 'docs',
    parameters: {
      document_id: { type: 'string', required: !0, description: 'Google Doc document ID.' },
      text: { type: 'string', required: !0, description: 'Text content to append.' },
    },
  },
  {
    name: 'docs_prepend_text',
    description: 'Insert text at the very beginning of an existing Google Doc.',
    category: 'docs',
    parameters: {
      document_id: { type: 'string', required: !0, description: 'Google Doc document ID.' },
      text: { type: 'string', required: !0, description: 'Text content to prepend.' },
    },
  },
  {
    name: 'docs_insert_text',
    description:
      'Insert text at a specific character index in a Google Doc. Use docs_read or docs_search_text first to identify the correct index. Index 1 is the very start of the document body.',
    category: 'docs',
    parameters: {
      document_id: { type: 'string', required: !0, description: 'Google Doc document ID.' },
      text: { type: 'string', required: !0, description: 'Text content to insert.' },
      index: {
        type: 'number',
        required: !1,
        description: 'Character index at which to insert. Defaults to 1 (start of body).',
      },
    },
  },
  {
    name: 'docs_batch_insert_text',
    description:
      'Insert multiple text snippets into a Google Doc in a single API call. More efficient than calling docs_insert_text repeatedly. Indices are automatically sorted descending to avoid offset shifting.',
    category: 'docs',
    parameters: {
      document_id: { type: 'string', required: !0, description: 'Google Doc document ID.' },
      insertions: {
        type: 'array',
        required: !0,
        description:
          'Array of objects, each with an `index` (number) and `text` (string) property.',
      },
    },
  },
  {
    name: 'docs_replace_text',
    description: 'Find and replace all occurrences of a string in a Google Doc.',
    category: 'docs',
    parameters: {
      document_id: { type: 'string', required: !0, description: 'Google Doc document ID.' },
      search_text: {
        type: 'string',
        required: !0,
        description: 'The text to search for (case-sensitive).',
      },
      replacement: { type: 'string', required: !0, description: 'The text to replace it with.' },
    },
  },
  {
    name: 'docs_delete_range',
    description:
      'Delete a range of characters from a Google Doc by start and end index. Use docs_search_text first to identify the correct indices.',
    category: 'docs',
    parameters: {
      document_id: { type: 'string', required: !0, description: 'Google Doc document ID.' },
      start_index: {
        type: 'number',
        required: !0,
        description: 'Inclusive start character index of the range to delete.',
      },
      end_index: {
        type: 'number',
        required: !0,
        description: 'Exclusive end character index of the range to delete.',
      },
    },
  },
  {
    name: 'docs_clear_content',
    description:
      'Delete all body text from a Google Doc, leaving it blank. This is irreversible — confirm with the user before calling.',
    category: 'docs',
    parameters: {
      document_id: { type: 'string', required: !0, description: 'Google Doc document ID.' },
    },
  },
  {
    name: 'docs_apply_text_style',
    description:
      'Apply inline text formatting to a character range in a Google Doc. Supports bold, italic, underline, strikethrough, font size (PT), font family, and foreground color (hex). Use docs_search_text first to find the right indices.',
    category: 'docs',
    parameters: {
      document_id: { type: 'string', required: !0, description: 'Google Doc document ID.' },
      start_index: {
        type: 'number',
        required: !0,
        description: 'Inclusive start of the character range.',
      },
      end_index: {
        type: 'number',
        required: !0,
        description: 'Exclusive end of the character range.',
      },
      bold: { type: 'boolean', required: !1, description: 'Set text bold.' },
      italic: { type: 'boolean', required: !1, description: 'Set text italic.' },
      underline: { type: 'boolean', required: !1, description: 'Set text underline.' },
      strikethrough: { type: 'boolean', required: !1, description: 'Set text strikethrough.' },
      font_size_pt: {
        type: 'number',
        required: !1,
        description: 'Font size in points (e.g. 12, 18, 24).',
      },
      font_family: {
        type: 'string',
        required: !1,
        description: 'Font family name (e.g. "Arial", "Georgia").',
      },
      foreground_color_hex: {
        type: 'string',
        required: !1,
        description: 'Text color as a hex string, e.g. "#FF0000" for red.',
      },
    },
  },
  {
    name: 'docs_apply_paragraph_style',
    description:
      'Apply paragraph-level styling to all paragraphs overlapping a character range. Supports heading level, alignment, and line spacing.',
    category: 'docs',
    parameters: {
      document_id: { type: 'string', required: !0, description: 'Google Doc document ID.' },
      start_index: {
        type: 'number',
        required: !0,
        description: 'Inclusive start of the character range.',
      },
      end_index: {
        type: 'number',
        required: !0,
        description: 'Exclusive end of the character range.',
      },
      named_style_type: {
        type: 'string',
        required: !1,
        description:
          'One of: NORMAL_TEXT, TITLE, SUBTITLE, HEADING_1, HEADING_2, HEADING_3, HEADING_4, HEADING_5, HEADING_6.',
      },
      alignment: {
        type: 'string',
        required: !1,
        description: 'One of: START, CENTER, END, JUSTIFIED.',
      },
      line_spacing: {
        type: 'number',
        required: !1,
        description: 'Line spacing as a percentage (100 = single, 150 = 1.5x, 200 = double).',
      },
    },
  },
  {
    name: 'docs_create_bullet_list',
    description:
      'Apply a bullet or numbered list style to all paragraphs overlapping a character range.',
    category: 'docs',
    parameters: {
      document_id: { type: 'string', required: !0, description: 'Google Doc document ID.' },
      start_index: {
        type: 'number',
        required: !0,
        description: 'Inclusive start of the range to bullet.',
      },
      end_index: {
        type: 'number',
        required: !0,
        description: 'Exclusive end of the range to bullet.',
      },
      bullet_preset: {
        type: 'string',
        required: !1,
        description:
          'List preset. Bullets: BULLET_DISC_CIRCLE_SQUARE (default), BULLET_ARROW_DIAMOND_DISC, BULLET_STAR_CIRCLE_SQUARE. Numbered: NUMBERED_DECIMAL_ALPHA_ROMAN, NUMBERED_DECIMAL_NESTED, NUMBERED_UPPERALPHA_ALPHA_ROMAN.',
      },
    },
  },
  {
    name: 'docs_remove_bullet_list',
    description: 'Remove bullet or list formatting from all paragraphs in a character range.',
    category: 'docs',
    parameters: {
      document_id: { type: 'string', required: !0, description: 'Google Doc document ID.' },
      start_index: { type: 'number', required: !0, description: 'Inclusive start of the range.' },
      end_index: { type: 'number', required: !0, description: 'Exclusive end of the range.' },
    },
  },
  {
    name: 'docs_insert_table',
    description:
      'Insert an empty N×M table at a specific character index in a Google Doc. Cell content can be added afterwards with docs_insert_text.',
    category: 'docs',
    parameters: {
      document_id: { type: 'string', required: !0, description: 'Google Doc document ID.' },
      rows: { type: 'number', required: !0, description: 'Number of rows (minimum 1).' },
      columns: { type: 'number', required: !0, description: 'Number of columns (minimum 1).' },
      index: {
        type: 'number',
        required: !1,
        description: 'Character index at which to insert the table. Defaults to 1.',
      },
    },
  },
  {
    name: 'docs_insert_page_break',
    description: 'Insert a page break at a specific character index in a Google Doc.',
    category: 'docs',
    parameters: {
      document_id: { type: 'string', required: !0, description: 'Google Doc document ID.' },
      index: {
        type: 'number',
        required: !1,
        description: 'Character index at which to insert the page break. Defaults to 1.',
      },
    },
  },
  {
    name: 'docs_insert_inline_image',
    description:
      'Insert an image from a publicly accessible URL into a Google Doc at a specific character index.',
    category: 'docs',
    parameters: {
      document_id: { type: 'string', required: !0, description: 'Google Doc document ID.' },
      image_url: {
        type: 'string',
        required: !0,
        description: 'Publicly accessible URL of the image to embed.',
      },
      index: {
        type: 'number',
        required: !1,
        description: 'Character index at which to insert the image. Defaults to 1.',
      },
      width_pt: {
        type: 'number',
        required: !1,
        description: 'Desired image width in points. Omit to use the natural size.',
      },
      height_pt: {
        type: 'number',
        required: !1,
        description: 'Desired image height in points. Omit to use the natural size.',
      },
    },
  },
  {
    name: 'docs_create_named_range',
    description:
      'Create a named range (bookmark) over a character range in a Google Doc. Useful for marking sections to update later by name.',
    category: 'docs',
    parameters: {
      document_id: { type: 'string', required: !0, description: 'Google Doc document ID.' },
      name: { type: 'string', required: !0, description: 'Name for the range.' },
      start_index: {
        type: 'number',
        required: !0,
        description: 'Inclusive start character index.',
      },
      end_index: { type: 'number', required: !0, description: 'Exclusive end character index.' },
    },
  },
  {
    name: 'docs_delete_named_range',
    description: 'Delete a named range from a Google Doc by name.',
    category: 'docs',
    parameters: {
      document_id: { type: 'string', required: !0, description: 'Google Doc document ID.' },
      name: { type: 'string', required: !0, description: 'Name of the range to delete.' },
    },
  },
  {
    name: 'docs_update_page_size',
    description:
      'Change the page dimensions of a Google Doc. Common sizes in points — A4: 595×842, Letter: 612×792, Legal: 612×1008. Swap width/height for landscape orientation.',
    category: 'docs',
    parameters: {
      document_id: { type: 'string', required: !0, description: 'Google Doc document ID.' },
      width_pt: { type: 'number', required: !0, description: 'Page width in points.' },
      height_pt: { type: 'number', required: !0, description: 'Page height in points.' },
    },
  },
  {
    name: 'docs_update_margins',
    description:
      'Change the page margins of a Google Doc. All values are in points (72 pt = 1 inch). Default Google Docs margins are 72 pt on all sides.',
    category: 'docs',
    parameters: {
      document_id: { type: 'string', required: !0, description: 'Google Doc document ID.' },
      top_pt: { type: 'number', required: !1, description: 'Top margin in points.' },
      bottom_pt: { type: 'number', required: !1, description: 'Bottom margin in points.' },
      left_pt: { type: 'number', required: !1, description: 'Left (start) margin in points.' },
      right_pt: { type: 'number', required: !1, description: 'Right (end) margin in points.' },
    },
  },
];
