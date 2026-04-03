import defineFeature from '../../../Core/DefineFeature.js';
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

export default defineFeature({
  id: 'drive',
  name: 'Google Drive',
  dependsOn: ['google-workspace'],
  connectors: {
    serviceExtensions: [
      {
        target: 'google',
        subServices: [
          {
            key: 'drive',
            icon: 'Drive',
            name: 'Google Drive',
            apiUrl: 'https://console.cloud.google.com/apis/library/drive.googleapis.com',
          },
        ],
        capabilities: [
          'Browse, read, and create Drive files',
        ],
      },
    ],
  },
  main: {
    methods: {
      async listFiles(ctx, { opts = {} } = {}) {
        return withGoogle(ctx, async credentials => ({ ok: true, files: await listFiles(credentials, opts) }));
      },

      async searchFiles(ctx, { query, maxResults = 20 }) {
        return withGoogle(ctx, async credentials => {
          if (!query?.trim()) return { ok: false, error: 'Search query is required' };
          return { ok: true, files: await searchFiles(credentials, query, maxResults) };
        });
      },

      async getFileInfo(ctx, { fileId }) {
        return withGoogle(ctx, async credentials => {
          if (!fileId) return { ok: false, error: 'fileId is required' };
          return { ok: true, file: await getFileMetadata(credentials, fileId) };
        });
      },

      async readFile(ctx, { fileId }) {
        return withGoogle(ctx, async credentials => {
          if (!fileId) return { ok: false, error: 'fileId is required' };
          return { ok: true, ...(await getFileContent(credentials, fileId)) };
        });
      },

      async createFile(ctx, { name, content = '', mimeType = 'text/plain', folderId = null }) {
        return withGoogle(ctx, async credentials => {
          if (!name) return { ok: false, error: 'File name is required' };
          return { ok: true, file: await createFile(credentials, name, content, mimeType, folderId) };
        });
      },

      async updateFile(ctx, { fileId, content = '', mimeType = 'text/plain' }) {
        return withGoogle(ctx, async credentials => {
          if (!fileId) return { ok: false, error: 'fileId is required' };
          return { ok: true, file: await updateFileContent(credentials, fileId, content, mimeType) };
        });
      },

      async listFolders(ctx, { maxResults = 30 } = {}) {
        return withGoogle(ctx, async credentials => ({ ok: true, folders: await listFolders(credentials, maxResults) }));
      },

      async getQuota(ctx) {
        return withGoogle(ctx, async credentials => ({ ok: true, ...(await getStorageQuota(credentials)) }));
      },

      async executeChatTool(ctx, { toolName, params }) {
        return executeDriveChatTool(ctx, toolName, params);
      },
    },
  },
  renderer: {
    chatTools: DRIVE_TOOLS,
  },
});
