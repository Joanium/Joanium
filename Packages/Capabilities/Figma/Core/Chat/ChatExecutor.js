import * as FigmaAPI from '../API/FigmaAPI.js';
import { getFigmaCredentials, notConnected } from '../Shared/Common.js';
import { runCredentialedChatTool } from '../../../Core/ConnectorUtils.js';

export async function executeFigmaChatTool(ctx, toolName, params) {
  return runCredentialedChatTool(ctx, getFigmaCredentials, notConnected, async (creds) => {
    // ─── Files ───────────────────────────────────────────────────────────────

    if (toolName === 'figma_get_file_info') {
      if (!params?.file_key) return { ok: false, error: 'file_key is required' };
      const file = await FigmaAPI.getFile(creds, params.file_key);
      return { ok: true, file };
    }

    if (toolName === 'figma_get_file_nodes') {
      if (!params?.file_key) return { ok: false, error: 'file_key is required' };
      if (!params?.node_ids?.length) return { ok: false, error: 'node_ids array is required' };
      const nodes = await FigmaAPI.getFileNodes(creds, params.file_key, params.node_ids);
      return { ok: true, nodes };
    }

    if (toolName === 'figma_get_file_page') {
      if (!params?.file_key) return { ok: false, error: 'file_key is required' };
      if (!params?.page_id) return { ok: false, error: 'page_id is required' };
      const page = await FigmaAPI.getFilePage(creds, params.file_key, params.page_id);
      return { ok: true, page };
    }

    if (toolName === 'figma_get_file_versions') {
      if (!params?.file_key) return { ok: false, error: 'file_key is required' };
      const versions = await FigmaAPI.getFileVersions(creds, params.file_key);
      return { ok: true, versions, count: versions.length };
    }

    if (toolName === 'figma_get_file_thumbnail') {
      if (!params?.file_key) return { ok: false, error: 'file_key is required' };
      const thumbnail = await FigmaAPI.getFileThumbnail(creds, params.file_key);
      return { ok: true, ...thumbnail };
    }

    if (toolName === 'figma_get_file_components') {
      if (!params?.file_key) return { ok: false, error: 'file_key is required' };
      const components = await FigmaAPI.getFileComponents(creds, params.file_key);
      return { ok: true, components, count: components.length };
    }

    if (toolName === 'figma_get_file_styles') {
      if (!params?.file_key) return { ok: false, error: 'file_key is required' };
      const styles = await FigmaAPI.getFileStyles(creds, params.file_key);
      return { ok: true, styles, count: styles.length };
    }

    if (toolName === 'figma_get_image_fills') {
      if (!params?.file_key) return { ok: false, error: 'file_key is required' };
      const images = await FigmaAPI.getImageFills(creds, params.file_key);
      const entries = Object.entries(images);
      return { ok: true, images, count: entries.length };
    }

    // ─── Export / Render ─────────────────────────────────────────────────────

    if (toolName === 'figma_export_nodes_png') {
      if (!params?.file_key) return { ok: false, error: 'file_key is required' };
      if (!params?.node_ids?.length) return { ok: false, error: 'node_ids array is required' };
      const images = await FigmaAPI.exportNodes(
        creds,
        params.file_key,
        params.node_ids,
        'png',
        params.scale ?? 1,
      );
      return { ok: true, format: 'png', images };
    }

    if (toolName === 'figma_export_nodes_svg') {
      if (!params?.file_key) return { ok: false, error: 'file_key is required' };
      if (!params?.node_ids?.length) return { ok: false, error: 'node_ids array is required' };
      const images = await FigmaAPI.exportNodes(creds, params.file_key, params.node_ids, 'svg', 1);
      return { ok: true, format: 'svg', images };
    }

    if (toolName === 'figma_export_nodes_pdf') {
      if (!params?.file_key) return { ok: false, error: 'file_key is required' };
      if (!params?.node_ids?.length) return { ok: false, error: 'node_ids array is required' };
      const images = await FigmaAPI.exportNodes(creds, params.file_key, params.node_ids, 'pdf', 1);
      return { ok: true, format: 'pdf', images };
    }

    if (toolName === 'figma_export_nodes_jpg') {
      if (!params?.file_key) return { ok: false, error: 'file_key is required' };
      if (!params?.node_ids?.length) return { ok: false, error: 'node_ids array is required' };
      const images = await FigmaAPI.exportNodes(
        creds,
        params.file_key,
        params.node_ids,
        'jpg',
        params.scale ?? 1,
      );
      return { ok: true, format: 'jpg', images };
    }

    // ─── Comments ────────────────────────────────────────────────────────────

    if (toolName === 'figma_get_file_comments') {
      if (!params?.file_key) return { ok: false, error: 'file_key is required' };
      const comments = await FigmaAPI.getFileComments(creds, params.file_key);
      const open = comments.filter((c) => !c.resolved);
      const resolved = comments.filter((c) => c.resolved);
      return {
        ok: true,
        comments,
        total: comments.length,
        open: open.length,
        resolved: resolved.length,
      };
    }

    if (toolName === 'figma_post_comment') {
      if (!params?.file_key) return { ok: false, error: 'file_key is required' };
      if (!params?.message) return { ok: false, error: 'message is required' };
      const comment = await FigmaAPI.postComment(
        creds,
        params.file_key,
        params.message,
        params.node_id ?? null,
      );
      return { ok: true, comment };
    }

    if (toolName === 'figma_delete_comment') {
      if (!params?.file_key) return { ok: false, error: 'file_key is required' };
      if (!params?.comment_id) return { ok: false, error: 'comment_id is required' };
      await FigmaAPI.deleteComment(creds, params.file_key, params.comment_id);
      return { ok: true, deleted: true, comment_id: params.comment_id };
    }

    if (toolName === 'figma_resolve_comment') {
      if (!params?.file_key) return { ok: false, error: 'file_key is required' };
      if (!params?.comment_id) return { ok: false, error: 'comment_id is required' };
      await FigmaAPI.resolveComment(creds, params.file_key, params.comment_id);
      return { ok: true, resolved: true, comment_id: params.comment_id };
    }

    // ─── Teams & Projects ────────────────────────────────────────────────────

    if (toolName === 'figma_get_team_projects') {
      if (!params?.team_id) return { ok: false, error: 'team_id is required' };
      const projects = await FigmaAPI.getTeamProjects(creds, params.team_id);
      return { ok: true, projects, count: projects.length };
    }

    if (toolName === 'figma_get_project_files') {
      if (!params?.project_id) return { ok: false, error: 'project_id is required' };
      const files = await FigmaAPI.getProjectFiles(creds, params.project_id);
      return { ok: true, files, count: files.length };
    }

    // ─── Components ──────────────────────────────────────────────────────────

    if (toolName === 'figma_get_team_components') {
      if (!params?.team_id) return { ok: false, error: 'team_id is required' };
      const components = await FigmaAPI.getTeamComponents(creds, params.team_id);
      return { ok: true, components, count: components.length };
    }

    if (toolName === 'figma_get_component') {
      if (!params?.component_key) return { ok: false, error: 'component_key is required' };
      const component = await FigmaAPI.getComponent(creds, params.component_key);
      return { ok: true, component };
    }

    if (toolName === 'figma_get_team_component_sets') {
      if (!params?.team_id) return { ok: false, error: 'team_id is required' };
      const componentSets = await FigmaAPI.getTeamComponentSets(creds, params.team_id);
      return { ok: true, componentSets, count: componentSets.length };
    }

    if (toolName === 'figma_get_component_set') {
      if (!params?.component_set_key) return { ok: false, error: 'component_set_key is required' };
      const componentSet = await FigmaAPI.getComponentSet(creds, params.component_set_key);
      return { ok: true, componentSet };
    }

    // ─── Styles ──────────────────────────────────────────────────────────────

    if (toolName === 'figma_get_team_styles') {
      if (!params?.team_id) return { ok: false, error: 'team_id is required' };
      const styles = await FigmaAPI.getTeamStyles(creds, params.team_id);
      return { ok: true, styles, count: styles.length };
    }

    if (toolName === 'figma_get_style') {
      if (!params?.style_key) return { ok: false, error: 'style_key is required' };
      const style = await FigmaAPI.getStyle(creds, params.style_key);
      return { ok: true, style };
    }

    // ─── Variables ───────────────────────────────────────────────────────────

    if (toolName === 'figma_get_local_variables') {
      if (!params?.file_key) return { ok: false, error: 'file_key is required' };
      const result = await FigmaAPI.getLocalVariables(creds, params.file_key);
      return {
        ok: true,
        ...result,
        collectionCount: result.collections.length,
        variableCount: result.variables.length,
      };
    }

    if (toolName === 'figma_get_published_variables') {
      if (!params?.file_key) return { ok: false, error: 'file_key is required' };
      const result = await FigmaAPI.getPublishedVariables(creds, params.file_key);
      return {
        ok: true,
        ...result,
        collectionCount: result.collections.length,
        variableCount: result.variables.length,
      };
    }

    // ─── Derived / Utility ───────────────────────────────────────────────────

    if (toolName === 'figma_summarize_comments') {
      if (!params?.file_key) return { ok: false, error: 'file_key is required' };
      const comments = await FigmaAPI.getFileComments(creds, params.file_key);
      const open = comments.filter((c) => !c.resolved);
      const resolved = comments.filter((c) => c.resolved);

      // Top commenters
      const counts = {};
      for (const c of comments) counts[c.author] = (counts[c.author] ?? 0) + 1;
      const topCommenters = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([author, count]) => ({ author, count }));

      return {
        ok: true,
        total: comments.length,
        openCount: open.length,
        resolvedCount: resolved.length,
        topCommenters,
        openComments: open.map((c) => ({
          id: c.id,
          author: c.author,
          message: c.message,
          createdAt: c.createdAt,
        })),
      };
    }

    if (toolName === 'figma_get_file_overview') {
      if (!params?.file_key) return { ok: false, error: 'file_key is required' };
      const [file, versions, comments] = await Promise.all([
        FigmaAPI.getFile(creds, params.file_key),
        FigmaAPI.getFileVersions(creds, params.file_key),
        FigmaAPI.getFileComments(creds, params.file_key),
      ]);
      const recentVersions = versions.slice(0, 5).map((v) => ({
        id: v.id,
        label: v.label,
        user: v.user,
        createdAt: v.createdAt,
      }));
      return {
        ok: true,
        file,
        versionCount: versions.length,
        recentVersions,
        commentCount: comments.length,
        openComments: comments.filter((c) => !c.resolved).length,
      };
    }

    if (toolName === 'figma_search_team_components') {
      if (!params?.team_id) return { ok: false, error: 'team_id is required' };
      if (!params?.query) return { ok: false, error: 'query is required' };
      const components = await FigmaAPI.getTeamComponents(creds, params.team_id);
      const q = params.query.toLowerCase();
      const matches = components.filter((c) => c.name.toLowerCase().includes(q));
      return { ok: true, query: params.query, matches, count: matches.length };
    }

    if (toolName === 'figma_diff_versions') {
      if (!params?.file_key) return { ok: false, error: 'file_key is required' };
      if (!params?.version_a) return { ok: false, error: 'version_a is required' };
      if (!params?.version_b) return { ok: false, error: 'version_b is required' };
      const versions = await FigmaAPI.getFileVersions(creds, params.file_key);
      const vA = versions.find((v) => v.id === params.version_a);
      const vB = versions.find((v) => v.id === params.version_b);
      if (!vA) return { ok: false, error: `Version "${params.version_a}" not found` };
      if (!vB) return { ok: false, error: `Version "${params.version_b}" not found` };
      const msElapsed = new Date(vB.createdAt) - new Date(vA.createdAt);
      const hoursElapsed = Math.round(msElapsed / 1000 / 60 / 60);
      return {
        ok: true,
        from: vA,
        to: vB,
        hoursElapsed,
        sameAuthor: vA.user === vB.user,
      };
    }

    if (toolName === 'figma_count_open_comments') {
      if (!params?.file_key) return { ok: false, error: 'file_key is required' };
      const comments = await FigmaAPI.getFileComments(creds, params.file_key);
      const open = comments.filter((c) => !c.resolved);
      return { ok: true, openCount: open.length, totalCount: comments.length };
    }

    if (toolName === 'figma_list_page_frames') {
      if (!params?.file_key) return { ok: false, error: 'file_key is required' };
      if (!params?.page_id) return { ok: false, error: 'page_id is required' };
      const page = await FigmaAPI.getFilePage(creds, params.file_key, params.page_id);
      const frames = page.children.filter((c) => c.type === 'FRAME' || c.type === 'COMPONENT');
      return { ok: true, pageName: page.name, frames, frameCount: frames.length };
    }

    return null; // unknown tool — let the caller handle it
  });
}
