import { createConnectorCredentialHelpers } from '../../../Core/ConnectorUtils.js';

const {
  getCredentials: getSupabaseCredentials,
  requireCredentials: requireSupabaseCredentials,
  notConnected,
  withCredentials: withSupabase,
} = createConnectorCredentialHelpers({
  connectorId: 'supabase',
  requiredErrorMessage: 'Supabase not connected. Add your Access Token in Settings -> Connectors.',
  notConnectedErrorMessage:
    'Supabase is not connected. Please add your Access Token in Settings -> Connectors.',
});

export { getSupabaseCredentials, requireSupabaseCredentials, notConnected, withSupabase };
