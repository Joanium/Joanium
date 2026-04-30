import createCapabilityFeature, {
  createConnectedServicePrompt,
  createConnectorService,
  createConnectorValidator,
} from '../../Core/CapabilityFeatureFactory.js';
import * as NetlifyAPI from './API/NetlifyAPI.js';
import { getNetlifyCredentials, withNetlify } from './Shared/Common.js';
import { NETLIFY_TOOLS } from './Chat/Tools.js';
import { executeNetlifyChatTool } from './Chat/ChatExecutor.js';

const validateNetlifyConnection = createConnectorValidator({
  connectorId: 'netlify',
  validate: async (creds) => {
    const user = await NetlifyAPI.getUser(creds);
    return {
      updatedCredentials: {
        email: user.email ?? null,
        name: user.full_name ?? null,
      },
      response: {
        email: user.email,
      },
    };
  },
});

export default createCapabilityFeature({
  id: 'netlify',
  name: 'Netlify',

  connectors: {
    services: [
      createConnectorService({
        id: 'netlify',
        name: 'Netlify',
        iconFile: 'Netlify.png',
        description:
          'Monitor your Netlify sites, track deployments, and get alerted on failures from chat.',
        helpUrl: 'https://app.netlify.com/user/applications#personal-access-tokens',
        helpText: 'Create a Personal Access Token ->',
        setupSteps: [
          'Go to app.netlify.com -> User Settings -> Applications',
          'Scroll to "Personal access tokens" and click "New access token"',
          'Give it a descriptive name and copy the token below',
        ],
        capabilities: [
          'List all sites with publish status and custom domain',
          'Monitor deployments and flag failures via agents',
          'AI is aware of your Netlify sites',
        ],
        fields: [
          {
            key: 'token',
            label: 'Personal Access Token',
            placeholder: 'Your Netlify access token',
            type: 'password',
            hint: 'Create at app.netlify.com -> User Settings -> Applications -> Personal access tokens.',
          },
        ],
        validate: validateNetlifyConnection,
      }),
    ],
  },

  methods: {
    listSites: async (ctx) =>
      withNetlify(ctx, async (creds) => ({ ok: true, sites: await NetlifyAPI.listSites(creds) })),
    listDeploys: async (ctx, { siteId, limit } = {}) =>
      withNetlify(ctx, async (creds) => ({
        ok: true,
        deploys: await NetlifyAPI.listDeploys(creds, siteId, limit),
      })),
  },
  chatTools: NETLIFY_TOOLS,
  executeChatTool: executeNetlifyChatTool,

  prompt: createConnectedServicePrompt({
    getCredentials: getNetlifyCredentials,
    getServiceLabel: (creds) => {
      const email = creds.email ?? null;
      return email ? `Netlify (${email})` : 'Netlify';
    },
    sections:
      'Netlify is connected. You can list sites and deployments using the netlify_list_sites tool.',
  }),
});
