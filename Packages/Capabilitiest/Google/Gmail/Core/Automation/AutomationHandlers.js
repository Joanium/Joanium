import { sendNotification } from '../../../../../Features/Automation/Actions/Notification.js';
import * as GmailAPI from '../API/GmailAPI.js';
import { requireGoogleCredentials } from '../../../Common.js';

function previewBrief(brief) {
  if (!brief?.text) return 'Inbox is clear.';
  return brief.text.split('\n\n').slice(0, 2).join('\n\n');
}

export const gmailAutomationHandlers = {
  async gmail_send_email(ctx, action) {
    const credentials = requireGoogleCredentials(ctx);
    await GmailAPI.sendEmail(
      credentials,
      action.to,
      action.subject,
      action.gmailBody ?? action.body ?? '',
      action.cc ?? '',
      action.bcc ?? '',
    );
  },

  async gmail_get_brief(ctx, action) {
    const credentials = requireGoogleCredentials(ctx);
    const brief = await GmailAPI.getEmailBrief(credentials, action.maxResults ?? 10);
    sendNotification(
      `Gmail - ${brief.count} unread`,
      brief.count === 0 ? 'Inbox is clear.' : previewBrief(brief),
    );
  },

  async gmail_get_unread_count(ctx) {
    const credentials = requireGoogleCredentials(ctx);
    const brief = await GmailAPI.getEmailBrief(credentials, 100);
    sendNotification(
      `Gmail: ${brief.count} unread email${brief.count !== 1 ? 's' : ''}`,
      brief.count === 0 ? 'Inbox is clear.' : `You have ${brief.count} unread emails.`,
    );
  },

  async gmail_search_notify(ctx, action) {
    const credentials = requireGoogleCredentials(ctx);
    if (!action.query) throw new Error('gmail_search_notify: query required');
    const emails = await GmailAPI.searchEmails(credentials, action.query, action.maxResults ?? 5);
    const subjects = emails.slice(0, 3).map(email => email.subject).filter(Boolean).join(' · ');
    sendNotification(
      `"${action.query}" - ${emails.length} result${emails.length === 1 ? '' : 's'}`,
      subjects || 'No matching emails.',
    );
  },

  async gmail_reply(ctx, action) {
    const credentials = requireGoogleCredentials(ctx);
    if (!action.messageId) throw new Error('gmail_reply: messageId required');
    if (!(action.gmailBody ?? action.body)) throw new Error('gmail_reply: body required');
    await GmailAPI.replyToEmail(credentials, action.messageId, action.gmailBody ?? action.body);
    sendNotification('Reply sent', `Replied to message ${action.messageId}`);
  },

  async gmail_forward(ctx, action) {
    const credentials = requireGoogleCredentials(ctx);
    if (!action.messageId) throw new Error('gmail_forward: messageId required');
    if (!action.forwardTo) throw new Error('gmail_forward: forwardTo required');
    await GmailAPI.forwardEmail(credentials, action.messageId, action.forwardTo, action.note ?? '');
    sendNotification('Email forwarded', `Forwarded to ${action.forwardTo}`);
  },

  async gmail_mark_all_read(ctx) {
    const credentials = requireGoogleCredentials(ctx);
    const count = await GmailAPI.markAllRead(credentials);
    sendNotification(
      count === 0 ? 'Already all read' : `Marked ${count} emails as read`,
      count === 0 ? 'No unread emails found.' : `${count} messages marked as read.`,
    );
  },

  async gmail_archive_read(ctx, action) {
    const credentials = requireGoogleCredentials(ctx);
    const count = await GmailAPI.archiveReadEmails(credentials, action.maxResults ?? 100);
    sendNotification(
      count === 0 ? 'Inbox already clean' : `Archived ${count} emails`,
      count === 0 ? 'No read emails in inbox.' : `Moved ${count} read emails out of inbox.`,
    );
  },

  async gmail_trash_by_query(ctx, action) {
    const credentials = requireGoogleCredentials(ctx);
    if (!action.query) throw new Error('gmail_trash_by_query: query required');
    const count = await GmailAPI.trashEmailsByQuery(credentials, action.query, action.maxResults ?? 50);
    sendNotification(
      `Trashed ${count} email${count === 1 ? '' : 's'}`,
      `Query: "${action.query}"`,
    );
  },

  async gmail_create_draft(ctx, action) {
    const credentials = requireGoogleCredentials(ctx);
    if (!action.to || !action.subject) throw new Error('gmail_create_draft: to and subject required');
    await GmailAPI.createDraft(credentials, action.to, action.subject, action.gmailBody ?? action.body ?? '', action.cc ?? '');
    sendNotification('Draft saved', `To: ${action.to} · Subject: ${action.subject}`);
  },

  async gmail_inbox_stats(ctx) {
    const credentials = requireGoogleCredentials(ctx);
    const stats = await GmailAPI.getInboxStats(credentials);
    sendNotification(
      `Inbox: ${stats.unreadEstimate} unread`,
      `Inbox: ~${stats.inboxEstimate} msgs · Total: ${stats.totalMessages} · Threads: ${stats.totalThreads}`,
    );
  },

  async gmail_label_emails(ctx, action) {
    const credentials = requireGoogleCredentials(ctx);
    if (!action.query) throw new Error('gmail_label_emails: query required');
    if (!action.labelName) throw new Error('gmail_label_emails: labelName required');

    const labelId = await GmailAPI.getLabelId(credentials, action.labelName);
    if (!labelId) throw new Error(`gmail_label_emails: label "${action.labelName}" not found in Gmail`);

    const emails = await GmailAPI.searchEmails(credentials, action.query, action.maxResults ?? 20);
    if (!emails.length) {
      sendNotification('No emails to label', `Query: "${action.query}"`);
      return;
    }

    await Promise.all(emails.map(email => (
      GmailAPI.modifyMessage(credentials, email.id, { addLabels: [labelId], removeLabels: [] })
    )));

    sendNotification(
      `Labeled ${emails.length} email${emails.length === 1 ? '' : 's'}`,
      `Label: ${action.labelName} · Query: "${action.query}"`,
    );
  },
};
