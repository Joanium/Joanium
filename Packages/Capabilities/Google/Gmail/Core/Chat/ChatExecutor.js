import * as GmailAPI from '../API/GmailAPI.js';
import { requireGoogleCredentials } from '../../../Common.js';
function formatEmailList(emails = [], { starred: starred = !1, sent: sent = !1 } = {}) {
  return emails
    .map((email, index) =>
      [
        `${index + 1}. ${starred ? '⭐ ' : ''}**${email.subject || '(no subject)'}**`,
        sent ? `   To: ${email.to || 'unknown'}` : `   From: ${email.from || 'unknown'}`,
        `   ID: ${email.id}`,
        email.snippet ? `   Preview: ${email.snippet.slice(0, 100)}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n');
}
async function getLabelId(credentials, labelName) {
  const id = await GmailAPI.getLabelId(credentials, labelName);
  if (!id)
    throw new Error(
      `Label "${labelName}" not found. Use gmail_list_labels to see available labels.`,
    );
  return id;
}
export async function executeGmailChatTool(ctx, toolName, params = {}) {
  const credentials = requireGoogleCredentials(ctx);
  switch (toolName) {
    case 'gmail_send_email': {
      const { to: to, subject: subject, body: body } = params;
      if (!to || !subject || !body) throw new Error('Missing required params: to, subject, body');
      return (
        await GmailAPI.sendEmail(credentials, to, subject, body),
        `Email sent successfully to ${to} with subject "${subject}".`
      );
    }
    case 'gmail_read_inbox': {
      const maxResults = params.maxResults ?? 15,
        brief = await GmailAPI.getEmailBrief(credentials, maxResults);
      return 0 === brief.count
        ? 'Inbox is empty - no unread emails.'
        : `Found ${brief.count} unread email(s):\n\n${brief.text}`;
    }
    case 'gmail_search_emails': {
      const { query: query, maxResults: maxResults = 10 } = params;
      if (!query) throw new Error('Missing required param: query');
      const emails = await GmailAPI.searchEmails(credentials, query, maxResults);
      if (!emails.length) return `No emails found matching "${query}".`;
      const lines = emails
        .map(
          (email, index) =>
            `${index + 1}. Subject: "${email.subject}" | From: ${email.from}\n   ID: ${email.id}\n   Preview: ${email.snippet}`,
        )
        .join('\n\n');
      return `Found ${emails.length} email(s) matching "${query}":\n\n${lines}`;
    }
    case 'gmail_reply': {
      const { messageId: messageId, body: body } = params;
      if (!messageId || !body) throw new Error('Missing required params: messageId, body');
      return (
        await GmailAPI.replyToEmail(credentials, messageId, body),
        `Reply sent successfully for message ${messageId}.`
      );
    }
    case 'gmail_forward': {
      const { messageId: messageId, to: to, note: note = '' } = params;
      if (!messageId || !to) throw new Error('Missing required params: messageId, to');
      return (
        await GmailAPI.forwardEmail(credentials, messageId, to, note),
        `Email forwarded to ${to} successfully.`
      );
    }
    case 'gmail_create_draft': {
      const { to: to, subject: subject, body: body, cc: cc = '' } = params;
      if (!to || !subject || !body) throw new Error('Missing required params: to, subject, body');
      const draft = await GmailAPI.createDraft(credentials, to, subject, body, cc);
      return [
        'Draft saved',
        `To: ${to}`,
        `Subject: "${subject}"`,
        cc ? `CC: ${cc}` : '',
        draft?.id ? `Draft ID: ${draft.id}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'gmail_mark_as_read': {
      const { messageId: messageId } = params;
      if (!messageId) throw new Error('Missing required param: messageId');
      return (
        await GmailAPI.markAsRead(credentials, messageId),
        `Message ${messageId} marked as read.`
      );
    }
    case 'gmail_mark_as_unread': {
      const { messageId: messageId } = params;
      if (!messageId) throw new Error('Missing required param: messageId');
      return (
        await GmailAPI.markAsUnread(credentials, messageId),
        `Message ${messageId} marked as unread.`
      );
    }
    case 'gmail_archive_message': {
      const { messageId: messageId } = params;
      if (!messageId) throw new Error('Missing required param: messageId');
      return (
        await GmailAPI.archiveMessage(credentials, messageId),
        `Message ${messageId} archived and removed from inbox.`
      );
    }
    case 'gmail_trash_message': {
      const { messageId: messageId } = params;
      if (!messageId) throw new Error('Missing required param: messageId');
      return (
        await GmailAPI.trashMessage(credentials, messageId),
        `Message ${messageId} moved to trash.`
      );
    }
    case 'gmail_get_inbox_stats': {
      const stats = await GmailAPI.getInboxStats(credentials);
      return [
        'Gmail Inbox Overview',
        '',
        stats.email ? `Account: ${stats.email}` : '',
        null != stats.unreadEstimate ? `Unread: ${stats.unreadEstimate}` : '',
        null != stats.inboxEstimate ? `Inbox messages: ${stats.inboxEstimate}` : '',
        null != stats.totalMessages ? `Total messages: ${stats.totalMessages}` : '',
        null != stats.totalThreads ? `Threads: ${stats.totalThreads}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'gmail_list_labels': {
      const labels = await GmailAPI.listLabels(credentials);
      if (!labels.length) return 'No labels found in this Gmail account.';
      const system = labels.filter((label) => 'system' === label.type),
        custom = labels.filter((label) => 'system' !== label.type),
        lines = [`Gmail Labels (${labels.length} total)`, ''];
      return (
        system.length &&
          (lines.push(`System labels (${system.length}):`),
          system.forEach((label) => lines.push(`  - ${label.name ?? label.id}`))),
        custom.length &&
          (lines.push('', `Custom labels (${custom.length}):`),
          custom.forEach((label) => lines.push(`  - ${label.name ?? label.id}`))),
        lines.join('\n')
      );
    }
    case 'gmail_mark_all_read': {
      const count = await GmailAPI.markAllRead(credentials);
      return count > 0
        ? `Marked ${count} email${1 !== count ? 's' : ''} as read.`
        : 'No unread emails to mark - inbox is already clean.';
    }
    case 'gmail_send_with_cc': {
      const { to: to, subject: subject, body: body, cc: cc = '', bcc: bcc = '' } = params;
      if (!to || !subject || !body) throw new Error('Missing required params: to, subject, body');
      return (
        await GmailAPI.sendEmail(credentials, to, subject, body, cc, bcc),
        [
          `Email sent to ${to}`,
          cc ? `CC: ${cc}` : '',
          bcc ? `BCC: ${bcc}` : '',
          `Subject: "${subject}"`,
        ]
          .filter(Boolean)
          .join('\n')
      );
    }
    case 'gmail_get_unread_emails': {
      const { maxResults: maxResults = 20 } = params,
        emails = await GmailAPI.getUnreadEmails(credentials, maxResults);
      return emails.length
        ? `${emails.length} unread email${1 !== emails.length ? 's' : ''}:\n\n${formatEmailList(emails)}`
        : 'No unread emails found.';
    }
    case 'gmail_archive_read_emails': {
      const { maxResults: maxResults = 100 } = params,
        count = await GmailAPI.archiveReadEmails(credentials, maxResults);
      return count > 0
        ? `Archived ${count} read email${1 !== count ? 's' : ''} from your inbox.`
        : 'No read emails found to archive - inbox is already clean.';
    }
    case 'gmail_trash_by_query': {
      const { query: query, maxResults: maxResults = 50 } = params;
      if (!query) throw new Error('Missing required param: query');
      const count = await GmailAPI.trashEmailsByQuery(credentials, query, maxResults);
      return count > 0
        ? `Moved ${count} email${1 !== count ? 's' : ''} matching "${query}" to trash.`
        : `No emails found matching "${query}" - nothing was trashed.`;
    }
    case 'gmail_create_label': {
      const { name: name, text_color: text_color, background_color: background_color } = params;
      if (!name) throw new Error('Missing required param: name');
      const colors = {};
      (text_color && (colors.textColor = text_color),
        background_color && (colors.backgroundColor = background_color));
      const label = await GmailAPI.createLabel(credentials, name, colors);
      return [`Label created: "${name}"`, label?.id ? `Label ID: ${label.id}` : '']
        .filter(Boolean)
        .join('\n');
    }
    case 'gmail_add_label': {
      const { messageId: messageId, label_name: label_name } = params;
      if (!messageId || !label_name)
        throw new Error('Missing required params: messageId, label_name');
      const labelId = await getLabelId(credentials, label_name);
      return (
        await GmailAPI.modifyMessage(credentials, messageId, {
          addLabels: [labelId],
          removeLabels: [],
        }),
        `Label "${label_name}" added to message ${messageId}.`
      );
    }
    case 'gmail_remove_label': {
      const { messageId: messageId, label_name: label_name } = params;
      if (!messageId || !label_name)
        throw new Error('Missing required params: messageId, label_name');
      const labelId = await getLabelId(credentials, label_name);
      return (
        await GmailAPI.modifyMessage(credentials, messageId, {
          addLabels: [],
          removeLabels: [labelId],
        }),
        `Label "${label_name}" removed from message ${messageId}.`
      );
    }
    case 'gmail_get_label_id': {
      const { label_name: label_name } = params;
      if (!label_name) throw new Error('Missing required param: label_name');
      const id = await GmailAPI.getLabelId(credentials, label_name);
      return id
        ? `Label: "${label_name}"\nID: ${id}`
        : `No label named "${label_name}" was found. Use gmail_list_labels to see all labels.`;
    }
    case 'gmail_get_sent_emails': {
      const { maxResults: maxResults = 10 } = params,
        emails = await GmailAPI.searchEmails(credentials, 'in:sent', maxResults);
      return emails.length
        ? `${emails.length} sent email${1 !== emails.length ? 's' : ''}:\n\n${formatEmailList(emails, { sent: !0 })}`
        : 'No sent emails found.';
    }
    case 'gmail_get_starred_emails': {
      const { maxResults: maxResults = 10 } = params,
        emails = await GmailAPI.searchEmails(credentials, 'is:starred', maxResults);
      return emails.length
        ? `${emails.length} starred email${1 !== emails.length ? 's' : ''}:\n\n${formatEmailList(emails, { starred: !0 })}`
        : 'No starred emails found.';
    }
    case 'gmail_get_message': {
      const { messageId: messageId } = params;
      if (!messageId) throw new Error('Missing required param: messageId');
      const msg = await GmailAPI.getMessageFull(credentials, messageId);
      return [
        `Message ID: ${msg.id}`,
        `Thread ID: ${msg.threadId}`,
        `From: ${msg.from}`,
        `To: ${msg.to}`,
        `Date: ${msg.date}`,
        `Subject: ${msg.subject || '(no subject)'}`,
        `Labels: ${msg.labelIds.join(', ') || 'none'}`,
        '',
        '── Body ──',
        msg.body || msg.snippet || '(empty body)',
      ].join('\n');
    }
    case 'gmail_permanent_delete': {
      const { messageId: messageId } = params;
      if (!messageId) throw new Error('Missing required param: messageId');
      return (
        await GmailAPI.deleteMessage(credentials, messageId),
        `Message ${messageId} permanently deleted. This action cannot be undone.`
      );
    }
    case 'gmail_batch_permanent_delete': {
      const { query: query, maxResults: maxResults = 50 } = params;
      if (!query) throw new Error('Missing required param: query');
      const count = await GmailAPI.batchDeleteByQuery(credentials, query, maxResults);
      return count > 0
        ? `Permanently deleted ${count} email${1 !== count ? 's' : ''} matching "${query}". This cannot be undone.`
        : `No emails found matching "${query}" — nothing was deleted.`;
    }
    case 'gmail_untrash_message': {
      const { messageId: messageId } = params;
      if (!messageId) throw new Error('Missing required param: messageId');
      return (
        await GmailAPI.untrashMessage(credentials, messageId),
        `Message ${messageId} restored from trash to inbox.`
      );
    }
    case 'gmail_list_attachments': {
      const { messageId: messageId } = params;
      if (!messageId) throw new Error('Missing required param: messageId');
      const attachments = await GmailAPI.listAttachments(credentials, messageId);
      if (!attachments.length) return `No attachments found on message ${messageId}.`;
      const lines = attachments.map(
        (a, i) =>
          `${i + 1}. ${a.filename} (${a.mimeType}) — ${(a.size / 1024).toFixed(1)} KB\n   Attachment ID: ${a.attachmentId}`,
      );
      return `${attachments.length} attachment${1 !== attachments.length ? 's' : ''} on message ${messageId}:\n\n${lines.join('\n\n')}`;
    }
    case 'gmail_list_threads': {
      const { query: query = '', maxResults: maxResults = 10 } = params,
        threads = await GmailAPI.listThreads(credentials, query, maxResults);
      if (!threads.length)
        return query ? `No threads found matching "${query}".` : 'No threads found.';
      const lines = threads.map(
        (t, i) =>
          `${i + 1}. **${t.subject || '(no subject)'}** (${t.messageCount} message${1 !== t.messageCount ? 's' : ''})\n   From: ${t.from || 'unknown'}\n   Thread ID: ${t.id}\n   Preview: ${t.snippet?.slice(0, 100) || ''}`,
      );
      return `${threads.length} thread${1 !== threads.length ? 's' : ''}${query ? ` matching "${query}"` : ''}:\n\n${lines.join('\n\n')}`;
    }
    case 'gmail_get_thread': {
      const { threadId: threadId } = params;
      if (!threadId) throw new Error('Missing required param: threadId');
      const thread = await GmailAPI.getThread(credentials, threadId),
        lines = thread.messages.map(
          (msg, i) =>
            `Message ${i + 1} (ID: ${msg.id})\n  From: ${msg.from}\n  Date: ${msg.date}\n  Labels: ${msg.labelIds.join(', ') || 'none'}\n  Preview: ${msg.snippet?.slice(0, 120) || ''}`,
        );
      return [
        `Thread ID: ${thread.id}`,
        `${thread.messages.length} message${1 !== thread.messages.length ? 's' : ''} in this conversation:`,
        '',
        lines.join('\n\n'),
      ].join('\n');
    }
    case 'gmail_trash_thread': {
      const { threadId: threadId } = params;
      if (!threadId) throw new Error('Missing required param: threadId');
      return (
        await GmailAPI.trashThread(credentials, threadId),
        `Thread ${threadId} and all its messages moved to trash.`
      );
    }
    case 'gmail_archive_thread': {
      const { threadId: threadId } = params;
      if (!threadId) throw new Error('Missing required param: threadId');
      return (
        await GmailAPI.archiveThread(credentials, threadId),
        `Thread ${threadId} archived and removed from inbox.`
      );
    }
    case 'gmail_list_drafts': {
      const { maxResults: maxResults = 10 } = params,
        drafts = await GmailAPI.listDrafts(credentials, maxResults);
      if (!drafts.length) return 'No drafts found.';
      const lines = drafts.map(
        (d, i) =>
          `${i + 1}. Subject: "${d.subject || '(no subject)'}" → To: ${d.to || 'unknown'}\n   Draft ID: ${d.id}\n   Preview: ${d.snippet?.slice(0, 100) || ''}`,
      );
      return `${drafts.length} draft${1 !== drafts.length ? 's' : ''}:\n\n${lines.join('\n\n')}`;
    }
    case 'gmail_delete_draft': {
      const { draftId: draftId } = params;
      if (!draftId) throw new Error('Missing required param: draftId');
      return (
        await GmailAPI.deleteDraft(credentials, draftId),
        `Draft ${draftId} permanently deleted.`
      );
    }
    case 'gmail_send_draft': {
      const { draftId: draftId } = params;
      if (!draftId) throw new Error('Missing required param: draftId');
      return (
        await GmailAPI.sendDraft(credentials, draftId),
        `Draft ${draftId} sent successfully.`
      );
    }
    case 'gmail_get_vacation': {
      const v = await GmailAPI.getVacationResponder(credentials);
      return v.enableAutoReply
        ? [
            'Vacation auto-reply is ENABLED',
            `Subject: ${v.responseSubject || '(none)'}`,
            `Start: ${v.startTime ? new Date(Number(v.startTime)).toLocaleString() : 'not set'}`,
            `End: ${v.endTime ? new Date(Number(v.endTime)).toLocaleString() : 'not set'}`,
            '',
            '── Body ──',
            v.responseBodyPlainText || '(empty)',
          ].join('\n')
        : 'Vacation / out-of-office auto-reply is currently disabled.';
    }
    case 'gmail_set_vacation': {
      const { subject: subject, body: body, startTime: startTime, endTime: endTime } = params;
      if (!subject || !body) throw new Error('Missing required params: subject, body');
      return (
        await GmailAPI.setVacationResponder(credentials, {
          subject: subject,
          body: body,
          startTime: startTime,
          endTime: endTime,
        }),
        [
          'Vacation auto-reply enabled.',
          `Subject: ${subject}`,
          startTime ? `Starts: ${new Date(Number(startTime)).toLocaleString()}` : '',
          endTime ? `Ends: ${new Date(Number(endTime)).toLocaleString()}` : '',
        ]
          .filter(Boolean)
          .join('\n')
      );
    }
    case 'gmail_disable_vacation':
      return (
        await GmailAPI.disableVacationResponder(credentials),
        'Vacation / out-of-office auto-reply has been disabled.'
      );
    case 'gmail_list_filters': {
      const filters = await GmailAPI.listFilters(credentials);
      if (!filters.length) return 'No Gmail filters found.';
      const lines = filters.map((f, i) => {
        const c = f.criteria ?? {},
          a = f.action ?? {},
          criteriaStr = [
            c.from && `from:${c.from}`,
            c.to && `to:${c.to}`,
            c.subject && `subject:${c.subject}`,
            c.query && `has:${c.query}`,
            c.negatedQuery && `not:${c.negatedQuery}`,
          ]
            .filter(Boolean)
            .join(', '),
          actionStr = [
            a.addLabelIds?.length && `add labels: ${a.addLabelIds.join(', ')}`,
            a.removeLabelIds?.includes('UNREAD') && 'mark as read',
            a.removeLabelIds?.includes('INBOX') && 'skip inbox',
          ]
            .filter(Boolean)
            .join(', ');
        return `${i + 1}. Filter ID: ${f.id}\n   If: ${criteriaStr || 'any'}\n   Then: ${actionStr || 'no action'}`;
      });
      return `${filters.length} filter${1 !== filters.length ? 's' : ''}:\n\n${lines.join('\n\n')}`;
    }
    case 'gmail_create_filter': {
      const {
        from: from,
        to: to,
        subject: subject,
        hasWords: hasWords,
        doesNotHaveWords: doesNotHaveWords,
        markAsRead: markAsRead = !1,
        archive: archive = !1,
      } = params;
      if (!(from || to || subject || hasWords || doesNotHaveWords))
        throw new Error(
          'At least one filter criteria is required: from, to, subject, hasWords, or doesNotHaveWords',
        );
      return [
        `Filter created (ID: ${(await GmailAPI.createFilter(credentials, { from: from, to: to, subject: subject, hasWords: hasWords, doesNotHaveWords: doesNotHaveWords }, { markAsRead: markAsRead, archive: archive })).id})`,
        from ? `  If from: ${from}` : '',
        to ? `  If to: ${to}` : '',
        subject ? `  If subject contains: ${subject}` : '',
        hasWords ? `  If has words: ${hasWords}` : '',
        doesNotHaveWords ? `  If not words: ${doesNotHaveWords}` : '',
        markAsRead ? '  Action: mark as read' : '',
        archive ? '  Action: skip inbox (archive)' : '',
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'gmail_delete_label': {
      const { label_name: label_name } = params;
      if (!label_name) throw new Error('Missing required param: label_name');
      const labelId = await getLabelId(credentials, label_name);
      return (
        await GmailAPI.deleteLabel(credentials, labelId),
        `Label "${label_name}" permanently deleted.`
      );
    }
    case 'gmail_rename_label': {
      const { label_name: label_name, new_name: new_name } = params;
      if (!label_name || !new_name)
        throw new Error('Missing required params: label_name, new_name');
      const labelId = await getLabelId(credentials, label_name),
        updated = await GmailAPI.renameLabel(credentials, labelId, new_name);
      return `Label renamed from "${label_name}" to "${updated.name ?? new_name}" (ID: ${updated.id}).`;
    }
    case 'gmail_list_send_as': {
      const aliases = await GmailAPI.listSendAs(credentials);
      if (!aliases.length) return 'No send-as aliases found.';
      const lines = aliases.map((a, i) =>
        [
          `${i + 1}. ${a.sendAsEmail}${a.isDefault ? ' ✓ (default)' : ''}`,
          a.displayName ? `   Display name: ${a.displayName}` : '',
          '   Verified: ' + ('accepted' === a.verificationStatus ? 'yes' : 'no'),
          a.replyToAddress ? `   Reply-to: ${a.replyToAddress}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      );
      return `${aliases.length} send-as alias${1 !== aliases.length ? 'es' : ''}:\n\n${lines.join('\n\n')}`;
    }
    default:
      throw new Error(`Unknown Gmail tool: ${toolName}`);
  }
}
