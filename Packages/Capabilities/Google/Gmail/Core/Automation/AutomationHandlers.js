import * as GmailAPI from '../API/GmailAPI.js';
import { requireGoogleCredentials } from '../../../Common.js';
export const gmailDataSourceCollectors = {
  async gmail_inbox(ctx, dataSource) {
    const credentials = requireGoogleCredentials(ctx),
      brief = await GmailAPI.getEmailBrief(credentials, dataSource.maxResults ?? 20);
    return brief.count
      ? `Gmail Inbox - ${brief.count} unread email(s):\n\n${brief.text}`
      : 'EMPTY: Gmail Inbox has no unread emails.';
  },
  async gmail_search(ctx, dataSource) {
    const credentials = requireGoogleCredentials(ctx);
    if (!dataSource.query) return 'No search query specified.';
    const emails = await GmailAPI.searchEmails(
      credentials,
      dataSource.query,
      dataSource.maxResults ?? 10,
    );
    return emails.length
      ? `Gmail Search "${dataSource.query}" - ${emails.length} result(s):\n\n${(function (
          emails = [],
        ) {
          return emails
            .map(
              (email, index) =>
                `${index + 1}. Subject: "${email.subject}" | From: ${email.from}\n   ${email.snippet}`,
            )
            .join('\n\n');
        })(emails)}`
      : `EMPTY: Gmail search "${dataSource.query}" returned no results.`;
  },
  async gmail_inbox_stats(ctx) {
    const credentials = requireGoogleCredentials(ctx),
      stats = await GmailAPI.getInboxStats(credentials);
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
