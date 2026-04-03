import defineFeature from '../../../Core/DefineFeature.js';
import * as GmailAPI from './API/GmailAPI.js';
import { GMAIL_TOOLS } from './Chat/Tools.js';
import { executeGmailChatTool } from './Chat/ChatExecutor.js';
import { gmailAutomationHandlers } from './Automation/AutomationHandlers.js';
import { gmailDataSourceCollectors } from './Agents/AgentHandlers.js';
import { withGoogle } from '../../Common.js';

const GMAIL_ACTIONS = [
  { type: 'gmail_send_email', label: 'Send email', group: 'Google Workspace', fields: ['to', 'subject', 'gmailBody', 'cc', 'bcc'], requiredFields: ['to', 'subject'] },
  { type: 'gmail_get_brief', label: 'Email brief (notification)', group: 'Google Workspace', fields: ['maxResults'] },
  { type: 'gmail_get_unread_count', label: 'Unread count notification', group: 'Google Workspace', fields: [] },
  { type: 'gmail_search_notify', label: 'Search and notify', group: 'Google Workspace', fields: ['query', 'maxResults'], requiredFields: ['query'] },
  { type: 'gmail_reply', label: 'Reply to email', group: 'Google Workspace', fields: ['messageId', 'gmailBody'], requiredFields: ['messageId', 'gmailBody'] },
  { type: 'gmail_forward', label: 'Forward email', group: 'Google Workspace', fields: ['messageId', 'forwardTo', 'note'], requiredFields: ['messageId', 'forwardTo'] },
  { type: 'gmail_create_draft', label: 'Create draft', group: 'Google Workspace', fields: ['to', 'subject', 'gmailBody', 'cc'], requiredFields: ['to', 'subject'] },
  { type: 'gmail_mark_all_read', label: 'Mark all as read', group: 'Google Workspace', fields: [] },
  { type: 'gmail_archive_read', label: 'Archive read emails', group: 'Google Workspace', fields: ['maxResults'] },
  { type: 'gmail_trash_by_query', label: 'Trash emails by query', group: 'Google Workspace', fields: ['query', 'maxResults'], requiredFields: ['query'] },
  { type: 'gmail_inbox_stats', label: 'Inbox stats notification', group: 'Google Workspace', fields: [] },
  { type: 'gmail_label_emails', label: 'Label emails by query', group: 'Google Workspace', fields: ['query', 'labelName', 'maxResults'], requiredFields: ['query', 'labelName'] },
];

const GMAIL_FIELD_META = {
  to: { placeholder: 'recipient@example.com', textarea: false },
  cc: { placeholder: 'cc@example.com, cc2@example.com (optional)', textarea: false },
  bcc: { placeholder: 'bcc@example.com (optional)', textarea: false },
  subject: { placeholder: 'Email subject', textarea: false },
  gmailBody: { placeholder: 'Email body...', textarea: true },
  maxResults: { type: 'number', placeholder: '10', min: 1, max: 500, textarea: false },
  query: { placeholder: 'from:boss OR subject:urgent', textarea: false },
  messageId: { placeholder: 'Gmail message ID', textarea: false },
  forwardTo: { placeholder: 'forward@example.com', textarea: false },
  note: { placeholder: 'Optional note to prepend to the forwarded message', textarea: true },
  labelName: { placeholder: 'Label name (must exist in Gmail)', textarea: false },
};

const GMAIL_FIELD_LABELS = {
  to: 'To',
  cc: 'CC',
  bcc: 'BCC',
  subject: 'Subject',
  gmailBody: 'Body',
  maxResults: 'Max results',
  query: 'Search query',
  messageId: 'Message ID',
  forwardTo: 'Forward to',
  note: 'Note',
  labelName: 'Label name',
};

const GMAIL_DATA_SOURCES = [
  {
    value: 'gmail_inbox',
    label: 'Gmail - Unread inbox',
    group: 'Google Workspace',
    params: [
      { key: 'maxResults', label: 'Max emails', type: 'number', min: 1, max: 50, defaultValue: 20, placeholder: '20' },
    ],
  },
  {
    value: 'gmail_search',
    label: 'Gmail - Search emails',
    group: 'Google Workspace',
    params: [
      { key: 'query', label: 'Search query', type: 'text', required: true, placeholder: 'from:boss OR subject:urgent' },
      { key: 'maxResults', label: 'Max results', type: 'number', min: 1, max: 30, defaultValue: 10, placeholder: '10' },
    ],
  },
  {
    value: 'gmail_inbox_stats',
    label: 'Gmail - Inbox stats',
    group: 'Google Workspace',
  },
];

const GMAIL_INSTRUCTION_TEMPLATES = {
  gmail_inbox: 'Read these emails. Identify the most important ones needing action today. For each: subject, sender, what action is needed, and urgency. Then briefly list FYI emails.',
  gmail_search: 'Analyze these matching emails. Summarize findings, highlight patterns and urgent items.',
  gmail_inbox_stats: 'Analyze these inbox statistics. Flag anything concerning and give a brief health assessment.',
};

export default defineFeature({
  id: 'gmail',
  name: 'Gmail',
  dependsOn: ['google-workspace'],
  connectors: {
    serviceExtensions: [
      {
        target: 'google',
        subServices: [
          {
            key: 'gmail',
            icon: '📧',
            name: 'Gmail',
            apiUrl: 'https://console.cloud.google.com/apis/library/gmail.googleapis.com',
          },
        ],
        capabilities: [
          'Read and send Gmail in chat',
          'Use Gmail in automations and agents',
        ],
        automations: [
          { name: 'Morning Briefing', description: 'Summarize unread email and important threads' },
        ],
      },
    ],
  },
  main: {
    methods: {
      async getBrief(ctx, { maxResults = 15 } = {}) {
        return withGoogle(ctx, async credentials => ({ ok: true, ...(await GmailAPI.getEmailBrief(credentials, maxResults)) }));
      },

      async getUnread(ctx, { maxResults = 20 } = {}) {
        return withGoogle(ctx, async credentials => ({ ok: true, emails: await GmailAPI.getUnreadEmails(credentials, maxResults) }));
      },

      async search(ctx, { query, maxResults = 10 }) {
        return withGoogle(ctx, async credentials => {
          if (!query?.trim()) return { ok: false, error: 'query is required' };
          return { ok: true, emails: await GmailAPI.searchEmails(credentials, query, maxResults) };
        });
      },

      async getInboxStats(ctx) {
        return withGoogle(ctx, async credentials => ({ ok: true, stats: await GmailAPI.getInboxStats(credentials) }));
      },

      async send(ctx, { to, subject, body, cc = '', bcc = '' }) {
        return withGoogle(ctx, async credentials => {
          await GmailAPI.sendEmail(credentials, to, subject, body, cc, bcc);
          return { ok: true };
        });
      },

      async reply(ctx, { messageId, replyBody }) {
        return withGoogle(ctx, async credentials => {
          if (!messageId) return { ok: false, error: 'messageId is required' };
          if (!replyBody) return { ok: false, error: 'replyBody is required' };
          await GmailAPI.replyToEmail(credentials, messageId, replyBody);
          return { ok: true };
        });
      },

      async forward(ctx, { messageId, forwardTo, note = '' }) {
        return withGoogle(ctx, async credentials => {
          if (!messageId) return { ok: false, error: 'messageId is required' };
          if (!forwardTo) return { ok: false, error: 'forwardTo is required' };
          await GmailAPI.forwardEmail(credentials, messageId, forwardTo, note);
          return { ok: true };
        });
      },

      async createDraft(ctx, { to, subject, body = '', cc = '' }) {
        return withGoogle(ctx, async credentials => {
          if (!to || !subject) return { ok: false, error: 'to and subject are required' };
          return { ok: true, draft: await GmailAPI.createDraft(credentials, to, subject, body, cc) };
        });
      },

      async markAllRead(ctx) {
        return withGoogle(ctx, async credentials => ({ ok: true, count: await GmailAPI.markAllRead(credentials) }));
      },

      async archiveRead(ctx, { maxResults = 100 } = {}) {
        return withGoogle(ctx, async credentials => ({ ok: true, count: await GmailAPI.archiveReadEmails(credentials, maxResults) }));
      },

      async trashByQuery(ctx, { query, maxResults = 50 }) {
        return withGoogle(ctx, async credentials => {
          if (!query) return { ok: false, error: 'query is required' };
          return { ok: true, count: await GmailAPI.trashEmailsByQuery(credentials, query, maxResults) };
        });
      },

      async markAsRead(ctx, { messageId }) {
        return withGoogle(ctx, async credentials => {
          if (!messageId) return { ok: false, error: 'messageId is required' };
          await GmailAPI.markAsRead(credentials, messageId);
          return { ok: true };
        });
      },

      async markAsUnread(ctx, { messageId }) {
        return withGoogle(ctx, async credentials => {
          if (!messageId) return { ok: false, error: 'messageId is required' };
          await GmailAPI.markAsUnread(credentials, messageId);
          return { ok: true };
        });
      },

      async archiveMessage(ctx, { messageId }) {
        return withGoogle(ctx, async credentials => {
          if (!messageId) return { ok: false, error: 'messageId is required' };
          await GmailAPI.archiveMessage(credentials, messageId);
          return { ok: true };
        });
      },

      async trashMessage(ctx, { messageId }) {
        return withGoogle(ctx, async credentials => {
          if (!messageId) return { ok: false, error: 'messageId is required' };
          await GmailAPI.trashMessage(credentials, messageId);
          return { ok: true };
        });
      },

      async listLabels(ctx) {
        return withGoogle(ctx, async credentials => ({ ok: true, labels: await GmailAPI.listLabels(credentials) }));
      },

      async createLabel(ctx, { name, colors = {} }) {
        return withGoogle(ctx, async credentials => {
          if (!name) return { ok: false, error: 'label name is required' };
          return { ok: true, label: await GmailAPI.createLabel(credentials, name, colors) };
        });
      },

      async getLabelId(ctx, { labelName }) {
        return withGoogle(ctx, async credentials => {
          if (!labelName) return { ok: false, error: 'labelName is required' };
          return { ok: true, id: await GmailAPI.getLabelId(credentials, labelName) };
        });
      },

      async modifyMessage(ctx, { messageId, addLabels = [], removeLabels = [] }) {
        return withGoogle(ctx, async credentials => {
          if (!messageId) return { ok: false, error: 'messageId is required' };
          await GmailAPI.modifyMessage(credentials, messageId, { addLabels, removeLabels });
          return { ok: true };
        });
      },

      async executeChatTool(ctx, { toolName, params }) {
        return executeGmailChatTool(ctx, toolName, params);
      },
    },
  },
  renderer: {
    chatTools: GMAIL_TOOLS,
  },
  automation: {
    actions: GMAIL_ACTIONS,
    fieldMeta: GMAIL_FIELD_META,
    fieldLabels: GMAIL_FIELD_LABELS,
    handlers: gmailAutomationHandlers,
  },
  agents: {
    dataSources: GMAIL_DATA_SOURCES,
    instructionTemplates: GMAIL_INSTRUCTION_TEMPLATES,
    dataSourceCollectors: gmailDataSourceCollectors,
  },
});
