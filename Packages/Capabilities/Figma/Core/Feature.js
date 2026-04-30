import createCapabilityFeature, {
  createConnectedServicePrompt,
  createConnectorService,
  createConnectorValidator,
} from '../../Core/CapabilityFeatureFactory.js';
import * as FigmaAPI from './API/FigmaAPI.js';
import { getFigmaCredentials, withFigma } from './Shared/Common.js';
import { FIGMA_TOOLS } from './Chat/Tools.js';
import { executeFigmaChatTool } from './Chat/ChatExecutor.js';

const validateFigmaConnection = createConnectorValidator({
  connectorId: 'figma',
  validate: async (creds) => {
    const me = await FigmaAPI.getMe(creds);
    return {
      updatedCredentials: {
        handle: me.handle ?? null,
        email: me.email ?? null,
      },
      response: {
        handle: me.handle,
      },
    };
  },
});

export default createCapabilityFeature({
  id: 'figma',
  name: 'Figma',

  connectors: {
    services: [
      createConnectorService({
        id: 'figma',
        name: 'Figma',
        iconFile: 'Figma.png',
        description:
          'Access your Figma files, inspect pages and components, and review design comments from chat.',
        helpUrl: 'https://www.figma.com/developers/api#access-tokens',
        helpText: 'Generate a Personal Access Token ->',
        setupSteps: [
          'Log in to figma.com in your browser',
          'Go to Settings (your avatar) -> Security tab',
          'Scroll to "Personal access tokens" -> Generate new token',
          'Grant "File content: Read" scope at minimum',
          'Copy and paste the token below',
        ],
        capabilities: [
          'Get pages, components, and style counts for any Figma file',
          'Review and summarize comments on design files',
        ],
        fields: [
          {
            key: 'token',
            label: 'Personal Access Token',
            placeholder: 'Your Figma personal access token',
            type: 'password',
            hint: 'Create at figma.com -> Settings -> Security -> Personal access tokens.',
          },
        ],
        validate: validateFigmaConnection,
      }),
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
