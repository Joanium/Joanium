import createCapabilityFeature, {
  createConnectedServicePrompt,
} from '../../Core/CapabilityFeatureFactory.js';
import * as NotionAPI from './API/NotionAPI.js';
import { getNotionCredentials, withNotion } from './Shared/Common.js';
import { NOTION_TOOLS } from './Chat/Tools.js';
import { executeNotionChatTool } from './Chat/ChatExecutor.js';
import {
  notionDataSourceCollectors,
  notionOutputHandlers,
} from './Automation/AutomationHandlers.js';

export default createCapabilityFeature({
  id: 'notion',
  name: 'Notion',

  connectors: {
    services: [
      {
        id: 'notion',
        name: 'Notion',
        icon: '<img src="../../../Assets/Icons/Notion.png" alt="Notion" style="width: 26px; height: 26px; object-fit: contain;" />',
        description:
          'Search pages, browse databases, and query content across your Notion workspace.',
        helpUrl: 'https://www.notion.so/my-integrations',
        helpText: 'Create an Internal Integration →',
        oauthType: null,
        subServices: [],
        setupSteps: [
          'Go to notion.so/my-integrations and click "New integration"',
          'Give it a name (e.g. "Joanium") and select your workspace',
          'Under Capabilities, enable "Read content"',
          'Copy the "Internal Integration Token" below',
          'In each Notion page/database you want to access, click ••• → Connections → add your integration',
        ],
        capabilities: [
          'Search any Notion page by name or content',
          'Browse recently edited pages and databases',
          'Monitor workspace activity via automations',
        ],
        fields: [
          {
            key: 'token',
            label: 'Internal Integration Token',
            placeholder: 'secret_...',
            type: 'password',
            hint: 'Create at notion.so/my-integrations. Remember to share pages with the integration.',
          },
        ],
        automations: [
          {
            name: 'Workspace Digest',
            description: 'Daily — summarize recently edited Notion pages',
          },
        ],
        defaultState: { enabled: false, credentials: {} },
        async validate(ctx) {
          const creds = ctx.connectorEngine?.getCredentials('notion');
          if (!creds?.token) return { ok: false, error: 'No credentials stored' };
          try {
            const bot = await NotionAPI.getBot(creds);
            const name = bot.name ?? bot.bot?.owner?.user?.name ?? 'Notion bot';
            ctx.connectorEngine?.updateCredentials('notion', { botName: name });
            return { ok: true, name };
          } catch (err) {
            return { ok: false, error: err.message };
          }
        },
      },
    ],
  },

  methods: {
    searchPages: async (ctx, { query, limit } = {}) =>
      withNotion(ctx, async (creds) => ({
        ok: true,
        pages: await NotionAPI.searchPages(creds, query ?? '', limit ?? 20),
      })),
    searchDatabases: async (ctx, { limit } = {}) =>
      withNotion(ctx, async (creds) => ({
        ok: true,
        databases: await NotionAPI.searchDatabases(creds, limit ?? 20),
      })),
  },
  chatTools: NOTION_TOOLS,
  executeChatTool: executeNotionChatTool,

  automation: {
    dataSources: [
      { value: 'notion_recent_pages', label: 'Notion - Recent Pages', group: 'Notion' },
    ],
    outputTypes: [],
    instructionTemplates: {
      notion_recent_pages:
        'Review these recently edited Notion pages. Summarize what was changed, flag anything that looks incomplete or needs follow-up.',
    },
    dataSourceCollectors: notionDataSourceCollectors,
    outputHandlers: notionOutputHandlers,
  },

  prompt: createConnectedServicePrompt({
    getCredentials: getNotionCredentials,
    getServiceLabel: 'Notion',
    sections: 'Notion is connected. You can search pages using the notion_search_pages tool.',
  }),
});
