export function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
export function typeLabel(type) {
  return (
    {
      RADIO: 'Multiple choice',
      CHECKBOX: 'Checkboxes',
      DROP_DOWN: 'Dropdown',
      TEXT: 'Short/long answer',
      SCALE: 'Linear scale',
      DATE: 'Date',
      TIME: 'Time',
      FILE_UPLOAD: 'File upload',
      PAGE_BREAK: 'Page break',
      SECTION_TEXT: 'Section header',
      IMAGE: 'Image',
      VIDEO: 'Video',
      QUESTION_GROUP: 'Grid',
      UNKNOWN: 'Unknown',
    }[type] ?? type
  );
}
export function csvEscape(value) {
  const str = String(value ?? '');
  return str.includes(',') || str.includes('"') || str.includes('\n')
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}
export function median(sorted) {
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 != 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
