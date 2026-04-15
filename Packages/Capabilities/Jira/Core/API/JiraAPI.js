import { jiraAuthHeader } from '../Shared/Common.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function headers(creds) {
  return {
    Authorization: jiraAuthHeader(creds),
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

function base(creds) {
  const url = creds.siteUrl.replace(/\/$/, '');
  return `${url}/rest/api/3`;
}

function agileBase(creds) {
  const url = creds.siteUrl.replace(/\/$/, '');
  return `${url}/rest/agile/1.0`;
}

/** REST API v3 fetch — returns parsed JSON */
async function jFetch(path, creds, options = {}) {
  const res = await fetch(`${base(creds)}${path}`, {
    ...options,
    headers: { ...headers(creds), ...(options.headers ?? {}) },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.errorMessages?.[0] ?? data.message ?? `Jira API error: ${res.status}`);
  }
  if (res.status === 204) return { ok: true };
  return res.json();
}

/** Agile API v1 fetch */
async function agileFetch(path, creds, options = {}) {
  const res = await fetch(`${agileBase(creds)}${path}`, {
    ...options,
    headers: { ...headers(creds), ...(options.headers ?? {}) },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      data.errorMessages?.[0] ?? data.message ?? `Jira Agile API error: ${res.status}`,
    );
  }
  if (res.status === 204) return { ok: true };
  return res.json();
}

/** Convert plain text to Atlassian Document Format (ADF) */
function toADF(text) {
  return {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: String(text) }],
      },
    ],
  };
}

// ─── Existing ─────────────────────────────────────────────────────────────────

export async function getMyself(creds) {
  return jFetch('/myself', creds);
}

export async function listProjects(creds) {
  const data = await jFetch('/project/search?maxResults=50&orderBy=NAME', creds);
  return (data.values ?? []).map((p) => ({
    id: p.id,
    key: p.key,
    name: p.name,
    type: p.projectTypeKey,
  }));
}

export async function searchIssues(creds, jql, maxResults = 25) {
  const data = await jFetch(
    `/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&fields=summary,status,assignee,priority,updated,project,description,issuetype,reporter,labels,fixVersions,components`,
    creds,
  );
  return (data.issues ?? []).map((i) => ({
    key: i.key,
    summary: i.fields?.summary ?? '',
    status: i.fields?.status?.name ?? 'unknown',
    assignee: i.fields?.assignee?.displayName ?? 'Unassigned',
    priority: i.fields?.priority?.name ?? 'None',
    updated: i.fields?.updated,
    project: i.fields?.project?.name ?? '',
    issueType: i.fields?.issuetype?.name ?? '',
    reporter: i.fields?.reporter?.displayName ?? '',
    labels: i.fields?.labels ?? [],
  }));
}

export async function getMyOpenIssues(creds, limit = 25) {
  return searchIssues(
    creds,
    'assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC',
    limit,
  );
}

// ─── 1. Get Issue ─────────────────────────────────────────────────────────────

export async function getIssue(creds, issueKey) {
  const fields =
    'summary,status,assignee,priority,updated,created,project,description,issuetype,reporter,labels,fixVersions,components,issuelinks,subtasks,comment,worklog,attachment';
  const data = await jFetch(`/issue/${issueKey}?fields=${fields}`, creds);
  return {
    key: data.key,
    summary: data.fields?.summary ?? '',
    status: data.fields?.status?.name ?? '',
    assignee: data.fields?.assignee?.displayName ?? 'Unassigned',
    reporter: data.fields?.reporter?.displayName ?? '',
    priority: data.fields?.priority?.name ?? 'None',
    issueType: data.fields?.issuetype?.name ?? '',
    project: data.fields?.project?.name ?? '',
    projectKey: data.fields?.project?.key ?? '',
    labels: data.fields?.labels ?? [],
    created: data.fields?.created,
    updated: data.fields?.updated,
    description: data.fields?.description?.content?.[0]?.content?.[0]?.text ?? '(no description)',
    subtasks: (data.fields?.subtasks ?? []).map((s) => ({
      key: s.key,
      summary: s.fields?.summary,
      status: s.fields?.status?.name,
    })),
    links: (data.fields?.issuelinks ?? []).map((l) => ({
      type: l.type?.name,
      inwardIssue: l.inwardIssue?.key,
      outwardIssue: l.outwardIssue?.key,
    })),
    commentCount: data.fields?.comment?.total ?? 0,
  };
}

// ─── 2. Create Issue ──────────────────────────────────────────────────────────

export async function createIssue(
  creds,
  {
    projectKey,
    summary,
    issueType = 'Task',
    description = '',
    priority,
    assigneeAccountId,
    labels = [],
  },
) {
  const body = {
    fields: {
      project: { key: projectKey },
      summary,
      issuetype: { name: issueType },
      ...(description ? { description: toADF(description) } : {}),
      ...(priority ? { priority: { name: priority } } : {}),
      ...(assigneeAccountId ? { assignee: { accountId: assigneeAccountId } } : {}),
      ...(labels.length ? { labels } : {}),
    },
  };
  const data = await jFetch('/issue', creds, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return { key: data.key, id: data.id, self: data.self };
}

// ─── 3. Update Issue ──────────────────────────────────────────────────────────

export async function updateIssue(creds, issueKey, updates = {}) {
  const fields = {};
  if (updates.summary) fields.summary = updates.summary;
  if (updates.description) fields.description = toADF(updates.description);
  if (updates.priority) fields.priority = { name: updates.priority };
  if (updates.assigneeAccountId) fields.assignee = { accountId: updates.assigneeAccountId };
  if (updates.labels) fields.labels = updates.labels;
  if (updates.fixVersion) fields.fixVersions = [{ name: updates.fixVersion }];

  await jFetch(`/issue/${issueKey}`, creds, {
    method: 'PUT',
    body: JSON.stringify({ fields }),
  });
  return { ok: true, updated: issueKey };
}

// ─── 4. Delete Issue ──────────────────────────────────────────────────────────

export async function deleteIssue(creds, issueKey) {
  await jFetch(`/issue/${issueKey}`, creds, { method: 'DELETE' });
  return { ok: true, deleted: issueKey };
}

// ─── 5. Add Comment ───────────────────────────────────────────────────────────

export async function addComment(creds, issueKey, commentText) {
  const data = await jFetch(`/issue/${issueKey}/comment`, creds, {
    method: 'POST',
    body: JSON.stringify({ body: toADF(commentText) }),
  });
  return {
    id: data.id,
    author: data.author?.displayName ?? '',
    created: data.created,
  };
}

// ─── 6. Get Comments ──────────────────────────────────────────────────────────

export async function getComments(creds, issueKey, maxResults = 20) {
  const data = await jFetch(
    `/issue/${issueKey}/comment?maxResults=${maxResults}&orderBy=created`,
    creds,
  );
  return (data.comments ?? []).map((c) => ({
    id: c.id,
    author: c.author?.displayName ?? '',
    created: c.created,
    updated: c.updated,
    body: c.body?.content?.[0]?.content?.[0]?.text ?? '(no text)',
  }));
}

// ─── 7. Delete Comment ────────────────────────────────────────────────────────

export async function deleteComment(creds, issueKey, commentId) {
  await jFetch(`/issue/${issueKey}/comment/${commentId}`, creds, { method: 'DELETE' });
  return { ok: true, deleted: commentId };
}

// ─── 8. Assign Issue ──────────────────────────────────────────────────────────

export async function assignIssue(creds, issueKey, accountId) {
  await jFetch(`/issue/${issueKey}/assignee`, creds, {
    method: 'PUT',
    body: JSON.stringify({ accountId: accountId ?? null }),
  });
  return { ok: true, assigned: issueKey };
}

// ─── 9. Get Transitions ───────────────────────────────────────────────────────

export async function getTransitions(creds, issueKey) {
  const data = await jFetch(`/issue/${issueKey}/transitions`, creds);
  return (data.transitions ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    toStatus: t.to?.name ?? '',
    toStatusCategory: t.to?.statusCategory?.name ?? '',
  }));
}

// ─── 10. Transition Issue ─────────────────────────────────────────────────────

export async function transitionIssue(creds, issueKey, transitionId) {
  await jFetch(`/issue/${issueKey}/transitions`, creds, {
    method: 'POST',
    body: JSON.stringify({ transition: { id: String(transitionId) } }),
  });
  return { ok: true, transitioned: issueKey };
}

// ─── 11. Get Project ──────────────────────────────────────────────────────────

export async function getProject(creds, projectKey) {
  const data = await jFetch(`/project/${projectKey}`, creds);
  return {
    id: data.id,
    key: data.key,
    name: data.name,
    type: data.projectTypeKey,
    lead: data.lead?.displayName ?? '',
    description: data.description ?? '',
    url: data.self,
    issueTypes: (data.issueTypes ?? []).map((t) => t.name),
  };
}

// ─── 12. Get Boards ───────────────────────────────────────────────────────────

export async function getBoards(creds, maxResults = 25) {
  const data = await agileFetch(`/board?maxResults=${maxResults}`, creds);
  return (data.values ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    type: b.type,
    projectKey: b.location?.projectKey ?? '',
    projectName: b.location?.displayName ?? '',
  }));
}

// ─── 13. Get Board Sprints ────────────────────────────────────────────────────

export async function getBoardSprints(creds, boardId, state = 'active,future') {
  const data = await agileFetch(
    `/board/${boardId}/sprint?state=${encodeURIComponent(state)}&maxResults=25`,
    creds,
  );
  return (data.values ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    state: s.state,
    startDate: s.startDate,
    endDate: s.endDate,
    goal: s.goal ?? '',
  }));
}

// ─── 14. Get Sprint Issues ────────────────────────────────────────────────────

export async function getSprintIssues(creds, sprintId, maxResults = 50) {
  const data = await agileFetch(
    `/sprint/${sprintId}/issue?maxResults=${maxResults}&fields=summary,status,assignee,priority,issuetype,storyPoints`,
    creds,
  );
  return (data.issues ?? []).map((i) => ({
    key: i.key,
    summary: i.fields?.summary ?? '',
    status: i.fields?.status?.name ?? '',
    assignee: i.fields?.assignee?.displayName ?? 'Unassigned',
    priority: i.fields?.priority?.name ?? 'None',
    issueType: i.fields?.issuetype?.name ?? '',
  }));
}

// ─── 15. Get Backlog ──────────────────────────────────────────────────────────

export async function getBacklog(creds, boardId, maxResults = 50) {
  const data = await agileFetch(
    `/board/${boardId}/backlog?maxResults=${maxResults}&fields=summary,status,assignee,priority,issuetype`,
    creds,
  );
  return (data.issues ?? []).map((i) => ({
    key: i.key,
    summary: i.fields?.summary ?? '',
    status: i.fields?.status?.name ?? '',
    assignee: i.fields?.assignee?.displayName ?? 'Unassigned',
    priority: i.fields?.priority?.name ?? 'None',
    issueType: i.fields?.issuetype?.name ?? '',
  }));
}

// ─── 16. Get Issue Types ──────────────────────────────────────────────────────

export async function getIssueTypes(creds, projectKey) {
  const data = await jFetch(`/project/${projectKey}/statuses`, creds);
  const seen = new Set();
  const types = [];
  for (const t of data) {
    if (!seen.has(t.name)) {
      seen.add(t.name);
      types.push({
        id: t.id,
        name: t.name,
        statuses: (t.statuses ?? []).map((s) => s.name),
      });
    }
  }
  return types;
}

// ─── 17. Get Priorities ───────────────────────────────────────────────────────

export async function getPriorities(creds) {
  const data = await jFetch('/priority', creds);
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description ?? '',
  }));
}

// ─── 18. Search Users ─────────────────────────────────────────────────────────

export async function searchUsers(creds, query, maxResults = 10) {
  const data = await jFetch(
    `/user/search?query=${encodeURIComponent(query)}&maxResults=${maxResults}`,
    creds,
  );
  return (data ?? []).map((u) => ({
    accountId: u.accountId,
    displayName: u.displayName,
    email: u.emailAddress ?? '',
    active: u.active,
    avatarUrl: u.avatarUrls?.['48x48'] ?? '',
  }));
}

// ─── 19. Get Watchers ─────────────────────────────────────────────────────────

export async function getWatchers(creds, issueKey) {
  const data = await jFetch(`/issue/${issueKey}/watchers`, creds);
  return {
    watchCount: data.watchCount ?? 0,
    isWatching: data.isWatching ?? false,
    watchers: (data.watchers ?? []).map((w) => ({
      accountId: w.accountId,
      displayName: w.displayName,
    })),
  };
}

// ─── 20. Watch Issue ──────────────────────────────────────────────────────────

export async function watchIssue(creds, issueKey, accountId) {
  await jFetch(`/issue/${issueKey}/watchers`, creds, {
    method: 'POST',
    body: JSON.stringify(accountId),
  });
  return { ok: true, watching: issueKey };
}

// ─── 21. Unwatch Issue ────────────────────────────────────────────────────────

export async function unwatchIssue(creds, issueKey, accountId) {
  await jFetch(`/issue/${issueKey}/watchers?accountId=${encodeURIComponent(accountId)}`, creds, {
    method: 'DELETE',
  });
  return { ok: true, unwatched: issueKey };
}

// ─── 22. Get Changelog ────────────────────────────────────────────────────────

export async function getChangelog(creds, issueKey, maxResults = 25) {
  const data = await jFetch(`/issue/${issueKey}/changelog?maxResults=${maxResults}`, creds);
  return (data.values ?? []).map((entry) => ({
    id: entry.id,
    author: entry.author?.displayName ?? '',
    created: entry.created,
    changes: (entry.items ?? []).map((item) => ({
      field: item.field,
      from: item.fromString ?? null,
      to: item.toString ?? null,
    })),
  }));
}

// ─── 23. Link Issues ──────────────────────────────────────────────────────────

export async function linkIssues(creds, inwardIssueKey, outwardIssueKey, linkTypeName = 'Relates') {
  await jFetch('/issueLink', creds, {
    method: 'POST',
    body: JSON.stringify({
      type: { name: linkTypeName },
      inwardIssue: { key: inwardIssueKey },
      outwardIssue: { key: outwardIssueKey },
    }),
  });
  return { ok: true, linked: `${inwardIssueKey} ↔ ${outwardIssueKey}` };
}

// ─── 24. Get Issue Link Types ─────────────────────────────────────────────────

export async function getIssueLinkTypes(creds) {
  const data = await jFetch('/issueLinkType', creds);
  return (data.issueLinkTypes ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    inward: t.inward,
    outward: t.outward,
  }));
}

// ─── 25. Get Versions ─────────────────────────────────────────────────────────

export async function getVersions(creds, projectKey) {
  const data = await jFetch(`/project/${projectKey}/versions`, creds);
  return (data ?? []).map((v) => ({
    id: v.id,
    name: v.name,
    description: v.description ?? '',
    released: v.released ?? false,
    archived: v.archived ?? false,
    releaseDate: v.releaseDate ?? null,
    startDate: v.startDate ?? null,
  }));
}

// ─── 26. Create Version ───────────────────────────────────────────────────────

export async function createVersion(
  creds,
  projectKey,
  { name, description = '', releaseDate, startDate },
) {
  const data = await jFetch('/version', creds, {
    method: 'POST',
    body: JSON.stringify({
      name,
      description,
      project: projectKey,
      ...(releaseDate ? { releaseDate } : {}),
      ...(startDate ? { startDate } : {}),
      released: false,
      archived: false,
    }),
  });
  return { id: data.id, name: data.name, self: data.self };
}

// ─── 27. Get Worklogs ─────────────────────────────────────────────────────────

export async function getWorklogs(creds, issueKey) {
  const data = await jFetch(`/issue/${issueKey}/worklog`, creds);
  return {
    total: data.total ?? 0,
    totalTimeSpentSeconds:
      data.worklogs?.reduce((sum, w) => sum + (w.timeSpentSeconds ?? 0), 0) ?? 0,
    worklogs: (data.worklogs ?? []).map((w) => ({
      id: w.id,
      author: w.author?.displayName ?? '',
      timeSpent: w.timeSpent,
      timeSpentSeconds: w.timeSpentSeconds,
      started: w.started,
      comment: w.comment?.content?.[0]?.content?.[0]?.text ?? '',
    })),
  };
}

// ─── 28. Log Work ─────────────────────────────────────────────────────────────

export async function logWork(creds, issueKey, { timeSpent, comment = '', started }) {
  const body = {
    timeSpent,
    ...(comment ? { comment: toADF(comment) } : {}),
    ...(started ? { started } : {}),
  };
  const data = await jFetch(`/issue/${issueKey}/worklog`, creds, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return {
    id: data.id,
    timeSpent: data.timeSpent,
    started: data.started,
    author: data.author?.displayName ?? '',
  };
}

// ─── 29. Get Statuses ─────────────────────────────────────────────────────────

export async function getStatuses(creds, projectKey) {
  const data = await jFetch(`/project/${projectKey}/statuses`, creds);
  return (data ?? []).map((issueType) => ({
    issueType: issueType.name,
    statuses: (issueType.statuses ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      category: s.statusCategory?.name ?? '',
    })),
  }));
}

// ─── 30. Get Labels ───────────────────────────────────────────────────────────

export async function getLabels(creds, startAt = 0, maxResults = 50) {
  const data = await jFetch(`/label?startAt=${startAt}&maxResults=${maxResults}`, creds);
  return {
    total: data.total ?? 0,
    labels: data.values ?? [],
  };
}
