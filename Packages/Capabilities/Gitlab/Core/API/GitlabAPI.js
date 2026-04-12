function pid(owner, repo) {
  return encodeURIComponent(`${owner}/${repo}`);
}
async function gitlabFetch(endpoint, token, options = {}) {
  const res = await fetch(`https://gitlab.com/api/v4${endpoint}`, {
    ...options,
    headers: {
      'PRIVATE-TOKEN': token,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})),
      msg = Array.isArray(err?.message)
        ? err.message.join(', ')
        : (err?.message ?? `GitLab API ${res.status}`);
    throw new Error(msg);
  }
  return 204 === res.status ? null : res.json();
}
function normalizeUser(user) {
  return user ? { ...user, login: user.username ?? user.name, avatar_url: user.avatar_url } : null;
}
function normalizeRepo(p) {
  return p
    ? {
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
        private: 'private' === p.visibility,
        fork: null != p.forked_from_project,
        created_at: p.created_at,
        updated_at: p.last_activity_at,
        license: p.license ? { name: p.license.name, spdx_id: p.license.nickname } : null,
        visibility: p.visibility,
      }
    : p;
}
function normalizeIssue(i) {
  return i
    ? {
        ...i,
        number: i.iid,
        body: i.description ?? '',
        state: 'opened' === i.state ? 'open' : i.state,
        user: normalizeUser(i.author),
        html_url: i.web_url,
        labels: (i.labels ?? []).map((l) => ('string' == typeof l ? { name: l } : l)),
        assignees: (i.assignees ?? []).map(normalizeUser),
        milestone: i.milestone ? { title: i.milestone.title, number: i.milestone.iid } : null,
      }
    : i;
}
function normalizePR(mr) {
  return mr
    ? {
        ...mr,
        number: mr.iid,
        body: mr.description ?? '',
        state: 'opened' === mr.state ? 'open' : mr.state,
        user: normalizeUser(mr.author),
        html_url: mr.web_url,
        head: { ref: mr.source_branch, sha: mr.sha ?? '' },
        base: { ref: mr.target_branch },
        additions: mr.additions ?? 0,
        deletions: mr.deletions ?? 0,
        changed_files: mr.changes_count ?? 0,
        commits: mr.commits_count ?? 0,
        mergeable: 'can_be_merged' === mr.merge_status,
        draft: mr.draft ?? !1,
      }
    : mr;
}
function normalizeCommit(c) {
  return c
    ? {
        ...c,
        sha: c.id,
        commit: {
          message: c.message ?? c.title ?? '',
          author: { name: c.author_name, email: c.author_email, date: c.authored_date },
        },
        author: { login: c.author_name },
        html_url: c.web_url,
      }
    : c;
}
function normalizeTodo(t) {
  return t
    ? {
        ...t,
        reason: t.action_name,
        subject: { title: t.target_title },
        repository: { full_name: t.project?.path_with_namespace ?? '' },
      }
    : t;
}
function normalizeLabel(l) {
  return l ? { ...l, color: (l.color ?? '').replace('#', '') } : l;
}
function normalizeMilestone(m) {
  return m
    ? {
        ...m,
        number: m.iid,
        html_url: m.web_url,
        due_on: m.due_date ?? null,
        open_issues: m.statistics?.count ?? 0,
        closed_issues: 0,
      }
    : m;
}
function normalizeRelease(r) {
  return r
    ? {
        ...r,
        tag_name: r.tag_name,
        name: r.name,
        body: r.description ?? '',
        html_url: r.links?.self ?? '',
        published_at: r.released_at ?? r.created_at,
        prerelease: !1,
        draft: !1,
      }
    : r;
}
function normalizeBranch(b) {
  return b
    ? { ...b, name: b.name, commit: { sha: b.commit?.id }, protected: b.protected ?? !1 }
    : b;
}
function normalizeTag(t) {
  return t ? { ...t, commit: { sha: t.commit?.id } } : t;
}
function normalizeDeployment(d) {
  return d
    ? {
        ...d,
        id: d.id,
        ref: d.ref,
        environment: d.environment?.name ?? '',
        creator: normalizeUser(d.user),
        created_at: d.created_at,
        html_url: d.deployable?.web_url ?? '',
      }
    : d;
}
function normalizePipelineToRun(p) {
  return p
    ? {
        ...p,
        id: p.id,
        run_number: p.id,
        name: `Pipeline #${p.id}`,
        status: p.status,
        conclusion:
          'success' === p.status
            ? 'success'
            : 'failed' === p.status
              ? 'failure'
              : 'canceled' === p.status
                ? 'cancelled'
                : null,
        event: p.source ?? 'push',
        head_branch: p.ref,
        created_at: p.created_at,
        updated_at: p.updated_at,
        html_url: p.web_url,
      }
    : p;
}
export async function getUser(credentials) {
  return normalizeUser(await gitlabFetch('/user', credentials.token));
}
export async function getRepos(credentials, perPage = 30) {
  return (
    (await gitlabFetch(
      `/projects?membership=true&order_by=last_activity_at&per_page=${perPage}`,
      credentials.token,
    )) ?? []
  ).map(normalizeRepo);
}
export async function getRepoTree(credentials, owner, repo, branch) {
  const ref = branch || 'HEAD';
  return {
    tree: (
      (await gitlabFetch(
        `/projects/${pid(owner, repo)}/repository/tree?recursive=true&ref=${encodeURIComponent(ref)}&per_page=100`,
        credentials.token,
      ).catch(() => [])) ?? []
    ).map((item) => ({
      path: item.path,
      type: 'tree' === item.type ? 'tree' : 'blob',
      sha: item.id,
    })),
  };
}
export async function getFileContent(credentials, owner, repo, filePath) {
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('%2F'),
    data = await gitlabFetch(
      `/projects/${pid(owner, repo)}/repository/files/${encodedPath}?ref=HEAD`,
      credentials.token,
    ),
    content =
      'base64' === data.encoding
        ? Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8')
        : data.content;
  return {
    path: data.file_path,
    name: data.file_name,
    content: content,
    sha: data.blob_id,
    size: data.size,
    url: `https://gitlab.com/${owner}/${repo}/-/blob/${data.ref}/${data.file_path}`,
  };
}
export async function getIssues(credentials, owner, repo, state = 'open', perPage = 20) {
  const glState = 'open' === state ? 'opened' : 'closed' === state ? 'closed' : 'all';
  return (
    (await gitlabFetch(
      `/projects/${pid(owner, repo)}/issues?state=${glState}&per_page=${perPage}&order_by=updated_at&not[labels]=`,
      credentials.token,
    )) ?? []
  ).map(normalizeIssue);
}
export async function getPullRequests(credentials, owner, repo, state = 'open', perPage = 20) {
  const glState =
    'open' === state
      ? 'opened'
      : 'closed' === state
        ? 'closed'
        : 'merged' === state
          ? 'merged'
          : 'all';
  return (
    (await gitlabFetch(
      `/projects/${pid(owner, repo)}/merge_requests?state=${glState}&per_page=${perPage}&order_by=updated_at`,
      credentials.token,
    )) ?? []
  ).map(normalizePR);
}
export async function getCommits(credentials, owner, repo, perPage = 20) {
  return (
    (await gitlabFetch(
      `/projects/${pid(owner, repo)}/repository/commits?per_page=${perPage}`,
      credentials.token,
    )) ?? []
  ).map(normalizeCommit);
}
export async function getNotifications(credentials, unreadOnly = !0) {
  const state = unreadOnly ? '?state=pending' : '';
  return ((await gitlabFetch(`/todos${state}&per_page=50`, credentials.token)) ?? []).map(
    normalizeTodo,
  );
}
export async function getBranches(credentials, owner, repo) {
  return (
    (await gitlabFetch(
      `/projects/${pid(owner, repo)}/repository/branches?per_page=100`,
      credentials.token,
    )) ?? []
  ).map(normalizeBranch);
}
export async function createIssue(credentials, owner, repo, title, body, labels = []) {
  return normalizeIssue(
    await gitlabFetch(`/projects/${pid(owner, repo)}/issues`, credentials.token, {
      method: 'POST',
      body: JSON.stringify({ title: title, description: body, labels: labels.join(',') }),
    }),
  );
}
export async function searchCode(credentials, query, scope) {
  if (scope) {
    const parts = scope.split('/'),
      owner = parts[0],
      repo = parts.slice(1).join('/'),
      results = await gitlabFetch(
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
  return (
    (await gitlabFetch(
      `/projects/${pid(owner, repo)}/releases?per_page=${perPage}`,
      credentials.token,
    )) ?? []
  ).map(normalizeRelease);
}
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
  return ((await getPRFiles(credentials, owner, repo, prNumber)) ?? [])
    .map((c) => c.patch)
    .join('\n');
}
export async function getPRDetails(credentials, owner, repo, prNumber) {
  return normalizePR(
    await gitlabFetch(
      `/projects/${pid(owner, repo)}/merge_requests/${prNumber}`,
      credentials.token,
    ),
  );
}
export async function createPRReview(
  credentials,
  owner,
  repo,
  prNumber,
  { body: body, event: event = 'COMMENT', comments: comments = [] },
) {
  'APPROVE' === event &&
    (await gitlabFetch(
      `/projects/${pid(owner, repo)}/merge_requests/${prNumber}/approve`,
      credentials.token,
      { method: 'POST', body: JSON.stringify({}) },
    ).catch(() => null));
  const note = await gitlabFetch(
    `/projects/${pid(owner, repo)}/merge_requests/${prNumber}/notes`,
    credentials.token,
    { method: 'POST', body: JSON.stringify({ body: body }) },
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
  return (
    (await gitlabFetch(
      `/projects/${pid(owner, repo)}/merge_requests/${prNumber}/notes?per_page=100&sort=asc`,
      credentials.token,
    )) ?? []
  ).map((n) => ({
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
    ).catch(() => []),
    latest = pipelines?.[0];
  let jobs = [];
  return (
    latest?.id &&
      (jobs = await gitlabFetch(
        `/projects/${pid(owner, repo)}/pipelines/${latest.id}/jobs?per_page=50`,
        credentials.token,
      ).catch(() => [])),
    {
      prNumber: prNumber,
      sha: latest?.sha ?? 'unknown',
      state: latest?.status ?? 'unknown',
      statuses: [],
      checkRuns: (jobs ?? []).map((j) => ({
        id: j.id,
        name: j.name,
        status:
          'success' === j.status ? 'completed' : 'pending' === j.status ? 'queued' : 'in_progress',
        conclusion: 'success' === j.status ? 'success' : 'failed' === j.status ? 'failure' : null,
        html_url: j.web_url,
      })),
      totalCount: jobs?.length ?? 0,
    }
  );
}
export async function getWorkflowRuns(
  credentials,
  owner,
  repo,
  { branch: branch = '', event: event = '', perPage: perPage = 20 } = {},
) {
  const qs = new URLSearchParams({ per_page: String(perPage || 20) });
  (branch && qs.set('ref', branch), event && qs.set('source', event));
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
  { title: title, body: body = '', head: head, base: base, draft: draft = !1 },
) {
  if (!head || !base) throw new Error('createPR: head and base branches are required');
  return normalizePR(
    await gitlabFetch(`/projects/${pid(owner, repo)}/merge_requests`, credentials.token, {
      method: 'POST',
      body: JSON.stringify({
        title: title,
        description: body,
        source_branch: head,
        target_branch: base,
        draft: draft,
      }),
    }),
  );
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
  return (
    commitTitle && (payload.merge_commit_message = commitTitle),
    'squash' === mergeMethod && (payload.squash = !0),
    'rebase' === mergeMethod && (payload.rebase = !0),
    gitlabFetch(
      `/projects/${pid(owner, repo)}/merge_requests/${prNumber}/merge`,
      credentials.token,
      { method: 'PUT', body: JSON.stringify(payload) },
    )
  );
}
export async function closePR(credentials, owner, repo, prNumber) {
  return normalizePR(
    await gitlabFetch(
      `/projects/${pid(owner, repo)}/merge_requests/${prNumber}`,
      credentials.token,
      { method: 'PUT', body: JSON.stringify({ state_event: 'close' }) },
    ),
  );
}
export async function closeIssue(credentials, owner, repo, issueNumber, reason = 'completed') {
  return normalizeIssue(
    await gitlabFetch(`/projects/${pid(owner, repo)}/issues/${issueNumber}`, credentials.token, {
      method: 'PUT',
      body: JSON.stringify({ state_event: 'close' }),
    }),
  );
}
export async function reopenIssue(credentials, owner, repo, issueNumber) {
  return normalizeIssue(
    await gitlabFetch(`/projects/${pid(owner, repo)}/issues/${issueNumber}`, credentials.token, {
      method: 'PUT',
      body: JSON.stringify({ state_event: 'reopen' }),
    }),
  );
}
export async function addIssueComment(credentials, owner, repo, issueNumber, body) {
  const note = await gitlabFetch(
    `/projects/${pid(owner, repo)}/issues/${issueNumber}/notes`,
    credentials.token,
    { method: 'POST', body: JSON.stringify({ body: body }) },
  );
  return {
    ...note,
    html_url: note?.html_url ?? `https://gitlab.com/${owner}/${repo}/-/issues/${issueNumber}`,
  };
}
export async function addLabels(credentials, owner, repo, issueNumber, labels = []) {
  const existing =
      (await gitlabFetch(`/projects/${pid(owner, repo)}/issues/${issueNumber}`, credentials.token))
        .labels ?? [],
    merged = [...new Set([...existing, ...labels])];
  return (
    (
      await gitlabFetch(`/projects/${pid(owner, repo)}/issues/${issueNumber}`, credentials.token, {
        method: 'PUT',
        body: JSON.stringify({ labels: merged.join(',') }),
      })
    ).labels ?? []
  ).map((l) => ({ name: l }));
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
      ref: ref,
      variables: Object.entries(inputs).map(([key, value]) => ({
        key: key,
        value: String(value),
        variable_type: 'env_var',
      })),
    }),
  });
}
export async function getLatestWorkflowRun(credentials, owner, repo, workflowId, branch = '') {
  const qs = new URLSearchParams({ per_page: '1' });
  branch && qs.set('ref', branch);
  const pipelines = await gitlabFetch(
    `/projects/${pid(owner, repo)}/pipelines?${qs.toString()}`,
    credentials.token,
  );
  return pipelines?.[0] ? normalizePipelineToRun(pipelines[0]) : null;
}
export async function createGist(credentials, description, files, isPublic = !1) {
  const snippetFiles = Object.entries(files).map(([filename, { content: content }]) => ({
      file_name: filename,
      content: content ?? '',
    })),
    snippet = await gitlabFetch('/snippets', credentials.token, {
      method: 'POST',
      body: JSON.stringify({
        title: description || Object.keys(files)[0] || 'snippet',
        description: description,
        visibility: isPublic ? 'public' : 'private',
        files: snippetFiles,
      }),
    });
  return { ...snippet, html_url: snippet?.web_url };
}
export async function getIssueDetails(credentials, owner, repo, issueNumber) {
  return normalizeIssue(
    await gitlabFetch(`/projects/${pid(owner, repo)}/issues/${issueNumber}`, credentials.token),
  );
}
export async function updateIssue(
  credentials,
  owner,
  repo,
  issueNumber,
  { title: title, body: body, state: state, labels: labels, assignees: assignees } = {},
) {
  const payload = {};
  if (
    (void 0 !== title && (payload.title = title),
    void 0 !== body && (payload.description = body),
    void 0 !== state && (payload.state_event = 'open' === state ? 'reopen' : 'close'),
    void 0 !== labels && (payload.labels = Array.isArray(labels) ? labels.join(',') : labels),
    void 0 !== assignees)
  ) {
    const names = Array.isArray(assignees)
        ? assignees
        : String(assignees)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
      ids = (
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
  return normalizeIssue(
    await gitlabFetch(`/projects/${pid(owner, repo)}/issues/${issueNumber}`, credentials.token, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  );
}
export async function getContributors(credentials, owner, repo, perPage = 30) {
  return (
    (await gitlabFetch(
      `/projects/${pid(owner, repo)}/repository/contributors?per_page=${perPage}&order_by=commits&sort=desc`,
      credentials.token,
    )) ?? []
  ).map((c) => ({ ...c, login: c.name, contributions: c.commits, html_url: null }));
}
export async function getLanguages(credentials, owner, repo) {
  return gitlabFetch(`/projects/${pid(owner, repo)}/languages`, credentials.token);
}
export async function getTopics(credentials, owner, repo) {
  return {
    names: (await gitlabFetch(`/projects/${pid(owner, repo)}`, credentials.token)).topics ?? [],
  };
}
export async function getMilestones(credentials, owner, repo, state = 'open') {
  const glState = 'open' === state ? 'active' : 'closed' === state ? 'closed' : 'all';
  return (
    (await gitlabFetch(
      `/projects/${pid(owner, repo)}/milestones?state=${glState}&per_page=30`,
      credentials.token,
    )) ?? []
  ).map(normalizeMilestone);
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
    dueOn && (payload.due_date = dueOn.split('T')[0]),
    normalizeMilestone(
      await gitlabFetch(`/projects/${pid(owner, repo)}/milestones`, credentials.token, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    )
  );
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
  return (
    (await gitlabFetch(
      `/projects/${pid(owner, repo)}/forks?per_page=${perPage}&order_by=last_activity_at`,
      credentials.token,
    )) ?? []
  ).map(normalizeRepo);
}
export async function getStargazers(credentials, owner, repo, perPage = 30) {
  return (
    (await gitlabFetch(
      `/projects/${pid(owner, repo)}/starrers?per_page=${perPage}`,
      credentials.token,
    )) ?? []
  ).map((s) => normalizeUser(s.user ?? s));
}
export async function getCollaborators(credentials, owner, repo) {
  return (
    (await gitlabFetch(
      `/projects/${pid(owner, repo)}/members/all?per_page=50`,
      credentials.token,
    )) ?? []
  ).map((m) => ({
    ...normalizeUser(m),
    role_name: m.access_level >= 40 ? 'admin' : m.access_level >= 30 ? 'write' : 'read',
    permissions: { admin: m.access_level >= 40, push: m.access_level >= 30, pull: !0 },
  }));
}
export async function compareBranches(credentials, owner, repo, base, head) {
  const data = await gitlabFetch(
      `/projects/${pid(owner, repo)}/repository/compare?from=${encodeURIComponent(base)}&to=${encodeURIComponent(head)}`,
      credentials.token,
    ),
    commits = data.commits ?? [],
    diffs = data.diffs ?? [];
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
  return ((await gitlabFetch(`/snippets?per_page=${perPage}`, credentials.token)) ?? []).map(
    (s) => ({
      ...s,
      html_url: s.web_url,
      public: 'public' === s.visibility,
      description: s.title ?? s.description ?? '',
      files: s.files
        ? Object.fromEntries(
            s.files.map((f) => [f.filename ?? f.name, { filename: f.filename ?? f.name }]),
          )
        : { [s.file_name ?? 'snippet']: { filename: s.file_name ?? 'snippet' } },
      updated_at: s.updated_at,
    }),
  );
}
export async function getTrafficViews(credentials, owner, repo) {
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
    { method: 'PUT', body: JSON.stringify({ reviewer_ids: userIds }) },
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
  const items = (
    (await gitlabFetch(
      `/projects?search=${encodeURIComponent(query)}&per_page=${perPage}&order_by=last_activity_at&simple=false`,
      credentials.token,
    )) ?? []
  ).map(normalizeRepo);
  return { items: items, total_count: items.length };
}
export async function searchIssues(credentials, query, perPage = 20) {
  const items = (
    (await gitlabFetch(
      `/issues?search=${encodeURIComponent(query)}&per_page=${perPage}&scope=all`,
      credentials.token,
    )) ?? []
  ).map(normalizeIssue);
  return { items: items, total_count: items.length };
}
export async function getIssueComments(credentials, owner, repo, issueNumber, perPage = 30) {
  return (
    (await gitlabFetch(
      `/projects/${pid(owner, repo)}/issues/${issueNumber}/notes?per_page=${perPage}&sort=asc&order_by=created_at`,
      credentials.token,
    )) ?? []
  ).map((n) => ({
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
  return (
    (await gitlabFetch(
      `/projects/${pid(owner, repo)}/repository/tags?per_page=${perPage}`,
      credentials.token,
    )) ?? []
  ).map(normalizeTag);
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
  const payload = { name: name || tagName, tag_name: tagName, description: body };
  return (
    targetCommitish && (payload.ref = targetCommitish),
    normalizeRelease(
      await gitlabFetch(`/projects/${pid(owner, repo)}/releases`, credentials.token, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    )
  );
}
export async function forkRepo(credentials, owner, repo, organization = '') {
  const payload = organization ? { namespace: organization } : {};
  return normalizeRepo(
    await gitlabFetch(`/projects/${pid(owner, repo)}/fork`, credentials.token, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  );
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
    void 0 !== body && (payload.description = body),
    void 0 !== state && (payload.state_event = 'open' === state ? 'reopen' : 'close'),
    void 0 !== base && (payload.target_branch = base),
    normalizePR(
      await gitlabFetch(
        `/projects/${pid(owner, repo)}/merge_requests/${prNumber}`,
        credentials.token,
        { method: 'PUT', body: JSON.stringify(payload) },
      ),
    )
  );
}
export async function getLabels(credentials, owner, repo, perPage = 50) {
  return (
    (await gitlabFetch(
      `/projects/${pid(owner, repo)}/labels?per_page=${perPage}`,
      credentials.token,
    )) ?? []
  ).map(normalizeLabel);
}
export async function createLabel(credentials, owner, repo, name, color, description = '') {
  return normalizeLabel(
    await gitlabFetch(`/projects/${pid(owner, repo)}/labels`, credentials.token, {
      method: 'POST',
      body: JSON.stringify({
        name: name,
        color: color.startsWith('#') ? color : `#${color}`,
        description: description,
      }),
    }),
  );
}
export async function deleteLabel(credentials, owner, repo, name) {
  return gitlabFetch(
    `/projects/${pid(owner, repo)}/labels/${encodeURIComponent(name)}`,
    credentials.token,
    { method: 'DELETE' },
  );
}
export async function searchUsers(credentials, query, perPage = 20) {
  const items = (
    (await gitlabFetch(
      `/users?search=${encodeURIComponent(query)}&per_page=${perPage}`,
      credentials.token,
    )) ?? []
  ).map((u) => ({ ...normalizeUser(u), type: 'User', html_url: u.web_url }));
  return { items: items, total_count: items.length };
}
export async function getUserStarred(credentials, username, perPage = 30) {
  const user = await getUserInfo(credentials, username);
  return (
    (await gitlabFetch(
      `/users/${user.id}/starred_projects?per_page=${perPage}&order_by=last_activity_at`,
      credentials.token,
    ).catch(() => [])) ?? []
  ).map(normalizeRepo);
}
export async function getFileCommits(credentials, owner, repo, filePath, perPage = 15) {
  return (
    (await gitlabFetch(
      `/projects/${pid(owner, repo)}/repository/commits?path=${encodeURIComponent(filePath)}&per_page=${perPage}`,
      credentials.token,
    )) ?? []
  ).map(normalizeCommit);
}
export async function lockIssue(credentials, owner, repo, issueNumber, lockReason = '') {
  return gitlabFetch(`/projects/${pid(owner, repo)}/issues/${issueNumber}`, credentials.token, {
    method: 'PUT',
    body: JSON.stringify({ discussion_locked: !0 }),
  });
}
export async function unlockIssue(credentials, owner, repo, issueNumber) {
  return gitlabFetch(`/projects/${pid(owner, repo)}/issues/${issueNumber}`, credentials.token, {
    method: 'PUT',
    body: JSON.stringify({ discussion_locked: !1 }),
  });
}
export async function getDeployments(credentials, owner, repo, perPage = 20) {
  return (
    (await gitlabFetch(
      `/projects/${pid(owner, repo)}/deployments?per_page=${perPage}&order_by=created_at&sort=desc`,
      credentials.token,
    )) ?? []
  ).map(normalizeDeployment);
}
export async function getRepoPermissions(credentials, owner, repo, username) {
  const user = await getUserInfo(credentials, username),
    member = await gitlabFetch(
      `/projects/${pid(owner, repo)}/members/${user.id}`,
      credentials.token,
    );
  return {
    permission:
      { 50: 'admin', 40: 'admin', 30: 'write', 20: 'read', 10: 'read' }[member.access_level] ??
      'none',
    user: normalizeUser(member),
  };
}
export async function removeLabels(credentials, owner, repo, issueNumber, labels = []) {
  return (
    (
      await gitlabFetch(`/projects/${pid(owner, repo)}/issues/${issueNumber}`, credentials.token, {
        method: 'PUT',
        body: JSON.stringify({ labels: labels.join(',') }),
      })
    ).labels ?? []
  ).map((l) => ({ name: l }));
}
export async function getPRRequestedReviewers(credentials, owner, repo, prNumber) {
  return {
    users: (
      (
        await gitlabFetch(
          `/projects/${pid(owner, repo)}/merge_requests/${prNumber}`,
          credentials.token,
        )
      ).reviewers ?? []
    ).map(normalizeUser),
    teams: [],
  };
}
export async function getRepoInfo(credentials, owner, repo) {
  return normalizeRepo(await gitlabFetch(`/projects/${pid(owner, repo)}`, credentials.token));
}
export async function getOrgRepos(credentials, org, perPage = 30) {
  return (
    (await gitlabFetch(
      `/groups/${encodeURIComponent(org)}/projects?per_page=${perPage}&order_by=last_activity_at`,
      credentials.token,
    )) ?? []
  ).map(normalizeRepo);
}
export async function watchRepo(credentials, owner, repo, subscribed = !0) {
  const action = subscribed ? 'subscribe' : 'unsubscribe';
  return gitlabFetch(`/projects/${pid(owner, repo)}/${action}`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({}),
  }).catch(() => null);
}
export async function getUserEvents(credentials, username, perPage = 20) {
  const user = await getUserInfo(credentials, username);
  return (
    (await gitlabFetch(`/users/${user.id}/events?per_page=${perPage}`, credentials.token)) ?? []
  ).map((e) => ({
    ...e,
    type: e.action_name,
    repo: { name: e.project_id ? `project:${e.project_id}` : 'unknown' },
    created_at: e.created_at,
  }));
}
export async function getRepoEnvironments(credentials, owner, repo) {
  return {
    environments: (
      (await gitlabFetch(
        `/projects/${pid(owner, repo)}/environments?per_page=50`,
        credentials.token,
      )) ?? []
    ).map((e) => ({
      ...e,
      name: e.name,
      protection_rules: e.required_approval_count > 0 ? [{ type: 'required_reviewers' }] : [],
      updated_at: e.last_deployment?.created_at ?? null,
    })),
  };
}
export async function listActionsSecrets(credentials, owner, repo) {
  return {
    secrets: (
      (await gitlabFetch(
        `/projects/${pid(owner, repo)}/variables?per_page=100`,
        credentials.token,
      )) ?? []
    ).map((v) => ({ name: v.key, updated_at: null })),
  };
}
export async function getDependabotAlerts(credentials, owner, repo, state = 'open', perPage = 20) {
  return (
    (await gitlabFetch(
      `/projects/${pid(owner, repo)}/vulnerability_findings?per_page=${perPage}&scanner_ids[]=dependency_scanning`,
      credentials.token,
    ).catch(() => [])) ?? []
  );
}
export async function getCommitsSince(credentials, owner, repo, since, until = '', perPage = 20) {
  const qs = new URLSearchParams({ per_page: String(perPage) });
  return (
    since && qs.set('since', since),
    until && qs.set('until', until),
    (
      (await gitlabFetch(
        `/projects/${pid(owner, repo)}/repository/commits?${qs.toString()}`,
        credentials.token,
      )) ?? []
    ).map(normalizeCommit)
  );
}
export async function getBranchProtection(credentials, owner, repo, branch) {
  return gitlabFetch(
    `/projects/${pid(owner, repo)}/protected_branches/${encodeURIComponent(branch)}`,
    credentials.token,
  );
}
export async function getUserOrgs(credentials, username) {
  const user = await getUserInfo(credentials, username);
  return (
    (await gitlabFetch(`/users/${user.id}/groups?per_page=50`, credentials.token).catch(
      () => [],
    )) ?? []
  ).map((g) => ({ login: g.path, description: g.description ?? '', html_url: g.web_url }));
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
  return ((await gitlabFetch(`/projects/${pid(owner, repo)}/hooks`, credentials.token)) ?? []).map(
    (h) => ({
      ...h,
      config: { url: h.url },
      events: Object.entries(h)
        .filter(([k, v]) => k.endsWith('_events') && !0 === v)
        .map(([k]) => k.replace('_events', '')),
      active: null != h.enable_ssl_verification,
    }),
  );
}
export async function getOrgMembers(credentials, org, perPage = 30) {
  return (
    (await gitlabFetch(
      `/groups/${encodeURIComponent(org)}/members?per_page=${perPage}`,
      credentials.token,
    )) ?? []
  ).map((m) => ({ ...normalizeUser(m), html_url: m.web_url }));
}
export async function listOrgTeams(credentials, org, perPage = 30) {
  return (
    (await gitlabFetch(
      `/groups/${encodeURIComponent(org)}/subgroups?per_page=${perPage}`,
      credentials.token,
    )) ?? []
  ).map((g) => ({
    ...g,
    name: g.name,
    slug: g.path,
    description: g.description ?? '',
    members_count: null,
    repos_count: null,
  }));
}
export async function getTeamMembers(credentials, org, teamSlug, perPage = 30) {
  return (
    (await gitlabFetch(
      `/groups/${encodeURIComponent(teamSlug)}/members?per_page=${perPage}`,
      credentials.token,
    )) ?? []
  ).map((m) => ({ ...normalizeUser(m), html_url: m.web_url }));
}
export async function getIssueReactions(credentials, owner, repo, issueNumber) {
  const emojis = await gitlabFetch(
      `/projects/${pid(owner, repo)}/issues/${issueNumber}/award_emoji`,
      credentials.token,
    ),
    glToGh = {
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
  return ((await getContributors(credentials, owner, repo)) ?? []).map((c) => ({
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
  return { subscribed: null, ignored: !1, reason: null };
}
export async function getUserFollowers(credentials, username, perPage = 30) {
  return [];
}
export async function getUserFollowing(credentials, username, perPage = 30) {
  return [];
}
export async function getUserGists(credentials, username, perPage = 20) {
  const user = await getUserInfo(credentials, username);
  return (
    (await gitlabFetch(
      `/snippets?author_id=${user.id}&per_page=${perPage}`,
      credentials.token,
    ).catch(() => [])) ?? []
  ).map((s) => ({
    ...s,
    html_url: s.web_url,
    public: 'public' === s.visibility,
    description: s.title ?? s.description ?? '',
    files: s.files
      ? Object.fromEntries(s.files.map((f) => [f.filename ?? f.name, {}]))
      : { [s.file_name ?? 'snippet']: {} },
  }));
}
export async function getGistDetails(credentials, gistId) {
  const snippet = await gitlabFetch(`/snippets/${gistId}`, credentials.token),
    content = await gitlabFetch(`/snippets/${gistId}/raw`, credentials.token).catch(() => null);
  return {
    ...snippet,
    html_url: snippet.web_url,
    public: 'public' === snippet.visibility,
    description: snippet.title ?? snippet.description ?? '',
    owner: normalizeUser(snippet.author),
    files: snippet.files
      ? Object.fromEntries(
          snippet.files.map((f) => [
            f.filename ?? f.name,
            {
              filename: f.filename ?? f.name,
              content: 'string' == typeof content ? content : null,
            },
          ]),
        )
      : {
          [snippet.file_name ?? 'snippet']: {
            filename: snippet.file_name,
            content: 'string' == typeof content ? content : null,
          },
        },
    comments: snippet.user_notes_count ?? 0,
    forks: [],
  };
}
export async function getPRCommits(credentials, owner, repo, prNumber, perPage = 30) {
  return (
    (await gitlabFetch(
      `/projects/${pid(owner, repo)}/merge_requests/${prNumber}/commits?per_page=${perPage}`,
      credentials.token,
    )) ?? []
  ).map(normalizeCommit);
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
  const items = (
    (await gitlabFetch(
      `/search?scope=commits&search=${encodeURIComponent(query)}&per_page=${perPage}`,
      credentials.token,
    )) ?? []
  ).map((c) => ({
    ...normalizeCommit(c),
    repository: { full_name: c.project_id ? `project:${c.project_id}` : 'unknown' },
  }));
  return { items: items, total_count: items.length };
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
      core: { limit: 2e3, remaining: null, reset: null },
      search: { limit: 30, remaining: null, reset: null },
      graphql: { limit: 2e3, remaining: null, reset: null },
    },
  };
}
export async function listWorkflows(credentials, owner, repo, perPage = 30) {
  return {
    workflows: (
      (await gitlabFetch(
        `/projects/${pid(owner, repo)}/pipeline_schedules?per_page=${perPage}`,
        credentials.token,
      )) ?? []
    ).map((s) => ({
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
    path: '.gitlab-ci.yml',
    html_url: null,
    badge_url: null,
    created_at: s.created_at,
    updated_at: s.updated_at,
  };
}
export async function getActionsRunners(credentials, owner, repo) {
  return {
    runners: (
      (await gitlabFetch(`/projects/${pid(owner, repo)}/runners?per_page=50`, credentials.token)) ??
      []
    ).map((r) => ({
      id: r.id,
      name: r.description || r.name || `Runner #${r.id}`,
      status: r.active ? 'online' : 'offline',
      os: r.platform ?? 'unknown',
      labels: (r.tag_list ?? []).map((t) => ({ name: t })),
    })),
  };
}
export async function getActionsVariables(credentials, owner, repo, perPage = 30) {
  return {
    variables: (
      (await gitlabFetch(
        `/projects/${pid(owner, repo)}/variables?per_page=${perPage}`,
        credentials.token,
      )) ?? []
    ).map((v) => ({ name: v.key, value: v.masked ? '***' : v.value, updated_at: null })),
  };
}
export async function getActionsCache(credentials, owner, repo, perPage = 30) {
  return { actions_caches: [] };
}
export async function getTeamRepos(credentials, org, teamSlug, perPage = 30) {
  return (
    (await gitlabFetch(
      `/groups/${encodeURIComponent(teamSlug)}/projects?per_page=${perPage}&order_by=last_activity_at`,
      credentials.token,
    )) ?? []
  ).map((p) => ({ ...normalizeRepo(p), permissions: { admin: !1, push: !0, pull: !0 } }));
}
export async function getUserRepos(credentials, username, perPage = 30) {
  return (
    (await gitlabFetch(
      `/users/${encodeURIComponent(username)}/projects?per_page=${perPage}&order_by=last_activity_at`,
      credentials.token,
    )) ?? []
  ).map(normalizeRepo);
}
export async function getIssueTimeline(credentials, owner, repo, issueNumber, perPage = 30) {
  return (
    (await gitlabFetch(
      `/projects/${pid(owner, repo)}/issues/${issueNumber}/resource_state_events?per_page=${perPage}`,
      credentials.token,
    ).catch(() => [])) ?? []
  ).map((e) => ({
    ...e,
    event: e.state ?? e.action_name ?? 'unknown',
    actor: normalizeUser(e.user),
    created_at: e.created_at,
  }));
}
export async function getOrgSecrets(credentials, org, perPage = 30) {
  return {
    secrets: (
      (await gitlabFetch(
        `/groups/${encodeURIComponent(org)}/variables?per_page=${perPage}`,
        credentials.token,
      )) ?? []
    ).map((v) => ({ name: v.key, visibility: v.environment_scope || 'all', updated_at: null })),
  };
}
export async function getSingleComment(credentials, owner, repo, commentId) {
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
  return {
    variables: (
      (await gitlabFetch(
        `/groups/${encodeURIComponent(org)}/variables?per_page=${perPage}`,
        credentials.token,
      )) ?? []
    ).map((v) => ({
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
      'success' === job.status ? 'completed' : 'pending' === job.status ? 'queued' : 'in_progress',
    conclusion: 'success' === job.status ? 'success' : 'failed' === job.status ? 'failure' : null,
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
  { name: name, description: description = '', private: isPrivate = !1, autoInit: autoInit = !1 },
) {
  return normalizeRepo(
    await gitlabFetch('/projects', credentials.token, {
      method: 'POST',
      body: JSON.stringify({
        name: name,
        description: description,
        visibility: isPrivate ? 'private' : 'public',
        initialize_with_readme: autoInit,
      }),
    }),
  );
}
export async function updateRepo(credentials, owner, repo, payload = {}) {
  const glPayload = {};
  return (
    void 0 !== payload.description && (glPayload.description = payload.description),
    void 0 !== payload.homepage && (glPayload.homepage = payload.homepage),
    void 0 !== payload.private && (glPayload.visibility = payload.private ? 'private' : 'public'),
    void 0 !== payload.default_branch && (glPayload.default_branch = payload.default_branch),
    void 0 !== payload.has_issues && (glPayload.issues_enabled = payload.has_issues),
    void 0 !== payload.has_wiki && (glPayload.wiki_enabled = payload.has_wiki),
    void 0 !== payload.has_projects && (glPayload.snippets_enabled = payload.has_projects),
    normalizeRepo(
      await gitlabFetch(`/projects/${pid(owner, repo)}`, credentials.token, {
        method: 'PUT',
        body: JSON.stringify(glPayload),
      }),
    )
  );
}
export async function deleteRepo(credentials, owner, repo) {
  return gitlabFetch(`/projects/${pid(owner, repo)}`, credentials.token, { method: 'DELETE' });
}
export async function getRepoContents(credentials, owner, repo, path = '', ref = '') {
  const refParam = ref ? `?ref=${encodeURIComponent(ref)}` : '';
  return path
    ? (path.split('/').map(encodeURIComponent).join('%2F'),
      gitlabFetch(
        `/projects/${pid(owner, repo)}/repository/tree?path=${encodeURIComponent(path)}${ref ? `&ref=${encodeURIComponent(ref)}` : ''}&per_page=100`,
        credentials.token,
      ).then((items) =>
        (items ?? []).map((item) => ({
          name: item.name,
          type: 'tree' === item.type ? 'dir' : 'file',
          size: 0,
          path: item.path,
        })),
      ))
    : (
        (await gitlabFetch(
          `/projects/${pid(owner, repo)}/repository/tree${refParam}&per_page=100`,
          credentials.token,
        )) ?? []
      ).map((item) => ({
        name: item.name,
        type: 'tree' === item.type ? 'dir' : 'file',
        size: 0,
        path: item.path,
      }));
}
export async function createOrUpdateFile(
  credentials,
  owner,
  repo,
  filePath,
  { message: message, content: content, sha: sha = '', branch: branch = '' },
) {
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('%2F'),
    payload = { commit_message: message, content: content };
  (branch && (payload.branch = branch), sha && (payload.last_commit_id = sha));
  const method = sha ? 'PUT' : 'POST';
  return gitlabFetch(
    `/projects/${pid(owner, repo)}/repository/files/${encodedPath}`,
    credentials.token,
    { method: method, body: JSON.stringify(payload) },
  );
}
export async function deleteFile(
  credentials,
  owner,
  repo,
  filePath,
  { message: message, sha: sha, branch: branch = '' },
) {
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('%2F'),
    payload = { commit_message: message };
  return (
    branch && (payload.branch = branch),
    gitlabFetch(
      `/projects/${pid(owner, repo)}/repository/files/${encodedPath}`,
      credentials.token,
      { method: 'DELETE', body: JSON.stringify(payload) },
    )
  );
}
export async function getCommitComments(credentials, owner, repo, sha, perPage = 20) {
  return (
    (await gitlabFetch(
      `/projects/${pid(owner, repo)}/repository/commits/${sha}/comments?per_page=${perPage}`,
      credentials.token,
    )) ?? []
  ).map((c) => ({
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
  return (
    path && (payload.path = path),
    null !== position && (payload.line = position),
    gitlabFetch(
      `/projects/${pid(owner, repo)}/repository/commits/${sha}/comments`,
      credentials.token,
      { method: 'POST', body: JSON.stringify(payload) },
    )
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
  return {
    artifacts: (
      (await gitlabFetch(
        `/projects/${pid(owner, repo)}/pipelines/${runId}/jobs?per_page=50`,
        credentials.token,
      ).catch(() => [])) ?? []
    ).flatMap((j) =>
      (j.artifacts ?? []).map((a) => ({
        id: j.id,
        name: `${j.name}:${a.file_type ?? 'artifact'}`,
        size_in_bytes: a.size ?? 0,
        expires_at: a.expire_at ?? null,
        expired: !1,
      })),
    ),
  };
}
export async function checkIfStarred(credentials, owner, repo) {
  const user = await getUser(credentials);
  return ((await getStargazers(credentials, owner, repo, 100).catch(() => [])) ?? []).some(
    (s) => s.id === user.id || s.login === user.login,
  );
}
export async function followUser(credentials, username) {
  return gitlabFetch(
    `/users/${(await getUserInfo(credentials, username)).id}/follow`,
    credentials.token,
    { method: 'POST', body: JSON.stringify({}) },
  );
}
export async function unfollowUser(credentials, username) {
  return gitlabFetch(
    `/users/${(await getUserInfo(credentials, username)).id}/unfollow`,
    credentials.token,
    { method: 'POST', body: JSON.stringify({}) },
  );
}
export async function getIssueEvents(credentials, owner, repo, issueNumber, perPage = 30) {
  return (
    (await gitlabFetch(
      `/projects/${pid(owner, repo)}/issues/${issueNumber}/resource_state_events?per_page=${perPage}`,
      credentials.token,
    ).catch(() => [])) ?? []
  ).map((e) => ({ ...e, event: e.state ?? 'unknown', actor: normalizeUser(e.user) }));
}
export async function updateGist(
  credentials,
  gistId,
  { description: description, files: files } = {},
) {
  const payload = {};
  (void 0 !== description && ((payload.title = description), (payload.description = description)),
    void 0 !== files &&
      (payload.files = Object.entries(files).map(([filename, { content: content }]) => ({
        file_name: filename,
        content: content ?? '',
      }))));
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
  return {
    names:
      (
        await gitlabFetch(`/projects/${pid(owner, repo)}`, credentials.token, {
          method: 'PUT',
          body: JSON.stringify({ topics: names }),
        })
      ).topics ?? [],
  };
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
    body: JSON.stringify({ body: body }),
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
    { method: 'POST', body: JSON.stringify({ name: emoji }) },
  );
}
export async function addReactionToComment(credentials, owner, repo, commentId, content) {
  const emoji = EMOJI_TO_GL[content] ?? content;
  return gitlabFetch(
    `/projects/${pid(owner, repo)}/issues/notes/${commentId}/award_emoji`,
    credentials.token,
    { method: 'POST', body: JSON.stringify({ name: emoji }) },
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
  return {
    jobs: (
      (await gitlabFetch(
        `/projects/${pid(owner, repo)}/pipelines/${runId}/jobs?per_page=${perPage}`,
        credentials.token,
      )) ?? []
    ).map((j) => ({
      id: j.id,
      name: j.name,
      status: j.status,
      conclusion: 'success' === j.status ? 'success' : 'failed' === j.status ? 'failure' : null,
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
  return {
    role:
      { 50: 'owner', 40: 'maintainer', 30: 'developer', 20: 'reporter', 10: 'guest' }[
        (
          await gitlabFetch(
            `/groups/${encodeURIComponent(teamSlug)}/members/${user.id}`,
            credentials.token,
          )
        ).access_level
      ] ?? 'member',
    state: 'active',
  };
}
export async function listGistComments(credentials, gistId, perPage = 30) {
  return (
    (await gitlabFetch(`/snippets/${gistId}/notes?per_page=${perPage}`, credentials.token)) ?? []
  ).map((n) => ({ ...n, user: normalizeUser(n.author), body: n.body }));
}
export async function createGistComment(credentials, gistId, body) {
  const note = await gitlabFetch(`/snippets/${gistId}/notes`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({ body: body }),
  });
  return { ...note, url: `https://gitlab.com/-/snippets/${gistId}#note_${note.id}` };
}
export async function getRepoActionsPermissions(credentials, owner, repo) {
  return {
    enabled:
      (await gitlabFetch(`/projects/${pid(owner, repo)}`, credentials.token))
        .shared_runners_enabled ?? !0,
    allowed_actions: 'all',
    selected_actions_url: null,
  };
}
export async function getOrgWebhooks(credentials, org, perPage = 30) {
  return (
    (await gitlabFetch(
      `/groups/${encodeURIComponent(org)}/hooks?per_page=${perPage}`,
      credentials.token,
    )) ?? []
  ).map((h) => ({
    ...h,
    config: { url: h.url },
    events: Object.entries(h)
      .filter(([k, v]) => k.endsWith('_events') && !0 === v)
      .map(([k]) => k.replace('_events', '')),
    active: null != h.enable_ssl_verification,
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
  return gitlabFetch(
    `/users/${(await getUserInfo(credentials, username)).id}/keys`,
    credentials.token,
  );
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
  return !1;
}
