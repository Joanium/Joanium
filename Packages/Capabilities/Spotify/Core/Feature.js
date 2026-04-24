import defineFeature from '../../Core/DefineFeature.js';
import * as SpotifyAPI from './API/SpotifyAPI.js';
import { getSpotifyCredentials, withSpotify } from './Shared/Common.js';
import { SPOTIFY_TOOLS } from './Chat/Tools.js';
import { executeSpotifyChatTool } from './Chat/ChatExecutor.js';
import {
  spotifyDataSourceCollectors,
  spotifyOutputHandlers,
} from './Automation/AutomationHandlers.js';

async function getSpotifyWorkspace() {
  return import('../SpotifyWorkspace.js');
}

export default defineFeature({
  id: 'spotify',
  name: 'Spotify',

  connectors: {
    services: [
      {
        id: 'spotify',
        name: 'Spotify',
        icon: '<img src="../../../Assets/Icons/Spotify.png" alt="Spotify" style="width: 26px; height: 26px; object-fit: contain;" />',
        description:
          "See what's playing, explore top tracks, and browse playlists from your Spotify account.",
        helpUrl: 'https://developer.spotify.com/dashboard',
        helpText: 'Create a Spotify App →',
        oauthType: 'spotify',
        connectMethod: 'oauthStart',
        connectLabel: 'Connect with Spotify',
        connectingLabel: 'Opening Spotify authorisation...',
        subServices: [],
        setupSteps: [
          'Go to developer.spotify.com/dashboard and log in',
          'Click "Create App" — fill in name and description',
          'Under Redirect URIs, add: http://127.0.0.1:42815/oauth/callback',
          'Copy the Client ID and Client Secret below',
          'Click "Connect with Spotify" to authenticate',
        ],
        capabilities: [
          "See what's currently playing on Spotify",
          'View your top tracks and artists',
          'Browse and summarize your playlists',
        ],
        fields: [
          {
            key: 'clientId',
            label: 'Client ID',
            placeholder: 'Your Spotify app Client ID',
            type: 'text',
            hint: 'Found at developer.spotify.com/dashboard → your app.',
          },
          {
            key: 'clientSecret',
            label: 'Client Secret',
            placeholder: 'Your Spotify app Client Secret',
            type: 'password',
            hint: 'Keep this private. Click "View client secret" in your Spotify dashboard.',
          },
        ],
        automations: [
          {
            name: 'Music Digest',
            description: 'Weekly — summarize your top tracks and most active listening periods',
          },
        ],
        defaultState: { enabled: false, credentials: {} },
        async validate(ctx) {
          const creds = ctx.connectorEngine?.getCredentials('spotify');
          if (!creds?.accessToken)
            return { ok: false, error: 'Not connected — complete the Spotify OAuth flow first.' };
          try {
            const { getFreshCreds } = await getSpotifyWorkspace();
            const freshCreds = await getFreshCreds(creds);
            const me = await SpotifyAPI.getMe(freshCreds);
            ctx.connectorEngine?.updateCredentials('spotify', {
              displayName: me.display_name ?? null,
              email: me.email ?? null,
            });
            return { ok: true, displayName: me.display_name, email: me.email };
          } catch (err) {
            return { ok: false, error: err.message };
          }
        },
      },
    ],
  },

  lifecycle: {
    async onBoot(ctx) {
      const { setConnectorEngine } = await getSpotifyWorkspace();
      setConnectorEngine(ctx.connectorEngine);
    },
  },

  main: {
    methods: {
      async oauthStart(ctx, { clientId, clientSecret }) {
        if (!clientId?.trim() || !clientSecret?.trim()) {
          return { ok: false, error: 'Client ID and Client Secret are required' };
        }
        const { startOAuthFlow } = await getSpotifyWorkspace();
        const tokens = await startOAuthFlow(clientId.trim(), clientSecret.trim());
        ctx.connectorEngine?.saveConnector('spotify', tokens);
        ctx.invalidateSystemPrompt?.();
        return { ok: true, displayName: tokens.displayName, email: tokens.email };
      },

      nowPlaying: async (ctx) =>
        withSpotify(ctx, async (creds) => {
          const { getFreshCreds } = await getSpotifyWorkspace();
          const freshCreds = await getFreshCreds(creds);
          const nowPlaying = await SpotifyAPI.getCurrentlyPlaying(freshCreds);
          return { ok: true, nowPlaying };
        }),

      topTracks: async (ctx, { limit } = {}) =>
        withSpotify(ctx, async (creds) => {
          const { getFreshCreds } = await getSpotifyWorkspace();
          const freshCreds = await getFreshCreds(creds);
          return { ok: true, tracks: await SpotifyAPI.getTopTracks(freshCreds, limit ?? 10) };
        }),

      executeChatTool: async (ctx, { toolName, params }) =>
        executeSpotifyChatTool(ctx, toolName, params),
    },
  },

  renderer: { chatTools: SPOTIFY_TOOLS },

  automation: {
    dataSources: [{ value: 'spotify_top_tracks', label: 'Spotify - Top Tracks', group: 'Spotify' }],
    outputTypes: [],
    instructionTemplates: {
      spotify_top_tracks:
        "Review the user's top Spotify tracks. Identify listening patterns, favourite genres, and any interesting observations about their music taste.",
    },
    dataSourceCollectors: spotifyDataSourceCollectors,
    outputHandlers: spotifyOutputHandlers,
  },

  prompt: {
    async getContext(ctx) {
      const creds = getSpotifyCredentials(ctx);
      if (!creds) return null;
      const name = creds.displayName ?? creds.email ?? null;
      return {
        connectedServices: [name ? `Spotify (${name})` : 'Spotify'],
        sections: [
          "Spotify is connected. You can check what's playing with spotify_now_playing, and list top tracks with spotify_top_tracks.",
        ],
      };
    },
  },
});
