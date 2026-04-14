const BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

function headers(creds) {
  return {
    Authorization: `Bearer ${creds.token}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VERSION,
  };
}

async function nFetch(path, creds, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...headers(creds), ...(options.headers ?? {}) },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? `Notion API error: ${res.status}`);
  }
  return res.json();
}

// ─── Auth / Bot ────────────────────────────────────────────────────────────

export async function getBot(creds) {
  return nFetch('/users/me', creds);
}

/** Return workspace-level info derived from the bot user. */
export async function getWorkspaceInfo(creds) {
  const bot = await nFetch('/users/me', creds);
  return {
    botId: bot.id,
    botName: bot.name,
    workspaceName: bot.bot?.workspace_name ?? null,
    avatarUrl: bot.avatar_url ?? null,
  };
}

// ─── Pages ─────────────────────────────────────────────────────────────────

export async function searchPages(creds, query = '', limit = 20) {
  const data = await nFetch('/search', creds, {
    method: 'POST',
    body: JSON.stringify({
      query,
      filter: { value: 'page', property: 'object' },
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
      page_size: limit,
    }),
  });
  return (data.results ?? []).map((p) => ({
    id: p.id,
    title:
      p.properties?.title?.title?.[0]?.plain_text ??
      p.properties?.Name?.title?.[0]?.plain_text ??
      'Untitled',
    url: p.url,
    lastEdited: p.last_edited_time,
    createdTime: p.created_time,
  }));
}

/** Retrieve a single page by its ID. */
export async function getPage(creds, pageId) {
  const p = await nFetch(`/pages/${pageId}`, creds);
  return {
    id: p.id,
    title:
      p.properties?.title?.title?.[0]?.plain_text ??
      p.properties?.Name?.title?.[0]?.plain_text ??
      'Untitled',
    url: p.url,
    archived: p.archived,
    createdTime: p.created_time,
    lastEdited: p.last_edited_time,
    properties: p.properties,
  };
}

/**
 * Create a new page. parentId can be a page ID or database ID.
 * parentType: 'page_id' | 'database_id'
 */
export async function createPage(
  creds,
  { parentId, parentType = 'page_id', title, properties = {} },
) {
  const titleProp = { title: [{ type: 'text', text: { content: title ?? 'Untitled' } }] };
  const body = {
    parent: { [parentType]: parentId },
    properties:
      parentType === 'database_id' ? { ...properties, Name: titleProp } : { title: titleProp },
  };
  const p = await nFetch('/pages', creds, { method: 'POST', body: JSON.stringify(body) });
  return { id: p.id, url: p.url };
}

/** Update a page's title (works for plain pages; for DB pages use updateDatabaseEntry). */
export async function updatePageTitle(creds, pageId, newTitle) {
  const p = await nFetch(`/pages/${pageId}`, creds, {
    method: 'PATCH',
    body: JSON.stringify({
      properties: { title: [{ type: 'text', text: { content: newTitle } }] },
    }),
  });
  return { id: p.id, url: p.url };
}

/** Archive (soft-delete) a page. */
export async function archivePage(creds, pageId) {
  const p = await nFetch(`/pages/${pageId}`, creds, {
    method: 'PATCH',
    body: JSON.stringify({ archived: true }),
  });
  return { id: p.id, archived: p.archived };
}

/** Restore (un-archive) a previously archived page. */
export async function restorePage(creds, pageId) {
  const p = await nFetch(`/pages/${pageId}`, creds, {
    method: 'PATCH',
    body: JSON.stringify({ archived: false }),
  });
  return { id: p.id, archived: p.archived };
}

/** Retrieve a specific page property item by property ID. */
export async function getPageProperty(creds, pageId, propertyId) {
  return nFetch(`/pages/${pageId}/properties/${propertyId}`, creds);
}

/**
 * Create a page with initial content blocks (paragraphs).
 * contentBlocks: array of strings — each becomes a paragraph block.
 */
export async function createPageWithContent(
  creds,
  { parentId, parentType = 'page_id', title, contentBlocks = [] },
) {
  const children = contentBlocks.map((text) => ({
    object: 'block',
    type: 'paragraph',
    paragraph: { rich_text: [{ type: 'text', text: { content: text } }] },
  }));
  const body = {
    parent: { [parentType]: parentId },
    properties: { title: [{ type: 'text', text: { content: title ?? 'Untitled' } }] },
    children,
  };
  const p = await nFetch('/pages', creds, { method: 'POST', body: JSON.stringify(body) });
  return { id: p.id, url: p.url };
}

/**
 * Set the emoji or external icon on a page.
 * type: 'emoji' | 'external'
 * value: emoji character or image URL
 */
export async function setPageIcon(creds, pageId, { type = 'emoji', value }) {
  const icon =
    type === 'emoji'
      ? { type: 'emoji', emoji: value }
      : { type: 'external', external: { url: value } };
  const p = await nFetch(`/pages/${pageId}`, creds, {
    method: 'PATCH',
    body: JSON.stringify({ icon }),
  });
  return { id: p.id, url: p.url };
}

/** Set an external cover image on a page by URL. */
export async function setPageCover(creds, pageId, imageUrl) {
  const p = await nFetch(`/pages/${pageId}`, creds, {
    method: 'PATCH',
    body: JSON.stringify({ cover: { type: 'external', external: { url: imageUrl } } }),
  });
  return { id: p.id, url: p.url };
}

/**
 * Update arbitrary properties on a page using the Notion property value shape.
 * properties: { [propertyName]: <NotionPropertyValue> }
 */
export async function updatePageProperties(creds, pageId, properties) {
  const p = await nFetch(`/pages/${pageId}`, creds, {
    method: 'PATCH',
    body: JSON.stringify({ properties }),
  });
  return { id: p.id, url: p.url };
}

/**
 * Return the immediate child pages nested under a page.
 * Filters block children for child_page type blocks.
 */
export async function getChildPages(creds, pageId) {
  const data = await nFetch(`/blocks/${pageId}/children?page_size=100`, creds);
  return (data.results ?? [])
    .filter((b) => b.type === 'child_page')
    .map((b) => ({ id: b.id, title: b.child_page?.title ?? 'Untitled' }));
}

// ─── Blocks ─────────────────────────────────────────────────────────────────

/** Get all top-level block children of a page or block. */
export async function getBlockChildren(creds, blockId, limit = 50) {
  const data = await nFetch(`/blocks/${blockId}/children?page_size=${limit}`, creds);
  return (data.results ?? []).map((b) => ({
    id: b.id,
    type: b.type,
    content: extractBlockText(b),
    hasChildren: b.has_children,
    archived: b.archived,
  }));
}

function extractBlockText(block) {
  const rt = block[block.type]?.rich_text ?? block[block.type]?.text ?? [];
  return rt.map((t) => t.plain_text ?? '').join('') || null;
}

/** Retrieve a single block by its ID. */
export async function getBlock(creds, blockId) {
  const b = await nFetch(`/blocks/${blockId}`, creds);
  return {
    id: b.id,
    type: b.type,
    content: extractBlockText(b),
    hasChildren: b.has_children,
    archived: b.archived,
    createdTime: b.created_time,
    lastEdited: b.last_edited_time,
  };
}

/**
 * Update the text content of an existing text-based block.
 * Supported types: paragraph, heading_1/2/3, bulleted_list_item, numbered_list_item,
 * to_do, toggle, quote, callout.
 */
export async function updateBlockText(creds, blockId, text) {
  const block = await nFetch(`/blocks/${blockId}`, creds);
  const type = block.type;
  const supported = [
    'paragraph',
    'heading_1',
    'heading_2',
    'heading_3',
    'bulleted_list_item',
    'numbered_list_item',
    'to_do',
    'toggle',
    'quote',
    'callout',
  ];
  if (!supported.includes(type)) {
    throw new Error(`Block type "${type}" does not support text updates via this tool.`);
  }
  const updated = await nFetch(`/blocks/${blockId}`, creds, {
    method: 'PATCH',
    body: JSON.stringify({
      [type]: { rich_text: [{ type: 'text', text: { content: text } }] },
    }),
  });
  return { id: updated.id, type: updated.type };
}

/**
 * Fetch all block children recursively up to a given depth.
 * Returns a nested tree structure.
 */
export async function getFullPageContent(creds, pageId, depth = 2) {
  async function fetchBlocks(blockId, currentDepth) {
    const blocks = await getBlockChildren(creds, blockId, 100);
    if (currentDepth <= 0) return blocks;
    for (const block of blocks) {
      if (block.hasChildren) {
        block.children = await fetchBlocks(block.id, currentDepth - 1);
      }
    }
    return blocks;
  }
  const blocks = await fetchBlocks(pageId, depth);
  return { pageId, blocks };
}

/**
 * Export a page as plain text by concatenating all top-level block contents.
 * Useful for summarising or searching page content.
 */
export async function exportPageAsText(creds, pageId) {
  const page = await getPage(creds, pageId);
  const blocks = await getBlockChildren(creds, pageId, 100);
  const lines = blocks.filter((b) => b.content).map((b) => b.content);
  return { title: page.title, url: page.url, text: lines.join('\n\n') };
}

/**
 * Delete all top-level blocks from a page, effectively clearing its content.
 * Returns the number of blocks deleted.
 */
export async function clearPageContent(creds, pageId) {
  const data = await nFetch(`/blocks/${pageId}/children?page_size=100`, creds);
  const blocks = data.results ?? [];
  for (const block of blocks) {
    await nFetch(`/blocks/${block.id}`, creds, { method: 'DELETE' });
  }
  return { deleted: blocks.length };
}

/** Append a plain paragraph block to a page or block. */
export async function appendTextBlock(creds, blockId, text) {
  return appendBlocks(creds, blockId, [
    {
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: [{ type: 'text', text: { content: text } }] },
    },
  ]);
}

/** Append a to-do block. */
export async function appendTodoBlock(creds, blockId, text, checked = false) {
  return appendBlocks(creds, blockId, [
    {
      object: 'block',
      type: 'to_do',
      to_do: { rich_text: [{ type: 'text', text: { content: text } }], checked },
    },
  ]);
}

/** Append a heading block. level: 1 | 2 | 3 */
export async function appendHeadingBlock(creds, blockId, text, level = 2) {
  const type = `heading_${level}`;
  return appendBlocks(creds, blockId, [
    { object: 'block', type, [type]: { rich_text: [{ type: 'text', text: { content: text } }] } },
  ]);
}

/** Append multiple bulleted list items. items: string[] */
export async function appendBulletList(creds, blockId, items) {
  const blocks = items.map((item) => ({
    object: 'block',
    type: 'bulleted_list_item',
    bulleted_list_item: { rich_text: [{ type: 'text', text: { content: item } }] },
  }));
  return appendBlocks(creds, blockId, blocks);
}

/** Append multiple numbered list items. items: string[] */
export async function appendNumberedList(creds, blockId, items) {
  const blocks = items.map((item) => ({
    object: 'block',
    type: 'numbered_list_item',
    numbered_list_item: { rich_text: [{ type: 'text', text: { content: item } }] },
  }));
  return appendBlocks(creds, blockId, blocks);
}

/** Append a code block with optional language. */
export async function appendCodeBlock(creds, blockId, code, language = 'plain text') {
  return appendBlocks(creds, blockId, [
    {
      object: 'block',
      type: 'code',
      code: { rich_text: [{ type: 'text', text: { content: code } }], language },
    },
  ]);
}

/** Append a horizontal divider block. */
export async function appendDivider(creds, blockId) {
  return appendBlocks(creds, blockId, [{ object: 'block', type: 'divider', divider: {} }]);
}

/** Append a collapsible toggle block. */
export async function appendToggleBlock(creds, blockId, text) {
  return appendBlocks(creds, blockId, [
    {
      object: 'block',
      type: 'toggle',
      toggle: { rich_text: [{ type: 'text', text: { content: text } }] },
    },
  ]);
}

/**
 * Append a callout block with an emoji icon.
 * emoji defaults to 💡.
 */
export async function appendCalloutBlock(creds, blockId, text, emoji = '💡') {
  return appendBlocks(creds, blockId, [
    {
      object: 'block',
      type: 'callout',
      callout: {
        rich_text: [{ type: 'text', text: { content: text } }],
        icon: { type: 'emoji', emoji },
      },
    },
  ]);
}

/** Append a block quote. */
export async function appendQuoteBlock(creds, blockId, text) {
  return appendBlocks(creds, blockId, [
    {
      object: 'block',
      type: 'quote',
      quote: { rich_text: [{ type: 'text', text: { content: text } }] },
    },
  ]);
}

/** Append an external image block by URL. */
export async function appendImageBlock(creds, blockId, imageUrl) {
  return appendBlocks(creds, blockId, [
    {
      object: 'block',
      type: 'image',
      image: { type: 'external', external: { url: imageUrl } },
    },
  ]);
}

/** Append a video block using an external URL (e.g. YouTube). */
export async function appendVideoBlock(creds, blockId, videoUrl) {
  return appendBlocks(creds, blockId, [
    {
      object: 'block',
      type: 'video',
      video: { type: 'external', external: { url: videoUrl } },
    },
  ]);
}

/** Append an embed block (e.g. Figma, Google Maps, CodePen). */
export async function appendEmbedBlock(creds, blockId, url) {
  return appendBlocks(creds, blockId, [{ object: 'block', type: 'embed', embed: { url } }]);
}

/** Append a bookmark block with an optional caption. */
export async function appendBookmarkBlock(creds, blockId, url, caption = '') {
  return appendBlocks(creds, blockId, [
    {
      object: 'block',
      type: 'bookmark',
      bookmark: {
        url,
        caption: caption ? [{ type: 'text', text: { content: caption } }] : [],
      },
    },
  ]);
}

/** Append a table of contents block (auto-generates from headings on the page). */
export async function appendTableOfContents(creds, blockId) {
  return appendBlocks(creds, blockId, [
    { object: 'block', type: 'table_of_contents', table_of_contents: {} },
  ]);
}

/**
 * Append a simple table with a header row.
 * headers: string[] — column headers
 * rows: string[][] — each inner array is a row of cells
 */
export async function appendTableBlock(creds, blockId, { headers, rows = [] }) {
  const makeRow = (cells) => ({
    type: 'table_row',
    table_row: {
      cells: cells.map((cell) => [{ type: 'text', text: { content: cell } }]),
    },
  });
  const children = [makeRow(headers), ...rows.map(makeRow)];
  return appendBlocks(creds, blockId, [
    {
      object: 'block',
      type: 'table',
      table: {
        table_width: headers.length,
        has_column_header: true,
        has_row_header: false,
        children,
      },
    },
  ]);
}

/** Internal helper — appends an array of block objects. */
async function appendBlocks(creds, blockId, children) {
  const data = await nFetch(`/blocks/${blockId}/children`, creds, {
    method: 'PATCH',
    body: JSON.stringify({ children }),
  });
  return (data.results ?? []).map((b) => ({ id: b.id, type: b.type }));
}

/** Delete (archive) a block by its ID. */
export async function deleteBlock(creds, blockId) {
  const b = await nFetch(`/blocks/${blockId}`, creds, { method: 'DELETE' });
  return { id: b.id, archived: b.archived };
}

// ─── Databases ───────────────────────────────────────────────────────────────

export async function searchDatabases(creds, limit = 20) {
  const data = await nFetch('/search', creds, {
    method: 'POST',
    body: JSON.stringify({
      filter: { value: 'database', property: 'object' },
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
      page_size: limit,
    }),
  });
  return (data.results ?? []).map((db) => ({
    id: db.id,
    title: db.title?.[0]?.plain_text ?? 'Untitled',
    url: db.url,
    lastEdited: db.last_edited_time,
  }));
}

/** Retrieve a single database by its ID. */
export async function getDatabase(creds, databaseId) {
  const db = await nFetch(`/databases/${databaseId}`, creds);
  return {
    id: db.id,
    title: db.title?.[0]?.plain_text ?? 'Untitled',
    url: db.url,
    properties: Object.keys(db.properties ?? {}),
    lastEdited: db.last_edited_time,
  };
}

/** Return the full property schema for a database. */
export async function getDatabaseSchema(creds, databaseId) {
  const db = await nFetch(`/databases/${databaseId}`, creds);
  return Object.entries(db.properties ?? {}).map(([name, prop]) => ({
    name,
    type: prop.type,
    id: prop.id,
  }));
}

/** Query a database, returning all pages up to limit. */
export async function queryDatabase(creds, databaseId, limit = 20) {
  const data = await nFetch(`/databases/${databaseId}/query`, creds, {
    method: 'POST',
    body: JSON.stringify({ page_size: limit }),
  });
  return (data.results ?? []).map((p) => ({
    id: p.id,
    url: p.url,
    lastEdited: p.last_edited_time,
    properties: p.properties,
  }));
}

/**
 * Filter a database with a Notion filter object.
 * filterObj: Notion filter (e.g. { property: 'Status', select: { equals: 'Done' } })
 */
export async function filterDatabase(creds, databaseId, filterObj, limit = 20) {
  const data = await nFetch(`/databases/${databaseId}/query`, creds, {
    method: 'POST',
    body: JSON.stringify({ filter: filterObj, page_size: limit }),
  });
  return (data.results ?? []).map((p) => ({
    id: p.id,
    url: p.url,
    lastEdited: p.last_edited_time,
    properties: p.properties,
  }));
}

/**
 * Query a database with sorting applied.
 * sorts: array of Notion sort objects, e.g. [{ property: 'Created', direction: 'descending' }]
 */
export async function sortDatabase(creds, databaseId, sorts, limit = 20) {
  const data = await nFetch(`/databases/${databaseId}/query`, creds, {
    method: 'POST',
    body: JSON.stringify({ sorts, page_size: limit }),
  });
  return (data.results ?? []).map((p) => ({
    id: p.id,
    url: p.url,
    lastEdited: p.last_edited_time,
    properties: p.properties,
  }));
}

/**
 * Query a database with both a filter and sorting applied.
 * filterObj: Notion filter object
 * sorts: array of Notion sort objects
 */
export async function filterAndSortDatabase(creds, databaseId, filterObj, sorts, limit = 20) {
  const data = await nFetch(`/databases/${databaseId}/query`, creds, {
    method: 'POST',
    body: JSON.stringify({ filter: filterObj, sorts, page_size: limit }),
  });
  return (data.results ?? []).map((p) => ({
    id: p.id,
    url: p.url,
    lastEdited: p.last_edited_time,
    properties: p.properties,
  }));
}

/**
 * Search entries in a database by title text (uses the Name/title property).
 * titleQuery: substring to match
 */
export async function searchDatabaseByTitle(creds, databaseId, titleQuery, limit = 20) {
  const data = await nFetch(`/databases/${databaseId}/query`, creds, {
    method: 'POST',
    body: JSON.stringify({
      filter: { property: 'Name', title: { contains: titleQuery } },
      page_size: limit,
    }),
  });
  return (data.results ?? []).map((p) => ({
    id: p.id,
    url: p.url,
    lastEdited: p.last_edited_time,
    properties: p.properties,
  }));
}

/**
 * Count total entries in a database, optionally filtered.
 * Paginates through all results to return an accurate count.
 */
export async function countDatabaseEntries(creds, databaseId, filterObj) {
  const body = { page_size: 100 };
  if (filterObj) body.filter = filterObj;
  let count = 0;
  let cursor;
  do {
    const data = await nFetch(`/databases/${databaseId}/query`, creds, {
      method: 'POST',
      body: JSON.stringify({ ...body, ...(cursor ? { start_cursor: cursor } : {}) }),
    });
    count += (data.results ?? []).length;
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return { count };
}

/**
 * Update a database's title and/or description.
 */
export async function updateDatabase(creds, databaseId, { title, description } = {}) {
  const body = {};
  if (title) body.title = [{ type: 'text', text: { content: title } }];
  if (description) body.description = [{ type: 'text', text: { content: description } }];
  const db = await nFetch(`/databases/${databaseId}`, creds, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return { id: db.id, url: db.url };
}

/**
 * Create a new inline database as a child of a page.
 * title: string, properties: Notion property schema object
 */
export async function createDatabase(creds, { parentPageId, title, properties = {} }) {
  const defaultProps = {
    Name: { title: {} },
    ...properties,
  };
  const db = await nFetch('/databases', creds, {
    method: 'POST',
    body: JSON.stringify({
      parent: { type: 'page_id', page_id: parentPageId },
      title: [{ type: 'text', text: { content: title ?? 'New Database' } }],
      properties: defaultProps,
    }),
  });
  return { id: db.id, url: db.url };
}

/**
 * Create a new entry (page) in a database.
 * properties: object where keys are property names and values follow Notion property value shape.
 * title: convenience shortcut — sets the Name/title property.
 */
export async function createDatabaseEntry(creds, databaseId, { title, properties = {} }) {
  const titleProp = title ? { Name: { title: [{ type: 'text', text: { content: title } }] } } : {};
  const p = await nFetch('/pages', creds, {
    method: 'POST',
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties: { ...titleProp, ...properties },
    }),
  });
  return { id: p.id, url: p.url };
}

/**
 * Create multiple entries in a database in a single call.
 * entries: array of { title, properties } objects.
 */
export async function bulkCreateDatabaseEntries(creds, databaseId, entries) {
  const results = [];
  for (const entry of entries) {
    const r = await createDatabaseEntry(creds, databaseId, entry);
    results.push(r);
  }
  return results;
}

/**
 * Update properties on an existing database entry (page).
 * properties: Notion property value map.
 */
export async function updateDatabaseEntry(creds, pageId, properties) {
  const p = await nFetch(`/pages/${pageId}`, creds, {
    method: 'PATCH',
    body: JSON.stringify({ properties }),
  });
  return { id: p.id, url: p.url };
}

/** Archive a database entry. */
export async function archiveDatabaseEntry(creds, pageId) {
  const p = await nFetch(`/pages/${pageId}`, creds, {
    method: 'PATCH',
    body: JSON.stringify({ archived: true }),
  });
  return { id: p.id, archived: p.archived };
}

/** Restore (un-archive) a previously archived database entry. */
export async function restoreDatabaseEntry(creds, pageId) {
  const p = await nFetch(`/pages/${pageId}`, creds, {
    method: 'PATCH',
    body: JSON.stringify({ archived: false }),
  });
  return { id: p.id, archived: p.archived };
}

// ─── Search ──────────────────────────────────────────────────────────────────

/**
 * Search all Notion content (both pages and databases) by query string.
 * Returns a unified list with type field indicating 'page' or 'database'.
 */
export async function searchAll(creds, query = '', limit = 20) {
  const data = await nFetch('/search', creds, {
    method: 'POST',
    body: JSON.stringify({
      query,
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
      page_size: limit,
    }),
  });
  return (data.results ?? []).map((r) => ({
    id: r.id,
    type: r.object,
    title:
      r.properties?.title?.title?.[0]?.plain_text ??
      r.properties?.Name?.title?.[0]?.plain_text ??
      r.title?.[0]?.plain_text ??
      'Untitled',
    url: r.url,
    lastEdited: r.last_edited_time,
  }));
}

// ─── Comments ────────────────────────────────────────────────────────────────

/** List all comments on a page or block. */
export async function getComments(creds, blockId) {
  const data = await nFetch(`/comments?block_id=${blockId}`, creds);
  return (data.results ?? []).map((c) => ({
    id: c.id,
    text: c.rich_text?.map((t) => t.plain_text).join('') ?? '',
    createdTime: c.created_time,
    createdBy: c.created_by?.id,
  }));
}

/** Add a comment to a page or existing discussion. */
export async function addComment(creds, pageId, text) {
  const c = await nFetch('/comments', creds, {
    method: 'POST',
    body: JSON.stringify({
      parent: { page_id: pageId },
      rich_text: [{ type: 'text', text: { content: text } }],
    }),
  });
  return { id: c.id, text };
}

// ─── Users ───────────────────────────────────────────────────────────────────

/** List all users in the workspace. */
export async function getUsers(creds, limit = 50) {
  const data = await nFetch(`/users?page_size=${limit}`, creds);
  return (data.results ?? []).map((u) => ({
    id: u.id,
    name: u.name,
    type: u.type,
    email: u.person?.email ?? null,
    avatarUrl: u.avatar_url ?? null,
  }));
}

/** Retrieve a single user by their ID. */
export async function getUser(creds, userId) {
  const u = await nFetch(`/users/${userId}`, creds);
  return {
    id: u.id,
    name: u.name,
    type: u.type,
    email: u.person?.email ?? null,
    avatarUrl: u.avatar_url ?? null,
  };
}
