async function getFreshGoogleCreds(creds) {
  const { getFreshCreds } = await import('../../../GoogleWorkspace.js');
  return getFreshCreds(creds);
}

const TASKS_BASE = 'https://tasks.googleapis.com/tasks/v1';

async function tasksFetch(creds, url, options = {}) {
  const fresh = await getFreshGoogleCreds(creds);
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
    throw new Error(
      `Tasks API error (${res.status}): ${body.error?.message ?? JSON.stringify(body)}`,
    );
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

export async function listTasks(
  creds,
  taskListId = '@default',
  { showCompleted = false, showHidden = false, maxResults = 100 } = {},
) {
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

export async function createTask(
  creds,
  taskListId = '@default',
  { title, notes = '', due = null, parent = null } = {},
) {
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
  return updateTask(creds, taskListId, taskId, {
    status: 'completed',
    completed: new Date().toISOString(),
  });
}

export async function reopenTask(creds, taskListId, taskId) {
  return updateTask(creds, taskListId, taskId, { status: 'needsAction', completed: null });
}

export async function deleteTask(creds, taskListId, taskId) {
  await tasksFetch(creds, `${TASKS_BASE}/lists/${taskListId}/tasks/${taskId}`, {
    method: 'DELETE',
  });
  return true;
}

export async function clearCompleted(creds, taskListId = '@default') {
  await tasksFetch(creds, `${TASKS_BASE}/lists/${taskListId}/clear`, { method: 'POST' });
  return true;
}

// ─── NEW HELPERS (supporting the 20 new chat tools) ─────────────────────────

/**
 * Move a task to a different task list by re-creating it then deleting the
 * original. The Google Tasks API has no native move endpoint.
 */
export async function moveTaskToList(
  creds,
  sourceListId,
  taskId,
  destListId,
  { parent = null } = {},
) {
  const task = await getTask(creds, sourceListId, taskId);
  const newTask = await createTask(creds, destListId, {
    title: task.title,
    notes: task.notes ?? '',
    due: task.due ?? null,
    parent,
  });
  await deleteTask(creds, sourceListId, taskId);
  return newTask;
}

/**
 * Create a subtask (child task) nested under an existing parent task.
 */
export async function createSubtask(
  creds,
  taskListId,
  parentTaskId,
  { title, notes = '', due = null } = {},
) {
  if (!title) throw new Error('Subtask title is required');
  return createTask(creds, taskListId, { title, notes, due, parent: parentTaskId });
}

/**
 * Return only the direct children of a parent task within a list.
 */
export async function listSubtasks(creds, taskListId, parentTaskId) {
  const all = await listTasks(creds, taskListId, { showHidden: true, maxResults: 100 });
  return all.filter((t) => t.parent === parentTaskId);
}

/**
 * Rename an existing task list.
 */
export async function renameTaskList(creds, taskListId, newTitle) {
  return tasksFetch(creds, `${TASKS_BASE}/users/@me/lists/${taskListId}`, {
    method: 'PUT',
    body: JSON.stringify({ id: taskListId, title: newTitle }),
  });
}

/**
 * Clone a task (optionally into a different list).
 */
export async function duplicateTask(creds, sourceListId, taskId, destListId = null) {
  const task = await getTask(creds, sourceListId, taskId);
  const targetList = destListId ?? sourceListId;
  return createTask(creds, targetList, {
    title: task.title,
    notes: task.notes ?? '',
    due: task.due ?? null,
  });
}

/**
 * Reorder a task by placing it after `previousTaskId` (null = move to top).
 * Optionally re-parent it at the same time.
 */
export async function reorderTask(
  creds,
  taskListId,
  taskId,
  { previousTaskId = null, parentTaskId = null } = {},
) {
  const params = new URLSearchParams();
  if (previousTaskId) params.set('previous', previousTaskId);
  if (parentTaskId) params.set('parent', parentTaskId);
  const qs = params.toString() ? `?${params}` : '';
  return tasksFetch(creds, `${TASKS_BASE}/lists/${taskListId}/tasks/${taskId}/move${qs}`, {
    method: 'POST',
  });
}
