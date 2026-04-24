import { createConnectorCredentialHelpers } from '../../../Core/ConnectorUtils.js';

const {
  getCredentials: getSpotifyCredentials,
  requireCredentials: requireSpotifyCredentials,
  notConnected,
  withCredentials: withSpotify,
} = createConnectorCredentialHelpers({
  connectorId: 'spotify',
  credentialKey: 'accessToken',
  requiredErrorMessage: 'Spotify not connected. Complete the OAuth flow in Settings -> Connectors.',
  notConnectedErrorMessage:
    'Spotify is not connected. Please connect via OAuth in Settings -> Connectors.',
});

export { getSpotifyCredentials, requireSpotifyCredentials, notConnected, withSpotify };
