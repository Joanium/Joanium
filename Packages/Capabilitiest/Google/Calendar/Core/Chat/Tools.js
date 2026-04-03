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
      days: { type: 'number', required: false, description: 'Number of days to look ahead (default: 7).' },
      max_results: { type: 'number', required: false, description: 'Max events to return (default: 20).' },
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
      query: { type: 'string', required: true, description: 'Search term to find events by title, location, or description.' },
      max_results: { type: 'number', required: false, description: 'Max results to return (default: 20).' },
    },
  },
  {
    name: 'calendar_list_events',
    description: 'List Google Calendar events within a specific date range.',
    category: 'calendar',
    parameters: {
      time_min: { type: 'string', required: false, description: 'Start of the range in ISO 8601 or YYYY-MM-DD format.' },
      time_max: { type: 'string', required: false, description: 'End of the range in ISO 8601 or YYYY-MM-DD format.' },
      calendar_id: { type: 'string', required: false, description: 'Calendar ID to list from (default: primary).' },
      max_results: { type: 'number', required: false, description: 'Max events to return (default: 20).' },
    },
  },
  {
    name: 'calendar_create_event',
    description: 'Create a new event in Google Calendar.',
    category: 'calendar',
    parameters: {
      summary: { type: 'string', required: true, description: 'Event title.' },
      start_datetime: { type: 'string', required: true, description: 'Start date/time in ISO 8601 or YYYY-MM-DDTHH:MM format.' },
      end_datetime: { type: 'string', required: false, description: 'End date/time. Defaults to 1 hour after start.' },
      description: { type: 'string', required: false, description: 'Event description or notes.' },
      location: { type: 'string', required: false, description: 'Physical or virtual location.' },
      attendees: { type: 'string', required: false, description: 'Comma-separated email addresses to invite.' },
      all_day: { type: 'boolean', required: false, description: 'Set true for an all-day event (start_datetime should be YYYY-MM-DD).' },
      calendar_id: { type: 'string', required: false, description: 'Calendar ID to add the event to (default: primary).' },
    },
  },
  {
    name: 'calendar_delete_event',
    description: 'Delete a Google Calendar event by event ID.',
    category: 'calendar',
    parameters: {
      event_id: { type: 'string', required: true, description: 'The Google Calendar event ID to delete.' },
      calendar_id: { type: 'string', required: false, description: 'Calendar ID (default: primary).' },
    },
  },
];
