import defineFeature from '../../Core/DefineFeature.js';
import * as SentryAPI from './API/SentryAPI.js';
import { getSentryCredentials, withSentry } from './Shared/Common.js';
import { SENTRY_TOOLS } from './Chat/Tools.js';
import { executeSentryChatTool } from './Chat/ChatExecutor.js';
import {
  sentryDataSourceCollectors,
  sentryOutputHandlers,
} from './Automation/AutomationHandlers.js';

export default defineFeature({
  id: 'sentry',
  name: 'Sentry',

  connectors: {
    services: [
      {
        id: 'sentry',
        name: 'Sentry',
        icon: '<img src="../../../Assets/Icons/Sentry.png" alt="Sentry" style="width: 26px; height: 26px; object-fit: contain;" />',
        description:
          'Monitor errors, track issues, and get alerted on crashes across your Sentry projects.',
        helpUrl: 'https://sentry.io/settings/account/api/auth-tokens/',
        helpText: 'Create an Auth Token →',
        oauthType: null,
        subServices: [],
        setupSteps: [
          'Go to sentry.io → Settings → Account → API → Auth Tokens',
          'Click "Create New Token" and name it (e.g. "Joanium")',
          'Grant scopes: org:read, project:read, event:read, issue:read',
          'Copy the generated token below',
        ],
        capabilities: [
          'List unresolved errors and issues across projects',
          'Monitor crash rates and error levels via automations',
          'AI is aware of your Sentry error environment',
        ],
        fields: [
          {
            key: 'token',
            label: 'Auth Token',
            placeholder: 'sntrys_...',
            type: 'password',
            hint: 'Create at sentry.io → Settings → Account → API → Auth Tokens.',
          },
        ],
        automations: [
          {
            name: 'Error Digest',
            description: 'Daily — summarize unresolved errors and flag critical/fatal issues',
          },
        ],
        defaultState: { enabled: false, credentials: {} },
        async validate(ctx) {
          const creds = ctx.connectorEngine?.getCredentials('sentry');
          if (!creds?.token) return { ok: false, error: 'No credentials stored' };
          try {
            const orgs = await SentryAPI.listOrganizations(creds);
            if (!orgs.length) return { ok: false, error: 'No organizations found on this token' };
            const orgSlug = orgs[0].slug;
            ctx.connectorEngine?.updateCredentials('sentry', { orgSlug, orgName: orgs[0].name });
            return { ok: true, orgName: orgs[0].name };
          } catch (err) {
            return { ok: false, error: err.message };
          }
        },
      },
    ],
  },

  main: {
    methods: {
      listIssues: async (ctx) =>
        withSentry(ctx, async (creds) => ({
          ok: true,
          issues: await SentryAPI.listIssues(creds, creds.orgSlug, 25),
        })),
      executeChatTool: async (ctx, { toolName, params }) =>
        executeSentryChatTool(ctx, toolName, params),
    },
  },

  renderer: { chatTools: SENTRY_TOOLS },

  automation: {
    dataSources: [
      { value: 'sentry_unresolved_issues', label: 'Sentry - Unresolved Issues', group: 'Sentry' },
    ],
    outputTypes: [],
    instructionTemplates: {
      sentry_unresolved_issues:
        'Review these Sentry issues. Prioritize fatal and error-level items, identify any patterns or regressions, and recommend which to fix first.',
    },
    dataSourceCollectors: sentryDataSourceCollectors,
    outputHandlers: sentryOutputHandlers,
  },

  prompt: {
    async getContext(ctx) {
      const creds = getSentryCredentials(ctx);
      if (!creds) return null;
      const orgName = creds.orgName ?? 'Sentry';
      return {
        connectedServices: [`Sentry (${orgName})`],
        sections: [
          'Sentry is connected. You can list unresolved issues using the sentry_list_issues tool.',
        ],
      };
    },
  },
});
