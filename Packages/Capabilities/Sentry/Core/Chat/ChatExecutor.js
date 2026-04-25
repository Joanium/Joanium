import * as SentryAPI from '../API/SentryAPI.js';
import { getSentryCredentials, notConnected } from '../Shared/Common.js';
import { runCredentialedChatTool } from '../../../Core/ConnectorUtils.js';

export async function executeSentryChatTool(ctx, toolName, params) {
  return runCredentialedChatTool(ctx, getSentryCredentials, notConnected, async (creds) => {
    const orgSlug = creds.orgSlug;
    // ─── Issues ────────────────────────────────────────────────────────────────
    if (toolName === 'sentry_list_issues') {
      if (!orgSlug) return noOrg();
      const issues = await SentryAPI.listIssues(creds, orgSlug, 25);
      return { ok: true, issues };
    }

    if (toolName === 'sentry_get_issue') {
      if (!orgSlug) return noOrg();
      const issue = await SentryAPI.getIssue(creds, orgSlug, params.issueId);
      return { ok: true, issue };
    }

    if (toolName === 'sentry_resolve_issue') {
      if (!orgSlug) return noOrg();
      const result = await SentryAPI.resolveIssue(creds, orgSlug, params.issueId);
      return { ok: true, result };
    }

    if (toolName === 'sentry_ignore_issue') {
      if (!orgSlug) return noOrg();
      const result = await SentryAPI.ignoreIssue(creds, orgSlug, params.issueId);
      return { ok: true, result };
    }

    if (toolName === 'sentry_assign_issue') {
      if (!orgSlug) return noOrg();
      const result = await SentryAPI.assignIssue(creds, orgSlug, params.issueId, params.assignee);
      return { ok: true, result };
    }

    if (toolName === 'sentry_bulk_resolve_issues') {
      if (!orgSlug) return noOrg();
      const result = await SentryAPI.bulkUpdateIssues(creds, orgSlug, params.issueIds, {
        status: 'resolved',
      });
      return { ok: true, result };
    }

    if (toolName === 'sentry_search_issues') {
      if (!orgSlug) return noOrg();
      const issues = await SentryAPI.searchIssues(creds, orgSlug, params.query, params.limit ?? 25);
      return { ok: true, issues };
    }

    if (toolName === 'sentry_list_fatal_issues') {
      if (!orgSlug) return noOrg();
      const issues = await SentryAPI.listFatalIssues(creds, orgSlug, params.limit ?? 25);
      return { ok: true, issues };
    }

    // ─── Issue Comments ────────────────────────────────────────────────────────
    if (toolName === 'sentry_list_issue_comments') {
      const comments = await SentryAPI.listIssueComments(creds, params.issueId);
      return { ok: true, comments };
    }

    if (toolName === 'sentry_create_issue_comment') {
      const result = await SentryAPI.createIssueComment(creds, params.issueId, params.text);
      return { ok: true, result };
    }

    if (toolName === 'sentry_delete_issue_comment') {
      const result = await SentryAPI.deleteIssueComment(creds, params.issueId, params.commentId);
      return { ok: true, result };
    }

    // ─── Similar Issues ────────────────────────────────────────────────────────
    if (toolName === 'sentry_list_similar_issues') {
      const issues = await SentryAPI.listSimilarIssues(creds, params.issueId, params.limit ?? 10);
      return { ok: true, issues };
    }

    // ─── Issue Attachments ─────────────────────────────────────────────────────
    if (toolName === 'sentry_list_issue_attachments') {
      const attachments = await SentryAPI.listIssueAttachments(creds, params.issueId);
      return { ok: true, attachments };
    }

    // ─── Issue Tag Values ──────────────────────────────────────────────────────
    if (toolName === 'sentry_list_issue_tag_values') {
      const values = await SentryAPI.listIssueTagValues(
        creds,
        params.issueId,
        params.key,
        params.limit ?? 25,
      );
      return { ok: true, values };
    }

    // ─── Issue Mutations ───────────────────────────────────────────────────────
    if (toolName === 'sentry_reopen_issue') {
      if (!orgSlug) return noOrg();
      const result = await SentryAPI.reopenIssue(creds, orgSlug, params.issueId);
      return { ok: true, result };
    }

    if (toolName === 'sentry_bookmark_issue') {
      if (!orgSlug) return noOrg();
      const result = await SentryAPI.bookmarkIssue(
        creds,
        orgSlug,
        params.issueId,
        params.bookmark ?? true,
      );
      return { ok: true, result };
    }

    if (toolName === 'sentry_delete_issue') {
      if (!orgSlug) return noOrg();
      const result = await SentryAPI.deleteIssue(creds, orgSlug, params.issueId);
      return { ok: true, result };
    }

    // ─── Issue Events & Tags ───────────────────────────────────────────────────
    if (toolName === 'sentry_list_issue_events') {
      const events = await SentryAPI.listIssueEvents(creds, params.issueId, params.limit ?? 10);
      return { ok: true, events };
    }

    if (toolName === 'sentry_get_latest_event') {
      const event = await SentryAPI.getLatestEvent(creds, params.issueId);
      return { ok: true, event };
    }

    if (toolName === 'sentry_list_issue_tags') {
      const tags = await SentryAPI.listIssueTags(creds, params.issueId);
      return { ok: true, tags };
    }

    if (toolName === 'sentry_list_issue_hashes') {
      const hashes = await SentryAPI.listIssueHashes(creds, params.issueId);
      return { ok: true, hashes };
    }

    // ─── Projects ──────────────────────────────────────────────────────────────
    if (toolName === 'sentry_list_projects') {
      if (!orgSlug) return noOrg();
      const projects = await SentryAPI.listProjects(creds, orgSlug);
      return { ok: true, projects };
    }

    if (toolName === 'sentry_get_project') {
      if (!orgSlug) return noOrg();
      const project = await SentryAPI.getProject(creds, orgSlug, params.projectSlug);
      return { ok: true, project };
    }

    if (toolName === 'sentry_list_project_issues') {
      if (!orgSlug) return noOrg();
      const issues = await SentryAPI.listProjectIssues(
        creds,
        orgSlug,
        params.projectSlug,
        params.limit ?? 25,
      );
      return { ok: true, issues };
    }

    if (toolName === 'sentry_list_project_events') {
      if (!orgSlug) return noOrg();
      const events = await SentryAPI.listProjectEvents(
        creds,
        orgSlug,
        params.projectSlug,
        params.limit ?? 25,
      );
      return { ok: true, events };
    }

    if (toolName === 'sentry_list_project_releases') {
      if (!orgSlug) return noOrg();
      const releases = await SentryAPI.listProjectReleases(
        creds,
        orgSlug,
        params.projectSlug,
        params.limit ?? 25,
      );
      return { ok: true, releases };
    }

    if (toolName === 'sentry_list_alert_rules') {
      if (!orgSlug) return noOrg();
      const rules = await SentryAPI.listAlertRules(creds, orgSlug, params.projectSlug);
      return { ok: true, rules };
    }

    if (toolName === 'sentry_list_user_feedback') {
      if (!orgSlug) return noOrg();
      const feedback = await SentryAPI.listUserFeedback(
        creds,
        orgSlug,
        params.projectSlug,
        params.limit ?? 25,
      );
      return { ok: true, feedback };
    }

    if (toolName === 'sentry_list_dsym_files') {
      if (!orgSlug) return noOrg();
      const files = await SentryAPI.listDsymFiles(creds, orgSlug, params.projectSlug);
      return { ok: true, files };
    }

    if (toolName === 'sentry_list_project_tags') {
      if (!orgSlug) return noOrg();
      const tags = await SentryAPI.listProjectTags(creds, orgSlug, params.projectSlug);
      return { ok: true, tags };
    }

    if (toolName === 'sentry_list_project_keys') {
      if (!orgSlug) return noOrg();
      const keys = await SentryAPI.listProjectKeys(creds, orgSlug, params.projectSlug);
      return { ok: true, keys };
    }

    if (toolName === 'sentry_get_project_ownership') {
      if (!orgSlug) return noOrg();
      const ownership = await SentryAPI.getProjectOwnership(creds, orgSlug, params.projectSlug);
      return { ok: true, ownership };
    }

    if (toolName === 'sentry_get_project_event') {
      if (!orgSlug) return noOrg();
      const event = await SentryAPI.getProjectEvent(
        creds,
        orgSlug,
        params.projectSlug,
        params.eventId,
      );
      return { ok: true, event };
    }

    if (toolName === 'sentry_list_project_service_hooks') {
      if (!orgSlug) return noOrg();
      const hooks = await SentryAPI.listProjectServiceHooks(creds, orgSlug, params.projectSlug);
      return { ok: true, hooks };
    }

    if (toolName === 'sentry_list_release_files') {
      if (!orgSlug) return noOrg();
      const files = await SentryAPI.listReleaseFiles(
        creds,
        orgSlug,
        params.projectSlug,
        params.version,
      );
      return { ok: true, files };
    }

    // ─── Organizations ─────────────────────────────────────────────────────────
    if (toolName === 'sentry_list_organizations') {
      const organizations = await SentryAPI.listOrganizations(creds);
      return { ok: true, organizations };
    }

    if (toolName === 'sentry_get_organization') {
      if (!orgSlug) return noOrg();
      const organization = await SentryAPI.getOrganization(creds, orgSlug);
      return { ok: true, organization };
    }

    if (toolName === 'sentry_list_members') {
      if (!orgSlug) return noOrg();
      const members = await SentryAPI.listMembers(creds, orgSlug);
      return { ok: true, members };
    }

    if (toolName === 'sentry_get_member') {
      if (!orgSlug) return noOrg();
      const member = await SentryAPI.getMember(creds, orgSlug, params.memberId);
      return { ok: true, member };
    }

    if (toolName === 'sentry_list_environments') {
      if (!orgSlug) return noOrg();
      const environments = await SentryAPI.listEnvironments(creds, orgSlug);
      return { ok: true, environments };
    }

    if (toolName === 'sentry_get_org_stats') {
      if (!orgSlug) return noOrg();
      const stats = await SentryAPI.getOrgStats(creds, orgSlug);
      return { ok: true, stats };
    }

    if (toolName === 'sentry_list_org_activity') {
      if (!orgSlug) return noOrg();
      const activity = await SentryAPI.listOrgActivity(creds, orgSlug, params.limit ?? 25);
      return { ok: true, activity };
    }

    if (toolName === 'sentry_get_event_stats') {
      if (!orgSlug) return noOrg();
      const stats = await SentryAPI.getEventStats(
        creds,
        orgSlug,
        params.query ?? '',
        params.statsPeriod ?? '14d',
        params.interval ?? '1d',
      );
      return { ok: true, stats };
    }

    if (toolName === 'sentry_list_saved_searches') {
      if (!orgSlug) return noOrg();
      const searches = await SentryAPI.listSavedSearches(creds, orgSlug);
      return { ok: true, searches };
    }

    if (toolName === 'sentry_list_integrations') {
      if (!orgSlug) return noOrg();
      const integrations = await SentryAPI.listIntegrations(creds, orgSlug);
      return { ok: true, integrations };
    }

    if (toolName === 'sentry_list_sentry_apps') {
      if (!orgSlug) return noOrg();
      const apps = await SentryAPI.listSentryApps(creds, orgSlug);
      return { ok: true, apps };
    }

    // ─── Teams ─────────────────────────────────────────────────────────────────
    if (toolName === 'sentry_list_teams') {
      if (!orgSlug) return noOrg();
      const teams = await SentryAPI.listTeams(creds, orgSlug);
      return { ok: true, teams };
    }

    if (toolName === 'sentry_list_team_projects') {
      if (!orgSlug) return noOrg();
      const projects = await SentryAPI.listTeamProjects(creds, orgSlug, params.teamSlug);
      return { ok: true, projects };
    }

    if (toolName === 'sentry_list_team_members') {
      if (!orgSlug) return noOrg();
      const members = await SentryAPI.listTeamMembers(creds, orgSlug, params.teamSlug);
      return { ok: true, members };
    }

    // ─── Releases ──────────────────────────────────────────────────────────────
    if (toolName === 'sentry_list_org_releases') {
      if (!orgSlug) return noOrg();
      const releases = await SentryAPI.listOrgReleases(creds, orgSlug, params.limit ?? 25);
      return { ok: true, releases };
    }

    if (toolName === 'sentry_get_release') {
      if (!orgSlug) return noOrg();
      const release = await SentryAPI.getRelease(creds, orgSlug, params.version);
      return { ok: true, release };
    }

    if (toolName === 'sentry_list_deploys') {
      if (!orgSlug) return noOrg();
      const deploys = await SentryAPI.listDeploys(creds, orgSlug, params.version);
      return { ok: true, deploys };
    }

    if (toolName === 'sentry_list_release_commits') {
      if (!orgSlug) return noOrg();
      const commits = await SentryAPI.listReleaseCommits(creds, orgSlug, params.version);
      return { ok: true, commits };
    }

    // ─── Monitors ──────────────────────────────────────────────────────────────
    if (toolName === 'sentry_list_monitors') {
      if (!orgSlug) return noOrg();
      const monitors = await SentryAPI.listMonitors(creds, orgSlug);
      return { ok: true, monitors };
    }

    if (toolName === 'sentry_get_monitor') {
      if (!orgSlug) return noOrg();
      const monitor = await SentryAPI.getMonitor(creds, orgSlug, params.monitorSlug);
      return { ok: true, monitor };
    }

    if (toolName === 'sentry_list_monitor_checkins') {
      if (!orgSlug) return noOrg();
      const checkins = await SentryAPI.listMonitorCheckins(
        creds,
        orgSlug,
        params.monitorSlug,
        params.limit ?? 25,
      );
      return { ok: true, checkins };
    }

    // ─── Dashboards ────────────────────────────────────────────────────────────
    if (toolName === 'sentry_list_dashboards') {
      if (!orgSlug) return noOrg();
      const dashboards = await SentryAPI.listDashboards(creds, orgSlug);
      return { ok: true, dashboards };
    }

    if (toolName === 'sentry_get_dashboard') {
      if (!orgSlug) return noOrg();
      const dashboard = await SentryAPI.getDashboard(creds, orgSlug, params.dashboardId);
      return { ok: true, dashboard };
    }

    // ─── Replays ───────────────────────────────────────────────────────────────
    if (toolName === 'sentry_list_replays') {
      if (!orgSlug) return noOrg();
      const replays = await SentryAPI.listReplays(creds, orgSlug, params.limit ?? 25);
      return { ok: true, replays };
    }

    return null; // unknown tool
  });
}

function noOrg() {
  return { ok: false, error: 'No organization found. Please reconnect Sentry.' };
}
