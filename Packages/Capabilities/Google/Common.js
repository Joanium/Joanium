import { createConnectorCredentialHelpers } from '../Core/ConnectorUtils.js';

export const GOOGLE_NOT_CONNECTED_MESSAGE =
  'Google Workspace not connected - connect it in Settings -> Connectors';

const {
  getCredentials: getGoogleCredentials,
  requireCredentials: requireGoogleCredentials,
  notConnected: googleNotConnected,
  withCredentials: withGoogle,
} = createConnectorCredentialHelpers({
  connectorId: 'google',
  credentialKey: 'accessToken',
  requiredErrorMessage: GOOGLE_NOT_CONNECTED_MESSAGE,
  notConnectedErrorMessage: GOOGLE_NOT_CONNECTED_MESSAGE,
});

export { getGoogleCredentials, requireGoogleCredentials, googleNotConnected, withGoogle };
