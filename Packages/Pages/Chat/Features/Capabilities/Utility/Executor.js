import { createExecutor } from '../Shared/createExecutor.js';
const HASH_ALGORITHMS = { sha1: 'SHA-1', sha256: 'SHA-256', sha384: 'SHA-384', sha512: 'SHA-512' },
  LINEAR_UNITS = [
    {
      category: 'length',
      canonical: 'mm',
      label: 'millimeters',
      factor: 0.001,
      aliases: ['millimeter', 'millimeters'],
    },
    {
      category: 'length',
      canonical: 'cm',
      label: 'centimeters',
      factor: 0.01,
      aliases: ['centimeter', 'centimeters'],
    },
    {
      category: 'length',
      canonical: 'm',
      label: 'meters',
      factor: 1,
      aliases: ['meter', 'meters'],
    },
    {
      category: 'length',
      canonical: 'km',
      label: 'kilometers',
      factor: 1e3,
      aliases: ['kilometer', 'kilometers'],
    },
    {
      category: 'length',
      canonical: 'in',
      label: 'inches',
      factor: 0.0254,
      aliases: ['inch', 'inches'],
    },
    {
      category: 'length',
      canonical: 'ft',
      label: 'feet',
      factor: 0.3048,
      aliases: ['foot', 'feet'],
    },
    {
      category: 'length',
      canonical: 'yd',
      label: 'yards',
      factor: 0.9144,
      aliases: ['yard', 'yards'],
    },
    {
      category: 'length',
      canonical: 'mi',
      label: 'miles',
      factor: 1609.344,
      aliases: ['mile', 'miles'],
    },
    {
      category: 'weight',
      canonical: 'mg',
      label: 'milligrams',
      factor: 0.001,
      aliases: ['milligram', 'milligrams'],
    },
    { category: 'weight', canonical: 'g', label: 'grams', factor: 1, aliases: ['gram', 'grams'] },
    {
      category: 'weight',
      canonical: 'kg',
      label: 'kilograms',
      factor: 1e3,
      aliases: ['kilogram', 'kilograms'],
    },
    {
      category: 'weight',
      canonical: 'oz',
      label: 'ounces',
      factor: 28.349523125,
      aliases: ['ounce', 'ounces'],
    },
    {
      category: 'weight',
      canonical: 'lb',
      label: 'pounds',
      factor: 453.59237,
      aliases: ['pound', 'pounds', 'lbs'],
    },
    { category: 'weight', canonical: 'st', label: 'stone', factor: 6350.29318, aliases: ['stone'] },
    {
      category: 'volume',
      canonical: 'ml',
      label: 'milliliters',
      factor: 1,
      aliases: ['milliliter', 'milliliters'],
    },
    {
      category: 'volume',
      canonical: 'l',
      label: 'liters',
      factor: 1e3,
      aliases: ['liter', 'liters', 'litre', 'litres'],
    },
    {
      category: 'volume',
      canonical: 'tsp',
      label: 'teaspoons',
      factor: 4.92892159375,
      aliases: ['teaspoon', 'teaspoons'],
    },
    {
      category: 'volume',
      canonical: 'tbsp',
      label: 'tablespoons',
      factor: 14.78676478125,
      aliases: ['tablespoon', 'tablespoons'],
    },
    {
      category: 'volume',
      canonical: 'floz',
      label: 'fluid ounces',
      factor: 29.5735295625,
      aliases: ['fl oz', 'fluid ounce', 'fluid ounces', 'floz'],
    },
    { category: 'volume', canonical: 'cup', label: 'cups', factor: 236.5882365, aliases: ['cups'] },
    {
      category: 'volume',
      canonical: 'pt',
      label: 'pints',
      factor: 473.176473,
      aliases: ['pint', 'pints'],
    },
    {
      category: 'volume',
      canonical: 'qt',
      label: 'quarts',
      factor: 946.352946,
      aliases: ['quart', 'quarts'],
    },
    {
      category: 'volume',
      canonical: 'gal',
      label: 'gallons',
      factor: 3785.411784,
      aliases: ['gallon', 'gallons'],
    },
    {
      category: 'speed',
      canonical: 'm/s',
      label: 'meters per second',
      factor: 1,
      aliases: ['mps', 'meter per second', 'meters per second'],
    },
    {
      category: 'speed',
      canonical: 'km/h',
      label: 'kilometers per hour',
      factor: 0.2777777778,
      aliases: ['kmh', 'kph', 'kilometer per hour', 'kilometers per hour'],
    },
    {
      category: 'speed',
      canonical: 'mph',
      label: 'miles per hour',
      factor: 0.44704,
      aliases: ['mile per hour', 'miles per hour'],
    },
    {
      category: 'speed',
      canonical: 'knot',
      label: 'knots',
      factor: 0.5144444444,
      aliases: ['knots', 'kt', 'kts'],
    },
  ],
  TEMPERATURE_UNITS = [
    { canonical: 'c', label: 'Celsius', aliases: ['celsius', 'centigrade', 'degc'] },
    { canonical: 'f', label: 'Fahrenheit', aliases: ['fahrenheit', 'degf'] },
    { canonical: 'k', label: 'Kelvin', aliases: ['kelvin'] },
  ],
  UNIT_LOOKUP = new Map(),
  TEMPERATURE_LOOKUP = new Map();
for (const unit of LINEAR_UNITS)
  for (const alias of [unit.canonical, ...unit.aliases])
    UNIT_LOOKUP.set(normalizeUnitKey(alias), unit);
for (const unit of TEMPERATURE_UNITS)
  for (const alias of [unit.canonical, ...unit.aliases])
    TEMPERATURE_LOOKUP.set(normalizeUnitKey(alias), unit);
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
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : fallback;
}
function toBoolean(value) {
  return !0 === value || 'true' === value || 1 === value || '1' === value;
}
function formatNumber(value, precision = 6) {
  if (!Number.isFinite(value)) return String(value);
  const absolute = Math.abs(value);
  return 0 !== absolute && (absolute >= 1e15 || absolute < 10 ** -(precision + 1))
    ? value.toExponential(Math.min(precision, 8))
    : Number(value.toFixed(precision)).toLocaleString('en-US', {
        maximumFractionDigits: precision,
      });
}
function evaluateExpression(expression) {
  const result = new ExpressionParser(
    (function (input) {
      const tokens = [];
      let index = 0;
      for (; index < input.length; ) {
        const char = input[index];
        if (/\s/.test(char)) {
          index += 1;
          continue;
        }
        if ('()+-*/%^'.includes(char)) {
          (tokens.push({ type: char, value: char }), (index += 1));
          continue;
        }
        const numberMatch = input.slice(index).match(/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);
        if (numberMatch) {
          (tokens.push({ type: 'number', value: Number(numberMatch[0]) }),
            (index += numberMatch[0].length));
          continue;
        }
        const identifierMatch = input.slice(index).match(/^[A-Za-z_][A-Za-z0-9_]*/);
        if (!identifierMatch)
          throw new Error(`Unexpected character "${char}" at position ${index + 1}`);
        (tokens.push({ type: 'identifier', value: identifierMatch[0].toLowerCase() }),
          (index += identifierMatch[0].length));
      }
      return tokens;
    })(expression),
  ).parse();
  if (!Number.isFinite(result)) throw new Error('Expression did not produce a finite number');
  return result;
}
class ExpressionParser {
  constructor(tokens) {
    ((this.tokens = tokens), (this.index = 0));
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
    for (; this.match('+', '-'); ) {
      const operator = this.previous().type,
        right = this.parseTerm();
      value = '+' === operator ? value + right : value - right;
    }
    return value;
  }
  parseTerm() {
    let value = this.parsePower();
    for (; this.match('*', '/', '%'); ) {
      const operator = this.previous().type,
        right = this.parsePower();
      ('*' === operator && (value *= right),
        '/' === operator && (value /= right),
        '%' === operator && (value %= right));
    }
    return value;
  }
  parsePower() {
    let value = this.parseUnary();
    return (this.match('^') && (value = value ** this.parsePower()), value);
  }
  parseUnary() {
    return this.match('+')
      ? +this.parseUnary()
      : this.match('-')
        ? -this.parseUnary()
        : this.parsePrimary();
  }
  parsePrimary() {
    if (this.match('number')) return this.previous().value;
    if (this.match('identifier')) {
      const identifier = this.previous().value;
      if (this.match('(')) {
        const argument = this.parseExpression();
        return (
          this.consume(')', 'Expected ")" after function argument'),
          (function (identifier, value) {
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
          })(identifier, argument)
        );
      }
      return (function (identifier) {
        if ('pi' === identifier) return Math.PI;
        if ('e' === identifier) return Math.E;
        throw new Error(`Unknown constant "${identifier}"`);
      })(identifier);
    }
    if (this.match('(')) {
      const value = this.parseExpression();
      return (this.consume(')', 'Expected ")" after expression'), value);
    }
    throw new Error('Expected a number, constant, function, or parenthesized expression');
  }
  match(...types) {
    for (const type of types) if (this.check(type)) return ((this.index += 1), !0);
    return !1;
  }
  consume(type, message) {
    if (this.check(type)) return ((this.index += 1), this.previous());
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
function fromCelsius(value, unit) {
  if ('c' === unit) return value;
  if ('f' === unit) return (9 * value) / 5 + 32;
  if ('k' === unit) return value + 273.15;
  throw new Error(`Unsupported temperature unit "${unit}"`);
}
function sortJsonValue(value) {
  return Array.isArray(value)
    ? value.map(sortJsonValue)
    : value && 'object' == typeof value
      ? Object.fromEntries(
          Object.keys(value)
            .sort((a, b) => a.localeCompare(b))
            .map((key) => [key, sortJsonValue(value[key])]),
        )
      : value;
}
function convertTextCase(text, targetCase) {
  const words = (function (text) {
    return (
      String(text)
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .match(/[\p{L}\p{N}]+/gu) ?? []
    );
  })(text);
  switch (targetCase) {
    case 'lower':
      return text.toLowerCase();
    case 'upper':
      return text.toUpperCase();
    case 'title':
      return words.map(capitalizeWord).join(' ');
    case 'sentence':
      return (function (text) {
        const input = String(text).toLowerCase();
        let result = '',
          shouldCapitalize = !0;
        for (const char of input)
          shouldCapitalize && /\p{L}/u.test(char)
            ? ((result += char.toUpperCase()), (shouldCapitalize = !1))
            : ((result += char), /[.!?]/.test(char) && (shouldCapitalize = !0));
        return result;
      })(text);
    case 'camel':
      return words.length
        ? words[0].toLowerCase() + words.slice(1).map(capitalizeWord).join('')
        : '';
    case 'pascal':
      return words.map(capitalizeWord).join('');
    case 'snake':
      return words.map((word) => word.toLowerCase()).join('_');
    case 'kebab':
      return words.map((word) => word.toLowerCase()).join('-');
    case 'constant':
      return words.map((word) => word.toUpperCase()).join('_');
    default:
      throw new Error(
        'Invalid target_case. Use one of: lower, upper, title, sentence, camel, pascal, snake, kebab, constant',
      );
  }
}
function capitalizeWord(word) {
  return word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : '';
}
export const { handles: handles, execute: execute } = createExecutor({
  name: 'UtilityExecutor',
  tools: [
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
  ],
  handlers: {
    calculate_expression: async (params, onStage) => {
      const expression = String(params.expression ?? '').trim();
      if (!expression) throw new Error('Missing required param: expression');
      onStage(`Calculating ${expression}`);
      const precision = clampInteger(params.precision, 6, 0, 12);
      return [
        `Expression: ${expression}`,
        `Result: ${formatNumber(evaluateExpression(expression), precision)}`,
      ].join('\n');
    },
    convert_units: async (params, onStage) => {
      const value = Number(params.value),
        fromUnitInput = String(params.from_unit ?? '').trim(),
        toUnitInput = String(params.to_unit ?? '').trim();
      if (!Number.isFinite(value)) throw new Error('Missing or invalid required param: value');
      if (!fromUnitInput) throw new Error('Missing required param: from_unit');
      if (!toUnitInput) throw new Error('Missing required param: to_unit');
      onStage(`Converting ${value} ${fromUnitInput} to ${toUnitInput}`);
      const precision = clampInteger(params.precision, 6, 0, 12),
        conversion = (function (value, fromUnitInput, toUnitInput) {
          const fromTemperature = TEMPERATURE_LOOKUP.get(normalizeUnitKey(fromUnitInput)),
            toTemperature = TEMPERATURE_LOOKUP.get(normalizeUnitKey(toUnitInput));
          if (fromTemperature || toTemperature) {
            if (!fromTemperature || !toTemperature)
              throw new Error('Temperature conversions must use temperature units on both sides');
            const celsius = (function (value, unit) {
              if ('c' === unit) return value;
              if ('f' === unit) return (5 / 9) * (value - 32);
              if ('k' === unit) return value - 273.15;
              throw new Error(`Unsupported temperature unit "${unit}"`);
            })(value, fromTemperature.canonical);
            return {
              category: 'temperature',
              fromLabel: fromTemperature.label,
              fromCanonical: fromTemperature.canonical,
              toLabel: toTemperature.label,
              toCanonical: toTemperature.canonical,
              value: fromCelsius(celsius, toTemperature.canonical),
            };
          }
          const fromUnit = UNIT_LOOKUP.get(normalizeUnitKey(fromUnitInput)),
            toUnit = UNIT_LOOKUP.get(normalizeUnitKey(toUnitInput));
          if (!fromUnit) throw new Error(`Unsupported from_unit "${fromUnitInput}"`);
          if (!toUnit) throw new Error(`Unsupported to_unit "${toUnitInput}"`);
          if (fromUnit.category !== toUnit.category)
            throw new Error(`Cannot convert ${fromUnit.category} to ${toUnit.category}`);
          const baseValue = value * fromUnit.factor;
          return {
            category: fromUnit.category,
            fromLabel: fromUnit.label,
            fromCanonical: fromUnit.canonical,
            toLabel: toUnit.label,
            toCanonical: toUnit.canonical,
            value: baseValue / toUnit.factor,
          };
        })(value, fromUnitInput, toUnitInput);
      return [
        `Category: ${conversion.category}`,
        `Input: ${formatNumber(value, precision)} ${conversion.fromLabel} (${conversion.fromCanonical})`,
        `Output: ${formatNumber(conversion.value, precision)} ${conversion.toLabel} (${conversion.toCanonical})`,
      ].join('\n');
    },
    get_time_in_timezone: async (params, onStage) => {
      const timezone = String(params.timezone ?? '').trim();
      if (!timezone) throw new Error('Missing required param: timezone');
      onStage(`Looking up current time in ${timezone}`);
      const locale = (function (locale) {
          if (!locale) return 'en-US';
          try {
            return new Intl.DateTimeFormat(locale).resolvedOptions().locale;
          } catch {
            return 'en-US';
          }
        })(params.locale),
        resolvedTimezone = (function (timezone) {
          try {
            return new Intl.DateTimeFormat('en-US', { timeZone: timezone }).resolvedOptions()
              .timeZone;
          } catch {
            throw new Error(
              `Invalid timezone "${timezone}". Use an IANA name like "Asia/Kolkata".`,
            );
          }
        })(timezone),
        now = new Date();
      return [
        `Timezone: ${resolvedTimezone}`,
        `Current local time: ${new Intl.DateTimeFormat(locale, { timeZone: resolvedTimezone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short' }).format(now)}`,
        `ISO-like local time: ${new Intl.DateTimeFormat('en-CA', { timeZone: resolvedTimezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(now).replace(',', '')}`,
        `UTC offset: ${new Intl.DateTimeFormat('en-US', { timeZone: resolvedTimezone, timeZoneName: 'shortOffset', hour: '2-digit' }).formatToParts(now).find((part) => 'timeZoneName' === part.type)?.value ?? 'UTC'}`,
      ].join('\n');
    },
    generate_uuid: async (params, onStage) => {
      const count = clampInteger(params.count, 1, 1, 20),
        uppercase = toBoolean(params.uppercase);
      return (
        onStage(`Generating ${count} UUID${1 === count ? '' : 's'}`),
        [
          `Generated ${count} UUID${1 === count ? '' : 's'}:`,
          '',
          ...Array.from({ length: count }, () => {
            const value = (function () {
              if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
              const bytes = new Uint8Array(16);
              if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
              else
                for (let index = 0; index < bytes.length; index += 1)
                  bytes[index] = Math.floor(256 * Math.random());
              ((bytes[6] = (15 & bytes[6]) | 64), (bytes[8] = (63 & bytes[8]) | 128));
              const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
              return [
                hex.slice(0, 4).join(''),
                hex.slice(4, 6).join(''),
                hex.slice(6, 8).join(''),
                hex.slice(8, 10).join(''),
                hex.slice(10, 16).join(''),
              ].join('-');
            })();
            return uppercase ? value.toUpperCase() : value;
          }).map((value) => `- ${value}`),
        ].join('\n')
      );
    },
    hash_text: async (params, onStage) => {
      if (null == params.text) throw new Error('Missing required param: text');
      const text = String(params.text),
        algorithmKey = String(params.algorithm ?? 'sha256')
          .trim()
          .toLowerCase(),
        algorithm = HASH_ALGORITHMS[algorithmKey];
      if (!algorithm)
        throw new Error('Invalid algorithm. Use one of: sha1, sha256, sha384, sha512');
      onStage(`Hashing text with ${algorithm}`);
      const digest = await (async function (text, algorithm) {
        if (!globalThis.crypto?.subtle)
          throw new Error('Hashing is not available in this environment');
        const bytes = new TextEncoder().encode(text),
          digest = await globalThis.crypto.subtle.digest(algorithm, bytes);
        return Array.from(new Uint8Array(digest), (byte) =>
          byte.toString(16).padStart(2, '0'),
        ).join('');
      })(text, algorithm);
      return [
        `Algorithm: ${algorithm}`,
        `Characters: ${text.length}`,
        'Hash:',
        '```text',
        digest,
        '```',
      ].join('\n');
    },
    encode_base64: async (params, onStage) => {
      if (null == params.text) throw new Error('Missing required param: text');
      const text = String(params.text);
      onStage('Encoding text as Base64');
      const encoded = (function (text) {
        return (function (bytes) {
          let binary = '';
          for (let index = 0; index < bytes.length; index += 32768) {
            const chunk = bytes.subarray(index, index + 32768);
            binary += String.fromCharCode(...chunk);
          }
          if ('function' == typeof globalThis.btoa) return globalThis.btoa(binary);
          if ('undefined' != typeof Buffer) return Buffer.from(binary, 'binary').toString('base64');
          throw new Error('Base64 encoding is not available in this environment');
        })(new TextEncoder().encode(text));
      })(text);
      return [`Input characters: ${text.length}`, 'Base64 output:', '```text', encoded, '```'].join(
        '\n',
      );
    },
    decode_base64: async (params, onStage) => {
      const base64 = String(params.base64 ?? '').trim();
      if (!base64) throw new Error('Missing required param: base64');
      onStage('Decoding Base64 text');
      const decoded = (function (base64) {
        try {
          const bytes = (function (base64) {
            const normalized = base64.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, ''),
              value =
                normalized +
                (normalized.length % 4 == 0 ? '' : '='.repeat(4 - (normalized.length % 4))),
              binary =
                'function' == typeof globalThis.atob
                  ? globalThis.atob(value)
                  : 'undefined' != typeof Buffer
                    ? Buffer.from(value, 'base64').toString('binary')
                    : null;
            if (null == binary)
              throw new Error('Base64 decoding is not available in this environment');
            return Uint8Array.from(binary, (char) => char.charCodeAt(0));
          })(base64);
          return new TextDecoder().decode(bytes);
        } catch {
          throw new Error('Invalid Base64 input');
        }
      })(base64);
      return [
        `Decoded characters: ${decoded.length}`,
        'Decoded text:',
        '```text',
        decoded,
        '```',
      ].join('\n');
    },
    format_json: async (params, onStage) => {
      if (null == params.json) throw new Error('Missing required param: json');
      onStage('Formatting JSON');
      const indent = clampInteger(params.indent, 2, 0, 8),
        sortKeys = toBoolean(params.sort_keys),
        parsed = 'string' == typeof params.json ? JSON.parse(params.json) : params.json,
        normalized = sortKeys ? sortJsonValue(parsed) : parsed;
      return [
        'JSON is valid.' + (sortKeys ? ' Keys were sorted recursively.' : ''),
        '```json',
        JSON.stringify(normalized, null, indent),
        '```',
      ].join('\n');
    },
    convert_text_case: async (params, onStage) => {
      if (null == params.text) throw new Error('Missing required param: text');
      const text = String(params.text),
        targetCase = String(params.target_case ?? '')
          .trim()
          .toLowerCase();
      if (!targetCase) throw new Error('Missing required param: target_case');
      return (
        onStage(`Converting text to ${targetCase} case`),
        [`Target case: ${targetCase}`, '```text', convertTextCase(text, targetCase), '```'].join(
          '\n',
        )
      );
    },
    get_text_stats: async (params, onStage) => {
      if (null == params.text) throw new Error('Missing required param: text');
      const text = String(params.text);
      onStage('Analyzing text statistics');
      const stats = (function (text) {
        const input = String(text),
          words = input.match(/[\p{L}\p{N}]+(?:['\u2019-][\p{L}\p{N}]+)*/gu) ?? [],
          paragraphs = input.trim() ? input.trim().split(/\r?\n\s*\r?\n+/).length : 0,
          lines = input.length ? input.split(/\r?\n/).length : 0,
          sentenceParts = input
            .split(/[.!?]+/u)
            .map((part) => part.trim())
            .filter(Boolean),
          totalWordCharacters = words.reduce((sum, word) => sum + word.length, 0),
          readingTimeMinutes = words.length ? (words.length / 200).toFixed(2) : '0.00';
        return {
          characters: input.length,
          charactersNoSpaces: input.replace(/\s/g, '').length,
          words: words.length,
          lines: lines,
          sentences: sentenceParts.length,
          paragraphs: paragraphs,
          averageWordLength: words.length
            ? (totalWordCharacters / words.length).toFixed(2)
            : '0.00',
          readingTimeMinutes: readingTimeMinutes,
        };
      })(text);
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
    },
  },
});
