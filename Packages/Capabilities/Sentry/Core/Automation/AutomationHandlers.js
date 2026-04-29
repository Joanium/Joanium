import * as SentryAPI from '../API/SentryAPI.js';
import { requireSentryCredentials } from '../Shared/Common.js';

export const sentryDataSourceCollectors = {
  async sentry_unresolved_issues(ctx) {
    const creds = requireSentryCredentials(ctx);
    const orgSlug = creds.orgSlug;
    if (!orgSlug) throw new Error('No Sentry organization found. Please reconnect.');
    const issues = await SentryAPI.listIssues(creds, orgSlug, 25);
    if (!issues.length) return 'EMPTY: No unresolved Sentry issues found.';
    const fatal = issues.filter((i) => i.level === 'fatal');
    const errors = issues.filter((i) => i.level === 'error');
    const summary = [
      `${issues.length} total`,
      fatal.length ? `${fatal.length} fatal` : null,
      errors.length ? `${errors.length} error` : null,
    ]
      .filter(Boolean)
      .join(', ');
    return [
      `Sentry Unresolved Issues - ${summary}:`,
      '',
      ...issues.map(
        (iss, i) =>
          `${i + 1}. [${(iss.level ?? 'unknown').toUpperCase()}] ${iss.title} - ${iss.count} events, last seen ${iss.lastSeen ? new Date(iss.lastSeen).toLocaleDateString() : 'unknown'} (${iss.project})`,
      ),
    ].join('\n');
  },
};

export const sentryOutputHandlers = {};
