export const HACKERNEWS_TOOLS = [
    {
        name: 'get_hacker_news',
        description: 'Get the top stories from Hacker News (Y Combinator) — the leading tech/startup news aggregator. Returns titles, scores, authors, and links.',
        category: 'hackernews',
        parameters: {
            count: { type: 'number', required: false, description: 'Number of stories to return (default: 5, max: 15)' },
            type: { type: 'string', required: false, description: 'Story type: "top" (default), "new", "best", or "ask"' },
        },
    },
];
