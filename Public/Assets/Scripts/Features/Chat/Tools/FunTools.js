export const FUN_TOOLS = [
    {
        name: 'get_random_fact',
        description: 'Get a random fun or useless fact. Great for entertainment, icebreakers, or trivia.',
        category: 'funfacts',
        parameters: {},
    },
    {
        name: 'get_number_fact',
        description: 'Get an interesting trivia fact about a specific number or date. Supports math facts, trivia, year history, and date facts.',
        category: 'funfacts',
        parameters: {
            number: { type: 'string', required: true, description: 'A number (e.g. "42", "1969") or a date in month/day format (e.g. "3/14" for March 14th)' },
            type: { type: 'string', required: false, description: 'Fact type: "trivia" (default), "math", "year", or "date"' },
        },
    },
];
