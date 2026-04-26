import createCapabilityFeature, {
  createConnectedServicePrompt,
  createConnectorService,
  createConnectorValidator,
} from '../../Core/CapabilityFeatureFactory.js';
import * as LinearAPI from './API/LinearAPI.js';
import { getLinearCredentials, withLinear } from './Shared/Common.js';
import { LINEAR_TOOLS } from './Chat/Tools.js';
import { executeLinearChatTool } from './Chat/ChatExecutor.js';
import {
  linearDataSourceCollectors,
  linearOutputHandlers,
} from './Automation/AutomationHandlers.js';

const validateLinearConnection = createConnectorValidator({
  connectorId: 'linear',
  validate: async (creds) => {
    const viewer = await LinearAPI.getViewer(creds);
    return {
      updatedCredentials: {
        name: viewer.name ?? null,
        email: viewer.email ?? null,
        displayName: viewer.displayName ?? null,
      },
      response: {
        name: viewer.name,
        email: viewer.email,
      },
    };
  },
});

export default createCapabilityFeature({
  id: 'linear',
  name: 'Linear',

  connectors: {
    services: [
      createConnectorService({
        id: 'linear',
        name: 'Linear',
        iconFile: 'Linear.png',
        description:
          'Track your Linear issues, view team progress, and stay on top of assigned work from chat.',
        helpUrl: 'https://linear.app/settings/api',
        helpText: 'Create a Personal API Key ->',
        setupSteps: [
          'Go to linear.app -> Settings -> API',
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
            hint: 'Create at linear.app -> Settings -> API -> Personal API keys.',
          },
        ],
        automations: [
          {
            name: 'Issue Digest',
            description: 'Daily - summarize your assigned Linear issues by priority and status',
          },
        ],
        validate: validateLinearConnection,
      }),
    ],
  },

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
  },
  chatTools: LINEAR_TOOLS,
  executeChatTool: executeLinearChatTool,

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

  prompt: createConnectedServicePrompt({
    getCredentials: getLinearCredentials,
    getServiceLabel: (creds) => {
      const name = creds.name ?? creds.displayName ?? null;
      return name ? `Linear (${name})` : 'Linear';
    },
    sections:
      'Linear is connected. You can list assigned issues using the linear_list_my_issues tool.',
  }),
});
