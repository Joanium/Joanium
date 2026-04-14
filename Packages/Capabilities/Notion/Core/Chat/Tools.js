export const NOTION_TOOLS = [
  // ─── Pages ─────────────────────────────────────────────────────────────────
  {
    name: 'notion_search_pages',
    description: 'Search Notion pages and return their titles, URLs, and last-edited times.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      query: {
        type: 'string',
        required: false,
        description: 'Search query. Leave blank to get the most recently edited pages.',
      },
    },
  },
  {
    name: 'notion_get_page',
    description:
      'Retrieve full metadata for a single Notion page by its ID, including all properties, URL, and timestamps.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      page_id: {
        type: 'string',
        required: true,
        description: 'The Notion page ID (UUID format).',
      },
    },
  },
  {
    name: 'notion_create_page',
    description: 'Create a new Notion page as a child of an existing page or database.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      parent_id: {
        type: 'string',
        required: true,
        description: 'ID of the parent page or database.',
      },
      parent_type: {
        type: 'string',
        required: false,
        description: 'Either "page_id" (default) or "database_id".',
      },
      title: {
        type: 'string',
        required: false,
        description: 'Title of the new page.',
      },
    },
  },
  {
    name: 'notion_update_page_title',
    description: 'Rename an existing Notion page by updating its title property.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      page_id: {
        type: 'string',
        required: true,
        description: 'The ID of the page to rename.',
      },
      new_title: {
        type: 'string',
        required: true,
        description: 'The new title for the page.',
      },
    },
  },
  {
    name: 'notion_archive_page',
    description:
      'Archive (soft-delete) a Notion page so it no longer appears in search or the workspace.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      page_id: {
        type: 'string',
        required: true,
        description: 'The ID of the page to archive.',
      },
    },
  },
  {
    name: 'notion_get_page_property',
    description: 'Retrieve the value of a specific property on a Notion page by property ID.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      page_id: {
        type: 'string',
        required: true,
        description: 'The Notion page ID.',
      },
      property_id: {
        type: 'string',
        required: true,
        description: 'The property ID to retrieve (visible in notion_get_page results).',
      },
    },
  },
  {
    name: 'notion_create_page_with_content',
    description:
      'Create a new Notion page and immediately populate it with one or more paragraph blocks of text.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      parent_id: {
        type: 'string',
        required: true,
        description: 'ID of the parent page.',
      },
      title: {
        type: 'string',
        required: false,
        description: 'Title of the new page.',
      },
      content_blocks: {
        type: 'array',
        required: true,
        description: 'Array of strings — each becomes a paragraph block in the page body.',
      },
    },
  },

  // ─── Blocks ─────────────────────────────────────────────────────────────────
  {
    name: 'notion_get_page_content',
    description:
      'Retrieve all top-level content blocks of a Notion page, including their type, text, and whether they have nested children.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      block_id: {
        type: 'string',
        required: true,
        description: 'Page ID or block ID to read children from.',
      },
      limit: {
        type: 'number',
        required: false,
        description: 'Maximum number of blocks to return (default 50).',
      },
    },
  },
  {
    name: 'notion_append_text_block',
    description: 'Append a plain paragraph of text to the end of a Notion page or block.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      block_id: {
        type: 'string',
        required: true,
        description: 'ID of the page or block to append to.',
      },
      text: {
        type: 'string',
        required: true,
        description: 'The paragraph text to append.',
      },
    },
  },
  {
    name: 'notion_append_todo_block',
    description: 'Append a to-do (checkbox) item to a Notion page or block.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      block_id: {
        type: 'string',
        required: true,
        description: 'ID of the page or block to append to.',
      },
      text: {
        type: 'string',
        required: true,
        description: 'The to-do item text.',
      },
      checked: {
        type: 'boolean',
        required: false,
        description: 'Whether the to-do should start as checked. Defaults to false.',
      },
    },
  },
  {
    name: 'notion_append_heading_block',
    description: 'Append a heading (H1, H2, or H3) to a Notion page or block.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      block_id: {
        type: 'string',
        required: true,
        description: 'ID of the page or block to append to.',
      },
      text: {
        type: 'string',
        required: true,
        description: 'Heading text.',
      },
      level: {
        type: 'number',
        required: false,
        description: 'Heading level: 1, 2, or 3. Defaults to 2.',
      },
    },
  },
  {
    name: 'notion_append_bullet_list',
    description: 'Append one or more bulleted list items to a Notion page or block.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      block_id: {
        type: 'string',
        required: true,
        description: 'ID of the page or block to append to.',
      },
      items: {
        type: 'array',
        required: true,
        description: 'Array of strings — each becomes a separate bullet item.',
      },
    },
  },
  {
    name: 'notion_append_numbered_list',
    description: 'Append one or more numbered list items to a Notion page or block.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      block_id: {
        type: 'string',
        required: true,
        description: 'ID of the page or block to append to.',
      },
      items: {
        type: 'array',
        required: true,
        description: 'Array of strings — each becomes a sequential numbered list item.',
      },
    },
  },
  {
    name: 'notion_append_code_block',
    description: 'Append a code block with syntax highlighting to a Notion page or block.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      block_id: {
        type: 'string',
        required: true,
        description: 'ID of the page or block to append to.',
      },
      code: {
        type: 'string',
        required: true,
        description: 'The code content to display.',
      },
      language: {
        type: 'string',
        required: false,
        description:
          'Programming language for syntax highlighting (e.g. "javascript", "python"). Defaults to "plain text".',
      },
    },
  },
  {
    name: 'notion_append_divider',
    description:
      'Append a horizontal divider line to a Notion page or block to visually separate sections.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      block_id: {
        type: 'string',
        required: true,
        description: 'ID of the page or block to append the divider to.',
      },
    },
  },
  {
    name: 'notion_delete_block',
    description:
      'Permanently delete (archive) a specific block from a Notion page by its block ID.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      block_id: {
        type: 'string',
        required: true,
        description: 'The ID of the block to delete.',
      },
    },
  },
  {
    name: 'notion_get_block_children',
    description:
      'Retrieve the nested child blocks of any Notion block, useful for reading toggle lists, columns, or synced blocks.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      block_id: {
        type: 'string',
        required: true,
        description: 'The parent block ID whose children you want to retrieve.',
      },
      limit: {
        type: 'number',
        required: false,
        description: 'Maximum number of child blocks to return (default 50).',
      },
    },
  },

  // ─── Databases ───────────────────────────────────────────────────────────────
  {
    name: 'notion_search_databases',
    description:
      'List all Notion databases the integration can access, sorted by most recently edited.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      limit: {
        type: 'number',
        required: false,
        description: 'Maximum number of databases to return (default 20).',
      },
    },
  },
  {
    name: 'notion_get_database',
    description: 'Retrieve metadata and property names for a specific Notion database.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      database_id: {
        type: 'string',
        required: true,
        description: 'The Notion database ID.',
      },
    },
  },
  {
    name: 'notion_get_database_schema',
    description:
      'Return the full property schema (column definitions) of a Notion database, including each property name, type, and ID.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      database_id: {
        type: 'string',
        required: true,
        description: 'The Notion database ID.',
      },
    },
  },
  {
    name: 'notion_query_database',
    description:
      'Retrieve all entries (pages) in a Notion database, returning their IDs, URLs, and raw properties.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      database_id: {
        type: 'string',
        required: true,
        description: 'The Notion database ID to query.',
      },
      limit: {
        type: 'number',
        required: false,
        description: 'Maximum number of entries to return (default 20).',
      },
    },
  },
  {
    name: 'notion_filter_database',
    description:
      'Query a Notion database with a filter condition, such as matching a select property, checkbox, date range, or text value.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      database_id: {
        type: 'string',
        required: true,
        description: 'The Notion database ID to filter.',
      },
      filter: {
        type: 'object',
        required: true,
        description:
          'A Notion filter object, e.g. { "property": "Status", "select": { "equals": "In Progress" } }.',
      },
      limit: {
        type: 'number',
        required: false,
        description: 'Maximum number of results (default 20).',
      },
    },
  },
  {
    name: 'notion_create_database',
    description:
      'Create a new inline Notion database as a child of an existing page, with a given title and optional property schema.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      parent_page_id: {
        type: 'string',
        required: true,
        description: 'ID of the page that will contain the new database.',
      },
      title: {
        type: 'string',
        required: true,
        description: 'Title of the new database.',
      },
      properties: {
        type: 'object',
        required: false,
        description:
          'Optional Notion property schema object for additional columns (Name/title column is always added automatically).',
      },
    },
  },
  {
    name: 'notion_create_database_entry',
    description:
      'Create a new row (page) in a Notion database with a title and optional property values.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      database_id: {
        type: 'string',
        required: true,
        description: 'The Notion database ID to add the entry to.',
      },
      title: {
        type: 'string',
        required: false,
        description: 'Value for the Name/title property of the new entry.',
      },
      properties: {
        type: 'object',
        required: false,
        description:
          'Additional Notion property values to set on the entry (using Notion property value shape).',
      },
    },
  },
  {
    name: 'notion_update_database_entry',
    description: 'Update one or more property values on an existing Notion database entry (page).',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      page_id: {
        type: 'string',
        required: true,
        description: 'The page ID of the database entry to update.',
      },
      properties: {
        type: 'object',
        required: true,
        description: 'Notion property values to update, keyed by property name.',
      },
    },
  },
  {
    name: 'notion_archive_database_entry',
    description:
      'Archive (remove) an entry from a Notion database without permanently deleting it.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      page_id: {
        type: 'string',
        required: true,
        description: 'The page ID of the database entry to archive.',
      },
    },
  },

  // ─── Comments ────────────────────────────────────────────────────────────────
  {
    name: 'notion_get_comments',
    description: 'Retrieve all comments on a Notion page, including their text and timestamps.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      block_id: {
        type: 'string',
        required: true,
        description: 'The page or block ID to fetch comments for.',
      },
    },
  },
  {
    name: 'notion_add_comment',
    description: 'Post a new comment on a Notion page.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      page_id: {
        type: 'string',
        required: true,
        description: 'The page ID to comment on.',
      },
      text: {
        type: 'string',
        required: true,
        description: 'The comment text to post.',
      },
    },
  },

  // ─── Users ───────────────────────────────────────────────────────────────────
  {
    name: 'notion_get_users',
    description:
      'List all members (people and bots) in the Notion workspace, including their names and email addresses.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      limit: {
        type: 'number',
        required: false,
        description: 'Maximum number of users to return (default 50).',
      },
    },
  },
  {
    name: 'notion_get_user',
    description:
      'Retrieve profile information for a specific Notion workspace member by their user ID.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      user_id: {
        type: 'string',
        required: true,
        description: 'The Notion user ID (UUID format).',
      },
    },
  },
  {
    name: 'notion_get_bot_info',
    description:
      "Return information about the integration's bot user, including its name and the workspace it belongs to.",
    category: 'notion',
    connectorId: 'notion',
    parameters: {},
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── NEW TOOLS (30) ────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Pages (new) ─────────────────────────────────────────────────────────────

  {
    name: 'notion_restore_page',
    description:
      'Restore (un-archive) a previously archived Notion page, making it visible in search and the workspace again.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      page_id: {
        type: 'string',
        required: true,
        description: 'The ID of the archived page to restore.',
      },
    },
  },
  {
    name: 'notion_set_page_icon',
    description:
      'Set or replace the icon on a Notion page — either an emoji character or an external image URL.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      page_id: {
        type: 'string',
        required: true,
        description: 'The page ID to update.',
      },
      type: {
        type: 'string',
        required: false,
        description: '"emoji" (default) or "external" for an image URL.',
      },
      value: {
        type: 'string',
        required: true,
        description: 'The emoji character (e.g. "🚀") or the image URL if type is "external".',
      },
    },
  },
  {
    name: 'notion_set_page_cover',
    description: 'Set or replace the cover image on a Notion page using an external image URL.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      page_id: {
        type: 'string',
        required: true,
        description: 'The page ID to update.',
      },
      image_url: {
        type: 'string',
        required: true,
        description: 'Publicly accessible URL of the cover image.',
      },
    },
  },
  {
    name: 'notion_update_page_properties',
    description:
      'Update one or more properties on a Notion page using the full Notion property value shape. Useful for updating checkboxes, selects, dates, relations, and other typed fields.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      page_id: {
        type: 'string',
        required: true,
        description: 'The page ID to update.',
      },
      properties: {
        type: 'object',
        required: true,
        description:
          'Map of property names to Notion property value objects, e.g. { "Done": { "checkbox": true } }.',
      },
    },
  },
  {
    name: 'notion_get_child_pages',
    description:
      'List all immediate sub-pages nested inside a Notion page. Returns their IDs and titles.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      page_id: {
        type: 'string',
        required: true,
        description: 'The parent page ID to look for child pages in.',
      },
    },
  },

  // ─── Blocks (new) ────────────────────────────────────────────────────────────

  {
    name: 'notion_get_block',
    description:
      'Retrieve a single Notion block by its ID, including its type, text content, and metadata.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      block_id: {
        type: 'string',
        required: true,
        description: 'The block ID to fetch.',
      },
    },
  },
  {
    name: 'notion_update_block_text',
    description:
      'Update the text content of an existing Notion block in-place. Works for paragraphs, headings, bullets, numbered items, to-dos, toggles, quotes, and callouts.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      block_id: {
        type: 'string',
        required: true,
        description: 'The block ID to update.',
      },
      text: {
        type: 'string',
        required: true,
        description: 'The new text content for the block.',
      },
    },
  },
  {
    name: 'notion_get_full_page_content',
    description:
      'Recursively fetch all blocks in a Notion page up to a configurable depth, returning a nested tree. Useful for reading complex pages with toggles, columns, or nested content.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      page_id: {
        type: 'string',
        required: true,
        description: 'The page ID to read.',
      },
      depth: {
        type: 'number',
        required: false,
        description: 'How many levels of nesting to fetch (default 2, max recommended 3).',
      },
    },
  },
  {
    name: 'notion_export_page_as_text',
    description:
      'Read a Notion page and return its full content as a single plain-text string. Ideal for summarising, searching, or passing page content to another tool.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      page_id: {
        type: 'string',
        required: true,
        description: 'The page ID to export.',
      },
    },
  },
  {
    name: 'notion_clear_page_content',
    description:
      'Delete all top-level blocks from a Notion page, leaving it blank. Use with caution — this cannot be undone via the API.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      page_id: {
        type: 'string',
        required: true,
        description: 'The page ID to clear.',
      },
    },
  },
  {
    name: 'notion_append_toggle_block',
    description:
      'Append a collapsible toggle block to a Notion page or block. Users can expand it to reveal nested content.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      block_id: {
        type: 'string',
        required: true,
        description: 'ID of the page or block to append to.',
      },
      text: {
        type: 'string',
        required: true,
        description: 'The toggle label text shown when collapsed.',
      },
    },
  },
  {
    name: 'notion_append_callout_block',
    description:
      'Append a callout block (highlighted box with an emoji icon) to a Notion page or block. Great for tips, warnings, or notices.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      block_id: {
        type: 'string',
        required: true,
        description: 'ID of the page or block to append to.',
      },
      text: {
        type: 'string',
        required: true,
        description: 'The callout message text.',
      },
      emoji: {
        type: 'string',
        required: false,
        description: 'Emoji icon for the callout (default: 💡).',
      },
    },
  },
  {
    name: 'notion_append_quote_block',
    description: 'Append a styled block quote to a Notion page or block.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      block_id: {
        type: 'string',
        required: true,
        description: 'ID of the page or block to append to.',
      },
      text: {
        type: 'string',
        required: true,
        description: 'The quoted text.',
      },
    },
  },
  {
    name: 'notion_append_image_block',
    description:
      'Append an external image to a Notion page or block using a publicly accessible image URL.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      block_id: {
        type: 'string',
        required: true,
        description: 'ID of the page or block to append to.',
      },
      image_url: {
        type: 'string',
        required: true,
        description: 'Publicly accessible URL of the image to embed.',
      },
    },
  },
  {
    name: 'notion_append_video_block',
    description:
      'Append an external video to a Notion page or block (e.g. a YouTube or Vimeo URL).',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      block_id: {
        type: 'string',
        required: true,
        description: 'ID of the page or block to append to.',
      },
      video_url: {
        type: 'string',
        required: true,
        description: 'URL of the video to embed (YouTube, Vimeo, etc.).',
      },
    },
  },
  {
    name: 'notion_append_embed_block',
    description:
      'Append an embed block to a Notion page, rendering an external URL inline (e.g. Figma boards, Google Maps, CodePen).',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      block_id: {
        type: 'string',
        required: true,
        description: 'ID of the page or block to append to.',
      },
      url: {
        type: 'string',
        required: true,
        description: 'The URL to embed.',
      },
    },
  },
  {
    name: 'notion_append_bookmark_block',
    description:
      'Append a bookmark card to a Notion page. Notion will automatically fetch the page title and preview from the URL.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      block_id: {
        type: 'string',
        required: true,
        description: 'ID of the page or block to append to.',
      },
      url: {
        type: 'string',
        required: true,
        description: 'The URL to bookmark.',
      },
      caption: {
        type: 'string',
        required: false,
        description: 'Optional caption text displayed below the bookmark.',
      },
    },
  },
  {
    name: 'notion_append_table_of_contents',
    description:
      'Append a table of contents block to a Notion page. It auto-generates links from all heading blocks on the page.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      block_id: {
        type: 'string',
        required: true,
        description: 'ID of the page or block to append the table of contents to.',
      },
    },
  },
  {
    name: 'notion_append_table_block',
    description:
      'Append a table with a header row to a Notion page or block. Provide column headers and any data rows.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      block_id: {
        type: 'string',
        required: true,
        description: 'ID of the page or block to append to.',
      },
      headers: {
        type: 'array',
        required: true,
        description: 'Array of column header strings, e.g. ["Name", "Status", "Due Date"].',
      },
      rows: {
        type: 'array',
        required: false,
        description:
          'Array of rows, where each row is an array of cell strings matching the header count.',
      },
    },
  },

  // ─── Databases (new) ─────────────────────────────────────────────────────────

  {
    name: 'notion_sort_database',
    description:
      'Query a Notion database with a sort order applied, returning entries ordered by one or more properties.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      database_id: {
        type: 'string',
        required: true,
        description: 'The Notion database ID to query.',
      },
      sorts: {
        type: 'array',
        required: true,
        description:
          'Array of Notion sort objects, e.g. [{ "property": "Due Date", "direction": "ascending" }].',
      },
      limit: {
        type: 'number',
        required: false,
        description: 'Maximum number of results (default 20).',
      },
    },
  },
  {
    name: 'notion_filter_and_sort_database',
    description:
      'Query a Notion database applying both a filter condition and a sort order simultaneously.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      database_id: {
        type: 'string',
        required: true,
        description: 'The Notion database ID to query.',
      },
      filter: {
        type: 'object',
        required: true,
        description: 'A Notion filter object to narrow results.',
      },
      sorts: {
        type: 'array',
        required: true,
        description: 'Array of Notion sort objects to order results.',
      },
      limit: {
        type: 'number',
        required: false,
        description: 'Maximum number of results (default 20).',
      },
    },
  },
  {
    name: 'notion_search_database_by_title',
    description:
      'Search for entries inside a specific Notion database whose Name/title property contains a given string.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      database_id: {
        type: 'string',
        required: true,
        description: 'The Notion database ID to search within.',
      },
      query: {
        type: 'string',
        required: true,
        description: 'Substring to match against the title/Name property of each entry.',
      },
      limit: {
        type: 'number',
        required: false,
        description: 'Maximum number of results (default 20).',
      },
    },
  },
  {
    name: 'notion_count_database_entries',
    description:
      'Count the total number of entries in a Notion database, optionally filtered by a condition. Paginates internally to return an accurate total.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      database_id: {
        type: 'string',
        required: true,
        description: 'The Notion database ID.',
      },
      filter: {
        type: 'object',
        required: false,
        description: 'Optional Notion filter object to count only matching entries.',
      },
    },
  },
  {
    name: 'notion_update_database',
    description: "Update a Notion database's title or description.",
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      database_id: {
        type: 'string',
        required: true,
        description: 'The Notion database ID to update.',
      },
      title: {
        type: 'string',
        required: false,
        description: 'New title for the database.',
      },
      description: {
        type: 'string',
        required: false,
        description: 'New description for the database.',
      },
    },
  },
  {
    name: 'notion_bulk_create_database_entries',
    description:
      'Create multiple entries in a Notion database in a single call. Useful for importing lists of items.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      database_id: {
        type: 'string',
        required: true,
        description: 'The Notion database ID to add entries to.',
      },
      entries: {
        type: 'array',
        required: true,
        description:
          'Array of entry objects, each with an optional "title" string and optional "properties" object.',
      },
    },
  },
  {
    name: 'notion_restore_database_entry',
    description:
      'Restore (un-archive) a previously archived Notion database entry, making it visible in the database again.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      page_id: {
        type: 'string',
        required: true,
        description: 'The page ID of the archived database entry to restore.',
      },
    },
  },

  // ─── Search (new) ────────────────────────────────────────────────────────────

  {
    name: 'notion_search_all',
    description:
      'Search all Notion content — both pages and databases — by a query string. Returns a unified list with a type field indicating whether each result is a page or database.',
    category: 'notion',
    connectorId: 'notion',
    parameters: {
      query: {
        type: 'string',
        required: false,
        description: 'Search query. Leave blank to get the most recently edited content.',
      },
      limit: {
        type: 'number',
        required: false,
        description: 'Maximum number of results to return (default 20).',
      },
    },
  },

  // ─── Workspace (new) ─────────────────────────────────────────────────────────

  {
    name: 'notion_get_workspace_info',
    description:
      "Return workspace-level information derived from the integration's bot user, including the workspace name and bot identity.",
    category: 'notion',
    connectorId: 'notion',
    parameters: {},
  },
];
