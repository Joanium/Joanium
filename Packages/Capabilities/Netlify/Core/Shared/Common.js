import { createConnectorCredentialHelpers } from '../../../Core/ConnectorUtils.js';

const {
  getCredentials: getNetlifyCredentials,
  requireCredentials: requireNetlifyCredentials,
  notConnected,
  withCredentials: withNetlify,
} = createConnectorCredentialHelpers({
  connectorId: 'netlify',
  requiredErrorMessage: 'Netlify not connected',
  notConnectedErrorMessage:
    'Netlify is not connected. Ask the user to connect it in Settings -> Connectors.',
});

export { getNetlifyCredentials, requireNetlifyCredentials, notConnected, withNetlify };
