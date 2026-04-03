import * as TasksAPI from '../API/TasksAPI.js';
import { requireGoogleCredentials } from '../../../Common.js';

function formatDue(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

function formatTask(task, index) {
  const done = task.status === 'completed';
  const lines = [
    `${index}. ${done ? '~~' : ''}**${task.title ?? '(Untitled)'}**${done ? '~~' : ''} ${done ? '✅' : ''}`,
    `   ID: \`${task.id}\``,
    task.notes ? `   Notes: ${task.notes.slice(0, 100)}${task.notes.length > 100 ? '...' : ''}` : '',
    task.due ? `   Due: ${formatDue(task.due)}` : '',
    done && task.completed ? `   Completed: ${formatDue(task.completed)}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

export async function executeTasksChatTool(ctx, toolName, params = {}) {
  const credentials = requireGoogleCredentials(ctx);

  switch (toolName) {
    case 'tasks_list_task_lists': {
      const lists = await TasksAPI.listTaskLists(credentials);
      if (!lists.length) return 'No task lists found.';
      const lines = lists.map((list, i) => `${i + 1}. **${list.title ?? '(Untitled)'}** — ID: \`${list.id}\``);
      return `Your task lists (${lists.length}):\n\n${lines.join('\n')}`;
    }

    case 'tasks_list_tasks': {
      const { task_list_id = '@default', show_completed = false, max_results = 100 } = params;
      const tasks = await TasksAPI.listTasks(credentials, task_list_id, { showCompleted: show_completed, maxResults: max_results });
      if (!tasks.length) return `No tasks found${show_completed ? '' : ' (completed tasks hidden)'}. Use show_completed: true to include them.`;
      const pending = tasks.filter(t => t.status !== 'completed');
      const done = tasks.filter(t => t.status === 'completed');
      const sections = [];
      if (pending.length) sections.push(`Pending (${pending.length}):\n\n${pending.map((t, i) => formatTask(t, i + 1)).join('\n\n')}`);
      if (done.length) sections.push(`Completed (${done.length}):\n\n${done.map((t, i) => formatTask(t, i + 1)).join('\n\n')}`);
      return sections.join('\n\n');
    }

    case 'tasks_create_task': {
      const { title, task_list_id = '@default', notes = '', due } = params;
      if (!title?.trim()) throw new Error('Missing required param: title');
      const task = await TasksAPI.createTask(credentials, task_list_id, { title: title.trim(), notes, due });
      return [
        'Task created',
        `Title: ${task.title}`,
        task.notes ? `Notes: ${task.notes}` : '',
        task.due ? `Due: ${formatDue(task.due)}` : '',
        `ID: \`${task.id}\``,
      ].filter(Boolean).join('\n');
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
      ].filter(Boolean).join('\n');
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

    default:
      throw new Error(`Unknown Tasks tool: ${toolName}`);
  }
}
