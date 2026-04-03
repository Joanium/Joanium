import { getFreshCreds } from '../../../GoogleWorkspace.js';

const TASKS_BASE = 'https://tasks.googleapis.com/tasks/v1';

async function tasksFetch(creds, url, options = {}) {
  const fresh = await getFreshCreds(creds);
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${fresh.accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Tasks API error (${res.status}): ${body.error?.message ?? JSON.stringify(body)}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function listTaskLists(creds) {
  const data = await tasksFetch(creds, `${TASKS_BASE}/users/@me/lists?maxResults=100`);
  return data.items ?? [];
}

export async function getTaskList(creds, taskListId) {
  return tasksFetch(creds, `${TASKS_BASE}/users/@me/lists/${taskListId}`);
}

export async function createTaskList(creds, title) {
  return tasksFetch(creds, `${TASKS_BASE}/users/@me/lists`, {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

export async function deleteTaskList(creds, taskListId) {
  await tasksFetch(creds, `${TASKS_BASE}/users/@me/lists/${taskListId}`, { method: 'DELETE' });
  return true;
}

export async function listTasks(creds, taskListId = '@default', { showCompleted = false, showHidden = false, maxResults = 100 } = {}) {
  const params = new URLSearchParams({
    maxResults: String(Math.min(maxResults, 100)),
    showCompleted: String(showCompleted),
    showHidden: String(showHidden),
  });
  const data = await tasksFetch(creds, `${TASKS_BASE}/lists/${taskListId}/tasks?${params}`);
  return data.items ?? [];
}

export async function getTask(creds, taskListId, taskId) {
  return tasksFetch(creds, `${TASKS_BASE}/lists/${taskListId}/tasks/${taskId}`);
}

export async function createTask(creds, taskListId = '@default', { title, notes = '', due = null, parent = null } = {}) {
  if (!title) throw new Error('Task title is required');
  const body = { title, notes };
  if (due) body.due = new Date(due).toISOString();
  const url = `${TASKS_BASE}/lists/${taskListId}/tasks${parent ? `?parent=${parent}` : ''}`;
  return tasksFetch(creds, url, { method: 'POST', body: JSON.stringify(body) });
}

export async function updateTask(creds, taskListId, taskId, updates = {}) {
  const existing = await getTask(creds, taskListId, taskId);
  const merged = { ...existing, ...updates };
  return tasksFetch(creds, `${TASKS_BASE}/lists/${taskListId}/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify(merged),
  });
}

export async function completeTask(creds, taskListId, taskId) {
  return updateTask(creds, taskListId, taskId, { status: 'completed', completed: new Date().toISOString() });
}

export async function reopenTask(creds, taskListId, taskId) {
  return updateTask(creds, taskListId, taskId, { status: 'needsAction', completed: null });
}

export async function deleteTask(creds, taskListId, taskId) {
  await tasksFetch(creds, `${TASKS_BASE}/lists/${taskListId}/tasks/${taskId}`, { method: 'DELETE' });
  return true;
}

export async function clearCompleted(creds, taskListId = '@default') {
  await tasksFetch(creds, `${TASKS_BASE}/lists/${taskListId}/clear`, { method: 'POST' });
  return true;
}
