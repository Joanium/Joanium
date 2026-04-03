import defineFeature from '../../../Core/DefineFeature.js';
import * as SlidesAPI from './API/SlidesAPI.js';
import { SLIDES_TOOLS } from './Chat/Tools.js';
import { executeSlidesChatTool } from './Chat/ChatExecutor.js';
import { withGoogle } from '../../Common.js';

export default defineFeature({
  id: 'slides',
  name: 'Google Slides',
  dependsOn: ['google-workspace'],
  connectors: {
    serviceExtensions: [
      {
        target: 'google',
        subServices: [
          {
            key: 'slides',
            icon: '📊',
            name: 'Google Slides',
            apiUrl: 'https://console.cloud.google.com/apis/library/slides.googleapis.com',
          },
        ],
        capabilities: [
          'Read and manage Google Slides presentations',
          'Create presentations and manipulate slides',
        ],
      },
    ],
  },
  main: {
    methods: {
      async getPresentation(ctx, { presentationId }) {
        return withGoogle(ctx, async (credentials) => {
          if (!presentationId) return { ok: false, error: 'presentationId is required' };
          return {
            ok: true,
            presentation: await SlidesAPI.getPresentation(credentials, presentationId),
          };
        });
      },

      async createPresentation(ctx, { title }) {
        return withGoogle(ctx, async (credentials) => {
          if (!title) return { ok: false, error: 'title is required' };
          return { ok: true, presentation: await SlidesAPI.createPresentation(credentials, title) };
        });
      },

      async addSlide(ctx, { presentationId, insertionIndex, layoutId } = {}) {
        return withGoogle(ctx, async (credentials) => {
          if (!presentationId) return { ok: false, error: 'presentationId is required' };
          return {
            ok: true,
            reply: await SlidesAPI.addSlide(credentials, presentationId, {
              insertionIndex,
              layoutId,
            }),
          };
        });
      },

      async deleteSlide(ctx, { presentationId, slideObjectId }) {
        return withGoogle(ctx, async (credentials) => {
          if (!presentationId || !slideObjectId)
            return { ok: false, error: 'presentationId and slideObjectId are required' };
          await SlidesAPI.deleteSlide(credentials, presentationId, slideObjectId);
          return { ok: true };
        });
      },

      async duplicateSlide(ctx, { presentationId, slideObjectId }) {
        return withGoogle(ctx, async (credentials) => {
          if (!presentationId || !slideObjectId)
            return { ok: false, error: 'presentationId and slideObjectId are required' };
          return {
            ok: true,
            reply: await SlidesAPI.duplicateSlide(credentials, presentationId, slideObjectId),
          };
        });
      },

      async replaceAllText(ctx, { presentationId, searchText, replacement }) {
        return withGoogle(ctx, async (credentials) => {
          if (!presentationId || !searchText)
            return { ok: false, error: 'presentationId and searchText are required' };
          return {
            ok: true,
            result: await SlidesAPI.replaceAllText(
              credentials,
              presentationId,
              searchText,
              replacement ?? '',
            ),
          };
        });
      },

      async executeChatTool(ctx, { toolName, params }) {
        return executeSlidesChatTool(ctx, toolName, params);
      },
    },
  },
  renderer: {
    chatTools: SLIDES_TOOLS,
  },
});
