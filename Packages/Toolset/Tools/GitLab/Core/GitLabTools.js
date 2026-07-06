import {
  bodyJson,
  buildUrl,
  clampInteger,
  formatDate,
  formatList,
  parseCommaList,
  parseResponseJson,
  requireConnectorCredentials,
  requireText,
  truncateText,
} from '../../../Core/ConnectorHttp.js';

function projectId(value) {
  return encodeURIComponent(requireText(value, 'project'));
}

function safeState(value, allowed, fallback) {
  const state = String(value ?? fallback)
    .trim()
    .toLowerCase();
  return allowed.includes(state) ? state : fallback;
}

async function gitLabRequest(
  rootDirectory,
  path,
  { method = 'GET', searchParams = {}, body } = {},
) {
  const credentials = await requireConnectorCredentials(
    rootDirectory,
    'gitlab',
    ['token'],
    'GitLab',
  );
  const baseUrl =
    String(credentials.baseUrl ?? 'https://gitlab.com')
      .trim()
      .replace(/\/+$/, '') || 'https://gitlab.com';
  const response = await fetch(buildUrl(`${baseUrl}/api/v4`, path, searchParams), {
    method,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'private-token': credentials.token,
    },
    ...bodyJson(body),
  });
  const { data, text } = await parseResponseJson(response);
  if (!response.ok)
    throw new Error(
      `${response.status} ${response.statusText}: ${data?.message ?? text ?? 'GitLab request failed'}`,
    );
  return data;
}

function formatProject(project, index = null) {
  return [
    `${index == null ? '' : `${index + 1}. `}${project.path_with_namespace ?? project.name}`,
    `Description: ${project.description || '(none)'}`,
    `Visibility: ${project.visibility || '(unknown)'}`,
    `Stars: ${project.star_count ?? 0}`,
    `Forks: ${project.forks_count ?? 0}`,
    `Default branch: ${project.default_branch || '(unknown)'}`,
    `Updated: ${formatDate(project.last_activity_at)}`,
    `URL: ${project.web_url}`,
  ].join('\n');
}

export function createGitLabToolHandlers({ rootDirectory }) {
  return {
    async gitlab_get_current_user() {
      const user = await gitLabRequest(rootDirectory, '/user');
      return [
        `GitLab user: ${user.username}`,
        `Name: ${user.name || '(none)'}`,
        `Public email: ${user.public_email || '(none)'}`,
        `Created: ${formatDate(user.created_at)}`,
        `URL: ${user.web_url}`,
      ].join('\n');
    },

    async gitlab_list_projects(params = {}) {
      const limit = clampInteger(params.limit, 20, 1, 50);
      const projects = await gitLabRequest(rootDirectory, '/projects', {
        searchParams: {
          membership: true,
          simple: true,
          order_by: 'last_activity_at',
          sort: 'desc',
          search: params.query,
          per_page: limit,
        },
      });
      return formatList('GitLab projects', projects.map(formatProject));
    },

    async gitlab_get_project(params = {}) {
      return formatProject(
        await gitLabRequest(rootDirectory, `/projects/${projectId(params.project)}`),
      );
    },

    async gitlab_list_issues(params = {}) {
      const project = projectId(params.project);
      const state = safeState(params.state, ['opened', 'closed', 'all'], 'opened');
      const limit = clampInteger(params.limit, 10, 1, 50);
      const issues = await gitLabRequest(rootDirectory, `/projects/${project}/issues`, {
        searchParams: { state, per_page: limit },
      });
      return formatList(
        `GitLab issues for ${params.project}`,
        issues.map(
          (issue) =>
            `#${issue.iid} ${issue.title}\n   State: ${issue.state} | Author: ${issue.author?.username ?? 'unknown'} | Updated: ${formatDate(issue.updated_at)}\n   ${issue.web_url}`,
        ),
      );
    },

    async gitlab_list_merge_requests(params = {}) {
      const project = projectId(params.project);
      const state = safeState(params.state, ['opened', 'closed', 'merged', 'all'], 'opened');
      const limit = clampInteger(params.limit, 10, 1, 50);
      const mergeRequests = await gitLabRequest(
        rootDirectory,
        `/projects/${project}/merge_requests`,
        {
          searchParams: { state, per_page: limit },
        },
      );
      return formatList(
        `GitLab merge requests for ${params.project}`,
        mergeRequests.map(
          (mr) =>
            `!${mr.iid} ${mr.title}\n   State: ${mr.state} | ${mr.source_branch} -> ${mr.target_branch} | Updated: ${formatDate(mr.updated_at)}\n   ${mr.web_url}`,
        ),
      );
    },

    async gitlab_get_file(params = {}) {
      const project = projectId(params.project);
      const filePath = encodeURIComponent(
        requireText(params.file_path ?? params.filePath, 'file_path'),
      );
      const ref = String(params.ref ?? 'main').trim() || 'main';
      const file = await gitLabRequest(
        rootDirectory,
        `/projects/${project}/repository/files/${filePath}`,
        {
          searchParams: { ref },
        },
      );
      const content = Buffer.from(
        String(file.content ?? ''),
        file.encoding === 'base64' ? 'base64' : 'utf8',
      ).toString('utf8');
      return [
        `GitLab file ${file.file_path} @ ${ref}`,
        '',
        '```',
        truncateText(content, 6000),
        '```',
      ].join('\n');
    },

    async gitlab_list_commits(params = {}) {
      const project = projectId(params.project);
      const limit = clampInteger(params.limit, 10, 1, 50);
      const commits = await gitLabRequest(
        rootDirectory,
        `/projects/${project}/repository/commits`,
        {
          searchParams: { ref_name: params.ref, per_page: limit },
        },
      );
      return formatList(
        `GitLab commits for ${params.project}`,
        commits.map(
          (commit, index) =>
            `${index + 1}. ${commit.short_id} ${commit.title}\n   by ${commit.author_name || 'unknown'} on ${formatDate(commit.created_at)}\n   ${commit.web_url}`,
        ),
      );
    },

    async gitlab_create_issue(params = {}) {
      const project = projectId(params.project);
      const title = requireText(params.title, 'title');
      const issue = await gitLabRequest(rootDirectory, `/projects/${project}/issues`, {
        method: 'POST',
        body: {
          title,
          description: String(params.description ?? ''),
          labels: parseCommaList(params.labels).join(','),
        },
      });
      return [
        `GitLab issue created`,
        `#${issue.iid}: ${issue.title}`,
        `URL: ${issue.web_url}`,
      ].join('\n');
    },
  };
}
