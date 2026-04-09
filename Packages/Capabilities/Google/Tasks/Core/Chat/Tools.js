export const TASKS_TOOLS = [
  // ─── ORIGINAL 10 TOOLS ───────────────────────────────────────────────────

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
      task_list_id: {
        type: 'string',
        required: false,
        description:
          'Task list ID (default: @default — the primary list). Get IDs from tasks_list_task_lists.',
      },
      show_completed: {
        type: 'boolean',
        required: false,
        description: 'Include completed tasks (default: false).',
      },
      max_results: {
        type: 'number',
        required: false,
        description: 'Max tasks to return (default: 100).',
      },
    },
  },
  {
    name: 'tasks_create_task',
    description: 'Create a new task in a task list.',
    category: 'tasks',
    parameters: {
      title: { type: 'string', required: true, description: 'Task title.' },
      task_list_id: {
        type: 'string',
        required: false,
        description: 'Task list ID to add to (default: primary list).',
      },
      notes: { type: 'string', required: false, description: 'Optional task notes / description.' },
      due: {
        type: 'string',
        required: false,
        description: 'Due date in ISO 8601 or YYYY-MM-DD format.',
      },
    },
  },
  {
    name: 'tasks_update_task',
    description: 'Update the title, notes, or due date of an existing task.',
    category: 'tasks',
    parameters: {
      task_list_id: {
        type: 'string',
        required: true,
        description: 'Task list ID containing the task.',
      },
      task_id: { type: 'string', required: true, description: 'Task ID to update.' },
      title: { type: 'string', required: false, description: 'New title.' },
      notes: { type: 'string', required: false, description: 'New notes / description.' },
      due: {
        type: 'string',
        required: false,
        description: 'New due date in ISO 8601 or YYYY-MM-DD format.',
      },
    },
  },
  {
    name: 'tasks_complete_task',
    description: 'Mark a task as completed.',
    category: 'tasks',
    parameters: {
      task_list_id: { type: 'string', required: true, description: 'Task list ID.' },
      task_id: { type: 'string', required: true, description: 'Task ID to complete.' },
    },
  },
  {
    name: 'tasks_reopen_task',
    description: 'Reopen a completed task (mark as needs action).',
    category: 'tasks',
    parameters: {
      task_list_id: { type: 'string', required: true, description: 'Task list ID.' },
      task_id: { type: 'string', required: true, description: 'Task ID to reopen.' },
    },
  },
  {
    name: 'tasks_delete_task',
    description: 'Permanently delete a task.',
    category: 'tasks',
    parameters: {
      task_list_id: { type: 'string', required: true, description: 'Task list ID.' },
      task_id: { type: 'string', required: true, description: 'Task ID to delete.' },
    },
  },
  {
    name: 'tasks_clear_completed',
    description: 'Delete all completed tasks from a task list.',
    category: 'tasks',
    parameters: {
      task_list_id: {
        type: 'string',
        required: false,
        description: 'Task list ID to clear (default: primary list).',
      },
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

  // ─── NEW TOOL 1 ──────────────────────────────────────────────────────────
  {
    name: 'tasks_get_task',
    description: 'Fetch full details of a single task by its ID.',
    category: 'tasks',
    parameters: {
      task_list_id: {
        type: 'string',
        required: true,
        description: 'Task list ID that contains the task.',
      },
      task_id: { type: 'string', required: true, description: 'Task ID to retrieve.' },
    },
  },

  // ─── NEW TOOL 2 ──────────────────────────────────────────────────────────
  {
    name: 'tasks_get_task_list',
    description: 'Fetch details (title, ID, updated timestamp) of a specific task list.',
    category: 'tasks',
    parameters: {
      task_list_id: { type: 'string', required: true, description: 'Task list ID to retrieve.' },
    },
  },

  // ─── NEW TOOL 3 ──────────────────────────────────────────────────────────
  {
    name: 'tasks_search_tasks',
    description: 'Search tasks by keyword within a task list (matches title and notes).',
    category: 'tasks',
    parameters: {
      query: { type: 'string', required: true, description: 'Keyword or phrase to search for.' },
      task_list_id: {
        type: 'string',
        required: false,
        description: 'Task list ID to search (default: primary list).',
      },
      show_completed: {
        type: 'boolean',
        required: false,
        description: 'Also search completed tasks (default: false).',
      },
    },
  },

  // ─── NEW TOOL 4 ──────────────────────────────────────────────────────────
  {
    name: 'tasks_list_all_tasks',
    description: 'List tasks from every task list in one consolidated view.',
    category: 'tasks',
    parameters: {
      show_completed: {
        type: 'boolean',
        required: false,
        description: 'Include completed tasks (default: false).',
      },
    },
  },

  // ─── NEW TOOL 5 ──────────────────────────────────────────────────────────
  {
    name: 'tasks_list_overdue_tasks',
    description: 'List all pending tasks whose due date is in the past.',
    category: 'tasks',
    parameters: {
      task_list_id: {
        type: 'string',
        required: false,
        description: 'Task list ID to check (default: all lists).',
      },
    },
  },

  // ─── NEW TOOL 6 ──────────────────────────────────────────────────────────
  {
    name: 'tasks_list_due_today',
    description: 'List all pending tasks due today.',
    category: 'tasks',
    parameters: {
      task_list_id: {
        type: 'string',
        required: false,
        description: 'Task list ID to check (default: all lists).',
      },
    },
  },

  // ─── NEW TOOL 7 ──────────────────────────────────────────────────────────
  {
    name: 'tasks_list_due_this_week',
    description: 'List all pending tasks due within the next 7 days.',
    category: 'tasks',
    parameters: {
      task_list_id: {
        type: 'string',
        required: false,
        description: 'Task list ID to check (default: all lists).',
      },
    },
  },

  // ─── NEW TOOL 8 ──────────────────────────────────────────────────────────
  {
    name: 'tasks_bulk_complete_tasks',
    description: 'Mark multiple tasks as completed in a single call.',
    category: 'tasks',
    parameters: {
      task_list_id: {
        type: 'string',
        required: true,
        description: 'Task list ID containing all the tasks.',
      },
      task_ids: {
        type: 'array',
        required: true,
        description: 'Array of task ID strings to complete.',
      },
    },
  },

  // ─── NEW TOOL 9 ──────────────────────────────────────────────────────────
  {
    name: 'tasks_bulk_delete_tasks',
    description: 'Permanently delete multiple tasks in a single call.',
    category: 'tasks',
    parameters: {
      task_list_id: {
        type: 'string',
        required: true,
        description: 'Task list ID containing all the tasks.',
      },
      task_ids: {
        type: 'array',
        required: true,
        description: 'Array of task ID strings to delete.',
      },
    },
  },

  // ─── NEW TOOL 10 ─────────────────────────────────────────────────────────
  {
    name: 'tasks_bulk_create_tasks',
    description: 'Create multiple tasks at once in a single call.',
    category: 'tasks',
    parameters: {
      task_list_id: {
        type: 'string',
        required: false,
        description: 'Task list ID to add tasks to (default: primary list).',
      },
      tasks: {
        type: 'array',
        required: true,
        description:
          'Array of task objects. Each object must have `title` and may include `notes` and `due` (ISO date).',
      },
    },
  },

  // ─── NEW TOOL 11 ─────────────────────────────────────────────────────────
  {
    name: 'tasks_move_task',
    description:
      'Move a task from one task list to another. A copy is created in the destination and the original is deleted.',
    category: 'tasks',
    parameters: {
      source_task_list_id: {
        type: 'string',
        required: true,
        description: 'Task list ID the task currently belongs to.',
      },
      task_id: { type: 'string', required: true, description: 'Task ID to move.' },
      dest_task_list_id: {
        type: 'string',
        required: true,
        description: 'Destination task list ID.',
      },
    },
  },

  // ─── NEW TOOL 12 ─────────────────────────────────────────────────────────
  {
    name: 'tasks_add_subtask',
    description: 'Create a subtask (child task) nested under an existing parent task.',
    category: 'tasks',
    parameters: {
      task_list_id: {
        type: 'string',
        required: true,
        description: 'Task list ID containing the parent task.',
      },
      parent_task_id: {
        type: 'string',
        required: true,
        description: 'Task ID of the parent task.',
      },
      title: { type: 'string', required: true, description: 'Subtask title.' },
      notes: { type: 'string', required: false, description: 'Optional subtask notes.' },
      due: {
        type: 'string',
        required: false,
        description: 'Optional due date (ISO 8601 or YYYY-MM-DD).',
      },
    },
  },

  // ─── NEW TOOL 13 ─────────────────────────────────────────────────────────
  {
    name: 'tasks_list_subtasks',
    description: 'List all subtasks (child tasks) of a given parent task.',
    category: 'tasks',
    parameters: {
      task_list_id: {
        type: 'string',
        required: true,
        description: 'Task list ID containing the parent task.',
      },
      parent_task_id: {
        type: 'string',
        required: true,
        description: 'Task ID whose children to list.',
      },
    },
  },

  // ─── NEW TOOL 14 ─────────────────────────────────────────────────────────
  {
    name: 'tasks_rename_task_list',
    description: 'Rename an existing task list.',
    category: 'tasks',
    parameters: {
      task_list_id: { type: 'string', required: true, description: 'Task list ID to rename.' },
      new_title: { type: 'string', required: true, description: 'New name for the task list.' },
    },
  },

  // ─── NEW TOOL 15 ─────────────────────────────────────────────────────────
  {
    name: 'tasks_duplicate_task',
    description: 'Duplicate an existing task. Optionally copy it into a different task list.',
    category: 'tasks',
    parameters: {
      task_list_id: {
        type: 'string',
        required: true,
        description: 'Task list ID containing the task to duplicate.',
      },
      task_id: { type: 'string', required: true, description: 'Task ID to duplicate.' },
      dest_task_list_id: {
        type: 'string',
        required: false,
        description: 'Destination task list ID (defaults to the same list).',
      },
    },
  },

  // ─── NEW TOOL 16 ─────────────────────────────────────────────────────────
  {
    name: 'tasks_set_due_today',
    description: "Quickly set a task's due date to today.",
    category: 'tasks',
    parameters: {
      task_list_id: { type: 'string', required: true, description: 'Task list ID.' },
      task_id: { type: 'string', required: true, description: 'Task ID to update.' },
    },
  },

  // ─── NEW TOOL 17 ─────────────────────────────────────────────────────────
  {
    name: 'tasks_set_due_tomorrow',
    description: "Quickly set a task's due date to tomorrow.",
    category: 'tasks',
    parameters: {
      task_list_id: { type: 'string', required: true, description: 'Task list ID.' },
      task_id: { type: 'string', required: true, description: 'Task ID to update.' },
    },
  },

  // ─── NEW TOOL 18 ─────────────────────────────────────────────────────────
  {
    name: 'tasks_count_tasks',
    description:
      'Return a summary count of pending, completed, and overdue tasks in a list (or all lists).',
    category: 'tasks',
    parameters: {
      task_list_id: {
        type: 'string',
        required: false,
        description: 'Task list ID to count (default: all lists).',
      },
    },
  },

  // ─── NEW TOOL 19 ─────────────────────────────────────────────────────────
  {
    name: 'tasks_reorder_task',
    description:
      'Reorder a task within its list by placing it after a sibling task. Pass null for previous_task_id to move it to the top.',
    category: 'tasks',
    parameters: {
      task_list_id: { type: 'string', required: true, description: 'Task list ID.' },
      task_id: { type: 'string', required: true, description: 'Task ID to reorder.' },
      previous_task_id: {
        type: 'string',
        required: false,
        description:
          'The task ID that should immediately precede this task. Omit or pass null to move to the top.',
      },
      parent_task_id: {
        type: 'string',
        required: false,
        description: 'Optional: re-parent the task under a new parent at the same time.',
      },
    },
  },

  {
    name: 'tasks_export_tasks_markdown',
    description:
      'Export all tasks in a list as a Markdown checklist (useful for copying into docs, notes, or messages).',
    category: 'tasks',
    parameters: {
      task_list_id: {
        type: 'string',
        required: false,
        description: 'Task list ID to export (default: primary list).',
      },
      show_completed: {
        type: 'boolean',
        required: false,
        description: 'Include completed tasks (default: true).',
      },
      include_notes: {
        type: 'boolean',
        required: false,
        description: 'Append task notes as indented sub-lines (default: true).',
      },
    },
  },
];
