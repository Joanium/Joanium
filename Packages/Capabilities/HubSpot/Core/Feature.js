import defineFeature from '../../Core/DefineFeature.js';
import * as HubSpotAPI from './API/HubSpotAPI.js';
import { getHubSpotCredentials, notConnected } from './Shared/Common.js';
import { HUBSPOT_TOOLS } from './Chat/Tools.js';
import { executeHubSpotChatTool } from './Chat/ChatExecutor.js';
import {
  hubspotDataSourceCollectors,
  hubspotOutputHandlers,
} from './Automation/AutomationHandlers.js';

function withHubSpot(ctx, cb) {
  const creds = getHubSpotCredentials(ctx);
  return creds
    ? cb(creds).catch((e) => ({ ok: false, error: e.message }))
    : Promise.resolve(notConnected());
}

export default defineFeature({
  id: 'hubspot',
  name: 'HubSpot',

  connectors: {
    services: [
      {
        id: 'hubspot',
        name: 'HubSpot',
        icon: '<img src="../../../Assets/Icons/Hubspot.png" alt="HubSpot" style="width: 26px; height: 26px; object-fit: contain;" />',
        description:
          'Access your HubSpot CRM — contacts, deals, companies, and sales pipeline from chat.',
        helpUrl: 'https://app.hubspot.com/private-apps',
        helpText: 'Create a Private App →',
        oauthType: null,
        subServices: [],
        setupSteps: [
          'Go to app.hubspot.com → Settings → Integrations → Private Apps',
          'Click "Create a private app" and give it a name',
          'Under Scopes, enable: crm.objects.contacts.read, crm.objects.deals.read, crm.objects.companies.read',
          'Click "Create app" and copy the Access Token below',
        ],
        capabilities: [
          'List contacts with email, phone, and company',
          'Browse open deals with amount and stage',
          'Monitor sales pipeline via automations',
        ],
        fields: [
          {
            key: 'token',
            label: 'Private App Token',
            placeholder: 'pat-...',
            type: 'password',
            hint: 'Create at app.hubspot.com → Settings → Integrations → Private Apps.',
          },
        ],
        automations: [
          {
            name: 'Deals Digest',
            description: 'Daily — summarize open deals and pipeline activity',
          },
        ],
        defaultState: { enabled: false, credentials: {} },
        async validate(ctx) {
          const creds = ctx.connectorEngine?.getCredentials('hubspot');
          if (!creds?.token) return { ok: false, error: 'No credentials stored' };
          try {
            const user = await HubSpotAPI.getUser(creds);
            ctx.connectorEngine?.updateCredentials('hubspot', {
              hubId: user.hubId ?? null,
              hubDomain: user.hubDomain ?? null,
            });
            return { ok: true, hubDomain: user.hubDomain };
          } catch (err) {
            return { ok: false, error: err.message };
          }
        },
      },
    ],
  },

  main: {
    methods: {
      listContacts: async (ctx, { limit } = {}) =>
        withHubSpot(ctx, async (creds) => ({
          ok: true,
          contacts: await HubSpotAPI.listContacts(creds, limit ?? 20),
        })),
      listDeals: async (ctx, { limit } = {}) =>
        withHubSpot(ctx, async (creds) => ({
          ok: true,
          deals: await HubSpotAPI.listDeals(creds, limit ?? 20),
        })),
      listCompanies: async (ctx, { limit } = {}) =>
        withHubSpot(ctx, async (creds) => ({
          ok: true,
          companies: await HubSpotAPI.listCompanies(creds, limit ?? 20),
        })),
      executeChatTool: async (ctx, { toolName, params }) =>
        executeHubSpotChatTool(ctx, toolName, params),
    },
  },

  renderer: { chatTools: HUBSPOT_TOOLS },

  automation: {
    dataSources: [{ value: 'hubspot_deals', label: 'HubSpot - Deals Pipeline', group: 'HubSpot' }],
    outputTypes: [],
    instructionTemplates: {
      hubspot_deals:
        'Review these HubSpot deals. Summarize the pipeline, identify high-value or at-risk deals, and suggest any follow-up actions.',
    },
    dataSourceCollectors: hubspotDataSourceCollectors,
    outputHandlers: hubspotOutputHandlers,
  },

  prompt: {
    async getContext(ctx) {
      const creds = getHubSpotCredentials(ctx);
      if (!creds) return null;
      const hubDomain = creds.hubDomain ?? null;
      return {
        connectedServices: [hubDomain ? `HubSpot (${hubDomain})` : 'HubSpot'],
        sections: [
          'HubSpot is connected. You can list contacts with hubspot_list_contacts and deals with hubspot_list_deals.',
        ],
      };
    },
  },
});
