import defineFeature from '../../Core/DefineFeature.js';
import { GitlabAPI, getGitlabCredentials, notConnected } from './Shared/Common.js';
import { GITLAB_TOOLS } from './Chat/Tools.js';
import { executeGitlabChatTool } from './Chat/ChatExecutor.js';
import { gitlabAutomationHandlers } from './Automation/AutomationHandlers.js';
import { gitlabDataSourceCollectors, gitlabOutputHandlers } from './Agents/AgentHandlers.js';

function withGitlab(ctx, callback) {
  const credentials = getGitlabCredentials(ctx);
  if (!credentials) return notConnected();
  return callback(credentials).catch((error) => ({ ok: false, error: error.message }));
}

const GITLAB_ACTIONS = [
  {
    type: 'gitlab_open_repo',
    label: 'Open repo in browser',
    group: 'GitLab',
    fields: ['owner', 'repo'],
    requiredFields: ['owner', 'repo'],
  },
  {
    type: 'gitlab_check_prs',
    label: 'Check merge requests',
    group: 'GitLab',
    fields: ['owner', 'repo', 'state'],
    requiredFields: ['owner', 'repo'],
  },
  {
    type: 'gitlab_check_issues',
    label: 'Check issues',
    group: 'GitLab',
    fields: ['owner', 'repo', 'state'],
    requiredFields: ['owner', 'repo'],
  },
  {
    type: 'gitlab_check_commits',
    label: 'Check recent commits',
    group: 'GitLab',
    fields: ['owner', 'repo', 'maxResults'],
    requiredFields: ['owner', 'repo'],
  },
  {
    type: 'gitlab_check_releases',
    label: 'Check latest release',
    group: 'GitLab',
    fields: ['owner', 'repo'],
    requiredFields: ['owner', 'repo'],
  },
  { type: 'gitlab_check_notifs', label: 'GitLab notifications', group: 'GitLab', fields: [] },
  {
    type: 'gitlab_create_issue',
    label: 'Create issue',
    group: 'GitLab',
    fields: ['owner', 'repo', 'issueTitle', 'issueBody', 'labels'],
    requiredFields: ['owner', 'repo', 'issueTitle'],
  },
  {
    type: 'gitlab_repo_stats',
    label: 'Repo stats notification',
    group: 'GitLab',
    fields: ['owner', 'repo'],
    requiredFields: ['owner', 'repo'],
  },
  {
    type: 'gitlab_star_repo',
    label: 'Star repository',
    group: 'GitLab',
    fields: ['owner', 'repo'],
    requiredFields: ['owner', 'repo'],
  },
  {
    type: 'gitlab_create_pr',
    label: 'Create merge request',
    group: 'GitLab',
    fields: ['owner', 'repo', 'prTitle', 'prHead', 'prBase', 'issueBody', 'draft'],
    requiredFields: ['owner', 'repo', 'prTitle', 'prHead', 'prBase'],
  },
  {
    type: 'gitlab_merge_pr',
    label: 'Merge merge request',
    group: 'GitLab',
    fields: ['owner', 'repo', 'prNumber', 'mergeMethod'],
    requiredFields: ['owner', 'repo', 'prNumber'],
  },
  {
    type: 'gitlab_close_issue',
    label: 'Close issue',
    group: 'GitLab',
    fields: ['owner', 'repo', 'issueNumber', 'closeReason'],
    requiredFields: ['owner', 'repo', 'issueNumber'],
  },
  {
    type: 'gitlab_comment_issue',
    label: 'Comment on issue or MR',
    group: 'GitLab',
    fields: ['owner', 'repo', 'issueNumber', 'issueBody'],
    requiredFields: ['owner', 'repo', 'issueNumber', 'issueBody'],
  },
  {
    type: 'gitlab_add_labels',
    label: 'Add labels to issue or MR',
    group: 'GitLab',
    fields: ['owner', 'repo', 'issueNumber', 'labels'],
    requiredFields: ['owner', 'repo', 'issueNumber', 'labels'],
  },
  {
    type: 'gitlab_assign',
    label: 'Assign issue or MR',
    group: 'GitLab',
    fields: ['owner', 'repo', 'issueNumber', 'assignees'],
    requiredFields: ['owner', 'repo', 'issueNumber', 'assignees'],
  },
  {
    type: 'gitlab_mark_notifs_read',
    label: 'Mark notifications as read',
    group: 'GitLab',
    fields: [],
  },
  {
    type: 'gitlab_trigger_workflow',
    label: 'Trigger pipeline',
    group: 'GitLab',
    fields: ['owner', 'repo', 'workflowId', 'workflowRef', 'workflowInputs'],
    requiredFields: ['owner', 'repo', 'workflowId'],
  },
  {
    type: 'gitlab_workflow_status',
    label: 'Pipeline run status',
    group: 'GitLab',
    fields: ['owner', 'repo', 'workflowId', 'branch'],
    requiredFields: ['owner', 'repo', 'workflowId'],
  },
  {
    type: 'gitlab_create_gist',
    label: 'Create snippet',
    group: 'GitLab',
    fields: ['gistFilename', 'content', 'description', 'isPublic', 'openInBrowser'],
    requiredFields: ['gistFilename', 'content'],
  },
];

const GITLAB_FIELD_META = {
  owner: { placeholder: 'gitlab-username or group', textarea: false },
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
  closeReason: { type: 'select', options: ['completed', 'not_planned'], textarea: false },
  workflowId: { placeholder: 'pipeline numeric ID', textarea: false },
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

const GITLAB_FIELD_LABELS = {
  owner: 'Owner / org',
  repo: 'Repository',
  state: 'State',
  maxResults: 'Max results',
  issueTitle: 'Issue title',
  issueBody: 'Body',
  issueNumber: 'Issue / MR number',
  labels: 'Labels (comma-separated)',
  assignees: 'Assignees (comma-separated)',
  prTitle: 'MR title',
  prHead: 'Head branch',
  prBase: 'Base branch',
  prNumber: 'MR number',
  mergeMethod: 'Merge method',
  closeReason: 'Close reason',
  workflowId: 'Pipeline ID',
  workflowRef: 'Ref (branch/tag)',
  workflowInputs: 'Pipeline variables JSON',
  branch: 'Branch',
  gistFilename: 'Filename',
  content: 'Content',
  description: 'Description',
  draft: 'Open as draft',
  isPublic: 'Make public',
  openInBrowser: 'Open in browser',
  event: 'Review event',
};

const GITLAB_DATA_SOURCES = [
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
        required: true,
        placeholder: 'gitlab-username or org',
      },
      {
        key: 'repo',
        label: 'Repository',
        type: 'text',
        required: true,
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
        required: true,
        placeholder: 'gitlab-username or org',
      },
      {
        key: 'repo',
        label: 'Repository',
        type: 'text',
        required: true,
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
        required: true,
        placeholder: 'gitlab-username or org',
      },
      {
        key: 'repo',
        label: 'Repository',
        type: 'text',
        required: true,
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
        required: true,
        placeholder: 'gitlab-username or org',
      },
      {
        key: 'repo',
        label: 'Repository',
        type: 'text',
        required: true,
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
        required: true,
        placeholder: 'gitlab-username or org',
      },
      {
        key: 'repo',
        label: 'Repository',
        type: 'text',
        required: true,
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
        required: true,
        placeholder: 'gitlab-username or org',
      },
      {
        key: 'repo',
        label: 'Repository',
        type: 'text',
        required: true,
        placeholder: 'repository-name',
      },
    ],
  },
];

const GITLAB_OUTPUT_TYPES = [
  {
    value: 'gitlab_mr_review',
    label: 'Post GitLab MR review',
    group: 'GitLab',
    params: [
      {
        key: 'owner',
        label: 'Owner / org',
        type: 'text',
        required: true,
        placeholder: 'gitlab-username or org',
      },
      {
        key: 'repo',
        label: 'Repository',
        type: 'text',
        required: true,
        placeholder: 'repository-name',
      },
      {
        key: 'prNumber',
        label: 'MR number',
        type: 'number',
        required: true,
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
];

const GITLAB_INSTRUCTION_TEMPLATES = {
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
  gitlab_repo_stats: 'Analyze this repository data and highlight any important trends or changes.',
};

export default defineFeature({
  id: 'gitlab',
  name: 'GitLab',
  connectors: {
    services: [
      {
        id: 'gitlab',
        name: 'GitLab',
        icon: '<img src="../../../Assets/Icons/Gitlab.png" alt="GitLab" style="width: 26px; height: 26px; object-fit: contain;" />',
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
        defaultState: { enabled: false, credentials: {} },
        async validate(ctx) {
          const credentials = ctx.connectorEngine?.getCredentials('gitlab');
          if (!credentials?.token) return { ok: false, error: 'No credentials stored' };
          const user = await GitlabAPI.getUser(credentials);
          ctx.connectorEngine?.updateCredentials('gitlab', {
            username: user.login,
            avatar: user.avatar_url,
          });
          return { ok: true, username: user.login, avatar: user.avatar_url };
        },
      },
    ],
  },
  main: {
    methods: {
      async getRepos(ctx) {
        return withGitlab(ctx, async (credentials) => ({
          ok: true,
          repos: await GitlabAPI.getRepos(credentials),
        }));
      },
      async getFile(ctx, { owner, repo, filePath }) {
        return withGitlab(ctx, async (credentials) => ({
          ok: true,
          ...(await GitlabAPI.getFileContent(credentials, owner, repo, filePath)),
        }));
      },
      async getTree(ctx, { owner, repo, branch }) {
        return withGitlab(ctx, async (credentials) => {
          const tree = await GitlabAPI.getRepoTree(credentials, owner, repo, branch);
          return { ok: true, tree: tree?.tree ?? [] };
        });
      },
      async getIssues(ctx, { owner, repo, state = 'open' }) {
        return withGitlab(ctx, async (credentials) => ({
          ok: true,
          issues: await GitlabAPI.getIssues(credentials, owner, repo, state),
        }));
      },
      async getPRs(ctx, { owner, repo, state = 'open' }) {
        return withGitlab(ctx, async (credentials) => ({
          ok: true,
          prs: await GitlabAPI.getPullRequests(credentials, owner, repo, state),
        }));
      },
      async getNotifications(ctx) {
        return withGitlab(ctx, async (credentials) => ({
          ok: true,
          notifications: await GitlabAPI.getNotifications(credentials),
        }));
      },
      async getCommits(ctx, { owner, repo, perPage = 20 }) {
        return withGitlab(ctx, async (credentials) => ({
          ok: true,
          commits: await GitlabAPI.getCommits(credentials, owner, repo, perPage),
        }));
      },
      async searchCode(ctx, { owner, repo, query }) {
        return withGitlab(ctx, async (credentials) => ({
          ok: true,
          ...(await GitlabAPI.searchCode(
            credentials,
            query,
            owner && repo ? `${owner}/${repo}` : '',
          )),
        }));
      },
      async getPRDiff(ctx, { owner, repo, prNumber }) {
        return withGitlab(ctx, async (credentials) => ({
          ok: true,
          diff: await GitlabAPI.getPRDiff(credentials, owner, repo, prNumber),
        }));
      },
      async getPRDetails(ctx, { owner, repo, prNumber }) {
        return withGitlab(ctx, async (credentials) => ({
          ok: true,
          pr: await GitlabAPI.getPRDetails(credentials, owner, repo, prNumber),
        }));
      },
      async createPRReview(ctx, { owner, repo, prNumber, review = {} }) {
        return withGitlab(ctx, async (credentials) => ({
          ok: true,
          ...(await GitlabAPI.createPRReview(credentials, owner, repo, prNumber, review)),
        }));
      },
      async getPRChecks(ctx, { owner, repo, prNumber }) {
        return withGitlab(ctx, async (credentials) => ({
          ok: true,
          checks: await GitlabAPI.getPRChecks(credentials, owner, repo, prNumber),
        }));
      },
      async getWorkflowRuns(ctx, { owner, repo, branch = '', event = '', perPage = 20 }) {
        return withGitlab(ctx, async (credentials) => {
          const runs = await GitlabAPI.getWorkflowRuns(credentials, owner, repo, {
            branch,
            event,
            perPage,
          });
          return { ok: true, runs: runs.workflow_runs ?? [], total_count: runs.total_count ?? 0 };
        });
      },
      async getPRComments(ctx, { owner, repo, prNumber }) {
        return withGitlab(ctx, async (credentials) => ({
          ok: true,
          comments: await GitlabAPI.getPRComments(credentials, owner, repo, prNumber),
        }));
      },
      async getRepoStats(ctx, { owner, repo }) {
        return withGitlab(ctx, async (credentials) => ({
          ok: true,
          stats: await GitlabAPI.getRepoStats(credentials, owner, repo),
        }));
      },
      async starRepo(ctx, { owner, repo }) {
        return withGitlab(ctx, async (credentials) => {
          await GitlabAPI.starRepo(credentials, owner, repo);
          return { ok: true };
        });
      },
      async unstarRepo(ctx, { owner, repo }) {
        return withGitlab(ctx, async (credentials) => {
          await GitlabAPI.unstarRepo(credentials, owner, repo);
          return { ok: true };
        });
      },
      async getReleases(ctx, { owner, repo, perPage = 10 }) {
        return withGitlab(ctx, async (credentials) => ({
          ok: true,
          releases: await GitlabAPI.getReleases(credentials, owner, repo, perPage),
        }));
      },
      async getLatestRelease(ctx, { owner, repo }) {
        return withGitlab(ctx, async (credentials) => ({
          ok: true,
          release: await GitlabAPI.getLatestRelease(credentials, owner, repo),
        }));
      },
      async createPR(ctx, { owner, repo, options = {} }) {
        return withGitlab(ctx, async (credentials) => ({
          ok: true,
          pr: await GitlabAPI.createPR(credentials, owner, repo, options),
        }));
      },
      async mergePR(ctx, { owner, repo, prNumber, mergeMethod = 'merge', commitTitle = '' }) {
        return withGitlab(ctx, async (credentials) => ({
          ok: true,
          ...(await GitlabAPI.mergePR(
            credentials,
            owner,
            repo,
            prNumber,
            mergeMethod,
            commitTitle,
          )),
        }));
      },
      async closePR(ctx, { owner, repo, prNumber }) {
        return withGitlab(ctx, async (credentials) => ({
          ok: true,
          pr: await GitlabAPI.closePR(credentials, owner, repo, prNumber),
        }));
      },
      async createIssue(ctx, { owner, repo, title, body = '', labels = [] }) {
        return withGitlab(ctx, async (credentials) => ({
          ok: true,
          issue: await GitlabAPI.createIssue(credentials, owner, repo, title, body, labels),
        }));
      },
      async closeIssue(ctx, { owner, repo, issueNumber, reason = 'completed' }) {
        return withGitlab(ctx, async (credentials) => ({
          ok: true,
          issue: await GitlabAPI.closeIssue(credentials, owner, repo, issueNumber, reason),
        }));
      },
      async reopenIssue(ctx, { owner, repo, issueNumber }) {
        return withGitlab(ctx, async (credentials) => ({
          ok: true,
          issue: await GitlabAPI.reopenIssue(credentials, owner, repo, issueNumber),
        }));
      },
      async commentIssue(ctx, { owner, repo, issueNumber, body }) {
        return withGitlab(ctx, async (credentials) => ({
          ok: true,
          comment: await GitlabAPI.addIssueComment(credentials, owner, repo, issueNumber, body),
        }));
      },
      async addLabels(ctx, { owner, repo, issueNumber, labels = [] }) {
        return withGitlab(ctx, async (credentials) => ({
          ok: true,
          labels: await GitlabAPI.addLabels(credentials, owner, repo, issueNumber, labels),
        }));
      },
      async addAssignees(ctx, { owner, repo, issueNumber, assignees = [] }) {
        return withGitlab(ctx, async (credentials) => ({
          ok: true,
          result: await GitlabAPI.addAssignees(credentials, owner, repo, issueNumber, assignees),
        }));
      },
      async markNotificationsRead(ctx) {
        return withGitlab(ctx, async (credentials) => {
          await GitlabAPI.markAllNotificationsRead(credentials);
          return { ok: true };
        });
      },
      async triggerWorkflow(ctx, { owner, repo, workflowId, ref = 'main', inputs = {} }) {
        return withGitlab(ctx, async (credentials) => {
          await GitlabAPI.triggerWorkflow(credentials, owner, repo, workflowId, ref, inputs);
          return { ok: true };
        });
      },
      async getLatestWorkflowRun(ctx, { owner, repo, workflowId, branch = '' }) {
        return withGitlab(ctx, async (credentials) => ({
          ok: true,
          run: await GitlabAPI.getLatestWorkflowRun(credentials, owner, repo, workflowId, branch),
        }));
      },
      async createGist(ctx, { description, files, isPublic = false }) {
        return withGitlab(ctx, async (credentials) => ({
          ok: true,
          gist: await GitlabAPI.createGist(credentials, description, files, isPublic),
        }));
      },
      async getBranches(ctx, { owner, repo }) {
        return withGitlab(ctx, async (credentials) => ({
          ok: true,
          branches: await GitlabAPI.getBranches(credentials, owner, repo),
        }));
      },
      async executeChatTool(ctx, { toolName, params }) {
        return executeGitlabChatTool(ctx, toolName, params);
      },
    },
  },
  renderer: {
    chatTools: GITLAB_TOOLS,
  },
  automation: {
    actions: GITLAB_ACTIONS,
    fieldMeta: GITLAB_FIELD_META,
    fieldLabels: GITLAB_FIELD_LABELS,
    handlers: gitlabAutomationHandlers,
  },
  agents: {
    dataSources: GITLAB_DATA_SOURCES,
    outputTypes: GITLAB_OUTPUT_TYPES,
    instructionTemplates: GITLAB_INSTRUCTION_TEMPLATES,
    dataSourceCollectors: gitlabDataSourceCollectors,
    outputHandlers: gitlabOutputHandlers,
  },
  prompt: {
    async getContext(ctx) {
      const credentials = getGitlabCredentials(ctx);
      if (!credentials) return null;

      let user = null;
      let repos = [];

      try {
        user = await GitlabAPI.getUser(credentials);
        repos = await GitlabAPI.getRepos(credentials, 20);
        if (user?.login) {
          ctx.connectorEngine?.updateCredentials('gitlab', {
            username: user.login,
            avatar: user.avatar_url,
          });
        }
      } catch (error) {
        console.warn('[GitlabFeature] Prompt context fetch failed:', error.message);
      }

      const username =
        user?.login ?? ctx.connectorEngine?.getCredentials('gitlab')?.username ?? null;
      if (!username) return null;

      return {
        connectedServices: [`GitLab (@${username})`],
        sections: repos.length
          ? [
              {
                title: `GitLab Repositories (@${username})`,
                body: [
                  'The user has these repos (most recently updated first):',
                  ...repos.slice(0, 20).map((repo) => {
                    const description = repo.description ? ` - ${repo.description}` : '';
                    const language = repo.language ? ` [${repo.language}]` : '';
                    return `- \`${repo.full_name}\`${description}${language}`;
                  }),
                  'When the user asks about "my repo" or references a project by name, match it against the list above.',
                ].join('\n'),
              },
            ]
          : [],
      };
    },
  },
});
