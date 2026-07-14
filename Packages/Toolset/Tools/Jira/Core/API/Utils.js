import { tryParseJson } from '../../../../../Shared/Utils/AsyncUtils.js';

/**
 * Maps a raw Jira issue (from board/sprint/backlog endpoints) to a compact board shape.
 * @param {object} i - Raw issue object.
 */
export function mapBoardIssue(i) {
  return {
    key: i.key,
    summary: i.fields?.summary ?? '',
    status: i.fields?.status?.name ?? '',
    assignee: i.fields?.assignee?.displayName ?? 'Unassigned',
    priority: i.fields?.priority?.name ?? 'None',
    issueType: i.fields?.issuetype?.name ?? '',
  };
}

/**
 * Shared error-handling fetch logic for both the REST v3 and Agile v1 Jira APIs.
 * Builds a message from the typical Jira error envelope.
 * @param {Response} res
 * @param {string} label - API label used in the fallback error message.
 */
export async function throwJiraError(res, label) {
  const data = await tryParseJson(res);
  throw new Error(data.errorMessages?.[0] ?? data.message ?? `${label} error: ${res.status}`);
}
