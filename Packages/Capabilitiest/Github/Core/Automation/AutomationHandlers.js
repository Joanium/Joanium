import { openSite } from '../../../../Features/Automation/Actions/Site.js';
import { sendNotification } from '../../../../Features/Automation/Actions/Notification.js';
import { GithubAPI, parseCommaList, requireGithubCredentials } from '../Shared/Common.js';

function requireRepo(action) {
  if (!action.owner || !action.repo) throw new Error('GitHub owner and repo are required.');
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (value == null || value === '') return false;
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
}

function parseWorkflowInputs(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    throw new Error('workflowInputs must be valid JSON.');
  }
}

export const githubAutomationHandlers = {
  async github_open_repo(_ctx, action) {
    requireRepo(action);
    await openSite(`https://github.com/${action.owner}/${action.repo}`);
  },

  async github_check_prs(ctx, action) {
    requireRepo(action);
    const credentials = requireGithubCredentials(ctx);
    const state = action.state ?? 'open';
    const prs = await GithubAPI.getPullRequests(credentials, action.owner, action.repo, state);
    sendNotification(
      `${action.owner}/${action.repo} - ${prs.length} ${state} PR${prs.length === 1 ? '' : 's'}`,
      prs.slice(0, 3).map(pr => `- ${pr.title}`).join('\n') || 'No pull requests.',
    );
  },

  async github_check_issues(ctx, action) {
    requireRepo(action);
    const credentials = requireGithubCredentials(ctx);
    const state = action.state ?? 'open';
    const issues = await GithubAPI.getIssues(credentials, action.owner, action.repo, state);
    sendNotification(
      `${action.owner}/${action.repo} - ${issues.length} ${state} issue${issues.length === 1 ? '' : 's'}`,
      issues.slice(0, 3).map(issue => `- ${issue.title}`).join('\n') || 'No issues.',
    );
  },

  async github_check_commits(ctx, action) {
    requireRepo(action);
    const credentials = requireGithubCredentials(ctx);
    const commits = await GithubAPI.getCommits(credentials, action.owner, action.repo, action.maxResults ?? 5);
    sendNotification(
      `${action.owner}/${action.repo} - ${commits.length} recent commit${commits.length === 1 ? '' : 's'}`,
      commits.slice(0, 3).map(commit => `- ${String(commit.commit?.message || '').split('\n')[0]}`).join('\n') || 'No commits found.',
    );
  },

  async github_check_releases(ctx, action) {
    requireRepo(action);
    const credentials = requireGithubCredentials(ctx);
    const release = await GithubAPI.getLatestRelease(credentials, action.owner, action.repo);
    sendNotification(
      `${action.owner}/${action.repo} - ${release.tag_name}`,
      `${release.name || release.tag_name}${release.published_at ? ` - ${new Date(release.published_at).toLocaleDateString()}` : ''}`,
    );
  },

  async github_check_notifs(ctx) {
    const credentials = requireGithubCredentials(ctx);
    const notifications = await GithubAPI.getNotifications(credentials);
    sendNotification(
      'GitHub Notifications',
      notifications.length === 0 ? 'No unread notifications.' : `${notifications.length} unread notification${notifications.length === 1 ? '' : 's'}`,
    );
  },

  async github_create_issue(ctx, action) {
    requireRepo(action);
    const title = action.issueTitle ?? action.title;
    if (!title) throw new Error('Issue title is required.');
    const credentials = requireGithubCredentials(ctx);
    const issue = await GithubAPI.createIssue(
      credentials,
      action.owner,
      action.repo,
      title,
      action.issueBody ?? action.body ?? '',
      parseCommaList(action.labels),
    );
    sendNotification(`Issue created: #${issue.number}`, `${issue.title} - ${action.owner}/${action.repo}`);
  },

  async github_repo_stats(ctx, action) {
    requireRepo(action);
    const credentials = requireGithubCredentials(ctx);
    const stats = await GithubAPI.getRepoStats(credentials, action.owner, action.repo);
    sendNotification(
      stats.fullName || `${action.owner}/${action.repo}`,
      `Stars ${stats.stars ?? 0} | Forks ${stats.forks ?? 0} | Open issues ${stats.openIssues ?? 0} | ${stats.language ?? 'unknown'}`,
    );
  },

  async github_star_repo(ctx, action) {
    requireRepo(action);
    const credentials = requireGithubCredentials(ctx);
    await GithubAPI.starRepo(credentials, action.owner, action.repo);
    sendNotification(`Starred ${action.owner}/${action.repo}`, '');
  },

  async github_create_pr(ctx, action) {
    requireRepo(action);
    const title = action.prTitle ?? action.title;
    const head = action.prHead ?? action.head;
    const base = action.prBase ?? action.base;
    if (!title || !head || !base) throw new Error('PR title, head branch, and base branch are required.');
    const credentials = requireGithubCredentials(ctx);
    const pr = await GithubAPI.createPR(credentials, action.owner, action.repo, {
      title,
      head,
      base,
      body: action.issueBody ?? action.body ?? '',
      draft: parseBoolean(action.draft),
    });
    sendNotification(`PR created: #${pr.number}`, `${pr.title} - ${action.owner}/${action.repo}`);
  },

  async github_merge_pr(ctx, action) {
    requireRepo(action);
    if (!action.prNumber) throw new Error('Pull request number is required.');
    const credentials = requireGithubCredentials(ctx);
    await GithubAPI.mergePR(credentials, action.owner, action.repo, Number(action.prNumber), action.mergeMethod ?? 'merge', action.commitTitle ?? '');
    sendNotification(`PR #${action.prNumber} merged`, `${action.owner}/${action.repo} - ${action.mergeMethod ?? 'merge'}`);
  },

  async github_close_issue(ctx, action) {
    requireRepo(action);
    if (!action.issueNumber) throw new Error('Issue number is required.');
    const credentials = requireGithubCredentials(ctx);
    const reason = action.closeReason ?? action.reason ?? 'completed';
    await GithubAPI.closeIssue(credentials, action.owner, action.repo, Number(action.issueNumber), reason);
    sendNotification(`Issue #${action.issueNumber} closed`, `${action.owner}/${action.repo} - ${reason}`);
  },

  async github_comment_issue(ctx, action) {
    requireRepo(action);
    if (!action.issueNumber) throw new Error('Issue number is required.');
    const body = action.issueBody ?? action.body;
    if (!body) throw new Error('Comment body is required.');
    const credentials = requireGithubCredentials(ctx);
    await GithubAPI.addIssueComment(credentials, action.owner, action.repo, Number(action.issueNumber), body);
    sendNotification(`Comment added to #${action.issueNumber}`, `${action.owner}/${action.repo}`);
  },

  async github_add_labels(ctx, action) {
    requireRepo(action);
    if (!action.issueNumber) throw new Error('Issue number is required.');
    const labels = parseCommaList(action.labels);
    if (!labels.length) throw new Error('At least one label is required.');
    const credentials = requireGithubCredentials(ctx);
    await GithubAPI.addLabels(credentials, action.owner, action.repo, Number(action.issueNumber), labels);
    sendNotification(`Labels added to #${action.issueNumber}`, labels.join(', '));
  },

  async github_assign(ctx, action) {
    requireRepo(action);
    if (!action.issueNumber) throw new Error('Issue number is required.');
    const assignees = parseCommaList(action.assignees);
    if (!assignees.length) throw new Error('At least one assignee is required.');
    const credentials = requireGithubCredentials(ctx);
    await GithubAPI.addAssignees(credentials, action.owner, action.repo, Number(action.issueNumber), assignees);
    sendNotification(`Assigned #${action.issueNumber}`, `${assignees.join(', ')} - ${action.owner}/${action.repo}`);
  },

  async github_mark_notifs_read(ctx) {
    const credentials = requireGithubCredentials(ctx);
    await GithubAPI.markAllNotificationsRead(credentials);
    sendNotification('GitHub notifications cleared', 'All notifications marked as read.');
  },

  async github_trigger_workflow(ctx, action) {
    requireRepo(action);
    if (!action.workflowId) throw new Error('Workflow ID is required.');
    const credentials = requireGithubCredentials(ctx);
    const ref = action.workflowRef ?? action.ref ?? 'main';
    const inputs = parseWorkflowInputs(action.workflowInputs ?? action.inputs);
    await GithubAPI.triggerWorkflow(credentials, action.owner, action.repo, action.workflowId, ref, inputs);
    sendNotification('Workflow triggered', `${action.workflowId} on ${ref} - ${action.owner}/${action.repo}`);
  },

  async github_workflow_status(ctx, action) {
    requireRepo(action);
    if (!action.workflowId) throw new Error('Workflow ID is required.');
    const credentials = requireGithubCredentials(ctx);
    const run = await GithubAPI.getLatestWorkflowRun(credentials, action.owner, action.repo, action.workflowId, action.branch ?? '');
    if (!run) {
      sendNotification(action.workflowId, 'No workflow runs found.');
      return;
    }
    sendNotification(
      `${action.workflowId} - ${run.status}${run.conclusion ? ` / ${run.conclusion}` : ''}`,
      `Branch: ${run.head_branch ?? 'unknown'} - ${action.owner}/${action.repo}`,
    );
  },

  async github_create_gist(ctx, action) {
    const filename = action.gistFilename ?? action.filename;
    if (!filename) throw new Error('Filename is required.');
    if (!action.content) throw new Error('Content is required.');
    const credentials = requireGithubCredentials(ctx);
    const gist = await GithubAPI.createGist(credentials, action.description ?? '', { [filename]: { content: action.content } }, parseBoolean(action.isPublic));
    sendNotification('Gist created', gist.html_url ?? `${filename}`);
    if (parseBoolean(action.openInBrowser) && gist.html_url) {
      await openSite(gist.html_url);
    }
  },
};
