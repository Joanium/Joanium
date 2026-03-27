export const SEARCH_TOOLS = [
  {
    name: 'search_web',
    description:
      'Search the web for any topic and get instant answers, related topics, and result summaries using DuckDuckGo. Great for quick lookups, current events, definitions, and general knowledge.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: true,
        description: 'The search query (e.g. "latest SpaceX launch", "how to center a div in CSS", "who is the CEO of Apple")',
      },
    },
  },
];
