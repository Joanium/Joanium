import defineFeature from '../../../Core/DefineFeature.js';
import * as YouTubeAPI from './API/YouTubeAPI.js';
import { YOUTUBE_TOOLS } from './Chat/Tools.js';
import { executeYouTubeChatTool } from './Chat/ChatExecutor.js';
import { withGoogle } from '../../Common.js';

export default defineFeature({
  id: 'youtube',
  name: 'YouTube',
  dependsOn: ['google-workspace'],
  connectors: {
    serviceExtensions: [
      {
        target: 'google',
        subServices: [
          {
            key: 'youtube',
            icon: '▶️',
            name: 'YouTube',
            apiUrl: 'https://console.cloud.google.com/apis/library/youtube.googleapis.com',
          },
        ],
        capabilities: [
          'Search YouTube videos',
          'Manage playlists, subscriptions, and liked videos',
          'Read and interact with video comments',
        ],
      },
    ],
  },
  main: {
    methods: {
      async getMyChannel(ctx) {
        return withGoogle(ctx, async credentials => ({ ok: true, channel: await YouTubeAPI.getMyChannel(credentials) }));
      },

      async searchVideos(ctx, { query, maxResults = 10, order = 'relevance' } = {}) {
        return withGoogle(ctx, async credentials => {
          if (!query?.trim()) return { ok: false, error: 'query is required' };
          return { ok: true, items: await YouTubeAPI.searchVideos(credentials, query, { maxResults, order }) };
        });
      },

      async getVideoDetails(ctx, { videoId }) {
        return withGoogle(ctx, async credentials => {
          if (!videoId) return { ok: false, error: 'videoId is required' };
          return { ok: true, video: await YouTubeAPI.getVideoDetails(credentials, videoId) };
        });
      },

      async listMyPlaylists(ctx, { maxResults = 20 } = {}) {
        return withGoogle(ctx, async credentials => ({ ok: true, playlists: await YouTubeAPI.listMyPlaylists(credentials, maxResults) }));
      },

      async getPlaylistItems(ctx, { playlistId, maxResults = 20 }) {
        return withGoogle(ctx, async credentials => {
          if (!playlistId) return { ok: false, error: 'playlistId is required' };
          return { ok: true, items: await YouTubeAPI.getPlaylistItems(credentials, playlistId, maxResults) };
        });
      },

      async listSubscriptions(ctx, { maxResults = 20 } = {}) {
        return withGoogle(ctx, async credentials => ({ ok: true, subscriptions: await YouTubeAPI.listSubscriptions(credentials, maxResults) }));
      },

      async getLikedVideos(ctx, { maxResults = 20 } = {}) {
        return withGoogle(ctx, async credentials => ({ ok: true, videos: await YouTubeAPI.getLikedVideos(credentials, maxResults) }));
      },

      async getVideoComments(ctx, { videoId, maxResults = 20 }) {
        return withGoogle(ctx, async credentials => {
          if (!videoId) return { ok: false, error: 'videoId is required' };
          return { ok: true, comments: await YouTubeAPI.getVideoComments(credentials, videoId, maxResults) };
        });
      },

      async rateVideo(ctx, { videoId, rating }) {
        return withGoogle(ctx, async credentials => {
          if (!videoId || !rating) return { ok: false, error: 'videoId and rating are required' };
          await YouTubeAPI.rateVideo(credentials, videoId, rating);
          return { ok: true };
        });
      },

      async listMyVideos(ctx, { maxResults = 20 } = {}) {
        return withGoogle(ctx, async credentials => ({ ok: true, videos: await YouTubeAPI.listMyVideos(credentials, maxResults) }));
      },

      async executeChatTool(ctx, { toolName, params }) {
        return executeYouTubeChatTool(ctx, toolName, params);
      },
    },
  },
  renderer: {
    chatTools: YOUTUBE_TOOLS,
  },
});
