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
    {
        name: 'gmail_reply',
        description: 'Reply to a specific email by message ID. Use gmail_search_emails first to find the message ID.',
        category: 'gmail',
        parameters: {
            messageId: { type: 'string', required: true, description: 'Gmail message ID to reply to' },
            body: { type: 'string', required: true, description: 'Reply text / body' },
        },
    },
    {
        name: 'gmail_forward',
        description: 'Forward a specific email to one or more recipients.',
        category: 'gmail',
        parameters: {
            messageId: { type: 'string', required: true, description: 'Gmail message ID to forward' },
            to: { type: 'string', required: true, description: 'Recipient email address to forward to' },
            note: { type: 'string', required: false, description: 'Optional note to prepend to the forwarded email' },
        },
    },
    {
        name: 'gmail_create_draft',
        description: "Save an email as a draft in the user's Gmail account without sending it.",
        category: 'gmail',
        parameters: {
            to: { type: 'string', required: true, description: 'Recipient email address' },
            subject: { type: 'string', required: true, description: 'Email subject line' },
            body: { type: 'string', required: true, description: 'Email body / content' },
            cc: { type: 'string', required: false, description: 'CC email address(es)' },
        },
    },
    {
        name: 'gmail_mark_as_read',
        description: 'Mark a specific email as read.',
        category: 'gmail',
        parameters: {
            messageId: { type: 'string', required: true, description: 'Gmail message ID to mark as read' },
        },
    },
    {
        name: 'gmail_mark_as_unread',
        description: 'Mark a specific email as unread.',
        category: 'gmail',
        parameters: {
            messageId: { type: 'string', required: true, description: 'Gmail message ID to mark as unread' },
        },
    },
    {
        name: 'gmail_archive_message',
        description: 'Archive a specific email, removing it from the inbox without deleting it.',
        category: 'gmail',
        parameters: {
            messageId: { type: 'string', required: true, description: 'Gmail message ID to archive' },
        },
    },
    {
        name: 'gmail_trash_message',
        description: 'Move a specific email to the trash.',
        category: 'gmail',
        parameters: {
            messageId: { type: 'string', required: true, description: 'Gmail message ID to move to trash' },
        },
    },
    {
        name: 'gmail_get_inbox_stats',
        description: "Get a quick overview of the user's Gmail inbox — total messages, unread count, and label summaries.",
        category: 'gmail',
        parameters: {},
    },
    {
        name: 'gmail_list_labels',
        description: "List all labels in the user's Gmail account, including system labels (Inbox, Sent, Spam) and custom ones.",
        category: 'gmail',
        parameters: {},
    },
    {
        name: 'gmail_mark_all_read',
        description: "Mark all unread emails in the user's Gmail inbox as read in one go.",
        category: 'gmail',
        parameters: {},
    },
];