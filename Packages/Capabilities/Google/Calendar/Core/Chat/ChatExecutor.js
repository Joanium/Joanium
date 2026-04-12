import * as CalendarAPI from '../API/CalendarAPI.js';
import { requireGoogleCredentials } from '../../../Common.js';
import { formatEventTime, formatEvent, formatSlot } from './Utils.js';
export async function executeCalendarChatTool(ctx, toolName, params = {}) {
  const credentials = requireGoogleCredentials(ctx);
  switch (toolName) {
    case 'calendar_get_today': {
      const events = await CalendarAPI.getTodayEvents(credentials);
      return events.length
        ? `Today's calendar - ${events.length} event${1 !== events.length ? 's' : ''}:\n\n${events.map((e, i) => formatEvent(e, i + 1)).join('\n\n')}`
        : 'No events on your calendar today.';
    }
    case 'calendar_get_upcoming': {
      const days = params.days ?? 7,
        maxResults = params.max_results ?? 20,
        events = await CalendarAPI.getUpcomingEvents(credentials, days, maxResults);
      return events.length
        ? `Upcoming events (next ${days} days) - ${events.length} event${1 !== events.length ? 's' : ''}:\n\n${events.map((e, i) => formatEvent(e, i + 1)).join('\n\n')}`
        : `No upcoming events in the next ${days} day${1 !== days ? 's' : ''}.`;
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
      const { query: query, max_results: max_results } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      const events = await CalendarAPI.searchEvents(credentials, query, max_results ?? 20);
      return events.length
        ? `Calendar search "${query}" - ${events.length} result${1 !== events.length ? 's' : ''}:\n\n${events.map((e, i) => formatEvent(e, i + 1)).join('\n\n')}`
        : `No calendar events found matching "${query}".`;
    }
    case 'calendar_list_events': {
      const calendarId = params.calendar_id?.trim() || 'primary',
        opts = {};
      (params.time_min && (opts.timeMin = params.time_min),
        params.time_max && (opts.timeMax = params.time_max),
        params.max_results && (opts.maxResults = Number(params.max_results)));
      const events = await CalendarAPI.listEvents(credentials, calendarId, opts);
      return events.length
        ? `Calendar events - ${events.length} event${1 !== events.length ? 's' : ''}:\n\n${events.map((e, i) => formatEvent(e, i + 1)).join('\n\n')}`
        : 'No events found in the specified date range.';
    }
    case 'calendar_create_event': {
      const {
        summary: summary,
        start_datetime: start_datetime,
        end_datetime: end_datetime,
        description: description,
        location: location,
        attendees: attendees,
        all_day: all_day,
        calendar_id: calendar_id,
      } = params;
      if (!summary?.trim()) throw new Error('Missing required param: summary (event title)');
      if (!start_datetime?.trim()) throw new Error('Missing required param: start_datetime');
      let endDateTime = end_datetime;
      if (!endDateTime && !all_day)
        try {
          const startDate = new Date(start_datetime);
          (startDate.setHours(startDate.getHours() + 1), (endDateTime = startDate.toISOString()));
        } catch {
          endDateTime = start_datetime;
        }
      const attendeeList = attendees
          ? String(attendees)
              .split(',')
              .map((e) => e.trim())
              .filter(Boolean)
          : [],
        event = await CalendarAPI.createEvent(credentials, calendar_id?.trim() || 'primary', {
          summary: summary.trim(),
          startDateTime: start_datetime.trim(),
          endDateTime: endDateTime,
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
      const { event_id: event_id, calendar_id: calendar_id } = params;
      if (!event_id?.trim()) throw new Error('Missing required param: event_id');
      return (
        await CalendarAPI.deleteEvent(
          credentials,
          calendar_id?.trim() || 'primary',
          event_id.trim(),
        ),
        `Event \`${event_id}\` deleted from your Google Calendar.`
      );
    }
    case 'calendar_get_this_week': {
      const events = await CalendarAPI.getThisWeekEvents(credentials);
      return events.length
        ? `This week's events - ${events.length} event${1 !== events.length ? 's' : ''}:\n\n${events.map((e, i) => formatEvent(e, i + 1)).join('\n\n')}`
        : 'No events this week.';
    }
    case 'calendar_get_next_week': {
      const events = await CalendarAPI.getNextWeekEvents(credentials);
      return events.length
        ? `Next week's events - ${events.length} event${1 !== events.length ? 's' : ''}:\n\n${events.map((e, i) => formatEvent(e, i + 1)).join('\n\n')}`
        : 'No events next week.';
    }
    case 'calendar_get_this_month': {
      const events = await CalendarAPI.getThisMonthEvents(credentials);
      return events.length
        ? `This month's events - ${events.length} event${1 !== events.length ? 's' : ''}:\n\n${events.map((e, i) => formatEvent(e, i + 1)).join('\n\n')}`
        : 'No events this month.';
    }
    case 'calendar_get_next_event': {
      const event = await CalendarAPI.getNextEvent(credentials);
      return event ? `Your next event:\n\n${formatEvent(event, 1)}` : 'No upcoming events found.';
    }
    case 'calendar_get_events_on_date': {
      const { date: date } = params;
      if (!date?.trim()) throw new Error('Missing required param: date');
      const events = await CalendarAPI.getEventsOnDate(credentials, date.trim());
      return events.length
        ? `Events on ${date} - ${events.length} event${1 !== events.length ? 's' : ''}:\n\n${events.map((e, i) => formatEvent(e, i + 1)).join('\n\n')}`
        : `No events found on ${date}.`;
    }
    case 'calendar_get_free_slots': {
      const {
        date: date,
        work_start: work_start,
        work_end: work_end,
        min_minutes: min_minutes,
      } = params;
      if (!date?.trim()) throw new Error('Missing required param: date');
      const slots = await CalendarAPI.getFreeSlots(
        credentials,
        date.trim(),
        work_start ?? 9,
        work_end ?? 18,
        min_minutes ?? 30,
      );
      return slots.length
        ? `Free slots on ${date} (${work_start ?? 9}:00–${work_end ?? 18}:00):\n\n${slots.map((s, i) => formatSlot(s, i + 1)).join('\n')}`
        : `No free slots of ${min_minutes ?? 30}+ minutes found on ${date} during working hours.`;
    }
    case 'calendar_get_event': {
      const { event_id: event_id, calendar_id: calendar_id } = params;
      if (!event_id?.trim()) throw new Error('Missing required param: event_id');
      const event = await CalendarAPI.getEvent(
        credentials,
        calendar_id?.trim() || 'primary',
        event_id.trim(),
      );
      return `Event details:\n\n${formatEvent(event, 1)}`;
    }
    case 'calendar_update_event': {
      const {
        event_id: event_id,
        calendar_id: calendar_id,
        summary: summary,
        description: description,
        location: location,
        start_datetime: start_datetime,
        end_datetime: end_datetime,
      } = params;
      if (!event_id?.trim()) throw new Error('Missing required param: event_id');
      const patch = {};
      if (
        (summary && (patch.summary = summary.trim()),
        void 0 !== description && (patch.description = description),
        void 0 !== location && (patch.location = location),
        start_datetime)
      ) {
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
    case 'calendar_move_event': {
      const {
        event_id: event_id,
        source_calendar_id: source_calendar_id,
        destination_calendar_id: destination_calendar_id,
      } = params;
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
    case 'calendar_duplicate_event': {
      const { event_id: event_id, calendar_id: calendar_id, shift_days: shift_days } = params;
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
    case 'calendar_create_recurring_event': {
      const {
        summary: summary,
        start_datetime: start_datetime,
        end_datetime: end_datetime,
        rrule: rrule,
        description: description,
        location: location,
        attendees: attendees,
        calendar_id: calendar_id,
      } = params;
      if (!summary?.trim()) throw new Error('Missing required param: summary');
      if (!start_datetime?.trim()) throw new Error('Missing required param: start_datetime');
      if (!rrule?.trim())
        throw new Error('Missing required param: rrule (e.g. RRULE:FREQ=WEEKLY;BYDAY=MO)');
      let endDateTime = end_datetime;
      if (!endDateTime) {
        const s = new Date(start_datetime);
        (s.setHours(s.getHours() + 1), (endDateTime = s.toISOString()));
      }
      const attendeeList = attendees
          ? String(attendees)
              .split(',')
              .map((e) => e.trim())
              .filter(Boolean)
          : [],
        event = await CalendarAPI.createEvent(credentials, calendar_id?.trim() || 'primary', {
          summary: summary.trim(),
          startDateTime: start_datetime.trim(),
          endDateTime: endDateTime,
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
    case 'calendar_add_attendees': {
      const { event_id: event_id, calendar_id: calendar_id, attendees: attendees } = params;
      if (!event_id?.trim()) throw new Error('Missing required param: event_id');
      if (!attendees?.trim()) throw new Error('Missing required param: attendees');
      const existing = await CalendarAPI.getEvent(
          credentials,
          calendar_id?.trim() || 'primary',
          event_id.trim(),
        ),
        currentEmails = new Set((existing.attendees ?? []).map((a) => a.email)),
        newEmails = String(attendees)
          .split(',')
          .map((e) => e.trim())
          .filter((e) => e && !currentEmails.has(e));
      if (!newEmails.length) return 'All provided attendees are already invited to this event.';
      const merged = [
          ...(existing.attendees ?? []),
          ...newEmails.map((email) => ({ email: email })),
        ],
        updated = await CalendarAPI.patchEvent(
          credentials,
          calendar_id?.trim() || 'primary',
          event_id.trim(),
          { attendees: merged },
        );
      return `Added ${newEmails.length} attendee${1 !== newEmails.length ? 's' : ''} (${newEmails.join(', ')}) to **${updated.summary}**.`;
    }
    case 'calendar_remove_attendees': {
      const { event_id: event_id, calendar_id: calendar_id, attendees: attendees } = params;
      if (!event_id?.trim()) throw new Error('Missing required param: event_id');
      if (!attendees?.trim()) throw new Error('Missing required param: attendees');
      const existing = await CalendarAPI.getEvent(
          credentials,
          calendar_id?.trim() || 'primary',
          event_id.trim(),
        ),
        removeSet = new Set(
          String(attendees)
            .split(',')
            .map((e) => e.trim().toLowerCase()),
        ),
        filtered = (existing.attendees ?? []).filter((a) => !removeSet.has(a.email.toLowerCase())),
        removedCount = (existing.attendees?.length ?? 0) - filtered.length;
      return removedCount
        ? `Removed ${removedCount} attendee${1 !== removedCount ? 's' : ''} from **${(await CalendarAPI.patchEvent(credentials, calendar_id?.trim() || 'primary', event_id.trim(), { attendees: filtered })).summary}**. ${filtered.length} attendee${1 !== filtered.length ? 's' : ''} remaining.`
        : 'None of the provided attendees were found on this event.';
    }
    case 'calendar_count_events': {
      const { time_min: time_min, time_max: time_max, calendar_id: calendar_id } = params;
      if (!time_min?.trim()) throw new Error('Missing required param: time_min');
      if (!time_max?.trim()) throw new Error('Missing required param: time_max');
      const count = await CalendarAPI.countEvents(
        credentials,
        calendar_id?.trim() || 'primary',
        time_min.trim(),
        time_max.trim(),
      );
      return `You have **${count}** event${1 !== count ? 's' : ''} between ${time_min} and ${time_max}.`;
    }
    case 'calendar_get_events_in_range': {
      const {
        start_date: start_date,
        end_date: end_date,
        calendar_id: calendar_id,
        max_results: max_results,
      } = params;
      if (!start_date?.trim()) throw new Error('Missing required param: start_date');
      if (!end_date?.trim()) throw new Error('Missing required param: end_date');
      const events = await CalendarAPI.getEventsInRange(
        credentials,
        calendar_id?.trim() || 'primary',
        start_date.trim(),
        end_date.trim(),
        max_results ?? 50,
      );
      return events.length
        ? `Events from ${start_date} to ${end_date} - ${events.length} event${1 !== events.length ? 's' : ''}:\n\n${events.map((e, i) => formatEvent(e, i + 1)).join('\n\n')}`
        : `No events found between ${start_date} and ${end_date}.`;
    }
    case 'calendar_get_events_by_attendee': {
      const { email: email, max_results: max_results } = params;
      if (!email?.trim()) throw new Error('Missing required param: email');
      const events = await CalendarAPI.getEventsByAttendee(
        credentials,
        email.trim(),
        max_results ?? 20,
      );
      return events.length
        ? `Events involving ${email} - ${events.length} result${1 !== events.length ? 's' : ''}:\n\n${events.map((e, i) => formatEvent(e, i + 1)).join('\n\n')}`
        : `No events found involving ${email}.`;
    }
    case 'calendar_get_events_by_location': {
      const { location: location, max_results: max_results } = params;
      if (!location?.trim()) throw new Error('Missing required param: location');
      const events = await CalendarAPI.getEventsByLocation(
        credentials,
        location.trim(),
        max_results ?? 20,
      );
      return events.length
        ? `Events at "${location}" - ${events.length} result${1 !== events.length ? 's' : ''}:\n\n${events.map((e, i) => formatEvent(e, i + 1)).join('\n\n')}`
        : `No events found at location matching "${location}".`;
    }
    case 'calendar_get_free_busy': {
      const { time_min: time_min, time_max: time_max, calendar_ids: calendar_ids } = params;
      if (!time_min?.trim()) throw new Error('Missing required param: time_min');
      if (!time_max?.trim()) throw new Error('Missing required param: time_max');
      const ids = calendar_ids
          ? String(calendar_ids)
              .split(',')
              .map((id) => id.trim())
              .filter(Boolean)
          : ['primary'],
        result = await CalendarAPI.getFreeBusy(credentials, ids, time_min.trim(), time_max.trim());
      return `Free/busy status (${time_min} → ${time_max}):\n\n${ids
        .map((id) => {
          const busy = result.calendars?.[id]?.busy ?? [];
          if (!busy.length) return `**${id}**: Free the entire period.`;
          const slots = busy
            .map(
              (b) =>
                `  • ${new Date(b.start).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} → ${new Date(b.end).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
            )
            .join('\n');
          return `**${id}**: ${busy.length} busy interval${1 !== busy.length ? 's' : ''}:\n${slots}`;
        })
        .join('\n\n')}`;
    }
    case 'calendar_clear_day': {
      const { date: date, calendar_id: calendar_id } = params;
      if (!date?.trim()) throw new Error('Missing required param: date');
      const count = await CalendarAPI.clearDay(
        credentials,
        calendar_id?.trim() || 'primary',
        date.trim(),
      );
      return count
        ? `Deleted ${count} event${1 !== count ? 's' : ''} from ${date}.`
        : `No events found on ${date} — nothing to delete.`;
    }
    case 'calendar_create_out_of_office': {
      const {
        start_date: start_date,
        end_date: end_date,
        reason: reason,
        calendar_id: calendar_id,
      } = params;
      if (!start_date?.trim()) throw new Error('Missing required param: start_date');
      const title = reason?.trim() ? `Out of Office: ${reason.trim()}` : 'Out of Office',
        event = await CalendarAPI.createEvent(credentials, calendar_id?.trim() || 'primary', {
          summary: title,
          startDateTime: start_date.trim(),
          endDateTime: end_date?.trim() || start_date.trim(),
          allDay: !0,
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
    case 'calendar_rename_event': {
      const { event_id: event_id, calendar_id: calendar_id, summary: summary } = params;
      if (!event_id?.trim()) throw new Error('Missing required param: event_id');
      if (!summary?.trim()) throw new Error('Missing required param: summary');
      return `Event renamed to **${(await CalendarAPI.renameEvent(credentials, calendar_id?.trim() || 'primary', event_id.trim(), summary.trim())).summary}** (ID: \`${event_id}\`).`;
    }
    case 'calendar_set_event_color': {
      const { event_id: event_id, calendar_id: calendar_id, color_id: color_id } = params;
      if (!event_id?.trim()) throw new Error('Missing required param: event_id');
      if (null == color_id) throw new Error('Missing required param: color_id (1–11)');
      const COLOR_NAMES = {
          1: 'Lavender',
          2: 'Sage',
          3: 'Grape',
          4: 'Flamingo',
          5: 'Banana',
          6: 'Tangerine',
          7: 'Peacock',
          8: 'Graphite',
          9: 'Blueberry',
          10: 'Basil',
          11: 'Tomato',
        },
        updated = await CalendarAPI.setEventColor(
          credentials,
          calendar_id?.trim() || 'primary',
          event_id.trim(),
          color_id,
        ),
        name = COLOR_NAMES[Number(color_id)] ?? `Color ${color_id}`;
      return `Event **${updated.summary}** color set to ${name} (ID ${color_id}).`;
    }
    case 'calendar_get_this_weekend': {
      const events = await CalendarAPI.getThisWeekendEvents(credentials);
      return events.length
        ? `This weekend's events - ${events.length} event${1 !== events.length ? 's' : ''}:\n\n${events.map((e, i) => formatEvent(e, i + 1)).join('\n\n')}`
        : 'No events this weekend.';
    }
    case 'calendar_set_event_reminders': {
      const { event_id: event_id, calendar_id: calendar_id, minutes: minutes } = params;
      if (!event_id?.trim()) throw new Error('Missing required param: event_id');
      const minutesList = minutes
          ? String(minutes)
              .split(',')
              .map((m) => m.trim())
              .filter(Boolean)
          : [],
        updated = await CalendarAPI.setEventReminders(
          credentials,
          calendar_id?.trim() || 'primary',
          event_id.trim(),
          minutesList,
        ),
        desc = minutesList.length
          ? `Reminders set: ${minutesList.map((m) => `${m} min before`).join(', ')}.`
          : 'Reminders reset to calendar default.';
      return `**${updated.summary}** — ${desc}`;
    }
    case 'calendar_bulk_create_events': {
      const { events_json: events_json, calendar_id: calendar_id } = params;
      if (!events_json?.trim()) throw new Error('Missing required param: events_json');
      let eventDataArray;
      try {
        if (((eventDataArray = JSON.parse(events_json)), !Array.isArray(eventDataArray)))
          throw new Error('events_json must be a JSON array');
      } catch (e) {
        throw new Error(`Invalid events_json: ${e.message}`);
      }
      const normalised = eventDataArray.map((e) => ({
          summary: e.summary,
          startDateTime: e.startDateTime ?? e.start_datetime,
          endDateTime: e.endDateTime ?? e.end_datetime,
          description: e.description ?? '',
          location: e.location ?? '',
          attendees: Array.isArray(e.attendees) ? e.attendees : [],
          allDay: e.allDay ?? e.all_day ?? !1,
        })),
        created = await CalendarAPI.bulkCreateEvents(
          credentials,
          calendar_id?.trim() || 'primary',
          normalised,
        ),
        lines = created
          .map(
            (ev, i) =>
              `${i + 1}. **${ev.summary}** — ${formatEventTime(ev.start)}${ev.id ? ` (\`${ev.id}\`)` : ''}`,
          )
          .join('\n');
      return `Created ${created.length} event${1 !== created.length ? 's' : ''}:\n\n${lines}`;
    }
    case 'calendar_get_video_conference_events': {
      const days = params.days ?? 30,
        max = params.max_results ?? 20,
        events = await CalendarAPI.getEventsWithVideoConference(credentials, days, max);
      if (!events.length)
        return `No events with video conference links found in the next ${days} days.`;
      const lines = events
        .map((e, i) => {
          const meet =
            e.conferenceData.entryPoints.find((ep) => 'video' === ep.entryPointType) ??
            e.conferenceData.entryPoints[0];
          return `${formatEvent(e, i + 1)}\n   Join: ${meet.uri}`;
        })
        .join('\n\n');
      return `Events with video conference links (next ${days} days) — ${events.length} found:\n\n${lines}`;
    }
    case 'calendar_rsvp_event': {
      const { event_id: event_id, calendar_id: calendar_id, email: email, status: status } = params;
      if (!event_id?.trim()) throw new Error('Missing required param: event_id');
      if (!email?.trim()) throw new Error('Missing required param: email');
      if (!status?.trim())
        throw new Error('Missing required param: status (accepted / declined / tentative)');
      const updated = await CalendarAPI.rsvpEvent(
          credentials,
          calendar_id?.trim() || 'primary',
          event_id.trim(),
          email.trim(),
          status.trim(),
        ),
        label =
          {
            accepted: 'Accepted ✅',
            declined: 'Declined ❌',
            tentative: 'Tentatively accepted 🤔',
          }[status] ?? status;
      return `RSVP updated for **${updated.summary}**: ${label} (as ${email}).`;
    }
    case 'calendar_get_recently_modified': {
      const {
        updated_min: updated_min,
        calendar_id: calendar_id,
        max_results: max_results,
      } = params;
      if (!updated_min?.trim())
        throw new Error('Missing required param: updated_min (ISO 8601 timestamp)');
      const events = await CalendarAPI.getRecentlyModifiedEvents(
        credentials,
        calendar_id?.trim() || 'primary',
        updated_min.trim(),
        max_results ?? 20,
      );
      return events.length
        ? `Events modified since ${updated_min} — ${events.length} found:\n\n${events.map((e, i) => formatEvent(e, i + 1)).join('\n\n')}`
        : `No events modified since ${updated_min}.`;
    }
    case 'calendar_get_recurring_instances': {
      const { event_id: event_id, calendar_id: calendar_id, max_results: max_results } = params;
      if (!event_id?.trim())
        throw new Error('Missing required param: event_id (recurring event ID)');
      const instances = await CalendarAPI.getRecurringEventInstances(
        credentials,
        calendar_id?.trim() || 'primary',
        event_id.trim(),
        max_results ?? 20,
      );
      return instances.length
        ? `Instances of recurring event (${instances.length} shown):\n\n${instances.map((e, i) => formatEvent(e, i + 1)).join('\n\n')}`
        : 'No instances found for this recurring event.';
    }
    case 'calendar_get_meeting_hours': {
      const { time_min: time_min, time_max: time_max, calendar_id: calendar_id } = params;
      if (!time_min?.trim()) throw new Error('Missing required param: time_min');
      if (!time_max?.trim()) throw new Error('Missing required param: time_max');
      const {
        count: count,
        totalMinutes: totalMinutes,
        totalHours: totalHours,
      } = await CalendarAPI.getMeetingHours(
        credentials,
        calendar_id?.trim() || 'primary',
        time_min.trim(),
        time_max.trim(),
      );
      if (!count) return `No timed events found between ${time_min} and ${time_max}.`;
      const hrs = Math.floor(totalMinutes / 60),
        mins = totalMinutes % 60;
      return `Meeting summary (${time_min} → ${time_max}):\n\n• **${count}** timed event${1 !== count ? 's' : ''}\n• **${hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`}** total (${totalHours} hours)`;
    }
    case 'calendar_get_declined_events': {
      const days = params.days ?? 30,
        events = await CalendarAPI.getDeclinedEvents(credentials, days, params.max_results ?? 20);
      return events.length
        ? `Declined events (next ${days} days) — ${events.length} found:\n\n${events.map((e, i) => formatEvent(e, i + 1)).join('\n\n')}`
        : `No declined events found in the next ${days} days.`;
    }
    case 'calendar_get_unanswered_invites': {
      const days = params.days ?? 30,
        events = await CalendarAPI.getUnansweredInvites(
          credentials,
          days,
          params.max_results ?? 20,
        );
      return events.length
        ? `Unanswered invites (next ${days} days) — ${events.length} found:\n\n${events.map((e, i) => formatEvent(e, i + 1)).join('\n\n')}`
        : `No unanswered invites in the next ${days} days.`;
    }
    case 'calendar_get_organised_events': {
      const days = params.days ?? 30,
        events = await CalendarAPI.getOrganisedEvents(credentials, days, params.max_results ?? 20);
      return events.length
        ? `Events you organised (next ${days} days) — ${events.length} found:\n\n${events.map((e, i) => formatEvent(e, i + 1)).join('\n\n')}`
        : `You are not the organiser of any upcoming events in the next ${days} days.`;
    }
    case 'calendar_get_all_day_events': {
      const {
        time_min: time_min,
        time_max: time_max,
        calendar_id: calendar_id,
        max_results: max_results,
      } = params;
      if (!time_min?.trim()) throw new Error('Missing required param: time_min');
      if (!time_max?.trim()) throw new Error('Missing required param: time_max');
      const events = await CalendarAPI.getAllDayEvents(
        credentials,
        calendar_id?.trim() || 'primary',
        time_min.trim(),
        time_max.trim(),
        max_results ?? 50,
      );
      return events.length
        ? `All-day events (${time_min} → ${time_max}) — ${events.length} found:\n\n${events.map((e, i) => formatEvent(e, i + 1)).join('\n\n')}`
        : `No all-day events found between ${time_min} and ${time_max}.`;
    }
    case 'calendar_set_event_description': {
      const {
        event_id: event_id,
        calendar_id: calendar_id,
        description: description,
        append: append,
      } = params;
      if (!event_id?.trim()) throw new Error('Missing required param: event_id');
      if (null == description) throw new Error('Missing required param: description');
      return `Description ${append ? 'appended to' : 'set on'} **${(await CalendarAPI.setEventDescription(credentials, calendar_id?.trim() || 'primary', event_id.trim(), String(description), Boolean(append))).summary}** successfully.`;
    }
    case 'calendar_set_event_location': {
      const { event_id: event_id, calendar_id: calendar_id, location: location } = params;
      if (!event_id?.trim()) throw new Error('Missing required param: event_id');
      if (null == location) throw new Error('Missing required param: location');
      const updated = await CalendarAPI.setEventLocation(
        credentials,
        calendar_id?.trim() || 'primary',
        event_id.trim(),
        String(location),
      );
      return `Location for **${updated.summary}** updated to: ${updated.location || '(cleared)'}.`;
    }
    case 'calendar_get_conflicting_events': {
      const {
        start_datetime: start_datetime,
        end_datetime: end_datetime,
        calendar_id: calendar_id,
      } = params;
      if (!start_datetime?.trim()) throw new Error('Missing required param: start_datetime');
      if (!end_datetime?.trim()) throw new Error('Missing required param: end_datetime');
      const events = await CalendarAPI.getConflictingEvents(
        credentials,
        start_datetime.trim(),
        end_datetime.trim(),
        calendar_id?.trim() || 'primary',
      );
      return events.length
        ? `${events.length} conflicting event${1 !== events.length ? 's' : ''} found:\n\n${events.map((e, i) => formatEvent(e, i + 1)).join('\n\n')}`
        : `No conflicting events found between ${start_datetime} and ${end_datetime}.`;
    }
    case 'calendar_snooze_event': {
      const { event_id: event_id, calendar_id: calendar_id, minutes: minutes } = params;
      if (!event_id?.trim()) throw new Error('Missing required param: event_id');
      const mins = Number(minutes ?? 30),
        updated = await CalendarAPI.snoozeEvent(
          credentials,
          calendar_id?.trim() || 'primary',
          event_id.trim(),
          mins,
        );
      return `**${updated.summary}** snoozed by ${mins} minutes. New start: ${formatEventTime(updated.start)}.`;
    }
    case 'calendar_get_events_by_creator': {
      const { email: email, days: days, max_results: max_results } = params;
      if (!email?.trim()) throw new Error('Missing required param: email');
      const events = await CalendarAPI.getEventsByCreator(
        credentials,
        email.trim(),
        days ?? 30,
        max_results ?? 20,
      );
      return events.length
        ? `Events created by ${email} — ${events.length} found:\n\n${events.map((e, i) => formatEvent(e, i + 1)).join('\n\n')}`
        : `No upcoming events created by ${email}.`;
    }
    case 'calendar_extend_event': {
      const { event_id: event_id, calendar_id: calendar_id, minutes: minutes } = params;
      if (!event_id?.trim()) throw new Error('Missing required param: event_id');
      const mins = Number(minutes ?? 30),
        updated = await CalendarAPI.extendEvent(
          credentials,
          calendar_id?.trim() || 'primary',
          event_id.trim(),
          mins,
        );
      return `**${updated.summary}** extended by ${mins} minutes. New end: ${formatEventTime(updated.end)}.`;
    }
    case 'calendar_shorten_event': {
      const { event_id: event_id, calendar_id: calendar_id, minutes: minutes } = params;
      if (!event_id?.trim()) throw new Error('Missing required param: event_id');
      const mins = Number(minutes ?? 15),
        updated = await CalendarAPI.shortenEvent(
          credentials,
          calendar_id?.trim() || 'primary',
          event_id.trim(),
          mins,
        );
      return `**${updated.summary}** shortened by ${mins} minutes. New end: ${formatEventTime(updated.end)}.`;
    }
    case 'calendar_get_daily_breakdown': {
      const { time_min: time_min, time_max: time_max, calendar_id: calendar_id } = params;
      if (!time_min?.trim()) throw new Error('Missing required param: time_min');
      if (!time_max?.trim()) throw new Error('Missing required param: time_max');
      const breakdown = await CalendarAPI.getDailyBreakdown(
          credentials,
          calendar_id?.trim() || 'primary',
          time_min.trim(),
          time_max.trim(),
        ),
        entries = Object.entries(breakdown).sort(([a], [b]) => a.localeCompare(b));
      if (!entries.length) return `No events found between ${time_min} and ${time_max}.`;
      const lines = entries.map(([date, { count: count, totalMinutes: totalMinutes }]) => {
        const hrs = Math.floor(totalMinutes / 60);
        return `• **${date}**: ${count} event${1 !== count ? 's' : ''}${totalMinutes > 0 ? ` — ${hrs > 0 ? `${hrs}h ` : ''}${totalMinutes % 60}m` : ''}`;
      });
      return `Daily breakdown (${time_min} → ${time_max}) — ${entries.reduce((s, [, v]) => s + v.count, 0)} events across ${entries.length} day${1 !== entries.length ? 's' : ''}:\n\n${lines.join('\n')}`;
    }
    case 'calendar_get_longest_free_block': {
      const { date: date, work_start: work_start, work_end: work_end } = params;
      if (!date?.trim()) throw new Error('Missing required param: date');
      const slot = await CalendarAPI.getLongestFreeBlock(
        credentials,
        date.trim(),
        work_start ?? 9,
        work_end ?? 18,
      );
      if (!slot) return `No free blocks found on ${date} during working hours.`;
      const fmt = (d) => d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' }),
        mins = Math.round((slot.end - slot.start) / 6e4),
        hrs = Math.floor(mins / 60),
        rem = mins % 60,
        duration = hrs > 0 ? `${hrs}h ${rem}m` : `${rem}m`;
      return `Longest free block on ${date}: **${fmt(slot.start)} – ${fmt(slot.end)}** (${duration}).`;
    }
    case 'calendar_copy_day_events': {
      const {
        source_date: source_date,
        target_date: target_date,
        calendar_id: calendar_id,
      } = params;
      if (!source_date?.trim()) throw new Error('Missing required param: source_date');
      if (!target_date?.trim()) throw new Error('Missing required param: target_date');
      const created = await CalendarAPI.copyDayEvents(
        credentials,
        calendar_id?.trim() || 'primary',
        source_date.trim(),
        target_date.trim(),
      );
      if (!created.length) return `No events found on ${source_date} to copy.`;
      const lines = created
        .map((e, i) => `${i + 1}. **${e.summary || '(No title)'}** — ${formatEventTime(e.start)}`)
        .join('\n');
      return `Copied ${created.length} event${1 !== created.length ? 's' : ''} from ${source_date} to ${target_date}:\n\n${lines}`;
    }
    case 'calendar_set_event_visibility': {
      const { event_id: event_id, calendar_id: calendar_id, visibility: visibility } = params;
      if (!event_id?.trim()) throw new Error('Missing required param: event_id');
      if (!visibility?.trim())
        throw new Error(
          'Missing required param: visibility (default / public / private / confidential)',
        );
      const updated = await CalendarAPI.setEventVisibility(
        credentials,
        calendar_id?.trim() || 'primary',
        event_id.trim(),
        visibility.trim(),
      );
      return `Visibility of **${updated.summary}** set to \`${updated.visibility}\`.`;
    }
    case 'calendar_set_event_status': {
      const { event_id: event_id, calendar_id: calendar_id, status: status } = params;
      if (!event_id?.trim()) throw new Error('Missing required param: event_id');
      if (!status?.trim())
        throw new Error('Missing required param: status (confirmed / tentative / cancelled)');
      const updated = await CalendarAPI.setEventStatus(
        credentials,
        calendar_id?.trim() || 'primary',
        event_id.trim(),
        status.trim(),
      );
      return `Status of **${updated.summary}** set to \`${updated.status}\`.`;
    }
    case 'calendar_get_solo_events': {
      const days = params.days ?? 14,
        events = await CalendarAPI.getSoloEvents(credentials, days, params.max_results ?? 20);
      return events.length
        ? `Solo events (next ${days} days) — ${events.length} found:\n\n${events.map((e, i) => formatEvent(e, i + 1)).join('\n\n')}`
        : `No solo (no-attendee) events found in the next ${days} days.`;
    }
    case 'calendar_get_large_meetings': {
      const min = params.min_attendees ?? 5,
        days = params.days ?? 14,
        events = await CalendarAPI.getLargeMeetings(
          credentials,
          min,
          days,
          params.max_results ?? 20,
        );
      return events.length
        ? `Large meetings (${min}+ attendees, next ${days} days) — ${events.length} found:\n\n${events.map((e, i) => formatEvent(e, i + 1)).join('\n\n')}`
        : `No meetings with ${min}+ attendees found in the next ${days} days.`;
    }
    case 'calendar_reschedule_event': {
      const {
        event_id: event_id,
        calendar_id: calendar_id,
        new_start_datetime: new_start_datetime,
      } = params;
      if (!event_id?.trim()) throw new Error('Missing required param: event_id');
      if (!new_start_datetime?.trim())
        throw new Error('Missing required param: new_start_datetime');
      const updated = await CalendarAPI.rescheduleEvent(
        credentials,
        calendar_id?.trim() || 'primary',
        event_id.trim(),
        new_start_datetime.trim(),
      );
      return `**${updated.summary}** rescheduled.\nNew time: ${formatEventTime(updated.start)} → ${formatEventTime(updated.end)}.`;
    }
    case 'calendar_get_agenda_summary': {
      const { time_min: time_min, time_max: time_max, max_results: max_results } = params;
      if (!time_min?.trim()) throw new Error('Missing required param: time_min');
      if (!time_max?.trim()) throw new Error('Missing required param: time_max');
      const agenda = await CalendarAPI.getAgendaSummary(
        credentials,
        time_min.trim(),
        time_max.trim(),
        max_results ?? 50,
      );
      return `Agenda (${time_min} → ${time_max}):\n\n${agenda}`;
    }
    default:
      throw new Error(`Unknown Calendar tool: ${toolName}`);
  }
}
