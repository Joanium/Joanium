import { createConnectorCredentialHelpers } from '../../../Core/ConnectorUtils.js';

const {
  getCredentials: getHubSpotCredentials,
  requireCredentials: requireHubSpotCredentials,
  notConnected,
  withCredentials: withHubSpot,
} = createConnectorCredentialHelpers({
  connectorId: 'hubspot',
  requiredErrorMessage:
    'HubSpot not connected. Add your Private App Token in Settings -> Connectors.',
  notConnectedErrorMessage:
    'HubSpot is not connected. Please add your Private App Token in Settings -> Connectors.',
});

export { getHubSpotCredentials, requireHubSpotCredentials, notConnected, withHubSpot };
