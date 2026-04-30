import createCapabilityFeature, {
  createConnectedServicePrompt,
  createConnectorService,
  createConnectorValidator,
} from '../../Core/CapabilityFeatureFactory.js';
import * as CloudflareAPI from './API/CloudflareAPI.js';
import { getCloudflareCredentials, withCloudflare } from './Shared/Common.js';
import { CLOUDFLARE_TOOLS } from './Chat/Tools.js';
import { executeCloudflareChatTool } from './Chat/ChatExecutor.js';

const validateCloudflareConnection = createConnectorValidator({
  connectorId: 'cloudflare',
  validate: async (creds) => ({
    response: {
      status: (await CloudflareAPI.verifyToken(creds))?.status ?? 'active',
    },
  }),
});

export default createCapabilityFeature({
  id: 'cloudflare',
  name: 'Cloudflare',

  connectors: {
    services: [
      createConnectorService({
        id: 'cloudflare',
        name: 'Cloudflare',
        iconFile: 'Cloudflare.png',
        description:
          'Manage your domains, DNS records, and zone health across all Cloudflare properties.',
        helpUrl: 'https://dash.cloudflare.com/profile/api-tokens',
        helpText: 'Create an API Token ->',
        setupSteps: [
          'Go to dash.cloudflare.com -> My Profile -> API Tokens',
          'Click "Create Token" and choose "Read all resources" or a custom scope',
          'Ensure Zone:Read permission is included at minimum',
          'Copy the generated token below',
        ],
        capabilities: [
          'List all domains and zone status in chat',
          'Check DNS records for any zone',
        ],
        fields: [
          {
            key: 'token',
            label: 'API Token',
            placeholder: 'Your Cloudflare API token',
            type: 'password',
            hint: 'Create at dash.cloudflare.com/profile/api-tokens. Scoped tokens are recommended.',
          },
        ],
        validate: validateCloudflareConnection,
      }),
    ],
  },

  methods: {
    listZones: async (ctx) =>
      withCloudflare(ctx, async (creds) => ({
        ok: true,
        zones: await CloudflareAPI.listZones(creds),
      })),
    listDnsRecords: async (ctx, { zoneId }) =>
      withCloudflare(ctx, async (creds) => ({
        ok: true,
        records: await CloudflareAPI.listDnsRecords(creds, zoneId),
      })),
  },
  chatTools: CLOUDFLARE_TOOLS,
  executeChatTool: executeCloudflareChatTool,

  prompt: createConnectedServicePrompt({
    getCredentials: getCloudflareCredentials,
    getServiceLabel: 'Cloudflare',
    sections:
      'Cloudflare is connected. You can list zones and DNS records using the cloudflare_list_zones tool.',
  }),
});
