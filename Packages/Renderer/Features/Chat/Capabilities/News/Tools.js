export const NEWS_TOOLS = [
  {
    name: 'get_news',
    description:
      'Get the latest news headlines from top sources. Supports categories: technology, business, science, health, sports, entertainment, world. Returns headlines with summaries and links.',
    category: 'news',
    parameters: {
      category: {
        type: 'string',
        required: false,
        description: 'News category: "technology", "business", "science", "health", "sports", "entertainment", "world" (default: "technology")',
      },
      count: {
        type: 'number',
        required: false,
        description: 'Number of headlines to return (default: 8, max: 15)',
      },
    },
  },
  {
    name: 'search_news',
    description:
      'Search for news articles about a specific topic, company, person, or event. Returns recent headlines with summaries and links.',
    category: 'news',
    parameters: {
      query: {
        type: 'string',
        required: true,
        description: 'Topic or keyword to search news for (e.g. "OpenAI", "climate change", "Apple earnings", "FIFA World Cup")',
      },
      count: {
        type: 'number',
        required: false,
        description: 'Number of articles to return (default: 8, max: 15)',
      },
    },
  },
];
