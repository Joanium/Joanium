import * as JiraAPI from '../API/JiraAPI.js';
import { getJiraCredentials, notConnected } from '../Shared/Common.js';

export async function executeJiraChatTool(ctx, toolName, params) {
  const creds = getJiraCredentials(ctx);
  if (!creds) return notConnected();

  try {
    // ── Existing ─────────────────────────────────────────────────────────────
    if (toolName === 'jira_list_my_issues') {
      const issues = await JiraAPI.getMyOpenIssues(creds, 25);
      return { ok: true, issues };
    }

    // ── 1. Get Issue ─────────────────────────────────────────────────────────
    if (toolName === 'jira_get_issue') {
      const issue = await JiraAPI.getIssue(creds, params.issueKey);
      return { ok: true, issue };
    }

    // ── 2. Create Issue ──────────────────────────────────────────────────────
    if (toolName === 'jira_create_issue') {
      const result = await JiraAPI.createIssue(creds, {
        projectKey: params.projectKey,
        summary: params.summary,
        issueType: params.issueType,
        description: params.description,
        priority: params.priority,
        assigneeAccountId: params.assigneeAccountId,
        labels: params.labels ?? [],
      });
      return { ok: true, created: result };
    }

    // ── 3. Update Issue ──────────────────────────────────────────────────────
    if (toolName === 'jira_update_issue') {
      const result = await JiraAPI.updateIssue(creds, params.issueKey, {
        summary: params.summary,
        description: params.description,
        priority: params.priority,
        assigneeAccountId: params.assigneeAccountId,
        labels: params.labels,
        fixVersion: params.fixVersion,
      });
      return { ok: true, updated: result };
    }

    // ── 4. Delete Issue ──────────────────────────────────────────────────────
    if (toolName === 'jira_delete_issue') {
      const result = await JiraAPI.deleteIssue(creds, params.issueKey);
      return { ok: true, deleted: result };
    }

    // ── 5. Add Comment ───────────────────────────────────────────────────────
    if (toolName === 'jira_add_comment') {
      const comment = await JiraAPI.addComment(creds, params.issueKey, params.comment);
      return { ok: true, comment };
    }

    // ── 6. Get Comments ──────────────────────────────────────────────────────
    if (toolName === 'jira_get_comments') {
      const comments = await JiraAPI.getComments(creds, params.issueKey, params.maxResults ?? 20);
      return { ok: true, comments };
    }

    // ── 7. Delete Comment ────────────────────────────────────────────────────
    if (toolName === 'jira_delete_comment') {
      const result = await JiraAPI.deleteComment(creds, params.issueKey, params.commentId);
      return { ok: true, deleted: result };
    }

    // ── 8. Assign Issue ──────────────────────────────────────────────────────
    if (toolName === 'jira_assign_issue') {
      const result = await JiraAPI.assignIssue(creds, params.issueKey, params.accountId ?? null);
      return { ok: true, assigned: result };
    }

    // ── 9. Get Transitions ───────────────────────────────────────────────────
    if (toolName === 'jira_get_transitions') {
      const transitions = await JiraAPI.getTransitions(creds, params.issueKey);
      return { ok: true, transitions };
    }

    // ── 10. Transition Issue ─────────────────────────────────────────────────
    if (toolName === 'jira_transition_issue') {
      const result = await JiraAPI.transitionIssue(creds, params.issueKey, params.transitionId);
      return { ok: true, transitioned: result };
    }

    // ── 11. List Projects ────────────────────────────────────────────────────
    if (toolName === 'jira_list_projects') {
      const projects = await JiraAPI.listProjects(creds);
      return { ok: true, projects };
    }

    // ── 12. Get Project ──────────────────────────────────────────────────────
    if (toolName === 'jira_get_project') {
      const project = await JiraAPI.getProject(creds, params.projectKey);
      return { ok: true, project };
    }

    // ── 13. Search Issues ────────────────────────────────────────────────────
    if (toolName === 'jira_search_issues') {
      const issues = await JiraAPI.searchIssues(creds, params.jql, params.maxResults ?? 25);
      return { ok: true, issues };
    }

    // ── 14. Get Boards ───────────────────────────────────────────────────────
    if (toolName === 'jira_get_boards') {
      const boards = await JiraAPI.getBoards(creds, params.maxResults ?? 25);
      return { ok: true, boards };
    }

    // ── 15. Get Board Sprints ────────────────────────────────────────────────
    if (toolName === 'jira_get_board_sprints') {
      const sprints = await JiraAPI.getBoardSprints(
        creds,
        params.boardId,
        params.state ?? 'active,future',
      );
      return { ok: true, sprints };
    }

    // ── 16. Get Sprint Issues ────────────────────────────────────────────────
    if (toolName === 'jira_get_sprint_issues') {
      const issues = await JiraAPI.getSprintIssues(creds, params.sprintId, params.maxResults ?? 50);
      return { ok: true, issues };
    }

    // ── 17. Get Backlog ──────────────────────────────────────────────────────
    if (toolName === 'jira_get_backlog') {
      const issues = await JiraAPI.getBacklog(creds, params.boardId, params.maxResults ?? 50);
      return { ok: true, issues };
    }

    // ── 18. Get Issue Types ──────────────────────────────────────────────────
    if (toolName === 'jira_get_issue_types') {
      const issueTypes = await JiraAPI.getIssueTypes(creds, params.projectKey);
      return { ok: true, issueTypes };
    }

    // ── 19. Get Priorities ───────────────────────────────────────────────────
    if (toolName === 'jira_get_priorities') {
      const priorities = await JiraAPI.getPriorities(creds);
      return { ok: true, priorities };
    }

    // ── 20. Search Users ─────────────────────────────────────────────────────
    if (toolName === 'jira_search_users') {
      const users = await JiraAPI.searchUsers(creds, params.query, params.maxResults ?? 10);
      return { ok: true, users };
    }

    // ── 21. Get Watchers ─────────────────────────────────────────────────────
    if (toolName === 'jira_get_watchers') {
      const watchers = await JiraAPI.getWatchers(creds, params.issueKey);
      return { ok: true, watchers };
    }

    // ── 22. Watch Issue ──────────────────────────────────────────────────────
    if (toolName === 'jira_watch_issue') {
      const result = await JiraAPI.watchIssue(creds, params.issueKey, params.accountId);
      return { ok: true, watching: result };
    }

    // ── 23. Get Changelog ────────────────────────────────────────────────────
    if (toolName === 'jira_get_changelog') {
      const changelog = await JiraAPI.getChangelog(creds, params.issueKey, params.maxResults ?? 25);
      return { ok: true, changelog };
    }

    // ── 24. Link Issues ──────────────────────────────────────────────────────
    if (toolName === 'jira_link_issues') {
      const result = await JiraAPI.linkIssues(
        creds,
        params.inwardIssueKey,
        params.outwardIssueKey,
        params.linkTypeName ?? 'Relates',
      );
      return { ok: true, linked: result };
    }

    // ── 25. Get Issue Link Types ─────────────────────────────────────────────
    if (toolName === 'jira_get_issue_link_types') {
      const linkTypes = await JiraAPI.getIssueLinkTypes(creds);
      return { ok: true, linkTypes };
    }

    // ── 26. Get Versions ─────────────────────────────────────────────────────
    if (toolName === 'jira_get_versions') {
      const versions = await JiraAPI.getVersions(creds, params.projectKey);
      return { ok: true, versions };
    }

    // ── 27. Create Version ───────────────────────────────────────────────────
    if (toolName === 'jira_create_version') {
      const version = await JiraAPI.createVersion(creds, params.projectKey, {
        name: params.name,
        description: params.description,
        releaseDate: params.releaseDate,
        startDate: params.startDate,
      });
      return { ok: true, version };
    }

    // ── 28. Get Worklogs ─────────────────────────────────────────────────────
    if (toolName === 'jira_get_worklogs') {
      const worklogs = await JiraAPI.getWorklogs(creds, params.issueKey);
      return { ok: true, worklogs };
    }

    // ── 29. Log Work ─────────────────────────────────────────────────────────
    if (toolName === 'jira_log_work') {
      const worklog = await JiraAPI.logWork(creds, params.issueKey, {
        timeSpent: params.timeSpent,
        comment: params.comment,
        started: params.started,
      });
      return { ok: true, worklog };
    }

    // ── 30. Get Statuses ─────────────────────────────────────────────────────
    if (toolName === 'jira_get_statuses') {
      const statuses = await JiraAPI.getStatuses(creds, params.projectKey);
      return { ok: true, statuses };
    }

    // ── Unknown tool ─────────────────────────────────────────────────────────
    return null;
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
