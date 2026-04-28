import defineFeature from '../../Core/DefineFeature.js';
import { GitlabAPI, getGitlabCredentials, withGitlab } from './Shared/Common.js';
import { GITLAB_TOOLS } from './Chat/Tools.js';
import { executeGitlabChatTool } from './Chat/ChatExecutor.js';
import {
  gitlabDataSourceCollectors,
  gitlabOutputHandlers,
} from './Automation/AutomationHandlers.js';
export default defineFeature({
  id: 'gitlab',
  name: 'GitLab',
  connectors: {
    services: [
      {
        id: 'gitlab',
        name: 'GitLab',
        icon: '<img src="../../../Assets/Icons/Gitlab.png" alt="GitLab" class="connector-icon-img" />',
        description:
          'Browse repos, load code into chat, track issues and MRs, and monitor notifications.',
        helpUrl: 'https://gitlab.com/-/user_settings/personal_access_tokens',
        helpText: 'Create a Personal Access Token ->',
        oauthType: null,
        subServices: [],
        setupSteps: [],
        capabilities: [
          'Ask about repos, issues, MRs, and code in chat',
          'Track GitLab work via automations and agents',
          'Review MRs and pipeline runs from one connector',
        ],
        fields: [
          {
            key: 'token',
            label: 'Personal Access Token',
            placeholder: 'glpat-...',
            type: 'password',
            hint: 'Create at gitlab.com/-/user_settings/personal_access_tokens. read_api, read_repository, read_user scopes are recommended.',
          },
        ],
        automations: [
          {
            name: 'Daily MR Summary',
            description: 'Every morning, notify about open merge requests',
          },
          { name: 'Issue Tracker', description: 'Daily, notify about open issues in a repo' },
          {
            name: 'GitLab Notifications',
            description: 'Hourly, notify if there are unread notifications',
          },
        ],
        defaultState: { enabled: !1, credentials: {} },
        async validate(ctx) {
          const credentials = ctx.connectorEngine?.getCredentials('gitlab');
          if (!credentials?.token) return { ok: !1, error: 'No credentials stored' };
          const user = await GitlabAPI.getUser(credentials);
          return (
            ctx.connectorEngine?.updateCredentials('gitlab', {
              username: user.login,
              avatar: user.avatar_url,
            }),
            { ok: !0, username: user.login, avatar: user.avatar_url }
          );
        },
      },
    ],
  },
  main: {
    methods: {
      getRepos: async (ctx) =>
        withGitlab(ctx, async (credentials) => ({
          ok: !0,
          repos: await GitlabAPI.getRepos(credentials),
        })),
      getFile: async (ctx, { owner: owner, repo: repo, filePath: filePath }) =>
        withGitlab(ctx, async (credentials) => ({
          ok: !0,
          ...(await GitlabAPI.getFileContent(credentials, owner, repo, filePath)),
        })),
      getTree: async (ctx, { owner: owner, repo: repo, branch: branch }) =>
        withGitlab(ctx, async (credentials) => {
          const tree = await GitlabAPI.getRepoTree(credentials, owner, repo, branch);
          return { ok: !0, tree: tree?.tree ?? [] };
        }),
      getIssues: async (ctx, { owner: owner, repo: repo, state: state = 'open' }) =>
        withGitlab(ctx, async (credentials) => ({
          ok: !0,
          issues: await GitlabAPI.getIssues(credentials, owner, repo, state),
        })),
      getPRs: async (ctx, { owner: owner, repo: repo, state: state = 'open' }) =>
        withGitlab(ctx, async (credentials) => ({
          ok: !0,
          prs: await GitlabAPI.getPullRequests(credentials, owner, repo, state),
        })),
      getNotifications: async (ctx) =>
        withGitlab(ctx, async (credentials) => ({
          ok: !0,
          notifications: await GitlabAPI.getNotifications(credentials),
        })),
      getCommits: async (ctx, { owner: owner, repo: repo, perPage: perPage = 20 }) =>
        withGitlab(ctx, async (credentials) => ({
          ok: !0,
          commits: await GitlabAPI.getCommits(credentials, owner, repo, perPage),
        })),
      searchCode: async (ctx, { owner: owner, repo: repo, query: query }) =>
        withGitlab(ctx, async (credentials) => ({
          ok: !0,
          ...(await GitlabAPI.searchCode(
            credentials,
            query,
            owner && repo ? `${owner}/${repo}` : '',
          )),
        })),
      getPRDiff: async (ctx, { owner: owner, repo: repo, prNumber: prNumber }) =>
        withGitlab(ctx, async (credentials) => ({
          ok: !0,
          diff: await GitlabAPI.getPRDiff(credentials, owner, repo, prNumber),
        })),
      getPRDetails: async (ctx, { owner: owner, repo: repo, prNumber: prNumber }) =>
        withGitlab(ctx, async (credentials) => ({
          ok: !0,
          pr: await GitlabAPI.getPRDetails(credentials, owner, repo, prNumber),
        })),
      createPRReview: async (
        ctx,
        { owner: owner, repo: repo, prNumber: prNumber, review: review = {} },
      ) =>
        withGitlab(ctx, async (credentials) => ({
          ok: !0,
          ...(await GitlabAPI.createPRReview(credentials, owner, repo, prNumber, review)),
        })),
      getPRChecks: async (ctx, { owner: owner, repo: repo, prNumber: prNumber }) =>
        withGitlab(ctx, async (credentials) => ({
          ok: !0,
          checks: await GitlabAPI.getPRChecks(credentials, owner, repo, prNumber),
        })),
      getWorkflowRuns: async (
        ctx,
        { owner: owner, repo: repo, branch: branch = '', event: event = '', perPage: perPage = 20 },
      ) =>
        withGitlab(ctx, async (credentials) => {
          const runs = await GitlabAPI.getWorkflowRuns(credentials, owner, repo, {
            branch: branch,
            event: event,
            perPage: perPage,
          });
          return { ok: !0, runs: runs.workflow_runs ?? [], total_count: runs.total_count ?? 0 };
        }),
      getPRComments: async (ctx, { owner: owner, repo: repo, prNumber: prNumber }) =>
        withGitlab(ctx, async (credentials) => ({
          ok: !0,
          comments: await GitlabAPI.getPRComments(credentials, owner, repo, prNumber),
        })),
      getRepoStats: async (ctx, { owner: owner, repo: repo }) =>
        withGitlab(ctx, async (credentials) => ({
          ok: !0,
          stats: await GitlabAPI.getRepoStats(credentials, owner, repo),
        })),
      starRepo: async (ctx, { owner: owner, repo: repo }) =>
        withGitlab(
          ctx,
          async (credentials) => (await GitlabAPI.starRepo(credentials, owner, repo), { ok: !0 }),
        ),
      unstarRepo: async (ctx, { owner: owner, repo: repo }) =>
        withGitlab(
          ctx,
          async (credentials) => (await GitlabAPI.unstarRepo(credentials, owner, repo), { ok: !0 }),
        ),
      getReleases: async (ctx, { owner: owner, repo: repo, perPage: perPage = 10 }) =>
        withGitlab(ctx, async (credentials) => ({
          ok: !0,
          releases: await GitlabAPI.getReleases(credentials, owner, repo, perPage),
        })),
      getLatestRelease: async (ctx, { owner: owner, repo: repo }) =>
        withGitlab(ctx, async (credentials) => ({
          ok: !0,
          release: await GitlabAPI.getLatestRelease(credentials, owner, repo),
        })),
      createPR: async (ctx, { owner: owner, repo: repo, options: options = {} }) =>
        withGitlab(ctx, async (credentials) => ({
          ok: !0,
          pr: await GitlabAPI.createPR(credentials, owner, repo, options),
        })),
      mergePR: async (
        ctx,
        {
          owner: owner,
          repo: repo,
          prNumber: prNumber,
          mergeMethod: mergeMethod = 'merge',
          commitTitle: commitTitle = '',
        },
      ) =>
        withGitlab(ctx, async (credentials) => ({
          ok: !0,
          ...(await GitlabAPI.mergePR(
            credentials,
            owner,
            repo,
            prNumber,
            mergeMethod,
            commitTitle,
          )),
        })),
      closePR: async (ctx, { owner: owner, repo: repo, prNumber: prNumber }) =>
        withGitlab(ctx, async (credentials) => ({
          ok: !0,
          pr: await GitlabAPI.closePR(credentials, owner, repo, prNumber),
        })),
      createIssue: async (
        ctx,
        { owner: owner, repo: repo, title: title, body: body = '', labels: labels = [] },
      ) =>
        withGitlab(ctx, async (credentials) => ({
          ok: !0,
          issue: await GitlabAPI.createIssue(credentials, owner, repo, title, body, labels),
        })),
      closeIssue: async (
        ctx,
        { owner: owner, repo: repo, issueNumber: issueNumber, reason: reason = 'completed' },
      ) =>
        withGitlab(ctx, async (credentials) => ({
          ok: !0,
          issue: await GitlabAPI.closeIssue(credentials, owner, repo, issueNumber, reason),
        })),
      reopenIssue: async (ctx, { owner: owner, repo: repo, issueNumber: issueNumber }) =>
        withGitlab(ctx, async (credentials) => ({
          ok: !0,
          issue: await GitlabAPI.reopenIssue(credentials, owner, repo, issueNumber),
        })),
      commentIssue: async (
        ctx,
        { owner: owner, repo: repo, issueNumber: issueNumber, body: body },
      ) =>
        withGitlab(ctx, async (credentials) => ({
          ok: !0,
          comment: await GitlabAPI.addIssueComment(credentials, owner, repo, issueNumber, body),
        })),
      addLabels: async (
        ctx,
        { owner: owner, repo: repo, issueNumber: issueNumber, labels: labels = [] },
      ) =>
        withGitlab(ctx, async (credentials) => ({
          ok: !0,
          labels: await GitlabAPI.addLabels(credentials, owner, repo, issueNumber, labels),
        })),
      addAssignees: async (
        ctx,
        { owner: owner, repo: repo, issueNumber: issueNumber, assignees: assignees = [] },
      ) =>
        withGitlab(ctx, async (credentials) => ({
          ok: !0,
          result: await GitlabAPI.addAssignees(credentials, owner, repo, issueNumber, assignees),
        })),
      markNotificationsRead: async (ctx) =>
        withGitlab(
          ctx,
          async (credentials) => (
            await GitlabAPI.markAllNotificationsRead(credentials),
            { ok: !0 }
          ),
        ),
      triggerWorkflow: async (
        ctx,
        {
          owner: owner,
          repo: repo,
          workflowId: workflowId,
          ref: ref = 'main',
          inputs: inputs = {},
        },
      ) =>
        withGitlab(
          ctx,
          async (credentials) => (
            await GitlabAPI.triggerWorkflow(credentials, owner, repo, workflowId, ref, inputs),
            { ok: !0 }
          ),
        ),
      getLatestWorkflowRun: async (
        ctx,
        { owner: owner, repo: repo, workflowId: workflowId, branch: branch = '' },
      ) =>
        withGitlab(ctx, async (credentials) => ({
          ok: !0,
          run: await GitlabAPI.getLatestWorkflowRun(credentials, owner, repo, workflowId, branch),
        })),
      createGist: async (
        ctx,
        { description: description, files: files, isPublic: isPublic = !1 },
      ) =>
        withGitlab(ctx, async (credentials) => ({
          ok: !0,
          gist: await GitlabAPI.createGist(credentials, description, files, isPublic),
        })),
      getBranches: async (ctx, { owner: owner, repo: repo }) =>
        withGitlab(ctx, async (credentials) => ({
          ok: !0,
          branches: await GitlabAPI.getBranches(credentials, owner, repo),
        })),
      executeChatTool: async (ctx, { toolName: toolName, params: params }) =>
        executeGitlabChatTool(ctx, toolName, params),
    },
  },
  renderer: { chatTools: GITLAB_TOOLS },
  automation: {
    dataSources: [
      { value: 'gitlab_notifications', label: 'GitLab - Notifications', group: 'GitLab' },
      {
        value: 'gitlab_repos',
        label: 'GitLab - All my repos',
        group: 'GitLab',
        params: [
          {
            key: 'maxResults',
            label: 'Max repos',
            type: 'number',
            min: 1,
            max: 100,
            defaultValue: 30,
            placeholder: '30',
          },
        ],
      },
      {
        value: 'gitlab_prs',
        label: 'GitLab - Merge requests',
        group: 'GitLab',
        params: [
          {
            key: 'owner',
            label: 'Owner / org',
            type: 'text',
            required: !0,
            placeholder: 'gitlab-username or org',
          },
          {
            key: 'repo',
            label: 'Repository',
            type: 'text',
            required: !0,
            placeholder: 'repository-name',
          },
          {
            key: 'state',
            label: 'State',
            type: 'select',
            options: ['open', 'closed', 'all'],
            defaultValue: 'open',
          },
          {
            key: 'maxResults',
            label: 'Max results',
            type: 'number',
            min: 1,
            max: 100,
            defaultValue: 20,
            placeholder: '20',
          },
        ],
      },
      {
        value: 'gitlab_issues',
        label: 'GitLab - Issues',
        group: 'GitLab',
        params: [
          {
            key: 'owner',
            label: 'Owner / org',
            type: 'text',
            required: !0,
            placeholder: 'gitlab-username or org',
          },
          {
            key: 'repo',
            label: 'Repository',
            type: 'text',
            required: !0,
            placeholder: 'repository-name',
          },
          {
            key: 'state',
            label: 'State',
            type: 'select',
            options: ['open', 'closed', 'all'],
            defaultValue: 'open',
          },
          {
            key: 'maxResults',
            label: 'Max results',
            type: 'number',
            min: 1,
            max: 100,
            defaultValue: 20,
            placeholder: '20',
          },
        ],
      },
      {
        value: 'gitlab_commits',
        label: 'GitLab - Recent commits',
        group: 'GitLab',
        params: [
          {
            key: 'owner',
            label: 'Owner / org',
            type: 'text',
            required: !0,
            placeholder: 'gitlab-username or org',
          },
          {
            key: 'repo',
            label: 'Repository',
            type: 'text',
            required: !0,
            placeholder: 'repository-name',
          },
          {
            key: 'maxResults',
            label: 'Max commits',
            type: 'number',
            min: 1,
            max: 100,
            defaultValue: 10,
            placeholder: '10',
          },
        ],
      },
      {
        value: 'gitlab_releases',
        label: 'GitLab - Releases',
        group: 'GitLab',
        params: [
          {
            key: 'owner',
            label: 'Owner / org',
            type: 'text',
            required: !0,
            placeholder: 'gitlab-username or org',
          },
          {
            key: 'repo',
            label: 'Repository',
            type: 'text',
            required: !0,
            placeholder: 'repository-name',
          },
          {
            key: 'maxResults',
            label: 'Max releases',
            type: 'number',
            min: 1,
            max: 100,
            defaultValue: 10,
            placeholder: '10',
          },
        ],
      },
      {
        value: 'gitlab_workflow_runs',
        label: 'GitLab - Pipeline runs',
        group: 'GitLab',
        params: [
          {
            key: 'owner',
            label: 'Owner / org',
            type: 'text',
            required: !0,
            placeholder: 'gitlab-username or org',
          },
          {
            key: 'repo',
            label: 'Repository',
            type: 'text',
            required: !0,
            placeholder: 'repository-name',
          },
          { key: 'branch', label: 'Branch', type: 'text', placeholder: 'main' },
          { key: 'event', label: 'Event', type: 'text', placeholder: 'push, merge_request' },
          {
            key: 'maxResults',
            label: 'Max runs',
            type: 'number',
            min: 1,
            max: 100,
            defaultValue: 20,
            placeholder: '20',
          },
        ],
      },
      {
        value: 'gitlab_repo_stats',
        label: 'GitLab - Repo stats',
        group: 'GitLab',
        params: [
          {
            key: 'owner',
            label: 'Owner / org',
            type: 'text',
            required: !0,
            placeholder: 'gitlab-username or org',
          },
          {
            key: 'repo',
            label: 'Repository',
            type: 'text',
            required: !0,
            placeholder: 'repository-name',
          },
        ],
      },
    ],
    outputTypes: [
      {
        value: 'gitlab_mr_review',
        label: 'Post GitLab MR review',
        group: 'GitLab',
        params: [
          {
            key: 'owner',
            label: 'Owner / org',
            type: 'text',
            required: !0,
            placeholder: 'gitlab-username or org',
          },
          {
            key: 'repo',
            label: 'Repository',
            type: 'text',
            required: !0,
            placeholder: 'repository-name',
          },
          {
            key: 'prNumber',
            label: 'MR number',
            type: 'number',
            required: !0,
            min: 1,
            placeholder: '12',
          },
          {
            key: 'event',
            label: 'Review event',
            type: 'select',
            options: ['COMMENT', 'APPROVE', 'REQUEST_CHANGES'],
            defaultValue: 'COMMENT',
          },
        ],
      },
    ],
    instructionTemplates: {
      gitlab_notifications:
        'Review these GitLab notifications. Group them by type and list the most urgent action items first.',
      gitlab_repos: 'Review my repositories and summarize which ones need attention.',
      gitlab_prs:
        'Analyze these merge requests. Summarize what each one does, whether it is ready to merge, and any blockers.',
      gitlab_issues:
        'Review these issues. Categorize by priority and flag anything blocked, unclear, or ready to close.',
      gitlab_commits:
        'Analyze recent commits. Summarize what changed and flag any risky or unusually large changes.',
      gitlab_releases:
        'Review these releases. Summarize what shipped, any breaking changes, and whether any follow-up is needed.',
      gitlab_workflow_runs:
        'Review these pipeline runs. Identify failures, flaky checks, or anything that needs attention.',
      gitlab_repo_stats:
        'Analyze this repository data and highlight any important trends or changes.',
    },
    dataSourceCollectors: gitlabDataSourceCollectors,
    outputHandlers: gitlabOutputHandlers,
  },
  prompt: {
    async getContext(ctx) {
      const credentials = getGitlabCredentials(ctx);
      if (!credentials) return null;
      const username = credentials.username ?? null;
      return { connectedServices: [username ? `GitLab (@${username})` : 'GitLab'], sections: [] };
    },
  },
});
