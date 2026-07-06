import {
  bodyJson,
  buildUrl,
  clampInteger,
  formatDate,
  formatList,
  parseCommaList,
  readConnectorDetails,
  readJsonResponse,
  requireText,
  truncateText as truncateConnectorText,
} from '../../../Core/ConnectorHttp.js';

const GITHUB_API = 'https://api.github.com';
const MAX_TEXT_PREVIEW = 6000;

function truncateText(value = '', limit = MAX_TEXT_PREVIEW) {
  return truncateConnectorText(value, limit);
}

async function readGitHubToken(rootDirectory) {
  const details = await readConnectorDetails(rootDirectory, 'github');
  return String(details.token ?? '').trim();
}

async function githubRequest(
  rootDirectory,
  pathname,
  {
    method = 'GET',
    searchParams = {},
    body,
    accept = 'application/vnd.github+json',
    requireAuth = false,
    raw = false,
  } = {},
) {
  const token = await readGitHubToken(rootDirectory);
  if (requireAuth && !token) {
    throw new Error('GitHub token is not configured in Settings > Connectors.');
  }

  const url = buildUrl(GITHUB_API, pathname, searchParams);

  const response = await fetch(url, {
    method,
    headers: {
      accept,
      'content-type': 'application/json',
      'user-agent': 'Joanium',
      'x-github-api-version': '2022-11-28',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...bodyJson(body),
  });

  if (raw) {
    if (!response.ok) await readJsonResponse(response);
    return response.text();
  }

  return response.status === 204 ? null : readJsonResponse(response);
}

async function getRepository(rootDirectory, owner, repo) {
  return githubRequest(rootDirectory, `/repos/${owner}/${repo}`);
}

function formatRepository(repository) {
  return [
    `Repository: ${repository.full_name}`,
    `Description: ${repository.description || '(none)'}`,
    `Visibility: ${repository.private ? 'private' : 'public'}`,
    `Default branch: ${repository.default_branch || '(unknown)'}`,
    `Language: ${repository.language || '(unknown)'}`,
    `Stars: ${Number(repository.stargazers_count ?? 0).toLocaleString('en-US')}`,
    `Forks: ${Number(repository.forks_count ?? 0).toLocaleString('en-US')}`,
    `Open issues: ${Number(repository.open_issues_count ?? 0).toLocaleString('en-US')}`,
    `Updated: ${formatDate(repository.updated_at)}`,
    `URL: ${repository.html_url}`,
  ].join('\n');
}

function formatGitHubUser(user) {
  return [
    `GitHub user: ${user.login}`,
    `Name: ${user.name || '(none)'}`,
    `Company: ${user.company || '(none)'}`,
    `Location: ${user.location || '(none)'}`,
    `Public repos: ${Number(user.public_repos ?? 0).toLocaleString('en-US')}`,
    `Followers: ${Number(user.followers ?? 0).toLocaleString('en-US')}`,
    `Following: ${Number(user.following ?? 0).toLocaleString('en-US')}`,
    `Created: ${formatDate(user.created_at)}`,
    `URL: ${user.html_url}`,
  ].join('\n');
}

function formatIssue(issue) {
  return [
    `#${issue.number} ${issue.title}`,
    `State: ${issue.state}${issue.pull_request ? ' (pull request)' : ''}`,
    `Author: ${issue.user?.login || '(unknown)'}`,
    `Comments: ${issue.comments ?? 0}`,
    `Updated: ${formatDate(issue.updated_at)}`,
    `URL: ${issue.html_url}`,
  ].join('\n');
}

function formatPullRequest(pr) {
  return [
    `#${pr.number} ${pr.title}`,
    `State: ${pr.state}${pr.draft ? ' (draft)' : ''}`,
    `Author: ${pr.user?.login || '(unknown)'}`,
    `Branch: ${pr.head?.ref || '(unknown)'} -> ${pr.base?.ref || '(unknown)'}`,
    `Updated: ${formatDate(pr.updated_at)}`,
    `URL: ${pr.html_url}`,
  ].join('\n');
}

function formatCommit(commit, index) {
  const sha = commit.sha?.slice(0, 7) || 'unknown';
  const message = String(commit.commit?.message || '')
    .split('\n')[0]
    .slice(0, 120);
  const author = commit.commit?.author?.name || commit.author?.login || 'unknown';
  const date = formatDate(commit.commit?.author?.date);
  return `${index + 1}. ${sha} ${message}\n   by ${author}${date ? ` on ${date}` : ''}`;
}

function formatRelease(release, index) {
  const tag = release.tag_name || 'untagged';
  const name = release.name || tag;
  const notes = String(release.body || '')
    .split('\n')[0]
    .slice(0, 140);
  return [
    `${index + 1}. ${name} (${tag})${release.prerelease ? ' [pre-release]' : ''}`,
    `   Published: ${formatDate(release.published_at)}`,
    notes ? `   ${notes}` : '',
    `   ${release.html_url}`,
  ]
    .filter(Boolean)
    .join('\n');
}

async function getFileContent(rootDirectory, params) {
  const owner = requireText(params.owner, 'owner');
  const repo = requireText(params.repo, 'repo');
  const filePath = requireText(params.filePath ?? params.path, 'filePath');
  const data = await githubRequest(rootDirectory, `/repos/${owner}/${repo}/contents/${filePath}`, {
    searchParams: { ref: params.ref },
  });

  if (Array.isArray(data)) throw new Error(`${filePath} is a directory, not a file.`);
  const content =
    data.encoding === 'base64'
      ? Buffer.from(String(data.content ?? '').replace(/\n/g, ''), 'base64').toString('utf8')
      : String(data.content ?? '');

  return [
    `Contents of ${data.path} from ${owner}/${repo}:`,
    '',
    '```',
    truncateText(content),
    '```',
    '',
    `URL: ${data.html_url}`,
  ].join('\n');
}

async function getFileTree(rootDirectory, params) {
  const owner = requireText(params.owner, 'owner');
  const repo = requireText(params.repo, 'repo');
  const limit = clampInteger(params.limit, 100, 1, 300);
  const repository = params.ref ? null : await getRepository(rootDirectory, owner, repo);
  const ref = String(params.ref ?? repository?.default_branch ?? 'main').trim();
  const tree = await githubRequest(
    rootDirectory,
    `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}`,
    {
      searchParams: { recursive: '1' },
    },
  );
  const files = (tree.tree ?? []).filter((item) => item.type === 'blob').map((item) => item.path);
  return [
    `File tree for ${owner}/${repo} at ${ref}`,
    `Files: ${files.length}${tree.truncated ? ' (truncated by GitHub)' : ''}`,
    '',
    ...files.slice(0, limit),
  ].join('\n');
}

async function getPullRequestChecks(rootDirectory, params) {
  const owner = requireText(params.owner, 'owner');
  const repo = requireText(params.repo, 'repo');
  const prNumber = requireText(params.pr_number ?? params.prNumber, 'pr_number');
  const pr = await githubRequest(rootDirectory, `/repos/${owner}/${repo}/pulls/${prNumber}`);
  const sha = pr.head?.sha;
  if (!sha) throw new Error(`Pull request #${prNumber} has no head SHA.`);

  const [status, checks] = await Promise.all([
    githubRequest(rootDirectory, `/repos/${owner}/${repo}/commits/${sha}/status`).catch(() => null),
    githubRequest(rootDirectory, `/repos/${owner}/${repo}/commits/${sha}/check-runs`, {
      searchParams: { per_page: 30 },
    }).catch(() => null),
  ]);
  const checkRuns = checks?.check_runs ?? [];

  return [
    `Checks for ${owner}/${repo}#${prNumber}`,
    `Head SHA: ${sha.slice(0, 7)}`,
    `Combined status: ${status?.state ?? 'unknown'}`,
    '',
    ...checkRuns.map((check) =>
      [
        `${check.name}: ${check.status}${check.conclusion ? ` / ${check.conclusion}` : ''}`,
        `URL: ${check.html_url}`,
      ].join('\n'),
    ),
    checkRuns.length ? '' : 'No check runs found.',
  ]
    .join('\n')
    .trim();
}

function getSafeState(value) {
  const state = String(value ?? 'open').toLowerCase();
  return ['open', 'closed', 'all'].includes(state) ? state : 'open';
}

function readRepositoryParams(params) {
  return {
    owner: requireText(params.owner, 'owner'),
    repo: requireText(params.repo, 'repo'),
  };
}

function readPullRequestParams(params) {
  return {
    ...readRepositoryParams(params),
    prNumber: requireText(params.pr_number ?? params.prNumber, 'pr_number'),
  };
}

function readIssueParams(params) {
  return {
    ...readRepositoryParams(params),
    issueNumber: requireText(params.issue_number ?? params.issueNumber, 'issue_number'),
  };
}

async function listRepositoryIssues(rootDirectory, params) {
  const { owner, repo } = readRepositoryParams(params);
  const limit = clampInteger(params.limit ?? params.per_page, 10, 1, 30);
  const issues = await githubRequest(rootDirectory, `/repos/${owner}/${repo}/issues`, {
    searchParams: { state: getSafeState(params.state), per_page: limit },
  });
  return { owner: owner, repo: repo, issues: issues };
}

export function createGitHubToolHandlers({ rootDirectory }) {
  return {
    async github_get_repository(params = {}) {
      const owner = requireText(params.owner, 'owner');
      const repo = requireText(params.repo, 'repo');
      return formatRepository(await getRepository(rootDirectory, owner, repo));
    },

    async github_get_user(params = {}) {
      const username = requireText(params.username ?? params.user, 'username');
      return formatGitHubUser(await githubRequest(rootDirectory, `/users/${username}`));
    },

    async github_list_repos(params = {}) {
      const limit = clampInteger(params.limit, 20, 1, 50);
      const repos = await githubRequest(rootDirectory, '/user/repos', {
        requireAuth: true,
        searchParams: {
          sort: 'updated',
          affiliation: 'owner,collaborator,organization_member',
          per_page: limit,
        },
      });
      return formatList(
        `GitHub repositories visible to the configured token (${repos.length})`,
        repos.map(
          (repo, index) =>
            `${index + 1}. ${repo.full_name} - ${repo.description || 'No description'}\n   ${repo.html_url}`,
        ),
      );
    },

    async github_list_issues(params = {}) {
      const { owner, repo, issues } = await listRepositoryIssues(rootDirectory, params);
      return formatList(`Issues and pull requests for ${owner}/${repo}`, issues.map(formatIssue));
    },

    async github_get_issues(params = {}) {
      const { owner, repo, issues } = await listRepositoryIssues(rootDirectory, params);
      return formatList(
        `Issues for ${owner}/${repo}`,
        issues.filter((issue) => !issue.pull_request).map(formatIssue),
      );
    },

    async github_get_pull_requests(params = {}) {
      const owner = requireText(params.owner, 'owner');
      const repo = requireText(params.repo, 'repo');
      const limit = clampInteger(params.limit ?? params.per_page, 10, 1, 30);
      const pullRequests = await githubRequest(rootDirectory, `/repos/${owner}/${repo}/pulls`, {
        searchParams: { state: getSafeState(params.state), per_page: limit },
      });
      return formatList(`Pull requests for ${owner}/${repo}`, pullRequests.map(formatPullRequest));
    },

    github_get_file(params = {}) {
      return getFileContent(rootDirectory, params);
    },

    github_get_file_tree(params = {}) {
      return getFileTree(rootDirectory, params);
    },

    async github_get_commits(params = {}) {
      const owner = requireText(params.owner, 'owner');
      const repo = requireText(params.repo, 'repo');
      const limit = clampInteger(params.limit ?? params.per_page, 10, 1, 30);
      const commits = await githubRequest(rootDirectory, `/repos/${owner}/${repo}/commits`, {
        searchParams: { sha: params.branch ?? params.sha, per_page: limit },
      });
      return formatList(`Recent commits in ${owner}/${repo}`, commits.map(formatCommit));
    },

    async github_list_branches(params = {}) {
      const owner = requireText(params.owner, 'owner');
      const repo = requireText(params.repo, 'repo');
      const limit = clampInteger(params.limit ?? params.per_page, 30, 1, 100);
      const branches = await githubRequest(rootDirectory, `/repos/${owner}/${repo}/branches`, {
        searchParams: { per_page: limit },
      });
      return formatList(
        `Branches in ${owner}/${repo}`,
        branches.map(
          (branch, index) =>
            `${index + 1}. ${branch.name}${branch.protected ? ' [protected]' : ''}\n   ${branch.commit?.sha ?? ''}`,
        ),
      );
    },

    async github_get_releases(params = {}) {
      const owner = requireText(params.owner, 'owner');
      const repo = requireText(params.repo, 'repo');
      const limit = clampInteger(params.limit ?? params.count, 5, 1, 20);
      const releases = await githubRequest(rootDirectory, `/repos/${owner}/${repo}/releases`, {
        searchParams: { per_page: limit },
      });
      return formatList(`Releases for ${owner}/${repo}`, releases.map(formatRelease));
    },

    async github_get_latest_release(params = {}) {
      const owner = requireText(params.owner, 'owner');
      const repo = requireText(params.repo, 'repo');
      const release = await githubRequest(rootDirectory, `/repos/${owner}/${repo}/releases/latest`);
      return [
        `Latest release for ${owner}/${repo}`,
        `${release.name || release.tag_name} (${release.tag_name})`,
        `Published: ${formatDate(release.published_at)}`,
        `URL: ${release.html_url}`,
        '',
        truncateText(release.body || '(no release notes)', 2000),
      ].join('\n');
    },

    async github_get_contributors(params = {}) {
      const owner = requireText(params.owner, 'owner');
      const repo = requireText(params.repo, 'repo');
      const limit = clampInteger(params.limit ?? params.per_page, 20, 1, 50);
      const contributors = await githubRequest(
        rootDirectory,
        `/repos/${owner}/${repo}/contributors`,
        {
          searchParams: { per_page: limit },
        },
      );
      return formatList(
        `Contributors to ${owner}/${repo}`,
        contributors.map(
          (user, index) =>
            `${index + 1}. ${user.login} - ${user.contributions ?? 0} commits\n   ${user.html_url}`,
        ),
      );
    },

    async github_get_languages(params = {}) {
      const owner = requireText(params.owner, 'owner');
      const repo = requireText(params.repo, 'repo');
      const languages = await githubRequest(rootDirectory, `/repos/${owner}/${repo}/languages`);
      const total = Object.values(languages).reduce((sum, value) => sum + Number(value), 0);
      const rows = Object.entries(languages).map(([language, bytes]) => {
        const percent = total > 0 ? ((Number(bytes) / total) * 100).toFixed(1) : '0.0';
        return `${language}: ${Number(bytes).toLocaleString('en-US')} bytes (${percent}%)`;
      });
      return [`Languages for ${owner}/${repo}`, '', ...rows].join('\n');
    },

    async github_get_topics(params = {}) {
      const owner = requireText(params.owner, 'owner');
      const repo = requireText(params.repo, 'repo');
      const data = await githubRequest(rootDirectory, `/repos/${owner}/${repo}/topics`);
      const topics = data.names ?? [];
      return topics.length
        ? [`Topics for ${owner}/${repo}`, '', topics.join(', ')].join('\n')
        : `No topics found for ${owner}/${repo}.`;
    },

    async github_get_readme(params = {}) {
      const owner = requireText(params.owner, 'owner');
      const repo = requireText(params.repo, 'repo');
      const data = await githubRequest(rootDirectory, `/repos/${owner}/${repo}/readme`, {
        searchParams: { ref: params.ref },
      });
      const content = Buffer.from(String(data.content ?? '').replace(/\n/g, ''), 'base64').toString(
        'utf8',
      );
      return [
        `README for ${owner}/${repo}`,
        '',
        truncateText(content),
        '',
        `URL: ${data.html_url}`,
      ].join('\n');
    },

    async github_search_code(params = {}) {
      const owner = requireText(params.owner, 'owner');
      const repo = requireText(params.repo, 'repo');
      const query = requireText(params.query, 'query');
      const limit = clampInteger(params.limit, 10, 1, 30);
      const result = await githubRequest(rootDirectory, '/search/code', {
        requireAuth: true,
        accept: 'application/vnd.github.text-match+json',
        searchParams: { q: `${query} repo:${owner}/${repo}`, per_page: limit },
      });
      return formatList(
        `Code search results for "${query}" in ${owner}/${repo}`,
        (result.items ?? []).map(
          (item, index) => `${index + 1}. ${item.path}\n   ${item.html_url}`,
        ),
      );
    },

    async github_get_pr_details(params = {}) {
      const { owner, repo, prNumber } = readPullRequestParams(params);
      const pr = await githubRequest(rootDirectory, `/repos/${owner}/${repo}/pulls/${prNumber}`);
      return [
        `Pull request #${pr.number}: ${pr.title}`,
        `State: ${pr.state}${pr.draft ? ' (draft)' : ''}`,
        `Author: ${pr.user?.login || '(unknown)'}`,
        `Branch: ${pr.head?.label || pr.head?.ref || '(unknown)'} -> ${pr.base?.label || pr.base?.ref || '(unknown)'}`,
        `Mergeable: ${pr.mergeable ?? 'unknown'}`,
        `Changed files: ${pr.changed_files ?? 'unknown'}`,
        `Additions: ${pr.additions ?? 0}`,
        `Deletions: ${pr.deletions ?? 0}`,
        `Updated: ${formatDate(pr.updated_at)}`,
        `URL: ${pr.html_url}`,
        '',
        truncateText(pr.body || '(no description)', 1500),
      ].join('\n');
    },

    async github_get_pr_diff(params = {}) {
      const { owner, repo, prNumber } = readPullRequestParams(params);
      const diff = await githubRequest(rootDirectory, `/repos/${owner}/${repo}/pulls/${prNumber}`, {
        accept: 'application/vnd.github.v3.diff',
        raw: true,
      });
      return [
        `Diff for ${owner}/${repo}#${prNumber}`,
        '',
        '```diff',
        truncateText(diff, 12000),
        '```',
      ].join('\n');
    },

    github_get_pr_checks(params = {}) {
      return getPullRequestChecks(rootDirectory, params);
    },

    async github_get_workflow_runs(params = {}) {
      const owner = requireText(params.owner, 'owner');
      const repo = requireText(params.repo, 'repo');
      const limit = clampInteger(params.limit ?? params.per_page, 10, 1, 30);
      const data = await githubRequest(rootDirectory, `/repos/${owner}/${repo}/actions/runs`, {
        searchParams: { branch: params.branch, event: params.event, per_page: limit },
      });
      return formatList(
        `Workflow runs for ${owner}/${repo}`,
        (data.workflow_runs ?? []).map((run, index) =>
          [
            `${index + 1}. ${run.name || 'Workflow'} #${run.run_number}`,
            `   Status: ${run.status}${run.conclusion ? ` / ${run.conclusion}` : ''}`,
            `   Branch: ${run.head_branch || '(unknown)'}`,
            `   Updated: ${formatDate(run.updated_at)}`,
            `   ${run.html_url}`,
          ].join('\n'),
        ),
      );
    },

    async github_create_issue(params = {}) {
      const owner = requireText(params.owner, 'owner');
      const repo = requireText(params.repo, 'repo');
      const title = requireText(params.title, 'title');
      const issue = await githubRequest(rootDirectory, `/repos/${owner}/${repo}/issues`, {
        method: 'POST',
        requireAuth: true,
        body: {
          title,
          body: String(params.body ?? ''),
          labels: parseCommaList(params.labels),
        },
      });
      return [
        `Issue created in ${owner}/${repo}`,
        `#${issue.number}: ${issue.title}`,
        `URL: ${issue.html_url}`,
      ].join('\n');
    },

    async github_update_issue(params = {}) {
      const owner = requireText(params.owner, 'owner');
      const repo = requireText(params.repo, 'repo');
      const issueNumber = requireText(params.issue_number ?? params.issueNumber, 'issue_number');
      const body = {};
      if (params.title !== undefined) body.title = String(params.title);
      if (params.body !== undefined) body.body = String(params.body);
      if (params.state !== undefined)
        body.state = String(params.state).toLowerCase() === 'closed' ? 'closed' : 'open';
      if (params.labels !== undefined) body.labels = parseCommaList(params.labels);
      if (params.assignees !== undefined) body.assignees = parseCommaList(params.assignees);
      if (Object.keys(body).length === 0)
        throw new Error('Provide at least one issue field to update.');

      const issue = await githubRequest(
        rootDirectory,
        `/repos/${owner}/${repo}/issues/${issueNumber}`,
        {
          method: 'PATCH',
          requireAuth: true,
          body,
        },
      );
      return [
        `Issue #${issueNumber} updated in ${owner}/${repo}`,
        `Title: ${issue.title}`,
        `URL: ${issue.html_url}`,
      ].join('\n');
    },

    async github_close_issue(params = {}) {
      const { owner, repo, issueNumber } = readIssueParams(params);
      const issue = await githubRequest(
        rootDirectory,
        `/repos/${owner}/${repo}/issues/${issueNumber}`,
        {
          method: 'PATCH',
          requireAuth: true,
          body: { state: 'closed' },
        },
      );
      return [
        `Issue #${issueNumber} closed in ${owner}/${repo}`,
        `Title: ${issue.title}`,
        `URL: ${issue.html_url}`,
      ].join('\n');
    },

    async github_reopen_issue(params = {}) {
      const { owner, repo, issueNumber } = readIssueParams(params);
      const issue = await githubRequest(
        rootDirectory,
        `/repos/${owner}/${repo}/issues/${issueNumber}`,
        {
          method: 'PATCH',
          requireAuth: true,
          body: { state: 'open' },
        },
      );
      return [
        `Issue #${issueNumber} reopened in ${owner}/${repo}`,
        `Title: ${issue.title}`,
        `URL: ${issue.html_url}`,
      ].join('\n');
    },

    async github_comment_on_issue(params = {}) {
      const owner = requireText(params.owner, 'owner');
      const repo = requireText(params.repo, 'repo');
      const issueNumber = requireText(params.issue_number ?? params.issueNumber, 'issue_number');
      const body = requireText(params.body, 'body');
      const comment = await githubRequest(
        rootDirectory,
        `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
        {
          method: 'POST',
          requireAuth: true,
          body: { body },
        },
      );
      return [`Comment posted on ${owner}/${repo}#${issueNumber}`, `URL: ${comment.html_url}`].join(
        '\n',
      );
    },

    async github_create_pull_request(params = {}) {
      const owner = requireText(params.owner, 'owner');
      const repo = requireText(params.repo, 'repo');
      const title = requireText(params.title, 'title');
      const head = requireText(params.head, 'head');
      const base = requireText(params.base, 'base');
      const pullRequest = await githubRequest(rootDirectory, `/repos/${owner}/${repo}/pulls`, {
        method: 'POST',
        requireAuth: true,
        body: {
          title,
          head,
          base,
          body: String(params.body ?? ''),
          draft: Boolean(params.draft),
        },
      });
      return [
        `Pull request created in ${owner}/${repo}`,
        `#${pullRequest.number}: ${pullRequest.title}`,
        `${head} -> ${base}`,
        `URL: ${pullRequest.html_url}`,
      ].join('\n');
    },

    async github_close_pull_request(params = {}) {
      const owner = requireText(params.owner, 'owner');
      const repo = requireText(params.repo, 'repo');
      const prNumber = requireText(params.pr_number ?? params.prNumber, 'pr_number');
      const pullRequest = await githubRequest(
        rootDirectory,
        `/repos/${owner}/${repo}/pulls/${prNumber}`,
        {
          method: 'PATCH',
          requireAuth: true,
          body: { state: 'closed' },
        },
      );
      return [
        `Pull request #${prNumber} closed in ${owner}/${repo}`,
        `Title: ${pullRequest.title}`,
        `URL: ${pullRequest.html_url}`,
      ].join('\n');
    },

    async github_add_labels(params = {}) {
      const owner = requireText(params.owner, 'owner');
      const repo = requireText(params.repo, 'repo');
      const issueNumber = requireText(params.issue_number ?? params.issueNumber, 'issue_number');
      const labels = parseCommaList(requireText(params.labels, 'labels'));
      const applied = await githubRequest(
        rootDirectory,
        `/repos/${owner}/${repo}/issues/${issueNumber}/labels`,
        {
          method: 'POST',
          requireAuth: true,
          body: { labels },
        },
      );
      return [
        `Labels added to ${owner}/${repo}#${issueNumber}`,
        `Applied: ${applied.map((item) => item.name).join(', ')}`,
      ].join('\n');
    },

    async github_add_assignees(params = {}) {
      const owner = requireText(params.owner, 'owner');
      const repo = requireText(params.repo, 'repo');
      const issueNumber = requireText(params.issue_number ?? params.issueNumber, 'issue_number');
      const assignees = parseCommaList(requireText(params.assignees, 'assignees'));
      await githubRequest(
        rootDirectory,
        `/repos/${owner}/${repo}/issues/${issueNumber}/assignees`,
        {
          method: 'POST',
          requireAuth: true,
          body: { assignees },
        },
      );
      return [
        `Assignees added to ${owner}/${repo}#${issueNumber}`,
        `Assigned: ${assignees.map((item) => `@${item}`).join(', ')}`,
      ].join('\n');
    },

    async github_trigger_workflow(params = {}) {
      const owner = requireText(params.owner, 'owner');
      const repo = requireText(params.repo, 'repo');
      const workflowId = requireText(params.workflow_id ?? params.workflowId, 'workflow_id');
      const ref = String(params.ref ?? 'main').trim() || 'main';
      let inputs = {};
      if (params.inputs) {
        try {
          inputs = typeof params.inputs === 'string' ? JSON.parse(params.inputs) : params.inputs;
        } catch {
          throw new Error('inputs must be a valid JSON object.');
        }
      }
      await githubRequest(
        rootDirectory,
        `/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`,
        {
          method: 'POST',
          requireAuth: true,
          body: { ref, inputs },
        },
      );
      return [
        `Workflow dispatched for ${owner}/${repo}`,
        `Workflow: ${workflowId}`,
        `Ref: ${ref}`,
      ].join('\n');
    },
  };
}
