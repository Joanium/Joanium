export const PHOTO_TOOLS = [
    {
        name: 'search_photos',
        description: 'Search for high-quality free photos on Unsplash. Returns photo URLs, descriptions, and photographer credits. Requires Unsplash API key.',
        category: 'unsplash',
        parameters: {
            query: { type: 'string', required: true, description: 'Search query (e.g. "sunset mountain", "minimal workspace", "urban street")' },
            count: { type: 'number', required: false, description: 'Number of photos to return (default: 5, max: 10)' },
            orientation: { type: 'string', required: false, description: 'Photo orientation: "landscape", "portrait", or "squarish"' },
        },
    },
];