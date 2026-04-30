async function githubFetch(endpoint, token, options = {}) {
  const res = await fetch(`https://api.github.com${endpoint}`, {
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
    throw new Error(`GitHub API ${res.status} on ${endpoint}: ${err?.message ?? 'Unknown error'}`);
  }
  return 204 === res.status ? null : res.json();
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
    try {
      return await tryBranch('master');
    } catch {
      // Neither 'main' nor 'master' exists — fetch the repo's actual default branch
      const repoInfo = await githubFetch(`/repos/${owner}/${repo}`, credentials.token);
      const defaultBranch = repoInfo?.default_branch;
      if (!defaultBranch || defaultBranch === 'main' || defaultBranch === 'master')
        throw new Error(`Repository ${owner}/${repo} tree not found.`);
      return tryBranch(defaultBranch);
    }
  }
}
export async function getFileContent(credentials, owner, repo, filePath) {
  const data = await githubFetch(`/repos/${owner}/${repo}/contents/${filePath}`, credentials.token);
  if (Array.isArray(data)) throw new Error(`"${filePath}" is a directory, not a file.`);
  const content =
    'base64' === data.encoding
      ? Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8')
      : data.content;
  return {
    path: data.path,
    name: data.name,
    content: content,
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
export async function getNotifications(credentials, unreadOnly = !0) {
  return githubFetch(`/notifications?all=${!unreadOnly}`, credentials.token);
}
export async function getBranches(credentials, owner, repo) {
  return githubFetch(`/repos/${owner}/${repo}/branches`, credentials.token);
}
export async function createIssue(credentials, owner, repo, title, body, labels = []) {
  return githubFetch(`/repos/${owner}/${repo}/issues`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({ title: title, body: body, labels: labels }),
  });
}
export async function searchCode(credentials, query, scope) {
  return githubFetch(
    `/search/code?q=${encodeURIComponent(scope ? `${query} repo:${scope}` : query)}`,
    credentials.token,
    { headers: { Accept: 'application/vnd.github.text-match+json' } },
  );
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
  { body: body, event: event = 'COMMENT', comments: comments = [] },
) {
  return githubFetch(`/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({ body: body, event: event, comments: comments }),
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
  const pr = await getPRDetails(credentials, owner, repo, prNumber),
    sha = pr?.head?.sha;
  if (!sha) throw new Error(`PR #${prNumber} has no head SHA.`);
  const [combinedStatus, checkRuns] = await Promise.all([
    githubFetch(`/repos/${owner}/${repo}/commits/${sha}/status`, credentials.token).catch(
      () => null,
    ),
    githubFetch(`/repos/${owner}/${repo}/commits/${sha}/check-runs`, credentials.token).catch(
      () => null,
    ),
  ]);
  return {
    prNumber: prNumber,
    sha: sha,
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
  { branch: branch = '', event: event = '', perPage: perPage = 20 } = {},
) {
  const qs = new URLSearchParams({ per_page: String(perPage || 20) });
  return (
    branch && qs.set('branch', branch),
    event && qs.set('event', event),
    githubFetch(`/repos/${owner}/${repo}/actions/runs?${qs.toString()}`, credentials.token)
  );
}
export async function starRepo(credentials, owner, repo) {
  return githubFetch(`/user/starred/${owner}/${repo}`, credentials.token, {
    method: 'PUT',
    headers: { 'Content-Length': '0' },
  });
}
export async function unstarRepo(credentials, owner, repo) {
  return githubFetch(`/user/starred/${owner}/${repo}`, credentials.token, { method: 'DELETE' });
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
  { title: title, body: body = '', head: head, base: base, draft: draft = !1 },
) {
  if (!head || !base) throw new Error('createPR: head and base branches are required');
  return githubFetch(`/repos/${owner}/${repo}/pulls`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({ title: title, body: body, head: head, base: base, draft: draft }),
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
    body: JSON.stringify({ body: body }),
  });
}
export async function addLabels(credentials, owner, repo, issueNumber, labels = []) {
  return githubFetch(`/repos/${owner}/${repo}/issues/${issueNumber}/labels`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({ labels: labels }),
  });
}
export async function addAssignees(credentials, owner, repo, issueNumber, assignees = []) {
  return githubFetch(`/repos/${owner}/${repo}/issues/${issueNumber}/assignees`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({ assignees: assignees }),
  });
}
export async function markAllNotificationsRead(credentials) {
  return githubFetch('/notifications', credentials.token, {
    method: 'PUT',
    body: JSON.stringify({ read: !0 }),
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
    { method: 'POST', body: JSON.stringify({ ref: ref, inputs: inputs }) },
  );
}
export async function getLatestWorkflowRun(credentials, owner, repo, workflowId, branch = '') {
  const qs = new URLSearchParams({ per_page: '1' });
  branch && qs.set('branch', branch);
  const data = await githubFetch(
    `/repos/${owner}/${repo}/actions/workflows/${workflowId}/runs?${qs}`,
    credentials.token,
  );
  return data.workflow_runs?.[0] ?? null;
}
export async function createGist(credentials, description, files, isPublic = !1) {
  return githubFetch('/gists', credentials.token, {
    method: 'POST',
    body: JSON.stringify({ description: description, files: files, public: isPublic }),
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
  { title: title, body: body, state: state, labels: labels, assignees: assignees } = {},
) {
  const payload = {};
  return (
    void 0 !== title && (payload.title = title),
    void 0 !== body && (payload.body = body),
    void 0 !== state && (payload.state = state),
    void 0 !== labels && (payload.labels = labels),
    void 0 !== assignees && (payload.assignees = assignees),
    githubFetch(`/repos/${owner}/${repo}/issues/${issueNumber}`, credentials.token, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  );
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
  const payload = { title: title };
  return (
    description && (payload.description = description),
    dueOn && (payload.due_on = dueOn),
    githubFetch(`/repos/${owner}/${repo}/milestones`, credentials.token, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  );
}
export async function createBranch(credentials, owner, repo, branchName, sha) {
  return githubFetch(`/repos/${owner}/${repo}/git/refs`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: sha }),
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
      body: JSON.stringify({ reviewers: reviewers, team_reviewers: teamReviewers }),
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
  {
    tagName: tagName,
    name: name = '',
    body: body = '',
    draft: draft = !1,
    prerelease: prerelease = !1,
    targetCommitish: targetCommitish = '',
  },
) {
  const payload = {
    tag_name: tagName,
    name: name || tagName,
    body: body,
    draft: draft,
    prerelease: prerelease,
  };
  return (
    targetCommitish && (payload.target_commitish = targetCommitish),
    githubFetch(`/repos/${owner}/${repo}/releases`, credentials.token, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  );
}
export async function forkRepo(credentials, owner, repo, organization = '') {
  const payload = organization ? { organization: organization } : {};
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
  { title: title, body: body, state: state, base: base } = {},
) {
  const payload = {};
  return (
    void 0 !== title && (payload.title = title),
    void 0 !== body && (payload.body = body),
    void 0 !== state && (payload.state = state),
    void 0 !== base && (payload.base = base),
    githubFetch(`/repos/${owner}/${repo}/pulls/${prNumber}`, credentials.token, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  );
}
export async function getLabels(credentials, owner, repo, perPage = 50) {
  return githubFetch(`/repos/${owner}/${repo}/labels?per_page=${perPage}`, credentials.token);
}
export async function createLabel(credentials, owner, repo, name, color, description = '') {
  return githubFetch(`/repos/${owner}/${repo}/labels`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({ name: name, color: color.replace('#', ''), description: description }),
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
  return githubFetch(`/repos/${owner}/${repo}/issues/${issueNumber}/labels`, credentials.token, {
    method: 'PUT',
    body: JSON.stringify({ labels: labels }),
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
export async function watchRepo(credentials, owner, repo, subscribed = !0) {
  return githubFetch(
    `/repos/${owner}/${repo}/subscription`,
    credentials.token,
    subscribed
      ? { method: 'PUT', body: JSON.stringify({ subscribed: !0, ignored: !1 }) }
      : { method: 'DELETE' },
  );
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
  return (
    since && qs.set('since', since),
    until && qs.set('until', until),
    githubFetch(`/repos/${owner}/${repo}/commits?${qs.toString()}`, credentials.token)
  );
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
  { name: name, description: description = '', private: isPrivate = !1, autoInit: autoInit = !1 },
) {
  return githubFetch('/user/repos', credentials.token, {
    method: 'POST',
    body: JSON.stringify({
      name: name,
      description: description,
      private: isPrivate,
      auto_init: autoInit,
    }),
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
  { message: message, content: content, sha: sha = '', branch: branch = '' },
) {
  const payload = { message: message, content: content };
  return (
    sha && (payload.sha = sha),
    branch && (payload.branch = branch),
    githubFetch(`/repos/${owner}/${repo}/contents/${filePath}`, credentials.token, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  );
}
export async function deleteFile(
  credentials,
  owner,
  repo,
  filePath,
  { message: message, sha: sha, branch: branch = '' },
) {
  const payload = { message: message, sha: sha };
  return (
    branch && (payload.branch = branch),
    githubFetch(`/repos/${owner}/${repo}/contents/${filePath}`, credentials.token, {
      method: 'DELETE',
      body: JSON.stringify(payload),
    })
  );
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
  const payload = { body: body };
  return (
    path && (payload.path = path),
    null !== position && (payload.position = position),
    githubFetch(`/repos/${owner}/${repo}/commits/${sha}/comments`, credentials.token, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  );
}
export async function dismissPRReview(credentials, owner, repo, prNumber, reviewId, message) {
  return githubFetch(
    `/repos/${owner}/${repo}/pulls/${prNumber}/reviews/${reviewId}/dismissals`,
    credentials.token,
    { method: 'PUT', body: JSON.stringify({ message: message }) },
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
  return (
    204 ===
    (
      await fetch(`https://api.github.com/user/starred/${owner}/${repo}`, {
        headers: {
          Authorization: `Bearer ${credentials.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      })
    ).status
  );
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
export async function updateGist(
  credentials,
  gistId,
  { description: description, files: files } = {},
) {
  const payload = {};
  return (
    void 0 !== description && (payload.description = description),
    void 0 !== files && (payload.files = files),
    githubFetch(`/gists/${gistId}`, credentials.token, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  );
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
    body: JSON.stringify({ names: names }),
  });
}
export async function getAuthenticatedUser(credentials) {
  return githubFetch('/user', credentials.token);
}
export async function updateIssueComment(credentials, owner, repo, commentId, body) {
  return githubFetch(`/repos/${owner}/${repo}/issues/comments/${commentId}`, credentials.token, {
    method: 'PATCH',
    body: JSON.stringify({ body: body }),
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
    body: JSON.stringify({ content: content }),
  });
}
export async function addReactionToComment(credentials, owner, repo, commentId, content) {
  return githubFetch(
    `/repos/${owner}/${repo}/issues/comments/${commentId}/reactions`,
    credentials.token,
    {
      method: 'POST',
      headers: { Accept: 'application/vnd.github.squirrel-girl-preview+json' },
      body: JSON.stringify({ content: content }),
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
    body: JSON.stringify({ body: body }),
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
  return (
    204 ===
    (
      await fetch(`https://api.github.com/gists/${gistId}/star`, {
        headers: {
          Authorization: `Bearer ${credentials.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      })
    ).status
  );
}
export async function getTrafficReferrers(credentials, owner, repo) {
  return githubFetch(`/repos/${owner}/${repo}/traffic/popular/referrers`, credentials.token);
}
export async function getTrafficPaths(credentials, owner, repo) {
  return githubFetch(`/repos/${owner}/${repo}/traffic/popular/paths`, credentials.token);
}
export async function listGitRefs(credentials, owner, repo, namespace = '') {
  return githubFetch(
    namespace
      ? `/repos/${owner}/${repo}/git/refs/${namespace}`
      : `/repos/${owner}/${repo}/git/refs`,
    credentials.token,
  );
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
  return (
    204 ===
    (
      await fetch(`https://api.github.com/repos/${owner}/${repo}/vulnerability-alerts`, {
        headers: {
          Authorization: `Bearer ${credentials.token}`,
          Accept: 'application/vnd.github.dorian-preview+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      })
    ).status
  );
}
export async function createRepoWebhook(
  credentials,
  owner,
  repo,
  {
    url: url,
    events: events = ['push'],
    contentType: contentType = 'json',
    secret: secret = '',
    insecureSsl: insecureSsl = !1,
    active: active = !0,
  },
) {
  return githubFetch(`/repos/${owner}/${repo}/hooks`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({
      name: 'web',
      active: active,
      events: events,
      config: {
        url: url,
        content_type: contentType,
        secret: secret || void 0,
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
    body: JSON.stringify({ permission: permission }),
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
  return (
    204 ===
    (
      await fetch(`https://api.github.com/repos/${owner}/${repo}/assignees/${assignee}`, {
        headers: {
          Authorization: `Bearer ${credentials.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      })
    ).status
  );
}
export async function transferRepo(credentials, owner, repo, newOwner, teamIds = []) {
  return githubFetch(`/repos/${owner}/${repo}/transfer`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({ new_owner: newOwner, team_ids: teamIds }),
  });
}
export async function archiveRepo(credentials, owner, repo, archive = !0) {
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
  return (
    previousTagName && (payload.previous_tag_name = previousTagName),
    targetCommitish && (payload.target_commitish = targetCommitish),
    githubFetch(`/repos/${owner}/${repo}/releases/generate-notes`, credentials.token, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  );
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
  return (
    204 ===
    (
      await fetch(`https://api.github.com/user/following/${username}`, {
        headers: {
          Authorization: `Bearer ${credentials.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      })
    ).status
  );
}
export async function getGitTreeObject(credentials, owner, repo, sha, recursive = !1) {
  return githubFetch(
    `/repos/${owner}/${repo}/git/trees/${sha}${recursive ? '?recursive=1' : ''}`,
    credentials.token,
  );
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
  return githubFetch(
    `/repos/${owner}/${repo}/codeowners/errors${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`,
    credentials.token,
  );
}
export async function removeAssignees(credentials, owner, repo, issueNumber, assignees = []) {
  return githubFetch(`/repos/${owner}/${repo}/issues/${issueNumber}/assignees`, credentials.token, {
    method: 'DELETE',
    body: JSON.stringify({ assignees: assignees }),
  });
}
export async function getReadmeAtPath(credentials, owner, repo, dirPath = '', ref = '') {
  const qs = ref ? `?ref=${encodeURIComponent(ref)}` : '';
  return githubFetch(
    `/repos/${owner}/${repo}/readme${dirPath ? `/${encodeURIComponent(dirPath)}` : ''}${qs}`,
    credentials.token,
  );
}
export async function createTag(
  credentials,
  owner,
  repo,
  { tag: tag, message: message, object: object, type: type = 'commit', tagger: tagger },
) {
  const payload = { tag: tag, message: message, object: object, type: type };
  return (
    tagger && (payload.tagger = tagger),
    githubFetch(`/repos/${owner}/${repo}/git/tags`, credentials.token, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  );
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
export async function getUserPackages(credentials, username, packageType = '', perPage = 30) {
  return githubFetch(
    `/users/${username}/packages${packageType ? `?package_type=${packageType}&per_page=${perPage}` : `?per_page=${perPage}`}`,
    credentials.token,
  );
}
export async function getPackageVersions(
  credentials,
  username,
  packageType,
  packageName,
  perPage = 20,
) {
  return githubFetch(
    `/users/${username}/packages/${packageType}/${encodeURIComponent(packageName)}/versions?per_page=${perPage}`,
    credentials.token,
  );
}
export async function createDeployment(
  credentials,
  owner,
  repo,
  {
    ref: ref,
    task: task = 'deploy',
    autoMerge: autoMerge = !1,
    requiredContexts: requiredContexts,
    payload: payload = '',
    description: description = '',
    environment: environment = 'production',
    transientEnvironment: transientEnvironment = !1,
    productionEnvironment: productionEnvironment = !0,
  },
) {
  const body = {
    ref: ref,
    task: task,
    auto_merge: autoMerge,
    description: description,
    environment: environment,
    transient_environment: transientEnvironment,
    production_environment: productionEnvironment,
  };
  return (
    payload && (body.payload = payload),
    void 0 !== requiredContexts && (body.required_contexts = requiredContexts),
    githubFetch(`/repos/${owner}/${repo}/deployments`, credentials.token, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  );
}
export async function createDeploymentStatus(
  credentials,
  owner,
  repo,
  deploymentId,
  {
    state: state,
    logUrl: logUrl = '',
    description: description = '',
    environment: environment = '',
    environmentUrl: environmentUrl = '',
    autoInactive: autoInactive = !0,
  },
) {
  const body = { state: state, auto_inactive: autoInactive };
  return (
    logUrl && (body.log_url = logUrl),
    description && (body.description = description),
    environment && (body.environment = environment),
    environmentUrl && (body.environment_url = environmentUrl),
    githubFetch(`/repos/${owner}/${repo}/deployments/${deploymentId}/statuses`, credentials.token, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  );
}
export async function triggerRepoDispatch(credentials, owner, repo, eventType, clientPayload = {}) {
  return githubFetch(`/repos/${owner}/${repo}/dispatches`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({ event_type: eventType, client_payload: clientPayload }),
  });
}
export async function getGitTagObject(credentials, owner, repo, tagSha) {
  return githubFetch(`/repos/${owner}/${repo}/git/tags/${tagSha}`, credentials.token);
}
export async function listCheckRunAnnotations(credentials, owner, repo, checkRunId, perPage = 50) {
  return githubFetch(
    `/repos/${owner}/${repo}/check-runs/${checkRunId}/annotations?per_page=${perPage}`,
    credentials.token,
  );
}
export async function getCombinedStatus(credentials, owner, repo, ref) {
  return githubFetch(
    `/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}/status`,
    credentials.token,
  );
}
export async function listMatchingRefs(credentials, owner, repo, refPattern) {
  return githubFetch(
    `/repos/${owner}/${repo}/git/matching-refs/${encodeURIComponent(refPattern)}`,
    credentials.token,
  );
}
export async function updateGitRef(credentials, owner, repo, ref, sha, force = !1) {
  return githubFetch(`/repos/${owner}/${repo}/git/refs/${ref}`, credentials.token, {
    method: 'PATCH',
    body: JSON.stringify({ sha: sha, force: force }),
  });
}
export async function createGitRef(credentials, owner, repo, ref, sha) {
  return githubFetch(`/repos/${owner}/${repo}/git/refs`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({ ref: ref, sha: sha }),
  });
}
export async function listRepoReviewComments(
  credentials,
  owner,
  repo,
  sort = 'created',
  direction = 'desc',
  perPage = 30,
) {
  return githubFetch(
    `/repos/${owner}/${repo}/pulls/comments?sort=${sort}&direction=${direction}&per_page=${perPage}`,
    credentials.token,
  );
}
export async function getPRReviewComment(credentials, owner, repo, commentId) {
  return githubFetch(`/repos/${owner}/${repo}/pulls/comments/${commentId}`, credentials.token);
}
export async function updatePRReviewComment(credentials, owner, repo, commentId, body) {
  return githubFetch(`/repos/${owner}/${repo}/pulls/comments/${commentId}`, credentials.token, {
    method: 'PATCH',
    body: JSON.stringify({ body: body }),
  });
}
export async function deletePRReviewComment(credentials, owner, repo, commentId) {
  return githubFetch(`/repos/${owner}/${repo}/pulls/comments/${commentId}`, credentials.token, {
    method: 'DELETE',
  });
}
export async function listCommitBranches(credentials, owner, repo, sha) {
  return githubFetch(
    `/repos/${owner}/${repo}/commits/${sha}/branches-where-head`,
    credentials.token,
    { headers: { Accept: 'application/vnd.github.groot-preview+json' } },
  );
}
export async function getOrgActionsPermissions(credentials, org) {
  return githubFetch(`/orgs/${org}/actions/permissions`, credentials.token);
}
export async function listOrgBlockedUsers(credentials, org, perPage = 30) {
  return githubFetch(`/orgs/${org}/blocks?per_page=${perPage}`, credentials.token);
}
export async function getRepoArchiveLink(credentials, owner, repo, format = 'zipball', ref = '') {
  const refPath = ref ? `/${encodeURIComponent(ref)}` : '',
    res = await fetch(`https://api.github.com/repos/${owner}/${repo}/${format}${refPath}`, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        Authorization: `Bearer ${credentials.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
  return {
    url: res.headers.get('location') || res.url || '',
    format: format,
    ref: ref || 'default branch',
  };
}
export async function getReadmeHtml(credentials, owner, repo, ref = '') {
  const qs = ref ? `?ref=${encodeURIComponent(ref)}` : '',
    res = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme${qs}`, {
      headers: {
        Authorization: `Bearer ${credentials.token}`,
        Accept: 'application/vnd.github.html',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message ?? `GitHub API ${res.status}`);
  }
  return res.text();
}
export async function getGitignoreTemplates(credentials) {
  return githubFetch('/gitignore/templates', credentials.token);
}
export async function getGitignoreTemplate(credentials, name) {
  return githubFetch(`/gitignore/templates/${encodeURIComponent(name)}`, credentials.token);
}
export async function listLicenses(credentials) {
  return githubFetch('/licenses', credentials.token);
}
export async function getLicense(credentials, licenseKey) {
  return githubFetch(`/licenses/${encodeURIComponent(licenseKey)}`, credentials.token);
}
export async function renderMarkdown(credentials, text, mode = 'markdown', context = '') {
  const body = { text: text, mode: mode };
  context && (body.context = context);
  const res = await fetch('https://api.github.com/markdown', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${credentials.token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return res.text();
}
export async function getEmojis(credentials) {
  return githubFetch('/emojis', credentials.token);
}
export async function getNotificationThread(credentials, threadId) {
  return githubFetch(`/notifications/threads/${threadId}`, credentials.token);
}
export async function markThreadRead(credentials, threadId) {
  return githubFetch(`/notifications/threads/${threadId}`, credentials.token, { method: 'PATCH' });
}
export async function getThreadSubscription(credentials, threadId) {
  return githubFetch(`/notifications/threads/${threadId}/subscription`, credentials.token);
}
export async function setThreadSubscription(credentials, threadId, subscribed = !0, ignored = !1) {
  return githubFetch(`/notifications/threads/${threadId}/subscription`, credentials.token, {
    method: 'PUT',
    body: JSON.stringify({ subscribed: subscribed, ignored: ignored }),
  });
}
export async function listRepoNotifications(
  credentials,
  owner,
  repo,
  unreadOnly = !0,
  perPage = 20,
) {
  return githubFetch(
    `/repos/${owner}/${repo}/notifications?all=${!unreadOnly}&per_page=${perPage}`,
    credentials.token,
  );
}
export async function markRepoNotificationsRead(credentials, owner, repo, lastReadAt = '') {
  const body = lastReadAt ? { last_read_at: lastReadAt } : {};
  return githubFetch(`/repos/${owner}/${repo}/notifications`, credentials.token, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}
export async function getPendingOrgInvitations(credentials, org, perPage = 30) {
  return githubFetch(`/orgs/${org}/invitations?per_page=${perPage}`, credentials.token);
}
export async function listOrgRunners(credentials, org, perPage = 30) {
  return githubFetch(`/orgs/${org}/actions/runners?per_page=${perPage}`, credentials.token);
}
export async function searchTopics(credentials, query, perPage = 20) {
  return githubFetch(
    `/search/topics?q=${encodeURIComponent(query)}&per_page=${perPage}`,
    credentials.token,
    { headers: { Accept: 'application/vnd.github.mercy-preview+json' } },
  );
}
export async function getRunnerApplications(credentials, owner, repo) {
  return githubFetch(`/repos/${owner}/${repo}/actions/runners/downloads`, credentials.token);
}
export async function listPRReviewCommentReactions(
  credentials,
  owner,
  repo,
  commentId,
  perPage = 30,
) {
  return githubFetch(
    `/repos/${owner}/${repo}/pulls/comments/${commentId}/reactions?per_page=${perPage}`,
    credentials.token,
    { headers: { Accept: 'application/vnd.github.squirrel-girl-preview+json' } },
  );
}
export async function addPRReviewCommentReaction(credentials, owner, repo, commentId, content) {
  return githubFetch(
    `/repos/${owner}/${repo}/pulls/comments/${commentId}/reactions`,
    credentials.token,
    {
      method: 'POST',
      headers: { Accept: 'application/vnd.github.squirrel-girl-preview+json' },
      body: JSON.stringify({ content: content }),
    },
  );
}
export async function getCommitComment(credentials, owner, repo, commentId) {
  return githubFetch(`/repos/${owner}/${repo}/comments/${commentId}`, credentials.token);
}
export async function listAllCommitComments(credentials, owner, repo, perPage = 30) {
  return githubFetch(`/repos/${owner}/${repo}/comments?per_page=${perPage}`, credentials.token);
}
