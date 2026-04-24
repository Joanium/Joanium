import { createConnectorCredentialHelpers } from '../../../Core/ConnectorUtils.js';

const {
  getCredentials: getStripeCredentials,
  requireCredentials: requireStripeCredentials,
  notConnected,
  withCredentials: withStripe,
} = createConnectorCredentialHelpers({
  connectorId: 'stripe',
  requiredErrorMessage: 'Stripe not connected. Add your Secret Key in Settings -> Connectors.',
  notConnectedErrorMessage:
    'Stripe is not connected. Please add your Secret Key in Settings -> Connectors.',
});

export { getStripeCredentials, requireStripeCredentials, notConnected, withStripe };
