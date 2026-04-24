import { createConnectorCredentialHelpers } from '../../../Core/ConnectorUtils.js';

const {
  getCredentials: getLinearCredentials,
  requireCredentials: requireLinearCredentials,
  notConnected,
  withCredentials: withLinear,
} = createConnectorCredentialHelpers({
  connectorId: 'linear',
  requiredErrorMessage: 'Linear not connected',
  notConnectedErrorMessage:
    'Linear is not connected. Ask the user to connect it in Settings -> Connectors.',
});

export { getLinearCredentials, requireLinearCredentials, notConnected, withLinear };
