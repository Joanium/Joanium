import { createConnectorCredentialHelpers } from '../../../Core/ConnectorUtils.js';

const {
  getCredentials: getSentryCredentials,
  requireCredentials: requireSentryCredentials,
  notConnected,
  withCredentials: withSentry,
} = createConnectorCredentialHelpers({
  connectorId: 'sentry',
  requiredErrorMessage: 'Sentry not connected. Add your Auth Token in Settings -> Connectors.',
  notConnectedErrorMessage:
    'Sentry is not connected. Please add your Auth Token in Settings -> Connectors.',
});

export { getSentryCredentials, requireSentryCredentials, notConnected, withSentry };
