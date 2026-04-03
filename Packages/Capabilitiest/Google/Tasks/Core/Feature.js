import defineFeature from '../../../Core/DefineFeature.js';
import * as TasksAPI from './API/TasksAPI.js';
import { TASKS_TOOLS } from './Chat/Tools.js';
import { executeTasksChatTool } from './Chat/ChatExecutor.js';
import { withGoogle } from '../../Common.js';

export default defineFeature({
  id: 'tasks',
  name: 'Google Tasks',
  dependsOn: ['google-workspace'],
  connectors: {
    serviceExtensions: [
      {
        target: 'google',
        subServices: [
          {
            key: 'tasks',
            icon: '✅',
            name: 'Google Tasks',
            apiUrl: 'https://console.cloud.google.com/apis/library/tasks.googleapis.com',
          },
        ],
        capabilities: [
          'Create, complete, and manage Google Tasks',
          'Manage multiple task lists',
        ],
      },
    ],
  },
  main: {
    methods: {
      async listTaskLists(ctx) {
        return withGoogle(ctx, async credentials => ({ ok: true, lists: await TasksAPI.listTaskLists(credentials) }));
      },

      async listTasks(ctx, { taskListId = '@default', showCompleted = false, maxResults = 100 } = {}) {
        return withGoogle(ctx, async credentials => ({ ok: true, tasks: await TasksAPI.listTasks(credentials, taskListId, { showCompleted, maxResults }) }));
      },

      async createTask(ctx, { taskListId = '@default', taskData = {} } = {}) {
        return withGoogle(ctx, async credentials => {
          if (!taskData.title) return { ok: false, error: 'Task title is required' };
          return { ok: true, task: await TasksAPI.createTask(credentials, taskListId, taskData) };
        });
      },

      async updateTask(ctx, { taskListId, taskId, updates = {} } = {}) {
        return withGoogle(ctx, async credentials => {
          if (!taskListId || !taskId) return { ok: false, error: 'taskListId and taskId are required' };
          return { ok: true, task: await TasksAPI.updateTask(credentials, taskListId, taskId, updates) };
        });
      },

      async completeTask(ctx, { taskListId, taskId }) {
        return withGoogle(ctx, async credentials => {
          if (!taskListId || !taskId) return { ok: false, error: 'taskListId and taskId are required' };
          return { ok: true, task: await TasksAPI.completeTask(credentials, taskListId, taskId) };
        });
      },

      async deleteTask(ctx, { taskListId, taskId }) {
        return withGoogle(ctx, async credentials => {
          if (!taskListId || !taskId) return { ok: false, error: 'taskListId and taskId are required' };
          await TasksAPI.deleteTask(credentials, taskListId, taskId);
          return { ok: true };
        });
      },

      async clearCompleted(ctx, { taskListId = '@default' } = {}) {
        return withGoogle(ctx, async credentials => {
          await TasksAPI.clearCompleted(credentials, taskListId);
          return { ok: true };
        });
      },

      async createTaskList(ctx, { title }) {
        return withGoogle(ctx, async credentials => {
          if (!title) return { ok: false, error: 'title is required' };
          return { ok: true, list: await TasksAPI.createTaskList(credentials, title) };
        });
      },

      async deleteTaskList(ctx, { taskListId }) {
        return withGoogle(ctx, async credentials => {
          if (!taskListId) return { ok: false, error: 'taskListId is required' };
          await TasksAPI.deleteTaskList(credentials, taskListId);
          return { ok: true };
        });
      },

      async executeChatTool(ctx, { toolName, params }) {
        return executeTasksChatTool(ctx, toolName, params);
      },
    },
  },
  renderer: {
    chatTools: TASKS_TOOLS,
  },
});
