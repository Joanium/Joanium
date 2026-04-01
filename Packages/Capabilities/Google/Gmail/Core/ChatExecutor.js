import * as GmailAPI from '../../../../Features/Automation/Integrations/Gmail.js';
import { requireGoogleCredentials } from '../../Common.js';

function formatEmailList(emails = [], { starred = false, sent = false } = {}) {
  return emails.map((email, index) => [
    `${index + 1}. ${starred ? '⭐ ' : ''}**${email.subject || '(no subject)'}**`,
    sent ? `   To: ${email.to || 'unknown'}` : `   From: ${email.from || 'unknown'}`,
    `   ID: ${email.id}`,
    email.snippet ? `   Preview: ${email.snippet.slice(0, 100)}` : '',
  ].filter(Boolean).join('\n')).join('\n\n');
}

async function getLabelId(credentials, labelName) {
  const id = await GmailAPI.getLabelId(credentials, labelName);
  if (!id) throw new Error(`Label "${labelName}" not found. Use gmail_list_labels to see available labels.`);
  return id;
}

export async function executeGmailChatTool(ctx, toolName, params = {}) {
  const credentials = requireGoogleCredentials(ctx);

  switch (toolName) {
    case 'gmail_send_email': {
      const { to, subject, body } = params;
      if (!to || !subject || !body) throw new Error('Missing required params: to, subject, body');
      await GmailAPI.sendEmail(credentials, to, subject, body);
      return `Email sent successfully to ${to} with subject "${subject}".`;
    }

    case 'gmail_read_inbox': {
      const maxResults = params.maxResults ?? 15;
      const brief = await GmailAPI.getEmailBrief(credentials, maxResults);
      if (brief.count === 0) return 'Inbox is empty - no unread emails.';
      return `Found ${brief.count} unread email(s):\n\n${brief.text}`;
    }

    case 'gmail_search_emails': {
      const { query, maxResults = 10 } = params;
      if (!query) throw new Error('Missing required param: query');
      const emails = await GmailAPI.searchEmails(credentials, query, maxResults);
      if (!emails.length) return `No emails found matching "${query}".`;
      const lines = emails.map((email, index) => (
        `${index + 1}. Subject: "${email.subject}" | From: ${email.from}\n   ID: ${email.id}\n   Preview: ${email.snippet}`
      )).join('\n\n');
      return `Found ${emails.length} email(s) matching "${query}":\n\n${lines}`;
    }

    case 'gmail_reply': {
      const { messageId, body } = params;
      if (!messageId || !body) throw new Error('Missing required params: messageId, body');
      await GmailAPI.replyToEmail(credentials, messageId, body);
      return `Reply sent successfully for message ${messageId}.`;
    }

    case 'gmail_forward': {
      const { messageId, to, note = '' } = params;
      if (!messageId || !to) throw new Error('Missing required params: messageId, to');
      await GmailAPI.forwardEmail(credentials, messageId, to, note);
      return `Email forwarded to ${to} successfully.`;
    }

    case 'gmail_create_draft': {
      const { to, subject, body, cc = '' } = params;
      if (!to || !subject || !body) throw new Error('Missing required params: to, subject, body');
      const draft = await GmailAPI.createDraft(credentials, to, subject, body, cc);
      return [
        'Draft saved',
        `To: ${to}`,
        `Subject: "${subject}"`,
        cc ? `CC: ${cc}` : '',
        draft?.id ? `Draft ID: ${draft.id}` : '',
      ].filter(Boolean).join('\n');
    }

    case 'gmail_mark_as_read': {
      const { messageId } = params;
      if (!messageId) throw new Error('Missing required param: messageId');
      await GmailAPI.markAsRead(credentials, messageId);
      return `Message ${messageId} marked as read.`;
    }

    case 'gmail_mark_as_unread': {
      const { messageId } = params;
      if (!messageId) throw new Error('Missing required param: messageId');
      await GmailAPI.markAsUnread(credentials, messageId);
      return `Message ${messageId} marked as unread.`;
    }

    case 'gmail_archive_message': {
      const { messageId } = params;
      if (!messageId) throw new Error('Missing required param: messageId');
      await GmailAPI.archiveMessage(credentials, messageId);
      return `Message ${messageId} archived and removed from inbox.`;
    }

    case 'gmail_trash_message': {
      const { messageId } = params;
      if (!messageId) throw new Error('Missing required param: messageId');
      await GmailAPI.trashMessage(credentials, messageId);
      return `Message ${messageId} moved to trash.`;
    }

    case 'gmail_get_inbox_stats': {
      const stats = await GmailAPI.getInboxStats(credentials);
      return [
        'Gmail Inbox Overview',
        '',
        stats.email ? `Account: ${stats.email}` : '',
        stats.unreadEstimate != null ? `Unread: ${stats.unreadEstimate}` : '',
        stats.inboxEstimate != null ? `Inbox messages: ${stats.inboxEstimate}` : '',
        stats.totalMessages != null ? `Total messages: ${stats.totalMessages}` : '',
        stats.totalThreads != null ? `Threads: ${stats.totalThreads}` : '',
      ].filter(Boolean).join('\n');
    }

    case 'gmail_list_labels': {
      const labels = await GmailAPI.listLabels(credentials);
      if (!labels.length) return 'No labels found in this Gmail account.';
      const system = labels.filter(label => label.type === 'system');
      const custom = labels.filter(label => label.type !== 'system');
      const lines = [`Gmail Labels (${labels.length} total)`, ''];
      if (system.length) {
        lines.push(`System labels (${system.length}):`);
        system.forEach(label => lines.push(`  - ${label.name ?? label.id}`));
      }
      if (custom.length) {
        lines.push('', `Custom labels (${custom.length}):`);
        custom.forEach(label => lines.push(`  - ${label.name ?? label.id}`));
      }
      return lines.join('\n');
    }

    case 'gmail_mark_all_read': {
      const count = await GmailAPI.markAllRead(credentials);
      return count > 0
        ? `Marked ${count} email${count !== 1 ? 's' : ''} as read.`
        : 'No unread emails to mark - inbox is already clean.';
    }

    case 'gmail_send_with_cc': {
      const { to, subject, body, cc = '', bcc = '' } = params;
      if (!to || !subject || !body) throw new Error('Missing required params: to, subject, body');
      await GmailAPI.sendEmail(credentials, to, subject, body, cc, bcc);
      return [
        `Email sent to ${to}`,
        cc ? `CC: ${cc}` : '',
        bcc ? `BCC: ${bcc}` : '',
        `Subject: "${subject}"`,
      ].filter(Boolean).join('\n');
    }

    case 'gmail_get_unread_emails': {
      const { maxResults = 20 } = params;
      const emails = await GmailAPI.getUnreadEmails(credentials, maxResults);
      if (!emails.length) return 'No unread emails found.';
      return `${emails.length} unread email${emails.length !== 1 ? 's' : ''}:\n\n${formatEmailList(emails)}`;
    }

    case 'gmail_archive_read_emails': {
      const { maxResults = 100 } = params;
      const count = await GmailAPI.archiveReadEmails(credentials, maxResults);
      return count > 0
        ? `Archived ${count} read email${count !== 1 ? 's' : ''} from your inbox.`
        : 'No read emails found to archive - inbox is already clean.';
    }

    case 'gmail_trash_by_query': {
      const { query, maxResults = 50 } = params;
      if (!query) throw new Error('Missing required param: query');
      const count = await GmailAPI.trashEmailsByQuery(credentials, query, maxResults);
      return count > 0
        ? `Moved ${count} email${count !== 1 ? 's' : ''} matching "${query}" to trash.`
        : `No emails found matching "${query}" - nothing was trashed.`;
    }

    case 'gmail_create_label': {
      const { name, text_color, background_color } = params;
      if (!name) throw new Error('Missing required param: name');
      const colors = {};
      if (text_color) colors.textColor = text_color;
      if (background_color) colors.backgroundColor = background_color;
      const label = await GmailAPI.createLabel(credentials, name, colors);
      return [
        `Label created: "${name}"`,
        label?.id ? `Label ID: ${label.id}` : '',
      ].filter(Boolean).join('\n');
    }

    case 'gmail_add_label': {
      const { messageId, label_name } = params;
      if (!messageId || !label_name) throw new Error('Missing required params: messageId, label_name');
      const labelId = await getLabelId(credentials, label_name);
      await GmailAPI.modifyMessage(credentials, messageId, { addLabels: [labelId], removeLabels: [] });
      return `Label "${label_name}" added to message ${messageId}.`;
    }

    case 'gmail_remove_label': {
      const { messageId, label_name } = params;
      if (!messageId || !label_name) throw new Error('Missing required params: messageId, label_name');
      const labelId = await getLabelId(credentials, label_name);
      await GmailAPI.modifyMessage(credentials, messageId, { addLabels: [], removeLabels: [labelId] });
      return `Label "${label_name}" removed from message ${messageId}.`;
    }

    case 'gmail_get_label_id': {
      const { label_name } = params;
      if (!label_name) throw new Error('Missing required param: label_name');
      const id = await GmailAPI.getLabelId(credentials, label_name);
      if (!id) return `No label named "${label_name}" was found. Use gmail_list_labels to see all labels.`;
      return `Label: "${label_name}"\nID: ${id}`;
    }

    case 'gmail_get_sent_emails': {
      const { maxResults = 10 } = params;
      const emails = await GmailAPI.searchEmails(credentials, 'in:sent', maxResults);
      if (!emails.length) return 'No sent emails found.';
      return `${emails.length} sent email${emails.length !== 1 ? 's' : ''}:\n\n${formatEmailList(emails, { sent: true })}`;
    }

    case 'gmail_get_starred_emails': {
      const { maxResults = 10 } = params;
      const emails = await GmailAPI.searchEmails(credentials, 'is:starred', maxResults);
      if (!emails.length) return 'No starred emails found.';
      return `${emails.length} starred email${emails.length !== 1 ? 's' : ''}:\n\n${formatEmailList(emails, { starred: true })}`;
    }

    default:
      throw new Error(`Unknown Gmail tool: ${toolName}`);
  }
}
