export const JOKE_TOOLS = [
    {
        name: 'get_joke',
        description: 'Get a random joke. Supports categories: programming, pun, dark, spooky, christmas, misc. Can be one-liner or two-part (setup/delivery).',
        category: 'jokeapi',
        parameters: {
            category: { type: 'string', required: false, description: 'Joke category: "programming", "pun", "misc", "dark", "spooky", "christmas". Default: any' },
        },
    },
];
