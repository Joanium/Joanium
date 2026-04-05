const GITLAB_BASE = 'https://gitlab.com/api/v4';

function pid(owner, repo) {
  return encodeURIComponent(`${owner}/${repo}`);
}

async function gitlabFetch(endpoint, token, options = {}) {
  const res = await fetch(`${GITLAB_BASE}${endpoint}`, {
    ...options,
    headers: {
      'PRIVATE-TOKEN': token,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = Array.isArray(err?.message)
      ? err.message.join(', ')
      : (err?.message ?? `GitLab API ${res.status}`);
    throw new Error(msg);
  }

  if (res.status === 204) return null;
  return res.json();
}

// ─── Normalizers ────────────────────────────────────────────────────────────

function normalizeUser(user) {
  if (!user) return null;
  return { ...user, login: user.username ?? user.name, avatar_url: user.avatar_url };
}

function normalizeRepo(p) {
  if (!p) return p;
  return {
    ...p,
    full_name: p.path_with_namespace,
    name: p.path,
    description: p.description ?? '',
    language: p.language ?? null,
    stargazers_count: p.star_count ?? 0,
    forks_count: p.forks_count ?? 0,
    open_issues_count: p.open_issues_count ?? 0,
    watchers_count: p.star_count ?? 0,
    html_url: p.web_url,
    default_branch: p.default_branch,
    private: p.visibility === 'private',
    fork: p.forked_from_project != null,
    created_at: p.created_at,
    updated_at: p.last_activity_at,
    license: p.license ? { name: p.license.name, spdx_id: p.license.nickname } : null,
    visibility: p.visibility,
  };
}

function normalizeIssue(i) {
  if (!i) return i;
  return {
    ...i,
    number: i.iid,
    body: i.description ?? '',
    state: i.state === 'opened' ? 'open' : i.state,
    user: normalizeUser(i.author),
    html_url: i.web_url,
    labels: (i.labels ?? []).map((l) => (typeof l === 'string' ? { name: l } : l)),
    assignees: (i.assignees ?? []).map(normalizeUser),
    milestone: i.milestone ? { title: i.milestone.title, number: i.milestone.iid } : null,
  };
}

function normalizePR(mr) {
  if (!mr) return mr;
  return {
    ...mr,
    number: mr.iid,
    body: mr.description ?? '',
    state: mr.state === 'opened' ? 'open' : mr.state,
    user: normalizeUser(mr.author),
    html_url: mr.web_url,
    head: { ref: mr.source_branch, sha: mr.sha ?? '' },
    base: { ref: mr.target_branch },
    additions: mr.additions ?? 0,
    deletions: mr.deletions ?? 0,
    changed_files: mr.changes_count ?? 0,
    commits: mr.commits_count ?? 0,
    mergeable: mr.merge_status === 'can_be_merged',
    draft: mr.draft ?? false,
  };
}

function normalizeCommit(c) {
  if (!c) return c;
  return {
    ...c,
    sha: c.id,
    commit: {
      message: c.message ?? c.title ?? '',
      author: {
        name: c.author_name,
        email: c.author_email,
        date: c.authored_date,
      },
    },
    author: { login: c.author_name },
    html_url: c.web_url,
  };
}

function normalizeTodo(t) {
  if (!t) return t;
  return {
    ...t,
    reason: t.action_name,
    subject: { title: t.target_title },
    repository: { full_name: t.project?.path_with_namespace ?? '' },
  };
}

function normalizeLabel(l) {
  if (!l) return l;
  return { ...l, color: (l.color ?? '').replace('#', '') };
}

function normalizeMilestone(m) {
  if (!m) return m;
  return {
    ...m,
    number: m.iid,
    html_url: m.web_url,
    due_on: m.due_date ?? null,
    open_issues: m.statistics?.count ?? 0,
    closed_issues: 0,
  };
}

function normalizeRelease(r) {
  if (!r) return r;
  return {
    ...r,
    tag_name: r.tag_name,
    name: r.name,
    body: r.description ?? '',
    html_url: r.links?.self ?? '',
    published_at: r.released_at ?? r.created_at,
    prerelease: false,
    draft: false,
  };
}

function normalizeBranch(b) {
  if (!b) return b;
  return {
    ...b,
    name: b.name,
    commit: { sha: b.commit?.id },
    protected: b.protected ?? false,
  };
}

function normalizeTag(t) {
  if (!t) return t;
  return { ...t, commit: { sha: t.commit?.id } };
}

function normalizeDeployment(d) {
  if (!d) return d;
  return {
    ...d,
    id: d.id,
    ref: d.ref,
    environment: d.environment?.name ?? '',
    creator: normalizeUser(d.user),
    created_at: d.created_at,
    html_url: d.deployable?.web_url ?? '',
  };
}

function normalizePipelineToRun(p) {
  if (!p) return p;
  return {
    ...p,
    id: p.id,
    run_number: p.id,
    name: `Pipeline #${p.id}`,
    status: p.status,
    conclusion:
      p.status === 'success'
        ? 'success'
        : p.status === 'failed'
          ? 'failure'
          : p.status === 'canceled'
            ? 'cancelled'
            : null,
    event: p.source ?? 'push',
    head_branch: p.ref,
    created_at: p.created_at,
    updated_at: p.updated_at,
    html_url: p.web_url,
  };
}

// ─── API Functions ────────────────────────────────────────────────────────────

export async function getUser(credentials) {
  const u = await gitlabFetch('/user', credentials.token);
  return normalizeUser(u);
}

export async function getRepos(credentials, perPage = 30) {
  const projects = await gitlabFetch(
    `/projects?membership=true&order_by=last_activity_at&per_page=${perPage}`,
    credentials.token,
  );
  return (projects ?? []).map(normalizeRepo);
}

export async function getRepoTree(credentials, owner, repo, branch) {
  const ref = branch || 'HEAD';
  const items = await gitlabFetch(
    `/projects/${pid(owner, repo)}/repository/tree?recursive=true&ref=${encodeURIComponent(ref)}&per_page=100`,
    credentials.token,
  ).catch(() => []);
  return {
    tree: (items ?? []).map((item) => ({
      path: item.path,
      type: item.type === 'tree' ? 'tree' : 'blob',
      sha: item.id,
    })),
  };
}

export async function getFileContent(credentials, owner, repo, filePath) {
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('%2F');
  const data = await gitlabFetch(
    `/projects/${pid(owner, repo)}/repository/files/${encodedPath}?ref=HEAD`,
    credentials.token,
  );

  const content =
    data.encoding === 'base64'
      ? Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8')
      : data.content;

  return {
    path: data.file_path,
    name: data.file_name,
    content,
    sha: data.blob_id,
    size: data.size,
    url: `https://gitlab.com/${owner}/${repo}/-/blob/${data.ref}/${data.file_path}`,
  };
}

export async function getIssues(credentials, owner, repo, state = 'open', perPage = 20) {
  const glState = state === 'open' ? 'opened' : state === 'closed' ? 'closed' : 'all';
  const issues = await gitlabFetch(
    `/projects/${pid(owner, repo)}/issues?state=${glState}&per_page=${perPage}&order_by=updated_at&not[labels]=`,
    credentials.token,
  );
  return (issues ?? []).map(normalizeIssue);
}

export async function getPullRequests(credentials, owner, repo, state = 'open', perPage = 20) {
  const glState =
    state === 'open'
      ? 'opened'
      : state === 'closed'
        ? 'closed'
        : state === 'merged'
          ? 'merged'
          : 'all';
  const mrs = await gitlabFetch(
    `/projects/${pid(owner, repo)}/merge_requests?state=${glState}&per_page=${perPage}&order_by=updated_at`,
    credentials.token,
  );
  return (mrs ?? []).map(normalizePR);
}

export async function getCommits(credentials, owner, repo, perPage = 20) {
  const commits = await gitlabFetch(
    `/projects/${pid(owner, repo)}/repository/commits?per_page=${perPage}`,
    credentials.token,
  );
  return (commits ?? []).map(normalizeCommit);
}

export async function getNotifications(credentials, unreadOnly = true) {
  const state = unreadOnly ? '?state=pending' : '';
  const todos = await gitlabFetch(`/todos${state}&per_page=50`, credentials.token);
  return (todos ?? []).map(normalizeTodo);
}

export async function getBranches(credentials, owner, repo) {
  const branches = await gitlabFetch(
    `/projects/${pid(owner, repo)}/repository/branches?per_page=100`,
    credentials.token,
  );
  return (branches ?? []).map(normalizeBranch);
}

export async function createIssue(credentials, owner, repo, title, body, labels = []) {
  const issue = await gitlabFetch(`/projects/${pid(owner, repo)}/issues`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({ title, description: body, labels: labels.join(',') }),
  });
  return normalizeIssue(issue);
}

export async function searchCode(credentials, query, scope) {
  if (scope) {
    const parts = scope.split('/');
    const owner = parts[0];
    const repo = parts.slice(1).join('/');
    const results = await gitlabFetch(
      `/projects/${pid(owner, repo)}/search?scope=blobs&search=${encodeURIComponent(query)}&per_page=20`,
      credentials.token,
    );
    return { items: results ?? [], total_count: results?.length ?? 0 };
  }
  const results = await gitlabFetch(
    `/search?scope=blobs&search=${encodeURIComponent(query)}&per_page=20`,
    credentials.token,
  );
  return { items: results ?? [], total_count: results?.length ?? 0 };
}

export async function getReadme(credentials, owner, repo) {
  return getFileContent(credentials, owner, repo, 'README.md').catch(() =>
    getFileContent(credentials, owner, repo, 'readme.md'),
  );
}

export async function getLatestRelease(credentials, owner, repo) {
  const releases = await gitlabFetch(
    `/projects/${pid(owner, repo)}/releases?per_page=1`,
    credentials.token,
  );
  return releases?.[0] ? normalizeRelease(releases[0]) : null;
}

export async function getReleases(credentials, owner, repo, perPage = 10) {
  const releases = await gitlabFetch(
    `/projects/${pid(owner, repo)}/releases?per_page=${perPage}`,
    credentials.token,
  );
  return (releases ?? []).map(normalizeRelease);
}

// ─────────────────────────────────────────────
// MR (Merge Request = Pull Request) functions
// ─────────────────────────────────────────────

export async function getPRFiles(credentials, owner, repo, prNumber) {
  const data = await gitlabFetch(
    `/projects/${pid(owner, repo)}/merge_requests/${prNumber}/changes`,
    credentials.token,
  );
  return (data?.changes ?? []).map((c) => ({
    filename: c.new_path || c.old_path,
    status: c.new_file
      ? 'added'
      : c.deleted_file
        ? 'removed'
        : c.renamed_file
          ? 'renamed'
          : 'modified',
    additions: c.diff ? (c.diff.match(/^\+/gm) ?? []).length : 0,
    deletions: c.diff ? (c.diff.match(/^-/gm) ?? []).length : 0,
    patch: c.diff ?? '',
  }));
}

export async function getPRDiff(credentials, owner, repo, prNumber) {
  const changes = await getPRFiles(credentials, owner, repo, prNumber);
  return (changes ?? []).map((c) => c.patch).join('\n');
}

export async function getPRDetails(credentials, owner, repo, prNumber) {
  const mr = await gitlabFetch(
    `/projects/${pid(owner, repo)}/merge_requests/${prNumber}`,
    credentials.token,
  );
  return normalizePR(mr);
}

export async function createPRReview(
  credentials,
  owner,
  repo,
  prNumber,
  { body, event = 'COMMENT', comments = [] },
) {
  if (event === 'APPROVE') {
    await gitlabFetch(
      `/projects/${pid(owner, repo)}/merge_requests/${prNumber}/approve`,
      credentials.token,
      { method: 'POST', body: JSON.stringify({}) },
    ).catch(() => null);
  }
  const note = await gitlabFetch(
    `/projects/${pid(owner, repo)}/merge_requests/${prNumber}/notes`,
    credentials.token,
    { method: 'POST', body: JSON.stringify({ body }) },
  );
  return {
    ...note,
    html_url: note?.url ?? `https://gitlab.com/${owner}/${repo}/-/merge_requests/${prNumber}`,
  };
}

export async function listPRReviews(credentials, owner, repo, prNumber) {
  const approvals = await gitlabFetch(
    `/projects/${pid(owner, repo)}/merge_requests/${prNumber}/approvals`,
    credentials.token,
  );
  return (approvals?.approved_by ?? []).map((a) => ({
    id: a.user?.id,
    user: normalizeUser(a.user),
    state: 'APPROVED',
    submitted_at: null,
    body: '',
    html_url: `https://gitlab.com/${owner}/${repo}/-/merge_requests/${prNumber}`,
  }));
}

export async function getPRComments(credentials, owner, repo, prNumber) {
  const notes = await gitlabFetch(
    `/projects/${pid(owner, repo)}/merge_requests/${prNumber}/notes?per_page=100&sort=asc`,
    credentials.token,
  );
  return (notes ?? []).map((n) => ({
    ...n,
    id: n.id,
    body: n.body,
    user: normalizeUser(n.author),
    path: n.position?.new_path ?? null,
    line: n.position?.new_line ?? null,
    original_line: n.position?.old_line ?? null,
    html_url: n.html_url ?? `https://gitlab.com/${owner}/${repo}/-/merge_requests/${prNumber}`,
  }));
}

export async function getPRChecks(credentials, owner, repo, prNumber) {
  const pipelines = await gitlabFetch(
    `/projects/${pid(owner, repo)}/merge_requests/${prNumber}/pipelines`,
    credentials.token,
  ).catch(() => []);

  const latest = pipelines?.[0];
  let jobs = [];
  if (latest?.id) {
    jobs = await gitlabFetch(
      `/projects/${pid(owner, repo)}/pipelines/${latest.id}/jobs?per_page=50`,
      credentials.token,
    ).catch(() => []);
  }

  return {
    prNumber,
    sha: latest?.sha ?? 'unknown',
    state: latest?.status ?? 'unknown',
    statuses: [],
    checkRuns: (jobs ?? []).map((j) => ({
      id: j.id,
      name: j.name,
      status:
        j.status === 'success' ? 'completed' : j.status === 'pending' ? 'queued' : 'in_progress',
      conclusion: j.status === 'success' ? 'success' : j.status === 'failed' ? 'failure' : null,
      html_url: j.web_url,
    })),
    totalCount: jobs?.length ?? 0,
  };
}

export async function getWorkflowRuns(
  credentials,
  owner,
  repo,
  { branch = '', event = '', perPage = 20 } = {},
) {
  const qs = new URLSearchParams({ per_page: String(perPage || 20) });
  if (branch) qs.set('ref', branch);
  if (event) qs.set('source', event);

  const pipelines = await gitlabFetch(
    `/projects/${pid(owner, repo)}/pipelines?${qs.toString()}`,
    credentials.token,
  );

  return {
    workflow_runs: (pipelines ?? []).map(normalizePipelineToRun),
    total_count: pipelines?.length ?? 0,
  };
}

export async function starRepo(credentials, owner, repo) {
  return gitlabFetch(`/projects/${pid(owner, repo)}/star`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function unstarRepo(credentials, owner, repo) {
  return gitlabFetch(`/projects/${pid(owner, repo)}/unstar`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function getRepoStats(credentials, owner, repo) {
  const data = await gitlabFetch(`/projects/${pid(owner, repo)}`, credentials.token);
  return {
    fullName: data.path_with_namespace,
    description: data.description ?? '',
    stars: data.star_count ?? 0,
    forks: data.forks_count ?? 0,
    openIssues: data.open_issues_count ?? 0,
    watchers: data.star_count ?? 0,
    language: data.language ?? 'Unknown',
    defaultBranch: data.default_branch,
    url: data.web_url,
  };
}

export async function createPR(
  credentials,
  owner,
  repo,
  { title, body = '', head, base, draft = false },
) {
  if (!head || !base) throw new Error('createPR: head and base branches are required');
  const mr = await gitlabFetch(`/projects/${pid(owner, repo)}/merge_requests`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({
      title,
      description: body,
      source_branch: head,
      target_branch: base,
      draft,
    }),
  });
  return normalizePR(mr);
}

export async function mergePR(
  credentials,
  owner,
  repo,
  prNumber,
  mergeMethod = 'merge',
  commitTitle = '',
) {
  const payload = {};
  if (commitTitle) payload.merge_commit_message = commitTitle;
  if (mergeMethod === 'squash') payload.squash = true;
  if (mergeMethod === 'rebase') payload.rebase = true;
  return gitlabFetch(
    `/projects/${pid(owner, repo)}/merge_requests/${prNumber}/merge`,
    credentials.token,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  );
}

export async function closePR(credentials, owner, repo, prNumber) {
  const mr = await gitlabFetch(
    `/projects/${pid(owner, repo)}/merge_requests/${prNumber}`,
    credentials.token,
    {
      method: 'PUT',
      body: JSON.stringify({ state_event: 'close' }),
    },
  );
  return normalizePR(mr);
}

export async function closeIssue(credentials, owner, repo, issueNumber, reason = 'completed') {
  const issue = await gitlabFetch(
    `/projects/${pid(owner, repo)}/issues/${issueNumber}`,
    credentials.token,
    {
      method: 'PUT',
      body: JSON.stringify({ state_event: 'close' }),
    },
  );
  return normalizeIssue(issue);
}

export async function reopenIssue(credentials, owner, repo, issueNumber) {
  const issue = await gitlabFetch(
    `/projects/${pid(owner, repo)}/issues/${issueNumber}`,
    credentials.token,
    {
      method: 'PUT',
      body: JSON.stringify({ state_event: 'reopen' }),
    },
  );
  return normalizeIssue(issue);
}

export async function addIssueComment(credentials, owner, repo, issueNumber, body) {
  const note = await gitlabFetch(
    `/projects/${pid(owner, repo)}/issues/${issueNumber}/notes`,
    credentials.token,
    { method: 'POST', body: JSON.stringify({ body }) },
  );
  return {
    ...note,
    html_url: note?.html_url ?? `https://gitlab.com/${owner}/${repo}/-/issues/${issueNumber}`,
  };
}

export async function addLabels(credentials, owner, repo, issueNumber, labels = []) {
  const issue = await gitlabFetch(
    `/projects/${pid(owner, repo)}/issues/${issueNumber}`,
    credentials.token,
  );
  const existing = issue.labels ?? [];
  const merged = [...new Set([...existing, ...labels])];
  const updated = await gitlabFetch(
    `/projects/${pid(owner, repo)}/issues/${issueNumber}`,
    credentials.token,
    {
      method: 'PUT',
      body: JSON.stringify({ labels: merged.join(',') }),
    },
  );
  return (updated.labels ?? []).map((l) => ({ name: l }));
}

export async function addAssignees(credentials, owner, repo, issueNumber, assignees = []) {
  const userIds = (
    await Promise.all(
      assignees.map(async (username) => {
        const users = await gitlabFetch(
          `/users?username=${encodeURIComponent(username)}`,
          credentials.token,
        ).catch(() => []);
        return users?.[0]?.id ?? null;
      }),
    )
  ).filter(Boolean);
  return gitlabFetch(`/projects/${pid(owner, repo)}/issues/${issueNumber}`, credentials.token, {
    method: 'PUT',
    body: JSON.stringify({ assignee_ids: userIds }),
  });
}

export async function markAllNotificationsRead(credentials) {
  return gitlabFetch('/todos/mark_as_done', credentials.token, {
    method: 'POST',
    body: JSON.stringify({}),
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
  return gitlabFetch(`/projects/${pid(owner, repo)}/pipeline`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({
      ref,
      variables: Object.entries(inputs).map(([key, value]) => ({
        key,
        value: String(value),
        variable_type: 'env_var',
      })),
    }),
  });
}

export async function getLatestWorkflowRun(credentials, owner, repo, workflowId, branch = '') {
  const qs = new URLSearchParams({ per_page: '1' });
  if (branch) qs.set('ref', branch);
  const pipelines = await gitlabFetch(
    `/projects/${pid(owner, repo)}/pipelines?${qs.toString()}`,
    credentials.token,
  );
  return pipelines?.[0] ? normalizePipelineToRun(pipelines[0]) : null;
}

export async function createGist(credentials, description, files, isPublic = false) {
  const snippetFiles = Object.entries(files).map(([filename, { content }]) => ({
    file_name: filename,
    content: content ?? '',
  }));
  const snippet = await gitlabFetch('/snippets', credentials.token, {
    method: 'POST',
    body: JSON.stringify({
      title: description || Object.keys(files)[0] || 'snippet',
      description,
      visibility: isPublic ? 'public' : 'private',
      files: snippetFiles,
    }),
  });
  return { ...snippet, html_url: snippet?.web_url };
}

export async function getIssueDetails(credentials, owner, repo, issueNumber) {
  const issue = await gitlabFetch(
    `/projects/${pid(owner, repo)}/issues/${issueNumber}`,
    credentials.token,
  );
  return normalizeIssue(issue);
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
  if (body !== undefined) payload.description = body;
  if (state !== undefined) payload.state_event = state === 'open' ? 'reopen' : 'close';
  if (labels !== undefined) payload.labels = Array.isArray(labels) ? labels.join(',') : labels;
  if (assignees !== undefined) {
    const names = Array.isArray(assignees)
      ? assignees
      : String(assignees)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
    const ids = (
      await Promise.all(
        names.map(async (u) => {
          const users = await gitlabFetch(
            `/users?username=${encodeURIComponent(u)}`,
            credentials.token,
          ).catch(() => []);
          return users?.[0]?.id ?? null;
        }),
      )
    ).filter(Boolean);
    payload.assignee_ids = ids;
  }
  const issue = await gitlabFetch(
    `/projects/${pid(owner, repo)}/issues/${issueNumber}`,
    credentials.token,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  );
  return normalizeIssue(issue);
}

export async function getContributors(credentials, owner, repo, perPage = 30) {
  const contributors = await gitlabFetch(
    `/projects/${pid(owner, repo)}/repository/contributors?per_page=${perPage}&order_by=commits&sort=desc`,
    credentials.token,
  );
  return (contributors ?? []).map((c) => ({
    ...c,
    login: c.name,
    contributions: c.commits,
    html_url: null,
  }));
}

export async function getLanguages(credentials, owner, repo) {
  return gitlabFetch(`/projects/${pid(owner, repo)}/languages`, credentials.token);
}

export async function getTopics(credentials, owner, repo) {
  const data = await gitlabFetch(`/projects/${pid(owner, repo)}`, credentials.token);
  return { names: data.topics ?? [] };
}

export async function getMilestones(credentials, owner, repo, state = 'open') {
  const glState = state === 'open' ? 'active' : state === 'closed' ? 'closed' : 'all';
  const milestones = await gitlabFetch(
    `/projects/${pid(owner, repo)}/milestones?state=${glState}&per_page=30`,
    credentials.token,
  );
  return (milestones ?? []).map(normalizeMilestone);
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
  if (dueOn) payload.due_date = dueOn.split('T')[0];
  const milestone = await gitlabFetch(
    `/projects/${pid(owner, repo)}/milestones`,
    credentials.token,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return normalizeMilestone(milestone);
}

export async function createBranch(credentials, owner, repo, branchName, sha) {
  return gitlabFetch(`/projects/${pid(owner, repo)}/repository/branches`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({ branch: branchName, ref: sha }),
  });
}

export async function deleteBranch(credentials, owner, repo, branchName) {
  return gitlabFetch(
    `/projects/${pid(owner, repo)}/repository/branches/${encodeURIComponent(branchName)}`,
    credentials.token,
    { method: 'DELETE' },
  );
}

export async function getForks(credentials, owner, repo, perPage = 20) {
  const forks = await gitlabFetch(
    `/projects/${pid(owner, repo)}/forks?per_page=${perPage}&order_by=last_activity_at`,
    credentials.token,
  );
  return (forks ?? []).map(normalizeRepo);
}

export async function getStargazers(credentials, owner, repo, perPage = 30) {
  const starrers = await gitlabFetch(
    `/projects/${pid(owner, repo)}/starrers?per_page=${perPage}`,
    credentials.token,
  );
  return (starrers ?? []).map((s) => normalizeUser(s.user ?? s));
}

export async function getCollaborators(credentials, owner, repo) {
  const members = await gitlabFetch(
    `/projects/${pid(owner, repo)}/members/all?per_page=50`,
    credentials.token,
  );
  return (members ?? []).map((m) => ({
    ...normalizeUser(m),
    role_name: m.access_level >= 40 ? 'admin' : m.access_level >= 30 ? 'write' : 'read',
    permissions: {
      admin: m.access_level >= 40,
      push: m.access_level >= 30,
      pull: true,
    },
  }));
}

export async function compareBranches(credentials, owner, repo, base, head) {
  const data = await gitlabFetch(
    `/projects/${pid(owner, repo)}/repository/compare?from=${encodeURIComponent(base)}&to=${encodeURIComponent(head)}`,
    credentials.token,
  );
  const commits = data.commits ?? [];
  const diffs = data.diffs ?? [];
  return {
    status: data.compare_same_ref ? 'identical' : 'diverged',
    ahead_by: commits.length,
    behind_by: 0,
    total_commits: commits.length,
    files: diffs.map((d) => ({
      filename: d.new_path || d.old_path,
      status: d.new_file ? 'added' : d.deleted_file ? 'removed' : 'modified',
      additions: d.diff ? (d.diff.match(/^\+/gm) ?? []).length : 0,
      deletions: d.diff ? (d.diff.match(/^-/gm) ?? []).length : 0,
    })),
  };
}

export async function getGists(credentials, perPage = 20) {
  const snippets = await gitlabFetch(`/snippets?per_page=${perPage}`, credentials.token);
  return (snippets ?? []).map((s) => ({
    ...s,
    html_url: s.web_url,
    public: s.visibility === 'public',
    description: s.title ?? s.description ?? '',
    files: s.files
      ? Object.fromEntries(
          s.files.map((f) => [f.filename ?? f.name, { filename: f.filename ?? f.name }]),
        )
      : { [s.file_name ?? 'snippet']: { filename: s.file_name ?? 'snippet' } },
    updated_at: s.updated_at,
  }));
}

export async function getTrafficViews(credentials, owner, repo) {
  // GitLab does not expose traffic stats via public API
  return { count: 0, uniques: 0, views: [] };
}

export async function requestReviewers(
  credentials,
  owner,
  repo,
  prNumber,
  reviewers = [],
  teamReviewers = [],
) {
  const userIds = (
    await Promise.all(
      reviewers.map(async (username) => {
        const users = await gitlabFetch(
          `/users?username=${encodeURIComponent(username)}`,
          credentials.token,
        ).catch(() => []);
        return users?.[0]?.id ?? null;
      }),
    )
  ).filter(Boolean);
  return gitlabFetch(
    `/projects/${pid(owner, repo)}/merge_requests/${prNumber}`,
    credentials.token,
    {
      method: 'PUT',
      body: JSON.stringify({ reviewer_ids: userIds }),
    },
  );
}

export async function getUserInfo(credentials, username) {
  const users = await gitlabFetch(
    `/users?username=${encodeURIComponent(username)}`,
    credentials.token,
  );
  if (!users?.length) throw new Error(`User "${username}" not found`);
  const u = users[0];
  return {
    ...normalizeUser(u),
    name: u.name,
    bio: u.bio ?? '',
    company: u.organization ?? '',
    location: u.location ?? '',
    blog: u.website_url ?? '',
    public_repos: u.public_repos ?? 0,
    followers: u.followers ?? 0,
    following: u.following ?? 0,
    created_at: u.created_at,
    html_url: u.web_url,
  };
}

export async function searchRepos(credentials, query, perPage = 20) {
  const results = await gitlabFetch(
    `/projects?search=${encodeURIComponent(query)}&per_page=${perPage}&order_by=last_activity_at&simple=false`,
    credentials.token,
  );
  const items = (results ?? []).map(normalizeRepo);
  return { items, total_count: items.length };
}

export async function searchIssues(credentials, query, perPage = 20) {
  const results = await gitlabFetch(
    `/issues?search=${encodeURIComponent(query)}&per_page=${perPage}&scope=all`,
    credentials.token,
  );
  const items = (results ?? []).map(normalizeIssue);
  return { items, total_count: items.length };
}

export async function getIssueComments(credentials, owner, repo, issueNumber, perPage = 30) {
  const notes = await gitlabFetch(
    `/projects/${pid(owner, repo)}/issues/${issueNumber}/notes?per_page=${perPage}&sort=asc&order_by=created_at`,
    credentials.token,
  );
  return (notes ?? []).map((n) => ({
    ...n,
    user: normalizeUser(n.author),
    body: n.body,
    html_url: `https://gitlab.com/${owner}/${repo}/-/issues/${issueNumber}#note_${n.id}`,
  }));
}

export async function getCommitDetails(credentials, owner, repo, sha) {
  const [commit, diff] = await Promise.all([
    gitlabFetch(`/projects/${pid(owner, repo)}/repository/commits/${sha}`, credentials.token),
    gitlabFetch(
      `/projects/${pid(owner, repo)}/repository/commits/${sha}/diff`,
      credentials.token,
    ).catch(() => []),
  ]);

  return {
    ...normalizeCommit(commit),
    stats: {
      additions: commit.stats?.additions ?? 0,
      deletions: commit.stats?.deletions ?? 0,
      total: (commit.stats?.additions ?? 0) + (commit.stats?.deletions ?? 0),
    },
    files: (diff ?? []).map((d) => ({
      filename: d.new_path || d.old_path,
      status: d.new_file
        ? 'added'
        : d.deleted_file
          ? 'removed'
          : d.renamed_file
            ? 'renamed'
            : 'modified',
      additions: d.diff ? (d.diff.match(/^\+/gm) ?? []).length : 0,
      deletions: d.diff ? (d.diff.match(/^-/gm) ?? []).length : 0,
    })),
    html_url: `https://gitlab.com/${owner}/${repo}/-/commit/${sha}`,
  };
}

export async function getTags(credentials, owner, repo, perPage = 20) {
  const tags = await gitlabFetch(
    `/projects/${pid(owner, repo)}/repository/tags?per_page=${perPage}`,
    credentials.token,
  );
  return (tags ?? []).map(normalizeTag);
}

export async function createRelease(
  credentials,
  owner,
  repo,
  { tagName, name = '', body = '', draft = false, prerelease = false, targetCommitish = '' },
) {
  const payload = { name: name || tagName, tag_name: tagName, description: body };
  if (targetCommitish) payload.ref = targetCommitish;
  const release = await gitlabFetch(`/projects/${pid(owner, repo)}/releases`, credentials.token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return normalizeRelease(release);
}

export async function forkRepo(credentials, owner, repo, organization = '') {
  const payload = organization ? { namespace: organization } : {};
  const fork = await gitlabFetch(`/projects/${pid(owner, repo)}/fork`, credentials.token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return normalizeRepo(fork);
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
  if (body !== undefined) payload.description = body;
  if (state !== undefined) payload.state_event = state === 'open' ? 'reopen' : 'close';
  if (base !== undefined) payload.target_branch = base;
  const mr = await gitlabFetch(
    `/projects/${pid(owner, repo)}/merge_requests/${prNumber}`,
    credentials.token,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  );
  return normalizePR(mr);
}

export async function getLabels(credentials, owner, repo, perPage = 50) {
  const labels = await gitlabFetch(
    `/projects/${pid(owner, repo)}/labels?per_page=${perPage}`,
    credentials.token,
  );
  return (labels ?? []).map(normalizeLabel);
}

export async function createLabel(credentials, owner, repo, name, color, description = '') {
  const label = await gitlabFetch(`/projects/${pid(owner, repo)}/labels`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({ name, color: color.startsWith('#') ? color : `#${color}`, description }),
  });
  return normalizeLabel(label);
}

export async function deleteLabel(credentials, owner, repo, name) {
  return gitlabFetch(
    `/projects/${pid(owner, repo)}/labels/${encodeURIComponent(name)}`,
    credentials.token,
    { method: 'DELETE' },
  );
}

export async function searchUsers(credentials, query, perPage = 20) {
  const results = await gitlabFetch(
    `/users?search=${encodeURIComponent(query)}&per_page=${perPage}`,
    credentials.token,
  );
  const items = (results ?? []).map((u) => ({
    ...normalizeUser(u),
    type: 'User',
    html_url: u.web_url,
  }));
  return { items, total_count: items.length };
}

export async function getUserStarred(credentials, username, perPage = 30) {
  const user = await getUserInfo(credentials, username);
  const projects = await gitlabFetch(
    `/users/${user.id}/starred_projects?per_page=${perPage}&order_by=last_activity_at`,
    credentials.token,
  ).catch(() => []);
  return (projects ?? []).map(normalizeRepo);
}

export async function getFileCommits(credentials, owner, repo, filePath, perPage = 15) {
  const commits = await gitlabFetch(
    `/projects/${pid(owner, repo)}/repository/commits?path=${encodeURIComponent(filePath)}&per_page=${perPage}`,
    credentials.token,
  );
  return (commits ?? []).map(normalizeCommit);
}

export async function lockIssue(credentials, owner, repo, issueNumber, lockReason = '') {
  return gitlabFetch(`/projects/${pid(owner, repo)}/issues/${issueNumber}`, credentials.token, {
    method: 'PUT',
    body: JSON.stringify({ discussion_locked: true }),
  });
}

export async function unlockIssue(credentials, owner, repo, issueNumber) {
  return gitlabFetch(`/projects/${pid(owner, repo)}/issues/${issueNumber}`, credentials.token, {
    method: 'PUT',
    body: JSON.stringify({ discussion_locked: false }),
  });
}

export async function getDeployments(credentials, owner, repo, perPage = 20) {
  const deployments = await gitlabFetch(
    `/projects/${pid(owner, repo)}/deployments?per_page=${perPage}&order_by=created_at&sort=desc`,
    credentials.token,
  );
  return (deployments ?? []).map(normalizeDeployment);
}

export async function getRepoPermissions(credentials, owner, repo, username) {
  const user = await getUserInfo(credentials, username);
  const member = await gitlabFetch(
    `/projects/${pid(owner, repo)}/members/${user.id}`,
    credentials.token,
  );
  const permMap = { 50: 'admin', 40: 'admin', 30: 'write', 20: 'read', 10: 'read' };
  return {
    permission: permMap[member.access_level] ?? 'none',
    user: normalizeUser(member),
  };
}

export async function removeLabels(credentials, owner, repo, issueNumber, labels = []) {
  const updated = await gitlabFetch(
    `/projects/${pid(owner, repo)}/issues/${issueNumber}`,
    credentials.token,
    {
      method: 'PUT',
      body: JSON.stringify({ labels: labels.join(',') }),
    },
  );
  return (updated.labels ?? []).map((l) => ({ name: l }));
}

export async function getPRRequestedReviewers(credentials, owner, repo, prNumber) {
  const mr = await gitlabFetch(
    `/projects/${pid(owner, repo)}/merge_requests/${prNumber}`,
    credentials.token,
  );
  return {
    users: (mr.reviewers ?? []).map(normalizeUser),
    teams: [],
  };
}

export async function getRepoInfo(credentials, owner, repo) {
  const project = await gitlabFetch(`/projects/${pid(owner, repo)}`, credentials.token);
  return normalizeRepo(project);
}

export async function getOrgRepos(credentials, org, perPage = 30) {
  const projects = await gitlabFetch(
    `/groups/${encodeURIComponent(org)}/projects?per_page=${perPage}&order_by=last_activity_at`,
    credentials.token,
  );
  return (projects ?? []).map(normalizeRepo);
}

export async function watchRepo(credentials, owner, repo, subscribed = true) {
  const action = subscribed ? 'subscribe' : 'unsubscribe';
  return gitlabFetch(`/projects/${pid(owner, repo)}/${action}`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({}),
  }).catch(() => null);
}

export async function getUserEvents(credentials, username, perPage = 20) {
  const user = await getUserInfo(credentials, username);
  const events = await gitlabFetch(
    `/users/${user.id}/events?per_page=${perPage}`,
    credentials.token,
  );
  return (events ?? []).map((e) => ({
    ...e,
    type: e.action_name,
    repo: { name: e.project_id ? `project:${e.project_id}` : 'unknown' },
    created_at: e.created_at,
  }));
}

export async function getRepoEnvironments(credentials, owner, repo) {
  const envs = await gitlabFetch(
    `/projects/${pid(owner, repo)}/environments?per_page=50`,
    credentials.token,
  );
  return {
    environments: (envs ?? []).map((e) => ({
      ...e,
      name: e.name,
      protection_rules: e.required_approval_count > 0 ? [{ type: 'required_reviewers' }] : [],
      updated_at: e.last_deployment?.created_at ?? null,
    })),
  };
}

export async function listActionsSecrets(credentials, owner, repo) {
  const vars = await gitlabFetch(
    `/projects/${pid(owner, repo)}/variables?per_page=100`,
    credentials.token,
  );
  return { secrets: (vars ?? []).map((v) => ({ name: v.key, updated_at: null })) };
}

export async function getDependabotAlerts(credentials, owner, repo, state = 'open', perPage = 20) {
  const findings = await gitlabFetch(
    `/projects/${pid(owner, repo)}/vulnerability_findings?per_page=${perPage}&scanner_ids[]=dependency_scanning`,
    credentials.token,
  ).catch(() => []);
  return findings ?? [];
}

export async function getCommitsSince(credentials, owner, repo, since, until = '', perPage = 20) {
  const qs = new URLSearchParams({ per_page: String(perPage) });
  if (since) qs.set('since', since);
  if (until) qs.set('until', until);
  const commits = await gitlabFetch(
    `/projects/${pid(owner, repo)}/repository/commits?${qs.toString()}`,
    credentials.token,
  );
  return (commits ?? []).map(normalizeCommit);
}

export async function getBranchProtection(credentials, owner, repo, branch) {
  return gitlabFetch(
    `/projects/${pid(owner, repo)}/protected_branches/${encodeURIComponent(branch)}`,
    credentials.token,
  );
}

export async function getUserOrgs(credentials, username) {
  const user = await getUserInfo(credentials, username);
  const groups = await gitlabFetch(`/users/${user.id}/groups?per_page=50`, credentials.token).catch(
    () => [],
  );
  return (groups ?? []).map((g) => ({
    login: g.path,
    description: g.description ?? '',
    html_url: g.web_url,
  }));
}

export async function getTrafficClones(credentials, owner, repo) {
  return { count: 0, uniques: 0, clones: [] };
}

export async function getCommunityProfile(credentials, owner, repo) {
  const project = await gitlabFetch(`/projects/${pid(owner, repo)}`, credentials.token);
  return {
    health_percentage: null,
    files: {
      readme: null,
      license: project.license?.key ? { key: project.license.key } : null,
      code_of_conduct: null,
      contributing: null,
      issue_template: null,
      pull_request_template: null,
    },
    description: project.description,
    documentation: project.wiki_enabled ? `${project.web_url}/-/wikis` : null,
  };
}

export async function getRepoWebhooks(credentials, owner, repo) {
  const hooks = await gitlabFetch(`/projects/${pid(owner, repo)}/hooks`, credentials.token);
  return (hooks ?? []).map((h) => ({
    ...h,
    config: { url: h.url },
    events: Object.entries(h)
      .filter(([k, v]) => k.endsWith('_events') && v === true)
      .map(([k]) => k.replace('_events', '')),
    active: h.enable_ssl_verification != null,
  }));
}

export async function getOrgMembers(credentials, org, perPage = 30) {
  const members = await gitlabFetch(
    `/groups/${encodeURIComponent(org)}/members?per_page=${perPage}`,
    credentials.token,
  );
  return (members ?? []).map((m) => ({ ...normalizeUser(m), html_url: m.web_url }));
}

export async function listOrgTeams(credentials, org, perPage = 30) {
  const subgroups = await gitlabFetch(
    `/groups/${encodeURIComponent(org)}/subgroups?per_page=${perPage}`,
    credentials.token,
  );
  return (subgroups ?? []).map((g) => ({
    ...g,
    name: g.name,
    slug: g.path,
    description: g.description ?? '',
    members_count: null,
    repos_count: null,
  }));
}

export async function getTeamMembers(credentials, org, teamSlug, perPage = 30) {
  const members = await gitlabFetch(
    `/groups/${encodeURIComponent(teamSlug)}/members?per_page=${perPage}`,
    credentials.token,
  );
  return (members ?? []).map((m) => ({ ...normalizeUser(m), html_url: m.web_url }));
}

export async function getIssueReactions(credentials, owner, repo, issueNumber) {
  const emojis = await gitlabFetch(
    `/projects/${pid(owner, repo)}/issues/${issueNumber}/award_emoji`,
    credentials.token,
  );
  const glToGh = {
    thumbsup: '+1',
    thumbsdown: '-1',
    laughing: 'laugh',
    tada: 'hooray',
    confused: 'confused',
    heart: 'heart',
    rocket: 'rocket',
    eyes: 'eyes',
  };
  return (emojis ?? []).map((e) => ({
    ...e,
    content: glToGh[e.name] ?? e.name,
    user: normalizeUser(e.user),
  }));
}

export async function getRepoLicense(credentials, owner, repo) {
  const project = await gitlabFetch(`/projects/${pid(owner, repo)}`, credentials.token);
  return {
    license: {
      key: project.license?.key ?? null,
      name: project.license?.name ?? 'Unknown',
      spdx_id: project.license?.nickname ?? null,
      url: null,
    },
    content: null,
  };
}

export async function getCodeFrequency(credentials, owner, repo) {
  return [];
}

export async function getContributorStats(credentials, owner, repo) {
  const contributors = await getContributors(credentials, owner, repo);
  return (contributors ?? []).map((c) => ({
    author: { login: c.login },
    total: c.commits,
    weeks: [],
  }));
}

export async function getCommitActivity(credentials, owner, repo) {
  return [];
}

export async function getPunchCard(credentials, owner, repo) {
  return [];
}

export async function getRepoSubscription(credentials, owner, repo) {
  return { subscribed: null, ignored: false, reason: null };
}

export async function getUserFollowers(credentials, username, perPage = 30) {
  return [];
}

export async function getUserFollowing(credentials, username, perPage = 30) {
  return [];
}

export async function getUserGists(credentials, username, perPage = 20) {
  const user = await getUserInfo(credentials, username);
  const snippets = await gitlabFetch(
    `/snippets?author_id=${user.id}&per_page=${perPage}`,
    credentials.token,
  ).catch(() => []);
  return (snippets ?? []).map((s) => ({
    ...s,
    html_url: s.web_url,
    public: s.visibility === 'public',
    description: s.title ?? s.description ?? '',
    files: s.files
      ? Object.fromEntries(s.files.map((f) => [f.filename ?? f.name, {}]))
      : { [s.file_name ?? 'snippet']: {} },
  }));
}

export async function getGistDetails(credentials, gistId) {
  const snippet = await gitlabFetch(`/snippets/${gistId}`, credentials.token);
  const content = await gitlabFetch(`/snippets/${gistId}/raw`, credentials.token).catch(() => null);
  return {
    ...snippet,
    html_url: snippet.web_url,
    public: snippet.visibility === 'public',
    description: snippet.title ?? snippet.description ?? '',
    owner: normalizeUser(snippet.author),
    files: snippet.files
      ? Object.fromEntries(
          snippet.files.map((f) => [
            f.filename ?? f.name,
            {
              filename: f.filename ?? f.name,
              content: typeof content === 'string' ? content : null,
            },
          ]),
        )
      : {
          [snippet.file_name ?? 'snippet']: {
            filename: snippet.file_name,
            content: typeof content === 'string' ? content : null,
          },
        },
    comments: snippet.user_notes_count ?? 0,
    forks: [],
  };
}

export async function getPRCommits(credentials, owner, repo, prNumber, perPage = 30) {
  const commits = await gitlabFetch(
    `/projects/${pid(owner, repo)}/merge_requests/${prNumber}/commits?per_page=${perPage}`,
    credentials.token,
  );
  return (commits ?? []).map(normalizeCommit);
}

export async function getCommitStatuses(credentials, owner, repo, ref, perPage = 20) {
  return gitlabFetch(
    `/projects/${pid(owner, repo)}/repository/commits/${encodeURIComponent(ref)}/statuses?per_page=${perPage}`,
    credentials.token,
  );
}

export async function getRepoPages(credentials, owner, repo) {
  return gitlabFetch(`/projects/${pid(owner, repo)}/pages`, credentials.token).catch(() => null);
}

export async function getOrgInfo(credentials, org) {
  const g = await gitlabFetch(`/groups/${encodeURIComponent(org)}`, credentials.token);
  return {
    ...g,
    login: g.path,
    name: g.name,
    description: g.description ?? '',
    email: null,
    blog: g.web_url,
    location: null,
    public_repos: g.projects?.length ?? 0,
    followers: 0,
    html_url: g.web_url,
    created_at: g.created_at,
  };
}

export async function searchCommits(credentials, query, perPage = 20) {
  const results = await gitlabFetch(
    `/search?scope=commits&search=${encodeURIComponent(query)}&per_page=${perPage}`,
    credentials.token,
  );
  const items = (results ?? []).map((c) => ({
    ...normalizeCommit(c),
    repository: { full_name: c.project_id ? `project:${c.project_id}` : 'unknown' },
  }));
  return { items, total_count: items.length };
}

export async function getDeploymentStatuses(credentials, owner, repo, deploymentId, perPage = 10) {
  const d = await gitlabFetch(
    `/projects/${pid(owner, repo)}/deployments/${deploymentId}`,
    credentials.token,
  );
  return [
    {
      state: d.status,
      environment: d.environment?.name ?? '',
      created_at: d.created_at,
      description: `Deployment ${d.id} - ${d.status}`,
      log_url: d.deployable?.web_url ?? null,
    },
  ];
}

export async function getRepoInvitations(credentials, owner, repo) {
  return gitlabFetch(
    `/projects/${pid(owner, repo)}/invitations?per_page=50`,
    credentials.token,
  ).catch(() => []);
}

export async function getRateLimit(credentials) {
  return {
    resources: {
      core: { limit: 2000, remaining: null, reset: null },
      search: { limit: 30, remaining: null, reset: null },
      graphql: { limit: 2000, remaining: null, reset: null },
    },
  };
}

export async function listWorkflows(credentials, owner, repo, perPage = 30) {
  const schedules = await gitlabFetch(
    `/projects/${pid(owner, repo)}/pipeline_schedules?per_page=${perPage}`,
    credentials.token,
  );
  return {
    workflows: (schedules ?? []).map((s) => ({
      id: s.id,
      name: s.description || `Schedule #${s.id}`,
      state: s.active ? 'active' : 'disabled',
      path: `.gitlab-ci.yml (${s.cron ?? 'manual'})`,
      html_url: null,
      badge_url: null,
      created_at: s.created_at,
      updated_at: s.updated_at,
    })),
  };
}

export async function getWorkflowDetails(credentials, owner, repo, workflowId) {
  const s = await gitlabFetch(
    `/projects/${pid(owner, repo)}/pipeline_schedules/${workflowId}`,
    credentials.token,
  );
  return {
    id: s.id,
    name: s.description || `Schedule #${s.id}`,
    state: s.active ? 'active' : 'disabled',
    path: `.gitlab-ci.yml`,
    html_url: null,
    badge_url: null,
    created_at: s.created_at,
    updated_at: s.updated_at,
  };
}

export async function getActionsRunners(credentials, owner, repo) {
  const runners = await gitlabFetch(
    `/projects/${pid(owner, repo)}/runners?per_page=50`,
    credentials.token,
  );
  return {
    runners: (runners ?? []).map((r) => ({
      id: r.id,
      name: r.description || r.name || `Runner #${r.id}`,
      status: r.active ? 'online' : 'offline',
      os: r.platform ?? 'unknown',
      labels: (r.tag_list ?? []).map((t) => ({ name: t })),
    })),
  };
}

export async function getActionsVariables(credentials, owner, repo, perPage = 30) {
  const vars = await gitlabFetch(
    `/projects/${pid(owner, repo)}/variables?per_page=${perPage}`,
    credentials.token,
  );
  return {
    variables: (vars ?? []).map((v) => ({
      name: v.key,
      value: v.masked ? '***' : v.value,
      updated_at: null,
    })),
  };
}

export async function getActionsCache(credentials, owner, repo, perPage = 30) {
  return { actions_caches: [] };
}

export async function getTeamRepos(credentials, org, teamSlug, perPage = 30) {
  const projects = await gitlabFetch(
    `/groups/${encodeURIComponent(teamSlug)}/projects?per_page=${perPage}&order_by=last_activity_at`,
    credentials.token,
  );
  return (projects ?? []).map((p) => ({
    ...normalizeRepo(p),
    permissions: { admin: false, push: true, pull: true },
  }));
}

export async function getUserRepos(credentials, username, perPage = 30) {
  const projects = await gitlabFetch(
    `/users/${encodeURIComponent(username)}/projects?per_page=${perPage}&order_by=last_activity_at`,
    credentials.token,
  );
  return (projects ?? []).map(normalizeRepo);
}

export async function getIssueTimeline(credentials, owner, repo, issueNumber, perPage = 30) {
  const events = await gitlabFetch(
    `/projects/${pid(owner, repo)}/issues/${issueNumber}/resource_state_events?per_page=${perPage}`,
    credentials.token,
  ).catch(() => []);
  return (events ?? []).map((e) => ({
    ...e,
    event: e.state ?? e.action_name ?? 'unknown',
    actor: normalizeUser(e.user),
    created_at: e.created_at,
  }));
}

export async function getOrgSecrets(credentials, org, perPage = 30) {
  const vars = await gitlabFetch(
    `/groups/${encodeURIComponent(org)}/variables?per_page=${perPage}`,
    credentials.token,
  );
  return {
    secrets: (vars ?? []).map((v) => ({
      name: v.key,
      visibility: v.environment_scope || 'all',
      updated_at: null,
    })),
  };
}

export async function getSingleComment(credentials, owner, repo, commentId) {
  // Try issue notes endpoint
  return gitlabFetch(
    `/projects/${pid(owner, repo)}/issues/notes/${commentId}`,
    credentials.token,
  ).catch(() =>
    gitlabFetch(
      `/projects/${pid(owner, repo)}/merge_requests/notes/${commentId}`,
      credentials.token,
    ),
  );
}

export async function getRepoSecurityAdvisories(credentials, owner, repo, perPage = 20) {
  return gitlabFetch(
    `/projects/${pid(owner, repo)}/vulnerability_findings?per_page=${perPage}`,
    credentials.token,
  ).catch(() => []);
}

export async function getPRReviewDetails(credentials, owner, repo, prNumber, reviewId) {
  const note = await gitlabFetch(
    `/projects/${pid(owner, repo)}/merge_requests/${prNumber}/notes/${reviewId}`,
    credentials.token,
  );
  return {
    id: note.id,
    user: normalizeUser(note.author),
    state: 'COMMENTED',
    submitted_at: note.created_at,
    body: note.body,
    html_url: `https://gitlab.com/${owner}/${repo}/-/merge_requests/${prNumber}#note_${note.id}`,
  };
}

export async function getOrgVariables(credentials, org, perPage = 30) {
  const vars = await gitlabFetch(
    `/groups/${encodeURIComponent(org)}/variables?per_page=${perPage}`,
    credentials.token,
  );
  return {
    variables: (vars ?? []).map((v) => ({
      name: v.key,
      value: v.masked ? '***' : v.value,
      visibility: v.environment_scope || 'all',
      updated_at: null,
    })),
  };
}

export async function getRepoAutolinks(credentials, owner, repo) {
  return [];
}

export async function getCheckRunDetails(credentials, owner, repo, checkRunId) {
  const job = await gitlabFetch(
    `/projects/${pid(owner, repo)}/jobs/${checkRunId}`,
    credentials.token,
  );
  return {
    id: job.id,
    name: job.name,
    status:
      job.status === 'success' ? 'completed' : job.status === 'pending' ? 'queued' : 'in_progress',
    conclusion: job.status === 'success' ? 'success' : job.status === 'failed' ? 'failure' : null,
    started_at: job.started_at,
    completed_at: job.finished_at,
    html_url: job.web_url,
    details_url: job.web_url,
    output: {
      title: job.name,
      summary: `Runner: ${job.runner?.description ?? 'unknown'}`,
      annotations_count: 0,
    },
  };
}

export async function createRepo(
  credentials,
  { name, description = '', private: isPrivate = false, autoInit = false },
) {
  const project = await gitlabFetch('/projects', credentials.token, {
    method: 'POST',
    body: JSON.stringify({
      name,
      description,
      visibility: isPrivate ? 'private' : 'public',
      initialize_with_readme: autoInit,
    }),
  });
  return normalizeRepo(project);
}

export async function updateRepo(credentials, owner, repo, payload = {}) {
  const glPayload = {};
  if (payload.description !== undefined) glPayload.description = payload.description;
  if (payload.homepage !== undefined) glPayload.homepage = payload.homepage;
  if (payload.private !== undefined) glPayload.visibility = payload.private ? 'private' : 'public';
  if (payload.default_branch !== undefined) glPayload.default_branch = payload.default_branch;
  if (payload.has_issues !== undefined) glPayload.issues_enabled = payload.has_issues;
  if (payload.has_wiki !== undefined) glPayload.wiki_enabled = payload.has_wiki;
  if (payload.has_projects !== undefined) glPayload.snippets_enabled = payload.has_projects;
  const project = await gitlabFetch(`/projects/${pid(owner, repo)}`, credentials.token, {
    method: 'PUT',
    body: JSON.stringify(glPayload),
  });
  return normalizeRepo(project);
}

export async function deleteRepo(credentials, owner, repo) {
  return gitlabFetch(`/projects/${pid(owner, repo)}`, credentials.token, { method: 'DELETE' });
}

export async function getRepoContents(credentials, owner, repo, path = '', ref = '') {
  const refParam = ref ? `?ref=${encodeURIComponent(ref)}` : '';
  if (path) {
    const encodedPath = path.split('/').map(encodeURIComponent).join('%2F');
    return gitlabFetch(
      `/projects/${pid(owner, repo)}/repository/tree?path=${encodeURIComponent(path)}${ref ? `&ref=${encodeURIComponent(ref)}` : ''}&per_page=100`,
      credentials.token,
    ).then((items) =>
      (items ?? []).map((item) => ({
        name: item.name,
        type: item.type === 'tree' ? 'dir' : 'file',
        size: 0,
        path: item.path,
      })),
    );
  }
  const items = await gitlabFetch(
    `/projects/${pid(owner, repo)}/repository/tree${refParam}&per_page=100`,
    credentials.token,
  );
  return (items ?? []).map((item) => ({
    name: item.name,
    type: item.type === 'tree' ? 'dir' : 'file',
    size: 0,
    path: item.path,
  }));
}

export async function createOrUpdateFile(
  credentials,
  owner,
  repo,
  filePath,
  { message, content, sha = '', branch = '' },
) {
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('%2F');
  const payload = { commit_message: message, content };
  if (branch) payload.branch = branch;
  if (sha) payload.last_commit_id = sha;
  const method = sha ? 'PUT' : 'POST';
  return gitlabFetch(
    `/projects/${pid(owner, repo)}/repository/files/${encodedPath}`,
    credentials.token,
    {
      method,
      body: JSON.stringify(payload),
    },
  );
}

export async function deleteFile(
  credentials,
  owner,
  repo,
  filePath,
  { message, sha, branch = '' },
) {
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('%2F');
  const payload = { commit_message: message };
  if (branch) payload.branch = branch;
  return gitlabFetch(
    `/projects/${pid(owner, repo)}/repository/files/${encodedPath}`,
    credentials.token,
    {
      method: 'DELETE',
      body: JSON.stringify(payload),
    },
  );
}

export async function getCommitComments(credentials, owner, repo, sha, perPage = 20) {
  const comments = await gitlabFetch(
    `/projects/${pid(owner, repo)}/repository/commits/${sha}/comments?per_page=${perPage}`,
    credentials.token,
  );
  return (comments ?? []).map((c) => ({
    ...c,
    user: normalizeUser(c.author),
    body: c.note,
    created_at: c.created_at,
    html_url: `https://gitlab.com/${owner}/${repo}/-/commit/${sha}`,
  }));
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
  const payload = { note: body };
  if (path) payload.path = path;
  if (position !== null) payload.line = position;
  return gitlabFetch(
    `/projects/${pid(owner, repo)}/repository/commits/${sha}/comments`,
    credentials.token,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export async function dismissPRReview(credentials, owner, repo, prNumber, reviewId, message) {
  return gitlabFetch(
    `/projects/${pid(owner, repo)}/merge_requests/${prNumber}/notes/${reviewId}`,
    credentials.token,
    { method: 'PUT', body: JSON.stringify({ body: `[Dismissed] ${message}` }) },
  );
}

export async function cancelWorkflowRun(credentials, owner, repo, runId) {
  return gitlabFetch(`/projects/${pid(owner, repo)}/pipelines/${runId}/cancel`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function rerunWorkflowRun(credentials, owner, repo, runId) {
  return gitlabFetch(`/projects/${pid(owner, repo)}/pipelines/${runId}/retry`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function listWorkflowRunArtifacts(credentials, owner, repo, runId, perPage = 20) {
  const jobs = await gitlabFetch(
    `/projects/${pid(owner, repo)}/pipelines/${runId}/jobs?per_page=50`,
    credentials.token,
  ).catch(() => []);
  const artifacts = (jobs ?? []).flatMap((j) =>
    (j.artifacts ?? []).map((a) => ({
      id: j.id,
      name: `${j.name}:${a.file_type ?? 'artifact'}`,
      size_in_bytes: a.size ?? 0,
      expires_at: a.expire_at ?? null,
      expired: false,
    })),
  );
  return { artifacts };
}

export async function checkIfStarred(credentials, owner, repo) {
  const user = await getUser(credentials);
  const starrers = await getStargazers(credentials, owner, repo, 100).catch(() => []);
  return (starrers ?? []).some((s) => s.id === user.id || s.login === user.login);
}

export async function followUser(credentials, username) {
  const user = await getUserInfo(credentials, username);
  return gitlabFetch(`/users/${user.id}/follow`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function unfollowUser(credentials, username) {
  const user = await getUserInfo(credentials, username);
  return gitlabFetch(`/users/${user.id}/unfollow`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function getIssueEvents(credentials, owner, repo, issueNumber, perPage = 30) {
  const events = await gitlabFetch(
    `/projects/${pid(owner, repo)}/issues/${issueNumber}/resource_state_events?per_page=${perPage}`,
    credentials.token,
  ).catch(() => []);
  return (events ?? []).map((e) => ({
    ...e,
    event: e.state ?? 'unknown',
    actor: normalizeUser(e.user),
  }));
}

export async function updateGist(credentials, gistId, { description, files } = {}) {
  const payload = {};
  if (description !== undefined) {
    payload.title = description;
    payload.description = description;
  }
  if (files !== undefined) {
    payload.files = Object.entries(files).map(([filename, { content }]) => ({
      file_name: filename,
      content: content ?? '',
    }));
  }
  const snippet = await gitlabFetch(`/snippets/${gistId}`, credentials.token, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return { ...snippet, html_url: snippet.web_url };
}

export async function deleteGist(credentials, gistId) {
  return gitlabFetch(`/snippets/${gistId}`, credentials.token, { method: 'DELETE' });
}

export async function transferIssue(credentials, owner, repo, issueNumber, newOwner) {
  throw new Error(
    'transferIssue requires the target project numeric ID in GitLab. Use the GitLab web UI or API directly with the project ID.',
  );
}

export async function replaceTopics(credentials, owner, repo, names = []) {
  const project = await gitlabFetch(`/projects/${pid(owner, repo)}`, credentials.token, {
    method: 'PUT',
    body: JSON.stringify({ topics: names }),
  });
  return { names: project.topics ?? [] };
}

export async function getAuthenticatedUser(credentials) {
  const u = await gitlabFetch('/user', credentials.token);
  return {
    ...normalizeUser(u),
    name: u.name,
    email: u.email ?? '',
    bio: u.bio ?? '',
    company: u.organization ?? '',
    location: u.location ?? '',
    blog: u.website_url ?? '',
    public_repos: u.public_repos ?? 0,
    total_private_repos: null,
    followers: u.followers ?? 0,
    following: u.following ?? 0,
    plan: { name: u.is_admin ? 'admin' : 'free' },
    created_at: u.created_at,
    html_url: u.web_url,
  };
}

export async function updateIssueComment(credentials, owner, repo, commentId, body) {
  return gitlabFetch(`/projects/${pid(owner, repo)}/issues/notes/${commentId}`, credentials.token, {
    method: 'PUT',
    body: JSON.stringify({ body }),
  });
}

export async function deleteIssueComment(credentials, owner, repo, commentId) {
  return gitlabFetch(`/projects/${pid(owner, repo)}/issues/notes/${commentId}`, credentials.token, {
    method: 'DELETE',
  });
}

const EMOJI_TO_GL = {
  '+1': 'thumbsup',
  '-1': 'thumbsdown',
  laugh: 'laughing',
  hooray: 'tada',
  confused: 'confused',
  heart: 'heart',
  rocket: 'rocket',
  eyes: 'eyes',
};

export async function addReactionToIssue(credentials, owner, repo, issueNumber, content) {
  const emoji = EMOJI_TO_GL[content] ?? content;
  return gitlabFetch(
    `/projects/${pid(owner, repo)}/issues/${issueNumber}/award_emoji`,
    credentials.token,
    {
      method: 'POST',
      body: JSON.stringify({ name: emoji }),
    },
  );
}

export async function addReactionToComment(credentials, owner, repo, commentId, content) {
  const emoji = EMOJI_TO_GL[content] ?? content;
  return gitlabFetch(
    `/projects/${pid(owner, repo)}/issues/notes/${commentId}/award_emoji`,
    credentials.token,
    {
      method: 'POST',
      body: JSON.stringify({ name: emoji }),
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
  return gitlabFetch(
    `/projects/${pid(owner, repo)}/vulnerability_findings?per_page=${perPage}&scanner_ids[]=sast`,
    credentials.token,
  ).catch(() => []);
}

export async function getSecretScanningAlerts(
  credentials,
  owner,
  repo,
  state = 'open',
  perPage = 20,
) {
  return gitlabFetch(
    `/projects/${pid(owner, repo)}/vulnerability_findings?per_page=${perPage}&scanner_ids[]=secret_detection`,
    credentials.token,
  ).catch(() => []);
}

export async function deleteWorkflowRun(credentials, owner, repo, runId) {
  return gitlabFetch(`/projects/${pid(owner, repo)}/pipelines/${runId}`, credentials.token, {
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
  const jobs = await gitlabFetch(
    `/projects/${pid(owner, repo)}/pipelines/${runId}/jobs?per_page=${perPage}`,
    credentials.token,
  );
  return {
    jobs: (jobs ?? []).map((j) => ({
      id: j.id,
      name: j.name,
      status: j.status,
      conclusion: j.status === 'success' ? 'success' : j.status === 'failed' ? 'failure' : null,
      runner_name: j.runner?.description ?? null,
      started_at: j.started_at,
      completed_at: j.finished_at,
      html_url: j.web_url,
      steps: (j.steps ?? []).map((s, idx) => ({
        number: idx + 1,
        name: s.name,
        status: s.status,
        conclusion: s.status,
      })),
    })),
  };
}

export async function checkTeamMembership(credentials, org, teamSlug, username) {
  const user = await getUserInfo(credentials, username);
  const member = await gitlabFetch(
    `/groups/${encodeURIComponent(teamSlug)}/members/${user.id}`,
    credentials.token,
  );
  const roleMap = { 50: 'owner', 40: 'maintainer', 30: 'developer', 20: 'reporter', 10: 'guest' };
  return {
    role: roleMap[member.access_level] ?? 'member',
    state: 'active',
  };
}

export async function listGistComments(credentials, gistId, perPage = 30) {
  const notes = await gitlabFetch(
    `/snippets/${gistId}/notes?per_page=${perPage}`,
    credentials.token,
  );
  return (notes ?? []).map((n) => ({
    ...n,
    user: normalizeUser(n.author),
    body: n.body,
  }));
}

export async function createGistComment(credentials, gistId, body) {
  const note = await gitlabFetch(`/snippets/${gistId}/notes`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
  return { ...note, url: `https://gitlab.com/-/snippets/${gistId}#note_${note.id}` };
}

export async function getRepoActionsPermissions(credentials, owner, repo) {
  const project = await gitlabFetch(`/projects/${pid(owner, repo)}`, credentials.token);
  return {
    enabled: project.shared_runners_enabled ?? true,
    allowed_actions: 'all',
    selected_actions_url: null,
  };
}

export async function getOrgWebhooks(credentials, org, perPage = 30) {
  const hooks = await gitlabFetch(
    `/groups/${encodeURIComponent(org)}/hooks?per_page=${perPage}`,
    credentials.token,
  );
  return (hooks ?? []).map((h) => ({
    ...h,
    config: { url: h.url },
    events: Object.entries(h)
      .filter(([k, v]) => k.endsWith('_events') && v === true)
      .map(([k]) => k.replace('_events', '')),
    active: h.enable_ssl_verification != null,
    created_at: h.created_at,
  }));
}

export async function listUserRepoInvitations(credentials) {
  return gitlabFetch('/user/projects/invitations', credentials.token).catch(() => []);
}

export async function acceptRepoInvitation(credentials, invitationId) {
  return gitlabFetch(`/user/projects/invitations/${invitationId}`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({}),
  }).catch(() => null);
}

export async function declineRepoInvitation(credentials, invitationId) {
  return gitlabFetch(`/user/projects/invitations/${invitationId}`, credentials.token, {
    method: 'DELETE',
  }).catch(() => null);
}

export async function getUserPublicKeys(credentials, username) {
  const user = await getUserInfo(credentials, username);
  return gitlabFetch(`/users/${user.id}/keys`, credentials.token);
}

export async function starGist(credentials, gistId) {
  return gitlabFetch(`/snippets/${gistId}/award_emoji`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({ name: 'star2' }),
  }).catch(() => null);
}

export async function unstarGist(credentials, gistId) {
  return null;
}

export async function checkGistStarred(credentials, gistId) {
  return false;
}
