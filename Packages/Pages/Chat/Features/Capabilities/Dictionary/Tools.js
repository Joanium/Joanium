export const DICTIONARY_TOOLS = [
  {
    name: 'get_definition',
    description:
      'Look up the full dictionary definition of any English word — meanings, parts of speech, examples, synonyms, antonyms, phonetics, and etymology.',
    category: 'dictionary',
    parameters: {
      word: {
        type: 'string',
        required: !0,
        description: 'The word to look up (e.g. "ephemeral", "serendipity", "ubiquitous")',
      },
    },
  },
];
