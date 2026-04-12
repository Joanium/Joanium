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
            icon: '<img src="../../../Assets/Icons/Youtube.png" alt="Youtube" style="width: 26px; height: 26px; object-fit: contain;" />',
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
      getMyChannel: async (ctx) =>
        withGoogle(ctx, async (credentials) => ({
          ok: !0,
          channel: await YouTubeAPI.getMyChannel(credentials),
        })),
      searchVideos: async (
        ctx,
        { query: query, maxResults: maxResults = 10, order: order = 'relevance' } = {},
      ) =>
        withGoogle(ctx, async (credentials) =>
          query?.trim()
            ? {
                ok: !0,
                items: await YouTubeAPI.searchVideos(credentials, query, {
                  maxResults: maxResults,
                  order: order,
                }),
              }
            : { ok: !1, error: 'query is required' },
        ),
      getVideoDetails: async (ctx, { videoId: videoId }) =>
        withGoogle(ctx, async (credentials) =>
          videoId
            ? { ok: !0, video: await YouTubeAPI.getVideoDetails(credentials, videoId) }
            : { ok: !1, error: 'videoId is required' },
        ),
      listMyPlaylists: async (ctx, { maxResults: maxResults = 20 } = {}) =>
        withGoogle(ctx, async (credentials) => ({
          ok: !0,
          playlists: await YouTubeAPI.listMyPlaylists(credentials, maxResults),
        })),
      getPlaylistItems: async (ctx, { playlistId: playlistId, maxResults: maxResults = 20 }) =>
        withGoogle(ctx, async (credentials) =>
          playlistId
            ? {
                ok: !0,
                items: await YouTubeAPI.getPlaylistItems(credentials, playlistId, maxResults),
              }
            : { ok: !1, error: 'playlistId is required' },
        ),
      listSubscriptions: async (ctx, { maxResults: maxResults = 20 } = {}) =>
        withGoogle(ctx, async (credentials) => ({
          ok: !0,
          subscriptions: await YouTubeAPI.listSubscriptions(credentials, maxResults),
        })),
      getLikedVideos: async (ctx, { maxResults: maxResults = 20 } = {}) =>
        withGoogle(ctx, async (credentials) => ({
          ok: !0,
          videos: await YouTubeAPI.getLikedVideos(credentials, maxResults),
        })),
      getVideoComments: async (ctx, { videoId: videoId, maxResults: maxResults = 20 }) =>
        withGoogle(ctx, async (credentials) =>
          videoId
            ? {
                ok: !0,
                comments: await YouTubeAPI.getVideoComments(credentials, videoId, maxResults),
              }
            : { ok: !1, error: 'videoId is required' },
        ),
      rateVideo: async (ctx, { videoId: videoId, rating: rating }) =>
        withGoogle(ctx, async (credentials) =>
          videoId && rating
            ? (await YouTubeAPI.rateVideo(credentials, videoId, rating), { ok: !0 })
            : { ok: !1, error: 'videoId and rating are required' },
        ),
      listMyVideos: async (ctx, { maxResults: maxResults = 20 } = {}) =>
        withGoogle(ctx, async (credentials) => ({
          ok: !0,
          videos: await YouTubeAPI.listMyVideos(credentials, maxResults),
        })),
      executeChatTool: async (ctx, { toolName: toolName, params: params }) =>
        executeYouTubeChatTool(ctx, toolName, params),
    },
  },
  renderer: { chatTools: YOUTUBE_TOOLS },
});
