import defineFeature from '../../../Core/DefineFeature.js';
import * as PhotosAPI from './API/PhotosAPI.js';
import { PHOTOS_TOOLS } from './Chat/Tools.js';
import { executePhotosChatTool } from './Chat/ChatExecutor.js';
import { withGoogle } from '../../Common.js';
export default defineFeature({
  id: 'photos',
  name: 'Google Photos',
  dependsOn: ['google-workspace'],
  connectors: {
    serviceExtensions: [
      {
        target: 'google',
        subServices: [
          {
            key: 'photos',
            icon: '<img src="../../../Assets/Icons/Photos.png" alt="Google Photos" style="width: 26px; height: 26px; object-fit: contain;" />',
            name: 'Google Photos',
            apiUrl: 'https://console.cloud.google.com/apis/library/photoslibrary.googleapis.com',
          },
        ],
        capabilities: [
          'Browse albums and media items in Google Photos',
          'Search photos by date range or content category',
        ],
      },
    ],
  },
  main: {
    methods: {
      listAlbums: async (ctx, { maxResults: maxResults = 20 } = {}) =>
        withGoogle(ctx, async (credentials) => ({
          ok: !0,
          albums: await PhotosAPI.listAlbums(credentials, { maxResults: maxResults }),
        })),
      getAlbum: async (ctx, { albumId: albumId }) =>
        withGoogle(ctx, async (credentials) =>
          albumId
            ? { ok: !0, album: await PhotosAPI.getAlbum(credentials, albumId) }
            : { ok: !1, error: 'albumId is required' },
        ),
      listSharedAlbums: async (ctx, { maxResults: maxResults = 20 } = {}) =>
        withGoogle(ctx, async (credentials) => ({
          ok: !0,
          albums: await PhotosAPI.listSharedAlbums(credentials, { maxResults: maxResults }),
        })),
      listMediaItems: async (ctx, { maxResults: maxResults = 20 } = {}) =>
        withGoogle(ctx, async (credentials) => ({
          ok: !0,
          items: await PhotosAPI.listMediaItems(credentials, { maxResults: maxResults }),
        })),
      getMediaItem: async (ctx, { mediaItemId: mediaItemId }) =>
        withGoogle(ctx, async (credentials) =>
          mediaItemId
            ? { ok: !0, item: await PhotosAPI.getMediaItem(credentials, mediaItemId) }
            : { ok: !1, error: 'mediaItemId is required' },
        ),
      searchMediaItems: async (
        ctx,
        { albumId: albumId, pageSize: pageSize = 20, filters: filters = {} } = {},
      ) =>
        withGoogle(ctx, async (credentials) => ({
          ok: !0,
          items: await PhotosAPI.searchMediaItems(credentials, {
            albumId: albumId,
            pageSize: pageSize,
            filters: filters,
          }),
        })),
      searchByDateRange: async (
        ctx,
        { startDate: startDate, endDate: endDate, maxResults: maxResults = 20 },
      ) =>
        withGoogle(ctx, async (credentials) =>
          startDate && endDate
            ? {
                ok: !0,
                items: await PhotosAPI.searchByDateRange(
                  credentials,
                  startDate,
                  endDate,
                  maxResults,
                ),
              }
            : { ok: !1, error: 'startDate and endDate are required' },
        ),
      searchByContentCategory: async (
        ctx,
        { categories: categories = [], maxResults: maxResults = 20 },
      ) =>
        withGoogle(ctx, async (credentials) =>
          categories.length
            ? {
                ok: !0,
                items: await PhotosAPI.searchByContentCategory(credentials, categories, maxResults),
              }
            : { ok: !1, error: 'at least one category is required' },
        ),
      getAlbumMediaItems: async (ctx, { albumId: albumId, maxResults: maxResults = 20 }) =>
        withGoogle(ctx, async (credentials) =>
          albumId
            ? {
                ok: !0,
                items: await PhotosAPI.getAlbumMediaItems(credentials, albumId, maxResults),
              }
            : { ok: !1, error: 'albumId is required' },
        ),
      executeChatTool: async (ctx, { toolName: toolName, params: params }) =>
        executePhotosChatTool(ctx, toolName, params),
    },
  },
  renderer: { chatTools: PHOTOS_TOOLS },
});
