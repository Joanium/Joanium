export const TASKS_TOOLS = [
  {
    name: 'tasks_list_task_lists',
    description: "List all of the user's Google Task lists.",
    category: 'tasks',
    parameters: {},
  },
  {
    name: 'tasks_list_tasks',
    description: 'List tasks in a specific task list.',
    category: 'tasks',
    parameters: {
      task_list_id:   { type: 'string',  required: false, description: 'Task list ID (default: @default — the primary list). Get IDs from tasks_list_task_lists.' },
      show_completed: { type: 'boolean', required: false, description: 'Include completed tasks (default: false).' },
      max_results:    { type: 'number',  required: false, description: 'Max tasks to return (default: 100).' },
    },
  },
  {
    name: 'tasks_create_task',
    description: 'Create a new task in a task list.',
    category: 'tasks',
    parameters: {
      title:        { type: 'string', required: true,  description: 'Task title.' },
      task_list_id: { type: 'string', required: false, description: 'Task list ID to add to (default: primary list).' },
      notes:        { type: 'string', required: false, description: 'Optional task notes / description.' },
      due:          { type: 'string', required: false, description: 'Due date in ISO 8601 or YYYY-MM-DD format.' },
    },
  },
  {
    name: 'tasks_update_task',
    description: 'Update the title, notes, or due date of an existing task.',
    category: 'tasks',
    parameters: {
      task_list_id: { type: 'string', required: true,  description: 'Task list ID containing the task.' },
      task_id:      { type: 'string', required: true,  description: 'Task ID to update.' },
      title:        { type: 'string', required: false, description: 'New title.' },
      notes:        { type: 'string', required: false, description: 'New notes / description.' },
      due:          { type: 'string', required: false, description: 'New due date in ISO 8601 or YYYY-MM-DD format.' },
    },
  },
  {
    name: 'tasks_complete_task',
    description: 'Mark a task as completed.',
    category: 'tasks',
    parameters: {
      task_list_id: { type: 'string', required: true, description: 'Task list ID.' },
      task_id:      { type: 'string', required: true, description: 'Task ID to complete.' },
    },
  },
  {
    name: 'tasks_reopen_task',
    description: 'Reopen a completed task (mark as needs action).',
    category: 'tasks',
    parameters: {
      task_list_id: { type: 'string', required: true, description: 'Task list ID.' },
      task_id:      { type: 'string', required: true, description: 'Task ID to reopen.' },
    },
  },
  {
    name: 'tasks_delete_task',
    description: 'Permanently delete a task.',
    category: 'tasks',
    parameters: {
      task_list_id: { type: 'string', required: true, description: 'Task list ID.' },
      task_id:      { type: 'string', required: true, description: 'Task ID to delete.' },
    },
  },
  {
    name: 'tasks_clear_completed',
    description: 'Delete all completed tasks from a task list.',
    category: 'tasks',
    parameters: {
      task_list_id: { type: 'string', required: false, description: 'Task list ID to clear (default: primary list).' },
    },
  },
  {
    name: 'tasks_create_task_list',
    description: 'Create a new task list.',
    category: 'tasks',
    parameters: {
      title: { type: 'string', required: true, description: 'Name for the new task list.' },
    },
  },
  {
    name: 'tasks_delete_task_list',
    description: 'Permanently delete a task list and all its tasks.',
    category: 'tasks',
    parameters: {
      task_list_id: { type: 'string', required: true, description: 'Task list ID to delete.' },
    },
  },
];
