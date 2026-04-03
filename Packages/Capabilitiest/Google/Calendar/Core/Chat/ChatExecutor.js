import * as CalendarAPI from '../API/CalendarAPI.js';
import { requireGoogleCredentials } from '../../../Common.js';

function formatEventTime(eventTime) {
  if (!eventTime) return 'N/A';
  if (eventTime.dateTime) {
    return new Date(eventTime.dateTime).toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  }
  if (eventTime.date) {
    return new Date(`${eventTime.date}T00:00:00`).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    }) + ' (all day)';
  }
  return 'N/A';
}

function formatEvent(event, index) {
  const start = formatEventTime(event.start);
  const end = formatEventTime(event.end);
  const lines = [
    `${index}. **${event.summary || '(No title)'}**`,
    `   Time: ${start}${end && end !== start ? ` -> ${end}` : ''}`,
  ];
  if (event.location) lines.push(`   Location: ${event.location}`);
  if (event.description) lines.push(`   Notes: ${event.description.slice(0, 100)}${event.description.length > 100 ? '...' : ''}`);
  const attendeeCount = event.attendees?.length ?? 0;
  if (attendeeCount > 0) {
    const names = event.attendees.slice(0, 3).map(attendee => attendee.displayName || attendee.email).join(', ');
    lines.push(`   Attendees: ${names}${attendeeCount > 3 ? ` +${attendeeCount - 3} more` : ''}`);
  }
  if (event.id) lines.push(`   ID: \`${event.id}\``);
  return lines.join('\n');
}

export async function executeCalendarChatTool(ctx, toolName, params = {}) {
  const credentials = requireGoogleCredentials(ctx);

  switch (toolName) {
    case 'calendar_get_today': {
      const events = await CalendarAPI.getTodayEvents(credentials);
      if (!events.length) return 'No events on your calendar today.';
      return `Today's calendar - ${events.length} event${events.length !== 1 ? 's' : ''}:\n\n${events.map((event, index) => formatEvent(event, index + 1)).join('\n\n')}`;
    }

    case 'calendar_get_upcoming': {
      const days = params.days ?? 7;
      const maxResults = params.max_results ?? 20;
      const events = await CalendarAPI.getUpcomingEvents(credentials, days, maxResults);
      if (!events.length) return `No upcoming events in the next ${days} day${days !== 1 ? 's' : ''}.`;
      return `Upcoming events (next ${days} days) - ${events.length} event${events.length !== 1 ? 's' : ''}:\n\n${events.map((event, index) => formatEvent(event, index + 1)).join('\n\n')}`;
    }

    case 'calendar_list_calendars': {
      const calendars = await CalendarAPI.listCalendars(credentials);
      if (!calendars.length) return 'No Google Calendars found.';
      const lines = calendars.map((calendar, index) => (
        `${index + 1}. **${calendar.summary || calendar.id}**${calendar.primary ? ' *(primary)*' : ''}\n   ID: \`${calendar.id}\`${calendar.description ? `\n   ${calendar.description}` : ''}`
      )).join('\n\n');
      return `Your Google Calendars (${calendars.length}):\n\n${lines}`;
    }

    case 'calendar_search_events': {
      const { query, max_results } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      const events = await CalendarAPI.searchEvents(credentials, query, max_results ?? 20);
      if (!events.length) return `No calendar events found matching "${query}".`;
      return `Calendar search "${query}" - ${events.length} result${events.length !== 1 ? 's' : ''}:\n\n${events.map((event, index) => formatEvent(event, index + 1)).join('\n\n')}`;
    }

    case 'calendar_list_events': {
      const calendarId = params.calendar_id?.trim() || 'primary';
      const opts = {};
      if (params.time_min) opts.timeMin = params.time_min;
      if (params.time_max) opts.timeMax = params.time_max;
      if (params.max_results) opts.maxResults = Number(params.max_results);
      const events = await CalendarAPI.listEvents(credentials, calendarId, opts);
      if (!events.length) return 'No events found in the specified date range.';
      return `Calendar events - ${events.length} event${events.length !== 1 ? 's' : ''}:\n\n${events.map((event, index) => formatEvent(event, index + 1)).join('\n\n')}`;
    }

    case 'calendar_create_event': {
      const { summary, start_datetime, end_datetime, description, location, attendees, all_day, calendar_id } = params;
      if (!summary?.trim()) throw new Error('Missing required param: summary (event title)');
      if (!start_datetime?.trim()) throw new Error('Missing required param: start_datetime');

      let endDateTime = end_datetime;
      if (!endDateTime && !all_day) {
        try {
          const startDate = new Date(start_datetime);
          startDate.setHours(startDate.getHours() + 1);
          endDateTime = startDate.toISOString();
        } catch {
          endDateTime = start_datetime;
        }
      }

      const attendeeList = attendees
        ? String(attendees).split(',').map(email => email.trim()).filter(Boolean)
        : [];

      const event = await CalendarAPI.createEvent(credentials, calendar_id?.trim() || 'primary', {
        summary: summary.trim(),
        startDateTime: start_datetime.trim(),
        endDateTime,
        description: description?.trim() || '',
        location: location?.trim() || '',
        attendees: attendeeList,
        allDay: Boolean(all_day),
      });

      return [
        'Event created in Google Calendar',
        `Title: ${event.summary ?? summary}`,
        `When: ${formatEventTime(event.start)}`,
        event.location ? `Where: ${event.location}` : '',
        attendeeList.length ? `Invited: ${attendeeList.join(', ')}` : '',
        event.id ? `ID: \`${event.id}\`` : '',
        event.htmlLink ? `Link: ${event.htmlLink}` : '',
      ].filter(Boolean).join('\n');
    }

    case 'calendar_delete_event': {
      const { event_id, calendar_id } = params;
      if (!event_id?.trim()) throw new Error('Missing required param: event_id');
      await CalendarAPI.deleteEvent(credentials, calendar_id?.trim() || 'primary', event_id.trim());
      return `Event \`${event_id}\` deleted from your Google Calendar.`;
    }

    default:
      throw new Error(`Unknown Calendar tool: ${toolName}`);
  }
}
