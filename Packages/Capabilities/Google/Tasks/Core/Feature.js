import createGoogleFeature from '../../Core/GoogleFeatureFactory.js';
import * as TasksAPI from './API/TasksAPI.js';
import { TASKS_TOOLS } from './Chat/Tools.js';
import { executeTasksChatTool } from './Chat/ChatExecutor.js';
import { withGoogle } from '../../Common.js';
export default createGoogleFeature({
  id: 'tasks',
  name: 'Google Tasks',
  iconFile: 'Tasks.png',
  apiUrl: 'https://console.cloud.google.com/apis/library/tasks.googleapis.com',
  capabilities: ['Create, complete, and manage Google Tasks', 'Manage multiple task lists'],
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
        async (credentials) => (await TasksAPI.clearCompleted(credentials, taskListId), { ok: !0 }),
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
  },
  chatTools: TASKS_TOOLS,
  executeChatTool: executeTasksChatTool,
});
