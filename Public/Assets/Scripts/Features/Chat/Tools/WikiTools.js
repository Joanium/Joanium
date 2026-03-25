export const WIKI_TOOLS = [
    {
        name: 'search_wikipedia',
        description: 'Search Wikipedia for any topic and get a concise summary, extract, and link. Great for quick knowledge lookups.',
        category: 'wikipedia',
        parameters: {
            query: { type: 'string', required: true, description: 'Topic to search for (e.g. "quantum computing", "Roman Empire", "photosynthesis")' },
        },
    },
];
