async function getFreshGoogleCreds(creds) {
  const { getFreshCreds: getFreshCreds } = await import('../../../GoogleWorkspace.js');
  return getFreshCreds(creds);
}
const DRIVE_BASE = 'https://www.googleapis.com/drive/v3',
  UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3',
  EXPORT_MIMES = {
    'application/vnd.google-apps.document': { mime: 'text/plain', ext: 'txt' },
    'application/vnd.google-apps.spreadsheet': { mime: 'text/csv', ext: 'csv' },
    'application/vnd.google-apps.presentation': { mime: 'text/plain', ext: 'txt' },
    'application/vnd.google-apps.drawing': { mime: 'image/svg+xml', ext: 'svg' },
  },
  TEXT_MIMES = new Set([
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
  const fresh = await getFreshGoogleCreds(credentials),
    response = await fetch(url, {
      ...options,
      headers: { Authorization: `Bearer ${fresh.accessToken}`, ...(options.headers ?? {}) },
    });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      `Drive API error (${response.status}): ${errorBody.error?.message ?? JSON.stringify(errorBody)}`,
    );
  }
  return 204 === response.status
    ? null
    : (response.headers.get('content-type') ?? '').includes('json')
      ? response.json()
      : response.text();
}
export async function getStorageQuota(credentials) {
  const data = await driveFetch(credentials, `${DRIVE_BASE}/about?fields=storageQuota,user`);
  return { quota: data.storageQuota, email: data.user?.emailAddress };
}
export async function listFiles(
  credentials,
  {
    folderId: folderId,
    pageSize: pageSize = 20,
    orderBy: orderBy = 'modifiedTime desc',
    mimeType: mimeType,
  } = {},
) {
  const conditions = ['trashed=false'];
  (folderId && conditions.push(`'${folderId}' in parents`),
    mimeType && conditions.push(`mimeType='${mimeType}'`));
  const params = new URLSearchParams({
    q: conditions.join(' and '),
    pageSize: String(Math.min(pageSize, 100)),
    orderBy: orderBy,
    fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink,parents)',
  });
  return (await driveFetch(credentials, `${DRIVE_BASE}/files?${params}`)).files ?? [];
}
export async function searchFiles(credentials, query, maxResults = 20) {
  const escaped = String(query ?? '')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'"),
    params = new URLSearchParams({
      q: `(name contains '${escaped}' or fullText contains '${escaped}') and trashed=false`,
      pageSize: String(Math.min(maxResults, 50)),
      fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink)',
      orderBy: 'modifiedTime desc',
    });
  return (await driveFetch(credentials, `${DRIVE_BASE}/files?${params}`)).files ?? [];
}
export async function getFileMetadata(credentials, fileId) {
  return driveFetch(
    credentials,
    `${DRIVE_BASE}/files/${fileId}?fields=id,name,mimeType,size,modifiedTime,createdTime,webViewLink,parents,owners,description,shared`,
  );
}
export async function getFileContent(credentials, fileId) {
  const metadata = await getFileMetadata(credentials, fileId),
    exportConfig = EXPORT_MIMES[metadata.mimeType];
  if (exportConfig) {
    const fresh = await getFreshGoogleCreds(credentials),
      response = await fetch(
        `${DRIVE_BASE}/files/${fileId}/export?mimeType=${encodeURIComponent(exportConfig.mime)}`,
        { headers: { Authorization: `Bearer ${fresh.accessToken}` } },
      );
    if (!response.ok) throw new Error(`Export failed (${response.status})`);
    const text = await response.text();
    return {
      meta: metadata,
      content: text.slice(0, 3e4),
      truncated: text.length > 3e4,
      isGoogleWorkspace: !0,
    };
  }
  if (TEXT_MIMES.has(metadata.mimeType) || metadata.mimeType?.startsWith('text/')) {
    const fresh = await getFreshGoogleCreds(credentials),
      response = await fetch(`${DRIVE_BASE}/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${fresh.accessToken}` },
      });
    if (!response.ok) throw new Error(`Download failed (${response.status})`);
    const text = await response.text();
    return {
      meta: metadata,
      content: text.slice(0, 3e4),
      truncated: text.length > 3e4,
      isGoogleWorkspace: !1,
    };
  }
  return { meta: metadata, content: null, binaryFile: !0, isGoogleWorkspace: !1 };
}
export async function createFile(
  credentials,
  name,
  content,
  mimeType = 'text/plain',
  folderId = null,
) {
  const fresh = await getFreshGoogleCreds(credentials),
    metadata = { name: name, mimeType: mimeType, ...(folderId ? { parents: [folderId] } : {}) },
    boundary = 'joanium_drive_boundary',
    body = [
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
      JSON.stringify(metadata),
      `\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
      content,
      `\r\n--${boundary}--`,
    ].join(''),
    response = await fetch(
      `${UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,webViewLink,mimeType`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${fresh.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: body,
      },
    );
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(`Drive create failed (${response.status}): ${errorBody.error?.message ?? ''}`);
  }
  return response.json();
}
export async function updateFileContent(credentials, fileId, content, mimeType = 'text/plain') {
  const fresh = await getFreshGoogleCreds(credentials),
    response = await fetch(`${UPLOAD_BASE}/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${fresh.accessToken}`, 'Content-Type': mimeType },
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
  return (await driveFetch(credentials, `${DRIVE_BASE}/files?${params}`)).files ?? [];
}
