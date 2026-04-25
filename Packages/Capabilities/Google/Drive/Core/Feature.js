import createGoogleFeature from '../../Core/GoogleFeatureFactory.js';
import {
  createFile,
  getFileContent,
  getFileMetadata,
  getStorageQuota,
  listFiles,
  listFolders,
  searchFiles,
  updateFileContent,
} from './API/DriveApi.js';
import { executeDriveChatTool } from './Chat/ChatExecutor.js';
import { DRIVE_TOOLS } from './Chat/Tools.js';
import { withGoogle } from '../../Common.js';
export default createGoogleFeature({
  id: 'drive',
  name: 'Google Drive',
  iconFile: 'Drive.png',
  apiUrl: 'https://console.cloud.google.com/apis/library/drive.googleapis.com',
  capabilities: ['Browse, read, and create Drive files'],
  methods: {
    listFiles: async (ctx, { opts: opts = {} } = {}) =>
      withGoogle(ctx, async (credentials) => ({
        ok: !0,
        files: await listFiles(credentials, opts),
      })),
    searchFiles: async (ctx, { query: query, maxResults: maxResults = 20 }) =>
      withGoogle(ctx, async (credentials) =>
        query?.trim()
          ? { ok: !0, files: await searchFiles(credentials, query, maxResults) }
          : { ok: !1, error: 'Search query is required' },
      ),
    getFileInfo: async (ctx, { fileId: fileId }) =>
      withGoogle(ctx, async (credentials) =>
        fileId
          ? { ok: !0, file: await getFileMetadata(credentials, fileId) }
          : { ok: !1, error: 'fileId is required' },
      ),
    readFile: async (ctx, { fileId: fileId }) =>
      withGoogle(ctx, async (credentials) =>
        fileId
          ? { ok: !0, ...(await getFileContent(credentials, fileId)) }
          : { ok: !1, error: 'fileId is required' },
      ),
    createFile: async (
      ctx,
      {
        name: name,
        content: content = '',
        mimeType: mimeType = 'text/plain',
        folderId: folderId = null,
      },
    ) =>
      withGoogle(ctx, async (credentials) =>
        name
          ? { ok: !0, file: await createFile(credentials, name, content, mimeType, folderId) }
          : { ok: !1, error: 'File name is required' },
      ),
    updateFile: async (
      ctx,
      { fileId: fileId, content: content = '', mimeType: mimeType = 'text/plain' },
    ) =>
      withGoogle(ctx, async (credentials) =>
        fileId
          ? { ok: !0, file: await updateFileContent(credentials, fileId, content, mimeType) }
          : { ok: !1, error: 'fileId is required' },
      ),
    listFolders: async (ctx, { maxResults: maxResults = 30 } = {}) =>
      withGoogle(ctx, async (credentials) => ({
        ok: !0,
        folders: await listFolders(credentials, maxResults),
      })),
    getQuota: async (ctx) =>
      withGoogle(ctx, async (credentials) => ({
        ok: !0,
        ...(await getStorageQuota(credentials)),
      })),
  },
  chatTools: DRIVE_TOOLS,
  executeChatTool: executeDriveChatTool,
});
