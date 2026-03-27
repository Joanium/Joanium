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
          'Operation to perform: "day_of_week" (what day is a date), "days_between" (count days between two dates), "add_days" (add N days to a date), "subtract_days", "add_months", "add_years", "countdown" (days until a future date), "date_info" (full info about a date)',
      },
      date: {
        type: 'string',
        required: false,
        description: 'Primary date in YYYY-MM-DD format (e.g. "2025-12-25"). Defaults to today.',
      },
      date2: {
        type: 'string',
        required: false,
        description: 'Second date for "days_between" operation, in YYYY-MM-DD format.',
      },
      amount: {
        type: 'number',
        required: false,
        description: 'Number of days/weeks/months/years to add or subtract.',
      },
    },
  },
];
