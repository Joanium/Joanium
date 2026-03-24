const HANDLED = new Set([
  'calculate_expression',
  'convert_units',
  'get_time_in_timezone',
  'generate_uuid',
  'hash_text',
  'encode_base64',
  'decode_base64',
  'format_json',
  'convert_text_case',
  'get_text_stats',
]);

const HASH_ALGORITHMS = {
  sha1: 'SHA-1',
  sha256: 'SHA-256',
  sha384: 'SHA-384',
  sha512: 'SHA-512',
};

const LINEAR_UNITS = [
  { category: 'length', canonical: 'mm', label: 'millimeters', factor: 0.001, aliases: ['millimeter', 'millimeters'] },
  { category: 'length', canonical: 'cm', label: 'centimeters', factor: 0.01, aliases: ['centimeter', 'centimeters'] },
  { category: 'length', canonical: 'm', label: 'meters', factor: 1, aliases: ['meter', 'meters'] },
  { category: 'length', canonical: 'km', label: 'kilometers', factor: 1000, aliases: ['kilometer', 'kilometers'] },
  { category: 'length', canonical: 'in', label: 'inches', factor: 0.0254, aliases: ['inch', 'inches'] },
  { category: 'length', canonical: 'ft', label: 'feet', factor: 0.3048, aliases: ['foot', 'feet'] },
  { category: 'length', canonical: 'yd', label: 'yards', factor: 0.9144, aliases: ['yard', 'yards'] },
  { category: 'length', canonical: 'mi', label: 'miles', factor: 1609.344, aliases: ['mile', 'miles'] },
  { category: 'weight', canonical: 'mg', label: 'milligrams', factor: 0.001, aliases: ['milligram', 'milligrams'] },
  { category: 'weight', canonical: 'g', label: 'grams', factor: 1, aliases: ['gram', 'grams'] },
  { category: 'weight', canonical: 'kg', label: 'kilograms', factor: 1000, aliases: ['kilogram', 'kilograms'] },
  { category: 'weight', canonical: 'oz', label: 'ounces', factor: 28.349523125, aliases: ['ounce', 'ounces'] },
  { category: 'weight', canonical: 'lb', label: 'pounds', factor: 453.59237, aliases: ['pound', 'pounds', 'lbs'] },
  { category: 'weight', canonical: 'st', label: 'stone', factor: 6350.29318, aliases: ['stone'] },
  { category: 'volume', canonical: 'ml', label: 'milliliters', factor: 1, aliases: ['milliliter', 'milliliters'] },
  { category: 'volume', canonical: 'l', label: 'liters', factor: 1000, aliases: ['liter', 'liters', 'litre', 'litres'] },
  { category: 'volume', canonical: 'tsp', label: 'teaspoons', factor: 4.92892159375, aliases: ['teaspoon', 'teaspoons'] },
  { category: 'volume', canonical: 'tbsp', label: 'tablespoons', factor: 14.78676478125, aliases: ['tablespoon', 'tablespoons'] },
  { category: 'volume', canonical: 'floz', label: 'fluid ounces', factor: 29.5735295625, aliases: ['fl oz', 'fluid ounce', 'fluid ounces', 'floz'] },
  { category: 'volume', canonical: 'cup', label: 'cups', factor: 236.5882365, aliases: ['cups'] },
  { category: 'volume', canonical: 'pt', label: 'pints', factor: 473.176473, aliases: ['pint', 'pints'] },
  { category: 'volume', canonical: 'qt', label: 'quarts', factor: 946.352946, aliases: ['quart', 'quarts'] },
  { category: 'volume', canonical: 'gal', label: 'gallons', factor: 3785.411784, aliases: ['gallon', 'gallons'] },
  { category: 'speed', canonical: 'm/s', label: 'meters per second', factor: 1, aliases: ['mps', 'meter per second', 'meters per second'] },
  { category: 'speed', canonical: 'km/h', label: 'kilometers per hour', factor: 0.2777777778, aliases: ['kmh', 'kph', 'kilometer per hour', 'kilometers per hour'] },
  { category: 'speed', canonical: 'mph', label: 'miles per hour', factor: 0.44704, aliases: ['mile per hour', 'miles per hour'] },
  { category: 'speed', canonical: 'knot', label: 'knots', factor: 0.5144444444, aliases: ['knots', 'kt', 'kts'] },
];

const TEMPERATURE_UNITS = [
  { canonical: 'c', label: 'Celsius', aliases: ['celsius', 'centigrade', 'degc'] },
  { canonical: 'f', label: 'Fahrenheit', aliases: ['fahrenheit', 'degf'] },
  { canonical: 'k', label: 'Kelvin', aliases: ['kelvin'] },
];

const UNIT_LOOKUP = new Map();
const TEMPERATURE_LOOKUP = new Map();

for (const unit of LINEAR_UNITS) {
  for (const alias of [unit.canonical, ...unit.aliases]) {
    UNIT_LOOKUP.set(normalizeUnitKey(alias), unit);
  }
}

for (const unit of TEMPERATURE_UNITS) {
  for (const alias of [unit.canonical, ...unit.aliases]) {
    TEMPERATURE_LOOKUP.set(normalizeUnitKey(alias), unit);
  }
}

export function handles(toolName) {
  return HANDLED.has(toolName);
}

export async function execute(toolName, params, onStage = () => {}) {
  switch (toolName) {
    case 'calculate_expression': {
      const expression = String(params.expression ?? '').trim();
      if (!expression) throw new Error('Missing required param: expression');

      onStage(`Calculating ${expression}`);
      const precision = clampInteger(params.precision, 6, 0, 12);
      const result = evaluateExpression(expression);

      return [
        `Expression: ${expression}`,
        `Result: ${formatNumber(result, precision)}`,
      ].join('\n');
    }

    case 'convert_units': {
      const value = Number(params.value);
      const fromUnitInput = String(params.from_unit ?? '').trim();
      const toUnitInput = String(params.to_unit ?? '').trim();

      if (!Number.isFinite(value)) throw new Error('Missing or invalid required param: value');
      if (!fromUnitInput) throw new Error('Missing required param: from_unit');
      if (!toUnitInput) throw new Error('Missing required param: to_unit');

      onStage(`Converting ${value} ${fromUnitInput} to ${toUnitInput}`);
      const precision = clampInteger(params.precision, 6, 0, 12);
      const conversion = convertUnits(value, fromUnitInput, toUnitInput);

      return [
        `Category: ${conversion.category}`,
        `Input: ${formatNumber(value, precision)} ${conversion.fromLabel} (${conversion.fromCanonical})`,
        `Output: ${formatNumber(conversion.value, precision)} ${conversion.toLabel} (${conversion.toCanonical})`,
      ].join('\n');
    }

    case 'get_time_in_timezone': {
      const timezone = String(params.timezone ?? '').trim();
      if (!timezone) throw new Error('Missing required param: timezone');

      onStage(`Looking up current time in ${timezone}`);
      const locale = resolveLocale(params.locale);
      const resolvedTimezone = resolveTimezone(timezone);
      const now = new Date();

      const formatted = new Intl.DateTimeFormat(locale, {
        timeZone: resolvedTimezone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short',
      }).format(now);

      const isoLike = new Intl.DateTimeFormat('en-CA', {
        timeZone: resolvedTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      }).format(now).replace(',', '');

      const offset = new Intl.DateTimeFormat('en-US', {
        timeZone: resolvedTimezone,
        timeZoneName: 'shortOffset',
        hour: '2-digit',
      }).formatToParts(now).find(part => part.type === 'timeZoneName')?.value ?? 'UTC';

      return [
        `Timezone: ${resolvedTimezone}`,
        `Current local time: ${formatted}`,
        `ISO-like local time: ${isoLike}`,
        `UTC offset: ${offset}`,
      ].join('\n');
    }

    case 'generate_uuid': {
      const count = clampInteger(params.count, 1, 1, 20);
      const uppercase = toBoolean(params.uppercase);
      onStage(`Generating ${count} UUID${count === 1 ? '' : 's'}`);

      const values = Array.from({ length: count }, () => {
        const value = createUuidV4();
        return uppercase ? value.toUpperCase() : value;
      });

      return [
        `Generated ${count} UUID${count === 1 ? '' : 's'}:`,
        '',
        ...values.map(value => `- ${value}`),
      ].join('\n');
    }

    case 'hash_text': {
      if (params.text == null) throw new Error('Missing required param: text');

      const text = String(params.text);
      const algorithmKey = String(params.algorithm ?? 'sha256').trim().toLowerCase();
      const algorithm = HASH_ALGORITHMS[algorithmKey];
      if (!algorithm) {
        throw new Error('Invalid algorithm. Use one of: sha1, sha256, sha384, sha512');
      }

      onStage(`Hashing text with ${algorithm}`);
      const digest = await hashText(text, algorithm);

      return [
        `Algorithm: ${algorithm}`,
        `Characters: ${text.length}`,
        `Hash:`,
        '```text',
        digest,
        '```',
      ].join('\n');
    }

    case 'encode_base64': {
      if (params.text == null) throw new Error('Missing required param: text');

      const text = String(params.text);
      onStage('Encoding text as Base64');
      const encoded = encodeBase64(text);

      return [
        `Input characters: ${text.length}`,
        `Base64 output:`,
        '```text',
        encoded,
        '```',
      ].join('\n');
    }

    case 'decode_base64': {
      const base64 = String(params.base64 ?? '').trim();
      if (!base64) throw new Error('Missing required param: base64');

      onStage('Decoding Base64 text');
      const decoded = decodeBase64(base64);

      return [
        `Decoded characters: ${decoded.length}`,
        'Decoded text:',
        '```text',
        decoded,
        '```',
      ].join('\n');
    }

    case 'format_json': {
      if (params.json == null) throw new Error('Missing required param: json');

      onStage('Formatting JSON');
      const indent = clampInteger(params.indent, 2, 0, 8);
      const sortKeys = toBoolean(params.sort_keys);
      const parsed = typeof params.json === 'string' ? JSON.parse(params.json) : params.json;
      const normalized = sortKeys ? sortJsonValue(parsed) : parsed;
      const formatted = JSON.stringify(normalized, null, indent);

      return [
        `JSON is valid.${sortKeys ? ' Keys were sorted recursively.' : ''}`,
        '```json',
        formatted,
        '```',
      ].join('\n');
    }

    case 'convert_text_case': {
      if (params.text == null) throw new Error('Missing required param: text');

      const text = String(params.text);
      const targetCase = String(params.target_case ?? '').trim().toLowerCase();
      if (!targetCase) throw new Error('Missing required param: target_case');

      onStage(`Converting text to ${targetCase} case`);
      const converted = convertTextCase(text, targetCase);

      return [
        `Target case: ${targetCase}`,
        '```text',
        converted,
        '```',
      ].join('\n');
    }

    case 'get_text_stats': {
      if (params.text == null) throw new Error('Missing required param: text');

      const text = String(params.text);
      onStage('Analyzing text statistics');
      const stats = getTextStats(text);

      return [
        `Characters: ${stats.characters}`,
        `Characters (no spaces): ${stats.charactersNoSpaces}`,
        `Words: ${stats.words}`,
        `Lines: ${stats.lines}`,
        `Sentences: ${stats.sentences}`,
        `Paragraphs: ${stats.paragraphs}`,
        `Average word length: ${stats.averageWordLength}`,
        `Estimated reading time: ${stats.readingTimeMinutes} min`,
      ].join('\n');
    }

    default:
      throw new Error(`UtilityExecutor: unknown tool "${toolName}"`);
  }
}

function normalizeUnitKey(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\u00b0/g, '')
    .replace(/\./g, '')
    .replace(/\s+/g, '');
}

function clampInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function toBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function formatNumber(value, precision = 6) {
  if (!Number.isFinite(value)) return String(value);

  const absolute = Math.abs(value);
  if (absolute !== 0 && (absolute >= 1e15 || absolute < 10 ** -(precision + 1))) {
    return value.toExponential(Math.min(precision, 8));
  }

  const rounded = Number(value.toFixed(precision));
  return rounded.toLocaleString('en-US', {
    maximumFractionDigits: precision,
  });
}

function evaluateExpression(expression) {
  const parser = new ExpressionParser(tokenizeExpression(expression));
  const result = parser.parse();
  if (!Number.isFinite(result)) {
    throw new Error('Expression did not produce a finite number');
  }
  return result;
}

function tokenizeExpression(input) {
  const tokens = [];
  let index = 0;

  while (index < input.length) {
    const char = input[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if ('()+-*/%^'.includes(char)) {
      tokens.push({ type: char, value: char });
      index += 1;
      continue;
    }

    const numberMatch = input.slice(index).match(/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);
    if (numberMatch) {
      tokens.push({ type: 'number', value: Number(numberMatch[0]) });
      index += numberMatch[0].length;
      continue;
    }

    const identifierMatch = input.slice(index).match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (identifierMatch) {
      tokens.push({ type: 'identifier', value: identifierMatch[0].toLowerCase() });
      index += identifierMatch[0].length;
      continue;
    }

    throw new Error(`Unexpected character "${char}" at position ${index + 1}`);
  }

  return tokens;
}

class ExpressionParser {
  constructor(tokens) {
    this.tokens = tokens;
    this.index = 0;
  }

  parse() {
    const value = this.parseExpression();
    if (!this.isAtEnd()) {
      const token = this.peek();
      throw new Error(`Unexpected token "${token?.value ?? token?.type}"`);
    }
    return value;
  }

  parseExpression() {
    let value = this.parseTerm();

    while (this.match('+', '-')) {
      const operator = this.previous().type;
      const right = this.parseTerm();
      value = operator === '+' ? value + right : value - right;
    }

    return value;
  }

  parseTerm() {
    let value = this.parsePower();

    while (this.match('*', '/', '%')) {
      const operator = this.previous().type;
      const right = this.parsePower();

      if (operator === '*') value *= right;
      if (operator === '/') value /= right;
      if (operator === '%') value %= right;
    }

    return value;
  }

  parsePower() {
    let value = this.parseUnary();

    if (this.match('^')) {
      const right = this.parsePower();
      value = value ** right;
    }

    return value;
  }

  parseUnary() {
    if (this.match('+')) return +this.parseUnary();
    if (this.match('-')) return -this.parseUnary();
    return this.parsePrimary();
  }

  parsePrimary() {
    if (this.match('number')) {
      return this.previous().value;
    }

    if (this.match('identifier')) {
      const identifier = this.previous().value;
      if (this.match('(')) {
        const argument = this.parseExpression();
        this.consume(')', 'Expected ")" after function argument');
        return applyMathFunction(identifier, argument);
      }
      return resolveConstant(identifier);
    }

    if (this.match('(')) {
      const value = this.parseExpression();
      this.consume(')', 'Expected ")" after expression');
      return value;
    }

    throw new Error('Expected a number, constant, function, or parenthesized expression');
  }

  match(...types) {
    for (const type of types) {
      if (this.check(type)) {
        this.index += 1;
        return true;
      }
    }
    return false;
  }

  consume(type, message) {
    if (this.check(type)) {
      this.index += 1;
      return this.previous();
    }
    throw new Error(message);
  }

  check(type) {
    return !this.isAtEnd() && this.peek().type === type;
  }

  peek() {
    return this.tokens[this.index];
  }

  previous() {
    return this.tokens[this.index - 1];
  }

  isAtEnd() {
    return this.index >= this.tokens.length;
  }
}

function resolveConstant(identifier) {
  if (identifier === 'pi') return Math.PI;
  if (identifier === 'e') return Math.E;
  throw new Error(`Unknown constant "${identifier}"`);
}

function applyMathFunction(identifier, value) {
  const fn = {
    sqrt: Math.sqrt,
    abs: Math.abs,
    round: Math.round,
    floor: Math.floor,
    ceil: Math.ceil,
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    asin: Math.asin,
    acos: Math.acos,
    atan: Math.atan,
    log: Math.log10,
    ln: Math.log,
    exp: Math.exp,
  }[identifier];

  if (!fn) throw new Error(`Unknown function "${identifier}"`);
  return fn(value);
}

function convertUnits(value, fromUnitInput, toUnitInput) {
  const fromTemperature = TEMPERATURE_LOOKUP.get(normalizeUnitKey(fromUnitInput));
  const toTemperature = TEMPERATURE_LOOKUP.get(normalizeUnitKey(toUnitInput));

  if (fromTemperature || toTemperature) {
    if (!fromTemperature || !toTemperature) {
      throw new Error('Temperature conversions must use temperature units on both sides');
    }

    const celsius = toCelsius(value, fromTemperature.canonical);
    return {
      category: 'temperature',
      fromLabel: fromTemperature.label,
      fromCanonical: fromTemperature.canonical,
      toLabel: toTemperature.label,
      toCanonical: toTemperature.canonical,
      value: fromCelsius(celsius, toTemperature.canonical),
    };
  }

  const fromUnit = UNIT_LOOKUP.get(normalizeUnitKey(fromUnitInput));
  const toUnit = UNIT_LOOKUP.get(normalizeUnitKey(toUnitInput));

  if (!fromUnit) throw new Error(`Unsupported from_unit "${fromUnitInput}"`);
  if (!toUnit) throw new Error(`Unsupported to_unit "${toUnitInput}"`);
  if (fromUnit.category !== toUnit.category) {
    throw new Error(`Cannot convert ${fromUnit.category} to ${toUnit.category}`);
  }

  const baseValue = value * fromUnit.factor;
  return {
    category: fromUnit.category,
    fromLabel: fromUnit.label,
    fromCanonical: fromUnit.canonical,
    toLabel: toUnit.label,
    toCanonical: toUnit.canonical,
    value: baseValue / toUnit.factor,
  };
}

function toCelsius(value, unit) {
  if (unit === 'c') return value;
  if (unit === 'f') return (value - 32) * (5 / 9);
  if (unit === 'k') return value - 273.15;
  throw new Error(`Unsupported temperature unit "${unit}"`);
}

function fromCelsius(value, unit) {
  if (unit === 'c') return value;
  if (unit === 'f') return (value * 9) / 5 + 32;
  if (unit === 'k') return value + 273.15;
  throw new Error(`Unsupported temperature unit "${unit}"`);
}

function resolveTimezone(timezone) {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: timezone }).resolvedOptions().timeZone;
  } catch {
    throw new Error(`Invalid timezone "${timezone}". Use an IANA name like "Asia/Kolkata".`);
  }
}

function resolveLocale(locale) {
  if (!locale) return 'en-US';

  try {
    return new Intl.DateTimeFormat(locale).resolvedOptions().locale;
  } catch {
    return 'en-US';
  }
}

function createUuidV4() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();

  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}

async function hashText(text, algorithm) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Hashing is not available in this environment');
  }

  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest(algorithm, bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function encodeBase64(text) {
  const bytes = new TextEncoder().encode(text);
  return bytesToBase64(bytes);
}

function decodeBase64(base64) {
  try {
    const bytes = base64ToBytes(base64);
    return new TextDecoder().decode(bytes);
  } catch {
    throw new Error('Invalid Base64 input');
  }
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa(binary);
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(binary, 'binary').toString('base64');
  }
  throw new Error('Base64 encoding is not available in this environment');
}

function base64ToBytes(base64) {
  const normalized = base64.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const value = normalized + padding;
  const binary = typeof globalThis.atob === 'function'
    ? globalThis.atob(value)
    : typeof Buffer !== 'undefined'
      ? Buffer.from(value, 'base64').toString('binary')
      : null;

  if (binary == null) {
    throw new Error('Base64 decoding is not available in this environment');
  }

  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function sortJsonValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort((a, b) => a.localeCompare(b))
        .map(key => [key, sortJsonValue(value[key])]),
    );
  }

  return value;
}

function convertTextCase(text, targetCase) {
  const words = extractWords(text);

  switch (targetCase) {
    case 'lower':
      return text.toLowerCase();
    case 'upper':
      return text.toUpperCase();
    case 'title':
      return words.map(capitalizeWord).join(' ');
    case 'sentence':
      return sentenceCase(text);
    case 'camel':
      return words.length
        ? words[0].toLowerCase() + words.slice(1).map(capitalizeWord).join('')
        : '';
    case 'pascal':
      return words.map(capitalizeWord).join('');
    case 'snake':
      return words.map(word => word.toLowerCase()).join('_');
    case 'kebab':
      return words.map(word => word.toLowerCase()).join('-');
    case 'constant':
      return words.map(word => word.toUpperCase()).join('_');
    default:
      throw new Error('Invalid target_case. Use one of: lower, upper, title, sentence, camel, pascal, snake, kebab, constant');
  }
}

function extractWords(text) {
  return String(text)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .match(/[\p{L}\p{N}]+/gu) ?? [];
}

function capitalizeWord(word) {
  return word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : '';
}

function sentenceCase(text) {
  const input = String(text).toLowerCase();
  let result = '';
  let shouldCapitalize = true;

  for (const char of input) {
    if (shouldCapitalize && /\p{L}/u.test(char)) {
      result += char.toUpperCase();
      shouldCapitalize = false;
      continue;
    }

    result += char;
    if (/[.!?]/.test(char)) {
      shouldCapitalize = true;
    }
  }

  return result;
}

function getTextStats(text) {
  const input = String(text);
  const words = input.match(/[\p{L}\p{N}]+(?:['\u2019-][\p{L}\p{N}]+)*/gu) ?? [];
  const paragraphs = input.trim() ? input.trim().split(/\r?\n\s*\r?\n+/).length : 0;
  const lines = input.length ? input.split(/\r?\n/).length : 0;
  const sentenceParts = input
    .split(/[.!?]+/u)
    .map(part => part.trim())
    .filter(Boolean);

  const totalWordCharacters = words.reduce((sum, word) => sum + word.length, 0);
  const readingTimeMinutes = words.length ? (words.length / 200).toFixed(2) : '0.00';

  return {
    characters: input.length,
    charactersNoSpaces: input.replace(/\s/g, '').length,
    words: words.length,
    lines,
    sentences: sentenceParts.length,
    paragraphs,
    averageWordLength: words.length ? (totalWordCharacters / words.length).toFixed(2) : '0.00',
    readingTimeMinutes,
  };
}
