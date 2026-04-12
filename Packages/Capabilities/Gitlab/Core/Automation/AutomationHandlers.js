import { GitlabAPI, requireGitlabCredentials } from '../Shared/Common.js';
function requireRepo(owner, repo) {
  if (!owner || !repo) throw new Error('GitLab owner and repo are required.');
}
export const gitlabDataSourceCollectors = {
  async gitlab_notifications(ctx) {
    const credentials = requireGitlabCredentials(ctx),
      notifications = await GitlabAPI.getNotifications(credentials);
    return notifications.length
      ? `GitLab Notifications - ${notifications.length} pending:\n\n${notifications
          .slice(0, 15)
          .map(
            (item, index) =>
              `${index + 1}. [${item.reason}] ${item.subject?.title} in ${item.repository?.full_name}`,
          )
          .join('\n')}`
      : 'EMPTY: GitLab has no pending todos/notifications.';
  },
  async gitlab_repos(ctx, dataSource) {
    const credentials = requireGitlabCredentials(ctx),
      repos = await GitlabAPI.getRepos(credentials, dataSource.maxResults ?? 30);
    return repos.length
      ? `GitLab Repositories - ${repos.length} repos:\n\n${repos.map((repo, index) => `${index + 1}. ${repo.full_name} [${repo.language ?? 'unknown'}]`).join('\n')}`
      : 'EMPTY: No GitLab repositories found.';
  },
  async gitlab_prs(ctx, dataSource) {
    requireRepo(dataSource.owner, dataSource.repo);
    const credentials = requireGitlabCredentials(ctx),
      state = dataSource.state ?? 'open',
      prs = await GitlabAPI.getPullRequests(
        credentials,
        dataSource.owner,
        dataSource.repo,
        state,
        dataSource.maxResults ?? 20,
      );
    return prs.length
      ? `GitLab Merge Requests (${dataSource.owner}/${dataSource.repo}) - ${prs.length}:\n\n${prs.map((pr, index) => `${index + 1}. !${pr.number}: ${pr.title} by ${pr.user?.login ?? 'unknown'}`).join('\n\n')}`
      : `EMPTY: ${dataSource.owner}/${dataSource.repo} has no ${state} merge requests.`;
  },
  async gitlab_issues(ctx, dataSource) {
    requireRepo(dataSource.owner, dataSource.repo);
    const credentials = requireGitlabCredentials(ctx),
      state = dataSource.state ?? 'open',
      issues = await GitlabAPI.getIssues(
        credentials,
        dataSource.owner,
        dataSource.repo,
        state,
        dataSource.maxResults ?? 20,
      );
    return issues.length
      ? `GitLab Issues (${dataSource.owner}/${dataSource.repo}) - ${issues.length}:\n\n${issues.map((issue, index) => `${index + 1}. #${issue.number}: ${issue.title} by ${issue.user?.login ?? 'unknown'}`).join('\n\n')}`
      : `EMPTY: ${dataSource.owner}/${dataSource.repo} has no ${state} issues.`;
  },
  async gitlab_commits(ctx, dataSource) {
    requireRepo(dataSource.owner, dataSource.repo);
    const credentials = requireGitlabCredentials(ctx),
      commits = await GitlabAPI.getCommits(
        credentials,
        dataSource.owner,
        dataSource.repo,
        dataSource.maxResults ?? 10,
      );
    return commits.length
      ? `GitLab Commits (${dataSource.owner}/${dataSource.repo}) - ${commits.length}:\n\n${commits.map((commit, index) => `${index + 1}. ${String(commit.commit?.message || '').split('\n')[0]} - ${commit.commit?.author?.name ?? 'unknown'}`).join('\n')}`
      : `EMPTY: ${dataSource.owner}/${dataSource.repo} has no commits.`;
  },
  async gitlab_releases(ctx, dataSource) {
    requireRepo(dataSource.owner, dataSource.repo);
    const credentials = requireGitlabCredentials(ctx),
      releases = await GitlabAPI.getReleases(
        credentials,
        dataSource.owner,
        dataSource.repo,
        dataSource.maxResults ?? 10,
      );
    return releases.length
      ? `GitLab Releases (${dataSource.owner}/${dataSource.repo}) - ${releases.length}:\n\n${releases
          .map(
            (release, index) =>
              `${index + 1}. ${release.name || release.tag_name} (${release.tag_name}) - ${(function (
                value,
              ) {
                if (!value) return 'unknown date';
                try {
                  return new Date(value).toLocaleDateString();
                } catch {
                  return String(value);
                }
              })(release.published_at)}`,
          )
          .join('\n')}`
      : `EMPTY: ${dataSource.owner}/${dataSource.repo} has no releases.`;
  },
  async gitlab_workflow_runs(ctx, dataSource) {
    requireRepo(dataSource.owner, dataSource.repo);
    const credentials = requireGitlabCredentials(ctx),
      workflowRuns =
        (
          await GitlabAPI.getWorkflowRuns(credentials, dataSource.owner, dataSource.repo, {
            branch: dataSource.branch ?? '',
            event: dataSource.event ?? '',
            perPage: dataSource.maxResults ?? 20,
          })
        ).workflow_runs ?? [];
    return workflowRuns.length
      ? `GitLab Pipeline Runs (${dataSource.owner}/${dataSource.repo}) - ${workflowRuns.length}:\n\n${workflowRuns.map((run, index) => `${index + 1}. ${run.name}: ${run.status}${run.conclusion ? ` / ${run.conclusion}` : ''} [${run.event}]`).join('\n')}`
      : `EMPTY: ${dataSource.owner}/${dataSource.repo} has no pipeline runs.`;
  },
  async gitlab_repo_stats(ctx, dataSource) {
    requireRepo(dataSource.owner, dataSource.repo);
    const credentials = requireGitlabCredentials(ctx),
      stats = await GitlabAPI.getRepoStats(credentials, dataSource.owner, dataSource.repo);
    return [
      `GitLab Repo Stats (${stats.fullName || `${dataSource.owner}/${dataSource.repo}`})`,
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
export const gitlabOutputHandlers = {
  async gitlab_mr_review(ctx, payload) {
    const credentials = requireGitlabCredentials(ctx),
      { output: output, aiResponse: aiResponse } = payload;
    if (!output.owner || !output.repo || !output.prNumber)
      throw new Error('gitlab_mr_review requires owner, repo, and prNumber.');
    await GitlabAPI.createPRReview(
      credentials,
      output.owner,
      output.repo,
      Number(output.prNumber),
      { body: aiResponse, event: output.event ?? 'COMMENT' },
    );
  },
};
