import defineFeature from '../../../Core/DefineFeature.js';
import * as CalendarAPI from './API/CalendarAPI.js';
import { CALENDAR_TOOLS } from './Chat/Tools.js';
import { executeCalendarChatTool } from './Chat/ChatExecutor.js';
import { withGoogle } from '../../Common.js';

export default defineFeature({
  id: 'calendar',
  name: 'Google Calendar',
  dependsOn: ['google-workspace'],
  connectors: {
    serviceExtensions: [
      {
        target: 'google',
        subServices: [
          {
            key: 'calendar',
            icon: '📅',
            name: 'Google Calendar',
            apiUrl: 'https://console.cloud.google.com/apis/library/calendar-json.googleapis.com',
          },
        ],
        capabilities: [
          'View and manage Calendar events',
        ],
      },
    ],
  },
  main: {
    methods: {
      async listCalendars(ctx) {
        return withGoogle(ctx, async credentials => ({ ok: true, calendars: await CalendarAPI.listCalendars(credentials) }));
      },

      async listEvents(ctx, { calendarId = 'primary', opts = {} } = {}) {
        return withGoogle(ctx, async credentials => ({ ok: true, events: await CalendarAPI.listEvents(credentials, calendarId, opts) }));
      },

      async getToday(ctx) {
        return withGoogle(ctx, async credentials => ({ ok: true, events: await CalendarAPI.getTodayEvents(credentials) }));
      },

      async getUpcoming(ctx, { days = 7, maxResults = 20 } = {}) {
        return withGoogle(ctx, async credentials => ({ ok: true, events: await CalendarAPI.getUpcomingEvents(credentials, days, maxResults) }));
      },

      async searchEvents(ctx, { query, maxResults = 20 }) {
        return withGoogle(ctx, async credentials => {
          if (!query?.trim()) return { ok: false, error: 'Query is required' };
          return { ok: true, events: await CalendarAPI.searchEvents(credentials, query, maxResults) };
        });
      },

      async getEvent(ctx, { calendarId = 'primary', eventId }) {
        return withGoogle(ctx, async credentials => {
          if (!eventId) return { ok: false, error: 'eventId is required' };
          return { ok: true, event: await CalendarAPI.getEvent(credentials, calendarId, eventId) };
        });
      },

      async createEvent(ctx, { calendarId = 'primary', eventData } = {}) {
        return withGoogle(ctx, async credentials => {
          if (!eventData?.summary) return { ok: false, error: 'Event summary (title) is required' };
          return { ok: true, event: await CalendarAPI.createEvent(credentials, calendarId, eventData) };
        });
      },

      async updateEvent(ctx, { calendarId = 'primary', eventId, updates = {} } = {}) {
        return withGoogle(ctx, async credentials => {
          if (!eventId) return { ok: false, error: 'eventId is required' };
          return { ok: true, event: await CalendarAPI.updateEvent(credentials, calendarId, eventId, updates) };
        });
      },

      async deleteEvent(ctx, { calendarId = 'primary', eventId }) {
        return withGoogle(ctx, async credentials => {
          if (!eventId) return { ok: false, error: 'eventId is required' };
          await CalendarAPI.deleteEvent(credentials, calendarId, eventId);
          return { ok: true };
        });
      },

      async executeChatTool(ctx, { toolName, params }) {
        return executeCalendarChatTool(ctx, toolName, params);
      },
    },
  },
  renderer: {
    chatTools: CALENDAR_TOOLS,
  },
});
