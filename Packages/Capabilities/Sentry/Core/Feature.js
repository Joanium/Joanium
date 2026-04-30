import createCapabilityFeature, {
  createConnectedServicePrompt,
  createConnectorService,
  createConnectorValidator,
} from '../../Core/CapabilityFeatureFactory.js';
import * as SentryAPI from './API/SentryAPI.js';
import { getSentryCredentials, withSentry } from './Shared/Common.js';
import { SENTRY_TOOLS } from './Chat/Tools.js';
import { executeSentryChatTool } from './Chat/ChatExecutor.js';
import {
  sentryDataSourceCollectors,
  sentryOutputHandlers,
} from './Automation/AutomationHandlers.js';

const validateSentryConnection = createConnectorValidator({
  connectorId: 'sentry',
  validate: async (creds) => {
    const orgs = await SentryAPI.listOrganizations(creds);
    if (!orgs.length) throw new Error('No organizations found on this token');
    const [org] = orgs;
    return {
      updatedCredentials: {
        orgSlug: org.slug,
        orgName: org.name,
      },
      response: {
        orgName: org.name,
      },
    };
  },
});

export default createCapabilityFeature({
  id: 'sentry',
  name: 'Sentry',

  connectors: {
    services: [
      createConnectorService({
        id: 'sentry',
        name: 'Sentry',
        iconFile: 'Sentry.png',
        description:
          'Monitor errors, track issues, and get alerted on crashes across your Sentry projects.',
        helpUrl: 'https://sentry.io/settings/account/api/auth-tokens/',
        helpText: 'Create an Auth Token ->',
        setupSteps: [
          'Go to sentry.io -> Settings -> Account -> API -> Auth Tokens',
          'Click "Create New Token" and name it (e.g. "Joanium")',
          'Grant scopes: org:read, project:read, event:read, issue:read',
          'Copy the generated token below',
        ],
        capabilities: [
          'List unresolved errors and issues across projects',
          'Monitor crash rates and error levels via agents',
          'AI is aware of your Sentry error environment',
        ],
        fields: [
          {
            key: 'token',
            label: 'Auth Token',
            placeholder: 'sntrys_...',
            type: 'password',
            hint: 'Create at sentry.io -> Settings -> Account -> API -> Auth Tokens.',
          },
        ],
        validate: validateSentryConnection,
      }),
    ],
  },

  methods: {
    listIssues: async (ctx) =>
      withSentry(ctx, async (creds) => ({
        ok: true,
        issues: await SentryAPI.listIssues(creds, creds.orgSlug, 25),
      })),
  },
  chatTools: SENTRY_TOOLS,
  executeChatTool: executeSentryChatTool,

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

  prompt: createConnectedServicePrompt({
    getCredentials: getSentryCredentials,
    getServiceLabel: (creds) => `Sentry (${creds.orgName ?? 'Sentry'})`,
    sections:
      'Sentry is connected. You can list unresolved issues using the sentry_list_issues tool.',
  }),
});
