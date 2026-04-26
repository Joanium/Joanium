import createCapabilityFeature, {
  createConnectedServicePrompt,
} from '../../Core/CapabilityFeatureFactory.js';
import * as FigmaAPI from './API/FigmaAPI.js';
import { getFigmaCredentials, withFigma } from './Shared/Common.js';
import { FIGMA_TOOLS } from './Chat/Tools.js';
import { executeFigmaChatTool } from './Chat/ChatExecutor.js';
import { figmaDataSourceCollectors, figmaOutputHandlers } from './Automation/AutomationHandlers.js';

export default createCapabilityFeature({
  id: 'figma',
  name: 'Figma',

  connectors: {
    services: [
      {
        id: 'figma',
        name: 'Figma',
        icon: '<img src="../../../Assets/Icons/Figma.png" alt="Figma" style="width: 26px; height: 26px; object-fit: contain;" />',
        description:
          'Access your Figma files, inspect pages and components, and review design comments from chat.',
        helpUrl: 'https://www.figma.com/developers/api#access-tokens',
        helpText: 'Generate a Personal Access Token →',
        oauthType: null,
        subServices: [],
        setupSteps: [
          'Log in to figma.com in your browser',
          'Go to Settings (your avatar) → Security tab',
          'Scroll to "Personal access tokens" → Generate new token',
          'Grant "File content: Read" scope at minimum',
          'Copy and paste the token below',
        ],
        capabilities: [
          'Get pages, components, and style counts for any Figma file',
          'Review and summarize comments on design files',
          'Monitor design activity via automations',
        ],
        fields: [
          {
            key: 'token',
            label: 'Personal Access Token',
            placeholder: 'Your Figma personal access token',
            type: 'password',
            hint: 'Create at figma.com → Settings → Security → Personal access tokens.',
          },
        ],
        automations: [
          {
            name: 'Design Review',
            description: 'Daily — summarize open comments on a Figma file',
          },
        ],
        defaultState: { enabled: false, credentials: {} },
        async validate(ctx) {
          const creds = ctx.connectorEngine?.getCredentials('figma');
          if (!creds?.token) return { ok: false, error: 'No credentials stored' };
          try {
            const me = await FigmaAPI.getMe(creds);
            ctx.connectorEngine?.updateCredentials('figma', {
              handle: me.handle ?? null,
              email: me.email ?? null,
            });
            return { ok: true, handle: me.handle };
          } catch (err) {
            return { ok: false, error: err.message };
          }
        },
      },
    ],
  },

  methods: {
    getFile: async (ctx, { fileKey }) =>
      withFigma(ctx, async (creds) => ({
        ok: true,
        file: await FigmaAPI.getFile(creds, fileKey),
      })),
    getFileComments: async (ctx, { fileKey }) =>
      withFigma(ctx, async (creds) => ({
        ok: true,
        comments: await FigmaAPI.getFileComments(creds, fileKey),
      })),
  },
  chatTools: FIGMA_TOOLS,
  executeChatTool: executeFigmaChatTool,

  automation: {
    dataSources: [
      {
        value: 'figma_file_comments',
        label: 'Figma - File Comments',
        group: 'Figma',
        params: [
          {
            key: 'file_key',
            label: 'File Key',
            type: 'text',
            required: true,
            placeholder: 'From the Figma URL: figma.com/file/<KEY>/...',
          },
        ],
      },
    ],
    outputTypes: [],
    instructionTemplates: {
      figma_file_comments:
        'Review these Figma file comments. Summarize the open feedback, identify any blocking issues, and suggest next steps for the design.',
    },
    dataSourceCollectors: figmaDataSourceCollectors,
    outputHandlers: figmaOutputHandlers,
  },

  prompt: createConnectedServicePrompt({
    getCredentials: getFigmaCredentials,
    getServiceLabel: (creds) => {
      const handle = creds.handle ?? null;
      return handle ? `Figma (@${handle})` : 'Figma';
    },
    sections:
      'Figma is connected. You can get file info and comments using the figma_get_file_info tool.',
  }),
});
