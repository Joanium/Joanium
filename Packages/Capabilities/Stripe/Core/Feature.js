import defineFeature from '../../Core/DefineFeature.js';
import * as StripeAPI from './API/StripeAPI.js';
import { getStripeCredentials, withStripe } from './Shared/Common.js';
import { STRIPE_TOOLS } from './Chat/Tools.js';
import { executeStripeChatTool } from './Chat/ChatExecutor.js';
import {
  stripeDataSourceCollectors,
  stripeOutputHandlers,
} from './Automation/AutomationHandlers.js';

export default defineFeature({
  id: 'stripe',
  name: 'Stripe',

  connectors: {
    services: [
      {
        id: 'stripe',
        name: 'Stripe',
        icon: '<img src="../../../Assets/Icons/Stripe.png" alt="Stripe" style="width: 26px; height: 26px; object-fit: contain;" />',
        description:
          'Monitor your Stripe balance, charges, customers, and subscriptions from chat.',
        helpUrl: 'https://dashboard.stripe.com/apikeys',
        helpText: 'View API Keys →',
        oauthType: null,
        subServices: [],
        setupSteps: [
          'Go to dashboard.stripe.com → Developers → API Keys',
          'Use the "Secret key" (starts with sk_live_ or sk_test_)',
          'For testing, use the test mode secret key (sk_test_...)',
          'Copy the key below — keep it private',
        ],
        capabilities: [
          'Check account balance (available and pending)',
          'List recent charges and customer transactions',
          'Monitor revenue and subscriptions via automations',
        ],
        fields: [
          {
            key: 'token',
            label: 'Secret Key',
            placeholder: 'sk_live_... or sk_test_...',
            type: 'password',
            hint: 'Found at dashboard.stripe.com → Developers → API Keys. Never share this key.',
          },
        ],
        automations: [
          {
            name: 'Revenue Digest',
            description: 'Daily — summarize recent charges, balance, and flag anomalies',
          },
        ],
        defaultState: { enabled: false, credentials: {} },
        async validate(ctx) {
          const creds = ctx.connectorEngine?.getCredentials('stripe');
          if (!creds?.token) return { ok: false, error: 'No credentials stored' };
          try {
            const balance = await StripeAPI.getBalance(creds);
            const isTestMode = creds.token.startsWith('sk_test_');
            return {
              ok: true,
              mode: isTestMode ? 'test' : 'live',
              currencies: balance.available.map((a) => a.currency),
            };
          } catch (err) {
            return { ok: false, error: err.message };
          }
        },
      },
    ],
  },

  main: {
    methods: {
      getBalance: async (ctx) =>
        withStripe(ctx, async (creds) => ({
          ok: true,
          balance: await StripeAPI.getBalance(creds),
        })),
      listCharges: async (ctx, { limit } = {}) =>
        withStripe(ctx, async (creds) => ({
          ok: true,
          charges: await StripeAPI.listCharges(creds, limit ?? 10),
        })),
      listSubscriptions: async (ctx, { limit } = {}) =>
        withStripe(ctx, async (creds) => ({
          ok: true,
          subscriptions: await StripeAPI.listSubscriptions(creds, limit ?? 10),
        })),
      executeChatTool: async (ctx, { toolName, params }) =>
        executeStripeChatTool(ctx, toolName, params),
    },
  },

  renderer: { chatTools: STRIPE_TOOLS },

  automation: {
    dataSources: [
      { value: 'stripe_balance_and_charges', label: 'Stripe - Balance & Charges', group: 'Stripe' },
    ],
    outputTypes: [],
    instructionTemplates: {
      stripe_balance_and_charges:
        'Review this Stripe financial summary. Analyze the balance, highlight any unusual charges, and provide a brief revenue health summary.',
    },
    dataSourceCollectors: stripeDataSourceCollectors,
    outputHandlers: stripeOutputHandlers,
  },

  prompt: {
    async getContext(ctx) {
      const creds = getStripeCredentials(ctx);
      if (!creds) return null;
      const mode = creds.token?.startsWith('sk_test_') ? 'test mode' : 'live mode';
      return {
        connectedServices: [`Stripe (${mode})`],
        sections: [
          `Stripe is connected in ${mode}. You can check balance with stripe_get_balance and list charges with stripe_list_charges.`,
        ],
      };
    },
  },
});
