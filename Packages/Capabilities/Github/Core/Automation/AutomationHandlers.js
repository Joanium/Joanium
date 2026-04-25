import { GithubAPI, requireGithubCredentials } from '../Shared/Common.js';
import { formatDate } from '../../../Core/ConnectorUtils.js';
function requireRepo(owner, repo) {
  if (!owner || !repo) throw new Error('GitHub owner and repo are required.');
}
export const githubDataSourceCollectors = {
  async github_notifications(ctx) {
    const credentials = requireGithubCredentials(ctx),
      notifications = await GithubAPI.getNotifications(credentials);
    return notifications.length
      ? `GitHub Notifications - ${notifications.length} unread:\n\n${notifications
          .slice(0, 15)
          .map(
            (item, index) =>
              `${index + 1}. [${item.reason}] ${item.subject?.title} in ${item.repository?.full_name}`,
          )
          .join('\n')}`
      : 'EMPTY: GitHub has no unread notifications.';
  },
  async github_repos(ctx, dataSource) {
    const credentials = requireGithubCredentials(ctx),
      repos = await GithubAPI.getRepos(credentials, dataSource.maxResults ?? 30);
    return repos.length
      ? `GitHub Repositories - ${repos.length} repos:\n\n${repos.map((repo, index) => `${index + 1}. ${repo.full_name} [${repo.language ?? 'unknown'}]`).join('\n')}`
      : 'EMPTY: No GitHub repositories found.';
  },
  async github_prs(ctx, dataSource) {
    requireRepo(dataSource.owner, dataSource.repo);
    const credentials = requireGithubCredentials(ctx),
      state = dataSource.state ?? 'open',
      prs = await GithubAPI.getPullRequests(
        credentials,
        dataSource.owner,
        dataSource.repo,
        state,
        dataSource.maxResults ?? 20,
      );
    return prs.length
      ? `GitHub Pull Requests (${dataSource.owner}/${dataSource.repo}) - ${prs.length}:\n\n${prs.map((pr, index) => `${index + 1}. #${pr.number}: ${pr.title} by ${pr.user?.login ?? 'unknown'}`).join('\n\n')}`
      : `EMPTY: ${dataSource.owner}/${dataSource.repo} has no ${state} pull requests.`;
  },
  async github_issues(ctx, dataSource) {
    requireRepo(dataSource.owner, dataSource.repo);
    const credentials = requireGithubCredentials(ctx),
      state = dataSource.state ?? 'open',
      issues = await GithubAPI.getIssues(
        credentials,
        dataSource.owner,
        dataSource.repo,
        state,
        dataSource.maxResults ?? 20,
      );
    return issues.length
      ? `GitHub Issues (${dataSource.owner}/${dataSource.repo}) - ${issues.length}:\n\n${issues.map((issue, index) => `${index + 1}. #${issue.number}: ${issue.title} by ${issue.user?.login ?? 'unknown'}`).join('\n\n')}`
      : `EMPTY: ${dataSource.owner}/${dataSource.repo} has no ${state} issues.`;
  },
  async github_commits(ctx, dataSource) {
    requireRepo(dataSource.owner, dataSource.repo);
    const credentials = requireGithubCredentials(ctx),
      commits = await GithubAPI.getCommits(
        credentials,
        dataSource.owner,
        dataSource.repo,
        dataSource.maxResults ?? 10,
      );
    return commits.length
      ? `GitHub Commits (${dataSource.owner}/${dataSource.repo}) - ${commits.length}:\n\n${commits.map((commit, index) => `${index + 1}. ${String(commit.commit?.message || '').split('\n')[0]} - ${commit.commit?.author?.name ?? 'unknown'}`).join('\n')}`
      : `EMPTY: ${dataSource.owner}/${dataSource.repo} has no commits.`;
  },
  async github_releases(ctx, dataSource) {
    requireRepo(dataSource.owner, dataSource.repo);
    const credentials = requireGithubCredentials(ctx),
      releases = await GithubAPI.getReleases(
        credentials,
        dataSource.owner,
        dataSource.repo,
        dataSource.maxResults ?? 10,
      );
    return releases.length
      ? `GitHub Releases (${dataSource.owner}/${dataSource.repo}) - ${releases.length}:\n\n${releases
          .map(
            (release, index) =>
              `${index + 1}. ${release.name || release.tag_name} (${release.tag_name}) - ${formatDate(release.published_at)}`,
          )
          .join('\n')}`
      : `EMPTY: ${dataSource.owner}/${dataSource.repo} has no releases.`;
  },
  async github_workflow_runs(ctx, dataSource) {
    requireRepo(dataSource.owner, dataSource.repo);
    const credentials = requireGithubCredentials(ctx),
      workflowRuns =
        (
          await GithubAPI.getWorkflowRuns(credentials, dataSource.owner, dataSource.repo, {
            branch: dataSource.branch ?? '',
            event: dataSource.event ?? '',
            perPage: dataSource.maxResults ?? 20,
          })
        ).workflow_runs ?? [];
    return workflowRuns.length
      ? `GitHub Workflow Runs (${dataSource.owner}/${dataSource.repo}) - ${workflowRuns.length}:\n\n${workflowRuns.map((run, index) => `${index + 1}. ${run.name}: ${run.status}${run.conclusion ? ` / ${run.conclusion}` : ''} [${run.event}]`).join('\n')}`
      : `EMPTY: ${dataSource.owner}/${dataSource.repo} has no workflow runs.`;
  },
  async github_repo_stats(ctx, dataSource) {
    requireRepo(dataSource.owner, dataSource.repo);
    const credentials = requireGithubCredentials(ctx),
      stats = await GithubAPI.getRepoStats(credentials, dataSource.owner, dataSource.repo);
    return [
      `GitHub Repo Stats (${stats.fullName || `${dataSource.owner}/${dataSource.repo}`})`,
      `Stars: ${stats.stars ?? 0}`,
      `Forks: ${stats.forks ?? 0}`,
      `Watchers: ${stats.watchers ?? 0}`,
      `Open issues: ${stats.openIssues ?? 0}`,
      `Language: ${stats.language ?? 'unknown'}`,
      stats.description ? `Description: ${stats.description}` : '',
      stats.url ? `URL: ${stats.url}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  },
};
export const githubOutputHandlers = {
  async github_pr_review(ctx, payload) {
    const credentials = requireGithubCredentials(ctx),
      { output: output, aiResponse: aiResponse } = payload;
    if (!output.owner || !output.repo || !output.prNumber)
      throw new Error('github_pr_review requires owner, repo, and prNumber.');
    await GithubAPI.createPRReview(
      credentials,
      output.owner,
      output.repo,
      Number(output.prNumber),
      { body: aiResponse, event: output.event ?? 'COMMENT' },
    );
  },
};
