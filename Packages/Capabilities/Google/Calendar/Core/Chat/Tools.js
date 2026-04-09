export const CALENDAR_TOOLS = [
  // ─── Existing tools ────────────────────────────────────────────────────────
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
        required: false,
        description: 'Number of days to look ahead (default: 7).',
      },
      max_results: {
        type: 'number',
        required: false,
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
        required: true,
        description: 'Search term to find events by title, location, or description.',
      },
      max_results: {
        type: 'number',
        required: false,
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
        required: false,
        description: 'Start of the range in ISO 8601 or YYYY-MM-DD format.',
      },
      time_max: {
        type: 'string',
        required: false,
        description: 'End of the range in ISO 8601 or YYYY-MM-DD format.',
      },
      calendar_id: {
        type: 'string',
        required: false,
        description: 'Calendar ID to list from (default: primary).',
      },
      max_results: {
        type: 'number',
        required: false,
        description: 'Max events to return (default: 20).',
      },
    },
  },
  {
    name: 'calendar_create_event',
    description: 'Create a new event in Google Calendar.',
    category: 'calendar',
    parameters: {
      summary: { type: 'string', required: true, description: 'Event title.' },
      start_datetime: {
        type: 'string',
        required: true,
        description: 'Start date/time in ISO 8601 or YYYY-MM-DDTHH:MM format.',
      },
      end_datetime: {
        type: 'string',
        required: false,
        description: 'End date/time. Defaults to 1 hour after start.',
      },
      description: { type: 'string', required: false, description: 'Event description or notes.' },
      location: { type: 'string', required: false, description: 'Physical or virtual location.' },
      attendees: {
        type: 'string',
        required: false,
        description: 'Comma-separated email addresses to invite.',
      },
      all_day: {
        type: 'boolean',
        required: false,
        description: 'Set true for an all-day event (start_datetime should be YYYY-MM-DD).',
      },
      calendar_id: {
        type: 'string',
        required: false,
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
        required: true,
        description: 'The Google Calendar event ID to delete.',
      },
      calendar_id: {
        type: 'string',
        required: false,
        description: 'Calendar ID (default: primary).',
      },
    },
  },

  // ─── New tools ─────────────────────────────────────────────────────────────

  // 1
  {
    name: 'calendar_get_this_week',
    description:
      "Get all of the user's Google Calendar events for the current calendar week (Monday–Sunday).",
    category: 'calendar',
    parameters: {},
  },

  // 2
  {
    name: 'calendar_get_next_week',
    description:
      "Get all of the user's Google Calendar events for next calendar week (Monday–Sunday).",
    category: 'calendar',
    parameters: {},
  },

  // 3
  {
    name: 'calendar_get_this_month',
    description: "Get all of the user's Google Calendar events for the current calendar month.",
    category: 'calendar',
    parameters: {},
  },

  // 4
  {
    name: 'calendar_get_next_event',
    description: "Get the single next upcoming event on the user's primary Google Calendar.",
    category: 'calendar',
    parameters: {},
  },

  // 5
  {
    name: 'calendar_get_events_on_date',
    description:
      "Get all events on a specific date. Accepts 'today', 'tomorrow', 'yesterday', or a YYYY-MM-DD date string.",
    category: 'calendar',
    parameters: {
      date: {
        type: 'string',
        required: true,
        description: "Date to look up. Use 'today', 'tomorrow', 'yesterday', or YYYY-MM-DD.",
      },
    },
  },

  // 6
  {
    name: 'calendar_get_free_slots',
    description:
      'Find free time slots of a minimum length on a specific day, within configurable working hours.',
    category: 'calendar',
    parameters: {
      date: {
        type: 'string',
        required: true,
        description: 'Date to scan for free slots in YYYY-MM-DD format.',
      },
      work_start: {
        type: 'number',
        required: false,
        description: 'Start of working hours as a 24-hour integer (default: 9).',
      },
      work_end: {
        type: 'number',
        required: false,
        description: 'End of working hours as a 24-hour integer (default: 18).',
      },
      min_minutes: {
        type: 'number',
        required: false,
        description: 'Minimum slot length in minutes to include (default: 30).',
      },
    },
  },

  // 7
  {
    name: 'calendar_get_event',
    description: 'Fetch full details of a single Google Calendar event by its ID.',
    category: 'calendar',
    parameters: {
      event_id: { type: 'string', required: true, description: 'The event ID to retrieve.' },
      calendar_id: {
        type: 'string',
        required: false,
        description: 'Calendar ID (default: primary).',
      },
    },
  },

  // 8
  {
    name: 'calendar_update_event',
    description:
      'Update specific fields of an existing Google Calendar event (title, description, location, or time).',
    category: 'calendar',
    parameters: {
      event_id: { type: 'string', required: true, description: 'ID of the event to update.' },
      calendar_id: {
        type: 'string',
        required: false,
        description: 'Calendar ID (default: primary).',
      },
      summary: { type: 'string', required: false, description: 'New event title.' },
      description: { type: 'string', required: false, description: 'New event description.' },
      location: { type: 'string', required: false, description: 'New event location.' },
      start_datetime: {
        type: 'string',
        required: false,
        description: 'New start date/time in ISO 8601 format.',
      },
      end_datetime: {
        type: 'string',
        required: false,
        description: 'New end date/time in ISO 8601 format.',
      },
    },
  },

  // 9
  {
    name: 'calendar_move_event',
    description: 'Move a Google Calendar event from one calendar to another.',
    category: 'calendar',
    parameters: {
      event_id: { type: 'string', required: true, description: 'ID of the event to move.' },
      destination_calendar_id: {
        type: 'string',
        required: true,
        description: 'ID of the target calendar.',
      },
      source_calendar_id: {
        type: 'string',
        required: false,
        description: 'ID of the source calendar (default: primary).',
      },
    },
  },

  // 10
  {
    name: 'calendar_duplicate_event',
    description:
      'Duplicate an existing Google Calendar event, optionally shifting it by a number of days.',
    category: 'calendar',
    parameters: {
      event_id: { type: 'string', required: true, description: 'ID of the event to duplicate.' },
      calendar_id: {
        type: 'string',
        required: false,
        description: 'Calendar ID (default: primary).',
      },
      shift_days: {
        type: 'number',
        required: false,
        description: 'Number of days to shift the duplicate forward (default: 0 = same time).',
      },
    },
  },

  // 11
  {
    name: 'calendar_create_recurring_event',
    description: 'Create a new recurring event in Google Calendar using an RRULE recurrence rule.',
    category: 'calendar',
    parameters: {
      summary: { type: 'string', required: true, description: 'Event title.' },
      start_datetime: {
        type: 'string',
        required: true,
        description: 'Start date/time in ISO 8601 format.',
      },
      rrule: {
        type: 'string',
        required: true,
        description:
          'Recurrence rule string, e.g. "FREQ=WEEKLY;BYDAY=MO,WE,FR" or "FREQ=DAILY;COUNT=10".',
      },
      end_datetime: {
        type: 'string',
        required: false,
        description: 'End date/time for each occurrence (default: 1 hour after start).',
      },
      description: { type: 'string', required: false, description: 'Event description.' },
      location: { type: 'string', required: false, description: 'Event location.' },
      attendees: {
        type: 'string',
        required: false,
        description: 'Comma-separated email addresses to invite.',
      },
      calendar_id: {
        type: 'string',
        required: false,
        description: 'Calendar ID (default: primary).',
      },
    },
  },

  // 12
  {
    name: 'calendar_add_attendees',
    description: 'Add one or more attendees to an existing Google Calendar event.',
    category: 'calendar',
    parameters: {
      event_id: { type: 'string', required: true, description: 'ID of the event to update.' },
      attendees: {
        type: 'string',
        required: true,
        description: 'Comma-separated email addresses to add.',
      },
      calendar_id: {
        type: 'string',
        required: false,
        description: 'Calendar ID (default: primary).',
      },
    },
  },

  // 13
  {
    name: 'calendar_remove_attendees',
    description: 'Remove one or more attendees from an existing Google Calendar event.',
    category: 'calendar',
    parameters: {
      event_id: { type: 'string', required: true, description: 'ID of the event to update.' },
      attendees: {
        type: 'string',
        required: true,
        description: 'Comma-separated email addresses to remove.',
      },
      calendar_id: {
        type: 'string',
        required: false,
        description: 'Calendar ID (default: primary).',
      },
    },
  },

  // 14
  {
    name: 'calendar_count_events',
    description: 'Count the number of events in a given time range on a calendar.',
    category: 'calendar',
    parameters: {
      time_min: {
        type: 'string',
        required: true,
        description: 'Start of the range in ISO 8601 or YYYY-MM-DD format.',
      },
      time_max: {
        type: 'string',
        required: true,
        description: 'End of the range in ISO 8601 or YYYY-MM-DD format.',
      },
      calendar_id: {
        type: 'string',
        required: false,
        description: 'Calendar ID (default: primary).',
      },
    },
  },

  // 15
  {
    name: 'calendar_get_events_in_range',
    description: 'Get events between two specific dates on any calendar.',
    category: 'calendar',
    parameters: {
      start_date: {
        type: 'string',
        required: true,
        description: 'Start date in ISO 8601 or YYYY-MM-DD format.',
      },
      end_date: {
        type: 'string',
        required: true,
        description: 'End date in ISO 8601 or YYYY-MM-DD format.',
      },
      calendar_id: {
        type: 'string',
        required: false,
        description: 'Calendar ID (default: primary).',
      },
      max_results: {
        type: 'number',
        required: false,
        description: 'Max events to return (default: 50).',
      },
    },
  },

  // 16
  {
    name: 'calendar_get_events_by_attendee',
    description:
      "Search for calendar events that include a specific person's email address as an attendee.",
    category: 'calendar',
    parameters: {
      email: {
        type: 'string',
        required: true,
        description: "Attendee's email address to search for.",
      },
      max_results: {
        type: 'number',
        required: false,
        description: 'Max results to return (default: 20).',
      },
    },
  },

  // 17
  {
    name: 'calendar_get_events_by_location',
    description: 'Find calendar events that match a specific location keyword.',
    category: 'calendar',
    parameters: {
      location: {
        type: 'string',
        required: true,
        description:
          'Location keyword to search for (e.g. "Conference Room B", "Zoom", "New York").',
      },
      max_results: {
        type: 'number',
        required: false,
        description: 'Max results to return (default: 20).',
      },
    },
  },

  // 18
  {
    name: 'calendar_get_free_busy',
    description:
      'Query the free/busy status of one or more calendars over a time range using the Google Calendar Freebusy API.',
    category: 'calendar',
    parameters: {
      time_min: {
        type: 'string',
        required: true,
        description: 'Start of the query window in ISO 8601 format.',
      },
      time_max: {
        type: 'string',
        required: true,
        description: 'End of the query window in ISO 8601 format.',
      },
      calendar_ids: {
        type: 'string',
        required: false,
        description: 'Comma-separated calendar IDs to check (default: primary).',
      },
    },
  },

  // 19
  {
    name: 'calendar_clear_day',
    description:
      'Delete all events on a specific day from a calendar. Use with caution — this is irreversible.',
    category: 'calendar',
    parameters: {
      date: { type: 'string', required: true, description: 'Date to clear in YYYY-MM-DD format.' },
      calendar_id: {
        type: 'string',
        required: false,
        description: 'Calendar ID (default: primary).',
      },
    },
  },

  // 20
  {
    name: 'calendar_create_out_of_office',
    description: 'Create an all-day out-of-office block on the calendar for one or more days.',
    category: 'calendar',
    parameters: {
      start_date: {
        type: 'string',
        required: true,
        description: 'First day of the out-of-office period in YYYY-MM-DD format.',
      },
      end_date: {
        type: 'string',
        required: false,
        description:
          'Last day of the out-of-office period in YYYY-MM-DD format (default: same as start_date).',
      },
      reason: {
        type: 'string',
        required: false,
        description: 'Optional reason shown in the event title, e.g. "Vacation" or "Conference".',
      },
      calendar_id: {
        type: 'string',
        required: false,
        description: 'Calendar ID (default: primary).',
      },
    },
  },
];
