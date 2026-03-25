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
  try { return await tryBranch('main'); }
  catch { return tryBranch('master'); }
}

export async function getFileContent(credentials, owner, repo, filePath) {
  const data = await githubFetch(
    `/repos/${owner}/${repo}/contents/${filePath}`,
    credentials.token,
  );

  if (Array.isArray(data))
    throw new Error(`"${filePath}" is a directory, not a file.`);

  const content =
    data.encoding === 'base64'
      ? Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8')
      : data.content;

  return { path: data.path, name: data.name, content, sha: data.sha, size: data.size, url: data.html_url };
}

export async function getIssues(credentials, owner, repo, state = 'open', perPage = 20) {
  return githubFetch(
    `/repos/${owner}/${repo}/issues?state=${state}&per_page=${perPage}`,
    credentials.token,
  ).then(items => items.filter(i => !i.pull_request));
}

export async function getPullRequests(credentials, owner, repo, state = 'open', perPage = 20) {
  return githubFetch(
    `/repos/${owner}/${repo}/pulls?state=${state}&per_page=${perPage}`,
    credentials.token,
  );
}

export async function getCommits(credentials, owner, repo, perPage = 20) {
  return githubFetch(
    `/repos/${owner}/${repo}/commits?per_page=${perPage}`,
    credentials.token,
  );
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

/** Get the latest published release for a repo. */
export async function getLatestRelease(credentials, owner, repo) {
  return githubFetch(`/repos/${owner}/${repo}/releases/latest`, credentials.token);
}

/** List releases for a repo (newest first). */
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
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
    {
      headers: {
        Authorization: `Bearer ${credentials.token}`,
        Accept: 'application/vnd.github.v3.diff',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message ?? `GitHub API ${res.status}`);
  }
  return res.text();
}

export async function getPRDetails(credentials, owner, repo, prNumber) {
  return githubFetch(
    `/repos/${owner}/${repo}/pulls/${prNumber}`,
    credentials.token,
  );
}

export async function createPRReview(credentials, owner, repo, prNumber, { body, event = 'COMMENT', comments = [] }) {
  return githubFetch(`/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, credentials.token, {
    method: 'POST',
    body: JSON.stringify({ body, event, comments }),
  });
}

export async function listPRReviews(credentials, owner, repo, prNumber) {
  return githubFetch(
    `/repos/${owner}/${repo}/pulls/${prNumber}/reviews`,
    credentials.token,
  );
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
    githubFetch(`/repos/${owner}/${repo}/commits/${sha}/status`, credentials.token).catch(() => null),
    githubFetch(`/repos/${owner}/${repo}/commits/${sha}/check-runs`, credentials.token).catch(() => null),
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

export async function getWorkflowRuns(credentials, owner, repo, { branch = '', event = '', perPage = 20 } = {}) {
  const qs = new URLSearchParams({ per_page: String(perPage || 20) });
  if (branch) qs.set('branch', branch);
  if (event) qs.set('event', event);

  return githubFetch(
    `/repos/${owner}/${repo}/actions/runs?${qs.toString()}`,
    credentials.token,
  );
}
