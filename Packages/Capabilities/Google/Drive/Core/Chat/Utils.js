export function formatSize(bytes) {
  if (null == bytes) return 'unknown size';
  const value = Number(bytes);
  return value >= 1073741824
    ? `${(value / 1073741824).toFixed(2)} GB`
    : value >= 1048576
      ? `${(value / 1048576).toFixed(1)} MB`
      : value >= 1024
        ? `${(value / 1024).toFixed(0)} KB`
        : `${value} B`;
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
  return (
    {
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
    }[mimeType] ??
    mimeType.split('/').pop() ??
    'File'
  );
}
