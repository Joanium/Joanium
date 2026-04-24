import defineFeature from '../../Core/DefineFeature.js';
import * as LinearAPI from './API/LinearAPI.js';
import { getLinearCredentials, withLinear } from './Shared/Common.js';
import { LINEAR_TOOLS } from './Chat/Tools.js';
import { executeLinearChatTool } from './Chat/ChatExecutor.js';
import {
  linearDataSourceCollectors,
  linearOutputHandlers,
} from './Automation/AutomationHandlers.js';

export default defineFeature({
  id: 'linear',
  name: 'Linear',

  connectors: {
    services: [
      {
        id: 'linear',
        name: 'Linear',
        icon: '<img src="../../../Assets/Icons/Linear.png" alt="Linear" style="width: 26px; height: 26px; object-fit: contain;" />',
        description:
          'Track your Linear issues, view team progress, and stay on top of assigned work from chat.',
        helpUrl: 'https://linear.app/settings/api',
        helpText: 'Create a Personal API Key →',
        oauthType: null,
        subServices: [],
        setupSteps: [
          'Go to linear.app → Settings → API',
          'Under "Personal API keys", click "Create key"',
          'Give it a label (e.g. "Joanium") and copy the generated key below',
        ],
        capabilities: [
          'List all issues assigned to you in chat',
          'Browse teams and their issues',
          'Monitor issue workload via automations',
        ],
        fields: [
          {
            key: 'token',
            label: 'Personal API Key',
            placeholder: 'lin_api_...',
            type: 'password',
            hint: 'Create at linear.app → Settings → API → Personal API keys.',
          },
        ],
        automations: [
          {
            name: 'Issue Digest',
            description: 'Daily — summarize your assigned Linear issues by priority and status',
          },
        ],
        defaultState: { enabled: false, credentials: {} },
        async validate(ctx) {
          const creds = ctx.connectorEngine?.getCredentials('linear');
          if (!creds?.token) return { ok: false, error: 'No credentials stored' };
          try {
            const viewer = await LinearAPI.getViewer(creds);
            ctx.connectorEngine?.updateCredentials('linear', {
              name: viewer.name ?? null,
              email: viewer.email ?? null,
              displayName: viewer.displayName ?? null,
            });
            return { ok: true, name: viewer.name, email: viewer.email };
          } catch (err) {
            return { ok: false, error: err.message };
          }
        },
      },
    ],
  },

  main: {
    methods: {
      listMyIssues: async (ctx, { limit } = {}) =>
        withLinear(ctx, async (creds) => ({
          ok: true,
          issues: await LinearAPI.listMyIssues(creds, limit ?? 25),
        })),
      listTeams: async (ctx) =>
        withLinear(ctx, async (creds) => ({ ok: true, teams: await LinearAPI.listTeams(creds) })),
      listIssues: async (ctx, { teamId, limit } = {}) =>
        withLinear(ctx, async (creds) => ({
          ok: true,
          issues: await LinearAPI.listIssues(creds, teamId, limit ?? 25),
        })),
      executeChatTool: async (ctx, { toolName, params }) =>
        executeLinearChatTool(ctx, toolName, params),
    },
  },

  renderer: { chatTools: LINEAR_TOOLS },

  automation: {
    dataSources: [{ value: 'linear_my_issues', label: 'Linear - My Issues', group: 'Linear' }],
    outputTypes: [],
    instructionTemplates: {
      linear_my_issues:
        'Review these Linear issues assigned to me. Prioritize by urgency, flag anything blocked or overdue, and suggest a focus order for today.',
    },
    dataSourceCollectors: linearDataSourceCollectors,
    outputHandlers: linearOutputHandlers,
  },

  prompt: {
    async getContext(ctx) {
      const creds = getLinearCredentials(ctx);
      if (!creds) return null;
      const name = creds.name ?? creds.displayName ?? null;
      return {
        connectedServices: [name ? `Linear (${name})` : 'Linear'],
        sections: [
          'Linear is connected. You can list assigned issues using the linear_list_my_issues tool.',
        ],
      };
    },
  },
});
