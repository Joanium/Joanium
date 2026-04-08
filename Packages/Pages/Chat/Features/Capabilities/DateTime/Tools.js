export const DATETIME_TOOLS = [
  {
    name: 'calculate_date',
    description:
      'Perform date and time calculations: find the day of the week for any date, count days between two dates, add or subtract days/weeks/months/years from a date, and get countdowns to future events.',
    category: 'datetime',
    parameters: {
      operation: {
        type: 'string',
        required: true,
        description:
          'Operation to perform: "day_of_week", "days_between" (needs date2), "add_days" (needs amount), "subtract_days", "add_months", "add_years", "countdown", "date_info"',
      },
      date: {
        type: 'string',
        required: false,
        description: 'Primary date in YYYY-MM-DD format. Defaults to today.',
      },
      date2: {
        type: 'string',
        required: false,
        description: 'Second date for "days_between" in YYYY-MM-DD format.',
      },
      amount: {
        type: 'number',
        required: false,
        description: 'Number of days/months/years to add or subtract.',
      },
    },
  },

  {
    name: 'convert_timezone',
    description:
      'Convert a specific time and date from one IANA timezone to another. Shows the equivalent local time in the target timezone.',
    category: 'datetime',
    parameters: {
      time: {
        type: 'string',
        required: true,
        description: 'Time to convert in HH:MM 24-hour format (e.g. "14:30").',
      },
      date: {
        type: 'string',
        required: false,
        description: 'Date in YYYY-MM-DD format. Defaults to today.',
      },
      from_timezone: {
        type: 'string',
        required: true,
        description:
          'Source IANA timezone (e.g. "America/New_York", "Europe/London", "Asia/Tokyo").',
      },
      to_timezone: {
        type: 'string',
        required: true,
        description: 'Target IANA timezone (e.g. "America/Los_Angeles", "Australia/Sydney").',
      },
    },
  },

  {
    name: 'is_weekend',
    description:
      'Check whether a given date falls on a weekend (Saturday or Sunday) or a weekday, and show nearby weekend dates.',
    category: 'datetime',
    parameters: {
      date: {
        type: 'string',
        required: false,
        description: 'Date to check in YYYY-MM-DD format. Defaults to today.',
      },
    },
  },

  {
    name: 'business_days_between',
    description:
      'Count the number of business days (Monday–Friday, excluding weekends) between two dates.',
    category: 'datetime',
    parameters: {
      date: {
        type: 'string',
        required: true,
        description: 'Start date in YYYY-MM-DD format.',
      },
      date2: {
        type: 'string',
        required: true,
        description: 'End date in YYYY-MM-DD format.',
      },
    },
  },

  {
    name: 'add_business_days',
    description:
      'Add or subtract a number of business days (Mon–Fri, skipping weekends) to/from a date.',
    category: 'datetime',
    parameters: {
      date: {
        type: 'string',
        required: false,
        description: 'Start date in YYYY-MM-DD format. Defaults to today.',
      },
      amount: {
        type: 'number',
        required: true,
        description: 'Number of business days to add (positive) or subtract (negative).',
      },
    },
  },

  {
    name: 'next_weekday_occurrence',
    description:
      'Find the next (or previous) occurrence of a specific day of the week from a given date.',
    category: 'datetime',
    parameters: {
      weekday: {
        type: 'string',
        required: true,
        description:
          'Day of the week to find: "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", or "Sunday".',
      },
      date: {
        type: 'string',
        required: false,
        description: 'Reference date in YYYY-MM-DD format. Defaults to today.',
      },
      direction: {
        type: 'string',
        required: false,
        description: '"next" (default) or "previous" — which direction to search.',
      },
    },
  },

  {
    name: 'age_calculator',
    description:
      'Calculate the exact age of a person or thing from a birth/start date, broken down into years, months, and days. Optionally calculate age at a specific target date.',
    category: 'datetime',
    parameters: {
      date: {
        type: 'string',
        required: true,
        description: 'Birth or start date in YYYY-MM-DD format.',
      },
      date2: {
        type: 'string',
        required: false,
        description: 'Target date to calculate age at, in YYYY-MM-DD format. Defaults to today.',
      },
    },
  },

  {
    name: 'days_until_birthday',
    description:
      'Calculate how many days until the next occurrence of a birthday or annual event, and what day of the week it will fall on.',
    category: 'datetime',
    parameters: {
      date: {
        type: 'string',
        required: true,
        description: 'Birthday in YYYY-MM-DD or MM-DD format (e.g. "1990-07-15" or "07-15").',
      },
    },
  },

  {
    name: 'get_season',
    description:
      'Get the astronomical or meteorological season for a given date. Supports both Northern and Southern hemispheres.',
    category: 'datetime',
    parameters: {
      date: {
        type: 'string',
        required: false,
        description: 'Date in YYYY-MM-DD format. Defaults to today.',
      },
      hemisphere: {
        type: 'string',
        required: false,
        description: '"northern" (default) or "southern".',
      },
    },
  },

  {
    name: 'get_month_info',
    description:
      'Get detailed calendar information about a specific month: total days, start/end dates, how many of each weekday it contains, and how many weeks.',
    category: 'datetime',
    parameters: {
      date: {
        type: 'string',
        required: false,
        description:
          'Any date within the target month in YYYY-MM-DD format. Defaults to current month.',
      },
    },
  },

  {
    name: 'get_quarter_info',
    description:
      'Get fiscal/calendar quarter information for a date: which quarter it is, start and end dates, days elapsed, and days remaining in the quarter.',
    category: 'datetime',
    parameters: {
      date: {
        type: 'string',
        required: false,
        description: 'Date in YYYY-MM-DD format. Defaults to today.',
      },
    },
  },

  {
    name: 'lunar_phase',
    description:
      'Get the approximate lunar (moon) phase for any date: New Moon, Waxing Crescent, First Quarter, Waxing Gibbous, Full Moon, Waning Gibbous, Last Quarter, or Waning Crescent.',
    category: 'datetime',
    parameters: {
      date: {
        type: 'string',
        required: false,
        description: 'Date in YYYY-MM-DD format. Defaults to today.',
      },
    },
  },

  {
    name: 'week_bounds',
    description:
      'Get the start and end date of the week that contains a given date. Configurable week start day (Sunday or Monday).',
    category: 'datetime',
    parameters: {
      date: {
        type: 'string',
        required: false,
        description: 'Any date within the week in YYYY-MM-DD format. Defaults to today.',
      },
      week_start: {
        type: 'string',
        required: false,
        description: 'First day of the week: "sunday" (default) or "monday".',
      },
    },
  },

  {
    name: 'month_bounds',
    description:
      'Get the first and last day of the month for a given date, along with total days in that month.',
    category: 'datetime',
    parameters: {
      date: {
        type: 'string',
        required: false,
        description:
          'Any date within the target month in YYYY-MM-DD format. Defaults to current month.',
      },
    },
  },

  {
    name: 'year_progress',
    description:
      'Show how far through the current (or any) year a date is, as a percentage and progress bar, along with days elapsed and remaining.',
    category: 'datetime',
    parameters: {
      date: {
        type: 'string',
        required: false,
        description: 'Date in YYYY-MM-DD format. Defaults to today.',
      },
    },
  },

  {
    name: 'detailed_difference',
    description:
      'Get the precise difference between two dates broken down into years, months, days — plus total weeks, hours, minutes, and seconds.',
    category: 'datetime',
    parameters: {
      date: {
        type: 'string',
        required: true,
        description: 'Start date in YYYY-MM-DD format.',
      },
      date2: {
        type: 'string',
        required: true,
        description: 'End date in YYYY-MM-DD format.',
      },
    },
  },

  {
    name: 'nth_weekday_of_month',
    description:
      'Find the date of the Nth occurrence of a specific weekday in a given month (e.g. "the 3rd Monday of November 2025", or "the last Friday of this month").',
    category: 'datetime',
    parameters: {
      date: {
        type: 'string',
        required: false,
        description:
          'Any date in the target month in YYYY-MM-DD format. Defaults to current month.',
      },
      nth: {
        type: 'number',
        required: true,
        description:
          'Which occurrence: 1 (first), 2 (second), 3 (third), 4 (fourth), 5 (fifth), or -1 (last).',
      },
      weekday: {
        type: 'string',
        required: true,
        description:
          'Day of the week: "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", or "Sunday".',
      },
    },
  },

  {
    name: 'timezone_overlap',
    description:
      'Find overlapping business hours (9am–5pm) between two IANA timezones on a given date. Shows a side-by-side hour comparison and highlights the overlap window.',
    category: 'datetime',
    parameters: {
      timezone1: {
        type: 'string',
        required: true,
        description: 'First IANA timezone (e.g. "America/New_York").',
      },
      timezone2: {
        type: 'string',
        required: true,
        description: 'Second IANA timezone (e.g. "Europe/Berlin").',
      },
      date: {
        type: 'string',
        required: false,
        description: 'Date to calculate for in YYYY-MM-DD format. Defaults to today.',
      },
    },
  },

  {
    name: 'century_decade_info',
    description:
      'Get the century, decade, and millennium for any year or date, along with how many years into the decade/century the date is.',
    category: 'datetime',
    parameters: {
      date: {
        type: 'string',
        required: false,
        description: 'Date in YYYY-MM-DD format. Defaults to today.',
      },
    },
  },

  {
    name: 'unix_converter',
    description:
      'Convert a date to a Unix timestamp (seconds since Jan 1, 1970 UTC), or convert a Unix timestamp back to a human-readable date.',
    category: 'datetime',
    parameters: {
      operation: {
        type: 'string',
        required: true,
        description: '"to_unix" (date → timestamp) or "from_unix" (timestamp → date).',
      },
      date: {
        type: 'string',
        required: false,
        description: 'Date in YYYY-MM-DD format. Required for "to_unix".',
      },
      unix_timestamp: {
        type: 'number',
        required: false,
        description: 'Unix timestamp in seconds. Required for "from_unix".',
      },
    },
  },

  {
    name: 'time_until_datetime',
    description:
      'Get a precise countdown (days, hours, minutes, seconds) until a specific date and time — or how long ago an event was. Supports optional timezone for the target time.',
    category: 'datetime',
    parameters: {
      date: {
        type: 'string',
        required: true,
        description: 'Target date in YYYY-MM-DD format.',
      },
      time: {
        type: 'string',
        required: false,
        description: 'Target time in HH:MM 24-hour format (e.g. "09:00"). Defaults to midnight.',
      },
      timezone: {
        type: 'string',
        required: false,
        description:
          'IANA timezone for the target time (e.g. "America/Chicago"). Defaults to local system time.',
      },
    },
  },
];
