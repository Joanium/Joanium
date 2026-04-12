export const CALENDAR_TOOLS = [
  {
    name: 'calendar_get_today',
    description: "Get all of the user's Google Calendar events for today.",
    category: 'calendar',
    parameters: {},
  },
  {
    name: 'calendar_get_upcoming',
    description: "Get the user's upcoming Google Calendar events for the next N days.",
    category: 'calendar',
    parameters: {
      days: {
        type: 'number',
        required: !1,
        description: 'Number of days to look ahead (default: 7).',
      },
      max_results: {
        type: 'number',
        required: !1,
        description: 'Max events to return (default: 20).',
      },
    },
  },
  {
    name: 'calendar_list_calendars',
    description: "List all of the user's Google Calendars (personal, shared, subscribed, etc.).",
    category: 'calendar',
    parameters: {},
  },
  {
    name: 'calendar_search_events',
    description: 'Search for Google Calendar events by keyword.',
    category: 'calendar',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description: 'Search term to find events by title, location, or description.',
      },
      max_results: {
        type: 'number',
        required: !1,
        description: 'Max results to return (default: 20).',
      },
    },
  },
  {
    name: 'calendar_list_events',
    description: 'List Google Calendar events within a specific date range.',
    category: 'calendar',
    parameters: {
      time_min: {
        type: 'string',
        required: !1,
        description: 'Start of the range in ISO 8601 or YYYY-MM-DD format.',
      },
      time_max: {
        type: 'string',
        required: !1,
        description: 'End of the range in ISO 8601 or YYYY-MM-DD format.',
      },
      calendar_id: {
        type: 'string',
        required: !1,
        description: 'Calendar ID to list from (default: primary).',
      },
      max_results: {
        type: 'number',
        required: !1,
        description: 'Max events to return (default: 20).',
      },
    },
  },
  {
    name: 'calendar_create_event',
    description: 'Create a new event in Google Calendar.',
    category: 'calendar',
    parameters: {
      summary: { type: 'string', required: !0, description: 'Event title.' },
      start_datetime: {
        type: 'string',
        required: !0,
        description: 'Start date/time in ISO 8601 or YYYY-MM-DDTHH:MM format.',
      },
      end_datetime: {
        type: 'string',
        required: !1,
        description: 'End date/time. Defaults to 1 hour after start.',
      },
      description: { type: 'string', required: !1, description: 'Event description or notes.' },
      location: { type: 'string', required: !1, description: 'Physical or virtual location.' },
      attendees: {
        type: 'string',
        required: !1,
        description: 'Comma-separated email addresses to invite.',
      },
      all_day: {
        type: 'boolean',
        required: !1,
        description: 'Set true for an all-day event (start_datetime should be YYYY-MM-DD).',
      },
      calendar_id: {
        type: 'string',
        required: !1,
        description: 'Calendar ID to add the event to (default: primary).',
      },
    },
  },
  {
    name: 'calendar_delete_event',
    description: 'Delete a Google Calendar event by event ID.',
    category: 'calendar',
    parameters: {
      event_id: {
        type: 'string',
        required: !0,
        description: 'The Google Calendar event ID to delete.',
      },
      calendar_id: { type: 'string', required: !1, description: 'Calendar ID (default: primary).' },
    },
  },
  {
    name: 'calendar_get_this_week',
    description:
      "Get all of the user's Google Calendar events for the current calendar week (Monday–Sunday).",
    category: 'calendar',
    parameters: {},
  },
  {
    name: 'calendar_get_next_week',
    description:
      "Get all of the user's Google Calendar events for next calendar week (Monday–Sunday).",
    category: 'calendar',
    parameters: {},
  },
  {
    name: 'calendar_get_this_month',
    description: "Get all of the user's Google Calendar events for the current calendar month.",
    category: 'calendar',
    parameters: {},
  },
  {
    name: 'calendar_get_next_event',
    description: "Get the single next upcoming event on the user's primary Google Calendar.",
    category: 'calendar',
    parameters: {},
  },
  {
    name: 'calendar_get_events_on_date',
    description:
      "Get all events on a specific date. Accepts 'today', 'tomorrow', 'yesterday', or a YYYY-MM-DD date string.",
    category: 'calendar',
    parameters: {
      date: {
        type: 'string',
        required: !0,
        description: "Date to look up. Use 'today', 'tomorrow', 'yesterday', or YYYY-MM-DD.",
      },
    },
  },
  {
    name: 'calendar_get_free_slots',
    description:
      'Find free time slots of a minimum length on a specific day, within configurable working hours.',
    category: 'calendar',
    parameters: {
      date: {
        type: 'string',
        required: !0,
        description: 'Date to scan for free slots in YYYY-MM-DD format.',
      },
      work_start: {
        type: 'number',
        required: !1,
        description: 'Start of working hours as a 24-hour integer (default: 9).',
      },
      work_end: {
        type: 'number',
        required: !1,
        description: 'End of working hours as a 24-hour integer (default: 18).',
      },
      min_minutes: {
        type: 'number',
        required: !1,
        description: 'Minimum slot length in minutes to include (default: 30).',
      },
    },
  },
  {
    name: 'calendar_get_event',
    description: 'Fetch full details of a single Google Calendar event by its ID.',
    category: 'calendar',
    parameters: {
      event_id: { type: 'string', required: !0, description: 'The event ID to retrieve.' },
      calendar_id: { type: 'string', required: !1, description: 'Calendar ID (default: primary).' },
    },
  },
  {
    name: 'calendar_update_event',
    description:
      'Update specific fields of an existing Google Calendar event (title, description, location, or time).',
    category: 'calendar',
    parameters: {
      event_id: { type: 'string', required: !0, description: 'ID of the event to update.' },
      calendar_id: { type: 'string', required: !1, description: 'Calendar ID (default: primary).' },
      summary: { type: 'string', required: !1, description: 'New event title.' },
      description: { type: 'string', required: !1, description: 'New event description.' },
      location: { type: 'string', required: !1, description: 'New event location.' },
      start_datetime: {
        type: 'string',
        required: !1,
        description: 'New start date/time in ISO 8601 format.',
      },
      end_datetime: {
        type: 'string',
        required: !1,
        description: 'New end date/time in ISO 8601 format.',
      },
    },
  },
  {
    name: 'calendar_move_event',
    description: 'Move a Google Calendar event from one calendar to another.',
    category: 'calendar',
    parameters: {
      event_id: { type: 'string', required: !0, description: 'ID of the event to move.' },
      destination_calendar_id: {
        type: 'string',
        required: !0,
        description: 'ID of the target calendar.',
      },
      source_calendar_id: {
        type: 'string',
        required: !1,
        description: 'ID of the source calendar (default: primary).',
      },
    },
  },
  {
    name: 'calendar_duplicate_event',
    description:
      'Duplicate an existing Google Calendar event, optionally shifting it by a number of days.',
    category: 'calendar',
    parameters: {
      event_id: { type: 'string', required: !0, description: 'ID of the event to duplicate.' },
      calendar_id: { type: 'string', required: !1, description: 'Calendar ID (default: primary).' },
      shift_days: {
        type: 'number',
        required: !1,
        description: 'Number of days to shift the duplicate forward (default: 0 = same time).',
      },
    },
  },
  {
    name: 'calendar_create_recurring_event',
    description: 'Create a new recurring event in Google Calendar using an RRULE recurrence rule.',
    category: 'calendar',
    parameters: {
      summary: { type: 'string', required: !0, description: 'Event title.' },
      start_datetime: {
        type: 'string',
        required: !0,
        description: 'Start date/time in ISO 8601 format.',
      },
      rrule: {
        type: 'string',
        required: !0,
        description:
          'Recurrence rule string, e.g. "FREQ=WEEKLY;BYDAY=MO,WE,FR" or "FREQ=DAILY;COUNT=10".',
      },
      end_datetime: {
        type: 'string',
        required: !1,
        description: 'End date/time for each occurrence (default: 1 hour after start).',
      },
      description: { type: 'string', required: !1, description: 'Event description.' },
      location: { type: 'string', required: !1, description: 'Event location.' },
      attendees: {
        type: 'string',
        required: !1,
        description: 'Comma-separated email addresses to invite.',
      },
      calendar_id: { type: 'string', required: !1, description: 'Calendar ID (default: primary).' },
    },
  },
  {
    name: 'calendar_add_attendees',
    description: 'Add one or more attendees to an existing Google Calendar event.',
    category: 'calendar',
    parameters: {
      event_id: { type: 'string', required: !0, description: 'ID of the event to update.' },
      attendees: {
        type: 'string',
        required: !0,
        description: 'Comma-separated email addresses to add.',
      },
      calendar_id: { type: 'string', required: !1, description: 'Calendar ID (default: primary).' },
    },
  },
  {
    name: 'calendar_remove_attendees',
    description: 'Remove one or more attendees from an existing Google Calendar event.',
    category: 'calendar',
    parameters: {
      event_id: { type: 'string', required: !0, description: 'ID of the event to update.' },
      attendees: {
        type: 'string',
        required: !0,
        description: 'Comma-separated email addresses to remove.',
      },
      calendar_id: { type: 'string', required: !1, description: 'Calendar ID (default: primary).' },
    },
  },
  {
    name: 'calendar_count_events',
    description: 'Count the number of events in a given time range on a calendar.',
    category: 'calendar',
    parameters: {
      time_min: {
        type: 'string',
        required: !0,
        description: 'Start of the range in ISO 8601 or YYYY-MM-DD format.',
      },
      time_max: {
        type: 'string',
        required: !0,
        description: 'End of the range in ISO 8601 or YYYY-MM-DD format.',
      },
      calendar_id: { type: 'string', required: !1, description: 'Calendar ID (default: primary).' },
    },
  },
  {
    name: 'calendar_get_events_in_range',
    description: 'Get events between two specific dates on any calendar.',
    category: 'calendar',
    parameters: {
      start_date: {
        type: 'string',
        required: !0,
        description: 'Start date in ISO 8601 or YYYY-MM-DD format.',
      },
      end_date: {
        type: 'string',
        required: !0,
        description: 'End date in ISO 8601 or YYYY-MM-DD format.',
      },
      calendar_id: { type: 'string', required: !1, description: 'Calendar ID (default: primary).' },
      max_results: {
        type: 'number',
        required: !1,
        description: 'Max events to return (default: 50).',
      },
    },
  },
  {
    name: 'calendar_get_events_by_attendee',
    description:
      "Search for calendar events that include a specific person's email address as an attendee.",
    category: 'calendar',
    parameters: {
      email: {
        type: 'string',
        required: !0,
        description: "Attendee's email address to search for.",
      },
      max_results: {
        type: 'number',
        required: !1,
        description: 'Max results to return (default: 20).',
      },
    },
  },
  {
    name: 'calendar_get_events_by_location',
    description: 'Find calendar events that match a specific location keyword.',
    category: 'calendar',
    parameters: {
      location: {
        type: 'string',
        required: !0,
        description:
          'Location keyword to search for (e.g. "Conference Room B", "Zoom", "New York").',
      },
      max_results: {
        type: 'number',
        required: !1,
        description: 'Max results to return (default: 20).',
      },
    },
  },
  {
    name: 'calendar_get_free_busy',
    description:
      'Query the free/busy status of one or more calendars over a time range using the Google Calendar Freebusy API.',
    category: 'calendar',
    parameters: {
      time_min: {
        type: 'string',
        required: !0,
        description: 'Start of the query window in ISO 8601 format.',
      },
      time_max: {
        type: 'string',
        required: !0,
        description: 'End of the query window in ISO 8601 format.',
      },
      calendar_ids: {
        type: 'string',
        required: !1,
        description: 'Comma-separated calendar IDs to check (default: primary).',
      },
    },
  },
  {
    name: 'calendar_clear_day',
    description:
      'Delete all events on a specific day from a calendar. Use with caution — this is irreversible.',
    category: 'calendar',
    parameters: {
      date: { type: 'string', required: !0, description: 'Date to clear in YYYY-MM-DD format.' },
      calendar_id: { type: 'string', required: !1, description: 'Calendar ID (default: primary).' },
    },
  },
  {
    name: 'calendar_create_out_of_office',
    description: 'Create an all-day out-of-office block on the calendar for one or more days.',
    category: 'calendar',
    parameters: {
      start_date: {
        type: 'string',
        required: !0,
        description: 'First day of the out-of-office period in YYYY-MM-DD format.',
      },
      end_date: {
        type: 'string',
        required: !1,
        description:
          'Last day of the out-of-office period in YYYY-MM-DD format (default: same as start_date).',
      },
      reason: {
        type: 'string',
        required: !1,
        description: 'Optional reason shown in the event title, e.g. "Vacation" or "Conference".',
      },
      calendar_id: { type: 'string', required: !1, description: 'Calendar ID (default: primary).' },
    },
  },
  {
    name: 'calendar_rename_event',
    description: 'Rename (change the title of) an existing Google Calendar event.',
    category: 'calendar',
    parameters: {
      event_id: { type: 'string', required: !0, description: 'ID of the event to rename.' },
      summary: { type: 'string', required: !0, description: 'New title for the event.' },
      calendar_id: { type: 'string', required: !1, description: 'Calendar ID (default: primary).' },
    },
  },
  {
    name: 'calendar_set_event_color',
    description:
      'Set the display color of a Google Calendar event using a color ID (1–11: Lavender, Sage, Grape, Flamingo, Banana, Tangerine, Peacock, Graphite, Blueberry, Basil, Tomato).',
    category: 'calendar',
    parameters: {
      event_id: { type: 'string', required: !0, description: 'ID of the event to recolor.' },
      color_id: {
        type: 'number',
        required: !0,
        description:
          'Color ID 1–11. 1=Lavender 2=Sage 3=Grape 4=Flamingo 5=Banana 6=Tangerine 7=Peacock 8=Graphite 9=Blueberry 10=Basil 11=Tomato.',
      },
      calendar_id: { type: 'string', required: !1, description: 'Calendar ID (default: primary).' },
    },
  },
  {
    name: 'calendar_get_this_weekend',
    description:
      "Get all of the user's Google Calendar events for this coming Saturday and Sunday.",
    category: 'calendar',
    parameters: {},
  },
  {
    name: 'calendar_set_event_reminders',
    description:
      'Set popup reminders on an existing event, replacing any existing reminders. Pass an empty minutes list to restore calendar defaults.',
    category: 'calendar',
    parameters: {
      event_id: { type: 'string', required: !0, description: 'ID of the event to update.' },
      minutes: {
        type: 'string',
        required: !1,
        description:
          'Comma-separated list of reminder times in minutes before the event, e.g. "10,30,60". Omit to restore default reminders.',
      },
      calendar_id: { type: 'string', required: !1, description: 'Calendar ID (default: primary).' },
    },
  },
  {
    name: 'calendar_bulk_create_events',
    description:
      'Create multiple Google Calendar events in one call by passing a JSON array of event objects.',
    category: 'calendar',
    parameters: {
      events_json: {
        type: 'string',
        required: !0,
        description:
          'JSON array of event objects. Each must have at minimum "summary" and "startDateTime". Optional fields: endDateTime, description, location, attendees (array), allDay (boolean).',
      },
      calendar_id: {
        type: 'string',
        required: !1,
        description: 'Calendar ID to create all events on (default: primary).',
      },
    },
  },
  {
    name: 'calendar_get_video_conference_events',
    description:
      'Find upcoming Google Calendar events that have a Google Meet or other video conference link attached.',
    category: 'calendar',
    parameters: {
      days: {
        type: 'number',
        required: !1,
        description: 'How many days ahead to scan (default: 30).',
      },
      max_results: {
        type: 'number',
        required: !1,
        description: 'Max events to check (default: 20).',
      },
    },
  },
  {
    name: 'calendar_rsvp_event',
    description:
      "Update the user's RSVP / attendance response on a Google Calendar event (accepted, declined, or tentative).",
    category: 'calendar',
    parameters: {
      event_id: { type: 'string', required: !0, description: 'ID of the event to RSVP to.' },
      email: {
        type: 'string',
        required: !0,
        description: "The user's email address as it appears on the invite.",
      },
      status: {
        type: 'string',
        required: !0,
        description: "Response status: 'accepted', 'declined', or 'tentative'.",
      },
      calendar_id: { type: 'string', required: !1, description: 'Calendar ID (default: primary).' },
    },
  },
  {
    name: 'calendar_get_recently_modified',
    description:
      'Get a list of calendar events that were created or updated after a given timestamp — useful for spotting recent changes.',
    category: 'calendar',
    parameters: {
      updated_min: {
        type: 'string',
        required: !0,
        description: 'ISO 8601 timestamp. Only events modified after this time are returned.',
      },
      calendar_id: { type: 'string', required: !1, description: 'Calendar ID (default: primary).' },
      max_results: {
        type: 'number',
        required: !1,
        description: 'Max results to return (default: 20).',
      },
    },
  },
  {
    name: 'calendar_get_recurring_instances',
    description:
      'List individual occurrences (instances) of a recurring Google Calendar event by its recurring event ID.',
    category: 'calendar',
    parameters: {
      event_id: {
        type: 'string',
        required: !0,
        description: 'The ID of the recurring (master) event.',
      },
      calendar_id: { type: 'string', required: !1, description: 'Calendar ID (default: primary).' },
      max_results: {
        type: 'number',
        required: !1,
        description: 'Max instances to return (default: 20).',
      },
    },
  },
  {
    name: 'calendar_get_meeting_hours',
    description:
      'Calculate the total number of hours and count of timed meetings scheduled within a given date range.',
    category: 'calendar',
    parameters: {
      time_min: {
        type: 'string',
        required: !0,
        description: 'Start of the range in ISO 8601 or YYYY-MM-DD format.',
      },
      time_max: {
        type: 'string',
        required: !0,
        description: 'End of the range in ISO 8601 or YYYY-MM-DD format.',
      },
      calendar_id: { type: 'string', required: !1, description: 'Calendar ID (default: primary).' },
    },
  },
  {
    name: 'calendar_get_declined_events',
    description: 'Get upcoming events the user has declined.',
    category: 'calendar',
    parameters: {
      days: { type: 'number', required: !1, description: 'Days ahead to scan (default: 30).' },
      max_results: { type: 'number', required: !1, description: 'Max results (default: 20).' },
    },
  },
  {
    name: 'calendar_get_unanswered_invites',
    description:
      'Get upcoming calendar invites the user has not yet responded to (needs-action status).',
    category: 'calendar',
    parameters: {
      days: { type: 'number', required: !1, description: 'Days ahead to scan (default: 30).' },
      max_results: { type: 'number', required: !1, description: 'Max results (default: 20).' },
    },
  },
  {
    name: 'calendar_get_organised_events',
    description: 'Get upcoming events where the user is the organiser.',
    category: 'calendar',
    parameters: {
      days: { type: 'number', required: !1, description: 'Days ahead to scan (default: 30).' },
      max_results: { type: 'number', required: !1, description: 'Max results (default: 20).' },
    },
  },
  {
    name: 'calendar_get_all_day_events',
    description: 'Get only all-day events (no timed events) within a date range.',
    category: 'calendar',
    parameters: {
      time_min: {
        type: 'string',
        required: !0,
        description: 'Start of range in ISO 8601 or YYYY-MM-DD format.',
      },
      time_max: {
        type: 'string',
        required: !0,
        description: 'End of range in ISO 8601 or YYYY-MM-DD format.',
      },
      calendar_id: { type: 'string', required: !1, description: 'Calendar ID (default: primary).' },
      max_results: { type: 'number', required: !1, description: 'Max results (default: 50).' },
    },
  },
  {
    name: 'calendar_set_event_description',
    description: 'Set or append notes/description text on an existing Google Calendar event.',
    category: 'calendar',
    parameters: {
      event_id: { type: 'string', required: !0, description: 'ID of the event to update.' },
      description: {
        type: 'string',
        required: !0,
        description: 'The description text to set or append.',
      },
      append: {
        type: 'boolean',
        required: !1,
        description:
          'If true, appends to existing description instead of replacing it (default: false).',
      },
      calendar_id: { type: 'string', required: !1, description: 'Calendar ID (default: primary).' },
    },
  },
  {
    name: 'calendar_set_event_location',
    description: 'Set or update the location of an existing Google Calendar event.',
    category: 'calendar',
    parameters: {
      event_id: { type: 'string', required: !0, description: 'ID of the event to update.' },
      location: {
        type: 'string',
        required: !0,
        description: 'New location string. Pass an empty string to clear the location.',
      },
      calendar_id: { type: 'string', required: !1, description: 'Calendar ID (default: primary).' },
    },
  },
  {
    name: 'calendar_get_conflicting_events',
    description:
      'Find existing calendar events that overlap with a proposed time window — useful for conflict detection before scheduling.',
    category: 'calendar',
    parameters: {
      start_datetime: {
        type: 'string',
        required: !0,
        description: 'Start of the proposed window in ISO 8601 format.',
      },
      end_datetime: {
        type: 'string',
        required: !0,
        description: 'End of the proposed window in ISO 8601 format.',
      },
      calendar_id: { type: 'string', required: !1, description: 'Calendar ID (default: primary).' },
    },
  },
  {
    name: 'calendar_snooze_event',
    description:
      'Push an event forward in time by a given number of minutes, shifting both its start and end.',
    category: 'calendar',
    parameters: {
      event_id: { type: 'string', required: !0, description: 'ID of the event to snooze.' },
      minutes: {
        type: 'number',
        required: !1,
        description: 'Minutes to shift the event forward (default: 30).',
      },
      calendar_id: { type: 'string', required: !1, description: 'Calendar ID (default: primary).' },
    },
  },
  {
    name: 'calendar_get_events_by_creator',
    description:
      'Get upcoming events that were created by a specific person, identified by their email address.',
    category: 'calendar',
    parameters: {
      email: { type: 'string', required: !0, description: "Creator's email address to filter by." },
      days: { type: 'number', required: !1, description: 'Days ahead to scan (default: 30).' },
      max_results: { type: 'number', required: !1, description: 'Max results (default: 20).' },
    },
  },
  {
    name: 'calendar_extend_event',
    description:
      "Extend an event's end time by a given number of minutes without changing its start time.",
    category: 'calendar',
    parameters: {
      event_id: { type: 'string', required: !0, description: 'ID of the event to extend.' },
      minutes: {
        type: 'number',
        required: !1,
        description: 'Minutes to add to the end time (default: 30).',
      },
      calendar_id: { type: 'string', required: !1, description: 'Calendar ID (default: primary).' },
    },
  },
  {
    name: 'calendar_shorten_event',
    description:
      "Shorten an event's end time by a given number of minutes without changing its start time.",
    category: 'calendar',
    parameters: {
      event_id: { type: 'string', required: !0, description: 'ID of the event to shorten.' },
      minutes: {
        type: 'number',
        required: !1,
        description: 'Minutes to cut from the end (default: 15).',
      },
      calendar_id: { type: 'string', required: !1, description: 'Calendar ID (default: primary).' },
    },
  },
  {
    name: 'calendar_get_daily_breakdown',
    description:
      'Get a day-by-day summary of event counts and total meeting time within a date range.',
    category: 'calendar',
    parameters: {
      time_min: {
        type: 'string',
        required: !0,
        description: 'Start of range in ISO 8601 or YYYY-MM-DD format.',
      },
      time_max: {
        type: 'string',
        required: !0,
        description: 'End of range in ISO 8601 or YYYY-MM-DD format.',
      },
      calendar_id: { type: 'string', required: !1, description: 'Calendar ID (default: primary).' },
    },
  },
  {
    name: 'calendar_get_longest_free_block',
    description:
      'Find the single longest continuous free block of time on a given day within working hours.',
    category: 'calendar',
    parameters: {
      date: { type: 'string', required: !0, description: 'Date to analyse in YYYY-MM-DD format.' },
      work_start: {
        type: 'number',
        required: !1,
        description: 'Start of working hours as 24h integer (default: 9).',
      },
      work_end: {
        type: 'number',
        required: !1,
        description: 'End of working hours as 24h integer (default: 18).',
      },
    },
  },
  {
    name: 'calendar_copy_day_events',
    description:
      'Copy all events from one day to another day, preserving times relative to the new date.',
    category: 'calendar',
    parameters: {
      source_date: {
        type: 'string',
        required: !0,
        description: 'The date to copy events from in YYYY-MM-DD format.',
      },
      target_date: {
        type: 'string',
        required: !0,
        description: 'The date to copy events to in YYYY-MM-DD format.',
      },
      calendar_id: { type: 'string', required: !1, description: 'Calendar ID (default: primary).' },
    },
  },
  {
    name: 'calendar_set_event_visibility',
    description:
      'Set the visibility of a Google Calendar event (default, public, private, or confidential).',
    category: 'calendar',
    parameters: {
      event_id: { type: 'string', required: !0, description: 'ID of the event to update.' },
      visibility: {
        type: 'string',
        required: !0,
        description: "Visibility value: 'default', 'public', 'private', or 'confidential'.",
      },
      calendar_id: { type: 'string', required: !1, description: 'Calendar ID (default: primary).' },
    },
  },
  {
    name: 'calendar_set_event_status',
    description: 'Set the status of a Google Calendar event (confirmed, tentative, or cancelled).',
    category: 'calendar',
    parameters: {
      event_id: { type: 'string', required: !0, description: 'ID of the event to update.' },
      status: {
        type: 'string',
        required: !0,
        description: "Event status: 'confirmed', 'tentative', or 'cancelled'.",
      },
      calendar_id: { type: 'string', required: !1, description: 'Calendar ID (default: primary).' },
    },
  },
  {
    name: 'calendar_get_solo_events',
    description: 'Get upcoming events that have no attendees — personal or private blocks.',
    category: 'calendar',
    parameters: {
      days: { type: 'number', required: !1, description: 'Days ahead to scan (default: 14).' },
      max_results: { type: 'number', required: !1, description: 'Max results (default: 20).' },
    },
  },
  {
    name: 'calendar_get_large_meetings',
    description: 'Get upcoming meetings that have at least a minimum number of attendees.',
    category: 'calendar',
    parameters: {
      min_attendees: {
        type: 'number',
        required: !1,
        description: 'Minimum attendee count to include (default: 5).',
      },
      days: { type: 'number', required: !1, description: 'Days ahead to scan (default: 14).' },
      max_results: { type: 'number', required: !1, description: 'Max results (default: 20).' },
    },
  },
  {
    name: 'calendar_reschedule_event',
    description:
      'Move an event to a new start time, automatically preserving its original duration.',
    category: 'calendar',
    parameters: {
      event_id: { type: 'string', required: !0, description: 'ID of the event to reschedule.' },
      new_start_datetime: {
        type: 'string',
        required: !0,
        description: 'New start date/time in ISO 8601 format.',
      },
      calendar_id: { type: 'string', required: !1, description: 'Calendar ID (default: primary).' },
    },
  },
  {
    name: 'calendar_get_agenda_summary',
    description:
      'Get a clean, plain-text agenda summary of events in a date range — suitable for copying into an email or message.',
    category: 'calendar',
    parameters: {
      time_min: {
        type: 'string',
        required: !0,
        description: 'Start of range in ISO 8601 or YYYY-MM-DD format.',
      },
      time_max: {
        type: 'string',
        required: !0,
        description: 'End of range in ISO 8601 or YYYY-MM-DD format.',
      },
      max_results: {
        type: 'number',
        required: !1,
        description: 'Max events to include (default: 50).',
      },
    },
  },
];
