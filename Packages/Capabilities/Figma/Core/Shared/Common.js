import { createConnectorCredentialHelpers } from '../../../Core/ConnectorUtils.js';

const {
  getCredentials: getFigmaCredentials,
  requireCredentials: requireFigmaCredentials,
  notConnected,
  withCredentials: withFigma,
} = createConnectorCredentialHelpers({
  connectorId: 'figma',
  requiredErrorMessage: 'Figma not connected',
  notConnectedErrorMessage:
    'Figma is not connected. Ask the user to connect it in Settings -> Connectors.',
});

export { getFigmaCredentials, requireFigmaCredentials, notConnected, withFigma };
