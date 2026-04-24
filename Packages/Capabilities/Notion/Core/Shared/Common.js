import { createConnectorCredentialHelpers } from '../../../Core/ConnectorUtils.js';

const {
  getCredentials: getNotionCredentials,
  requireCredentials: requireNotionCredentials,
  notConnected,
  withCredentials: withNotion,
} = createConnectorCredentialHelpers({
  connectorId: 'notion',
  requiredErrorMessage: 'Notion not connected',
  notConnectedErrorMessage:
    'Notion is not connected. Ask the user to connect it in Settings -> Connectors.',
});

export { getNotionCredentials, requireNotionCredentials, notConnected, withNotion };
