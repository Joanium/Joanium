import * as TasksAPI from '../API/TasksAPI.js';
import { requireGoogleCredentials } from '../../../Common.js';

function formatDue(iso) {
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

function formatTask(task, index) {
  const done = task.status === 'completed';
  const lines = [
    `${index}. ${done ? '~~' : ''}**${task.title ?? '(Untitled)'}**${done ? '~~' : ''} ${done ? '✅' : ''}`,
    `   ID: \`${task.id}\``,
    task.notes
      ? `   Notes: ${task.notes.slice(0, 100)}${task.notes.length > 100 ? '...' : ''}`
      : '',
    task.due ? `   Due: ${formatDue(task.due)}` : '',
    done && task.completed ? `   Completed: ${formatDue(task.completed)}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

// ─── Shared date helpers ─────────────────────────────────────────────────────

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function isOverdue(task) {
  if (!task.due || task.status === 'completed') return false;
  return new Date(task.due) < startOfDay();
}

function isDueToday(task) {
  if (!task.due || task.status === 'completed') return false;
  const due = new Date(task.due);
  return due >= startOfDay() && due <= endOfDay();
}

function isDueThisWeek(task) {
  if (!task.due || task.status === 'completed') return false;
  const due = new Date(task.due);
  const weekOut = endOfDay(new Date(Date.now() + 6 * 24 * 60 * 60 * 1000));
  return due >= startOfDay() && due <= weekOut;
}

// ─── Helper: get tasks from one list or all lists ────────────────────────────

async function resolveTasks(credentials, task_list_id, { showCompleted = false } = {}) {
  if (task_list_id) {
    const tasks = await TasksAPI.listTasks(credentials, task_list_id, {
      showCompleted,
      maxResults: 100,
    });
    return tasks.map((t) => ({ ...t, _listId: task_list_id }));
  }
  const lists = await TasksAPI.listTaskLists(credentials);
  const results = await Promise.all(
    lists.map(async (l) => {
      const tasks = await TasksAPI.listTasks(credentials, l.id, { showCompleted, maxResults: 100 });
      return tasks.map((t) => ({ ...t, _listId: l.id, _listTitle: l.title }));
    }),
  );
  return results.flat();
}

// ─── Main executor ───────────────────────────────────────────────────────────

export async function executeTasksChatTool(ctx, toolName, params = {}) {
  const credentials = requireGoogleCredentials(ctx);

  switch (toolName) {
    case 'tasks_list_task_lists': {
      const lists = await TasksAPI.listTaskLists(credentials);
      if (!lists.length) return 'No task lists found.';
      const lines = lists.map(
        (list, i) => `${i + 1}. **${list.title ?? '(Untitled)'}** — ID: \`${list.id}\``,
      );
      return `Your task lists (${lists.length}):\n\n${lines.join('\n')}`;
    }

    case 'tasks_list_tasks': {
      const { task_list_id = '@default', show_completed = false, max_results = 100 } = params;
      const tasks = await TasksAPI.listTasks(credentials, task_list_id, {
        showCompleted: show_completed,
        maxResults: max_results,
      });
      if (!tasks.length)
        return `No tasks found${show_completed ? '' : ' (completed tasks hidden)'}. Use show_completed: true to include them.`;
      const pending = tasks.filter((t) => t.status !== 'completed');
      const done = tasks.filter((t) => t.status === 'completed');
      const sections = [];
      if (pending.length)
        sections.push(
          `Pending (${pending.length}):\n\n${pending.map((t, i) => formatTask(t, i + 1)).join('\n\n')}`,
        );
      if (done.length)
        sections.push(
          `Completed (${done.length}):\n\n${done.map((t, i) => formatTask(t, i + 1)).join('\n\n')}`,
        );
      return sections.join('\n\n');
    }

    case 'tasks_create_task': {
      const { title, task_list_id = '@default', notes = '', due } = params;
      if (!title?.trim()) throw new Error('Missing required param: title');
      const task = await TasksAPI.createTask(credentials, task_list_id, {
        title: title.trim(),
        notes,
        due,
      });
      return [
        'Task created',
        `Title: ${task.title}`,
        task.notes ? `Notes: ${task.notes}` : '',
        task.due ? `Due: ${formatDue(task.due)}` : '',
        `ID: \`${task.id}\``,
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'tasks_update_task': {
      const { task_list_id, task_id, title, notes, due } = params;
      if (!task_list_id?.trim()) throw new Error('Missing required param: task_list_id');
      if (!task_id?.trim()) throw new Error('Missing required param: task_id');
      const updates = {};
      if (title !== undefined) updates.title = title;
      if (notes !== undefined) updates.notes = notes;
      if (due !== undefined) updates.due = new Date(due).toISOString();
      const task = await TasksAPI.updateTask(credentials, task_list_id, task_id, updates);
      return [
        'Task updated',
        `Title: ${task.title}`,
        task.notes ? `Notes: ${task.notes}` : '',
        task.due ? `Due: ${formatDue(task.due)}` : '',
        `ID: \`${task.id}\``,
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'tasks_complete_task': {
      const { task_list_id, task_id } = params;
      if (!task_list_id?.trim()) throw new Error('Missing required param: task_list_id');
      if (!task_id?.trim()) throw new Error('Missing required param: task_id');
      const task = await TasksAPI.completeTask(credentials, task_list_id, task_id);
      return `Task "${task.title}" marked as completed ✅`;
    }

    case 'tasks_reopen_task': {
      const { task_list_id, task_id } = params;
      if (!task_list_id?.trim()) throw new Error('Missing required param: task_list_id');
      if (!task_id?.trim()) throw new Error('Missing required param: task_id');
      const task = await TasksAPI.reopenTask(credentials, task_list_id, task_id);
      return `Task "${task.title}" reopened and marked as needs action.`;
    }

    case 'tasks_delete_task': {
      const { task_list_id, task_id } = params;
      if (!task_list_id?.trim()) throw new Error('Missing required param: task_list_id');
      if (!task_id?.trim()) throw new Error('Missing required param: task_id');
      await TasksAPI.deleteTask(credentials, task_list_id, task_id);
      return `Task \`${task_id}\` permanently deleted.`;
    }

    case 'tasks_clear_completed': {
      const { task_list_id = '@default' } = params;
      await TasksAPI.clearCompleted(credentials, task_list_id);
      return 'All completed tasks cleared from the task list.';
    }

    case 'tasks_create_task_list': {
      const { title } = params;
      if (!title?.trim()) throw new Error('Missing required param: title');
      const list = await TasksAPI.createTaskList(credentials, title.trim());
      return `Task list "${list.title}" created.\nID: \`${list.id}\``;
    }

    case 'tasks_delete_task_list': {
      const { task_list_id } = params;
      if (!task_list_id?.trim()) throw new Error('Missing required param: task_list_id');
      await TasksAPI.deleteTaskList(credentials, task_list_id);
      return `Task list \`${task_list_id}\` and all its tasks permanently deleted.`;
    }

    // ── New tool 1: get single task ───────────────────────────────────────

    case 'tasks_get_task': {
      const { task_list_id, task_id } = params;
      if (!task_list_id?.trim()) throw new Error('Missing required param: task_list_id');
      if (!task_id?.trim()) throw new Error('Missing required param: task_id');
      const task = await TasksAPI.getTask(credentials, task_list_id, task_id);
      const done = task.status === 'completed';
      return [
        `**${task.title ?? '(Untitled)'}** ${done ? '✅ (completed)' : '🔲 (pending)'}`,
        `ID: \`${task.id}\``,
        task.notes ? `Notes: ${task.notes}` : '',
        task.due ? `Due: ${formatDue(task.due)}` : '',
        done && task.completed ? `Completed at: ${formatDue(task.completed)}` : '',
        task.parent ? `Parent task ID: \`${task.parent}\`` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    // ── New tool 2: get single task list ──────────────────────────────────

    case 'tasks_get_task_list': {
      const { task_list_id } = params;
      if (!task_list_id?.trim()) throw new Error('Missing required param: task_list_id');
      const list = await TasksAPI.getTaskList(credentials, task_list_id);
      return [
        `**${list.title ?? '(Untitled)'}**`,
        `ID: \`${list.id}\``,
        list.updated ? `Last updated: ${formatDue(list.updated)}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    // ── New tool 3: search tasks ──────────────────────────────────────────

    case 'tasks_search_tasks': {
      const { query, task_list_id = '@default', show_completed = false } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      const tasks = await TasksAPI.listTasks(credentials, task_list_id, {
        showCompleted: show_completed,
        maxResults: 100,
      });
      const q = query.toLowerCase();
      const matches = tasks.filter(
        (t) =>
          (t.title ?? '').toLowerCase().includes(q) || (t.notes ?? '').toLowerCase().includes(q),
      );
      if (!matches.length) return `No tasks matched "${query}".`;
      return `Found ${matches.length} task(s) matching "${query}":\n\n${matches.map((t, i) => formatTask(t, i + 1)).join('\n\n')}`;
    }

    // ── New tool 4: list all tasks across every list ───────────────────────

    case 'tasks_list_all_tasks': {
      const { show_completed = false } = params;
      const lists = await TasksAPI.listTaskLists(credentials);
      const sections = [];
      for (const list of lists) {
        const tasks = await TasksAPI.listTasks(credentials, list.id, {
          showCompleted: show_completed,
          maxResults: 100,
        });
        if (!tasks.length) continue;
        sections.push(
          `### ${list.title ?? '(Untitled)'}\n\n${tasks.map((t, i) => formatTask(t, i + 1)).join('\n\n')}`,
        );
      }
      return sections.length
        ? sections.join('\n\n')
        : `No tasks found across any list${show_completed ? '' : ' (completed tasks hidden)'}.`;
    }

    // ── New tool 5: overdue tasks ─────────────────────────────────────────

    case 'tasks_list_overdue_tasks': {
      const { task_list_id } = params;
      const tasks = await resolveTasks(credentials, task_list_id, { showCompleted: false });
      const overdue = tasks.filter(isOverdue);
      if (!overdue.length) return '🎉 No overdue tasks found!';
      const lines = overdue.map((t, i) => {
        const listLabel = t._listTitle ? ` _(${t._listTitle})_` : '';
        return `${formatTask(t, i + 1)}${listLabel}`;
      });
      return `Overdue tasks (${overdue.length}):\n\n${lines.join('\n\n')}`;
    }

    // ── New tool 6: due today ─────────────────────────────────────────────

    case 'tasks_list_due_today': {
      const { task_list_id } = params;
      const tasks = await resolveTasks(credentials, task_list_id, { showCompleted: false });
      const dueToday = tasks.filter(isDueToday);
      if (!dueToday.length) return 'No tasks due today.';
      const lines = dueToday.map((t, i) => {
        const listLabel = t._listTitle ? ` _(${t._listTitle})_` : '';
        return `${formatTask(t, i + 1)}${listLabel}`;
      });
      return `Tasks due today (${dueToday.length}):\n\n${lines.join('\n\n')}`;
    }

    // ── New tool 7: due this week ─────────────────────────────────────────

    case 'tasks_list_due_this_week': {
      const { task_list_id } = params;
      const tasks = await resolveTasks(credentials, task_list_id, { showCompleted: false });
      const upcoming = tasks.filter(isDueThisWeek);
      if (!upcoming.length) return 'No tasks due in the next 7 days.';
      upcoming.sort((a, b) => new Date(a.due) - new Date(b.due));
      const lines = upcoming.map((t, i) => {
        const listLabel = t._listTitle ? ` _(${t._listTitle})_` : '';
        return `${formatTask(t, i + 1)}${listLabel}`;
      });
      return `Tasks due this week (${upcoming.length}):\n\n${lines.join('\n\n')}`;
    }

    // ── New tool 8: bulk complete ─────────────────────────────────────────

    case 'tasks_bulk_complete_tasks': {
      const { task_list_id, task_ids } = params;
      if (!task_list_id?.trim()) throw new Error('Missing required param: task_list_id');
      if (!Array.isArray(task_ids) || !task_ids.length)
        throw new Error('task_ids must be a non-empty array');
      const results = await Promise.allSettled(
        task_ids.map((id) => TasksAPI.completeTask(credentials, task_list_id, id)),
      );
      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;
      return `Bulk complete: ${succeeded} task(s) marked completed ✅${failed ? `, ${failed} failed.` : '.'}`;
    }

    // ── New tool 9: bulk delete ───────────────────────────────────────────

    case 'tasks_bulk_delete_tasks': {
      const { task_list_id, task_ids } = params;
      if (!task_list_id?.trim()) throw new Error('Missing required param: task_list_id');
      if (!Array.isArray(task_ids) || !task_ids.length)
        throw new Error('task_ids must be a non-empty array');
      const results = await Promise.allSettled(
        task_ids.map((id) => TasksAPI.deleteTask(credentials, task_list_id, id)),
      );
      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;
      return `Bulk delete: ${succeeded} task(s) permanently deleted 🗑️${failed ? `, ${failed} failed.` : '.'}`;
    }

    // ── New tool 10: bulk create ──────────────────────────────────────────

    case 'tasks_bulk_create_tasks': {
      const { task_list_id = '@default', tasks } = params;
      if (!Array.isArray(tasks) || !tasks.length)
        throw new Error('tasks must be a non-empty array');
      const results = await Promise.allSettled(
        tasks.map((t) =>
          TasksAPI.createTask(credentials, task_list_id, {
            title: t.title,
            notes: t.notes ?? '',
            due: t.due ?? null,
          }),
        ),
      );
      const succeeded = results.filter((r) => r.status === 'fulfilled').map((r) => r.value.title);
      const failed = results.filter((r) => r.status === 'rejected').length;
      return [
        `Bulk create: ${succeeded.length} task(s) created${failed ? `, ${failed} failed` : ''}.`,
        ...succeeded.map((title) => `  • ${title}`),
      ].join('\n');
    }

    // ── New tool 11: move task to another list ────────────────────────────

    case 'tasks_move_task': {
      const { source_task_list_id, task_id, dest_task_list_id } = params;
      if (!source_task_list_id?.trim())
        throw new Error('Missing required param: source_task_list_id');
      if (!task_id?.trim()) throw new Error('Missing required param: task_id');
      if (!dest_task_list_id?.trim()) throw new Error('Missing required param: dest_task_list_id');
      const task = await TasksAPI.moveTaskToList(
        credentials,
        source_task_list_id,
        task_id,
        dest_task_list_id,
      );
      return `Task "${task.title}" moved to list \`${dest_task_list_id}\`.\nNew ID: \`${task.id}\``;
    }

    // ── New tool 12: add subtask ──────────────────────────────────────────

    case 'tasks_add_subtask': {
      const { task_list_id, parent_task_id, title, notes = '', due } = params;
      if (!task_list_id?.trim()) throw new Error('Missing required param: task_list_id');
      if (!parent_task_id?.trim()) throw new Error('Missing required param: parent_task_id');
      if (!title?.trim()) throw new Error('Missing required param: title');
      const subtask = await TasksAPI.createSubtask(credentials, task_list_id, parent_task_id, {
        title: title.trim(),
        notes,
        due,
      });
      return [
        'Subtask created',
        `Title: ${subtask.title}`,
        subtask.notes ? `Notes: ${subtask.notes}` : '',
        subtask.due ? `Due: ${formatDue(subtask.due)}` : '',
        `ID: \`${subtask.id}\``,
        `Parent ID: \`${parent_task_id}\``,
      ]
        .filter(Boolean)
        .join('\n');
    }

    // ── New tool 13: list subtasks ────────────────────────────────────────

    case 'tasks_list_subtasks': {
      const { task_list_id, parent_task_id } = params;
      if (!task_list_id?.trim()) throw new Error('Missing required param: task_list_id');
      if (!parent_task_id?.trim()) throw new Error('Missing required param: parent_task_id');
      const subtasks = await TasksAPI.listSubtasks(credentials, task_list_id, parent_task_id);
      if (!subtasks.length) return 'No subtasks found for this task.';
      return `Subtasks (${subtasks.length}):\n\n${subtasks.map((t, i) => formatTask(t, i + 1)).join('\n\n')}`;
    }

    // ── New tool 14: rename task list ─────────────────────────────────────

    case 'tasks_rename_task_list': {
      const { task_list_id, new_title } = params;
      if (!task_list_id?.trim()) throw new Error('Missing required param: task_list_id');
      if (!new_title?.trim()) throw new Error('Missing required param: new_title');
      const list = await TasksAPI.renameTaskList(credentials, task_list_id, new_title.trim());
      return `Task list renamed to "${list.title}".\nID: \`${list.id}\``;
    }

    // ── New tool 15: duplicate task ───────────────────────────────────────

    case 'tasks_duplicate_task': {
      const { task_list_id, task_id, dest_task_list_id } = params;
      if (!task_list_id?.trim()) throw new Error('Missing required param: task_list_id');
      if (!task_id?.trim()) throw new Error('Missing required param: task_id');
      const copy = await TasksAPI.duplicateTask(
        credentials,
        task_list_id,
        task_id,
        dest_task_list_id ?? null,
      );
      return [
        'Task duplicated',
        `Title: ${copy.title}`,
        copy.notes ? `Notes: ${copy.notes}` : '',
        copy.due ? `Due: ${formatDue(copy.due)}` : '',
        `New ID: \`${copy.id}\``,
        dest_task_list_id ? `In list: \`${dest_task_list_id}\`` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    // ── New tool 16: set due today ────────────────────────────────────────

    case 'tasks_set_due_today': {
      const { task_list_id, task_id } = params;
      if (!task_list_id?.trim()) throw new Error('Missing required param: task_list_id');
      if (!task_id?.trim()) throw new Error('Missing required param: task_id');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const task = await TasksAPI.updateTask(credentials, task_list_id, task_id, {
        due: today.toISOString(),
      });
      return `Task "${task.title}" due date set to today (${formatDue(today.toISOString())}).`;
    }

    // ── New tool 17: set due tomorrow ─────────────────────────────────────

    case 'tasks_set_due_tomorrow': {
      const { task_list_id, task_id } = params;
      if (!task_list_id?.trim()) throw new Error('Missing required param: task_list_id');
      if (!task_id?.trim()) throw new Error('Missing required param: task_id');
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const task = await TasksAPI.updateTask(credentials, task_list_id, task_id, {
        due: tomorrow.toISOString(),
      });
      return `Task "${task.title}" due date set to tomorrow (${formatDue(tomorrow.toISOString())}).`;
    }

    // ── New tool 18: count tasks ──────────────────────────────────────────

    case 'tasks_count_tasks': {
      const { task_list_id } = params;
      const all = await resolveTasks(credentials, task_list_id, { showCompleted: true });
      const pending = all.filter((t) => t.status !== 'completed');
      const completed = all.filter((t) => t.status === 'completed');
      const overdue = all.filter(isOverdue);
      const dueToday = all.filter(isDueToday);
      return [
        task_list_id
          ? `Task counts for list \`${task_list_id}\`:`
          : 'Task counts across all lists:',
        `  📋 Pending:   ${pending.length}`,
        `  ✅ Completed: ${completed.length}`,
        `  ⚠️  Overdue:   ${overdue.length}`,
        `  📅 Due today: ${dueToday.length}`,
        `  📊 Total:     ${all.length}`,
      ].join('\n');
    }

    // ── New tool 19: reorder task ─────────────────────────────────────────

    case 'tasks_reorder_task': {
      const { task_list_id, task_id, previous_task_id, parent_task_id } = params;
      if (!task_list_id?.trim()) throw new Error('Missing required param: task_list_id');
      if (!task_id?.trim()) throw new Error('Missing required param: task_id');
      const task = await TasksAPI.reorderTask(credentials, task_list_id, task_id, {
        previousTaskId: previous_task_id ?? null,
        parentTaskId: parent_task_id ?? null,
      });
      const posLabel = previous_task_id
        ? `after task \`${previous_task_id}\``
        : 'at the top of the list';
      return `Task "${task.title}" moved ${posLabel}.`;
    }

    // ── New tool 20: export as markdown ──────────────────────────────────

    case 'tasks_export_tasks_markdown': {
      const { task_list_id = '@default', show_completed = true, include_notes = true } = params;
      const tasks = await TasksAPI.listTasks(credentials, task_list_id, {
        showCompleted: show_completed,
        maxResults: 100,
      });
      if (!tasks.length) return 'No tasks to export.';

      let listTitle = task_list_id;
      try {
        const listInfo = await TasksAPI.getTaskList(credentials, task_list_id);
        listTitle = listInfo.title ?? task_list_id;
      } catch {
        /* ignore */
      }

      const lines = [`# ${listTitle}`, ''];
      const topLevel = tasks.filter((t) => !t.parent);
      const children = tasks.filter((t) => t.parent);

      function renderTask(t, indent = '') {
        const done = t.status === 'completed';
        const checkbox = done ? '[x]' : '[ ]';
        const due = t.due ? ` _(due ${formatDue(t.due)})_` : '';
        lines.push(`${indent}- ${checkbox} **${t.title ?? '(Untitled)'}**${due}`);
        if (include_notes && t.notes) {
          t.notes.split('\n').forEach((note) => lines.push(`${indent}  > ${note}`));
        }
        children.filter((c) => c.parent === t.id).forEach((c) => renderTask(c, indent + '  '));
      }

      topLevel.forEach((t) => renderTask(t));
      return lines.join('\n');
    }

    default:
      throw new Error(`Unknown Tasks tool: ${toolName}`);
  }
}
