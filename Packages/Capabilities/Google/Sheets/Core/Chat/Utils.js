export function parseValues(raw) {
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('Values must be a 2D array');
    return parsed;
  } catch {
    throw new Error('values must be a valid JSON 2D array, e.g. [["Name","Age"],["Alice",30]]');
  }
}
export function parseJSON(raw, label) {
  if ('object' == typeof raw && null !== raw) return raw;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${label} must be valid JSON`);
  }
}
export function renderTable(values) {
  if (!values.length) return '(empty)';
  const rows = values.map((row) =>
      (Array.isArray(row) ? row : []).map((cell) => String(cell ?? '')),
    ),
    colWidths = rows.reduce(
      (widths, row) => (
        row.forEach((cell, i) => {
          widths[i] = Math.min(Math.max(widths[i] ?? 0, cell.length), 30);
        }),
        widths
      ),
      [],
    );
  return rows
    .map((row) => row.map((cell, i) => cell.slice(0, 30).padEnd(colWidths[i] ?? 0)).join(' | '))
    .join('\n');
}
export function requireParam(params, key) {
  if (null == params[key] || ('string' == typeof params[key] && !params[key].trim()))
    throw new Error(`Missing required param: ${key}`);
  return params[key];
}
export function requireNumeric(params, key) {
  const v = requireParam(params, key),
    n = Number(v);
  if (Number.isNaN(n)) throw new Error(`Param ${key} must be a number`);
  return n;
}
