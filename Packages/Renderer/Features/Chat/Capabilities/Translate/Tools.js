export const TRANSLATE_TOOLS = [
  {
    name: 'translate_text',
    description:
      'Translate text between 100+ languages using MyMemory. Supports auto-detection of source language. Use standard language codes like "en", "es", "fr", "de", "ja", "zh", "ar", "hi", "pt", "ru".',
    category: 'translate',
    parameters: {
      text: {
        type: 'string',
        required: true,
        description: 'The text to translate',
      },
      to: {
        type: 'string',
        required: true,
        description: 'Target language code (e.g. "es" for Spanish, "fr" for French, "de" for German, "ja" for Japanese, "zh" for Chinese, "ar" for Arabic, "hi" for Hindi, "pt" for Portuguese, "ru" for Russian)',
      },
      from: {
        type: 'string',
        required: false,
        description: 'Source language code (default: "en"). Use "auto" for auto-detection.',
      },
    },
  },
];
