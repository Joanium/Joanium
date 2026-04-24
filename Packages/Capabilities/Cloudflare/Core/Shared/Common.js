import { createConnectorCredentialHelpers } from '../../../Core/ConnectorUtils.js';

const {
  getCredentials: getCloudflareCredentials,
  requireCredentials: requireCloudflareCredentials,
  notConnected,
  withCredentials: withCloudflare,
} = createConnectorCredentialHelpers({
  connectorId: 'cloudflare',
  requiredErrorMessage: 'Cloudflare not connected',
  notConnectedErrorMessage:
    'Cloudflare is not connected. Ask the user to connect it in Settings -> Connectors.',
});

export { getCloudflareCredentials, requireCloudflareCredentials, notConnected, withCloudflare };
