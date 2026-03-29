const HANDLED = new Set([
    'gmail_send_email', 'gmail_read_inbox', 'gmail_search_emails',
    'gmail_reply', 'gmail_forward', 'gmail_create_draft',
    'gmail_mark_as_read', 'gmail_mark_as_unread', 'gmail_archive_message',
    'gmail_trash_message', 'gmail_get_inbox_stats', 'gmail_list_labels',
    'gmail_mark_all_read',
]);

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
                `${i + 1}. Subject: "${e.subject}" | From: ${e.from}\n   ID: ${e.id}\n   Preview: ${e.snippet}`
            ).join('\n\n');
            return `Found ${res.emails.length} email(s) matching "${query}":\n\n${lines}`;
        }

        case 'gmail_reply': {
            const { messageId, body } = params;
            if (!messageId || !body) throw new Error('Missing required params: messageId, body');
            onStage(`[GMAIL] Replying to message ${messageId}…`);
            const res = await window.electronAPI?.gmailReply?.(messageId, body);
            if (!res?.ok) throw new Error(res?.error ?? 'Failed to send reply');
            return `✅ Reply sent successfully for message ${messageId}.`;
        }

        case 'gmail_forward': {
            const { messageId, to, note = '' } = params;
            if (!messageId || !to) throw new Error('Missing required params: messageId, to');
            onStage(`[GMAIL] Forwarding message ${messageId} to ${to}…`);
            const res = await window.electronAPI?.gmailForward?.(messageId, to, note);
            if (!res?.ok) throw new Error(res?.error ?? 'Failed to forward email');
            return `✅ Email forwarded to ${to} successfully.`;
        }

        case 'gmail_create_draft': {
            const { to, subject, body, cc = '' } = params;
            if (!to || !subject || !body) throw new Error('Missing required params: to, subject, body');
            onStage(`[GMAIL] Saving draft to ${to}…`);
            const res = await window.electronAPI?.gmailCreateDraft?.(to, subject, body, cc);
            if (!res?.ok) throw new Error(res?.error ?? 'Failed to create draft');
            const draft = res.draft;
            return [
                `✅ Draft saved`,
                `To: ${to}`,
                `Subject: "${subject}"`,
                cc ? `CC: ${cc}` : '',
                draft?.id ? `Draft ID: ${draft.id}` : '',
            ].filter(Boolean).join('\n');
        }

        case 'gmail_mark_as_read': {
            const { messageId } = params;
            if (!messageId) throw new Error('Missing required param: messageId');
            onStage(`[GMAIL] Marking message as read…`);
            const res = await window.electronAPI?.gmailMarkAsRead?.(messageId);
            if (!res?.ok) throw new Error(res?.error ?? 'Failed to mark as read');
            return `✅ Message ${messageId} marked as read.`;
        }

        case 'gmail_mark_as_unread': {
            const { messageId } = params;
            if (!messageId) throw new Error('Missing required param: messageId');
            onStage(`[GMAIL] Marking message as unread…`);
            const res = await window.electronAPI?.gmailMarkAsUnread?.(messageId);
            if (!res?.ok) throw new Error(res?.error ?? 'Failed to mark as unread');
            return `✅ Message ${messageId} marked as unread.`;
        }

        case 'gmail_archive_message': {
            const { messageId } = params;
            if (!messageId) throw new Error('Missing required param: messageId');
            onStage(`[GMAIL] Archiving message ${messageId}…`);
            const res = await window.electronAPI?.gmailArchiveMessage?.(messageId);
            if (!res?.ok) throw new Error(res?.error ?? 'Failed to archive message');
            return `✅ Message ${messageId} archived and removed from inbox.`;
        }

        case 'gmail_trash_message': {
            const { messageId } = params;
            if (!messageId) throw new Error('Missing required param: messageId');
            onStage(`[GMAIL] Moving message ${messageId} to trash…`);
            const res = await window.electronAPI?.gmailTrashMessage?.(messageId);
            if (!res?.ok) throw new Error(res?.error ?? 'Failed to trash message');
            return `✅ Message ${messageId} moved to trash.`;
        }

        case 'gmail_get_inbox_stats': {
            onStage(`[GMAIL] Fetching inbox stats…`);
            const res = await window.electronAPI?.gmailInboxStats?.();
            if (!res?.ok) throw new Error(res?.error ?? 'Gmail not connected');
            const stats = res.stats ?? {};
            const lines = [
                `📬 Gmail Inbox Overview`,
                ``,
                stats.unread != null ? `Unread: ${stats.unread}` : '',
                stats.total != null ? `Total messages: ${stats.total}` : '',
                stats.threads != null ? `Threads: ${stats.threads}` : '',
                stats.unreadThreads != null ? `Unread threads: ${stats.unreadThreads}` : '',
            ].filter(Boolean);

            if (stats.labels?.length) {
                lines.push(``, `Label breakdown:`);
                stats.labels.slice(0, 10).forEach(label => {
                    const name = label.name ?? label.id ?? 'Unknown';
                    const unread = label.messagesUnread != null ? ` (${label.messagesUnread} unread)` : '';
                    lines.push(`  • ${name}${unread}`);
                });
            }

            return lines.join('\n');
        }

        case 'gmail_list_labels': {
            onStage(`[GMAIL] Fetching labels…`);
            const res = await window.electronAPI?.gmailListLabels?.();
            if (!res?.ok) throw new Error(res?.error ?? 'Gmail not connected');
            const labels = res.labels ?? [];
            if (!labels.length) return 'No labels found in this Gmail account.';

            const system = labels.filter(l => l.type === 'system');
            const custom = labels.filter(l => l.type !== 'system');

            const lines = [`📋 Gmail Labels (${labels.length} total)`, ``];

            if (system.length) {
                lines.push(`**System labels (${system.length}):**`);
                system.forEach(l => lines.push(`  • ${l.name ?? l.id}`));
            }
            if (custom.length) {
                lines.push(``, `**Custom labels (${custom.length}):**`);
                custom.forEach(l => lines.push(`  • ${l.name ?? l.id}`));
            }

            return lines.join('\n');
        }

        case 'gmail_mark_all_read': {
            onStage(`[GMAIL] Marking all emails as read…`);
            const res = await window.electronAPI?.gmailMarkAllRead?.();
            if (!res?.ok) throw new Error(res?.error ?? 'Failed to mark all as read');
            const count = res.count ?? 0;
            return count > 0
                ? `✅ Marked ${count} email${count !== 1 ? 's' : ''} as read.`
                : '✅ No unread emails to mark — inbox is already clean.';
        }

        default:
            throw new Error(`GmailExecutor: unknown tool "${toolName}"`);
    }
}