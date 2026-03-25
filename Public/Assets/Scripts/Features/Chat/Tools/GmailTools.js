export const GMAIL_TOOLS = [
    {
        name: 'gmail_send_email',
        description: "Send an email via the user's connected Gmail account.",
        category: 'gmail',
        parameters: {
            to: { type: 'string', required: true, description: 'Recipient email address' },
            subject: { type: 'string', required: true, description: 'Email subject line' },
            body: { type: 'string', required: true, description: 'Email body / message content' },
        },
    },
    {
        name: 'gmail_read_inbox',
        description: "Fetch and summarize the user's unread emails from Gmail.",
        category: 'gmail',
        parameters: {
            maxResults: { type: 'number', required: false, description: 'Max emails to fetch (default 15)' },
        },
    },
    {
        name: 'gmail_search_emails',
        description: "Search the user's Gmail inbox for emails matching a query.",
        category: 'gmail',
        parameters: {
            query: { type: 'string', required: true, description: 'Gmail search query (e.g. "from:boss", "project alpha")' },
            maxResults: { type: 'number', required: false, description: 'Max results (default 10)' },
        },
    },
];