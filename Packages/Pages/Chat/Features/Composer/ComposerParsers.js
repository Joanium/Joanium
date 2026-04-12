export function enrichFileContent(filename, rawText) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return 'csv' === ext || 'tsv' === ext
    ? (function (text, delimiter = ',') {
        try {
          const lines = text.trim().split('\n');
          if (!lines.length) return text;
          const headers = parseCSVLine(lines[0], delimiter),
            dataRows = lines.slice(1).filter((l) => l.trim()),
            colStats = headers.map((h, i) => {
              const vals = dataRows
                  .map((r) => parseCSVLine(r, delimiter)[i] ?? '')
                  .filter((v) => '' !== v),
                nums = vals.map(Number).filter((n) => !isNaN(n));
              return nums.length > vals.length / 2
                ? `${h} (numeric: min=${Math.min(...nums).toFixed(2)}, max=${Math.max(...nums).toFixed(2)}, avg=${(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2)})`
                : `${h} (${new Set(vals).size} unique values)`;
            }),
            preview = [lines[0], ...dataRows.slice(0, 5)].join('\n'),
            note = dataRows.length > 5 ? `\n…(${dataRows.length - 5} more rows)` : '';
          return [
            `[CSV: ${dataRows.length} rows × ${headers.length} columns]`,
            `Columns: ${colStats.join(' | ')}`,
            '',
            preview + note,
          ].join('\n');
        } catch {
          return text;
        }
      })(rawText, 'tsv' === ext ? '\t' : ',')
    : 'json' === ext
      ? (function (text) {
          try {
            const parsed = JSON.parse(text),
              topLevelKeys = Array.isArray(parsed)
                ? Object.keys(parsed[0] || {}).slice(0, 10)
                : Object.keys(parsed).slice(0, 10),
              note = `[JSON: ${Array.isArray(parsed) ? `Array[${parsed.length}]` : 'Object'}, keys: ${topLevelKeys.join(', ')}${10 === topLevelKeys.length ? '…' : ''}]`,
              preview = JSON.stringify(parsed, null, 2).slice(0, 2e3);
            return `${note}\n\n${text.length > 2e3 ? preview + '\n…(truncated)' : preview}`;
          } catch {
            return text;
          }
        })(rawText)
      : 'yaml' === ext || 'yml' === ext
        ? (function (text) {
            const note = `[YAML: top-level keys: ${
                text
                  .split('\n')
                  .filter((l) => l.trim() && !l.trim().startsWith('#'))
                  .filter((l) => /^[a-zA-Z0-9_-]+:/.test(l))
                  .slice(0, 8)
                  .map((l) => l.split(':')[0].trim())
                  .join(', ') || 'unknown'
              }]`,
              preview = text.slice(0, 2e3);
            return `${note}\n\n${text.length > 2e3 ? preview + '\n…(truncated)' : preview}`;
          })(rawText)
        : rawText;
}
export function parseCSVLine(line, delimiter = ',') {
  const result = [];
  let current = '',
    inQuotes = !1;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    '"' === ch
      ? (inQuotes = !inQuotes)
      : ch !== delimiter || inQuotes
        ? (current += ch)
        : (result.push(current.trim()), (current = ''));
  }
  return (result.push(current.trim()), result);
}
