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
            icon: '<img src="../../../Assets/Icons/Docs.png" alt="Google Docs" style="width: 26px; height: 26px; object-fit: contain;" />',
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
      getDocument: async (ctx, { documentId: documentId }) =>
        withGoogle(ctx, async (credentials) =>
          documentId
            ? { ok: !0, document: await DocsAPI.getDocument(credentials, documentId) }
            : { ok: !1, error: 'documentId is required' },
        ),
      readDocument: async (ctx, { documentId: documentId }) =>
        withGoogle(ctx, async (credentials) => {
          if (!documentId) return { ok: !1, error: 'documentId is required' };
          const doc = await DocsAPI.getDocument(credentials, documentId);
          return {
            ok: !0,
            ...DocsAPI.extractText(doc),
            title: doc.title,
            documentId: doc.documentId,
          };
        }),
      createDocument: async (ctx, { title: title }) =>
        withGoogle(ctx, async (credentials) =>
          title
            ? { ok: !0, document: await DocsAPI.createDocument(credentials, title) }
            : { ok: !1, error: 'title is required' },
        ),
      appendText: async (ctx, { documentId: documentId, text: text }) =>
        withGoogle(ctx, async (credentials) =>
          documentId
            ? text
              ? { ok: !0, result: await DocsAPI.appendText(credentials, documentId, text) }
              : { ok: !1, error: 'text is required' }
            : { ok: !1, error: 'documentId is required' },
        ),
      replaceAllText: async (
        ctx,
        { documentId: documentId, searchText: searchText, replacement: replacement },
      ) =>
        withGoogle(ctx, async (credentials) =>
          documentId && searchText
            ? {
                ok: !0,
                result: await DocsAPI.replaceAllText(
                  credentials,
                  documentId,
                  searchText,
                  replacement ?? '',
                ),
              }
            : { ok: !1, error: 'documentId and searchText are required' },
        ),
      executeChatTool: async (ctx, { toolName: toolName, params: params }) =>
        executeDocsChatTool(ctx, toolName, params),
    },
  },
  renderer: { chatTools: DOCS_TOOLS },
});
