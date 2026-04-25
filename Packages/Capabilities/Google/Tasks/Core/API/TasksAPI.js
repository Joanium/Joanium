import { createGoogleJsonFetch } from '../../../Core/API/GoogleApiFetch.js';

const TASKS_BASE = 'https://tasks.googleapis.com/tasks/v1';
const tasksFetch = createGoogleJsonFetch('Tasks');
export async function listTaskLists(creds) {
  return (await tasksFetch(creds, `${TASKS_BASE}/users/@me/lists?maxResults=100`)).items ?? [];
}
export async function getTaskList(creds, taskListId) {
  return tasksFetch(creds, `${TASKS_BASE}/users/@me/lists/${taskListId}`);
}
export async function createTaskList(creds, title) {
  return tasksFetch(creds, `${TASKS_BASE}/users/@me/lists`, {
    method: 'POST',
    body: JSON.stringify({ title: title }),
  });
}
export async function deleteTaskList(creds, taskListId) {
  return (
    await tasksFetch(creds, `${TASKS_BASE}/users/@me/lists/${taskListId}`, { method: 'DELETE' }),
    !0
  );
}
export async function listTasks(
  creds,
  taskListId = '@default',
  {
    showCompleted: showCompleted = !1,
    showHidden: showHidden = !1,
    maxResults: maxResults = 100,
  } = {},
) {
  const params = new URLSearchParams({
    maxResults: String(Math.min(maxResults, 100)),
    showCompleted: String(showCompleted),
    showHidden: String(showHidden),
  });
  return (await tasksFetch(creds, `${TASKS_BASE}/lists/${taskListId}/tasks?${params}`)).items ?? [];
}
export async function getTask(creds, taskListId, taskId) {
  return tasksFetch(creds, `${TASKS_BASE}/lists/${taskListId}/tasks/${taskId}`);
}
export async function createTask(
  creds,
  taskListId = '@default',
  { title: title, notes: notes = '', due: due = null, parent: parent = null } = {},
) {
  if (!title) throw new Error('Task title is required');
  const body = { title: title, notes: notes };
  return (
    due && (body.due = new Date(due).toISOString()),
    tasksFetch(
      creds,
      `${TASKS_BASE}/lists/${taskListId}/tasks${parent ? `?parent=${parent}` : ''}`,
      { method: 'POST', body: JSON.stringify(body) },
    )
  );
}
export async function updateTask(creds, taskListId, taskId, updates = {}) {
  const merged = { ...(await getTask(creds, taskListId, taskId)), ...updates };
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
  return (
    await tasksFetch(creds, `${TASKS_BASE}/lists/${taskListId}/tasks/${taskId}`, {
      method: 'DELETE',
    }),
    !0
  );
}
export async function clearCompleted(creds, taskListId = '@default') {
  return (
    await tasksFetch(creds, `${TASKS_BASE}/lists/${taskListId}/clear`, { method: 'POST' }),
    !0
  );
}
export async function moveTaskToList(
  creds,
  sourceListId,
  taskId,
  destListId,
  { parent: parent = null } = {},
) {
  const task = await getTask(creds, sourceListId, taskId),
    newTask = await createTask(creds, destListId, {
      title: task.title,
      notes: task.notes ?? '',
      due: task.due ?? null,
      parent: parent,
    });
  return (await deleteTask(creds, sourceListId, taskId), newTask);
}
export async function createSubtask(
  creds,
  taskListId,
  parentTaskId,
  { title: title, notes: notes = '', due: due = null } = {},
) {
  if (!title) throw new Error('Subtask title is required');
  return createTask(creds, taskListId, {
    title: title,
    notes: notes,
    due: due,
    parent: parentTaskId,
  });
}
export async function listSubtasks(creds, taskListId, parentTaskId) {
  return (await listTasks(creds, taskListId, { showHidden: !0, maxResults: 100 })).filter(
    (t) => t.parent === parentTaskId,
  );
}
export async function renameTaskList(creds, taskListId, newTitle) {
  return tasksFetch(creds, `${TASKS_BASE}/users/@me/lists/${taskListId}`, {
    method: 'PUT',
    body: JSON.stringify({ id: taskListId, title: newTitle }),
  });
}
export async function duplicateTask(creds, sourceListId, taskId, destListId = null) {
  const task = await getTask(creds, sourceListId, taskId);
  return createTask(creds, destListId ?? sourceListId, {
    title: task.title,
    notes: task.notes ?? '',
    due: task.due ?? null,
  });
}
export async function reorderTask(
  creds,
  taskListId,
  taskId,
  { previousTaskId: previousTaskId = null, parentTaskId: parentTaskId = null } = {},
) {
  const params = new URLSearchParams();
  (previousTaskId && params.set('previous', previousTaskId),
    parentTaskId && params.set('parent', parentTaskId));
  const qs = params.toString() ? `?${params}` : '';
  return tasksFetch(creds, `${TASKS_BASE}/lists/${taskListId}/tasks/${taskId}/move${qs}`, {
    method: 'POST',
  });
}
