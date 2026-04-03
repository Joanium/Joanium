import { getFreshCreds } from '../../../GoogleWorkspace.js';

const DRIVE_BASE = 'https://www.googleapis.com/drive/v3';
const UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
const MAX_CONTENT_CHARS = 30_000;

const EXPORT_MIMES = {
  'application/vnd.google-apps.document': { mime: 'text/plain', ext: 'txt' },
  'application/vnd.google-apps.spreadsheet': { mime: 'text/csv', ext: 'csv' },
  'application/vnd.google-apps.presentation': { mime: 'text/plain', ext: 'txt' },
  'application/vnd.google-apps.drawing': { mime: 'image/svg+xml', ext: 'svg' },
};

const TEXT_MIMES = new Set([
  'text/plain',
  'text/html',
  'text/css',
  'text/javascript',
  'application/json',
  'text/csv',
  'text/xml',
  'application/xml',
  'text/markdown',
]);

async function driveFetch(credentials, url, options = {}) {
  const fresh = await getFreshCreds(credentials);
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${fresh.accessToken}`,
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      `Drive API error (${response.status}): ${errorBody.error?.message ?? JSON.stringify(errorBody)}`,
    );
  }

  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') ?? '';
  return contentType.includes('json') ? response.json() : response.text();
}

export async function getStorageQuota(credentials) {
  const data = await driveFetch(
    credentials,
    `${DRIVE_BASE}/about?fields=storageQuota,user`,
  );
  return { quota: data.storageQuota, email: data.user?.emailAddress };
}

export async function listFiles(credentials, { folderId, pageSize = 20, orderBy = 'modifiedTime desc', mimeType } = {}) {
  const conditions = ['trashed=false'];
  if (folderId) conditions.push(`'${folderId}' in parents`);
  if (mimeType) conditions.push(`mimeType='${mimeType}'`);

  const params = new URLSearchParams({
    q: conditions.join(' and '),
    pageSize: String(Math.min(pageSize, 100)),
    orderBy,
    fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink,parents)',
  });

  const data = await driveFetch(credentials, `${DRIVE_BASE}/files?${params}`);
  return data.files ?? [];
}

export async function searchFiles(credentials, query, maxResults = 20) {
  const escaped = String(query ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const params = new URLSearchParams({
    q: `(name contains '${escaped}' or fullText contains '${escaped}') and trashed=false`,
    pageSize: String(Math.min(maxResults, 50)),
    fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink)',
    orderBy: 'modifiedTime desc',
  });

  const data = await driveFetch(credentials, `${DRIVE_BASE}/files?${params}`);
  return data.files ?? [];
}

export async function getFileMetadata(credentials, fileId) {
  return driveFetch(
    credentials,
    `${DRIVE_BASE}/files/${fileId}?fields=id,name,mimeType,size,modifiedTime,createdTime,webViewLink,parents,owners,description,shared`,
  );
}

export async function getFileContent(credentials, fileId) {
  const metadata = await getFileMetadata(credentials, fileId);
  const exportConfig = EXPORT_MIMES[metadata.mimeType];

  if (exportConfig) {
    const fresh = await getFreshCreds(credentials);
    const response = await fetch(
      `${DRIVE_BASE}/files/${fileId}/export?mimeType=${encodeURIComponent(exportConfig.mime)}`,
      {
        headers: { Authorization: `Bearer ${fresh.accessToken}` },
      },
    );
    if (!response.ok) throw new Error(`Export failed (${response.status})`);
    const text = await response.text();
    return {
      meta: metadata,
      content: text.slice(0, MAX_CONTENT_CHARS),
      truncated: text.length > MAX_CONTENT_CHARS,
      isGoogleWorkspace: true,
    };
  }

  if (TEXT_MIMES.has(metadata.mimeType) || metadata.mimeType?.startsWith('text/')) {
    const fresh = await getFreshCreds(credentials);
    const response = await fetch(`${DRIVE_BASE}/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${fresh.accessToken}` },
    });
    if (!response.ok) throw new Error(`Download failed (${response.status})`);
    const text = await response.text();
    return {
      meta: metadata,
      content: text.slice(0, MAX_CONTENT_CHARS),
      truncated: text.length > MAX_CONTENT_CHARS,
      isGoogleWorkspace: false,
    };
  }

  return { meta: metadata, content: null, binaryFile: true, isGoogleWorkspace: false };
}

export async function createFile(credentials, name, content, mimeType = 'text/plain', folderId = null) {
  const fresh = await getFreshCreds(credentials);
  const metadata = { name, mimeType, ...(folderId ? { parents: [folderId] } : {}) };
  const boundary = 'joanium_drive_boundary';
  const body = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    JSON.stringify(metadata),
    `\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
    content,
    `\r\n--${boundary}--`,
  ].join('');

  const response = await fetch(
    `${UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,webViewLink,mimeType`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${fresh.accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(`Drive create failed (${response.status}): ${errorBody.error?.message ?? ''}`);
  }

  return response.json();
}

export async function updateFileContent(credentials, fileId, content, mimeType = 'text/plain') {
  const fresh = await getFreshCreds(credentials);
  const response = await fetch(`${UPLOAD_BASE}/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${fresh.accessToken}`,
      'Content-Type': mimeType,
    },
    body: content,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(`Drive update failed (${response.status}): ${errorBody.error?.message ?? ''}`);
  }

  return response.json();
}

export async function listFolders(credentials, maxResults = 20) {
  const params = new URLSearchParams({
    q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
    pageSize: String(Math.min(maxResults, 50)),
    orderBy: 'name',
    fields: 'files(id,name,parents)',
  });

  const data = await driveFetch(credentials, `${DRIVE_BASE}/files?${params}`);
  return data.files ?? [];
}
