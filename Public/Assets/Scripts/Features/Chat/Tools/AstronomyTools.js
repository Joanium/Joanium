export const ASTRONOMY_TOOLS = [
    {
        name: 'get_apod',
        description: 'Get NASA\'s Astronomy Picture of the Day — a stunning space image with scientific explanation. Optionally request a specific date.',
        category: 'nasa',
        parameters: {
            date: { type: 'string', required: false, description: 'Specific date in YYYY-MM-DD format (default: today). Available from 1995-06-16.' },
        },
    },
    {
        name: 'get_iss_location',
        description: 'Get the real-time location of the International Space Station — latitude, longitude, and which country it\'s currently above.',
        category: 'nasa',
        parameters: {},
    },
];
