import defineFeature from '../../Core/DefineFeature.js';
import * as NetlifyAPI from './API/NetlifyAPI.js';
import { getNetlifyCredentials, withNetlify } from './Shared/Common.js';
import { NETLIFY_TOOLS } from './Chat/Tools.js';
import { executeNetlifyChatTool } from './Chat/ChatExecutor.js';
import {
  netlifyDataSourceCollectors,
  netlifyOutputHandlers,
} from './Automation/AutomationHandlers.js';

export default defineFeature({
  id: 'netlify',
  name: 'Netlify',

  connectors: {
    services: [
      {
        id: 'netlify',
        name: 'Netlify',
        icon: '<img src="../../../Assets/Icons/Netlify.png" alt="Netlify" style="width: 26px; height: 26px; object-fit: contain;" />',
        description:
          'Monitor your Netlify sites, track deployments, and get alerted on failures from chat.',
        helpUrl: 'https://app.netlify.com/user/applications#personal-access-tokens',
        helpText: 'Create a Personal Access Token →',
        oauthType: null,
        subServices: [],
        setupSteps: [
          'Go to app.netlify.com → User Settings → Applications',
          'Scroll to "Personal access tokens" and click "New access token"',
          'Give it a descriptive name and copy the token below',
        ],
        capabilities: [
          'List all sites with publish status and custom domain',
          'Monitor deployments and flag failures via automations',
          'AI is aware of your Netlify sites',
        ],
        fields: [
          {
            key: 'token',
            label: 'Personal Access Token',
            placeholder: 'Your Netlify access token',
            type: 'password',
            hint: 'Create at app.netlify.com → User Settings → Applications → Personal access tokens.',
          },
        ],
        automations: [
          {
            name: 'Deployment Monitor',
            description: 'Daily — report recent deployments and flag any build failures',
          },
        ],
        defaultState: { enabled: false, credentials: {} },
        async validate(ctx) {
          const creds = ctx.connectorEngine?.getCredentials('netlify');
          if (!creds?.token) return { ok: false, error: 'No credentials stored' };
          try {
            const user = await NetlifyAPI.getUser(creds);
            ctx.connectorEngine?.updateCredentials('netlify', {
              email: user.email ?? null,
              name: user.full_name ?? null,
            });
            return { ok: true, email: user.email };
          } catch (err) {
            return { ok: false, error: err.message };
          }
        },
      },
    ],
  },

  main: {
    methods: {
      listSites: async (ctx) =>
        withNetlify(ctx, async (creds) => ({ ok: true, sites: await NetlifyAPI.listSites(creds) })),
      listDeploys: async (ctx, { siteId, limit } = {}) =>
        withNetlify(ctx, async (creds) => ({
          ok: true,
          deploys: await NetlifyAPI.listDeploys(creds, siteId, limit),
        })),
      executeChatTool: async (ctx, { toolName, params }) =>
        executeNetlifyChatTool(ctx, toolName, params),
    },
  },

  renderer: { chatTools: NETLIFY_TOOLS },

  automation: {
    dataSources: [
      { value: 'netlify_deployments', label: 'Netlify - Deployments', group: 'Netlify' },
    ],
    outputTypes: [],
    instructionTemplates: {
      netlify_deployments:
        'Review these Netlify deployments. Summarize which succeeded, which failed, and highlight any recurring errors or patterns that need attention.',
    },
    dataSourceCollectors: netlifyDataSourceCollectors,
    outputHandlers: netlifyOutputHandlers,
  },

  prompt: {
    async getContext(ctx) {
      const creds = getNetlifyCredentials(ctx);
      if (!creds) return null;
      const email = creds.email ?? null;
      return {
        connectedServices: [email ? `Netlify (${email})` : 'Netlify'],
        sections: [
          'Netlify is connected. You can list sites and deployments using the netlify_list_sites tool.',
        ],
      };
    },
  },
});
