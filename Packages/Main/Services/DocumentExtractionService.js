import fs from 'fs';
import path from 'path';
const TEXT_EXTENSIONS = new Set([
    'txt',
    'md',
    'mdx',
    'log',
    'env',
    'json',
    'csv',
    'tsv',
    'yaml',
    'yml',
    'toml',
    'xml',
    'html',
    'css',
    'scss',
    'less',
    'js',
    'ts',
    'jsx',
    'tsx',
    'py',
    'rb',
    'go',
    'rs',
    'java',
    'cs',
    'cpp',
    'c',
    'h',
    'hpp',
    'php',
    'sql',
    'graphql',
    'gql',
    'sh',
    'bash',
    'zsh',
    'ps1',
    'vue',
    'svelte',
    'astro',
    'ini',
    'cfg',
    'conf',
    'rtf',
  ]),
  SPREADSHEET_EXTENSIONS = new Set(['xlsx', 'xlsm']),
  DOCUMENT_EXTENSIONS = new Set([
    ...TEXT_EXTENSIONS,
    'pdf',
    'docx',
    ...SPREADSHEET_EXTENSIONS,
    'pptx',
  ]);
let _pdfParseModule = null,
  _mammothModule = null,
  _excelJsModule = null,
  _jszipModule = null;
function getExtension(fileName = '') {
  return String(fileName).split('.').pop()?.trim().toLowerCase() ?? '';
}
function countLines(text = '') {
  return text ? text.split(/\r?\n/).length : 0;
}
function decodeXmlEntities(text = '') {
  return String(text).replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (_match, entity) => {
    switch (entity) {
      case 'amp':
        return '&';
      case 'lt':
        return '<';
      case 'gt':
        return '>';
      case 'quot':
        return '"';
      case 'apos':
        return "'";
      default:
        return entity.startsWith('#x')
          ? String.fromCodePoint(Number.parseInt(entity.slice(2), 16))
          : entity.startsWith('#')
            ? String.fromCodePoint(Number.parseInt(entity.slice(1), 10))
            : '';
    }
  });
}
function buildResult({ kind: kind, summary: summary, text: text, warnings: warnings = [] }) {
  const { text: truncatedText, truncated: truncated } = (function (text = '', maxChars = 12e4) {
    const normalized = String(text ?? '')
      .replace(/\r\n/g, '\n')
      .trim();
    return normalized.length <= maxChars
      ? { text: normalized, truncated: !1 }
      : { text: `${normalized.slice(0, maxChars)}\n\n...(truncated for context)`, truncated: !0 };
  })(text);
  if (!truncatedText.trim()) throw new Error('No readable text could be extracted from this file.');
  return {
    kind: kind,
    summary: summary,
    text: truncatedText,
    lines: countLines(truncatedText),
    truncated: truncated,
    warnings: warnings,
  };
}
async function extractPdf(buffer) {
  const { PDFParse: PDFParse } = await (async function () {
      return (_pdfParseModule || (_pdfParseModule = await import('pdf-parse')), _pdfParseModule);
    })(),
    parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return buildResult({
      kind: 'pdf',
      summary: `${result.total || result.pages?.length || '?'} pages`,
      text: result.text || '',
    });
  } finally {
    try {
      await parser.destroy();
    } catch {}
  }
}
async function extractDocx(buffer) {
  const mammoth = await (async function () {
      return (
        _mammothModule || (_mammothModule = await import('mammoth')),
        _mammothModule.default ?? _mammothModule
      );
    })(),
    result = await mammoth.extractRawText({ buffer: buffer });
  return buildResult({
    kind: 'docx',
    summary: `${
      result.value
        .split(/\n{2,}/)
        .map((part) => part.trim())
        .filter(Boolean).length || countLines(result.value)
    } paragraphs`,
    text: result.value || '',
    warnings: (result.messages ?? []).map((message) => message.message || String(message)),
  });
}
function serializeWorksheetRow(row) {
  const cells = [];
  for (let column = 1; column <= row.cellCount; column += 1)
    cells.push(row.getCell(column).toCsvString());
  for (; cells.length && !cells.at(-1); ) cells.pop();
  return cells.join(',');
}
async function extractSpreadsheet(buffer) {
  const workbook = new (
    await (async function () {
      return (
        _excelJsModule || (_excelJsModule = await import('exceljs')),
        _excelJsModule.default ?? _excelJsModule
      );
    })()
  ).Workbook();
  await workbook.xlsx.load(buffer);
  const sections = [];
  for (const worksheet of workbook.worksheets.slice(0, 6)) {
    const previewRows = [];
    let rowCount = 0;
    if (
      (worksheet.eachRow({ includeEmpty: !1 }, (row) => {
        const csvLine = serializeWorksheetRow(row);
        csvLine.trim() && ((rowCount += 1), previewRows.length < 40 && previewRows.push(csvLine));
      }),
      !rowCount)
    )
      continue;
    const remaining = rowCount > 40 ? `\n...(truncated ${rowCount - 40} more rows)` : '';
    sections.push(`## Sheet: ${worksheet.name}\n${previewRows.join('\n')}${remaining}`);
  }
  return buildResult({
    kind: 'spreadsheet',
    summary: `${workbook.worksheets.length} sheet${1 !== workbook.worksheets.length ? 's' : ''}`,
    text: sections.join('\n\n'),
  });
}
function naturalSlideSort(a, b) {
  return (
    Number.parseInt(a.match(/slide(\d+)\.xml$/i)?.[1] ?? '0', 10) -
    Number.parseInt(b.match(/slide(\d+)\.xml$/i)?.[1] ?? '0', 10)
  );
}
async function extractPptx(buffer) {
  const JSZip = await (async function () {
      return (
        _jszipModule || (_jszipModule = await import('jszip')),
        _jszipModule.default ?? _jszipModule
      );
    })(),
    zip = await JSZip.loadAsync(buffer),
    slideNames = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort(naturalSlideSort)
      .slice(0, 40),
    slides = [];
  for (let index = 0; index < slideNames.length; index++) {
    const name = slideNames[index],
      xml = await zip.file(name)?.async('string');
    if (!xml) continue;
    const chunks = [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)]
      .map((match) => decodeXmlEntities(match[1]))
      .map((text) => text.trim())
      .filter(Boolean);
    chunks.length && slides.push(`## Slide ${index + 1}\n${chunks.join('\n')}`);
  }
  return buildResult({
    kind: 'pptx',
    summary: `${slideNames.length} slide${1 !== slideNames.length ? 's' : ''}`,
    text: slides.join('\n\n'),
  });
}
function isSupportedSpreadsheetMime(mimeType = '') {
  const lowerMime = String(mimeType || '').toLowerCase();
  return lowerMime.includes('spreadsheetml.sheet') || lowerMime.includes('sheet.macroenabled.12');
}
export function supportsDocumentExtraction(fileName = '', mimeType = '') {
  const ext = getExtension(fileName);
  if (DOCUMENT_EXTENSIONS.has(ext)) return !0;
  const lowerMime = String(mimeType || '').toLowerCase();
  return (
    !!isSupportedSpreadsheetMime(lowerMime) ||
    [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ].includes(lowerMime)
  );
}
export async function extractDocumentTextFromBuffer({
  fileName: fileName = '',
  mimeType: mimeType = '',
  buffer: buffer,
}) {
  const payload = (function (data) {
      if (Buffer.isBuffer(data)) return data;
      if (data instanceof ArrayBuffer) return Buffer.from(data);
      if (ArrayBuffer.isView(data))
        return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
      if (Array.isArray(data)) return Buffer.from(data);
      throw new Error('Unsupported binary payload.');
    })(buffer),
    ext = getExtension(fileName);
  if (TEXT_EXTENSIONS.has(ext))
    return (function (buffer, ext) {
      const decoded = new TextDecoder('utf-8').decode(buffer),
        text =
          'rtf' === ext
            ? (function (text = '') {
                return String(text)
                  .replace(/\\par[d]?/g, '\n')
                  .replace(/\\tab/g, '\t')
                  .replace(/\\'[0-9a-fA-F]{2}/g, '')
                  .replace(/\\[a-zA-Z]+-?\d* ?/g, '')
                  .replace(/[{}]/g, '')
                  .replace(/\n{3,}/g, '\n\n')
                  .trim();
              })(decoded)
            : decoded,
        summary = 'rtf' === ext ? 'RTF document' : `${ext.toUpperCase() || 'Text'} file`;
      return buildResult({ kind: ext || 'text', summary: summary, text: text });
    })(payload, ext);
  if ('pdf' === ext) return extractPdf(payload);
  if ('docx' === ext) return extractDocx(payload);
  if (SPREADSHEET_EXTENSIONS.has(ext)) return extractSpreadsheet(payload);
  if ('pptx' === ext) return extractPptx(payload);
  const lowerMime = String(mimeType || '').toLowerCase();
  if ('application/pdf' === lowerMime) return extractPdf(payload);
  if (lowerMime.includes('wordprocessingml.document')) return extractDocx(payload);
  if (isSupportedSpreadsheetMime(lowerMime)) return extractSpreadsheet(payload);
  if (lowerMime.includes('presentationml.presentation')) return extractPptx(payload);
  throw new Error(
    `Unsupported file type for text extraction: ${fileName || mimeType || 'unknown file'}`,
  );
}
export async function extractDocumentTextFromPath(filePath) {
  const resolved = path.resolve(filePath);
  // Open once — fstatSync and readFileSync both operate on the same fd,
  // eliminating the TOCTOU window between the isFile check and the read (CWE-367).
  const fd = fs.openSync(resolved, 'r');
  try {
    if (!fs.fstatSync(fd).isFile()) throw new Error(`"${resolved}" is not a file.`);
    return extractDocumentTextFromBuffer({
      fileName: path.basename(resolved),
      buffer: fs.readFileSync(fd),
    });
  } finally {
    fs.closeSync(fd);
  }
}
