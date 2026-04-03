import defineFeature from '../../../Core/DefineFeature.js';
import * as DocsAPI from './API/DocsAPI.js';
import { DOCS_TOOLS } from './Chat/Tools.js';
import { executeDocsChatTool } from './Chat/ChatExecutor.js';
import { withGoogle } from '../../Common.js';

export default defineFeature({
  id: 'docs',
  name: 'Google Docs',
  dependsOn: ['google-workspace'],
  connectors: {
    serviceExtensions: [
      {
        target: 'google',
        subServices: [
          {
            key: 'docs',
            icon: '📄',
            name: 'Google Docs',
            apiUrl: 'https://console.cloud.google.com/apis/library/docs.googleapis.com',
          },
        ],
        capabilities: [
          'Read and edit Google Docs',
          'Create documents and append or replace content',
        ],
      },
    ],
  },
  main: {
    methods: {
      async getDocument(ctx, { documentId }) {
        return withGoogle(ctx, async (credentials) => {
          if (!documentId) return { ok: false, error: 'documentId is required' };
          return { ok: true, document: await DocsAPI.getDocument(credentials, documentId) };
        });
      },

      async readDocument(ctx, { documentId }) {
        return withGoogle(ctx, async (credentials) => {
          if (!documentId) return { ok: false, error: 'documentId is required' };
          const doc = await DocsAPI.getDocument(credentials, documentId);
          return {
            ok: true,
            ...DocsAPI.extractText(doc),
            title: doc.title,
            documentId: doc.documentId,
          };
        });
      },

      async createDocument(ctx, { title }) {
        return withGoogle(ctx, async (credentials) => {
          if (!title) return { ok: false, error: 'title is required' };
          return { ok: true, document: await DocsAPI.createDocument(credentials, title) };
        });
      },

      async appendText(ctx, { documentId, text }) {
        return withGoogle(ctx, async (credentials) => {
          if (!documentId) return { ok: false, error: 'documentId is required' };
          if (!text) return { ok: false, error: 'text is required' };
          return { ok: true, result: await DocsAPI.appendText(credentials, documentId, text) };
        });
      },

      async replaceAllText(ctx, { documentId, searchText, replacement }) {
        return withGoogle(ctx, async (credentials) => {
          if (!documentId || !searchText)
            return { ok: false, error: 'documentId and searchText are required' };
          return {
            ok: true,
            result: await DocsAPI.replaceAllText(
              credentials,
              documentId,
              searchText,
              replacement ?? '',
            ),
          };
        });
      },

      async executeChatTool(ctx, { toolName, params }) {
        return executeDocsChatTool(ctx, toolName, params);
      },
    },
  },
  renderer: {
    chatTools: DOCS_TOOLS,
  },
});
