import createCapabilityFeature, {
  createConnectedServicePrompt,
  createConnectorService,
  createConnectorValidator,
} from '../../Core/CapabilityFeatureFactory.js';
import * as StripeAPI from './API/StripeAPI.js';
import { getStripeCredentials, withStripe } from './Shared/Common.js';
import { STRIPE_TOOLS } from './Chat/Tools.js';
import { executeStripeChatTool } from './Chat/ChatExecutor.js';

const validateStripeConnection = createConnectorValidator({
  connectorId: 'stripe',
  validate: async (creds) => {
    const balance = await StripeAPI.getBalance(creds);
    const isTestMode = creds.token.startsWith('sk_test_');
    return {
      response: {
        mode: isTestMode ? 'test' : 'live',
        currencies: balance.available.map((amount) => amount.currency),
      },
    };
  },
});

export default createCapabilityFeature({
  id: 'stripe',
  name: 'Stripe',

  connectors: {
    services: [
      createConnectorService({
        id: 'stripe',
        name: 'Stripe',
        iconFile: 'Stripe.png',
        description:
          'Monitor your Stripe balance, charges, customers, and subscriptions from chat.',
        helpUrl: 'https://dashboard.stripe.com/apikeys',
        helpText: 'View API Keys ->',
        setupSteps: [
          'Go to dashboard.stripe.com -> Developers -> API Keys',
          'Use the "Secret key" (starts with sk_live_ or sk_test_)',
          'For testing, use the test mode secret key (sk_test_...)',
          'Copy the key below - keep it private',
        ],
        capabilities: [
          'Check account balance (available and pending)',
          'List recent charges and customer transactions',
          'Monitor revenue and subscriptions via agents',
        ],
        fields: [
          {
            key: 'token',
            label: 'Secret Key',
            placeholder: 'sk_live_... or sk_test_...',
            type: 'password',
            hint: 'Found at dashboard.stripe.com -> Developers -> API Keys. Never share this key.',
          },
        ],
        validate: validateStripeConnection,
      }),
    ],
  },

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
  },
  chatTools: STRIPE_TOOLS,
  executeChatTool: executeStripeChatTool,

  prompt: createConnectedServicePrompt({
    getCredentials: getStripeCredentials,
    getServiceLabel: (creds) => {
      const mode = creds.token?.startsWith('sk_test_') ? 'test mode' : 'live mode';
      return `Stripe (${mode})`;
    },
    sections: (creds) => {
      const mode = creds.token?.startsWith('sk_test_') ? 'test mode' : 'live mode';
      return `Stripe is connected in ${mode}. You can check balance with stripe_get_balance and list charges with stripe_list_charges.`;
    },
  }),
});
