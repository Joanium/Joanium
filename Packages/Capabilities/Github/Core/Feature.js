import defineFeature from '../../Core/DefineFeature.js';
import { GithubAPI, getGithubCredentials, withGithub } from './Shared/Common.js';
import { GITHUB_TOOLS } from './Chat/Tools.js';
import { executeGithubChatTool } from './Chat/ChatExecutor.js';
export default defineFeature({
  id: 'github',
  name: 'GitHub',
  connectors: {
    services: [
      {
        id: 'github',
        name: 'GitHub',
        icon: '<img src="../../../Assets/Icons/Github.png" alt="Github" class="connector-icon-img" />',
        description:
          'Browse repos, load code into chat, track issues and PRs, and monitor notifications.',
        helpUrl: 'https://github.com/settings/tokens/new?scopes=repo,read:user,notifications',
        helpText: 'Create a Personal Access Token ->',
        oauthType: null,
        subServices: [],
        setupSteps: [],
        capabilities: [
          'Ask about repos, issues, PRs, and code in chat',
          'Track GitHub work via agents',
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
  prompt: {
    async getContext(ctx) {
      const credentials = getGithubCredentials(ctx);
      if (!credentials) return null;
      const username = credentials.username ?? null;
      return { connectedServices: [username ? `GitHub (@${username})` : 'GitHub'], sections: [] };
    },
  },
});
