// ─────────────────────────────────────────────
//  openworld — Packages/Automation/Github.js
//  GitHub REST API integration (main-process safe)
//  Pure functions: accept { token } credentials, return data or throw.
// ─────────────────────────────────────────────

const GITHUB_BASE = 'https://api.github.com';

/* ══════════════════════════════════════════
   INTERNAL HELPERS
══════════════════════════════════════════ */

async function githubFetch(endpoint, token, options = {}) {
  const res = await fetch(`${GITHUB_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization:          `Bearer ${token}`,
      Accept:                 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type':         'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message ?? `GitHub API ${res.status}`);
  }

  if (res.status === 204) return null;   // No Content
  return res.json();
}

/* ══════════════════════════════════════════
   PUBLIC API
══════════════════════════════════════════ */

/**
 * Validate credentials and return the authenticated user.
 */
export async function getUser(credentials) {
  return githubFetch('/user', credentials.token);
}

/**
 * List repos for the authenticated user, sorted by last update.
 */
export async function getRepos(credentials, perPage = 30) {
  return githubFetch(
    `/user/repos?sort=updated&per_page=${perPage}&affiliation=owner,collaborator`,
    credentials.token,
  );
}

/**
 * Get the recursive file tree for a repo.
 * Tries 'main' first, falls back to 'master', then the provided branch.
 */
export async function getRepoTree(credentials, owner, repo, branch) {
  const tryBranch = (b) =>
    githubFetch(`/repos/${owner}/${repo}/git/trees/${b}?recursive=1`, credentials.token);

  if (branch) return tryBranch(branch);
  try   { return await tryBranch('main'); }
  catch { return tryBranch('master'); }
}

/**
 * Fetch decoded text content of a single file.
 * Returns { path, name, content, sha, size, url }.
 */
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

  return {
    path:    data.path,
    name:    data.name,
    content,
    sha:     data.sha,
    size:    data.size,
    url:     data.html_url,
  };
}

/**
 * List issues for a repo.
 * @param {string} state  'open' | 'closed' | 'all'
 */
export async function getIssues(credentials, owner, repo, state = 'open', perPage = 20) {
  // GitHub issues endpoint returns PRs too; filter them out with `pulls=false`
  return githubFetch(
    `/repos/${owner}/${repo}/issues?state=${state}&per_page=${perPage}`,
    credentials.token,
  ).then(items => items.filter(i => !i.pull_request));
}

/**
 * List pull requests for a repo.
 */
export async function getPullRequests(credentials, owner, repo, state = 'open', perPage = 20) {
  return githubFetch(
    `/repos/${owner}/${repo}/pulls?state=${state}&per_page=${perPage}`,
    credentials.token,
  );
}

/**
 * List recent commits for a repo.
 */
export async function getCommits(credentials, owner, repo, perPage = 20) {
  return githubFetch(
    `/repos/${owner}/${repo}/commits?per_page=${perPage}`,
    credentials.token,
  );
}

/**
 * List GitHub notifications for the authenticated user.
 * @param {boolean} unreadOnly  If true, returns only unread notifications.
 */
export async function getNotifications(credentials, unreadOnly = true) {
  return githubFetch(`/notifications?all=${!unreadOnly}`, credentials.token);
}

/**
 * List branches for a repo.
 */
export async function getBranches(credentials, owner, repo) {
  return githubFetch(`/repos/${owner}/${repo}/branches`, credentials.token);
}

/**
 * Create a new issue in a repo.
 */
export async function createIssue(credentials, owner, repo, title, body, labels = []) {
  return githubFetch(`/repos/${owner}/${repo}/issues`, credentials.token, {
    method: 'POST',
    body:   JSON.stringify({ title, body, labels }),
  });
}

/**
 * Search code across all repos or within a specific one.
 * @param {string} [scope]  e.g. 'withinjoel/openworld'
 */
export async function searchCode(credentials, query, scope) {
  const q = scope ? `${query} repo:${scope}` : query;
  return githubFetch(`/search/code?q=${encodeURIComponent(q)}`, credentials.token);
}

/**
 * Fetch the README for a repo (tries README.md then readme.md).
 */
export async function getReadme(credentials, owner, repo) {
  return getFileContent(credentials, owner, repo, 'README.md').catch(() =>
    getFileContent(credentials, owner, repo, 'readme.md'),
  );
}
