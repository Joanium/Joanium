import createGoogleFeature from '../../Core/GoogleFeatureFactory.js';
import * as CalendarAPI from './API/CalendarAPI.js';
import { CALENDAR_TOOLS } from './Chat/Tools.js';
import { executeCalendarChatTool } from './Chat/ChatExecutor.js';
import { withGoogle } from '../../Common.js';
export default createGoogleFeature({
  id: 'calendar',
  name: 'Google Calendar',
  iconFile: 'Calendar.png',
  apiUrl: 'https://console.cloud.google.com/apis/library/calendar-json.googleapis.com',
  capabilities: ['View and manage Calendar events'],
  methods: {
    listCalendars: async (ctx) =>
      withGoogle(ctx, async (credentials) => ({
        ok: !0,
        calendars: await CalendarAPI.listCalendars(credentials),
      })),
    listEvents: async (ctx, { calendarId: calendarId = 'primary', opts: opts = {} } = {}) =>
      withGoogle(ctx, async (credentials) => ({
        ok: !0,
        events: await CalendarAPI.listEvents(credentials, calendarId, opts),
      })),
    getToday: async (ctx) =>
      withGoogle(ctx, async (credentials) => ({
        ok: !0,
        events: await CalendarAPI.getTodayEvents(credentials),
      })),
    getUpcoming: async (ctx, { days: days = 7, maxResults: maxResults = 20 } = {}) =>
      withGoogle(ctx, async (credentials) => ({
        ok: !0,
        events: await CalendarAPI.getUpcomingEvents(credentials, days, maxResults),
      })),
    searchEvents: async (ctx, { query: query, maxResults: maxResults = 20 }) =>
      withGoogle(ctx, async (credentials) =>
        query?.trim()
          ? { ok: !0, events: await CalendarAPI.searchEvents(credentials, query, maxResults) }
          : { ok: !1, error: 'Query is required' },
      ),
    getEvent: async (ctx, { calendarId: calendarId = 'primary', eventId: eventId }) =>
      withGoogle(ctx, async (credentials) =>
        eventId
          ? { ok: !0, event: await CalendarAPI.getEvent(credentials, calendarId, eventId) }
          : { ok: !1, error: 'eventId is required' },
      ),
    createEvent: async (ctx, { calendarId: calendarId = 'primary', eventData: eventData } = {}) =>
      withGoogle(ctx, async (credentials) =>
        eventData?.summary
          ? { ok: !0, event: await CalendarAPI.createEvent(credentials, calendarId, eventData) }
          : { ok: !1, error: 'Event summary (title) is required' },
      ),
    updateEvent: async (
      ctx,
      { calendarId: calendarId = 'primary', eventId: eventId, updates: updates = {} } = {},
    ) =>
      withGoogle(ctx, async (credentials) =>
        eventId
          ? {
              ok: !0,
              event: await CalendarAPI.updateEvent(credentials, calendarId, eventId, updates),
            }
          : { ok: !1, error: 'eventId is required' },
      ),
    deleteEvent: async (ctx, { calendarId: calendarId = 'primary', eventId: eventId }) =>
      withGoogle(ctx, async (credentials) =>
        eventId
          ? (await CalendarAPI.deleteEvent(credentials, calendarId, eventId), { ok: !0 })
          : { ok: !1, error: 'eventId is required' },
      ),
  },
  chatTools: CALENDAR_TOOLS,
  executeChatTool: executeCalendarChatTool,
});
