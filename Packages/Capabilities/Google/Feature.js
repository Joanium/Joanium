import defineFeature from '../Core/DefineFeature.js';
async function getGoogleWorkspaceModule() {
  return import('./GoogleWorkspace.js');
}
export default defineFeature({
  id: 'google-workspace',
  name: 'Google Workspace',
  connectors: {
    services: [
      {
        id: 'google',
        name: 'Google Workspace',
        icon: '<img src="../../../Assets/Icons/Google.png" alt="Google" class="connector-icon-img" />',
        description:
          'Connect once with one Client ID and get access to your enabled Google services.',
        helpUrl: 'https://console.cloud.google.com/apis/credentials',
        helpText: 'Create OAuth credentials ->',
        oauthType: 'google',
        connectMethod: 'oauthStart',
        connectLabel: 'Sign in with Google',
        connectingLabel: 'Opening Google sign-in...',
        serviceRefreshMethod: 'detectServices',
        subServices: [],
        setupSteps: [
          'Go to Google Cloud Console and create or select a project',
          'Enable the Google APIs you want to use',
          'Create an OAuth 2.0 Client ID with Desktop App type',
          'Copy the Client ID and Client Secret below',
        ],
        capabilities: [],
        fields: [
          {
            key: 'clientId',
            label: 'Client ID',
            placeholder: 'xxxxxxxxxxxx.apps.googleusercontent.com',
            type: 'text',
            hint: 'Google Cloud Console -> APIs & Services -> Credentials -> OAuth 2.0 Client IDs',
          },
          {
            key: 'clientSecret',
            label: 'Client Secret',
            placeholder: 'GOCSPX-...',
            type: 'password',
            hint: 'Keep it private.',
          },
        ],
        automations: [],
        defaultState: { enabled: !1, credentials: {} },
        async validate(ctx) {
          const creds = ctx.connectorEngine?.getCredentials('google');
          if (!creds?.accessToken) return { ok: !1, error: 'No credentials stored' };
          const { getFreshCreds: getFreshCreds } = await getGoogleWorkspaceModule(),
            freshCreds = await getFreshCreds(creds),
            email = await (async function (accessToken) {
              const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${accessToken}` },
              });
              if (!response.ok) throw new Error(`Token validation failed (${response.status})`);
              return (await response.json()).email ?? null;
            })(freshCreds.accessToken);
          return (
            email && ctx.connectorEngine?.updateCredentials('google', { email: email }),
            { ok: !0, email: email }
          );
        },
      },
    ],
  },
  lifecycle: {
    async onBoot(ctx) {
      const { setConnectorEngine: setConnectorEngine } = await getGoogleWorkspaceModule();
      setConnectorEngine(ctx.connectorEngine);
    },
  },
  main: {
    methods: {
      async oauthStart(ctx, { clientId: clientId, clientSecret: clientSecret }) {
        if (!clientId?.trim() || !clientSecret?.trim())
          return { ok: !1, error: 'Client ID and Client Secret are required' };
        const { startOAuthFlow: startOAuthFlow, detectServices: detectServices } =
            await getGoogleWorkspaceModule(),
          tokens = await startOAuthFlow(clientId.trim(), clientSecret.trim()),
          services = await detectServices(tokens).catch(() => ({}));
        return (
          (tokens.services = services),
          ctx.connectorEngine?.saveConnector('google', tokens),
          ctx.invalidateSystemPrompt?.(),
          { ok: !0, email: tokens.email, services: services }
        );
      },
      async detectServices(ctx) {
        const creds = ctx.connectorEngine?.getCredentials('google');
        if (!creds?.accessToken) return { ok: !1, error: 'Google Workspace not connected' };
        const { detectServices: detectServices } = await getGoogleWorkspaceModule(),
          services = await detectServices(creds);
        return (
          ctx.connectorEngine?.updateCredentials('google', { services: services }),
          ctx.invalidateSystemPrompt?.(),
          { ok: !0, services: services }
        );
      },
    },
  },
  prompt: {
    async getContext(ctx) {
      const creds = ctx.connectorEngine?.getCredentials('google');
      return creds?.email
        ? { connectedServices: [`Google Workspace (${creds.email})`], sections: [] }
        : null;
    },
  },
});
