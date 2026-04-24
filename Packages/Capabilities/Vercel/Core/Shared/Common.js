import { createConnectorCredentialHelpers } from '../../../Core/ConnectorUtils.js';

const {
  getCredentials: getVercelCredentials,
  requireCredentials: requireVercelCredentials,
  notConnected,
  withCredentials: withVercel,
} = createConnectorCredentialHelpers({
  connectorId: 'vercel',
  requiredErrorMessage: 'Vercel not connected',
  notConnectedErrorMessage:
    'Vercel is not connected. Ask the user to connect it in Settings -> Connectors.',
});

export { getVercelCredentials, requireVercelCredentials, notConnected, withVercel };
