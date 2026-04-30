import createGoogleFeature from '../../Core/GoogleFeatureFactory.js';
import * as GmailAPI from './API/GmailAPI.js';
import { GMAIL_TOOLS } from './Chat/Tools.js';
import { executeGmailChatTool } from './Chat/ChatExecutor.js';
import { withGoogle } from '../../Common.js';
export default createGoogleFeature({
  id: 'gmail',
  name: 'Gmail',
  iconFile: 'Gmail.png',
  iconAlt: 'Google Gmail',
  apiUrl: 'https://console.cloud.google.com/apis/library/gmail.googleapis.com',
  capabilities: ['Read and send Gmail in chat', 'Use Gmail in agents'],
  methods: {
    getBrief: async (ctx, { maxResults: maxResults = 15 } = {}) =>
      withGoogle(ctx, async (credentials) => ({
        ok: !0,
        ...(await GmailAPI.getEmailBrief(credentials, maxResults)),
      })),
    getUnread: async (ctx, { maxResults: maxResults = 20 } = {}) =>
      withGoogle(ctx, async (credentials) => ({
        ok: !0,
        emails: await GmailAPI.getUnreadEmails(credentials, maxResults),
      })),
    search: async (ctx, { query: query, maxResults: maxResults = 10 }) =>
      withGoogle(ctx, async (credentials) =>
        query?.trim()
          ? { ok: !0, emails: await GmailAPI.searchEmails(credentials, query, maxResults) }
          : { ok: !1, error: 'query is required' },
      ),
    getInboxStats: async (ctx) =>
      withGoogle(ctx, async (credentials) => ({
        ok: !0,
        stats: await GmailAPI.getInboxStats(credentials),
      })),
    send: async (ctx, { to: to, subject: subject, body: body, cc: cc = '', bcc: bcc = '' }) =>
      withGoogle(
        ctx,
        async (credentials) => (
          await GmailAPI.sendEmail(credentials, to, subject, body, cc, bcc),
          { ok: !0 }
        ),
      ),
    reply: async (ctx, { messageId: messageId, replyBody: replyBody }) =>
      withGoogle(ctx, async (credentials) =>
        messageId
          ? replyBody
            ? (await GmailAPI.replyToEmail(credentials, messageId, replyBody), { ok: !0 })
            : { ok: !1, error: 'replyBody is required' }
          : { ok: !1, error: 'messageId is required' },
      ),
    forward: async (ctx, { messageId: messageId, forwardTo: forwardTo, note: note = '' }) =>
      withGoogle(ctx, async (credentials) =>
        messageId
          ? forwardTo
            ? (await GmailAPI.forwardEmail(credentials, messageId, forwardTo, note), { ok: !0 })
            : { ok: !1, error: 'forwardTo is required' }
          : { ok: !1, error: 'messageId is required' },
      ),
    createDraft: async (ctx, { to: to, subject: subject, body: body = '', cc: cc = '' }) =>
      withGoogle(ctx, async (credentials) =>
        to && subject
          ? { ok: !0, draft: await GmailAPI.createDraft(credentials, to, subject, body, cc) }
          : { ok: !1, error: 'to and subject are required' },
      ),
    markAllRead: async (ctx) =>
      withGoogle(ctx, async (credentials) => ({
        ok: !0,
        count: await GmailAPI.markAllRead(credentials),
      })),
    archiveRead: async (ctx, { maxResults: maxResults = 100 } = {}) =>
      withGoogle(ctx, async (credentials) => ({
        ok: !0,
        count: await GmailAPI.archiveReadEmails(credentials, maxResults),
      })),
    trashByQuery: async (ctx, { query: query, maxResults: maxResults = 50 }) =>
      withGoogle(ctx, async (credentials) =>
        query
          ? { ok: !0, count: await GmailAPI.trashEmailsByQuery(credentials, query, maxResults) }
          : { ok: !1, error: 'query is required' },
      ),
    markAsRead: async (ctx, { messageId: messageId }) =>
      withGoogle(ctx, async (credentials) =>
        messageId
          ? (await GmailAPI.markAsRead(credentials, messageId), { ok: !0 })
          : { ok: !1, error: 'messageId is required' },
      ),
    markAsUnread: async (ctx, { messageId: messageId }) =>
      withGoogle(ctx, async (credentials) =>
        messageId
          ? (await GmailAPI.markAsUnread(credentials, messageId), { ok: !0 })
          : { ok: !1, error: 'messageId is required' },
      ),
    archiveMessage: async (ctx, { messageId: messageId }) =>
      withGoogle(ctx, async (credentials) =>
        messageId
          ? (await GmailAPI.archiveMessage(credentials, messageId), { ok: !0 })
          : { ok: !1, error: 'messageId is required' },
      ),
    trashMessage: async (ctx, { messageId: messageId }) =>
      withGoogle(ctx, async (credentials) =>
        messageId
          ? (await GmailAPI.trashMessage(credentials, messageId), { ok: !0 })
          : { ok: !1, error: 'messageId is required' },
      ),
    listLabels: async (ctx) =>
      withGoogle(ctx, async (credentials) => ({
        ok: !0,
        labels: await GmailAPI.listLabels(credentials),
      })),
    createLabel: async (ctx, { name: name, colors: colors = {} }) =>
      withGoogle(ctx, async (credentials) =>
        name
          ? { ok: !0, label: await GmailAPI.createLabel(credentials, name, colors) }
          : { ok: !1, error: 'label name is required' },
      ),
    getLabelId: async (ctx, { labelName: labelName }) =>
      withGoogle(ctx, async (credentials) =>
        labelName
          ? { ok: !0, id: await GmailAPI.getLabelId(credentials, labelName) }
          : { ok: !1, error: 'labelName is required' },
      ),
    modifyMessage: async (
      ctx,
      { messageId: messageId, addLabels: addLabels = [], removeLabels: removeLabels = [] },
    ) =>
      withGoogle(ctx, async (credentials) =>
        messageId
          ? (await GmailAPI.modifyMessage(credentials, messageId, {
              addLabels: addLabels,
              removeLabels: removeLabels,
            }),
            { ok: !0 })
          : { ok: !1, error: 'messageId is required' },
      ),
  },
  chatTools: GMAIL_TOOLS,
  executeChatTool: executeGmailChatTool,
});
