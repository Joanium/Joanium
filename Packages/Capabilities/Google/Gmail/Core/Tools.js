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
        description: "Search the user's Gmail inbox for emails matching a query. Returns message IDs needed for reply, forward, archive, and trash tools.",
        category: 'gmail',
        parameters: {
            query: { type: 'string', required: true, description: 'Gmail search query (e.g. "from:boss", "project alpha", "is:unread")' },
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
    {
        name: 'gmail_send_with_cc',
        description: "Send an email with CC and BCC recipients via the user's Gmail account.",
        category: 'gmail',
        parameters: {
            to: { type: 'string', required: true, description: 'Primary recipient email address' },
            subject: { type: 'string', required: true, description: 'Email subject line' },
            body: { type: 'string', required: true, description: 'Email body / message content' },
            cc: { type: 'string', required: false, description: 'CC recipient(s), comma-separated' },
            bcc: { type: 'string', required: false, description: 'BCC recipient(s), comma-separated' },
        },
    },
    {
        name: 'gmail_get_unread_emails',
        description: "Fetch the user's unread emails from Gmail with full details — sender, subject, snippet, and message IDs.",
        category: 'gmail',
        parameters: {
            maxResults: { type: 'number', required: false, description: 'Max emails to return (default: 20)' },
        },
    },
    {
        name: 'gmail_archive_read_emails',
        description: 'Bulk archive all read (already-opened) emails from the inbox to clean it up.',
        category: 'gmail',
        parameters: {
            maxResults: { type: 'number', required: false, description: 'Max read emails to archive in one pass (default: 100)' },
        },
    },
    {
        name: 'gmail_trash_by_query',
        description: 'Move all emails matching a Gmail search query to trash in bulk. Useful for cleaning out newsletters, promotions, or emails from a specific sender.',
        category: 'gmail',
        parameters: {
            query: { type: 'string', required: true, description: 'Gmail search query — all matching emails will be trashed (e.g. "from:newsletter@spam.com", "older_than:1y", "label:promotions")' },
            maxResults: { type: 'number', required: false, description: 'Max emails to trash in one pass (default: 50)' },
        },
    },
    {
        name: 'gmail_create_label',
        description: "Create a new custom label in the user's Gmail account.",
        category: 'gmail',
        parameters: {
            name: { type: 'string', required: true, description: 'Name for the new label (e.g. "Work/Urgent")' },
            text_color: { type: 'string', required: false, description: 'Label text color as hex (e.g. "#ffffff")' },
            background_color: { type: 'string', required: false, description: 'Label background color as hex (e.g. "#cc3a21")' },
        },
    },
    {
        name: 'gmail_add_label',
        description: 'Add a label to a specific email message.',
        category: 'gmail',
        parameters: {
            messageId: { type: 'string', required: true, description: 'Gmail message ID' },
            label_name: { type: 'string', required: true, description: 'Label name to apply (e.g. "Work/Urgent"). Use gmail_get_label_id first if needed.' },
        },
    },
    {
        name: 'gmail_remove_label',
        description: 'Remove a label from a specific email message.',
        category: 'gmail',
        parameters: {
            messageId: { type: 'string', required: true, description: 'Gmail message ID' },
            label_name: { type: 'string', required: true, description: 'Label name to remove from the message.' },
        },
    },
    {
        name: 'gmail_get_label_id',
        description: "Look up the internal Gmail label ID for a label by its display name. Useful before applying or removing labels programmatically.",
        category: 'gmail',
        parameters: {
            label_name: { type: 'string', required: true, description: 'Display name of the label (e.g. "Work/Urgent", "INBOX", "SPAM")' },
        },
    },
    {
        name: 'gmail_get_sent_emails',
        description: "Fetch recently sent emails from the user's Gmail Sent folder.",
        category: 'gmail',
        parameters: {
            maxResults: { type: 'number', required: false, description: 'Max sent emails to return (default: 10)' },
        },
    },
    {
        name: 'gmail_get_starred_emails',
        description: "Fetch emails the user has starred in Gmail.",
        category: 'gmail',
        parameters: {
            maxResults: { type: 'number', required: false, description: 'Max starred emails to return (default: 10)' },
        },
    },
];