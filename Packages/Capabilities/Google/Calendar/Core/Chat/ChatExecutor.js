import * as CalendarAPI from '../API/CalendarAPI.js';
import { requireGoogleCredentials } from '../../../Common.js';

function formatEventTime(eventTime) {
  if (!eventTime) return 'N/A';
  if (eventTime.dateTime) {
    return new Date(eventTime.dateTime).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  if (eventTime.date) {
    return (
      new Date(`${eventTime.date}T00:00:00`).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }) + ' (all day)'
    );
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
  if (event.description)
    lines.push(
      `   Notes: ${event.description.slice(0, 100)}${event.description.length > 100 ? '...' : ''}`,
    );
  const attendeeCount = event.attendees?.length ?? 0;
  if (attendeeCount > 0) {
    const names = event.attendees
      .slice(0, 3)
      .map((a) => a.displayName || a.email)
      .join(', ');
    lines.push(`   Attendees: ${names}${attendeeCount > 3 ? ` +${attendeeCount - 3} more` : ''}`);
  }
  if (event.recurrence?.length) lines.push(`   Recurring: ${event.recurrence[0]}`);
  if (event.colorId) lines.push(`   Color ID: ${event.colorId}`);
  if (event.id) lines.push(`   ID: \`${event.id}\``);
  return lines.join('\n');
}

function formatSlot(slot, index) {
  const fmt = (d) => d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' });
  const mins = Math.round((slot.end - slot.start) / 60_000);
  return `${index}. ${fmt(slot.start)} – ${fmt(slot.end)} (${mins} min)`;
}

export async function executeCalendarChatTool(ctx, toolName, params = {}) {
  const credentials = requireGoogleCredentials(ctx);

  switch (toolName) {
    // ─── Existing tools ────────────────────────────────────────────────────

    case 'calendar_get_today': {
      const events = await CalendarAPI.getTodayEvents(credentials);
      if (!events.length) return 'No events on your calendar today.';
      return `Today's calendar - ${events.length} event${events.length !== 1 ? 's' : ''}:\n\n${events.map((e, i) => formatEvent(e, i + 1)).join('\n\n')}`;
    }

    case 'calendar_get_upcoming': {
      const days = params.days ?? 7;
      const maxResults = params.max_results ?? 20;
      const events = await CalendarAPI.getUpcomingEvents(credentials, days, maxResults);
      if (!events.length)
        return `No upcoming events in the next ${days} day${days !== 1 ? 's' : ''}.`;
      return `Upcoming events (next ${days} days) - ${events.length} event${events.length !== 1 ? 's' : ''}:\n\n${events.map((e, i) => formatEvent(e, i + 1)).join('\n\n')}`;
    }

    case 'calendar_list_calendars': {
      const calendars = await CalendarAPI.listCalendars(credentials);
      if (!calendars.length) return 'No Google Calendars found.';
      const lines = calendars
        .map(
          (cal, i) =>
            `${i + 1}. **${cal.summary || cal.id}**${cal.primary ? ' *(primary)*' : ''}\n   ID: \`${cal.id}\`${cal.description ? `\n   ${cal.description}` : ''}`,
        )
        .join('\n\n');
      return `Your Google Calendars (${calendars.length}):\n\n${lines}`;
    }

    case 'calendar_search_events': {
      const { query, max_results } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      const events = await CalendarAPI.searchEvents(credentials, query, max_results ?? 20);
      if (!events.length) return `No calendar events found matching "${query}".`;
      return `Calendar search "${query}" - ${events.length} result${events.length !== 1 ? 's' : ''}:\n\n${events.map((e, i) => formatEvent(e, i + 1)).join('\n\n')}`;
    }

    case 'calendar_list_events': {
      const calendarId = params.calendar_id?.trim() || 'primary';
      const opts = {};
      if (params.time_min) opts.timeMin = params.time_min;
      if (params.time_max) opts.timeMax = params.time_max;
      if (params.max_results) opts.maxResults = Number(params.max_results);
      const events = await CalendarAPI.listEvents(credentials, calendarId, opts);
      if (!events.length) return 'No events found in the specified date range.';
      return `Calendar events - ${events.length} event${events.length !== 1 ? 's' : ''}:\n\n${events.map((e, i) => formatEvent(e, i + 1)).join('\n\n')}`;
    }

    case 'calendar_create_event': {
      const {
        summary,
        start_datetime,
        end_datetime,
        description,
        location,
        attendees,
        all_day,
        calendar_id,
      } = params;
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
        ? String(attendees)
            .split(',')
            .map((e) => e.trim())
            .filter(Boolean)
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
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'calendar_delete_event': {
      const { event_id, calendar_id } = params;
      if (!event_id?.trim()) throw new Error('Missing required param: event_id');
      await CalendarAPI.deleteEvent(credentials, calendar_id?.trim() || 'primary', event_id.trim());
      return `Event \`${event_id}\` deleted from your Google Calendar.`;
    }

    // ─── New tools ─────────────────────────────────────────────────────────

    // 1. Get this week's events
    case 'calendar_get_this_week': {
      const events = await CalendarAPI.getThisWeekEvents(credentials);
      if (!events.length) return 'No events this week.';
      return `This week's events - ${events.length} event${events.length !== 1 ? 's' : ''}:\n\n${events.map((e, i) => formatEvent(e, i + 1)).join('\n\n')}`;
    }

    // 2. Get next week's events
    case 'calendar_get_next_week': {
      const events = await CalendarAPI.getNextWeekEvents(credentials);
      if (!events.length) return 'No events next week.';
      return `Next week's events - ${events.length} event${events.length !== 1 ? 's' : ''}:\n\n${events.map((e, i) => formatEvent(e, i + 1)).join('\n\n')}`;
    }

    // 3. Get this month's events
    case 'calendar_get_this_month': {
      const events = await CalendarAPI.getThisMonthEvents(credentials);
      if (!events.length) return 'No events this month.';
      return `This month's events - ${events.length} event${events.length !== 1 ? 's' : ''}:\n\n${events.map((e, i) => formatEvent(e, i + 1)).join('\n\n')}`;
    }

    // 4. Get the very next upcoming event
    case 'calendar_get_next_event': {
      const event = await CalendarAPI.getNextEvent(credentials);
      if (!event) return 'No upcoming events found.';
      return `Your next event:\n\n${formatEvent(event, 1)}`;
    }

    // 5. Get events on a specific date
    case 'calendar_get_events_on_date': {
      const { date } = params;
      if (!date?.trim()) throw new Error('Missing required param: date');
      const events = await CalendarAPI.getEventsOnDate(credentials, date.trim());
      if (!events.length) return `No events found on ${date}.`;
      return `Events on ${date} - ${events.length} event${events.length !== 1 ? 's' : ''}:\n\n${events.map((e, i) => formatEvent(e, i + 1)).join('\n\n')}`;
    }

    // 6. Find free time slots
    case 'calendar_get_free_slots': {
      const { date, work_start, work_end, min_minutes } = params;
      if (!date?.trim()) throw new Error('Missing required param: date');
      const slots = await CalendarAPI.getFreeSlots(
        credentials,
        date.trim(),
        work_start ?? 9,
        work_end ?? 18,
        min_minutes ?? 30,
      );
      if (!slots.length)
        return `No free slots of ${min_minutes ?? 30}+ minutes found on ${date} during working hours.`;
      return `Free slots on ${date} (${work_start ?? 9}:00–${work_end ?? 18}:00):\n\n${slots.map((s, i) => formatSlot(s, i + 1)).join('\n')}`;
    }

    // 7. Get event details by ID
    case 'calendar_get_event': {
      const { event_id, calendar_id } = params;
      if (!event_id?.trim()) throw new Error('Missing required param: event_id');
      const event = await CalendarAPI.getEvent(
        credentials,
        calendar_id?.trim() || 'primary',
        event_id.trim(),
      );
      return `Event details:\n\n${formatEvent(event, 1)}`;
    }

    // 8. Update an event (patch specific fields)
    case 'calendar_update_event': {
      const {
        event_id,
        calendar_id,
        summary,
        description,
        location,
        start_datetime,
        end_datetime,
      } = params;
      if (!event_id?.trim()) throw new Error('Missing required param: event_id');
      const patch = {};
      if (summary) patch.summary = summary.trim();
      if (description !== undefined) patch.description = description;
      if (location !== undefined) patch.location = location;
      if (start_datetime) {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        patch.start = { dateTime: new Date(start_datetime).toISOString(), timeZone: tz };
      }
      if (end_datetime) {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        patch.end = { dateTime: new Date(end_datetime).toISOString(), timeZone: tz };
      }
      const updated = await CalendarAPI.patchEvent(
        credentials,
        calendar_id?.trim() || 'primary',
        event_id.trim(),
        patch,
      );
      return `Event updated:\n\n${formatEvent(updated, 1)}`;
    }

    // 9. Move event to a different calendar
    case 'calendar_move_event': {
      const { event_id, source_calendar_id, destination_calendar_id } = params;
      if (!event_id?.trim()) throw new Error('Missing required param: event_id');
      if (!destination_calendar_id?.trim())
        throw new Error('Missing required param: destination_calendar_id');
      const moved = await CalendarAPI.moveEvent(
        credentials,
        source_calendar_id?.trim() || 'primary',
        event_id.trim(),
        destination_calendar_id.trim(),
      );
      return `Event \`${event_id}\` moved to calendar \`${destination_calendar_id}\`.\n\n${formatEvent(moved, 1)}`;
    }

    // 10. Duplicate an event
    case 'calendar_duplicate_event': {
      const { event_id, calendar_id, shift_days } = params;
      if (!event_id?.trim()) throw new Error('Missing required param: event_id');
      const clone = await CalendarAPI.duplicateEvent(
        credentials,
        calendar_id?.trim() || 'primary',
        event_id.trim(),
        shift_days ?? 0,
      );
      return [
        'Event duplicated successfully.',
        `New event: **${clone.summary}**`,
        `When: ${formatEventTime(clone.start)}`,
        clone.id ? `New ID: \`${clone.id}\`` : '',
        clone.htmlLink ? `Link: ${clone.htmlLink}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    // 11. Create a recurring event
    case 'calendar_create_recurring_event': {
      const {
        summary,
        start_datetime,
        end_datetime,
        rrule,
        description,
        location,
        attendees,
        calendar_id,
      } = params;
      if (!summary?.trim()) throw new Error('Missing required param: summary');
      if (!start_datetime?.trim()) throw new Error('Missing required param: start_datetime');
      if (!rrule?.trim())
        throw new Error('Missing required param: rrule (e.g. RRULE:FREQ=WEEKLY;BYDAY=MO)');

      let endDateTime = end_datetime;
      if (!endDateTime) {
        const s = new Date(start_datetime);
        s.setHours(s.getHours() + 1);
        endDateTime = s.toISOString();
      }

      const attendeeList = attendees
        ? String(attendees)
            .split(',')
            .map((e) => e.trim())
            .filter(Boolean)
        : [];

      const event = await CalendarAPI.createEvent(credentials, calendar_id?.trim() || 'primary', {
        summary: summary.trim(),
        startDateTime: start_datetime.trim(),
        endDateTime,
        description: description?.trim() || '',
        location: location?.trim() || '',
        attendees: attendeeList,
        recurrence: [rrule.startsWith('RRULE:') ? rrule : `RRULE:${rrule}`],
      });

      return [
        'Recurring event created.',
        `Title: ${event.summary}`,
        `When: ${formatEventTime(event.start)}`,
        `Repeats: ${rrule}`,
        event.id ? `ID: \`${event.id}\`` : '',
        event.htmlLink ? `Link: ${event.htmlLink}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    // 12. Add attendees to an existing event
    case 'calendar_add_attendees': {
      const { event_id, calendar_id, attendees } = params;
      if (!event_id?.trim()) throw new Error('Missing required param: event_id');
      if (!attendees?.trim()) throw new Error('Missing required param: attendees');
      const existing = await CalendarAPI.getEvent(
        credentials,
        calendar_id?.trim() || 'primary',
        event_id.trim(),
      );
      const currentEmails = new Set((existing.attendees ?? []).map((a) => a.email));
      const newEmails = String(attendees)
        .split(',')
        .map((e) => e.trim())
        .filter((e) => e && !currentEmails.has(e));
      if (!newEmails.length) return 'All provided attendees are already invited to this event.';
      const merged = [...(existing.attendees ?? []), ...newEmails.map((email) => ({ email }))];
      const updated = await CalendarAPI.patchEvent(
        credentials,
        calendar_id?.trim() || 'primary',
        event_id.trim(),
        { attendees: merged },
      );
      return `Added ${newEmails.length} attendee${newEmails.length !== 1 ? 's' : ''} (${newEmails.join(', ')}) to **${updated.summary}**.`;
    }

    // 13. Remove attendees from an existing event
    case 'calendar_remove_attendees': {
      const { event_id, calendar_id, attendees } = params;
      if (!event_id?.trim()) throw new Error('Missing required param: event_id');
      if (!attendees?.trim()) throw new Error('Missing required param: attendees');
      const existing = await CalendarAPI.getEvent(
        credentials,
        calendar_id?.trim() || 'primary',
        event_id.trim(),
      );
      const removeSet = new Set(
        String(attendees)
          .split(',')
          .map((e) => e.trim().toLowerCase()),
      );
      const filtered = (existing.attendees ?? []).filter(
        (a) => !removeSet.has(a.email.toLowerCase()),
      );
      const removedCount = (existing.attendees?.length ?? 0) - filtered.length;
      if (!removedCount) return 'None of the provided attendees were found on this event.';
      const updated = await CalendarAPI.patchEvent(
        credentials,
        calendar_id?.trim() || 'primary',
        event_id.trim(),
        { attendees: filtered },
      );
      return `Removed ${removedCount} attendee${removedCount !== 1 ? 's' : ''} from **${updated.summary}**. ${filtered.length} attendee${filtered.length !== 1 ? 's' : ''} remaining.`;
    }

    // 14. Count events in a period
    case 'calendar_count_events': {
      const { time_min, time_max, calendar_id } = params;
      if (!time_min?.trim()) throw new Error('Missing required param: time_min');
      if (!time_max?.trim()) throw new Error('Missing required param: time_max');
      const count = await CalendarAPI.countEvents(
        credentials,
        calendar_id?.trim() || 'primary',
        time_min.trim(),
        time_max.trim(),
      );
      return `You have **${count}** event${count !== 1 ? 's' : ''} between ${time_min} and ${time_max}.`;
    }

    // 15. Get events within a custom date range
    case 'calendar_get_events_in_range': {
      const { start_date, end_date, calendar_id, max_results } = params;
      if (!start_date?.trim()) throw new Error('Missing required param: start_date');
      if (!end_date?.trim()) throw new Error('Missing required param: end_date');
      const events = await CalendarAPI.getEventsInRange(
        credentials,
        calendar_id?.trim() || 'primary',
        start_date.trim(),
        end_date.trim(),
        max_results ?? 50,
      );
      if (!events.length) return `No events found between ${start_date} and ${end_date}.`;
      return `Events from ${start_date} to ${end_date} - ${events.length} event${events.length !== 1 ? 's' : ''}:\n\n${events.map((e, i) => formatEvent(e, i + 1)).join('\n\n')}`;
    }

    // 16. Find events by attendee email
    case 'calendar_get_events_by_attendee': {
      const { email, max_results } = params;
      if (!email?.trim()) throw new Error('Missing required param: email');
      const events = await CalendarAPI.getEventsByAttendee(
        credentials,
        email.trim(),
        max_results ?? 20,
      );
      if (!events.length) return `No events found involving ${email}.`;
      return `Events involving ${email} - ${events.length} result${events.length !== 1 ? 's' : ''}:\n\n${events.map((e, i) => formatEvent(e, i + 1)).join('\n\n')}`;
    }

    // 17. Find events by location
    case 'calendar_get_events_by_location': {
      const { location, max_results } = params;
      if (!location?.trim()) throw new Error('Missing required param: location');
      const events = await CalendarAPI.getEventsByLocation(
        credentials,
        location.trim(),
        max_results ?? 20,
      );
      if (!events.length) return `No events found at location matching "${location}".`;
      return `Events at "${location}" - ${events.length} result${events.length !== 1 ? 's' : ''}:\n\n${events.map((e, i) => formatEvent(e, i + 1)).join('\n\n')}`;
    }

    // 18. Get free/busy status
    case 'calendar_get_free_busy': {
      const { time_min, time_max, calendar_ids } = params;
      if (!time_min?.trim()) throw new Error('Missing required param: time_min');
      if (!time_max?.trim()) throw new Error('Missing required param: time_max');
      const ids = calendar_ids
        ? String(calendar_ids)
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean)
        : ['primary'];
      const result = await CalendarAPI.getFreeBusy(
        credentials,
        ids,
        time_min.trim(),
        time_max.trim(),
      );
      const lines = ids.map((id) => {
        const busy = result.calendars?.[id]?.busy ?? [];
        if (!busy.length) return `**${id}**: Free the entire period.`;
        const slots = busy
          .map(
            (b) =>
              `  • ${new Date(b.start).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} → ${new Date(b.end).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
          )
          .join('\n');
        return `**${id}**: ${busy.length} busy interval${busy.length !== 1 ? 's' : ''}:\n${slots}`;
      });
      return `Free/busy status (${time_min} → ${time_max}):\n\n${lines.join('\n\n')}`;
    }

    // 19. Clear all events on a day
    case 'calendar_clear_day': {
      const { date, calendar_id } = params;
      if (!date?.trim()) throw new Error('Missing required param: date');
      const count = await CalendarAPI.clearDay(
        credentials,
        calendar_id?.trim() || 'primary',
        date.trim(),
      );
      if (!count) return `No events found on ${date} — nothing to delete.`;
      return `Deleted ${count} event${count !== 1 ? 's' : ''} from ${date}.`;
    }

    // 20. Create an out-of-office / all-day block
    case 'calendar_create_out_of_office': {
      const { start_date, end_date, reason, calendar_id } = params;
      if (!start_date?.trim()) throw new Error('Missing required param: start_date');
      const title = reason?.trim() ? `Out of Office: ${reason.trim()}` : 'Out of Office';
      const event = await CalendarAPI.createEvent(credentials, calendar_id?.trim() || 'primary', {
        summary: title,
        startDateTime: start_date.trim(),
        endDateTime: end_date?.trim() || start_date.trim(),
        allDay: true,
        status: 'confirmed',
        visibility: 'public',
      });
      return [
        'Out-of-office event created.',
        `Title: ${event.summary}`,
        `Date: ${formatEventTime(event.start)}`,
        event.id ? `ID: \`${event.id}\`` : '',
        event.htmlLink ? `Link: ${event.htmlLink}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    default:
      throw new Error(`Unknown Calendar tool: ${toolName}`);
  }
}
