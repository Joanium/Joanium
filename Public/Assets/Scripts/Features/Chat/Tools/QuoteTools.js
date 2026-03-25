export const QUOTE_TOOLS = [
    {
        name: 'get_quote',
        description: 'Get an inspirational or thought-provoking quote. Can filter by tag/topic like love, wisdom, technology, life, happiness.',
        category: 'quotes',
        parameters: {
            tag: { type: 'string', required: false, description: 'Quote topic/tag (e.g. "wisdom", "technology", "love", "life", "humor", "happiness")' },
        },
    },
];
