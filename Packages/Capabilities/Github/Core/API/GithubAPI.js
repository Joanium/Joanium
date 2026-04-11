const GITHUB_BASE = 'https://api.github.com';

async function githubFetch(endpoint, token, options = {}) {
  const res = await fetch(`${GITHUB_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message ?? `GitHub API ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function getUser(credentials) {
  return githubFetch('/user', credentials.token);
}

export async function getRepos(credentials, perPage = 30) {
  return githubFetch(
    `/user/repos?sort=updated&per_page=${perPage}&affiliation=owner,collaborator`,
    credentials.token,
  );
}

export async function getRepoTree(credentials, owner, repo, branch) {
  const tryBranch = (b) =>
    githubFetch(`/repos/${owner}/${repo}/git/trees/${b}?recursive=1`, credentials.token);

  if (branch) return tryBranch(branch);
  try {
    return await tryBranch('main');
  } catch {
    return tryBranch('master');
  }
}

export async function getFileContent(credentials, owner, repo, filePath) {
  const data = await githubFetch(`/repos/${owner}/${repo}/contents/${filePath}`, credentials.token);

  if (Array.isArray(data)) throw new Error(`"${filePath}" is a directory, not a file.`);

  const content =
    data.encoding === 'base64'
      ? Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8')
      : data.content;

  return {
    path: data.path,
    name: data.name,
    content,
    sha: data.sha,
    size: data.size,
    url: data.html_url,
  };
}

export async function getIssues(credentials, owner, repo, state = 'open', perPage = 20) {
  return githubFetch(
    `/repos/${owner}/${repo}/issues?state=${state}&per_page=${perPage}`,
    credentials.token,
  ).then((items) => items.filter((i) => !i.pull_request));
}

export async function getPullRequests(credentials, owner, repo, state = 'open', perPage = 20) {
  return githubFetch(
    `/repos/${owner}/${repo}/pulls?state=${state}&per_page=${perPage}`,
    credentials.token,
  );
}

export async function getCommits(credentials, owner, repo, perPage = 20) {
  return githubFetch(`/repos/${owner}/${repo}/commits?per_page=${perPage}`, credentials.token);
}

export async function getNotifications(credentials, unreadOnly = true) {
  return githubFetch(`/notifications?all=${!unreadOnly}`, credentials.token);
}

export async function getBranches(credentials, owner, repo) {
  return githubFetch(`/repos/${owner}/${repo}/branches`, credentials.token);
}

export async function createIssue(credentials, owner, repo, title, body, labels = []) {
  return githubFetch(`/repos/${owner}/${repo}/issues`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({ title, body, labels }),
  });
}

export async function searchCode(credentials, query, scope) {
  const q = scope ? `${query} repo:${scope}` : query;
  return githubFetch(`/search/code?q=${encodeURIComponent(q)}`, credentials.token, {
    headers: { Accept: 'application/vnd.github.text-match+json' },
  });
}

export async function getReadme(credentials, owner, repo) {
  return getFileContent(credentials, owner, repo, 'README.md').catch(() =>
    getFileContent(credentials, owner, repo, 'readme.md'),
  );
}

export async function getLatestRelease(credentials, owner, repo) {
  return githubFetch(`/repos/${owner}/${repo}/releases/latest`, credentials.token);
}

export async function getReleases(credentials, owner, repo, perPage = 10) {
  return githubFetch(`/repos/${owner}/${repo}/releases?per_page=${perPage}`, credentials.token);
}

// ─────────────────────────────────────────────
// Code Review Agent additions
// ─────────────────────────────────────────────

export async function getPRFiles(credentials, owner, repo, prNumber) {
  return githubFetch(
    `/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100`,
    credentials.token,
  );
}

export async function getPRDiff(credentials, owner, repo, prNumber) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, {
    headers: {
      Authorization: `Bearer ${credentials.token}`,
      Accept: 'application/vnd.github.v3.diff',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message ?? `GitHub API ${res.status}`);
  }
  return res.text();
}

export async function getPRDetails(credentials, owner, repo, prNumber) {
  return githubFetch(`/repos/${owner}/${repo}/pulls/${prNumber}`, credentials.token);
}

export async function createPRReview(
  credentials,
  owner,
  repo,
  prNumber,
  { body, event = 'COMMENT', comments = [] },
) {
  return githubFetch(`/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({ body, event, comments }),
  });
}

export async function listPRReviews(credentials, owner, repo, prNumber) {
  return githubFetch(`/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, credentials.token);
}

export async function getPRComments(credentials, owner, repo, prNumber) {
  return githubFetch(
    `/repos/${owner}/${repo}/pulls/${prNumber}/comments?per_page=100`,
    credentials.token,
  );
}

export async function getPRChecks(credentials, owner, repo, prNumber) {
  const pr = await getPRDetails(credentials, owner, repo, prNumber);
  const sha = pr?.head?.sha;
  if (!sha) {
    throw new Error(`PR #${prNumber} has no head SHA.`);
  }

  const [combinedStatus, checkRuns] = await Promise.all([
    githubFetch(`/repos/${owner}/${repo}/commits/${sha}/status`, credentials.token).catch(
      () => null,
    ),
    githubFetch(`/repos/${owner}/${repo}/commits/${sha}/check-runs`, credentials.token).catch(
      () => null,
    ),
  ]);

  return {
    prNumber,
    sha,
    state: combinedStatus?.state ?? 'unknown',
    statuses: combinedStatus?.statuses ?? [],
    checkRuns: checkRuns?.check_runs ?? [],
    totalCount: checkRuns?.total_count ?? 0,
  };
}

export async function getWorkflowRuns(
  credentials,
  owner,
  repo,
  { branch = '', event = '', perPage = 20 } = {},
) {
  const qs = new URLSearchParams({ per_page: String(perPage || 20) });
  if (branch) qs.set('branch', branch);
  if (event) qs.set('event', event);

  return githubFetch(`/repos/${owner}/${repo}/actions/runs?${qs.toString()}`, credentials.token);
}

export async function starRepo(credentials, owner, repo) {
  return githubFetch(`/user/starred/${owner}/${repo}`, credentials.token, {
    method: 'PUT',
    headers: { 'Content-Length': '0' },
  });
}

export async function unstarRepo(credentials, owner, repo) {
  return githubFetch(`/user/starred/${owner}/${repo}`, credentials.token, {
    method: 'DELETE',
  });
}

export async function getRepoStats(credentials, owner, repo) {
  const data = await githubFetch(`/repos/${owner}/${repo}`, credentials.token);
  return {
    fullName: data.full_name,
    description: data.description ?? '',
    stars: data.stargazers_count,
    forks: data.forks_count,
    openIssues: data.open_issues_count,
    watchers: data.watchers_count,
    language: data.language ?? 'Unknown',
    defaultBranch: data.default_branch,
    url: data.html_url,
  };
}

export async function createPR(
  credentials,
  owner,
  repo,
  { title, body = '', head, base, draft = false },
) {
  if (!head || !base) throw new Error('createPR: head and base branches are required');
  return githubFetch(`/repos/${owner}/${repo}/pulls`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({ title, body, head, base, draft }),
  });
}

export async function mergePR(
  credentials,
  owner,
  repo,
  prNumber,
  mergeMethod = 'merge',
  commitTitle = '',
) {
  return githubFetch(`/repos/${owner}/${repo}/pulls/${prNumber}/merge`, credentials.token, {
    method: 'PUT',
    body: JSON.stringify({
      merge_method: mergeMethod,
      ...(commitTitle ? { commit_title: commitTitle } : {}),
    }),
  });
}

export async function closePR(credentials, owner, repo, prNumber) {
  return githubFetch(`/repos/${owner}/${repo}/pulls/${prNumber}`, credentials.token, {
    method: 'PATCH',
    body: JSON.stringify({ state: 'closed' }),
  });
}

export async function closeIssue(credentials, owner, repo, issueNumber, reason = 'completed') {
  return githubFetch(`/repos/${owner}/${repo}/issues/${issueNumber}`, credentials.token, {
    method: 'PATCH',
    body: JSON.stringify({ state: 'closed', state_reason: reason }),
  });
}

export async function reopenIssue(credentials, owner, repo, issueNumber) {
  return githubFetch(`/repos/${owner}/${repo}/issues/${issueNumber}`, credentials.token, {
    method: 'PATCH',
    body: JSON.stringify({ state: 'open' }),
  });
}

export async function addIssueComment(credentials, owner, repo, issueNumber, body) {
  return githubFetch(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

export async function addLabels(credentials, owner, repo, issueNumber, labels = []) {
  return githubFetch(`/repos/${owner}/${repo}/issues/${issueNumber}/labels`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({ labels }),
  });
}

export async function addAssignees(credentials, owner, repo, issueNumber, assignees = []) {
  return githubFetch(`/repos/${owner}/${repo}/issues/${issueNumber}/assignees`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({ assignees }),
  });
}

export async function markAllNotificationsRead(credentials) {
  return githubFetch('/notifications', credentials.token, {
    method: 'PUT',
    body: JSON.stringify({ read: true }),
  });
}

export async function triggerWorkflow(
  credentials,
  owner,
  repo,
  workflowId,
  ref = 'main',
  inputs = {},
) {
  return githubFetch(
    `/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`,
    credentials.token,
    {
      method: 'POST',
      body: JSON.stringify({ ref, inputs }),
    },
  );
}

export async function getLatestWorkflowRun(credentials, owner, repo, workflowId, branch = '') {
  const qs = new URLSearchParams({ per_page: '1' });
  if (branch) qs.set('branch', branch);
  const data = await githubFetch(
    `/repos/${owner}/${repo}/actions/workflows/${workflowId}/runs?${qs}`,
    credentials.token,
  );
  return data.workflow_runs?.[0] ?? null;
}

export async function createGist(credentials, description, files, isPublic = false) {
  return githubFetch('/gists', credentials.token, {
    method: 'POST',
    body: JSON.stringify({ description, files, public: isPublic }),
  });
}

export async function getIssueDetails(credentials, owner, repo, issueNumber) {
  return githubFetch(`/repos/${owner}/${repo}/issues/${issueNumber}`, credentials.token);
}

export async function updateIssue(
  credentials,
  owner,
  repo,
  issueNumber,
  { title, body, state, labels, assignees } = {},
) {
  const payload = {};
  if (title !== undefined) payload.title = title;
  if (body !== undefined) payload.body = body;
  if (state !== undefined) payload.state = state;
  if (labels !== undefined) payload.labels = labels;
  if (assignees !== undefined) payload.assignees = assignees;
  return githubFetch(`/repos/${owner}/${repo}/issues/${issueNumber}`, credentials.token, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function getContributors(credentials, owner, repo, perPage = 30) {
  return githubFetch(`/repos/${owner}/${repo}/contributors?per_page=${perPage}`, credentials.token);
}

export async function getLanguages(credentials, owner, repo) {
  return githubFetch(`/repos/${owner}/${repo}/languages`, credentials.token);
}

export async function getTopics(credentials, owner, repo) {
  return githubFetch(`/repos/${owner}/${repo}/topics`, credentials.token, {
    headers: { Accept: 'application/vnd.github.mercy-preview+json' },
  });
}

export async function getMilestones(credentials, owner, repo, state = 'open') {
  return githubFetch(
    `/repos/${owner}/${repo}/milestones?state=${state}&per_page=30`,
    credentials.token,
  );
}

export async function createMilestone(
  credentials,
  owner,
  repo,
  title,
  description = '',
  dueOn = '',
) {
  const payload = { title };
  if (description) payload.description = description;
  if (dueOn) payload.due_on = dueOn;
  return githubFetch(`/repos/${owner}/${repo}/milestones`, credentials.token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createBranch(credentials, owner, repo, branchName, sha) {
  return githubFetch(`/repos/${owner}/${repo}/git/refs`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha }),
  });
}

export async function deleteBranch(credentials, owner, repo, branchName) {
  return githubFetch(`/repos/${owner}/${repo}/git/refs/heads/${branchName}`, credentials.token, {
    method: 'DELETE',
  });
}

export async function getForks(credentials, owner, repo, perPage = 20) {
  return githubFetch(
    `/repos/${owner}/${repo}/forks?per_page=${perPage}&sort=newest`,
    credentials.token,
  );
}

export async function getStargazers(credentials, owner, repo, perPage = 30) {
  return githubFetch(`/repos/${owner}/${repo}/stargazers?per_page=${perPage}`, credentials.token);
}

export async function getCollaborators(credentials, owner, repo) {
  return githubFetch(`/repos/${owner}/${repo}/collaborators?per_page=50`, credentials.token);
}

export async function compareBranches(credentials, owner, repo, base, head) {
  return githubFetch(
    `/repos/${owner}/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`,
    credentials.token,
  );
}

export async function getGists(credentials, perPage = 20) {
  return githubFetch(`/gists?per_page=${perPage}`, credentials.token);
}

export async function getTrafficViews(credentials, owner, repo) {
  return githubFetch(`/repos/${owner}/${repo}/traffic/views`, credentials.token);
}

export async function requestReviewers(
  credentials,
  owner,
  repo,
  prNumber,
  reviewers = [],
  teamReviewers = [],
) {
  return githubFetch(
    `/repos/${owner}/${repo}/pulls/${prNumber}/requested_reviewers`,
    credentials.token,
    {
      method: 'POST',
      body: JSON.stringify({ reviewers, team_reviewers: teamReviewers }),
    },
  );
}

export async function getUserInfo(credentials, username) {
  return githubFetch(`/users/${username}`, credentials.token);
}

export async function searchRepos(credentials, query, perPage = 20) {
  return githubFetch(
    `/search/repositories?q=${encodeURIComponent(query)}&per_page=${perPage}&sort=stars&order=desc`,
    credentials.token,
  );
}

export async function searchIssues(credentials, query, perPage = 20) {
  return githubFetch(
    `/search/issues?q=${encodeURIComponent(query)}&per_page=${perPage}`,
    credentials.token,
  );
}

export async function getIssueComments(credentials, owner, repo, issueNumber, perPage = 30) {
  return githubFetch(
    `/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=${perPage}`,
    credentials.token,
  );
}

export async function getCommitDetails(credentials, owner, repo, sha) {
  return githubFetch(`/repos/${owner}/${repo}/commits/${sha}`, credentials.token);
}

export async function getTags(credentials, owner, repo, perPage = 20) {
  return githubFetch(`/repos/${owner}/${repo}/tags?per_page=${perPage}`, credentials.token);
}

export async function createRelease(
  credentials,
  owner,
  repo,
  { tagName, name = '', body = '', draft = false, prerelease = false, targetCommitish = '' },
) {
  const payload = { tag_name: tagName, name: name || tagName, body, draft, prerelease };
  if (targetCommitish) payload.target_commitish = targetCommitish;
  return githubFetch(`/repos/${owner}/${repo}/releases`, credentials.token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function forkRepo(credentials, owner, repo, organization = '') {
  const payload = organization ? { organization } : {};
  return githubFetch(`/repos/${owner}/${repo}/forks`, credentials.token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updatePullRequest(
  credentials,
  owner,
  repo,
  prNumber,
  { title, body, state, base } = {},
) {
  const payload = {};
  if (title !== undefined) payload.title = title;
  if (body !== undefined) payload.body = body;
  if (state !== undefined) payload.state = state;
  if (base !== undefined) payload.base = base;
  return githubFetch(`/repos/${owner}/${repo}/pulls/${prNumber}`, credentials.token, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function getLabels(credentials, owner, repo, perPage = 50) {
  return githubFetch(`/repos/${owner}/${repo}/labels?per_page=${perPage}`, credentials.token);
}

export async function createLabel(credentials, owner, repo, name, color, description = '') {
  return githubFetch(`/repos/${owner}/${repo}/labels`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({ name, color: color.replace('#', ''), description }),
  });
}

export async function deleteLabel(credentials, owner, repo, name) {
  return githubFetch(
    `/repos/${owner}/${repo}/labels/${encodeURIComponent(name)}`,
    credentials.token,
    { method: 'DELETE' },
  );
}

export async function searchUsers(credentials, query, perPage = 20) {
  return githubFetch(
    `/search/users?q=${encodeURIComponent(query)}&per_page=${perPage}`,
    credentials.token,
  );
}

export async function getUserStarred(credentials, username, perPage = 30) {
  return githubFetch(
    `/users/${username}/starred?per_page=${perPage}&sort=updated`,
    credentials.token,
  );
}

export async function getFileCommits(credentials, owner, repo, filePath, perPage = 15) {
  return githubFetch(
    `/repos/${owner}/${repo}/commits?path=${encodeURIComponent(filePath)}&per_page=${perPage}`,
    credentials.token,
  );
}

export async function lockIssue(credentials, owner, repo, issueNumber, lockReason = '') {
  const payload = lockReason ? { lock_reason: lockReason } : {};
  return githubFetch(`/repos/${owner}/${repo}/issues/${issueNumber}/lock`, credentials.token, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function unlockIssue(credentials, owner, repo, issueNumber) {
  return githubFetch(`/repos/${owner}/${repo}/issues/${issueNumber}/lock`, credentials.token, {
    method: 'DELETE',
  });
}

export async function getDeployments(credentials, owner, repo, perPage = 20) {
  return githubFetch(`/repos/${owner}/${repo}/deployments?per_page=${perPage}`, credentials.token);
}

export async function getRepoPermissions(credentials, owner, repo, username) {
  return githubFetch(
    `/repos/${owner}/${repo}/collaborators/${username}/permission`,
    credentials.token,
  );
}

export async function removeLabels(credentials, owner, repo, issueNumber, labels = []) {
  // GitHub removes labels one at a time; delete via the bulk endpoint
  return githubFetch(`/repos/${owner}/${repo}/issues/${issueNumber}/labels`, credentials.token, {
    method: 'PUT', // PUT replaces the full label set; we pass remaining labels
    body: JSON.stringify({ labels }),
  });
}

export async function getPRRequestedReviewers(credentials, owner, repo, prNumber) {
  return githubFetch(
    `/repos/${owner}/${repo}/pulls/${prNumber}/requested_reviewers`,
    credentials.token,
  );
}

export async function getRepoInfo(credentials, owner, repo) {
  return githubFetch(`/repos/${owner}/${repo}`, credentials.token);
}

export async function getOrgRepos(credentials, org, perPage = 30) {
  return githubFetch(`/orgs/${org}/repos?sort=updated&per_page=${perPage}`, credentials.token);
}

export async function watchRepo(credentials, owner, repo, subscribed = true) {
  if (!subscribed) {
    return githubFetch(`/repos/${owner}/${repo}/subscription`, credentials.token, {
      method: 'DELETE',
    });
  }
  return githubFetch(`/repos/${owner}/${repo}/subscription`, credentials.token, {
    method: 'PUT',
    body: JSON.stringify({ subscribed: true, ignored: false }),
  });
}

export async function getUserEvents(credentials, username, perPage = 20) {
  return githubFetch(`/users/${username}/events/public?per_page=${perPage}`, credentials.token);
}

export async function getRepoEnvironments(credentials, owner, repo) {
  return githubFetch(`/repos/${owner}/${repo}/environments`, credentials.token);
}

export async function listActionsSecrets(credentials, owner, repo) {
  return githubFetch(`/repos/${owner}/${repo}/actions/secrets`, credentials.token);
}

export async function getDependabotAlerts(credentials, owner, repo, state = 'open', perPage = 20) {
  return githubFetch(
    `/repos/${owner}/${repo}/dependabot/alerts?state=${state}&per_page=${perPage}`,
    credentials.token,
  );
}

export async function getCommitsSince(credentials, owner, repo, since, until = '', perPage = 20) {
  const qs = new URLSearchParams({ per_page: String(perPage) });
  if (since) qs.set('since', since);
  if (until) qs.set('until', until);
  return githubFetch(`/repos/${owner}/${repo}/commits?${qs.toString()}`, credentials.token);
}

export async function getBranchProtection(credentials, owner, repo, branch) {
  return githubFetch(
    `/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}/protection`,
    credentials.token,
  );
}

export async function getUserOrgs(credentials, username) {
  return githubFetch(`/users/${username}/orgs`, credentials.token);
}

export async function getTrafficClones(credentials, owner, repo) {
  return githubFetch(`/repos/${owner}/${repo}/traffic/clones`, credentials.token);
}

export async function getCommunityProfile(credentials, owner, repo) {
  return githubFetch(`/repos/${owner}/${repo}/community/profile`, credentials.token);
}

export async function getRepoWebhooks(credentials, owner, repo) {
  return githubFetch(`/repos/${owner}/${repo}/hooks`, credentials.token);
}

export async function getOrgMembers(credentials, org, perPage = 30) {
  return githubFetch(`/orgs/${org}/members?per_page=${perPage}`, credentials.token);
}

export async function listOrgTeams(credentials, org, perPage = 30) {
  return githubFetch(`/orgs/${org}/teams?per_page=${perPage}`, credentials.token);
}

export async function getTeamMembers(credentials, org, teamSlug, perPage = 30) {
  return githubFetch(
    `/orgs/${org}/teams/${teamSlug}/members?per_page=${perPage}`,
    credentials.token,
  );
}

export async function getIssueReactions(credentials, owner, repo, issueNumber) {
  return githubFetch(`/repos/${owner}/${repo}/issues/${issueNumber}/reactions`, credentials.token, {
    headers: { Accept: 'application/vnd.github.squirrel-girl-preview+json' },
  });
}

export async function getRepoLicense(credentials, owner, repo) {
  return githubFetch(`/repos/${owner}/${repo}/license`, credentials.token);
}

export async function getCodeFrequency(credentials, owner, repo) {
  return githubFetch(`/repos/${owner}/${repo}/stats/code_frequency`, credentials.token);
}

export async function getContributorStats(credentials, owner, repo) {
  return githubFetch(`/repos/${owner}/${repo}/stats/contributors`, credentials.token);
}

export async function getCommitActivity(credentials, owner, repo) {
  return githubFetch(`/repos/${owner}/${repo}/stats/commit_activity`, credentials.token);
}

export async function getPunchCard(credentials, owner, repo) {
  return githubFetch(`/repos/${owner}/${repo}/stats/punch_card`, credentials.token);
}

export async function getRepoSubscription(credentials, owner, repo) {
  return githubFetch(`/repos/${owner}/${repo}/subscription`, credentials.token);
}

export async function getUserFollowers(credentials, username, perPage = 30) {
  return githubFetch(`/users/${username}/followers?per_page=${perPage}`, credentials.token);
}

export async function getUserFollowing(credentials, username, perPage = 30) {
  return githubFetch(`/users/${username}/following?per_page=${perPage}`, credentials.token);
}

export async function getUserGists(credentials, username, perPage = 20) {
  return githubFetch(`/users/${username}/gists?per_page=${perPage}`, credentials.token);
}

export async function getGistDetails(credentials, gistId) {
  return githubFetch(`/gists/${gistId}`, credentials.token);
}

export async function getPRCommits(credentials, owner, repo, prNumber, perPage = 30) {
  return githubFetch(
    `/repos/${owner}/${repo}/pulls/${prNumber}/commits?per_page=${perPage}`,
    credentials.token,
  );
}

export async function getCommitStatuses(credentials, owner, repo, ref, perPage = 20) {
  return githubFetch(
    `/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}/statuses?per_page=${perPage}`,
    credentials.token,
  );
}

export async function getRepoPages(credentials, owner, repo) {
  return githubFetch(`/repos/${owner}/${repo}/pages`, credentials.token);
}

export async function getOrgInfo(credentials, org) {
  return githubFetch(`/orgs/${org}`, credentials.token);
}

export async function searchCommits(credentials, query, perPage = 20) {
  return githubFetch(
    `/search/commits?q=${encodeURIComponent(query)}&per_page=${perPage}`,
    credentials.token,
    { headers: { Accept: 'application/vnd.github.cloak-preview+json' } },
  );
}

export async function getDeploymentStatuses(credentials, owner, repo, deploymentId, perPage = 10) {
  return githubFetch(
    `/repos/${owner}/${repo}/deployments/${deploymentId}/statuses?per_page=${perPage}`,
    credentials.token,
  );
}

export async function getRepoInvitations(credentials, owner, repo) {
  return githubFetch(`/repos/${owner}/${repo}/invitations`, credentials.token);
}

export async function getRateLimit(credentials) {
  return githubFetch('/rate_limit', credentials.token);
}

export async function listWorkflows(credentials, owner, repo, perPage = 30) {
  return githubFetch(
    `/repos/${owner}/${repo}/actions/workflows?per_page=${perPage}`,
    credentials.token,
  );
}

export async function getWorkflowDetails(credentials, owner, repo, workflowId) {
  return githubFetch(`/repos/${owner}/${repo}/actions/workflows/${workflowId}`, credentials.token);
}

export async function getActionsRunners(credentials, owner, repo) {
  return githubFetch(`/repos/${owner}/${repo}/actions/runners`, credentials.token);
}

export async function getActionsVariables(credentials, owner, repo, perPage = 30) {
  return githubFetch(
    `/repos/${owner}/${repo}/actions/variables?per_page=${perPage}`,
    credentials.token,
  );
}

export async function getActionsCache(credentials, owner, repo, perPage = 30) {
  return githubFetch(
    `/repos/${owner}/${repo}/actions/caches?per_page=${perPage}`,
    credentials.token,
  );
}

export async function getTeamRepos(credentials, org, teamSlug, perPage = 30) {
  return githubFetch(`/orgs/${org}/teams/${teamSlug}/repos?per_page=${perPage}`, credentials.token);
}

export async function getUserRepos(credentials, username, perPage = 30) {
  return githubFetch(
    `/users/${username}/repos?sort=updated&per_page=${perPage}`,
    credentials.token,
  );
}

export async function getIssueTimeline(credentials, owner, repo, issueNumber, perPage = 30) {
  return githubFetch(
    `/repos/${owner}/${repo}/issues/${issueNumber}/timeline?per_page=${perPage}`,
    credentials.token,
    { headers: { Accept: 'application/vnd.github.mockingbird-preview+json' } },
  );
}

export async function getOrgSecrets(credentials, org, perPage = 30) {
  return githubFetch(`/orgs/${org}/actions/secrets?per_page=${perPage}`, credentials.token);
}

export async function getSingleComment(credentials, owner, repo, commentId) {
  return githubFetch(`/repos/${owner}/${repo}/issues/comments/${commentId}`, credentials.token);
}

export async function getRepoSecurityAdvisories(credentials, owner, repo, perPage = 20) {
  return githubFetch(
    `/repos/${owner}/${repo}/security-advisories?per_page=${perPage}`,
    credentials.token,
  );
}

export async function getPRReviewDetails(credentials, owner, repo, prNumber, reviewId) {
  return githubFetch(
    `/repos/${owner}/${repo}/pulls/${prNumber}/reviews/${reviewId}`,
    credentials.token,
  );
}

export async function getOrgVariables(credentials, org, perPage = 30) {
  return githubFetch(`/orgs/${org}/actions/variables?per_page=${perPage}`, credentials.token);
}

export async function getRepoAutolinks(credentials, owner, repo) {
  return githubFetch(`/repos/${owner}/${repo}/autolinks`, credentials.token);
}

export async function getCheckRunDetails(credentials, owner, repo, checkRunId) {
  return githubFetch(`/repos/${owner}/${repo}/check-runs/${checkRunId}`, credentials.token);
}

export async function createRepo(
  credentials,
  { name, description = '', private: isPrivate = false, autoInit = false },
) {
  return githubFetch('/user/repos', credentials.token, {
    method: 'POST',
    body: JSON.stringify({ name, description, private: isPrivate, auto_init: autoInit }),
  });
}

export async function updateRepo(credentials, owner, repo, payload = {}) {
  return githubFetch(`/repos/${owner}/${repo}`, credentials.token, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteRepo(credentials, owner, repo) {
  return githubFetch(`/repos/${owner}/${repo}`, credentials.token, { method: 'DELETE' });
}

export async function getRepoContents(credentials, owner, repo, path = '', ref = '') {
  const qs = ref ? `?ref=${encodeURIComponent(ref)}` : '';
  return githubFetch(
    `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}${qs}`,
    credentials.token,
  );
}

export async function createOrUpdateFile(
  credentials,
  owner,
  repo,
  filePath,
  { message, content, sha = '', branch = '' },
) {
  const payload = { message, content };
  if (sha) payload.sha = sha;
  if (branch) payload.branch = branch;
  return githubFetch(`/repos/${owner}/${repo}/contents/${filePath}`, credentials.token, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteFile(
  credentials,
  owner,
  repo,
  filePath,
  { message, sha, branch = '' },
) {
  const payload = { message, sha };
  if (branch) payload.branch = branch;
  return githubFetch(`/repos/${owner}/${repo}/contents/${filePath}`, credentials.token, {
    method: 'DELETE',
    body: JSON.stringify(payload),
  });
}

export async function getCommitComments(credentials, owner, repo, sha, perPage = 20) {
  return githubFetch(
    `/repos/${owner}/${repo}/commits/${sha}/comments?per_page=${perPage}`,
    credentials.token,
  );
}

export async function createCommitComment(
  credentials,
  owner,
  repo,
  sha,
  body,
  path = '',
  position = null,
) {
  const payload = { body };
  if (path) payload.path = path;
  if (position !== null) payload.position = position;
  return githubFetch(`/repos/${owner}/${repo}/commits/${sha}/comments`, credentials.token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function dismissPRReview(credentials, owner, repo, prNumber, reviewId, message) {
  return githubFetch(
    `/repos/${owner}/${repo}/pulls/${prNumber}/reviews/${reviewId}/dismissals`,
    credentials.token,
    {
      method: 'PUT',
      body: JSON.stringify({ message }),
    },
  );
}

export async function cancelWorkflowRun(credentials, owner, repo, runId) {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/cancel`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  );
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return null;
}

export async function rerunWorkflowRun(credentials, owner, repo, runId) {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/rerun`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  );
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return null;
}

export async function listWorkflowRunArtifacts(credentials, owner, repo, runId, perPage = 20) {
  return githubFetch(
    `/repos/${owner}/${repo}/actions/runs/${runId}/artifacts?per_page=${perPage}`,
    credentials.token,
  );
}

export async function checkIfStarred(credentials, owner, repo) {
  const res = await fetch(`https://api.github.com/user/starred/${owner}/${repo}`, {
    headers: {
      Authorization: `Bearer ${credentials.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  return res.status === 204;
}

export async function followUser(credentials, username) {
  return githubFetch(`/user/following/${username}`, credentials.token, { method: 'PUT' });
}

export async function unfollowUser(credentials, username) {
  return githubFetch(`/user/following/${username}`, credentials.token, { method: 'DELETE' });
}

export async function getIssueEvents(credentials, owner, repo, issueNumber, perPage = 30) {
  return githubFetch(
    `/repos/${owner}/${repo}/issues/${issueNumber}/events?per_page=${perPage}`,
    credentials.token,
  );
}

export async function updateGist(credentials, gistId, { description, files } = {}) {
  const payload = {};
  if (description !== undefined) payload.description = description;
  if (files !== undefined) payload.files = files;
  return githubFetch(`/gists/${gistId}`, credentials.token, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteGist(credentials, gistId) {
  return githubFetch(`/gists/${gistId}`, credentials.token, { method: 'DELETE' });
}

export async function transferIssue(credentials, owner, repo, issueNumber, newOwner) {
  return githubFetch(`/repos/${owner}/${repo}/issues/${issueNumber}/transfer`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({ new_owner: newOwner }),
  });
}

export async function replaceTopics(credentials, owner, repo, names = []) {
  return githubFetch(`/repos/${owner}/${repo}/topics`, credentials.token, {
    method: 'PUT',
    headers: { Accept: 'application/vnd.github.mercy-preview+json' },
    body: JSON.stringify({ names }),
  });
}

export async function getAuthenticatedUser(credentials) {
  return githubFetch('/user', credentials.token);
}

export async function updateIssueComment(credentials, owner, repo, commentId, body) {
  return githubFetch(`/repos/${owner}/${repo}/issues/comments/${commentId}`, credentials.token, {
    method: 'PATCH',
    body: JSON.stringify({ body }),
  });
}

export async function deleteIssueComment(credentials, owner, repo, commentId) {
  return githubFetch(`/repos/${owner}/${repo}/issues/comments/${commentId}`, credentials.token, {
    method: 'DELETE',
  });
}

export async function addReactionToIssue(credentials, owner, repo, issueNumber, content) {
  return githubFetch(`/repos/${owner}/${repo}/issues/${issueNumber}/reactions`, credentials.token, {
    method: 'POST',
    headers: { Accept: 'application/vnd.github.squirrel-girl-preview+json' },
    body: JSON.stringify({ content }),
  });
}

export async function addReactionToComment(credentials, owner, repo, commentId, content) {
  return githubFetch(
    `/repos/${owner}/${repo}/issues/comments/${commentId}/reactions`,
    credentials.token,
    {
      method: 'POST',
      headers: { Accept: 'application/vnd.github.squirrel-girl-preview+json' },
      body: JSON.stringify({ content }),
    },
  );
}

export async function getCodeScanningAlerts(
  credentials,
  owner,
  repo,
  state = 'open',
  perPage = 20,
) {
  return githubFetch(
    `/repos/${owner}/${repo}/code-scanning/alerts?state=${state}&per_page=${perPage}`,
    credentials.token,
  );
}

export async function getSecretScanningAlerts(
  credentials,
  owner,
  repo,
  state = 'open',
  perPage = 20,
) {
  return githubFetch(
    `/repos/${owner}/${repo}/secret-scanning/alerts?state=${state}&per_page=${perPage}`,
    credentials.token,
  );
}

export async function deleteWorkflowRun(credentials, owner, repo, runId) {
  return githubFetch(`/repos/${owner}/${repo}/actions/runs/${runId}`, credentials.token, {
    method: 'DELETE',
  });
}

export async function getWorkflowRunJobs(
  credentials,
  owner,
  repo,
  runId,
  filter = 'latest',
  perPage = 30,
) {
  return githubFetch(
    `/repos/${owner}/${repo}/actions/runs/${runId}/jobs?filter=${filter}&per_page=${perPage}`,
    credentials.token,
  );
}

export async function checkTeamMembership(credentials, org, teamSlug, username) {
  return githubFetch(`/orgs/${org}/teams/${teamSlug}/memberships/${username}`, credentials.token);
}

export async function listGistComments(credentials, gistId, perPage = 30) {
  return githubFetch(`/gists/${gistId}/comments?per_page=${perPage}`, credentials.token);
}

export async function createGistComment(credentials, gistId, body) {
  return githubFetch(`/gists/${gistId}/comments`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

export async function getRepoActionsPermissions(credentials, owner, repo) {
  return githubFetch(`/repos/${owner}/${repo}/actions/permissions`, credentials.token);
}

export async function getOrgWebhooks(credentials, org, perPage = 30) {
  return githubFetch(`/orgs/${org}/hooks?per_page=${perPage}`, credentials.token);
}

export async function listUserRepoInvitations(credentials) {
  return githubFetch('/user/repository_invitations', credentials.token);
}

export async function acceptRepoInvitation(credentials, invitationId) {
  return githubFetch(`/user/repository_invitations/${invitationId}`, credentials.token, {
    method: 'PATCH',
  });
}

export async function declineRepoInvitation(credentials, invitationId) {
  return githubFetch(`/user/repository_invitations/${invitationId}`, credentials.token, {
    method: 'DELETE',
  });
}

export async function getUserPublicKeys(credentials, username) {
  return githubFetch(`/users/${username}/keys`, credentials.token);
}

export async function starGist(credentials, gistId) {
  return githubFetch(`/gists/${gistId}/star`, credentials.token, {
    method: 'PUT',
    headers: { 'Content-Length': '0' },
  });
}

export async function unstarGist(credentials, gistId) {
  return githubFetch(`/gists/${gistId}/star`, credentials.token, { method: 'DELETE' });
}

export async function checkGistStarred(credentials, gistId) {
  const res = await fetch(`https://api.github.com/gists/${gistId}/star`, {
    headers: {
      Authorization: `Bearer ${credentials.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  return res.status === 204;
}

export async function getTrafficReferrers(credentials, owner, repo) {
  return githubFetch(`/repos/${owner}/${repo}/traffic/popular/referrers`, credentials.token);
}

export async function getTrafficPaths(credentials, owner, repo) {
  return githubFetch(`/repos/${owner}/${repo}/traffic/popular/paths`, credentials.token);
}

export async function listGitRefs(credentials, owner, repo, namespace = '') {
  const path = namespace
    ? `/repos/${owner}/${repo}/git/refs/${namespace}`
    : `/repos/${owner}/${repo}/git/refs`;
  return githubFetch(path, credentials.token);
}

export async function getGitRef(credentials, owner, repo, ref) {
  return githubFetch(`/repos/${owner}/${repo}/git/ref/${ref}`, credentials.token);
}

export async function listCommitPullRequests(credentials, owner, repo, commitSha, perPage = 20) {
  return githubFetch(
    `/repos/${owner}/${repo}/commits/${commitSha}/pulls?per_page=${perPage}`,
    credentials.token,
    { headers: { Accept: 'application/vnd.github.groot-preview+json' } },
  );
}

export async function updateMilestone(credentials, owner, repo, milestoneNumber, payload = {}) {
  return githubFetch(`/repos/${owner}/${repo}/milestones/${milestoneNumber}`, credentials.token, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteMilestone(credentials, owner, repo, milestoneNumber) {
  return githubFetch(`/repos/${owner}/${repo}/milestones/${milestoneNumber}`, credentials.token, {
    method: 'DELETE',
  });
}

export async function enableVulnerabilityAlerts(credentials, owner, repo) {
  return githubFetch(`/repos/${owner}/${repo}/vulnerability-alerts`, credentials.token, {
    method: 'PUT',
    headers: { Accept: 'application/vnd.github.dorian-preview+json' },
  });
}

export async function disableVulnerabilityAlerts(credentials, owner, repo) {
  return githubFetch(`/repos/${owner}/${repo}/vulnerability-alerts`, credentials.token, {
    method: 'DELETE',
    headers: { Accept: 'application/vnd.github.dorian-preview+json' },
  });
}

export async function checkVulnerabilityAlerts(credentials, owner, repo) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/vulnerability-alerts`, {
    headers: {
      Authorization: `Bearer ${credentials.token}`,
      Accept: 'application/vnd.github.dorian-preview+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  return res.status === 204;
}

export async function createRepoWebhook(
  credentials,
  owner,
  repo,
  { url, events = ['push'], contentType = 'json', secret = '', insecureSsl = false, active = true },
) {
  return githubFetch(`/repos/${owner}/${repo}/hooks`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({
      name: 'web',
      active,
      events,
      config: {
        url,
        content_type: contentType,
        secret: secret || undefined,
        insecure_ssl: insecureSsl ? '1' : '0',
      },
    }),
  });
}

export async function deleteRepoWebhook(credentials, owner, repo, hookId) {
  return githubFetch(`/repos/${owner}/${repo}/hooks/${hookId}`, credentials.token, {
    method: 'DELETE',
  });
}

export async function listCheckSuites(credentials, owner, repo, ref, perPage = 20) {
  return githubFetch(
    `/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}/check-suites?per_page=${perPage}`,
    credentials.token,
  );
}

export async function rerequestCheckSuite(credentials, owner, repo, checkSuiteId) {
  return githubFetch(
    `/repos/${owner}/${repo}/check-suites/${checkSuiteId}/rerequest`,
    credentials.token,
    { method: 'POST' },
  );
}

export async function listGistForks(credentials, gistId, perPage = 20) {
  return githubFetch(`/gists/${gistId}/forks?per_page=${perPage}`, credentials.token);
}

export async function forkGist(credentials, gistId) {
  return githubFetch(`/gists/${gistId}/forks`, credentials.token, { method: 'POST' });
}

export async function getWorkflowRunUsage(credentials, owner, repo, runId) {
  return githubFetch(`/repos/${owner}/${repo}/actions/runs/${runId}/timing`, credentials.token);
}

export async function addCollaborator(credentials, owner, repo, username, permission = 'push') {
  return githubFetch(`/repos/${owner}/${repo}/collaborators/${username}`, credentials.token, {
    method: 'PUT',
    body: JSON.stringify({ permission }),
  });
}

export async function removeCollaborator(credentials, owner, repo, username) {
  return githubFetch(`/repos/${owner}/${repo}/collaborators/${username}`, credentials.token, {
    method: 'DELETE',
  });
}

export async function setIssueMilestone(credentials, owner, repo, issueNumber, milestoneNumber) {
  return githubFetch(`/repos/${owner}/${repo}/issues/${issueNumber}`, credentials.token, {
    method: 'PATCH',
    body: JSON.stringify({ milestone: milestoneNumber }),
  });
}

export async function getAssignableUsers(credentials, owner, repo, perPage = 30) {
  return githubFetch(`/repos/${owner}/${repo}/assignees?per_page=${perPage}`, credentials.token);
}

export async function checkUserAssignable(credentials, owner, repo, assignee) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/assignees/${assignee}`, {
    headers: {
      Authorization: `Bearer ${credentials.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  return res.status === 204;
}

export async function transferRepo(credentials, owner, repo, newOwner, teamIds = []) {
  return githubFetch(`/repos/${owner}/${repo}/transfer`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({ new_owner: newOwner, team_ids: teamIds }),
  });
}

export async function archiveRepo(credentials, owner, repo, archive = true) {
  return githubFetch(`/repos/${owner}/${repo}`, credentials.token, {
    method: 'PATCH',
    body: JSON.stringify({ archived: archive }),
  });
}

export async function generateReleaseNotes(
  credentials,
  owner,
  repo,
  tagName,
  previousTagName = '',
  targetCommitish = '',
) {
  const payload = { tag_name: tagName };
  if (previousTagName) payload.previous_tag_name = previousTagName;
  if (targetCommitish) payload.target_commitish = targetCommitish;
  return githubFetch(`/repos/${owner}/${repo}/releases/generate-notes`, credentials.token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getCheckSuite(credentials, owner, repo, checkSuiteId) {
  return githubFetch(`/repos/${owner}/${repo}/check-suites/${checkSuiteId}`, credentials.token);
}

export async function listRepoEvents(credentials, owner, repo, perPage = 20) {
  return githubFetch(`/repos/${owner}/${repo}/events?per_page=${perPage}`, credentials.token);
}

export async function getStargazersWithDates(credentials, owner, repo, perPage = 30) {
  return githubFetch(`/repos/${owner}/${repo}/stargazers?per_page=${perPage}`, credentials.token, {
    headers: { Accept: 'application/vnd.github.star+json' },
  });
}

export async function listCommentReactions(credentials, owner, repo, commentId, perPage = 30) {
  return githubFetch(
    `/repos/${owner}/${repo}/issues/comments/${commentId}/reactions?per_page=${perPage}`,
    credentials.token,
    { headers: { Accept: 'application/vnd.github.squirrel-girl-preview+json' } },
  );
}

export async function getGitCommitObject(credentials, owner, repo, sha) {
  return githubFetch(`/repos/${owner}/${repo}/git/commits/${sha}`, credentials.token);
}

export async function checkUserFollowing(credentials, username) {
  const res = await fetch(`https://api.github.com/user/following/${username}`, {
    headers: {
      Authorization: `Bearer ${credentials.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  return res.status === 204;
}

export async function getGitTreeObject(credentials, owner, repo, sha, recursive = false) {
  const qs = recursive ? '?recursive=1' : '';
  return githubFetch(`/repos/${owner}/${repo}/git/trees/${sha}${qs}`, credentials.token);
}

export async function getGitBlob(credentials, owner, repo, sha) {
  return githubFetch(`/repos/${owner}/${repo}/git/blobs/${sha}`, credentials.token);
}

export async function getGitHubMeta() {
  const res = await fetch('https://api.github.com/meta', {
    headers: { 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return res.json();
}

export async function getCodeownersErrors(credentials, owner, repo, ref = '') {
  const qs = ref ? `?ref=${encodeURIComponent(ref)}` : '';
  return githubFetch(`/repos/${owner}/${repo}/codeowners/errors${qs}`, credentials.token);
}

export async function removeAssignees(credentials, owner, repo, issueNumber, assignees = []) {
  return githubFetch(`/repos/${owner}/${repo}/issues/${issueNumber}/assignees`, credentials.token, {
    method: 'DELETE',
    body: JSON.stringify({ assignees }),
  });
}

export async function getReadmeAtPath(credentials, owner, repo, dirPath = '', ref = '') {
  const qs = ref ? `?ref=${encodeURIComponent(ref)}` : '';
  const path = dirPath ? `/${encodeURIComponent(dirPath)}` : '';
  return githubFetch(`/repos/${owner}/${repo}/readme${path}${qs}`, credentials.token);
}

export async function createTag(
  credentials,
  owner,
  repo,
  { tag, message, object, type = 'commit', tagger },
) {
  const payload = { tag, message, object, type };
  if (tagger) payload.tagger = tagger;
  return githubFetch(`/repos/${owner}/${repo}/git/tags`, credentials.token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deleteReaction(credentials, owner, repo, issueNumber, reactionId) {
  return githubFetch(
    `/repos/${owner}/${repo}/issues/${issueNumber}/reactions/${reactionId}`,
    credentials.token,
    { method: 'DELETE' },
  );
}

export async function getLatestPagesBuild(credentials, owner, repo) {
  return githubFetch(`/repos/${owner}/${repo}/pages/builds/latest`, credentials.token);
}
