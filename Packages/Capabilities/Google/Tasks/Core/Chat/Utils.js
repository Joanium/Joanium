export function formatDue(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}
export function formatTask(task, index) {
  const done = 'completed' === task.status;
  return [
    `${index}. ${done ? '~~' : ''}**${task.title ?? '(Untitled)'}**${done ? '~~' : ''} ${done ? '✅' : ''}`,
    `   ID: \`${task.id}\``,
    task.notes
      ? `   Notes: ${task.notes.slice(0, 100)}${task.notes.length > 100 ? '...' : ''}`
      : '',
    task.due ? `   Due: ${formatDue(task.due)}` : '',
    done && task.completed ? `   Completed: ${formatDue(task.completed)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
function startOfDay(date = new Date()) {
  const d = new Date(date);
  return (d.setHours(0, 0, 0, 0), d);
}
function endOfDay(date = new Date()) {
  const d = new Date(date);
  return (d.setHours(23, 59, 59, 999), d);
}
export function isOverdue(task) {
  return !(!task.due || 'completed' === task.status) && new Date(task.due) < startOfDay();
}
export function isDueToday(task) {
  if (!task.due || 'completed' === task.status) return !1;
  const due = new Date(task.due);
  return due >= startOfDay() && due <= endOfDay();
}
export function isDueThisWeek(task) {
  if (!task.due || 'completed' === task.status) return !1;
  const due = new Date(task.due),
    weekOut = endOfDay(new Date(Date.now() + 5184e5));
  return due >= startOfDay() && due <= weekOut;
}
export async function resolveTasks(
  credentials,
  task_list_id,
  { showCompleted: showCompleted = !1 } = {},
) {
  if (task_list_id)
    return (
      await TasksAPI.listTasks(credentials, task_list_id, {
        showCompleted: showCompleted,
        maxResults: 100,
      })
    ).map((t) => ({ ...t, _listId: task_list_id }));
  const lists = await TasksAPI.listTaskLists(credentials);
  return (
    await Promise.all(
      lists.map(async (l) =>
        (
          await TasksAPI.listTasks(credentials, l.id, {
            showCompleted: showCompleted,
            maxResults: 100,
          })
        ).map((t) => ({ ...t, _listId: l.id, _listTitle: l.title })),
      ),
    )
  ).flat();
}
