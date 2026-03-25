const HANDLED = new Set(['gmail_send_email', 'gmail_read_inbox', 'gmail_search_emails']);

export function handles(toolName) { return HANDLED.has(toolName); }

export async function execute(toolName, params, onStage = () => { }) {
    switch (toolName) {

        case 'gmail_send_email': {
            const { to, subject, body } = params;
            if (!to || !subject || !body) throw new Error('Missing required params: to, subject, body');
            onStage(`[GMAIL] Sending email to ${to}…`);
            const res = await window.electronAPI?.gmailSend?.(to, subject, body);
            if (!res?.ok) throw new Error(res?.error ?? 'Failed to send email');
            return `Email sent successfully to ${to} with subject "${subject}".`;
        }

        case 'gmail_read_inbox': {
            const maxResults = params.maxResults ?? 15;
            onStage(`[GMAIL] Connecting to Gmail…`);
            onStage(`[GMAIL] Fetching unread emails…`);
            const res = await window.electronAPI?.gmailGetBrief?.(maxResults);
            if (!res?.ok) throw new Error(res?.error ?? 'Gmail not connected');
            onStage(`[GMAIL] Reading ${res.count} email${res.count !== 1 ? 's' : ''}…`);
            if (res.count === 0) return 'Inbox is empty — no unread emails.';
            return `Found ${res.count} unread email(s):\n\n${res.text}`;
        }

        case 'gmail_search_emails': {
            const { query, maxResults = 10 } = params;
            if (!query) throw new Error('Missing required param: query');
            onStage(`[GMAIL] Searching for "${query}"…`);
            const res = await window.electronAPI?.gmailSearch?.(query, maxResults);
            if (!res?.ok) throw new Error(res?.error ?? 'Gmail error');
            if (!res.emails?.length) return `No emails found matching "${query}".`;
            const lines = res.emails.map((e, i) =>
                `${i + 1}. Subject: "${e.subject}" | From: ${e.from}\n   Preview: ${e.snippet}`
            ).join('\n\n');
            return `Found ${res.emails.length} email(s) matching "${query}":\n\n${lines}`;
        }

        default:
            throw new Error(`GmailExecutor: unknown tool "${toolName}"`);
    }
}