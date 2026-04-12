export const PHOTO_TOOLS = [
  {
    name: 'search_photos',
    description:
      'Search for high-quality free photos on Unsplash. Returns photo URLs, descriptions, and photographer credits. Requires Unsplash API key.',
    category: 'unsplash',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description: 'Search query (e.g. "sunset mountain", "minimal workspace", "urban street")',
      },
      count: {
        type: 'number',
        required: !1,
        description: 'Number of photos to return (default: 10, max: 30)',
      },
      orientation: {
        type: 'string',
        required: !1,
        description: 'Photo orientation: "landscape", "portrait", or "squarish"',
      },
    },
  },
];
