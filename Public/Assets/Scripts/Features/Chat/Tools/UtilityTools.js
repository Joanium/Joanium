export const UTILITY_TOOLS = [
  {
    name: 'calculate_expression',
    description: 'Evaluate a math expression with parentheses, exponentiation, constants like pi/e, and functions such as sqrt, abs, round, floor, ceil, sin, cos, tan, log, ln, and exp.',
    category: 'utility',
    parameters: {
      expression: {
        type: 'string',
        required: true,
        description: 'Math expression to evaluate, for example "(42 * 1.08) / 3" or "sqrt(144) + pi".',
      },
      precision: {
        type: 'number',
        required: false,
        description: 'Maximum decimal places in the displayed result (default: 6, max: 12).',
      },
    },
  },
  {
    name: 'convert_units',
    description: 'Convert a numeric value between common length, weight, temperature, volume, and speed units.',
    category: 'utility',
    parameters: {
      value: {
        type: 'number',
        required: true,
        description: 'Numeric value to convert.',
      },
      from_unit: {
        type: 'string',
        required: true,
        description: 'Source unit, for example "km", "lb", "celsius", "liter", or "mph".',
      },
      to_unit: {
        type: 'string',
        required: true,
        description: 'Target unit, for example "mi", "kg", "fahrenheit", "cup", or "m/s".',
      },
      precision: {
        type: 'number',
        required: false,
        description: 'Maximum decimal places in the displayed result (default: 6, max: 12).',
      },
    },
  },
  {
    name: 'get_time_in_timezone',
    description: 'Show the current date and time in any IANA timezone such as "Asia/Kolkata", "America/New_York", or "Europe/London".',
    category: 'utility',
    parameters: {
      timezone: {
        type: 'string',
        required: true,
        description: 'IANA timezone name such as "Asia/Kolkata" or "America/Los_Angeles".',
      },
      locale: {
        type: 'string',
        required: false,
        description: 'Optional locale for formatting, for example "en-US" or "en-GB".',
      },
    },
  },
  {
    name: 'generate_uuid',
    description: 'Generate one or more random UUID v4 values.',
    category: 'utility',
    parameters: {
      count: {
        type: 'number',
        required: false,
        description: 'How many UUIDs to generate (default: 1, max: 20).',
      },
      uppercase: {
        type: 'boolean',
        required: false,
        description: 'Set true to return uppercase UUIDs.',
      },
    },
  },
  {
    name: 'hash_text',
    description: 'Hash text using SHA-1, SHA-256, SHA-384, or SHA-512.',
    category: 'utility',
    parameters: {
      text: {
        type: 'string',
        required: true,
        description: 'Text to hash.',
      },
      algorithm: {
        type: 'string',
        required: false,
        description: 'Hash algorithm: "sha256" (default), "sha1", "sha384", or "sha512".',
      },
    },
  },
  {
    name: 'encode_base64',
    description: 'Encode UTF-8 text to Base64.',
    category: 'utility',
    parameters: {
      text: {
        type: 'string',
        required: true,
        description: 'Plain text to encode.',
      },
    },
  },
  {
    name: 'decode_base64',
    description: 'Decode Base64 text back into UTF-8 plain text.',
    category: 'utility',
    parameters: {
      base64: {
        type: 'string',
        required: true,
        description: 'Base64-encoded text. URL-safe Base64 is also accepted.',
      },
    },
  },
  {
    name: 'format_json',
    description: 'Validate and pretty-print JSON, optionally sorting object keys recursively.',
    category: 'utility',
    parameters: {
      json: {
        type: 'string',
        required: true,
        description: 'JSON text to format.',
      },
      indent: {
        type: 'number',
        required: false,
        description: 'Indent size in spaces (default: 2, max: 8).',
      },
      sort_keys: {
        type: 'boolean',
        required: false,
        description: 'Set true to sort object keys recursively before formatting.',
      },
    },
  },
  {
    name: 'convert_text_case',
    description: 'Convert text into lower, upper, title, sentence, camel, pascal, snake, kebab, or constant case.',
    category: 'utility',
    parameters: {
      text: {
        type: 'string',
        required: true,
        description: 'Text to transform.',
      },
      target_case: {
        type: 'string',
        required: true,
        description: 'Target case: "lower", "upper", "title", "sentence", "camel", "pascal", "snake", "kebab", or "constant".',
      },
    },
  },
  {
    name: 'get_text_stats',
    description: 'Summarize text length, words, lines, sentences, paragraphs, average word length, and estimated reading time.',
    category: 'utility',
    parameters: {
      text: {
        type: 'string',
        required: true,
        description: 'Text to analyze.',
      },
    },
  },
];
