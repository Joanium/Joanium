import { GitlabAPI, parseCommaList, requireGitlabCredentials } from '../Shared/Common.js';

async function openSite(url) {
  const mod = await import('../../../../Features/Automation/Actions/Site.js');
  return mod.openSite(url);
}

async function sendNotification(title, body = '') {
  const mod = await import('../../../../Features/Automation/Actions/Notification.js');
  return mod.sendNotification(title, body);
}

function requireRepo(action) {
  if (!action.owner || !action.repo) throw new Error('GitLab owner and repo are required.');
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

export const gitlabAutomationHandlers = {
  async gitlab_open_repo(_ctx, action) {
    requireRepo(action);
    await openSite(`https://gitlab.com/${action.owner}/${action.repo}`);
  },

  async gitlab_check_prs(ctx, action) {
    requireRepo(action);
    const credentials = requireGitlabCredentials(ctx);
    const state = action.state ?? 'open';
    const prs = await GitlabAPI.getPullRequests(credentials, action.owner, action.repo, state);
    await sendNotification(
      `${action.owner}/${action.repo} - ${prs.length} ${state} MR${prs.length === 1 ? '' : 's'}`,
      prs
        .slice(0, 3)
        .map((pr) => `- ${pr.title}`)
        .join('\n') || 'No merge requests.',
    );
  },

  async gitlab_check_issues(ctx, action) {
    requireRepo(action);
    const credentials = requireGitlabCredentials(ctx);
    const state = action.state ?? 'open';
    const issues = await GitlabAPI.getIssues(credentials, action.owner, action.repo, state);
    await sendNotification(
      `${action.owner}/${action.repo} - ${issues.length} ${state} issue${issues.length === 1 ? '' : 's'}`,
      issues
        .slice(0, 3)
        .map((issue) => `- ${issue.title}`)
        .join('\n') || 'No issues.',
    );
  },

  async gitlab_check_commits(ctx, action) {
    requireRepo(action);
    const credentials = requireGitlabCredentials(ctx);
    const commits = await GitlabAPI.getCommits(
      credentials,
      action.owner,
      action.repo,
      action.maxResults ?? 5,
    );
    await sendNotification(
      `${action.owner}/${action.repo} - ${commits.length} recent commit${commits.length === 1 ? '' : 's'}`,
      commits
        .slice(0, 3)
        .map((commit) => `- ${String(commit.commit?.message || '').split('\n')[0]}`)
        .join('\n') || 'No commits found.',
    );
  },

  async gitlab_check_releases(ctx, action) {
    requireRepo(action);
    const credentials = requireGitlabCredentials(ctx);
    const release = await GitlabAPI.getLatestRelease(credentials, action.owner, action.repo);
    await sendNotification(
      `${action.owner}/${action.repo} - ${release.tag_name}`,
      `${release.name || release.tag_name}${release.published_at ? ` - ${new Date(release.published_at).toLocaleDateString()}` : ''}`,
    );
  },

  async gitlab_check_notifs(ctx) {
    const credentials = requireGitlabCredentials(ctx);
    const notifications = await GitlabAPI.getNotifications(credentials);
    await sendNotification(
      'GitLab Notifications',
      notifications.length === 0
        ? 'No pending todos.'
        : `${notifications.length} pending todo${notifications.length === 1 ? '' : 's'}`,
    );
  },

  async gitlab_create_issue(ctx, action) {
    requireRepo(action);
    const title = action.issueTitle ?? action.title;
    if (!title) throw new Error('Issue title is required.');
    const credentials = requireGitlabCredentials(ctx);
    const issue = await GitlabAPI.createIssue(
      credentials,
      action.owner,
      action.repo,
      title,
      action.issueBody ?? action.body ?? '',
      parseCommaList(action.labels),
    );
    await sendNotification(
      `Issue created: #${issue.number}`,
      `${issue.title} - ${action.owner}/${action.repo}`,
    );
  },

  async gitlab_repo_stats(ctx, action) {
    requireRepo(action);
    const credentials = requireGitlabCredentials(ctx);
    const stats = await GitlabAPI.getRepoStats(credentials, action.owner, action.repo);
    await sendNotification(
      stats.fullName || `${action.owner}/${action.repo}`,
      `Stars ${stats.stars ?? 0} | Forks ${stats.forks ?? 0} | Open issues ${stats.openIssues ?? 0} | ${stats.language ?? 'unknown'}`,
    );
  },

  async gitlab_star_repo(ctx, action) {
    requireRepo(action);
    const credentials = requireGitlabCredentials(ctx);
    await GitlabAPI.starRepo(credentials, action.owner, action.repo);
    await sendNotification(`Starred ${action.owner}/${action.repo}`, '');
  },

  async gitlab_create_pr(ctx, action) {
    requireRepo(action);
    const title = action.prTitle ?? action.title;
    const head = action.prHead ?? action.head;
    const base = action.prBase ?? action.base;
    if (!title || !head || !base)
      throw new Error('MR title, source branch, and target branch are required.');
    const credentials = requireGitlabCredentials(ctx);
    const pr = await GitlabAPI.createPR(credentials, action.owner, action.repo, {
      title,
      head,
      base,
      body: action.issueBody ?? action.body ?? '',
      draft: parseBoolean(action.draft),
    });
    await sendNotification(
      `MR created: !${pr.number}`,
      `${pr.title} - ${action.owner}/${action.repo}`,
    );
  },

  async gitlab_merge_pr(ctx, action) {
    requireRepo(action);
    if (!action.prNumber) throw new Error('Merge request number is required.');
    const credentials = requireGitlabCredentials(ctx);
    await GitlabAPI.mergePR(
      credentials,
      action.owner,
      action.repo,
      Number(action.prNumber),
      action.mergeMethod ?? 'merge',
      action.commitTitle ?? '',
    );
    await sendNotification(
      `MR !${action.prNumber} merged`,
      `${action.owner}/${action.repo} - ${action.mergeMethod ?? 'merge'}`,
    );
  },

  async gitlab_close_issue(ctx, action) {
    requireRepo(action);
    if (!action.issueNumber) throw new Error('Issue number is required.');
    const credentials = requireGitlabCredentials(ctx);
    const reason = action.closeReason ?? action.reason ?? 'completed';
    await GitlabAPI.closeIssue(
      credentials,
      action.owner,
      action.repo,
      Number(action.issueNumber),
      reason,
    );
    await sendNotification(
      `Issue #${action.issueNumber} closed`,
      `${action.owner}/${action.repo} - ${reason}`,
    );
  },

  async gitlab_comment_issue(ctx, action) {
    requireRepo(action);
    if (!action.issueNumber) throw new Error('Issue number is required.');
    const body = action.issueBody ?? action.body;
    if (!body) throw new Error('Comment body is required.');
    const credentials = requireGitlabCredentials(ctx);
    await GitlabAPI.addIssueComment(
      credentials,
      action.owner,
      action.repo,
      Number(action.issueNumber),
      body,
    );
    await sendNotification(
      `Comment added to #${action.issueNumber}`,
      `${action.owner}/${action.repo}`,
    );
  },

  async gitlab_add_labels(ctx, action) {
    requireRepo(action);
    if (!action.issueNumber) throw new Error('Issue number is required.');
    const labels = parseCommaList(action.labels);
    if (!labels.length) throw new Error('At least one label is required.');
    const credentials = requireGitlabCredentials(ctx);
    await GitlabAPI.addLabels(
      credentials,
      action.owner,
      action.repo,
      Number(action.issueNumber),
      labels,
    );
    await sendNotification(`Labels added to #${action.issueNumber}`, labels.join(', '));
  },

  async gitlab_assign(ctx, action) {
    requireRepo(action);
    if (!action.issueNumber) throw new Error('Issue number is required.');
    const assignees = parseCommaList(action.assignees);
    if (!assignees.length) throw new Error('At least one assignee is required.');
    const credentials = requireGitlabCredentials(ctx);
    await GitlabAPI.addAssignees(
      credentials,
      action.owner,
      action.repo,
      Number(action.issueNumber),
      assignees,
    );
    await sendNotification(
      `Assigned #${action.issueNumber}`,
      `${assignees.join(', ')} - ${action.owner}/${action.repo}`,
    );
  },

  async gitlab_mark_notifs_read(ctx) {
    const credentials = requireGitlabCredentials(ctx);
    await GitlabAPI.markAllNotificationsRead(credentials);
    await sendNotification('GitLab todos cleared', 'All todos marked as done.');
  },

  async gitlab_trigger_workflow(ctx, action) {
    requireRepo(action);
    if (!action.workflowId) throw new Error('Workflow/pipeline ID is required.');
    const credentials = requireGitlabCredentials(ctx);
    const ref = action.workflowRef ?? action.ref ?? 'main';
    const inputs = parseWorkflowInputs(action.workflowInputs ?? action.inputs);
    await GitlabAPI.triggerWorkflow(
      credentials,
      action.owner,
      action.repo,
      action.workflowId,
      ref,
      inputs,
    );
    await sendNotification(
      'Pipeline triggered',
      `${action.workflowId} on ${ref} - ${action.owner}/${action.repo}`,
    );
  },

  async gitlab_workflow_status(ctx, action) {
    requireRepo(action);
    if (!action.workflowId) throw new Error('Workflow/pipeline ID is required.');
    const credentials = requireGitlabCredentials(ctx);
    const run = await GitlabAPI.getLatestWorkflowRun(
      credentials,
      action.owner,
      action.repo,
      action.workflowId,
      action.branch ?? '',
    );
    if (!run) {
      await sendNotification(action.workflowId, 'No pipeline runs found.');
      return;
    }
    await sendNotification(
      `Pipeline - ${run.status}${run.conclusion ? ` / ${run.conclusion}` : ''}`,
      `Branch: ${run.head_branch ?? 'unknown'} - ${action.owner}/${action.repo}`,
    );
  },

  async gitlab_create_gist(ctx, action) {
    const filename = action.gistFilename ?? action.filename;
    if (!filename) throw new Error('Filename is required.');
    if (!action.content) throw new Error('Content is required.');
    const credentials = requireGitlabCredentials(ctx);
    const gist = await GitlabAPI.createGist(
      credentials,
      action.description ?? '',
      { [filename]: { content: action.content } },
      parseBoolean(action.isPublic),
    );
    await sendNotification('Snippet created', gist.html_url ?? `${filename}`);
    if (parseBoolean(action.openInBrowser) && gist.html_url) {
      await openSite(gist.html_url);
    }
  },
};
