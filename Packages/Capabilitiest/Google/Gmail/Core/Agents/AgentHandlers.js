import * as GmailAPI from '../API/GmailAPI.js';
import { requireGoogleCredentials } from '../../../Common.js';

function formatEmailLines(emails = []) {
  return emails.map((email, index) => (
    `${index + 1}. Subject: "${email.subject}" | From: ${email.from}\n   ${email.snippet}`
  )).join('\n\n');
}

export const gmailDataSourceCollectors = {
  async gmail_inbox(ctx, dataSource) {
    const credentials = requireGoogleCredentials(ctx);
    const brief = await GmailAPI.getEmailBrief(credentials, dataSource.maxResults ?? 20);
    if (!brief.count) return 'EMPTY: Gmail Inbox has no unread emails.';
    return `Gmail Inbox - ${brief.count} unread email(s):\n\n${brief.text}`;
  },

  async gmail_search(ctx, dataSource) {
    const credentials = requireGoogleCredentials(ctx);
    if (!dataSource.query) return 'No search query specified.';
    const emails = await GmailAPI.searchEmails(credentials, dataSource.query, dataSource.maxResults ?? 10);
    if (!emails.length) return `EMPTY: Gmail search "${dataSource.query}" returned no results.`;
    return `Gmail Search "${dataSource.query}" - ${emails.length} result(s):\n\n${formatEmailLines(emails)}`;
  },

  async gmail_inbox_stats(ctx) {
    const credentials = requireGoogleCredentials(ctx);
    const stats = await GmailAPI.getInboxStats(credentials);
    return [
      'Gmail Inbox Stats',
      `Account: ${stats.email ?? 'unknown'}`,
      `Unread: ${stats.unreadEstimate ?? 0}`,
      `Inbox estimate: ${stats.inboxEstimate ?? 0}`,
      `Total messages: ${stats.totalMessages ?? 0}`,
      `Threads: ${stats.totalThreads ?? 0}`,
    ].join('\n');
  },
};
