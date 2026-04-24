import { createConnectorCredentialHelpers } from '../../../Core/ConnectorUtils.js';

const {
  getCredentials: getJiraCredentials,
  requireCredentials: requireJiraCredentials,
  notConnected,
  withCredentials: withJira,
} = createConnectorCredentialHelpers({
  connectorId: 'jira',
  credentialKey: ['email', 'token', 'siteUrl'],
  requiredErrorMessage: 'Jira not connected',
  notConnectedErrorMessage:
    'Jira is not connected. Ask the user to connect it in Settings -> Connectors.',
});

export function jiraAuthHeader(creds) {
  const encoded = Buffer.from(`${creds.email}:${creds.token}`).toString('base64');
  return `Basic ${encoded}`;
}

export { getJiraCredentials, requireJiraCredentials, notConnected, withJira };
