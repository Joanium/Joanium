import defineFeature from '../../Core/DefineFeature.js';
import * as JiraAPI from './API/JiraAPI.js';
import { getJiraCredentials, withJira } from './Shared/Common.js';
import { JIRA_TOOLS } from './Chat/Tools.js';
import { executeJiraChatTool } from './Chat/ChatExecutor.js';

export default defineFeature({
  id: 'jira',
  name: 'Jira',

  connectors: {
    services: [
      {
        id: 'jira',
        name: 'Jira',
        icon: '<img src="../../../Assets/Icons/Jira.png" alt="Jira" class="connector-icon-img" />',
        description:
          'Track tickets, browse projects, and monitor assigned issues across your Jira Cloud workspace.',
        helpUrl: 'https://id.atlassian.com/manage-profile/security/api-tokens',
        helpText: 'Create an API Token →',
        oauthType: null,
        subServices: [],
        setupSteps: [
          'Go to id.atlassian.com/manage-profile/security/api-tokens',
          'Click "Create API token" and give it a label',
          'Copy the token and enter it below along with your Atlassian email',
          'Enter your Jira site URL (e.g. https://yourcompany.atlassian.net)',
        ],
        capabilities: [
          'List your assigned Jira issues with status and priority',
          'Browse projects across your Jira workspace',
          'Create, update, delete, and transition issues',
          'Manage comments, worklogs, and watchers',
          'Browse boards, sprints, backlogs, and versions',
          'Search users and link issues together',
          'Monitor issue workload via agents',
        ],
        fields: [
          {
            key: 'email',
            label: 'Atlassian Email',
            placeholder: 'you@example.com',
            type: 'text',
            hint: 'The email address associated with your Atlassian account.',
          },
          {
            key: 'token',
            label: 'API Token',
            placeholder: 'Your Atlassian API token',
            type: 'password',
            hint: 'Create at id.atlassian.com/manage-profile/security/api-tokens.',
          },
          {
            key: 'siteUrl',
            label: 'Jira Site URL',
            placeholder: 'https://yourcompany.atlassian.net',
            type: 'text',
            hint: 'Your Jira Cloud site URL, e.g. https://yourcompany.atlassian.net',
          },
        ],
        defaultState: { enabled: false, credentials: {} },
        async validate(ctx) {
          const creds = ctx.connectorEngine?.getCredentials('jira');
          if (!creds?.email || !creds?.token || !creds?.siteUrl)
            return { ok: false, error: 'Email, API token, and site URL are all required' };
          try {
            const me = await JiraAPI.getMyself(creds);
            ctx.connectorEngine?.updateCredentials('jira', {
              displayName: me.displayName ?? null,
              accountId: me.accountId ?? null,
            });
            return { ok: true, displayName: me.displayName };
          } catch (err) {
            return { ok: false, error: err.message };
          }
        },
      },
    ],
  },

  main: {
    methods: {
      // ── Existing ────────────────────────────────────────────────────────────
      listProjects: async (ctx) =>
        withJira(ctx, async (creds) => ({
          ok: true,
          projects: await JiraAPI.listProjects(creds),
        })),

      getMyIssues: async (ctx, { limit } = {}) =>
        withJira(ctx, async (creds) => ({
          ok: true,
          issues: await JiraAPI.getMyOpenIssues(creds, limit ?? 25),
        })),

      searchIssues: async (ctx, { jql, limit } = {}) =>
        withJira(ctx, async (creds) => ({
          ok: true,
          issues: await JiraAPI.searchIssues(creds, jql ?? '', limit ?? 25),
        })),

      executeChatTool: async (ctx, { toolName, params }) =>
        executeJiraChatTool(ctx, toolName, params),

      // ── 1. Get Issue ────────────────────────────────────────────────────────
      getIssue: async (ctx, { issueKey }) =>
        withJira(ctx, async (creds) => ({
          ok: true,
          issue: await JiraAPI.getIssue(creds, issueKey),
        })),

      // ── 2. Create Issue ─────────────────────────────────────────────────────
      createIssue: async (ctx, params) =>
        withJira(ctx, async (creds) => ({
          ok: true,
          created: await JiraAPI.createIssue(creds, params),
        })),

      // ── 3. Update Issue ─────────────────────────────────────────────────────
      updateIssue: async (ctx, { issueKey, ...updates }) =>
        withJira(ctx, async (creds) => ({
          ok: true,
          updated: await JiraAPI.updateIssue(creds, issueKey, updates),
        })),

      // ── 4. Delete Issue ─────────────────────────────────────────────────────
      deleteIssue: async (ctx, { issueKey }) =>
        withJira(ctx, async (creds) => ({
          ok: true,
          deleted: await JiraAPI.deleteIssue(creds, issueKey),
        })),

      // ── 5. Add Comment ──────────────────────────────────────────────────────
      addComment: async (ctx, { issueKey, comment }) =>
        withJira(ctx, async (creds) => ({
          ok: true,
          comment: await JiraAPI.addComment(creds, issueKey, comment),
        })),

      // ── 6. Get Comments ─────────────────────────────────────────────────────
      getComments: async (ctx, { issueKey, maxResults } = {}) =>
        withJira(ctx, async (creds) => ({
          ok: true,
          comments: await JiraAPI.getComments(creds, issueKey, maxResults ?? 20),
        })),

      // ── 7. Delete Comment ───────────────────────────────────────────────────
      deleteComment: async (ctx, { issueKey, commentId }) =>
        withJira(ctx, async (creds) => ({
          ok: true,
          deleted: await JiraAPI.deleteComment(creds, issueKey, commentId),
        })),

      // ── 8. Assign Issue ─────────────────────────────────────────────────────
      assignIssue: async (ctx, { issueKey, accountId }) =>
        withJira(ctx, async (creds) => ({
          ok: true,
          assigned: await JiraAPI.assignIssue(creds, issueKey, accountId ?? null),
        })),

      // ── 9. Get Transitions ──────────────────────────────────────────────────
      getTransitions: async (ctx, { issueKey }) =>
        withJira(ctx, async (creds) => ({
          ok: true,
          transitions: await JiraAPI.getTransitions(creds, issueKey),
        })),

      // ── 10. Transition Issue ────────────────────────────────────────────────
      transitionIssue: async (ctx, { issueKey, transitionId }) =>
        withJira(ctx, async (creds) => ({
          ok: true,
          transitioned: await JiraAPI.transitionIssue(creds, issueKey, transitionId),
        })),

      // ── 11. Get Project ─────────────────────────────────────────────────────
      getProject: async (ctx, { projectKey }) =>
        withJira(ctx, async (creds) => ({
          ok: true,
          project: await JiraAPI.getProject(creds, projectKey),
        })),

      // ── 12. Get Boards ──────────────────────────────────────────────────────
      getBoards: async (ctx, { maxResults } = {}) =>
        withJira(ctx, async (creds) => ({
          ok: true,
          boards: await JiraAPI.getBoards(creds, maxResults ?? 25),
        })),

      // ── 13. Get Board Sprints ───────────────────────────────────────────────
      getBoardSprints: async (ctx, { boardId, state } = {}) =>
        withJira(ctx, async (creds) => ({
          ok: true,
          sprints: await JiraAPI.getBoardSprints(creds, boardId, state ?? 'active,future'),
        })),

      // ── 14. Get Sprint Issues ───────────────────────────────────────────────
      getSprintIssues: async (ctx, { sprintId, maxResults } = {}) =>
        withJira(ctx, async (creds) => ({
          ok: true,
          issues: await JiraAPI.getSprintIssues(creds, sprintId, maxResults ?? 50),
        })),

      // ── 15. Get Backlog ─────────────────────────────────────────────────────
      getBacklog: async (ctx, { boardId, maxResults } = {}) =>
        withJira(ctx, async (creds) => ({
          ok: true,
          issues: await JiraAPI.getBacklog(creds, boardId, maxResults ?? 50),
        })),

      // ── 16. Get Issue Types ─────────────────────────────────────────────────
      getIssueTypes: async (ctx, { projectKey }) =>
        withJira(ctx, async (creds) => ({
          ok: true,
          issueTypes: await JiraAPI.getIssueTypes(creds, projectKey),
        })),

      // ── 17. Get Priorities ──────────────────────────────────────────────────
      getPriorities: async (ctx) =>
        withJira(ctx, async (creds) => ({
          ok: true,
          priorities: await JiraAPI.getPriorities(creds),
        })),

      // ── 18. Search Users ────────────────────────────────────────────────────
      searchUsers: async (ctx, { query, maxResults } = {}) =>
        withJira(ctx, async (creds) => ({
          ok: true,
          users: await JiraAPI.searchUsers(creds, query, maxResults ?? 10),
        })),

      // ── 19. Get Watchers ────────────────────────────────────────────────────
      getWatchers: async (ctx, { issueKey }) =>
        withJira(ctx, async (creds) => ({
          ok: true,
          watchers: await JiraAPI.getWatchers(creds, issueKey),
        })),

      // ── 20. Watch Issue ─────────────────────────────────────────────────────
      watchIssue: async (ctx, { issueKey, accountId }) =>
        withJira(ctx, async (creds) => ({
          ok: true,
          watching: await JiraAPI.watchIssue(creds, issueKey, accountId),
        })),

      // ── 21. Unwatch Issue ───────────────────────────────────────────────────
      unwatchIssue: async (ctx, { issueKey, accountId }) =>
        withJira(ctx, async (creds) => ({
          ok: true,
          unwatched: await JiraAPI.unwatchIssue(creds, issueKey, accountId),
        })),

      // ── 22. Get Changelog ───────────────────────────────────────────────────
      getChangelog: async (ctx, { issueKey, maxResults } = {}) =>
        withJira(ctx, async (creds) => ({
          ok: true,
          changelog: await JiraAPI.getChangelog(creds, issueKey, maxResults ?? 25),
        })),

      // ── 23. Link Issues ─────────────────────────────────────────────────────
      linkIssues: async (ctx, { inwardIssueKey, outwardIssueKey, linkTypeName } = {}) =>
        withJira(ctx, async (creds) => ({
          ok: true,
          linked: await JiraAPI.linkIssues(
            creds,
            inwardIssueKey,
            outwardIssueKey,
            linkTypeName ?? 'Relates',
          ),
        })),

      // ── 24. Get Issue Link Types ────────────────────────────────────────────
      getIssueLinkTypes: async (ctx) =>
        withJira(ctx, async (creds) => ({
          ok: true,
          linkTypes: await JiraAPI.getIssueLinkTypes(creds),
        })),

      // ── 25. Get Versions ────────────────────────────────────────────────────
      getVersions: async (ctx, { projectKey }) =>
        withJira(ctx, async (creds) => ({
          ok: true,
          versions: await JiraAPI.getVersions(creds, projectKey),
        })),

      // ── 26. Create Version ──────────────────────────────────────────────────
      createVersion: async (ctx, { projectKey, ...versionParams }) =>
        withJira(ctx, async (creds) => ({
          ok: true,
          version: await JiraAPI.createVersion(creds, projectKey, versionParams),
        })),

      // ── 27. Get Worklogs ────────────────────────────────────────────────────
      getWorklogs: async (ctx, { issueKey }) =>
        withJira(ctx, async (creds) => ({
          ok: true,
          worklogs: await JiraAPI.getWorklogs(creds, issueKey),
        })),

      // ── 28. Log Work ────────────────────────────────────────────────────────
      logWork: async (ctx, { issueKey, ...workParams }) =>
        withJira(ctx, async (creds) => ({
          ok: true,
          worklog: await JiraAPI.logWork(creds, issueKey, workParams),
        })),

      // ── 29. Get Statuses ────────────────────────────────────────────────────
      getStatuses: async (ctx, { projectKey }) =>
        withJira(ctx, async (creds) => ({
          ok: true,
          statuses: await JiraAPI.getStatuses(creds, projectKey),
        })),

      // ── 30. Get Labels ──────────────────────────────────────────────────────
      getLabels: async (ctx, { startAt, maxResults } = {}) =>
        withJira(ctx, async (creds) => ({
          ok: true,
          labels: await JiraAPI.getLabels(creds, startAt ?? 0, maxResults ?? 50),
        })),
    },
  },

  renderer: { chatTools: JIRA_TOOLS },

  prompt: {
    async getContext(ctx) {
      const creds = getJiraCredentials(ctx);
      if (!creds) return null;
      const name = creds.displayName ?? creds.email ?? null;
      return {
        connectedServices: [name ? `Jira (${name})` : 'Jira'],
        sections: [
          'Jira is connected. Available tools: jira_list_my_issues, jira_get_issue, jira_create_issue, jira_update_issue, jira_delete_issue, jira_add_comment, jira_get_comments, jira_delete_comment, jira_assign_issue, jira_get_transitions, jira_transition_issue, jira_list_projects, jira_get_project, jira_search_issues, jira_get_boards, jira_get_board_sprints, jira_get_sprint_issues, jira_get_backlog, jira_get_issue_types, jira_get_priorities, jira_search_users, jira_get_watchers, jira_watch_issue, jira_get_changelog, jira_link_issues, jira_get_issue_link_types, jira_get_versions, jira_create_version, jira_get_worklogs, jira_log_work, jira_get_statuses.',
        ],
      };
    },
  },
});
