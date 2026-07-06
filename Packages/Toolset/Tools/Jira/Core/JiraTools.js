import {
  bodyJson,
  buildUrl,
  clampInteger,
  formatList,
  parseResponseJson,
  requireConnectorCredentials,
  requireText,
  truncateText,
} from '../../../Core/ConnectorHttp.js';

function authHeader(credentials) {
  return `Basic ${Buffer.from(`${credentials.email}:${credentials.token}`).toString('base64')}`;
}

function docFromText(text) {
  return {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ],
  };
}

async function jiraRequest(rootDirectory, path, { method = 'GET', body, searchParams = {} } = {}) {
  const credentials = await requireConnectorCredentials(
    rootDirectory,
    'jira',
    ['email', 'token', 'siteUrl'],
    'Jira',
  );
  const baseUrl = String(credentials.siteUrl).trim().replace(/\/+$/, '');
  const response = await fetch(buildUrl(`${baseUrl}/rest/api/3`, path, searchParams), {
    method,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: authHeader(credentials),
    },
    ...bodyJson(body),
  });
  const { data, text } = await parseResponseJson(response);
  if (!response.ok) {
    const message =
      data?.errorMessages?.join('; ') || Object.values(data?.errors ?? {}).join('; ') || text;
    throw new Error(`${response.status} ${response.statusText}: ${message}`);
  }
  return data;
}

function plainDescription(issue) {
  const content = issue.fields?.description?.content ?? [];
  return content
    .flatMap((block) => block.content ?? [])
    .map((item) => item.text ?? '')
    .join(' ');
}

function formatIssue(issue, index = null) {
  return [
    `${index == null ? '' : `${index + 1}. `}${issue.key}: ${issue.fields?.summary ?? '(no summary)'}`,
    `Status: ${issue.fields?.status?.name ?? 'unknown'} | Type: ${issue.fields?.issuetype?.name ?? 'unknown'} | Priority: ${issue.fields?.priority?.name ?? 'none'}`,
    `Assignee: ${issue.fields?.assignee?.displayName ?? 'Unassigned'} | Reporter: ${issue.fields?.reporter?.displayName ?? 'unknown'}`,
    `URL: ${issue.self ?? ''}`,
  ].join('\n');
}

export function createJiraToolHandlers({ rootDirectory }) {
  return {
    async jira_get_myself() {
      const user = await jiraRequest(rootDirectory, '/myself');
      return [
        `Jira user: ${user.displayName}`,
        `Email: ${user.emailAddress ?? '(hidden)'}`,
        `Account ID: ${user.accountId}`,
      ].join('\n');
    },

    async jira_search_issues(params = {}) {
      const jql = requireText(params.jql, 'jql');
      const limit = clampInteger(params.limit, 10, 1, 50);
      const data = await jiraRequest(rootDirectory, '/search', {
        method: 'POST',
        body: {
          jql,
          maxResults: limit,
          fields: ['summary', 'status', 'issuetype', 'priority', 'assignee', 'reporter'],
        },
      });
      return formatList(`Jira search: ${jql}`, (data.issues ?? []).map(formatIssue));
    },

    async jira_get_issue(params = {}) {
      const issueKey = requireText(params.issue_key ?? params.issueKey, 'issue_key');
      const issue = await jiraRequest(rootDirectory, `/issue/${encodeURIComponent(issueKey)}`, {
        searchParams: {
          fields: 'summary,status,issuetype,priority,assignee,reporter,description,comment',
        },
      });
      const comments = issue.fields?.comment?.comments ?? [];
      return [
        formatIssue(issue),
        '',
        truncateText(plainDescription(issue) || '(no description)', 2000),
        '',
        `Comments: ${comments.length}`,
      ].join('\n');
    },

    async jira_create_issue(params = {}) {
      const projectKey = requireText(params.project_key ?? params.projectKey, 'project_key');
      const summary = requireText(params.summary, 'summary');
      const issueType = String(params.issue_type ?? params.issueType ?? 'Task').trim() || 'Task';
      const body = {
        fields: {
          project: { key: projectKey },
          summary,
          issuetype: { name: issueType },
        },
      };
      if (params.description)
        body.fields.description = docFromText(truncateText(params.description, 3000));
      const issue = await jiraRequest(rootDirectory, '/issue', { method: 'POST', body });
      return [
        `Jira issue created`,
        `Key: ${issue.key}`,
        `ID: ${issue.id}`,
        `URL: ${issue.self}`,
      ].join('\n');
    },

    async jira_add_comment(params = {}) {
      const issueKey = requireText(params.issue_key ?? params.issueKey, 'issue_key');
      const body = requireText(params.body, 'body');
      const comment = await jiraRequest(
        rootDirectory,
        `/issue/${encodeURIComponent(issueKey)}/comment`,
        {
          method: 'POST',
          body: { body: docFromText(truncateText(body, 3000)) },
        },
      );
      return [`Jira comment added to ${issueKey}`, `Comment ID: ${comment.id}`].join('\n');
    },

    async jira_list_transitions(params = {}) {
      const issueKey = requireText(params.issue_key ?? params.issueKey, 'issue_key');
      const data = await jiraRequest(
        rootDirectory,
        `/issue/${encodeURIComponent(issueKey)}/transitions`,
      );
      return formatList(
        `Jira transitions for ${issueKey}`,
        (data.transitions ?? []).map((transition) => `${transition.id}: ${transition.name}`),
      );
    },

    async jira_transition_issue(params = {}) {
      const issueKey = requireText(params.issue_key ?? params.issueKey, 'issue_key');
      const transitionId = requireText(
        params.transition_id ?? params.transitionId,
        'transition_id',
      );
      await jiraRequest(rootDirectory, `/issue/${encodeURIComponent(issueKey)}/transitions`, {
        method: 'POST',
        body: { transition: { id: transitionId } },
      });
      return `Jira issue ${issueKey} transitioned with transition ${transitionId}.`;
    },
  };
}
