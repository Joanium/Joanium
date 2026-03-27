export const PASSWORD_TOOLS = [
  {
    name: 'generate_password',
    description:
      'Generate cryptographically secure random passwords with customizable length, character sets, and count. Also generates passphrases made of random words.',
    category: 'security',
    parameters: {
      type: {
        type: 'string',
        required: false,
        description: 'Password type: "password" (random chars, default), "passphrase" (random words), "pin" (numeric only), "memorable" (pronounceable)',
      },
      length: {
        type: 'number',
        required: false,
        description: 'Password length for type "password" (default: 16, min: 4, max: 128) or word count for "passphrase" (default: 4)',
      },
      count: {
        type: 'number',
        required: false,
        description: 'Number of passwords to generate (default: 1, max: 10)',
      },
      include_symbols: {
        type: 'boolean',
        required: false,
        description: 'Include symbols like !@#$%^&* (default: true for "password" type)',
      },
      include_numbers: {
        type: 'boolean',
        required: false,
        description: 'Include numbers 0-9 (default: true)',
      },
      include_uppercase: {
        type: 'boolean',
        required: false,
        description: 'Include uppercase letters A-Z (default: true)',
      },
    },
  },
];
