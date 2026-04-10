export function formatSize(bytes) {
  if (bytes == null) return 'unknown size';
  const value = Number(bytes);
  if (value >= 1_073_741_824) return `${(value / 1_073_741_824).toFixed(2)} GB`;
  if (value >= 1_048_576) return `${(value / 1_048_576).toFixed(1)} MB`;
  if (value >= 1_024) return `${(value / 1_024).toFixed(0)} KB`;
  return `${value} B`;
}

export function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function mimeLabel(mimeType = '') {
  const map = {
    'application/vnd.google-apps.document': 'Google Doc',
    'application/vnd.google-apps.spreadsheet': 'Google Sheet',
    'application/vnd.google-apps.presentation': 'Google Slides',
    'application/vnd.google-apps.folder': 'Folder',
    'application/pdf': 'PDF',
    'text/plain': 'Text',
    'text/csv': 'CSV',
    'application/json': 'JSON',
    'image/jpeg': 'Image (JPEG)',
    'image/png': 'Image (PNG)',
  };
  return map[mimeType] ?? mimeType.split('/').pop() ?? 'File';
}
