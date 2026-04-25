import * as NotionAPI from '../API/NotionAPI.js';
import { getNotionCredentials, notConnected } from '../Shared/Common.js';
import { runCredentialedChatTool } from '../../../Core/ConnectorUtils.js';

export async function executeNotionChatTool(ctx, toolName, params) {
  return runCredentialedChatTool(ctx, getNotionCredentials, notConnected, async (creds) => {
    // ─── Pages ───────────────────────────────────────────────────────────────

    if (toolName === 'notion_search_pages') {
      const pages = await NotionAPI.searchPages(creds, params?.query ?? '', 20);
      return { ok: true, pages };
    }

    if (toolName === 'notion_get_page') {
      const page = await NotionAPI.getPage(creds, params.page_id);
      return { ok: true, page };
    }

    if (toolName === 'notion_create_page') {
      const result = await NotionAPI.createPage(creds, {
        parentId: params.parent_id,
        parentType: params.parent_type ?? 'page_id',
        title: params.title,
      });
      return { ok: true, ...result };
    }

    if (toolName === 'notion_update_page_title') {
      const result = await NotionAPI.updatePageTitle(creds, params.page_id, params.new_title);
      return { ok: true, ...result };
    }

    if (toolName === 'notion_archive_page') {
      const result = await NotionAPI.archivePage(creds, params.page_id);
      return { ok: true, ...result };
    }

    if (toolName === 'notion_restore_page') {
      const result = await NotionAPI.restorePage(creds, params.page_id);
      return { ok: true, ...result };
    }

    if (toolName === 'notion_get_page_property') {
      const data = await NotionAPI.getPageProperty(creds, params.page_id, params.property_id);
      return { ok: true, property: data };
    }

    if (toolName === 'notion_create_page_with_content') {
      const result = await NotionAPI.createPageWithContent(creds, {
        parentId: params.parent_id,
        parentType: params.parent_type ?? 'page_id',
        title: params.title,
        contentBlocks: params.content_blocks ?? [],
      });
      return { ok: true, ...result };
    }

    if (toolName === 'notion_set_page_icon') {
      const result = await NotionAPI.setPageIcon(creds, params.page_id, {
        type: params.type ?? 'emoji',
        value: params.value,
      });
      return { ok: true, ...result };
    }

    if (toolName === 'notion_set_page_cover') {
      const result = await NotionAPI.setPageCover(creds, params.page_id, params.image_url);
      return { ok: true, ...result };
    }

    if (toolName === 'notion_update_page_properties') {
      const result = await NotionAPI.updatePageProperties(creds, params.page_id, params.properties);
      return { ok: true, ...result };
    }

    if (toolName === 'notion_get_child_pages') {
      const pages = await NotionAPI.getChildPages(creds, params.page_id);
      return { ok: true, pages };
    }

    // ─── Blocks ───────────────────────────────────────────────────────────────

    if (toolName === 'notion_get_page_content') {
      const blocks = await NotionAPI.getBlockChildren(creds, params.block_id, params.limit ?? 50);
      return { ok: true, blocks };
    }

    if (toolName === 'notion_get_block') {
      const block = await NotionAPI.getBlock(creds, params.block_id);
      return { ok: true, block };
    }

    if (toolName === 'notion_update_block_text') {
      const result = await NotionAPI.updateBlockText(creds, params.block_id, params.text);
      return { ok: true, ...result };
    }

    if (toolName === 'notion_get_full_page_content') {
      const result = await NotionAPI.getFullPageContent(creds, params.page_id, params.depth ?? 2);
      return { ok: true, ...result };
    }

    if (toolName === 'notion_export_page_as_text') {
      const result = await NotionAPI.exportPageAsText(creds, params.page_id);
      return { ok: true, ...result };
    }

    if (toolName === 'notion_clear_page_content') {
      const result = await NotionAPI.clearPageContent(creds, params.page_id);
      return { ok: true, ...result };
    }

    if (toolName === 'notion_append_text_block') {
      const blocks = await NotionAPI.appendTextBlock(creds, params.block_id, params.text);
      return { ok: true, blocks };
    }

    if (toolName === 'notion_append_todo_block') {
      const blocks = await NotionAPI.appendTodoBlock(
        creds,
        params.block_id,
        params.text,
        params.checked ?? false,
      );
      return { ok: true, blocks };
    }

    if (toolName === 'notion_append_heading_block') {
      const blocks = await NotionAPI.appendHeadingBlock(
        creds,
        params.block_id,
        params.text,
        params.level ?? 2,
      );
      return { ok: true, blocks };
    }

    if (toolName === 'notion_append_bullet_list') {
      const blocks = await NotionAPI.appendBulletList(creds, params.block_id, params.items ?? []);
      return { ok: true, blocks };
    }

    if (toolName === 'notion_append_numbered_list') {
      const blocks = await NotionAPI.appendNumberedList(creds, params.block_id, params.items ?? []);
      return { ok: true, blocks };
    }

    if (toolName === 'notion_append_code_block') {
      const blocks = await NotionAPI.appendCodeBlock(
        creds,
        params.block_id,
        params.code,
        params.language ?? 'plain text',
      );
      return { ok: true, blocks };
    }

    if (toolName === 'notion_append_divider') {
      const blocks = await NotionAPI.appendDivider(creds, params.block_id);
      return { ok: true, blocks };
    }

    if (toolName === 'notion_append_toggle_block') {
      const blocks = await NotionAPI.appendToggleBlock(creds, params.block_id, params.text);
      return { ok: true, blocks };
    }

    if (toolName === 'notion_append_callout_block') {
      const blocks = await NotionAPI.appendCalloutBlock(
        creds,
        params.block_id,
        params.text,
        params.emoji ?? '💡',
      );
      return { ok: true, blocks };
    }

    if (toolName === 'notion_append_quote_block') {
      const blocks = await NotionAPI.appendQuoteBlock(creds, params.block_id, params.text);
      return { ok: true, blocks };
    }

    if (toolName === 'notion_append_image_block') {
      const blocks = await NotionAPI.appendImageBlock(creds, params.block_id, params.image_url);
      return { ok: true, blocks };
    }

    if (toolName === 'notion_append_video_block') {
      const blocks = await NotionAPI.appendVideoBlock(creds, params.block_id, params.video_url);
      return { ok: true, blocks };
    }

    if (toolName === 'notion_append_embed_block') {
      const blocks = await NotionAPI.appendEmbedBlock(creds, params.block_id, params.url);
      return { ok: true, blocks };
    }

    if (toolName === 'notion_append_bookmark_block') {
      const blocks = await NotionAPI.appendBookmarkBlock(
        creds,
        params.block_id,
        params.url,
        params.caption ?? '',
      );
      return { ok: true, blocks };
    }

    if (toolName === 'notion_append_table_of_contents') {
      const blocks = await NotionAPI.appendTableOfContents(creds, params.block_id);
      return { ok: true, blocks };
    }

    if (toolName === 'notion_append_table_block') {
      const blocks = await NotionAPI.appendTableBlock(creds, params.block_id, {
        headers: params.headers ?? [],
        rows: params.rows ?? [],
      });
      return { ok: true, blocks };
    }

    if (toolName === 'notion_delete_block') {
      const result = await NotionAPI.deleteBlock(creds, params.block_id);
      return { ok: true, ...result };
    }

    if (toolName === 'notion_get_block_children') {
      const blocks = await NotionAPI.getBlockChildren(creds, params.block_id, params.limit ?? 50);
      return { ok: true, blocks };
    }

    // ─── Databases ────────────────────────────────────────────────────────────

    if (toolName === 'notion_search_databases') {
      const databases = await NotionAPI.searchDatabases(creds, params?.limit ?? 20);
      return { ok: true, databases };
    }

    if (toolName === 'notion_get_database') {
      const database = await NotionAPI.getDatabase(creds, params.database_id);
      return { ok: true, database };
    }

    if (toolName === 'notion_get_database_schema') {
      const schema = await NotionAPI.getDatabaseSchema(creds, params.database_id);
      return { ok: true, schema };
    }

    if (toolName === 'notion_query_database') {
      const entries = await NotionAPI.queryDatabase(creds, params.database_id, params.limit ?? 20);
      return { ok: true, entries };
    }

    if (toolName === 'notion_filter_database') {
      const entries = await NotionAPI.filterDatabase(
        creds,
        params.database_id,
        params.filter,
        params.limit ?? 20,
      );
      return { ok: true, entries };
    }

    if (toolName === 'notion_sort_database') {
      const entries = await NotionAPI.sortDatabase(
        creds,
        params.database_id,
        params.sorts,
        params.limit ?? 20,
      );
      return { ok: true, entries };
    }

    if (toolName === 'notion_filter_and_sort_database') {
      const entries = await NotionAPI.filterAndSortDatabase(
        creds,
        params.database_id,
        params.filter,
        params.sorts,
        params.limit ?? 20,
      );
      return { ok: true, entries };
    }

    if (toolName === 'notion_search_database_by_title') {
      const entries = await NotionAPI.searchDatabaseByTitle(
        creds,
        params.database_id,
        params.query,
        params.limit ?? 20,
      );
      return { ok: true, entries };
    }

    if (toolName === 'notion_count_database_entries') {
      const result = await NotionAPI.countDatabaseEntries(
        creds,
        params.database_id,
        params.filter ?? null,
      );
      return { ok: true, ...result };
    }

    if (toolName === 'notion_update_database') {
      const result = await NotionAPI.updateDatabase(creds, params.database_id, {
        title: params.title,
        description: params.description,
      });
      return { ok: true, ...result };
    }

    if (toolName === 'notion_create_database') {
      const result = await NotionAPI.createDatabase(creds, {
        parentPageId: params.parent_page_id,
        title: params.title,
        properties: params.properties ?? {},
      });
      return { ok: true, ...result };
    }

    if (toolName === 'notion_create_database_entry') {
      const result = await NotionAPI.createDatabaseEntry(creds, params.database_id, {
        title: params.title,
        properties: params.properties ?? {},
      });
      return { ok: true, ...result };
    }

    if (toolName === 'notion_bulk_create_database_entries') {
      const results = await NotionAPI.bulkCreateDatabaseEntries(
        creds,
        params.database_id,
        params.entries ?? [],
      );
      return { ok: true, results };
    }

    if (toolName === 'notion_update_database_entry') {
      const result = await NotionAPI.updateDatabaseEntry(creds, params.page_id, params.properties);
      return { ok: true, ...result };
    }

    if (toolName === 'notion_archive_database_entry') {
      const result = await NotionAPI.archiveDatabaseEntry(creds, params.page_id);
      return { ok: true, ...result };
    }

    if (toolName === 'notion_restore_database_entry') {
      const result = await NotionAPI.restoreDatabaseEntry(creds, params.page_id);
      return { ok: true, ...result };
    }

    // ─── Search ───────────────────────────────────────────────────────────────

    if (toolName === 'notion_search_all') {
      const results = await NotionAPI.searchAll(creds, params?.query ?? '', params?.limit ?? 20);
      return { ok: true, results };
    }

    // ─── Comments ─────────────────────────────────────────────────────────────

    if (toolName === 'notion_get_comments') {
      const comments = await NotionAPI.getComments(creds, params.block_id);
      return { ok: true, comments };
    }

    if (toolName === 'notion_add_comment') {
      const result = await NotionAPI.addComment(creds, params.page_id, params.text);
      return { ok: true, ...result };
    }

    // ─── Users ────────────────────────────────────────────────────────────────

    if (toolName === 'notion_get_users') {
      const users = await NotionAPI.getUsers(creds, params?.limit ?? 50);
      return { ok: true, users };
    }

    if (toolName === 'notion_get_user') {
      const user = await NotionAPI.getUser(creds, params.user_id);
      return { ok: true, user };
    }

    if (toolName === 'notion_get_bot_info') {
      const bot = await NotionAPI.getBot(creds);
      return { ok: true, bot };
    }

    if (toolName === 'notion_get_workspace_info') {
      const workspace = await NotionAPI.getWorkspaceInfo(creds);
      return { ok: true, workspace };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ─── NEW TOOLS (30) ────────────────────────────────────────────────────────
    // ═══════════════════════════════════════════════════════════════════════════

    // ─── Pages (new) ─────────────────────────────────────────────────────────

    if (toolName === 'notion_get_all_pages') {
      const result = await NotionAPI.getAllPages(creds, params?.query ?? '');
      return { ok: true, ...result };
    }

    if (toolName === 'notion_get_all_databases') {
      const result = await NotionAPI.getAllDatabases(creds);
      return { ok: true, ...result };
    }

    if (toolName === 'notion_get_recently_created_pages') {
      const pages = await NotionAPI.getRecentlyCreatedPages(creds, params?.limit ?? 20);
      return { ok: true, pages };
    }

    if (toolName === 'notion_duplicate_page') {
      const result = await NotionAPI.duplicatePage(creds, params.page_id);
      return { ok: true, ...result };
    }

    if (toolName === 'notion_remove_page_icon') {
      const result = await NotionAPI.removePageIcon(creds, params.page_id);
      return { ok: true, ...result };
    }

    if (toolName === 'notion_remove_page_cover') {
      const result = await NotionAPI.removePageCover(creds, params.page_id);
      return { ok: true, ...result };
    }

    if (toolName === 'notion_get_subpage_tree') {
      const result = await NotionAPI.getSubpageTree(creds, params.page_id, params.depth ?? 2);
      return { ok: true, ...result };
    }

    // ─── Blocks (new) ─────────────────────────────────────────────────────────

    if (toolName === 'notion_append_rich_text_block') {
      const blocks = await NotionAPI.appendRichTextBlock(
        creds,
        params.block_id,
        params.segments ?? [],
      );
      return { ok: true, blocks };
    }

    if (toolName === 'notion_append_equation_block') {
      const blocks = await NotionAPI.appendEquationBlock(creds, params.block_id, params.expression);
      return { ok: true, blocks };
    }

    if (toolName === 'notion_append_file_block') {
      const blocks = await NotionAPI.appendFileBlock(
        creds,
        params.block_id,
        params.file_url,
        params.caption ?? '',
      );
      return { ok: true, blocks };
    }

    if (toolName === 'notion_append_pdf_block') {
      const blocks = await NotionAPI.appendPdfBlock(
        creds,
        params.block_id,
        params.pdf_url,
        params.caption ?? '',
      );
      return { ok: true, blocks };
    }

    if (toolName === 'notion_set_todo_checked') {
      const result = await NotionAPI.setTodoChecked(creds, params.block_id, params.checked ?? true);
      return { ok: true, ...result };
    }

    if (toolName === 'notion_find_blocks_by_type') {
      const blocks = await NotionAPI.findBlocksByType(creds, params.page_id, params.block_type);
      return { ok: true, blocks };
    }

    if (toolName === 'notion_search_page_content') {
      const blocks = await NotionAPI.searchPageContent(creds, params.page_id, params.query);
      return { ok: true, blocks };
    }

    if (toolName === 'notion_get_block_type_summary') {
      const result = await NotionAPI.getBlockTypeSummary(creds, params.page_id);
      return { ok: true, ...result };
    }

    // ─── Databases (new) ──────────────────────────────────────────────────────

    if (toolName === 'notion_get_all_database_entries') {
      const result = await NotionAPI.getAllDatabaseEntries(
        creds,
        params.database_id,
        params.filter ?? undefined,
      );
      return { ok: true, ...result };
    }

    if (toolName === 'notion_get_database_entry') {
      const entry = await NotionAPI.getDatabaseEntry(creds, params.page_id);
      return { ok: true, entry };
    }

    if (toolName === 'notion_export_database_as_text') {
      const result = await NotionAPI.exportDatabaseAsText(
        creds,
        params.database_id,
        params.limit ?? 50,
      );
      return { ok: true, ...result };
    }

    if (toolName === 'notion_batch_update_database_entries') {
      const results = await NotionAPI.batchUpdateDatabaseEntries(creds, params.updates ?? []);
      return { ok: true, results };
    }

    if (toolName === 'notion_batch_archive_database_entries') {
      const results = await NotionAPI.batchArchiveDatabaseEntries(creds, params.page_ids ?? []);
      return { ok: true, results };
    }

    if (toolName === 'notion_add_database_property') {
      const result = await NotionAPI.addDatabaseProperty(
        creds,
        params.database_id,
        params.property_name,
        params.property_config,
      );
      return { ok: true, ...result };
    }

    if (toolName === 'notion_remove_database_property') {
      const result = await NotionAPI.removeDatabaseProperty(
        creds,
        params.database_id,
        params.property_name,
      );
      return { ok: true, ...result };
    }

    if (toolName === 'notion_rename_database_property') {
      const result = await NotionAPI.renameDatabaseProperty(
        creds,
        params.database_id,
        params.current_name,
        params.new_name,
      );
      return { ok: true, ...result };
    }

    if (toolName === 'notion_update_database_property') {
      const result = await NotionAPI.updateDatabaseProperty(
        creds,
        params.database_id,
        params.property_name,
        params.property_config,
      );
      return { ok: true, ...result };
    }

    if (toolName === 'notion_get_database_property_options') {
      const result = await NotionAPI.getDatabasePropertyOptions(
        creds,
        params.database_id,
        params.property_name,
      );
      return { ok: true, ...result };
    }

    if (toolName === 'notion_filter_database_by_date') {
      const entries = await NotionAPI.filterDatabaseByDate(
        creds,
        params.database_id,
        params.property_name,
        {
          after: params.after,
          before: params.before,
          onOrAfter: params.on_or_after,
          onOrBefore: params.on_or_before,
        },
        params.limit ?? 20,
      );
      return { ok: true, entries };
    }

    if (toolName === 'notion_filter_database_by_checkbox') {
      const entries = await NotionAPI.filterDatabaseByCheckbox(
        creds,
        params.database_id,
        params.property_name,
        params.checked ?? true,
        params.limit ?? 20,
      );
      return { ok: true, entries };
    }

    // ─── Comments (new) ───────────────────────────────────────────────────────

    if (toolName === 'notion_get_page_comments_count') {
      const result = await NotionAPI.getPageCommentsCount(creds, params.page_id);
      return { ok: true, ...result };
    }

    // ─── Users (new) ──────────────────────────────────────────────────────────

    if (toolName === 'notion_find_user_by_name') {
      const users = await NotionAPI.findUserByName(creds, params.name);
      return { ok: true, users };
    }

    // ─── Workspace (new) ──────────────────────────────────────────────────────

    if (toolName === 'notion_get_workspace_stats') {
      const stats = await NotionAPI.getWorkspaceStats(creds);
      return { ok: true, ...stats };
    }

    return null; // unknown tool
  });
}
