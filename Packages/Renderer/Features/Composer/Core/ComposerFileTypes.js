export const FILE_TYPES = {
  // Images
  image: { icon: '🖼️', color: '#7c5dff', label: 'Image' },

  // Data
  json:  { icon: '{}',   color: '#f59e0b', label: 'JSON' },
  csv:   { icon: '⊞',    color: '#22c55e', label: 'CSV' },
  tsv:   { icon: '⊟',    color: '#22c55e', label: 'TSV' },
  yaml:  { icon: '≡',    color: '#06b6d4', label: 'YAML' },
  yml:   { icon: '≡',    color: '#06b6d4', label: 'YAML' },
  toml:  { icon: '⚙',    color: '#8b5cf6', label: 'TOML' },
  xml:   { icon: '</>',  color: '#f97316', label: 'XML' },
  pdf:   { icon: 'PDF',  color: '#ef4444', label: 'PDF' },
  docx:  { icon: 'DOC',  color: '#2563eb', label: 'Word' },
  xlsx:  { icon: 'XLS',  color: '#16a34a', label: 'Excel' },
  xls:   { icon: 'XLS',  color: '#16a34a', label: 'Excel' },
  xlsm:  { icon: 'XLS',  color: '#16a34a', label: 'Excel Macro' },
  xlsb:  { icon: 'XLS',  color: '#16a34a', label: 'Excel Binary' },
  ods:   { icon: 'ODS',  color: '#16a34a', label: 'Spreadsheet' },
  pptx:  { icon: 'PPT',  color: '#ea580c', label: 'PowerPoint' },

  // Code
  js:    { icon: 'JS',   color: '#f7df1e', label: 'JavaScript', dark: true },
  ts:    { icon: 'TS',   color: '#3178c6', label: 'TypeScript' },
  jsx:   { icon: 'JSX',  color: '#61dafb', label: 'React', dark: true },
  tsx:   { icon: 'TSX',  color: '#61dafb', label: 'React TS', dark: true },
  py:    { icon: 'PY',   color: '#3776ab', label: 'Python' },
  rb:    { icon: 'RB',   color: '#cc342d', label: 'Ruby' },
  go:    { icon: 'GO',   color: '#00add8', label: 'Go' },
  rs:    { icon: 'RS',   color: '#ce422b', label: 'Rust' },
  java:  { icon: '♨',    color: '#ed8b00', label: 'Java' },
  cs:    { icon: 'C#',   color: '#68217a', label: 'C#' },
  cpp:   { icon: 'C++',  color: '#00589d', label: 'C++' },
  c:     { icon: 'C',    color: '#00589d', label: 'C' },
  php:   { icon: 'PHP',  color: '#777bb4', label: 'PHP' },
  sh:    { icon: '$_',   color: '#1d1f21', label: 'Shell' },
  sql:   { icon: '⊡',    color: '#4479a1', label: 'SQL' },

  // Markup / config
  html:  { icon: 'HTML', color: '#e34f26', label: 'HTML' },
  css:   { icon: 'CSS',  color: '#1572b6', label: 'CSS' },
  scss:  { icon: 'SCSS', color: '#cf649a', label: 'SCSS' },
  md:    { icon: '↓',    color: '#083fa1', label: 'Markdown' },
  mdx:   { icon: '↓',    color: '#083fa1', label: 'MDX' },

  // Text
  txt:   { icon: '📄',   color: '#6b7280', label: 'Text' },
  log:   { icon: '📋',   color: '#6b7280', label: 'Log' },
  env:   { icon: '🔑',   color: '#10b981', label: 'Env' },
  rtf:   { icon: 'RTF',  color: '#6366f1', label: 'Rich Text' },
};

export const DIRECT_TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'mdx', 'log', 'env', 'json', 'csv', 'tsv', 'yaml', 'yml',
  'toml', 'xml', 'html', 'css', 'scss', 'less', 'js', 'ts', 'jsx', 'tsx',
  'py', 'rb', 'go', 'rs', 'java', 'cs', 'cpp', 'c', 'h', 'hpp', 'php',
  'sql', 'graphql', 'gql', 'sh', 'bash', 'zsh', 'ps1', 'vue', 'svelte',
  'astro', 'rtf',
]);

export const EXTRACTABLE_BINARY_EXTENSIONS = new Set([
  'pdf', 'docx', 'xlsx', 'xlsm', 'pptx',
]);

export const DIRECT_TEXT_MAX_SIZE = 2 * 1024 * 1024;
export const EXTRACTABLE_BINARY_MAX_SIZE = 10 * 1024 * 1024;

export function getFileTypeMeta(filename) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'txt';
  return FILE_TYPES[ext] ?? { icon: '📄', color: '#6b7280', label: ext.toUpperCase() };
}

export function isTextLikeMime(mime = '') {
  const lower = String(mime || '').toLowerCase();
  return (
    lower.startsWith('text/') ||
    lower.includes('json') ||
    lower.includes('xml') ||
    lower.includes('yaml') ||
    lower.includes('javascript')
  );
}

export function isExtractableBinary(ext, mime = '') {
  if (EXTRACTABLE_BINARY_EXTENSIONS.has(ext)) return true;
  const lower = String(mime || '').toLowerCase();
  return (
    lower === 'application/pdf' ||
    lower.includes('wordprocessingml.document') ||
    lower.includes('spreadsheetml.sheet') ||
    lower.includes('sheet.macroenabled.12') ||
    lower.includes('presentationml.presentation')
  );
}
