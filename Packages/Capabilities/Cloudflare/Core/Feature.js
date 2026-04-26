import createCapabilityFeature, {
  createConnectedServicePrompt,
} from '../../Core/CapabilityFeatureFactory.js';
import * as CloudflareAPI from './API/CloudflareAPI.js';
import { getCloudflareCredentials, withCloudflare } from './Shared/Common.js';
import { CLOUDFLARE_TOOLS } from './Chat/Tools.js';
import { executeCloudflareChatTool } from './Chat/ChatExecutor.js';
import {
  cloudflareDataSourceCollectors,
  cloudflareOutputHandlers,
} from './Automation/AutomationHandlers.js';

export default createCapabilityFeature({
  id: 'cloudflare',
  name: 'Cloudflare',

  connectors: {
    services: [
      {
        id: 'cloudflare',
        name: 'Cloudflare',
        icon: '<img src="../../../Assets/Icons/Cloudflare.png" alt="Cloudflare" style="width: 26px; height: 26px; object-fit: contain;" />',
        description:
          'Manage your domains, DNS records, and zone health across all Cloudflare properties.',
        helpUrl: 'https://dash.cloudflare.com/profile/api-tokens',
        helpText: 'Create an API Token →',
        oauthType: null,
        subServices: [],
        setupSteps: [
          'Go to dash.cloudflare.com → My Profile → API Tokens',
          'Click "Create Token" and choose "Read all resources" or a custom scope',
          'Ensure Zone:Read permission is included at minimum',
          'Copy the generated token below',
        ],
        capabilities: [
          'List all domains and zone status in chat',
          'Check DNS records for any zone',
          'Monitor zone health via automations',
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
        automations: [
          {
            name: 'Zone Health Check',
            description: 'Daily — report zone statuses and flag any inactive domains',
          },
        ],
        defaultState: { enabled: false, credentials: {} },
        async validate(ctx) {
          const creds = ctx.connectorEngine?.getCredentials('cloudflare');
          if (!creds?.token) return { ok: false, error: 'No credentials stored' };
          try {
            const result = await CloudflareAPI.verifyToken(creds);
            return { ok: true, status: result?.status ?? 'active' };
          } catch (err) {
            return { ok: false, error: err.message };
          }
        },
      },
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

  automation: {
    dataSources: [{ value: 'cloudflare_zones', label: 'Cloudflare - Zones', group: 'Cloudflare' }],
    outputTypes: [],
    instructionTemplates: {
      cloudflare_zones:
        'Review these Cloudflare zones. Summarize their status and flag any that are inactive, have issues, or need attention.',
    },
    dataSourceCollectors: cloudflareDataSourceCollectors,
    outputHandlers: cloudflareOutputHandlers,
  },

  prompt: createConnectedServicePrompt({
    getCredentials: getCloudflareCredentials,
    getServiceLabel: 'Cloudflare',
    sections:
      'Cloudflare is connected. You can list zones and DNS records using the cloudflare_list_zones tool.',
  }),
});
