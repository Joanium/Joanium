import { bodyJson, buildUrl, requireConnectorCredentials } from '../../../Core/ConnectorHttp.js';
import strings from '../I18n/en.js';
import {
  compactObject,
  formatList,
  optionalText,
  parseLimit,
  parseObject,
  readServiceJson,
  readText,
  toBoolean,
  truncate,
} from './Utils.js';

const AIRTABLE_API = 'https://api.airtable.com/v0';
const TODOIST_API = 'https://api.todoist.com/api/v1';
const connectorLabels = Object.fromEntries(
  strings.connectors.map((connector) => [connector.id, connector.label]),
);

async function airtableRequest(
  rootDirectory,
  baseId,
  table,
  { method = 'GET', body, searchParams = {} } = {},
) {
  const credentials = await requireConnectorCredentials(
    rootDirectory,
    'airtable',
    ['token'],
    connectorLabels.airtable,
  );
  const tablePath = `/${encodeURIComponent(baseId)}/${encodeURIComponent(table)}`;
  const response = await fetch(buildUrl(AIRTABLE_API, tablePath, searchParams), {
    method,
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${credentials.token}`,
      'content-type': 'application/json',
    },
    ...bodyJson(body),
  });
  return readServiceJson(response, connectorLabels.airtable);
}

async function todoistRequest(
  rootDirectory,
  path,
  { method = 'GET', body, searchParams = {} } = {},
) {
  const credentials = await requireConnectorCredentials(
    rootDirectory,
    'todoist',
    ['token'],
    connectorLabels.todoist,
  );
  const response = await fetch(buildUrl(TODOIST_API, path, searchParams), {
    method,
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${credentials.token}`,
      'content-type': 'application/json',
    },
    ...bodyJson(body),
  });
  return readServiceJson(response, connectorLabels.todoist);
}

async function resolveAirtableBaseId(rootDirectory, params = {}) {
  const credentials = await requireConnectorCredentials(
    rootDirectory,
    'airtable',
    ['token'],
    connectorLabels.airtable,
  );
  const baseId = optionalText(params.base_id ?? params.baseId) || optionalText(credentials.baseId);
  if (!baseId) throw new Error(strings.errors.missingAirtableBase);
  return baseId;
}

function formatAirtableRecord(record) {
  const fields = Object.entries(record.fields ?? {})
    .slice(0, 8)
    .map(([key, value]) => `${key}: ${truncate(JSON.stringify(value), 160)}`)
    .join(' | ');
  return `${strings.output.id}: ${record.id}\n   ${fields || strings.output.emptyObject}`;
}

function formatTodoistTask(task) {
  return [
    task.content ?? task.id,
    `${strings.output.id}: ${task.id}`,
    task.due?.string ? `${strings.output.due}: ${task.due.string}` : null,
    task.project_id ? `${strings.output.project}: ${task.project_id}` : null,
  ]
    .filter(Boolean)
    .join('\n   ');
}

export function createProductivityToolHandlers({ rootDirectory }) {
  return {
    async airtable_list_records(params = {}) {
      const table = readText(params.table, strings.labels.table);
      const baseId = await resolveAirtableBaseId(rootDirectory, params);
      const maxRecords = parseLimit(params.max_records ?? params.maxRecords, 10, 1, 100);
      const view = optionalText(params.view);
      const data = await airtableRequest(rootDirectory, baseId, table, {
        searchParams: { maxRecords, view },
      });
      return formatList(
        strings.output.airtableRecords,
        (data.records ?? []).map(formatAirtableRecord),
      );
    },

    async airtable_create_record(params = {}) {
      const table = readText(params.table, strings.labels.table);
      const baseId = await resolveAirtableBaseId(rootDirectory, params);
      const fields = parseObject(params.fields ?? params.fields_json, strings.labels.fields);
      const data = await airtableRequest(rootDirectory, baseId, table, {
        method: 'POST',
        body: {
          records: [{ fields }],
          typecast: toBoolean(params.typecast, false),
        },
      });
      const record = data.records?.[0] ?? {};
      return [
        strings.output.airtableCreated,
        `${strings.output.id}: ${record.id ?? strings.output.notAvailable}`,
        `${strings.output.created}: ${record.createdTime ?? strings.output.notAvailable}`,
      ].join('\n');
    },

    async todoist_filter_tasks(params = {}) {
      const query = readText(params.query, strings.labels.query);
      const limit = parseLimit(params.limit, 20, 1, 200);
      const lang = optionalText(params.lang) || 'en';
      const data = await todoistRequest(rootDirectory, '/tasks/filter', {
        searchParams: { query, lang, limit },
      });
      return formatList(strings.output.todoistTasks, (data.results ?? []).map(formatTodoistTask));
    },

    async todoist_quick_add(params = {}) {
      const text = readText(params.text, strings.labels.text);
      const note = optionalText(params.note);
      const reminder = optionalText(params.reminder);
      const data = await todoistRequest(rootDirectory, '/tasks/quick', {
        method: 'POST',
        body: compactObject({
          text,
          note: note || undefined,
          reminder: reminder || undefined,
          auto_reminder: toBoolean(params.auto_reminder ?? params.autoReminder, false),
          meta: toBoolean(params.meta, false),
        }),
      });
      return Object.keys(data).length
        ? [strings.output.todoistCreated, '', JSON.stringify(data, null, 2)].join('\n')
        : strings.output.todoistCreated;
    },

    async todoist_close_task(params = {}) {
      const taskId = encodeURIComponent(
        readText(params.task_id ?? params.taskId, strings.labels.taskId),
      );
      await todoistRequest(rootDirectory, `/tasks/${taskId}/close`, { method: 'POST' });
      return strings.output.todoistClosed;
    },
  };
}
