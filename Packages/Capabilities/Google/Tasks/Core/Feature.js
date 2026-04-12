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
            icon: '<img src="../../../Assets/Icons/Tasks.png" alt="Google Tasks" style="width: 26px; height: 26px; object-fit: contain;" />',
            name: 'Google Tasks',
            apiUrl: 'https://console.cloud.google.com/apis/library/tasks.googleapis.com',
          },
        ],
        capabilities: ['Create, complete, and manage Google Tasks', 'Manage multiple task lists'],
      },
    ],
  },
  main: {
    methods: {
      listTaskLists: async (ctx) =>
        withGoogle(ctx, async (credentials) => ({
          ok: !0,
          lists: await TasksAPI.listTaskLists(credentials),
        })),
      listTasks: async (
        ctx,
        {
          taskListId: taskListId = '@default',
          showCompleted: showCompleted = !1,
          maxResults: maxResults = 100,
        } = {},
      ) =>
        withGoogle(ctx, async (credentials) => ({
          ok: !0,
          tasks: await TasksAPI.listTasks(credentials, taskListId, {
            showCompleted: showCompleted,
            maxResults: maxResults,
          }),
        })),
      createTask: async (
        ctx,
        { taskListId: taskListId = '@default', taskData: taskData = {} } = {},
      ) =>
        withGoogle(ctx, async (credentials) =>
          taskData.title
            ? { ok: !0, task: await TasksAPI.createTask(credentials, taskListId, taskData) }
            : { ok: !1, error: 'Task title is required' },
        ),
      updateTask: async (
        ctx,
        { taskListId: taskListId, taskId: taskId, updates: updates = {} } = {},
      ) =>
        withGoogle(ctx, async (credentials) =>
          taskListId && taskId
            ? { ok: !0, task: await TasksAPI.updateTask(credentials, taskListId, taskId, updates) }
            : { ok: !1, error: 'taskListId and taskId are required' },
        ),
      completeTask: async (ctx, { taskListId: taskListId, taskId: taskId }) =>
        withGoogle(ctx, async (credentials) =>
          taskListId && taskId
            ? { ok: !0, task: await TasksAPI.completeTask(credentials, taskListId, taskId) }
            : { ok: !1, error: 'taskListId and taskId are required' },
        ),
      deleteTask: async (ctx, { taskListId: taskListId, taskId: taskId }) =>
        withGoogle(ctx, async (credentials) =>
          taskListId && taskId
            ? (await TasksAPI.deleteTask(credentials, taskListId, taskId), { ok: !0 })
            : { ok: !1, error: 'taskListId and taskId are required' },
        ),
      clearCompleted: async (ctx, { taskListId: taskListId = '@default' } = {}) =>
        withGoogle(
          ctx,
          async (credentials) => (
            await TasksAPI.clearCompleted(credentials, taskListId),
            { ok: !0 }
          ),
        ),
      createTaskList: async (ctx, { title: title }) =>
        withGoogle(ctx, async (credentials) =>
          title
            ? { ok: !0, list: await TasksAPI.createTaskList(credentials, title) }
            : { ok: !1, error: 'title is required' },
        ),
      deleteTaskList: async (ctx, { taskListId: taskListId }) =>
        withGoogle(ctx, async (credentials) =>
          taskListId
            ? (await TasksAPI.deleteTaskList(credentials, taskListId), { ok: !0 })
            : { ok: !1, error: 'taskListId is required' },
        ),
      executeChatTool: async (ctx, { toolName: toolName, params: params }) =>
        executeTasksChatTool(ctx, toolName, params),
    },
  },
  renderer: { chatTools: TASKS_TOOLS },
});
