import fs from 'fs';
import path from 'path';

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'mdx', 'log', 'env', 'json', 'csv', 'tsv', 'yaml', 'yml',
  'toml', 'xml', 'html', 'css', 'scss', 'less', 'js', 'ts', 'jsx', 'tsx',
  'py', 'rb', 'go', 'rs', 'java', 'cs', 'cpp', 'c', 'h', 'hpp', 'php',
  'sql', 'graphql', 'gql', 'sh', 'bash', 'zsh', 'ps1', 'vue', 'svelte',
  'astro', 'ini', 'cfg', 'conf', 'rtf',
]);

const DOCUMENT_EXTENSIONS = new Set([
  ...TEXT_EXTENSIONS,
  'pdf', 'docx', 'xlsx', 'xls', 'xlsm', 'xlsb', 'ods', 'pptx',
]);

const MAX_EXTRACTED_CHARS = 120_000;
const MAX_SHEETS = 6;
const MAX_ROWS_PER_SHEET = 40;
const MAX_SLIDES = 40;

let _pdfParseModule = null;
let _mammothModule = null;
let _xlsxModule = null;
let _jszipModule = null;

function getExtension(fileName = '') {
  return String(fileName)
    .split('.')
    .pop()
    ?.trim()
    .toLowerCase() ?? '';
}

function toBuffer(data) {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }
  if (Array.isArray(data)) return Buffer.from(data);
  throw new Error('Unsupported binary payload.');
}

function countLines(text = '') {
  return text ? text.split(/\r?\n/).length : 0;
}

function truncateText(text = '', maxChars = MAX_EXTRACTED_CHARS) {
  const normalized = String(text ?? '').replace(/\r\n/g, '\n').trim();
  if (normalized.length <= maxChars) {
    return { text: normalized, truncated: false };
  }

  return {
    text: `${normalized.slice(0, maxChars)}\n\n...(truncated for context)`,
    truncated: true,
  };
}

function decodeXmlEntities(text = '') {
  return String(text).replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (_match, entity) => {
    switch (entity) {
      case 'amp': return '&';
      case 'lt': return '<';
      case 'gt': return '>';
      case 'quot': return '"';
      case 'apos': return "'";
      default: {
        if (entity.startsWith('#x')) {
          return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
        }
        if (entity.startsWith('#')) {
          return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
        }
        return '';
      }
    }
  });
}

function stripRtf(text = '') {
  return String(text)
    .replace(/\\par[d]?/g, '\n')
    .replace(/\\tab/g, '\t')
    .replace(/\\'[0-9a-fA-F]{2}/g, '')
    .replace(/\\[a-zA-Z]+-?\d* ?/g, '')
    .replace(/[{}]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildResult({ kind, summary, text, warnings = [] }) {
  const { text: truncatedText, truncated } = truncateText(text);
  if (!truncatedText.trim()) {
    throw new Error('No readable text could be extracted from this file.');
  }

  return {
    kind,
    summary,
    text: truncatedText,
    lines: countLines(truncatedText),
    truncated,
    warnings,
  };
}

async function getPdfParse() {
  if (!_pdfParseModule) {
    _pdfParseModule = await import('pdf-parse');
  }
  return _pdfParseModule;
}

async function getMammoth() {
  if (!_mammothModule) {
    _mammothModule = await import('mammoth');
  }
  return _mammothModule.default ?? _mammothModule;
}

async function getXlsx() {
  if (!_xlsxModule) {
    _xlsxModule = await import('xlsx');
  }
  return _xlsxModule;
}

async function getJszip() {
  if (!_jszipModule) {
    _jszipModule = await import('jszip');
  }
  return _jszipModule.default ?? _jszipModule;
}

function extractTextLike(buffer, ext) {
  const decoded = new TextDecoder('utf-8').decode(buffer);
  const text = ext === 'rtf' ? stripRtf(decoded) : decoded;
  const summary = ext === 'rtf'
    ? 'RTF document'
    : `${ext.toUpperCase() || 'Text'} file`;

  return buildResult({
    kind: ext || 'text',
    summary,
    text,
  });
}

async function extractPdf(buffer) {
  const { PDFParse } = await getPdfParse();
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    return buildResult({
      kind: 'pdf',
      summary: `${result.total || result.pages?.length || '?'} pages`,
      text: result.text || '',
    });
  } finally {
    try { await parser.destroy(); } catch { /* ignore */ }
  }
}

async function extractDocx(buffer) {
  const mammoth = await getMammoth();
  const result = await mammoth.extractRawText({ buffer });
  const paragraphCount = result.value
    .split(/\n{2,}/)
    .map(part => part.trim())
    .filter(Boolean)
    .length;

  return buildResult({
    kind: 'docx',
    summary: `${paragraphCount || countLines(result.value)} paragraphs`,
    text: result.value || '',
    warnings: (result.messages ?? []).map(message => message.message || String(message)),
  });
}

async function extractSpreadsheet(buffer) {
  const XLSX = await getXlsx();
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sections = [];

  for (const sheetName of workbook.SheetNames.slice(0, MAX_SHEETS)) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false }).trim();
    if (!csv) continue;

    const rows = csv.split(/\r?\n/).filter(Boolean);
    const preview = rows.slice(0, MAX_ROWS_PER_SHEET).join('\n');
    const remaining = rows.length > MAX_ROWS_PER_SHEET
      ? `\n...(truncated ${rows.length - MAX_ROWS_PER_SHEET} more rows)`
      : '';

    sections.push(`## Sheet: ${sheetName}\n${preview}${remaining}`);
  }

  return buildResult({
    kind: 'spreadsheet',
    summary: `${workbook.SheetNames.length} sheet${workbook.SheetNames.length !== 1 ? 's' : ''}`,
    text: sections.join('\n\n'),
  });
}

function naturalSlideSort(a, b) {
  const aNum = Number.parseInt(a.match(/slide(\d+)\.xml$/i)?.[1] ?? '0', 10);
  const bNum = Number.parseInt(b.match(/slide(\d+)\.xml$/i)?.[1] ?? '0', 10);
  return aNum - bNum;
}

async function extractPptx(buffer) {
  const JSZip = await getJszip();
  const zip = await JSZip.loadAsync(buffer);
  const slideNames = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort(naturalSlideSort)
    .slice(0, MAX_SLIDES);

  const slides = [];

  for (let index = 0; index < slideNames.length; index++) {
    const name = slideNames[index];
    const xml = await zip.file(name)?.async('string');
    if (!xml) continue;

    const chunks = [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)]
      .map(match => decodeXmlEntities(match[1]))
      .map(text => text.trim())
      .filter(Boolean);

    if (!chunks.length) continue;
    slides.push(`## Slide ${index + 1}\n${chunks.join('\n')}`);
  }

  return buildResult({
    kind: 'pptx',
    summary: `${slideNames.length} slide${slideNames.length !== 1 ? 's' : ''}`,
    text: slides.join('\n\n'),
  });
}

export function supportsDocumentExtraction(fileName = '', mimeType = '') {
  const ext = getExtension(fileName);
  if (DOCUMENT_EXTENSIONS.has(ext)) return true;

  return [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.ms-excel.sheet.macroEnabled.12',
    'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ].includes(String(mimeType || '').toLowerCase());
}

export async function extractDocumentTextFromBuffer({ fileName = '', mimeType = '', buffer }) {
  const payload = toBuffer(buffer);
  const ext = getExtension(fileName);

  if (TEXT_EXTENSIONS.has(ext)) return extractTextLike(payload, ext);
  if (ext === 'pdf') return extractPdf(payload);
  if (ext === 'docx') return extractDocx(payload);
  if (['xlsx', 'xls', 'xlsm', 'xlsb', 'ods'].includes(ext)) return extractSpreadsheet(payload);
  if (ext === 'pptx') return extractPptx(payload);

  const lowerMime = String(mimeType || '').toLowerCase();
  if (lowerMime === 'application/pdf') return extractPdf(payload);
  if (lowerMime.includes('wordprocessingml.document')) return extractDocx(payload);
  if (lowerMime.includes('spreadsheetml.sheet') || lowerMime.includes('ms-excel') || lowerMime.includes('opendocument.spreadsheet')) {
    return extractSpreadsheet(payload);
  }
  if (lowerMime.includes('presentationml.presentation')) return extractPptx(payload);

  throw new Error(`Unsupported file type for text extraction: ${fileName || mimeType || 'unknown file'}`);
}

export async function extractDocumentTextFromPath(filePath) {
  const resolved = path.resolve(filePath);
  const stat = fs.statSync(resolved);
  if (!stat.isFile()) {
    throw new Error(`"${resolved}" is not a file.`);
  }

  return extractDocumentTextFromBuffer({
    fileName: path.basename(resolved),
    buffer: fs.readFileSync(resolved),
  });
}
