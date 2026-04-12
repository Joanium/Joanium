import * as TasksAPI from '../API/TasksAPI.js';
import { requireGoogleCredentials } from '../../../Common.js';
import {
  formatDue,
  formatTask,
  isOverdue,
  isDueToday,
  isDueThisWeek,
  resolveTasks,
} from './Utils.js';
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
      const {
          task_list_id: task_list_id = '@default',
          show_completed: show_completed = !1,
          max_results: max_results = 100,
        } = params,
        tasks = await TasksAPI.listTasks(credentials, task_list_id, {
          showCompleted: show_completed,
          maxResults: max_results,
        });
      if (!tasks.length)
        return `No tasks found${show_completed ? '' : ' (completed tasks hidden)'}. Use show_completed: true to include them.`;
      const pending = tasks.filter((t) => 'completed' !== t.status),
        done = tasks.filter((t) => 'completed' === t.status),
        sections = [];
      return (
        pending.length &&
          sections.push(
            `Pending (${pending.length}):\n\n${pending.map((t, i) => formatTask(t, i + 1)).join('\n\n')}`,
          ),
        done.length &&
          sections.push(
            `Completed (${done.length}):\n\n${done.map((t, i) => formatTask(t, i + 1)).join('\n\n')}`,
          ),
        sections.join('\n\n')
      );
    }
    case 'tasks_create_task': {
      const {
        title: title,
        task_list_id: task_list_id = '@default',
        notes: notes = '',
        due: due,
      } = params;
      if (!title?.trim()) throw new Error('Missing required param: title');
      const task = await TasksAPI.createTask(credentials, task_list_id, {
        title: title.trim(),
        notes: notes,
        due: due,
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
      const {
        task_list_id: task_list_id,
        task_id: task_id,
        title: title,
        notes: notes,
        due: due,
      } = params;
      if (!task_list_id?.trim()) throw new Error('Missing required param: task_list_id');
      if (!task_id?.trim()) throw new Error('Missing required param: task_id');
      const updates = {};
      (void 0 !== title && (updates.title = title),
        void 0 !== notes && (updates.notes = notes),
        void 0 !== due && (updates.due = new Date(due).toISOString()));
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
      const { task_list_id: task_list_id, task_id: task_id } = params;
      if (!task_list_id?.trim()) throw new Error('Missing required param: task_list_id');
      if (!task_id?.trim()) throw new Error('Missing required param: task_id');
      return `Task "${(await TasksAPI.completeTask(credentials, task_list_id, task_id)).title}" marked as completed ✅`;
    }
    case 'tasks_reopen_task': {
      const { task_list_id: task_list_id, task_id: task_id } = params;
      if (!task_list_id?.trim()) throw new Error('Missing required param: task_list_id');
      if (!task_id?.trim()) throw new Error('Missing required param: task_id');
      return `Task "${(await TasksAPI.reopenTask(credentials, task_list_id, task_id)).title}" reopened and marked as needs action.`;
    }
    case 'tasks_delete_task': {
      const { task_list_id: task_list_id, task_id: task_id } = params;
      if (!task_list_id?.trim()) throw new Error('Missing required param: task_list_id');
      if (!task_id?.trim()) throw new Error('Missing required param: task_id');
      return (
        await TasksAPI.deleteTask(credentials, task_list_id, task_id),
        `Task \`${task_id}\` permanently deleted.`
      );
    }
    case 'tasks_clear_completed': {
      const { task_list_id: task_list_id = '@default' } = params;
      return (
        await TasksAPI.clearCompleted(credentials, task_list_id),
        'All completed tasks cleared from the task list.'
      );
    }
    case 'tasks_create_task_list': {
      const { title: title } = params;
      if (!title?.trim()) throw new Error('Missing required param: title');
      const list = await TasksAPI.createTaskList(credentials, title.trim());
      return `Task list "${list.title}" created.\nID: \`${list.id}\``;
    }
    case 'tasks_delete_task_list': {
      const { task_list_id: task_list_id } = params;
      if (!task_list_id?.trim()) throw new Error('Missing required param: task_list_id');
      return (
        await TasksAPI.deleteTaskList(credentials, task_list_id),
        `Task list \`${task_list_id}\` and all its tasks permanently deleted.`
      );
    }
    case 'tasks_get_task': {
      const { task_list_id: task_list_id, task_id: task_id } = params;
      if (!task_list_id?.trim()) throw new Error('Missing required param: task_list_id');
      if (!task_id?.trim()) throw new Error('Missing required param: task_id');
      const task = await TasksAPI.getTask(credentials, task_list_id, task_id),
        done = 'completed' === task.status;
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
    case 'tasks_get_task_list': {
      const { task_list_id: task_list_id } = params;
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
    case 'tasks_search_tasks': {
      const {
        query: query,
        task_list_id: task_list_id = '@default',
        show_completed: show_completed = !1,
      } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      const tasks = await TasksAPI.listTasks(credentials, task_list_id, {
          showCompleted: show_completed,
          maxResults: 100,
        }),
        q = query.toLowerCase(),
        matches = tasks.filter(
          (t) =>
            (t.title ?? '').toLowerCase().includes(q) || (t.notes ?? '').toLowerCase().includes(q),
        );
      return matches.length
        ? `Found ${matches.length} task(s) matching "${query}":\n\n${matches.map((t, i) => formatTask(t, i + 1)).join('\n\n')}`
        : `No tasks matched "${query}".`;
    }
    case 'tasks_list_all_tasks': {
      const { show_completed: show_completed = !1 } = params,
        lists = await TasksAPI.listTaskLists(credentials),
        sections = [];
      for (const list of lists) {
        const tasks = await TasksAPI.listTasks(credentials, list.id, {
          showCompleted: show_completed,
          maxResults: 100,
        });
        tasks.length &&
          sections.push(
            `### ${list.title ?? '(Untitled)'}\n\n${tasks.map((t, i) => formatTask(t, i + 1)).join('\n\n')}`,
          );
      }
      return sections.length
        ? sections.join('\n\n')
        : `No tasks found across any list${show_completed ? '' : ' (completed tasks hidden)'}.`;
    }
    case 'tasks_list_overdue_tasks': {
      const { task_list_id: task_list_id } = params,
        overdue = (await resolveTasks(credentials, task_list_id, { showCompleted: !1 })).filter(
          isOverdue,
        );
      if (!overdue.length) return '🎉 No overdue tasks found!';
      const lines = overdue.map((t, i) => {
        const listLabel = t._listTitle ? ` _(${t._listTitle})_` : '';
        return `${formatTask(t, i + 1)}${listLabel}`;
      });
      return `Overdue tasks (${overdue.length}):\n\n${lines.join('\n\n')}`;
    }
    case 'tasks_list_due_today': {
      const { task_list_id: task_list_id } = params,
        dueToday = (await resolveTasks(credentials, task_list_id, { showCompleted: !1 })).filter(
          isDueToday,
        );
      if (!dueToday.length) return 'No tasks due today.';
      const lines = dueToday.map((t, i) => {
        const listLabel = t._listTitle ? ` _(${t._listTitle})_` : '';
        return `${formatTask(t, i + 1)}${listLabel}`;
      });
      return `Tasks due today (${dueToday.length}):\n\n${lines.join('\n\n')}`;
    }
    case 'tasks_list_due_this_week': {
      const { task_list_id: task_list_id } = params,
        upcoming = (await resolveTasks(credentials, task_list_id, { showCompleted: !1 })).filter(
          isDueThisWeek,
        );
      if (!upcoming.length) return 'No tasks due in the next 7 days.';
      upcoming.sort((a, b) => new Date(a.due) - new Date(b.due));
      const lines = upcoming.map((t, i) => {
        const listLabel = t._listTitle ? ` _(${t._listTitle})_` : '';
        return `${formatTask(t, i + 1)}${listLabel}`;
      });
      return `Tasks due this week (${upcoming.length}):\n\n${lines.join('\n\n')}`;
    }
    case 'tasks_bulk_complete_tasks': {
      const { task_list_id: task_list_id, task_ids: task_ids } = params;
      if (!task_list_id?.trim()) throw new Error('Missing required param: task_list_id');
      if (!Array.isArray(task_ids) || !task_ids.length)
        throw new Error('task_ids must be a non-empty array');
      const results = await Promise.allSettled(
          task_ids.map((id) => TasksAPI.completeTask(credentials, task_list_id, id)),
        ),
        succeeded = results.filter((r) => 'fulfilled' === r.status).length,
        failed = results.filter((r) => 'rejected' === r.status).length;
      return `Bulk complete: ${succeeded} task(s) marked completed ✅${failed ? `, ${failed} failed.` : '.'}`;
    }
    case 'tasks_bulk_delete_tasks': {
      const { task_list_id: task_list_id, task_ids: task_ids } = params;
      if (!task_list_id?.trim()) throw new Error('Missing required param: task_list_id');
      if (!Array.isArray(task_ids) || !task_ids.length)
        throw new Error('task_ids must be a non-empty array');
      const results = await Promise.allSettled(
          task_ids.map((id) => TasksAPI.deleteTask(credentials, task_list_id, id)),
        ),
        succeeded = results.filter((r) => 'fulfilled' === r.status).length,
        failed = results.filter((r) => 'rejected' === r.status).length;
      return `Bulk delete: ${succeeded} task(s) permanently deleted 🗑️${failed ? `, ${failed} failed.` : '.'}`;
    }
    case 'tasks_bulk_create_tasks': {
      const { task_list_id: task_list_id = '@default', tasks: tasks } = params;
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
        ),
        succeeded = results.filter((r) => 'fulfilled' === r.status).map((r) => r.value.title),
        failed = results.filter((r) => 'rejected' === r.status).length;
      return [
        `Bulk create: ${succeeded.length} task(s) created${failed ? `, ${failed} failed` : ''}.`,
        ...succeeded.map((title) => `  • ${title}`),
      ].join('\n');
    }
    case 'tasks_move_task': {
      const {
        source_task_list_id: source_task_list_id,
        task_id: task_id,
        dest_task_list_id: dest_task_list_id,
      } = params;
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
    case 'tasks_add_subtask': {
      const {
        task_list_id: task_list_id,
        parent_task_id: parent_task_id,
        title: title,
        notes: notes = '',
        due: due,
      } = params;
      if (!task_list_id?.trim()) throw new Error('Missing required param: task_list_id');
      if (!parent_task_id?.trim()) throw new Error('Missing required param: parent_task_id');
      if (!title?.trim()) throw new Error('Missing required param: title');
      const subtask = await TasksAPI.createSubtask(credentials, task_list_id, parent_task_id, {
        title: title.trim(),
        notes: notes,
        due: due,
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
    case 'tasks_list_subtasks': {
      const { task_list_id: task_list_id, parent_task_id: parent_task_id } = params;
      if (!task_list_id?.trim()) throw new Error('Missing required param: task_list_id');
      if (!parent_task_id?.trim()) throw new Error('Missing required param: parent_task_id');
      const subtasks = await TasksAPI.listSubtasks(credentials, task_list_id, parent_task_id);
      return subtasks.length
        ? `Subtasks (${subtasks.length}):\n\n${subtasks.map((t, i) => formatTask(t, i + 1)).join('\n\n')}`
        : 'No subtasks found for this task.';
    }
    case 'tasks_rename_task_list': {
      const { task_list_id: task_list_id, new_title: new_title } = params;
      if (!task_list_id?.trim()) throw new Error('Missing required param: task_list_id');
      if (!new_title?.trim()) throw new Error('Missing required param: new_title');
      const list = await TasksAPI.renameTaskList(credentials, task_list_id, new_title.trim());
      return `Task list renamed to "${list.title}".\nID: \`${list.id}\``;
    }
    case 'tasks_duplicate_task': {
      const {
        task_list_id: task_list_id,
        task_id: task_id,
        dest_task_list_id: dest_task_list_id,
      } = params;
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
    case 'tasks_set_due_today': {
      const { task_list_id: task_list_id, task_id: task_id } = params;
      if (!task_list_id?.trim()) throw new Error('Missing required param: task_list_id');
      if (!task_id?.trim()) throw new Error('Missing required param: task_id');
      const today = new Date();
      return (
        today.setHours(0, 0, 0, 0),
        `Task "${(await TasksAPI.updateTask(credentials, task_list_id, task_id, { due: today.toISOString() })).title}" due date set to today (${formatDue(today.toISOString())}).`
      );
    }
    case 'tasks_set_due_tomorrow': {
      const { task_list_id: task_list_id, task_id: task_id } = params;
      if (!task_list_id?.trim()) throw new Error('Missing required param: task_list_id');
      if (!task_id?.trim()) throw new Error('Missing required param: task_id');
      const tomorrow = new Date();
      return (
        tomorrow.setDate(tomorrow.getDate() + 1),
        tomorrow.setHours(0, 0, 0, 0),
        `Task "${(await TasksAPI.updateTask(credentials, task_list_id, task_id, { due: tomorrow.toISOString() })).title}" due date set to tomorrow (${formatDue(tomorrow.toISOString())}).`
      );
    }
    case 'tasks_count_tasks': {
      const { task_list_id: task_list_id } = params,
        all = await resolveTasks(credentials, task_list_id, { showCompleted: !0 }),
        pending = all.filter((t) => 'completed' !== t.status),
        completed = all.filter((t) => 'completed' === t.status),
        overdue = all.filter(isOverdue),
        dueToday = all.filter(isDueToday);
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
    case 'tasks_reorder_task': {
      const {
        task_list_id: task_list_id,
        task_id: task_id,
        previous_task_id: previous_task_id,
        parent_task_id: parent_task_id,
      } = params;
      if (!task_list_id?.trim()) throw new Error('Missing required param: task_list_id');
      if (!task_id?.trim()) throw new Error('Missing required param: task_id');
      const posLabel = previous_task_id
        ? `after task \`${previous_task_id}\``
        : 'at the top of the list';
      return `Task "${(await TasksAPI.reorderTask(credentials, task_list_id, task_id, { previousTaskId: previous_task_id ?? null, parentTaskId: parent_task_id ?? null })).title}" moved ${posLabel}.`;
    }
    case 'tasks_export_tasks_markdown': {
      const {
          task_list_id: task_list_id = '@default',
          show_completed: show_completed = !0,
          include_notes: include_notes = !0,
        } = params,
        tasks = await TasksAPI.listTasks(credentials, task_list_id, {
          showCompleted: show_completed,
          maxResults: 100,
        });
      if (!tasks.length) return 'No tasks to export.';
      let listTitle = task_list_id;
      try {
        listTitle = (await TasksAPI.getTaskList(credentials, task_list_id)).title ?? task_list_id;
      } catch {}
      const lines = [`# ${listTitle}`, ''],
        topLevel = tasks.filter((t) => !t.parent),
        children = tasks.filter((t) => t.parent);
      function renderTask(t, indent = '') {
        const checkbox = 'completed' === t.status ? '[x]' : '[ ]',
          due = t.due ? ` _(due ${formatDue(t.due)})_` : '';
        (lines.push(`${indent}- ${checkbox} **${t.title ?? '(Untitled)'}**${due}`),
          include_notes &&
            t.notes &&
            t.notes.split('\n').forEach((note) => lines.push(`${indent}  > ${note}`)),
          children.filter((c) => c.parent === t.id).forEach((c) => renderTask(c, indent + '  ')));
      }
      return (topLevel.forEach((t) => renderTask(t)), lines.join('\n'));
    }
    default:
      throw new Error(`Unknown Tasks tool: ${toolName}`);
  }
}
