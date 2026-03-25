export const URL_TOOLS = [
    {
        name: 'shorten_url',
        description: 'Shorten a long URL into a compact, shareable link using CleanURI.',
        category: 'cleanuri',
        parameters: {
            url: { type: 'string', required: true, description: 'The full URL to shorten (e.g. "https://example.com/very/long/path")' },
        },
    },
];
