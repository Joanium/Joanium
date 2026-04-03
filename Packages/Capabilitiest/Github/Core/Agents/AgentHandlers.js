import { GithubAPI, requireGithubCredentials } from '../Shared/Common.js';

function requireRepo(owner, repo) {
  if (!owner || !repo) throw new Error('GitHub owner and repo are required.');
}

function formatDate(value) {
  if (!value) return 'unknown date';
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return String(value);
  }
}

export const githubDataSourceCollectors = {
  async github_notifications(ctx) {
    const credentials = requireGithubCredentials(ctx);
    const notifications = await GithubAPI.getNotifications(credentials);
    if (!notifications.length) return 'EMPTY: GitHub has no unread notifications.';
    return `GitHub Notifications - ${notifications.length} unread:\n\n${notifications.slice(0, 15).map((item, index) => `${index + 1}. [${item.reason}] ${item.subject?.title} in ${item.repository?.full_name}`).join('\n')}`;
  },

  async github_repos(ctx, dataSource) {
    const credentials = requireGithubCredentials(ctx);
    const repos = await GithubAPI.getRepos(credentials, dataSource.maxResults ?? 30);
    if (!repos.length) return 'EMPTY: No GitHub repositories found.';
    return `GitHub Repositories - ${repos.length} repos:\n\n${repos.map((repo, index) => `${index + 1}. ${repo.full_name} [${repo.language ?? 'unknown'}]`).join('\n')}`;
  },

  async github_prs(ctx, dataSource) {
    requireRepo(dataSource.owner, dataSource.repo);
    const credentials = requireGithubCredentials(ctx);
    const state = dataSource.state ?? 'open';
    const prs = await GithubAPI.getPullRequests(credentials, dataSource.owner, dataSource.repo, state, dataSource.maxResults ?? 20);
    if (!prs.length) return `EMPTY: ${dataSource.owner}/${dataSource.repo} has no ${state} pull requests.`;
    return `GitHub Pull Requests (${dataSource.owner}/${dataSource.repo}) - ${prs.length}:\n\n${prs.map((pr, index) => `${index + 1}. #${pr.number}: ${pr.title} by ${pr.user?.login ?? 'unknown'}`).join('\n\n')}`;
  },

  async github_issues(ctx, dataSource) {
    requireRepo(dataSource.owner, dataSource.repo);
    const credentials = requireGithubCredentials(ctx);
    const state = dataSource.state ?? 'open';
    const issues = await GithubAPI.getIssues(credentials, dataSource.owner, dataSource.repo, state, dataSource.maxResults ?? 20);
    if (!issues.length) return `EMPTY: ${dataSource.owner}/${dataSource.repo} has no ${state} issues.`;
    return `GitHub Issues (${dataSource.owner}/${dataSource.repo}) - ${issues.length}:\n\n${issues.map((issue, index) => `${index + 1}. #${issue.number}: ${issue.title} by ${issue.user?.login ?? 'unknown'}`).join('\n\n')}`;
  },

  async github_commits(ctx, dataSource) {
    requireRepo(dataSource.owner, dataSource.repo);
    const credentials = requireGithubCredentials(ctx);
    const commits = await GithubAPI.getCommits(credentials, dataSource.owner, dataSource.repo, dataSource.maxResults ?? 10);
    if (!commits.length) return `EMPTY: ${dataSource.owner}/${dataSource.repo} has no commits.`;
    return `GitHub Commits (${dataSource.owner}/${dataSource.repo}) - ${commits.length}:\n\n${commits.map((commit, index) => `${index + 1}. ${String(commit.commit?.message || '').split('\n')[0]} - ${commit.commit?.author?.name ?? 'unknown'}`).join('\n')}`;
  },

  async github_releases(ctx, dataSource) {
    requireRepo(dataSource.owner, dataSource.repo);
    const credentials = requireGithubCredentials(ctx);
    const releases = await GithubAPI.getReleases(credentials, dataSource.owner, dataSource.repo, dataSource.maxResults ?? 10);
    if (!releases.length) return `EMPTY: ${dataSource.owner}/${dataSource.repo} has no releases.`;
    return `GitHub Releases (${dataSource.owner}/${dataSource.repo}) - ${releases.length}:\n\n${releases.map((release, index) => `${index + 1}. ${release.name || release.tag_name} (${release.tag_name}) - ${formatDate(release.published_at)}`).join('\n')}`;
  },

  async github_workflow_runs(ctx, dataSource) {
    requireRepo(dataSource.owner, dataSource.repo);
    const credentials = requireGithubCredentials(ctx);
    const runs = await GithubAPI.getWorkflowRuns(credentials, dataSource.owner, dataSource.repo, {
      branch: dataSource.branch ?? '',
      event: dataSource.event ?? '',
      perPage: dataSource.maxResults ?? 20,
    });
    const workflowRuns = runs.workflow_runs ?? [];
    if (!workflowRuns.length) return `EMPTY: ${dataSource.owner}/${dataSource.repo} has no workflow runs.`;
    return `GitHub Workflow Runs (${dataSource.owner}/${dataSource.repo}) - ${workflowRuns.length}:\n\n${workflowRuns.map((run, index) => `${index + 1}. ${run.name}: ${run.status}${run.conclusion ? ` / ${run.conclusion}` : ''} [${run.event}]`).join('\n')}`;
  },

  async github_repo_stats(ctx, dataSource) {
    requireRepo(dataSource.owner, dataSource.repo);
    const credentials = requireGithubCredentials(ctx);
    const stats = await GithubAPI.getRepoStats(credentials, dataSource.owner, dataSource.repo);
    return [
      `GitHub Repo Stats (${stats.fullName || `${dataSource.owner}/${dataSource.repo}`})`,
      `Stars: ${stats.stars ?? 0}`,
      `Forks: ${stats.forks ?? 0}`,
      `Watchers: ${stats.watchers ?? 0}`,
      `Open issues: ${stats.openIssues ?? 0}`,
      `Language: ${stats.language ?? 'unknown'}`,
      stats.description ? `Description: ${stats.description}` : '',
      stats.url ? `URL: ${stats.url}` : '',
    ].filter(Boolean).join('\n');
  },
};

export const githubOutputHandlers = {
  async github_pr_review(ctx, payload) {
    const credentials = requireGithubCredentials(ctx);
    const { output, aiResponse } = payload;
    if (!output.owner || !output.repo || !output.prNumber) {
      throw new Error('github_pr_review requires owner, repo, and prNumber.');
    }
    await GithubAPI.createPRReview(credentials, output.owner, output.repo, Number(output.prNumber), {
      body: aiResponse,
      event: output.event ?? 'COMMENT',
    });
  },
};
