import defineFeature from '../../Core/DefineFeature.js';
import { GithubAPI, getGithubCredentials, notConnected } from './Shared/Common.js';
import { GITHUB_TOOLS } from './Chat/Tools.js';
import { executeGithubChatTool } from './Chat/ChatExecutor.js';
import { githubAutomationHandlers } from './Automation/AutomationHandlers.js';
import { githubDataSourceCollectors, githubOutputHandlers } from './Agents/AgentHandlers.js';

function withGithub(ctx, callback) {
  const credentials = getGithubCredentials(ctx);
  if (!credentials) return notConnected();
  return callback(credentials).catch(error => ({ ok: false, error: error.message }));
}

const GITHUB_ACTIONS = [
  { type: 'github_open_repo', label: 'Open repo in browser', group: 'GitHub', fields: ['owner', 'repo'], requiredFields: ['owner', 'repo'] },
  { type: 'github_check_prs', label: 'Check pull requests', group: 'GitHub', fields: ['owner', 'repo', 'state'], requiredFields: ['owner', 'repo'] },
  { type: 'github_check_issues', label: 'Check issues', group: 'GitHub', fields: ['owner', 'repo', 'state'], requiredFields: ['owner', 'repo'] },
  { type: 'github_check_commits', label: 'Check recent commits', group: 'GitHub', fields: ['owner', 'repo', 'maxResults'], requiredFields: ['owner', 'repo'] },
  { type: 'github_check_releases', label: 'Check latest release', group: 'GitHub', fields: ['owner', 'repo'], requiredFields: ['owner', 'repo'] },
  { type: 'github_check_notifs', label: 'GitHub notifications', group: 'GitHub', fields: [] },
  { type: 'github_create_issue', label: 'Create issue', group: 'GitHub', fields: ['owner', 'repo', 'issueTitle', 'issueBody', 'labels'], requiredFields: ['owner', 'repo', 'issueTitle'] },
  { type: 'github_repo_stats', label: 'Repo stats notification', group: 'GitHub', fields: ['owner', 'repo'], requiredFields: ['owner', 'repo'] },
  { type: 'github_star_repo', label: 'Star repository', group: 'GitHub', fields: ['owner', 'repo'], requiredFields: ['owner', 'repo'] },
  { type: 'github_create_pr', label: 'Create pull request', group: 'GitHub', fields: ['owner', 'repo', 'prTitle', 'prHead', 'prBase', 'issueBody', 'draft'], requiredFields: ['owner', 'repo', 'prTitle', 'prHead', 'prBase'] },
  { type: 'github_merge_pr', label: 'Merge pull request', group: 'GitHub', fields: ['owner', 'repo', 'prNumber', 'mergeMethod'], requiredFields: ['owner', 'repo', 'prNumber'] },
  { type: 'github_close_issue', label: 'Close issue', group: 'GitHub', fields: ['owner', 'repo', 'issueNumber', 'closeReason'], requiredFields: ['owner', 'repo', 'issueNumber'] },
  { type: 'github_comment_issue', label: 'Comment on issue or PR', group: 'GitHub', fields: ['owner', 'repo', 'issueNumber', 'issueBody'], requiredFields: ['owner', 'repo', 'issueNumber', 'issueBody'] },
  { type: 'github_add_labels', label: 'Add labels to issue or PR', group: 'GitHub', fields: ['owner', 'repo', 'issueNumber', 'labels'], requiredFields: ['owner', 'repo', 'issueNumber', 'labels'] },
  { type: 'github_assign', label: 'Assign issue or PR', group: 'GitHub', fields: ['owner', 'repo', 'issueNumber', 'assignees'], requiredFields: ['owner', 'repo', 'issueNumber', 'assignees'] },
  { type: 'github_mark_notifs_read', label: 'Mark notifications as read', group: 'GitHub', fields: [] },
  { type: 'github_trigger_workflow', label: 'Trigger workflow', group: 'GitHub', fields: ['owner', 'repo', 'workflowId', 'workflowRef', 'workflowInputs'], requiredFields: ['owner', 'repo', 'workflowId'] },
  { type: 'github_workflow_status', label: 'Workflow run status', group: 'GitHub', fields: ['owner', 'repo', 'workflowId', 'branch'], requiredFields: ['owner', 'repo', 'workflowId'] },
  { type: 'github_create_gist', label: 'Create Gist', group: 'GitHub', fields: ['gistFilename', 'content', 'description', 'isPublic', 'openInBrowser'], requiredFields: ['gistFilename', 'content'] },
];

const GITHUB_FIELD_META = {
  owner: { placeholder: 'github-username or org', textarea: false },
  repo: { placeholder: 'repository-name', textarea: false },
  state: { type: 'select', options: ['open', 'closed', 'all'], textarea: false },
  maxResults: { type: 'number', placeholder: '10', min: 1, max: 100, textarea: false },
  issueTitle: { placeholder: 'Bug: something broke in v2.1', textarea: false },
  issueBody: { placeholder: 'Steps to reproduce...', textarea: true },
  issueNumber: { type: 'number', placeholder: 'e.g. 42', min: 1, textarea: false },
  labels: { placeholder: 'bug, enhancement', textarea: false },
  assignees: { placeholder: 'alice, bob', textarea: false },
  prTitle: { placeholder: 'feat: add new feature', textarea: false },
  prHead: { placeholder: 'feature-branch', textarea: false },
  prBase: { placeholder: 'main', textarea: false },
  prNumber: { type: 'number', placeholder: 'e.g. 12', min: 1, textarea: false },
  mergeMethod: { type: 'select', options: ['merge', 'squash', 'rebase'], textarea: false },
  closeReason: { type: 'select', options: ['completed', 'not_planned', 'duplicate'], textarea: false },
  workflowId: { placeholder: 'ci.yml or numeric workflow ID', textarea: false },
  workflowRef: { placeholder: 'main', textarea: false },
  workflowInputs: { placeholder: '{"env":"staging"}', textarea: true, parse: 'json' },
  branch: { placeholder: 'main', textarea: false },
  gistFilename: { placeholder: 'snippet.js', textarea: false },
  content: { placeholder: 'Content...', textarea: true },
  description: { placeholder: 'Optional description', textarea: false },
  draft: { type: 'checkbox', textarea: false },
  isPublic: { type: 'checkbox', textarea: false },
  openInBrowser: { type: 'checkbox', textarea: false },
  event: { type: 'select', options: ['COMMENT', 'APPROVE', 'REQUEST_CHANGES'], textarea: false },
};

const GITHUB_FIELD_LABELS = {
  owner: 'Owner / org',
  repo: 'Repository',
  state: 'State',
  maxResults: 'Max results',
  issueTitle: 'Issue title',
  issueBody: 'Body',
  issueNumber: 'Issue / PR number',
  labels: 'Labels (comma-separated)',
  assignees: 'Assignees (comma-separated)',
  prTitle: 'PR title',
  prHead: 'Head branch',
  prBase: 'Base branch',
  prNumber: 'PR number',
  mergeMethod: 'Merge method',
  closeReason: 'Close reason',
  workflowId: 'Workflow file or ID',
  workflowRef: 'Ref (branch/tag)',
  workflowInputs: 'Workflow inputs JSON',
  branch: 'Branch',
  gistFilename: 'Filename',
  content: 'Content',
  description: 'Description',
  draft: 'Open as draft',
  isPublic: 'Make public',
  openInBrowser: 'Open in browser',
  event: 'Review event',
};

const GITHUB_DATA_SOURCES = [
  { value: 'github_notifications', label: 'GitHub - Notifications', group: 'GitHub' },
  {
    value: 'github_repos',
    label: 'GitHub - All my repos',
    group: 'GitHub',
    params: [
      { key: 'maxResults', label: 'Max repos', type: 'number', min: 1, max: 100, defaultValue: 30, placeholder: '30' },
    ],
  },
  {
    value: 'github_prs',
    label: 'GitHub - Pull requests',
    group: 'GitHub',
    params: [
      { key: 'owner', label: 'Owner / org', type: 'text', required: true, placeholder: 'github-username or org' },
      { key: 'repo', label: 'Repository', type: 'text', required: true, placeholder: 'repository-name' },
      { key: 'state', label: 'State', type: 'select', options: ['open', 'closed', 'all'], defaultValue: 'open' },
      { key: 'maxResults', label: 'Max results', type: 'number', min: 1, max: 100, defaultValue: 20, placeholder: '20' },
    ],
  },
  {
    value: 'github_issues',
    label: 'GitHub - Issues',
    group: 'GitHub',
    params: [
      { key: 'owner', label: 'Owner / org', type: 'text', required: true, placeholder: 'github-username or org' },
      { key: 'repo', label: 'Repository', type: 'text', required: true, placeholder: 'repository-name' },
      { key: 'state', label: 'State', type: 'select', options: ['open', 'closed', 'all'], defaultValue: 'open' },
      { key: 'maxResults', label: 'Max results', type: 'number', min: 1, max: 100, defaultValue: 20, placeholder: '20' },
    ],
  },
  {
    value: 'github_commits',
    label: 'GitHub - Recent commits',
    group: 'GitHub',
    params: [
      { key: 'owner', label: 'Owner / org', type: 'text', required: true, placeholder: 'github-username or org' },
      { key: 'repo', label: 'Repository', type: 'text', required: true, placeholder: 'repository-name' },
      { key: 'maxResults', label: 'Max commits', type: 'number', min: 1, max: 100, defaultValue: 10, placeholder: '10' },
    ],
  },
  {
    value: 'github_releases',
    label: 'GitHub - Releases',
    group: 'GitHub',
    params: [
      { key: 'owner', label: 'Owner / org', type: 'text', required: true, placeholder: 'github-username or org' },
      { key: 'repo', label: 'Repository', type: 'text', required: true, placeholder: 'repository-name' },
      { key: 'maxResults', label: 'Max releases', type: 'number', min: 1, max: 100, defaultValue: 10, placeholder: '10' },
    ],
  },
  {
    value: 'github_workflow_runs',
    label: 'GitHub - Workflow runs',
    group: 'GitHub',
    params: [
      { key: 'owner', label: 'Owner / org', type: 'text', required: true, placeholder: 'github-username or org' },
      { key: 'repo', label: 'Repository', type: 'text', required: true, placeholder: 'repository-name' },
      { key: 'branch', label: 'Branch', type: 'text', placeholder: 'main' },
      { key: 'event', label: 'Event', type: 'text', placeholder: 'push, pull_request, workflow_dispatch' },
      { key: 'maxResults', label: 'Max runs', type: 'number', min: 1, max: 100, defaultValue: 20, placeholder: '20' },
    ],
  },
  {
    value: 'github_repo_stats',
    label: 'GitHub - Repo stats',
    group: 'GitHub',
    params: [
      { key: 'owner', label: 'Owner / org', type: 'text', required: true, placeholder: 'github-username or org' },
      { key: 'repo', label: 'Repository', type: 'text', required: true, placeholder: 'repository-name' },
    ],
  },
];

const GITHUB_OUTPUT_TYPES = [
  {
    value: 'github_pr_review',
    label: 'Post GitHub PR review',
    group: 'GitHub',
    params: [
      { key: 'owner', label: 'Owner / org', type: 'text', required: true, placeholder: 'github-username or org' },
      { key: 'repo', label: 'Repository', type: 'text', required: true, placeholder: 'repository-name' },
      { key: 'prNumber', label: 'PR number', type: 'number', required: true, min: 1, placeholder: '12' },
      { key: 'event', label: 'Review event', type: 'select', options: ['COMMENT', 'APPROVE', 'REQUEST_CHANGES'], defaultValue: 'COMMENT' },
    ],
  },
];

const GITHUB_INSTRUCTION_TEMPLATES = {
  github_notifications: 'Review these GitHub notifications. Group them by type and list the most urgent action items first.',
  github_repos: 'Review my repositories and summarize which ones need attention.',
  github_prs: 'Analyze these pull requests. Summarize what each one does, whether it is ready to merge, and any blockers.',
  github_issues: 'Review these issues. Categorize by priority and flag anything blocked, unclear, or ready to close.',
  github_commits: 'Analyze recent commits. Summarize what changed and flag any risky or unusually large changes.',
  github_releases: 'Review these releases. Summarize what shipped, any breaking changes, and whether any follow-up is needed.',
  github_workflow_runs: 'Review these workflow runs. Identify failures, flaky checks, or anything that needs attention.',
  github_repo_stats: 'Analyze this repository data and highlight any important trends or changes.',
};

export default defineFeature({
  id: 'github',
  name: 'GitHub',
  connectors: {
    services: [
      {
        id: 'github',
        name: 'GitHub',
        icon: 'GH',
        description: 'Browse repos, load code into chat, track issues and PRs, and monitor notifications.',
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
          { name: 'Daily PR Summary', description: 'Every morning, notify about open pull requests' },
          { name: 'Issue Tracker', description: 'Daily, notify about open issues in a repo' },
          { name: 'GitHub Notifications', description: 'Hourly, notify if there are unread notifications' },
        ],
        defaultState: { enabled: false, credentials: {} },
        async validate(ctx) {
          const credentials = ctx.connectorEngine?.getCredentials('github');
          if (!credentials?.token) return { ok: false, error: 'No credentials stored' };
          const user = await GithubAPI.getUser(credentials);
          ctx.connectorEngine?.updateCredentials('github', { username: user.login, avatar: user.avatar_url });
          return { ok: true, username: user.login, avatar: user.avatar_url };
        },
      },
    ],
  },
  main: {
    methods: {
      async getRepos(ctx) {
        return withGithub(ctx, async credentials => ({ ok: true, repos: await GithubAPI.getRepos(credentials) }));
      },
      async getFile(ctx, { owner, repo, filePath }) {
        return withGithub(ctx, async credentials => ({ ok: true, ...(await GithubAPI.getFileContent(credentials, owner, repo, filePath)) }));
      },
      async getTree(ctx, { owner, repo, branch }) {
        return withGithub(ctx, async credentials => {
          const tree = await GithubAPI.getRepoTree(credentials, owner, repo, branch);
          return { ok: true, tree: tree?.tree ?? [] };
        });
      },
      async getIssues(ctx, { owner, repo, state = 'open' }) {
        return withGithub(ctx, async credentials => ({ ok: true, issues: await GithubAPI.getIssues(credentials, owner, repo, state) }));
      },
      async getPRs(ctx, { owner, repo, state = 'open' }) {
        return withGithub(ctx, async credentials => ({ ok: true, prs: await GithubAPI.getPullRequests(credentials, owner, repo, state) }));
      },
      async getNotifications(ctx) {
        return withGithub(ctx, async credentials => ({ ok: true, notifications: await GithubAPI.getNotifications(credentials) }));
      },
      async getCommits(ctx, { owner, repo, perPage = 20 }) {
        return withGithub(ctx, async credentials => ({ ok: true, commits: await GithubAPI.getCommits(credentials, owner, repo, perPage) }));
      },
      async searchCode(ctx, { owner, repo, query }) {
        return withGithub(ctx, async credentials => ({ ok: true, ...(await GithubAPI.searchCode(credentials, query, owner && repo ? `${owner}/${repo}` : '')) }));
      },
      async getPRDiff(ctx, { owner, repo, prNumber }) {
        return withGithub(ctx, async credentials => ({ ok: true, diff: await GithubAPI.getPRDiff(credentials, owner, repo, prNumber) }));
      },
      async getPRDetails(ctx, { owner, repo, prNumber }) {
        return withGithub(ctx, async credentials => ({ ok: true, pr: await GithubAPI.getPRDetails(credentials, owner, repo, prNumber) }));
      },
      async createPRReview(ctx, { owner, repo, prNumber, review = {} }) {
        return withGithub(ctx, async credentials => ({ ok: true, ...(await GithubAPI.createPRReview(credentials, owner, repo, prNumber, review)) }));
      },
      async getPRChecks(ctx, { owner, repo, prNumber }) {
        return withGithub(ctx, async credentials => ({ ok: true, checks: await GithubAPI.getPRChecks(credentials, owner, repo, prNumber) }));
      },
      async getWorkflowRuns(ctx, { owner, repo, branch = '', event = '', perPage = 20 }) {
        return withGithub(ctx, async credentials => {
          const runs = await GithubAPI.getWorkflowRuns(credentials, owner, repo, { branch, event, perPage });
          return { ok: true, runs: runs.workflow_runs ?? [], total_count: runs.total_count ?? 0 };
        });
      },
      async getPRComments(ctx, { owner, repo, prNumber }) {
        return withGithub(ctx, async credentials => ({ ok: true, comments: await GithubAPI.getPRComments(credentials, owner, repo, prNumber) }));
      },
      async getRepoStats(ctx, { owner, repo }) {
        return withGithub(ctx, async credentials => ({ ok: true, stats: await GithubAPI.getRepoStats(credentials, owner, repo) }));
      },
      async starRepo(ctx, { owner, repo }) {
        return withGithub(ctx, async credentials => { await GithubAPI.starRepo(credentials, owner, repo); return { ok: true }; });
      },
      async unstarRepo(ctx, { owner, repo }) {
        return withGithub(ctx, async credentials => { await GithubAPI.unstarRepo(credentials, owner, repo); return { ok: true }; });
      },
      async getReleases(ctx, { owner, repo, perPage = 10 }) {
        return withGithub(ctx, async credentials => ({ ok: true, releases: await GithubAPI.getReleases(credentials, owner, repo, perPage) }));
      },
      async getLatestRelease(ctx, { owner, repo }) {
        return withGithub(ctx, async credentials => ({ ok: true, release: await GithubAPI.getLatestRelease(credentials, owner, repo) }));
      },
      async createPR(ctx, { owner, repo, options = {} }) {
        return withGithub(ctx, async credentials => ({ ok: true, pr: await GithubAPI.createPR(credentials, owner, repo, options) }));
      },
      async mergePR(ctx, { owner, repo, prNumber, mergeMethod = 'merge', commitTitle = '' }) {
        return withGithub(ctx, async credentials => ({ ok: true, ...(await GithubAPI.mergePR(credentials, owner, repo, prNumber, mergeMethod, commitTitle)) }));
      },
      async closePR(ctx, { owner, repo, prNumber }) {
        return withGithub(ctx, async credentials => ({ ok: true, pr: await GithubAPI.closePR(credentials, owner, repo, prNumber) }));
      },
      async createIssue(ctx, { owner, repo, title, body = '', labels = [] }) {
        return withGithub(ctx, async credentials => ({ ok: true, issue: await GithubAPI.createIssue(credentials, owner, repo, title, body, labels) }));
      },
      async closeIssue(ctx, { owner, repo, issueNumber, reason = 'completed' }) {
        return withGithub(ctx, async credentials => ({ ok: true, issue: await GithubAPI.closeIssue(credentials, owner, repo, issueNumber, reason) }));
      },
      async reopenIssue(ctx, { owner, repo, issueNumber }) {
        return withGithub(ctx, async credentials => ({ ok: true, issue: await GithubAPI.reopenIssue(credentials, owner, repo, issueNumber) }));
      },
      async commentIssue(ctx, { owner, repo, issueNumber, body }) {
        return withGithub(ctx, async credentials => ({ ok: true, comment: await GithubAPI.addIssueComment(credentials, owner, repo, issueNumber, body) }));
      },
      async addLabels(ctx, { owner, repo, issueNumber, labels = [] }) {
        return withGithub(ctx, async credentials => ({ ok: true, labels: await GithubAPI.addLabels(credentials, owner, repo, issueNumber, labels) }));
      },
      async addAssignees(ctx, { owner, repo, issueNumber, assignees = [] }) {
        return withGithub(ctx, async credentials => ({ ok: true, result: await GithubAPI.addAssignees(credentials, owner, repo, issueNumber, assignees) }));
      },
      async markNotificationsRead(ctx) {
        return withGithub(ctx, async credentials => { await GithubAPI.markAllNotificationsRead(credentials); return { ok: true }; });
      },
      async triggerWorkflow(ctx, { owner, repo, workflowId, ref = 'main', inputs = {} }) {
        return withGithub(ctx, async credentials => { await GithubAPI.triggerWorkflow(credentials, owner, repo, workflowId, ref, inputs); return { ok: true }; });
      },
      async getLatestWorkflowRun(ctx, { owner, repo, workflowId, branch = '' }) {
        return withGithub(ctx, async credentials => ({ ok: true, run: await GithubAPI.getLatestWorkflowRun(credentials, owner, repo, workflowId, branch) }));
      },
      async createGist(ctx, { description, files, isPublic = false }) {
        return withGithub(ctx, async credentials => ({ ok: true, gist: await GithubAPI.createGist(credentials, description, files, isPublic) }));
      },
      async getBranches(ctx, { owner, repo }) {
        return withGithub(ctx, async credentials => ({ ok: true, branches: await GithubAPI.getBranches(credentials, owner, repo) }));
      },
      async executeChatTool(ctx, { toolName, params }) {
        return executeGithubChatTool(ctx, toolName, params);
      },
    },
  },
  renderer: {
    chatTools: GITHUB_TOOLS,
  },
  automation: {
    actions: GITHUB_ACTIONS,
    fieldMeta: GITHUB_FIELD_META,
    fieldLabels: GITHUB_FIELD_LABELS,
    handlers: githubAutomationHandlers,
  },
  agents: {
    dataSources: GITHUB_DATA_SOURCES,
    outputTypes: GITHUB_OUTPUT_TYPES,
    instructionTemplates: GITHUB_INSTRUCTION_TEMPLATES,
    dataSourceCollectors: githubDataSourceCollectors,
    outputHandlers: githubOutputHandlers,
  },
  prompt: {
    async getContext(ctx) {
      const credentials = getGithubCredentials(ctx);
      if (!credentials) return null;

      let user = null;
      let repos = [];

      try {
        user = await GithubAPI.getUser(credentials);
        repos = await GithubAPI.getRepos(credentials, 20);
        if (user?.login) {
          ctx.connectorEngine?.updateCredentials('github', { username: user.login, avatar: user.avatar_url });
        }
      } catch (error) {
        console.warn('[GithubFeature] Prompt context fetch failed:', error.message);
      }

      const username = user?.login ?? ctx.connectorEngine?.getCredentials('github')?.username ?? null;
      if (!username) return null;

      return {
        connectedServices: [`GitHub (@${username})`],
        sections: repos.length ? [{
          title: `GitHub Repositories (@${username})`,
          body: [
            'The user has these repos (most recently updated first):',
            ...repos.slice(0, 20).map(repo => {
              const description = repo.description ? ` - ${repo.description}` : '';
              const language = repo.language ? ` [${repo.language}]` : '';
              return `- \`${repo.full_name}\`${description}${language}`;
            }),
            'When the user asks about "my repo" or references a project by name, match it against the list above.',
          ].join('\n'),
        }] : [],
      };
    },
  },
});
