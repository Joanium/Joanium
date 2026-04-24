import defineFeature from '../../Core/DefineFeature.js';
import { GithubAPI, getGithubCredentials, withGithub } from './Shared/Common.js';
import { GITHUB_TOOLS } from './Chat/Tools.js';
import { executeGithubChatTool } from './Chat/ChatExecutor.js';
import {
  githubDataSourceCollectors,
  githubOutputHandlers,
} from './Automation/AutomationHandlers.js';
export default defineFeature({
  id: 'github',
  name: 'GitHub',
  connectors: {
    services: [
      {
        id: 'github',
        name: 'GitHub',
        icon: '<img src="../../../Assets/Icons/Github.png" alt="Github" style="width: 26px; height: 26px; object-fit: contain;" />',
        description:
          'Browse repos, load code into chat, track issues and PRs, and monitor notifications.',
        helpUrl: 'https://github.com/settings/tokens/new?scopes=repo,read:user,notifications',
        helpText: 'Create a Personal Access Token ->',
        oauthType: null,
        subServices: [],
        setupSteps: [],
        capabilities: [
          'Ask about repos, issues, PRs, and code in chat',
          'Track GitHub work via automations and agents',
          'Review PRs and workflow runs from one connector',
        ],
        fields: [
          {
            key: 'token',
            label: 'Personal Access Token',
            placeholder: 'ghp_...',
            type: 'password',
            hint: 'Create at github.com/settings/tokens. repo, read:user, and notifications scopes are recommended.',
          },
        ],
        automations: [
          {
            name: 'Daily PR Summary',
            description: 'Every morning, notify about open pull requests',
          },
          { name: 'Issue Tracker', description: 'Daily, notify about open issues in a repo' },
          {
            name: 'GitHub Notifications',
            description: 'Hourly, notify if there are unread notifications',
          },
        ],
        defaultState: { enabled: !1, credentials: {} },
        async validate(ctx) {
          const credentials = ctx.connectorEngine?.getCredentials('github');
          if (!credentials?.token) return { ok: !1, error: 'No credentials stored' };
          const user = await GithubAPI.getUser(credentials);
          return (
            ctx.connectorEngine?.updateCredentials('github', {
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
        withGithub(ctx, async (credentials) => ({
          ok: !0,
          repos: await GithubAPI.getRepos(credentials),
        })),
      getFile: async (ctx, { owner: owner, repo: repo, filePath: filePath }) =>
        withGithub(ctx, async (credentials) => ({
          ok: !0,
          ...(await GithubAPI.getFileContent(credentials, owner, repo, filePath)),
        })),
      getTree: async (ctx, { owner: owner, repo: repo, branch: branch }) =>
        withGithub(ctx, async (credentials) => {
          const tree = await GithubAPI.getRepoTree(credentials, owner, repo, branch);
          return { ok: !0, tree: tree?.tree ?? [] };
        }),
      getIssues: async (ctx, { owner: owner, repo: repo, state: state = 'open' }) =>
        withGithub(ctx, async (credentials) => ({
          ok: !0,
          issues: await GithubAPI.getIssues(credentials, owner, repo, state),
        })),
      getPRs: async (ctx, { owner: owner, repo: repo, state: state = 'open' }) =>
        withGithub(ctx, async (credentials) => ({
          ok: !0,
          prs: await GithubAPI.getPullRequests(credentials, owner, repo, state),
        })),
      getNotifications: async (ctx) =>
        withGithub(ctx, async (credentials) => ({
          ok: !0,
          notifications: await GithubAPI.getNotifications(credentials),
        })),
      getCommits: async (ctx, { owner: owner, repo: repo, perPage: perPage = 20 }) =>
        withGithub(ctx, async (credentials) => ({
          ok: !0,
          commits: await GithubAPI.getCommits(credentials, owner, repo, perPage),
        })),
      searchCode: async (ctx, { owner: owner, repo: repo, query: query }) =>
        withGithub(ctx, async (credentials) => ({
          ok: !0,
          ...(await GithubAPI.searchCode(
            credentials,
            query,
            owner && repo ? `${owner}/${repo}` : '',
          )),
        })),
      getPRDiff: async (ctx, { owner: owner, repo: repo, prNumber: prNumber }) =>
        withGithub(ctx, async (credentials) => ({
          ok: !0,
          diff: await GithubAPI.getPRDiff(credentials, owner, repo, prNumber),
        })),
      getPRDetails: async (ctx, { owner: owner, repo: repo, prNumber: prNumber }) =>
        withGithub(ctx, async (credentials) => ({
          ok: !0,
          pr: await GithubAPI.getPRDetails(credentials, owner, repo, prNumber),
        })),
      createPRReview: async (
        ctx,
        { owner: owner, repo: repo, prNumber: prNumber, review: review = {} },
      ) =>
        withGithub(ctx, async (credentials) => ({
          ok: !0,
          ...(await GithubAPI.createPRReview(credentials, owner, repo, prNumber, review)),
        })),
      getPRChecks: async (ctx, { owner: owner, repo: repo, prNumber: prNumber }) =>
        withGithub(ctx, async (credentials) => ({
          ok: !0,
          checks: await GithubAPI.getPRChecks(credentials, owner, repo, prNumber),
        })),
      getWorkflowRuns: async (
        ctx,
        { owner: owner, repo: repo, branch: branch = '', event: event = '', perPage: perPage = 20 },
      ) =>
        withGithub(ctx, async (credentials) => {
          const runs = await GithubAPI.getWorkflowRuns(credentials, owner, repo, {
            branch: branch,
            event: event,
            perPage: perPage,
          });
          return { ok: !0, runs: runs.workflow_runs ?? [], total_count: runs.total_count ?? 0 };
        }),
      getPRComments: async (ctx, { owner: owner, repo: repo, prNumber: prNumber }) =>
        withGithub(ctx, async (credentials) => ({
          ok: !0,
          comments: await GithubAPI.getPRComments(credentials, owner, repo, prNumber),
        })),
      getRepoStats: async (ctx, { owner: owner, repo: repo }) =>
        withGithub(ctx, async (credentials) => ({
          ok: !0,
          stats: await GithubAPI.getRepoStats(credentials, owner, repo),
        })),
      starRepo: async (ctx, { owner: owner, repo: repo }) =>
        withGithub(
          ctx,
          async (credentials) => (await GithubAPI.starRepo(credentials, owner, repo), { ok: !0 }),
        ),
      unstarRepo: async (ctx, { owner: owner, repo: repo }) =>
        withGithub(
          ctx,
          async (credentials) => (await GithubAPI.unstarRepo(credentials, owner, repo), { ok: !0 }),
        ),
      getReleases: async (ctx, { owner: owner, repo: repo, perPage: perPage = 10 }) =>
        withGithub(ctx, async (credentials) => ({
          ok: !0,
          releases: await GithubAPI.getReleases(credentials, owner, repo, perPage),
        })),
      getLatestRelease: async (ctx, { owner: owner, repo: repo }) =>
        withGithub(ctx, async (credentials) => ({
          ok: !0,
          release: await GithubAPI.getLatestRelease(credentials, owner, repo),
        })),
      createPR: async (ctx, { owner: owner, repo: repo, options: options = {} }) =>
        withGithub(ctx, async (credentials) => ({
          ok: !0,
          pr: await GithubAPI.createPR(credentials, owner, repo, options),
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
        withGithub(ctx, async (credentials) => ({
          ok: !0,
          ...(await GithubAPI.mergePR(
            credentials,
            owner,
            repo,
            prNumber,
            mergeMethod,
            commitTitle,
          )),
        })),
      closePR: async (ctx, { owner: owner, repo: repo, prNumber: prNumber }) =>
        withGithub(ctx, async (credentials) => ({
          ok: !0,
          pr: await GithubAPI.closePR(credentials, owner, repo, prNumber),
        })),
      createIssue: async (
        ctx,
        { owner: owner, repo: repo, title: title, body: body = '', labels: labels = [] },
      ) =>
        withGithub(ctx, async (credentials) => ({
          ok: !0,
          issue: await GithubAPI.createIssue(credentials, owner, repo, title, body, labels),
        })),
      closeIssue: async (
        ctx,
        { owner: owner, repo: repo, issueNumber: issueNumber, reason: reason = 'completed' },
      ) =>
        withGithub(ctx, async (credentials) => ({
          ok: !0,
          issue: await GithubAPI.closeIssue(credentials, owner, repo, issueNumber, reason),
        })),
      reopenIssue: async (ctx, { owner: owner, repo: repo, issueNumber: issueNumber }) =>
        withGithub(ctx, async (credentials) => ({
          ok: !0,
          issue: await GithubAPI.reopenIssue(credentials, owner, repo, issueNumber),
        })),
      commentIssue: async (
        ctx,
        { owner: owner, repo: repo, issueNumber: issueNumber, body: body },
      ) =>
        withGithub(ctx, async (credentials) => ({
          ok: !0,
          comment: await GithubAPI.addIssueComment(credentials, owner, repo, issueNumber, body),
        })),
      addLabels: async (
        ctx,
        { owner: owner, repo: repo, issueNumber: issueNumber, labels: labels = [] },
      ) =>
        withGithub(ctx, async (credentials) => ({
          ok: !0,
          labels: await GithubAPI.addLabels(credentials, owner, repo, issueNumber, labels),
        })),
      addAssignees: async (
        ctx,
        { owner: owner, repo: repo, issueNumber: issueNumber, assignees: assignees = [] },
      ) =>
        withGithub(ctx, async (credentials) => ({
          ok: !0,
          result: await GithubAPI.addAssignees(credentials, owner, repo, issueNumber, assignees),
        })),
      markNotificationsRead: async (ctx) =>
        withGithub(
          ctx,
          async (credentials) => (
            await GithubAPI.markAllNotificationsRead(credentials),
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
        withGithub(
          ctx,
          async (credentials) => (
            await GithubAPI.triggerWorkflow(credentials, owner, repo, workflowId, ref, inputs),
            { ok: !0 }
          ),
        ),
      getLatestWorkflowRun: async (
        ctx,
        { owner: owner, repo: repo, workflowId: workflowId, branch: branch = '' },
      ) =>
        withGithub(ctx, async (credentials) => ({
          ok: !0,
          run: await GithubAPI.getLatestWorkflowRun(credentials, owner, repo, workflowId, branch),
        })),
      createGist: async (
        ctx,
        { description: description, files: files, isPublic: isPublic = !1 },
      ) =>
        withGithub(ctx, async (credentials) => ({
          ok: !0,
          gist: await GithubAPI.createGist(credentials, description, files, isPublic),
        })),
      getBranches: async (ctx, { owner: owner, repo: repo }) =>
        withGithub(ctx, async (credentials) => ({
          ok: !0,
          branches: await GithubAPI.getBranches(credentials, owner, repo),
        })),
      executeChatTool: async (ctx, { toolName: toolName, params: params }) =>
        executeGithubChatTool(ctx, toolName, params),
    },
  },
  renderer: { chatTools: GITHUB_TOOLS },
  automation: {
    dataSources: [
      { value: 'github_notifications', label: 'GitHub - Notifications', group: 'GitHub' },
      {
        value: 'github_repos',
        label: 'GitHub - All my repos',
        group: 'GitHub',
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
        value: 'github_prs',
        label: 'GitHub - Pull requests',
        group: 'GitHub',
        params: [
          {
            key: 'owner',
            label: 'Owner / org',
            type: 'text',
            required: !0,
            placeholder: 'github-username or org',
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
        value: 'github_issues',
        label: 'GitHub - Issues',
        group: 'GitHub',
        params: [
          {
            key: 'owner',
            label: 'Owner / org',
            type: 'text',
            required: !0,
            placeholder: 'github-username or org',
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
        value: 'github_commits',
        label: 'GitHub - Recent commits',
        group: 'GitHub',
        params: [
          {
            key: 'owner',
            label: 'Owner / org',
            type: 'text',
            required: !0,
            placeholder: 'github-username or org',
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
        value: 'github_releases',
        label: 'GitHub - Releases',
        group: 'GitHub',
        params: [
          {
            key: 'owner',
            label: 'Owner / org',
            type: 'text',
            required: !0,
            placeholder: 'github-username or org',
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
        value: 'github_workflow_runs',
        label: 'GitHub - Workflow runs',
        group: 'GitHub',
        params: [
          {
            key: 'owner',
            label: 'Owner / org',
            type: 'text',
            required: !0,
            placeholder: 'github-username or org',
          },
          {
            key: 'repo',
            label: 'Repository',
            type: 'text',
            required: !0,
            placeholder: 'repository-name',
          },
          { key: 'branch', label: 'Branch', type: 'text', placeholder: 'main' },
          {
            key: 'event',
            label: 'Event',
            type: 'text',
            placeholder: 'push, pull_request, workflow_dispatch',
          },
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
        value: 'github_repo_stats',
        label: 'GitHub - Repo stats',
        group: 'GitHub',
        params: [
          {
            key: 'owner',
            label: 'Owner / org',
            type: 'text',
            required: !0,
            placeholder: 'github-username or org',
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
        value: 'github_pr_review',
        label: 'Post GitHub PR review',
        group: 'GitHub',
        params: [
          {
            key: 'owner',
            label: 'Owner / org',
            type: 'text',
            required: !0,
            placeholder: 'github-username or org',
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
            label: 'PR number',
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
      github_notifications:
        'Review these GitHub notifications. Group them by type and list the most urgent action items first.',
      github_repos: 'Review my repositories and summarize which ones need attention.',
      github_prs:
        'Analyze these pull requests. Summarize what each one does, whether it is ready to merge, and any blockers.',
      github_issues:
        'Review these issues. Categorize by priority and flag anything blocked, unclear, or ready to close.',
      github_commits:
        'Analyze recent commits. Summarize what changed and flag any risky or unusually large changes.',
      github_releases:
        'Review these releases. Summarize what shipped, any breaking changes, and whether any follow-up is needed.',
      github_workflow_runs:
        'Review these workflow runs. Identify failures, flaky checks, or anything that needs attention.',
      github_repo_stats:
        'Analyze this repository data and highlight any important trends or changes.',
    },
    dataSourceCollectors: githubDataSourceCollectors,
    outputHandlers: githubOutputHandlers,
  },
  prompt: {
    async getContext(ctx) {
      const credentials = getGithubCredentials(ctx);
      if (!credentials) return null;
      const username = credentials.username ?? null;
      return { connectedServices: [username ? `GitHub (@${username})` : 'GitHub'], sections: [] };
    },
  },
});
