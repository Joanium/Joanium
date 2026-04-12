import {
  createFile,
  getFileContent,
  getStorageQuota,
  listFiles,
  listFolders,
  searchFiles,
} from '../API/DriveApi.js';
import { requireGoogleCredentials } from '../../../Common.js';
import { formatSize, formatDate, mimeLabel } from './Utils.js';
export async function executeDriveChatTool(ctx, toolName, params = {}) {
  const credentials = requireGoogleCredentials(ctx);
  switch (toolName) {
    case 'drive_list_files': {
      const files = await listFiles(credentials, {
        folderId: params.folder_id?.trim() || '',
        pageSize: Number(params.max_results) || 20,
      });
      return files.length
        ? `Google Drive - ${files.length} file(s):\n\n${files.map((file, index) => `${index + 1}. **${file.name}** [${mimeLabel(file.mimeType)}]${file.size ? ` - ${formatSize(file.size)}` : ''} · Modified ${formatDate(file.modifiedTime)}\n   ID: \`${file.id}\`${file.webViewLink ? `\n   Link: ${file.webViewLink}` : ''}`).join('\n\n')}`
        : 'No files found in Google Drive.';
    }
    case 'drive_search_files': {
      if (!params.query?.trim()) throw new Error('Missing required param: query');
      const files = await searchFiles(credentials, params.query, Number(params.max_results) || 20);
      return files.length
        ? `Drive search for "${params.query}" - ${files.length} result(s):\n\n${files.map((file, index) => `${index + 1}. **${file.name}** [${mimeLabel(file.mimeType)}]${file.size ? ` - ${formatSize(file.size)}` : ''} · Modified ${formatDate(file.modifiedTime)}\n   ID: \`${file.id}\`${file.webViewLink ? `\n   Link: ${file.webViewLink}` : ''}`).join('\n\n')}`
        : `No files found in Google Drive matching "${params.query}".`;
    }
    case 'drive_read_file': {
      if (!params.file_id?.trim()) throw new Error('Missing required param: file_id');
      const result = await getFileContent(credentials, params.file_id);
      return result.binaryFile
        ? [
            `**${result.meta?.name ?? 'File'}** [${mimeLabel(result.meta?.mimeType)}]`,
            'This file is a binary format and cannot be displayed as text.',
            result.meta?.webViewLink ? `Link: ${result.meta.webViewLink}` : '',
          ]
            .filter(Boolean)
            .join('\n')
        : [
            `**${result.meta?.name ?? 'File'}** [${mimeLabel(result.meta?.mimeType)}]`,
            result.meta?.modifiedTime ? `Modified: ${formatDate(result.meta.modifiedTime)}` : '',
            result.truncated ? 'Showing the first 30,000 characters.' : '',
            '',
            '```',
            result.content ?? '(empty file)',
            '```',
          ]
            .filter(Boolean)
            .join('\n');
    }
    case 'drive_get_storage': {
      const result = await getStorageQuota(credentials),
        quota = result.quota ?? {},
        used = Number(quota.usage ?? 0),
        limit = Number(quota.limit ?? 0),
        percentage = limit > 0 ? ((used / limit) * 100).toFixed(1) : null;
      return [
        'Google Drive Storage',
        '',
        `Used: ${formatSize(used)}${percentage ? ` (${percentage}%)` : ''}`,
        limit ? `Total: ${formatSize(limit)}` : '',
        quota.usageInDrive ? `In Drive: ${formatSize(quota.usageInDrive)}` : '',
        quota.usageInDriveTrash ? `In Trash: ${formatSize(quota.usageInDriveTrash)}` : '',
        result.email ? `Account: ${result.email}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'drive_create_file': {
      if (!params.name?.trim()) throw new Error('Missing required param: name');
      if (null == params.content) throw new Error('Missing required param: content');
      const file = await createFile(
        credentials,
        params.name.trim(),
        String(params.content),
        'text/plain',
        params.folder_id?.trim() || null,
      );
      return [
        'File created in Google Drive',
        `Name: ${file.name ?? params.name}`,
        file.id ? `ID: \`${file.id}\`` : '',
        file.webViewLink ? `Link: ${file.webViewLink}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'drive_list_folders': {
      const folders = await listFolders(credentials, Number(params.max_results) || 20);
      return folders.length
        ? `Google Drive Folders (${folders.length}):\n\n${folders.map((folder, index) => `${index + 1}. **${folder.name}** - ID: \`${folder.id}\``).join('\n')}`
        : 'No folders found in Google Drive.';
    }
    default:
      throw new Error(`Unknown Drive tool: ${toolName}`);
  }
}
