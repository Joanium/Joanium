export const FORMS_TOOLS = [
  // ── Original 4 tools ────────────────────────────────────────────────────────
  {
    name: 'forms_get_form',
    description:
      'Get the full structure of a Google Form — title, description, and all questions with their types and answer options.',
    category: 'forms',
    parameters: {
      form_id: {
        type: 'string',
        required: true,
        description: 'Google Form ID (from the URL, the part after /d/).',
      },
    },
  },
  {
    name: 'forms_list_responses',
    description:
      'List all submitted responses for a Google Form, including answers to each question.',
    category: 'forms',
    parameters: {
      form_id: { type: 'string', required: true, description: 'Google Form ID.' },
      max_results: {
        type: 'number',
        required: false,
        description: 'Max responses to return (default: 50).',
      },
    },
  },
  {
    name: 'forms_get_response',
    description: 'Get a single specific response from a Google Form by its response ID.',
    category: 'forms',
    parameters: {
      form_id: { type: 'string', required: true, description: 'Google Form ID.' },
      response_id: {
        type: 'string',
        required: true,
        description: 'Response ID (from forms_list_responses).',
      },
    },
  },
  {
    name: 'forms_get_summary',
    description:
      'Get a high-level summary of a Google Form — question count, response count, and form metadata.',
    category: 'forms',
    parameters: {
      form_id: { type: 'string', required: true, description: 'Google Form ID.' },
    },
  },

  // ── Response retrieval ───────────────────────────────────────────────────────
  {
    name: 'forms_get_response_count',
    description: 'Get just the total number of submitted responses for a Google Form.',
    category: 'forms',
    parameters: {
      form_id: { type: 'string', required: true, description: 'Google Form ID.' },
    },
  },
  {
    name: 'forms_get_latest_response',
    description: 'Fetch the most recently submitted response for a Google Form.',
    category: 'forms',
    parameters: {
      form_id: { type: 'string', required: true, description: 'Google Form ID.' },
    },
  },
  {
    name: 'forms_get_first_response',
    description: 'Fetch the earliest (first ever) submitted response for a Google Form.',
    category: 'forms',
    parameters: {
      form_id: { type: 'string', required: true, description: 'Google Form ID.' },
    },
  },
  {
    name: 'forms_get_responses_in_range',
    description:
      'Retrieve responses submitted within a specific date/time range. Dates should be ISO 8601 strings (e.g. 2024-01-15T00:00:00Z).',
    category: 'forms',
    parameters: {
      form_id: { type: 'string', required: true, description: 'Google Form ID.' },
      start_date: {
        type: 'string',
        required: true,
        description: 'Start of range (ISO 8601).',
      },
      end_date: {
        type: 'string',
        required: true,
        description: 'End of range (ISO 8601).',
      },
      max_results: {
        type: 'number',
        required: false,
        description: 'Max responses to return (default: 50).',
      },
    },
  },
  {
    name: 'forms_find_responses_by_email',
    description:
      'Find all responses submitted by a specific respondent email address (only works for forms that collect email).',
    category: 'forms',
    parameters: {
      form_id: { type: 'string', required: true, description: 'Google Form ID.' },
      email: {
        type: 'string',
        required: true,
        description: 'Respondent email address to search for.',
      },
    },
  },
  {
    name: 'forms_search_responses',
    description:
      'Search through all responses for ones containing a specific keyword or phrase in any answer.',
    category: 'forms',
    parameters: {
      form_id: { type: 'string', required: true, description: 'Google Form ID.' },
      keyword: {
        type: 'string',
        required: true,
        description: 'Keyword or phrase to search for across all answers.',
      },
      max_results: {
        type: 'number',
        required: false,
        description: 'Max responses to scan (default: 200).',
      },
    },
  },

  // ── Question inspection ──────────────────────────────────────────────────────
  {
    name: 'forms_list_questions',
    description:
      'List only the questions of a Google Form (titles, types, required flag) without fetching responses.',
    category: 'forms',
    parameters: {
      form_id: { type: 'string', required: true, description: 'Google Form ID.' },
    },
  },
  {
    name: 'forms_get_question_by_title',
    description:
      'Look up a specific question in a form by searching its title text. Returns the matching question details and its question ID.',
    category: 'forms',
    parameters: {
      form_id: { type: 'string', required: true, description: 'Google Form ID.' },
      title_query: {
        type: 'string',
        required: true,
        description: 'Partial or full question title to search for (case-insensitive).',
      },
    },
  },

  // ── Analytics ────────────────────────────────────────────────────────────────
  {
    name: 'forms_count_answers_for_question',
    description:
      'For a multiple-choice, checkbox, or dropdown question, count how many respondents selected each option. Returns a frequency breakdown.',
    category: 'forms',
    parameters: {
      form_id: { type: 'string', required: true, description: 'Google Form ID.' },
      question_id: {
        type: 'string',
        required: true,
        description: 'Question ID (from forms_list_questions or forms_get_form).',
      },
      max_results: {
        type: 'number',
        required: false,
        description: 'Max responses to analyze (default: 500).',
      },
    },
  },
  {
    name: 'forms_analyze_scale_question',
    description:
      'Compute statistics (average, median, min, max, distribution) for a linear scale question.',
    category: 'forms',
    parameters: {
      form_id: { type: 'string', required: true, description: 'Google Form ID.' },
      question_id: {
        type: 'string',
        required: true,
        description: 'Question ID of the scale question.',
      },
      max_results: {
        type: 'number',
        required: false,
        description: 'Max responses to analyze (default: 500).',
      },
    },
  },
  {
    name: 'forms_collect_text_answers',
    description:
      'Collect all free-text answers submitted for a specific question — useful for reading open-ended responses at a glance.',
    category: 'forms',
    parameters: {
      form_id: { type: 'string', required: true, description: 'Google Form ID.' },
      question_id: {
        type: 'string',
        required: true,
        description: 'Question ID of the text question.',
      },
      max_results: {
        type: 'number',
        required: false,
        description: 'Max responses to fetch (default: 100).',
      },
    },
  },
  {
    name: 'forms_get_top_answers',
    description:
      'Return the most frequently given answers for any question, ranked by count. Works for choice, text, and scale questions.',
    category: 'forms',
    parameters: {
      form_id: { type: 'string', required: true, description: 'Google Form ID.' },
      question_id: {
        type: 'string',
        required: true,
        description: 'Question ID to analyze.',
      },
      top_n: {
        type: 'number',
        required: false,
        description: 'How many top answers to return (default: 5).',
      },
      max_results: {
        type: 'number',
        required: false,
        description: 'Max responses to scan (default: 500).',
      },
    },
  },
  {
    name: 'forms_get_unanswered_count',
    description:
      'For each question, count how many respondents skipped it (left it blank). Useful for spotting low-engagement questions.',
    category: 'forms',
    parameters: {
      form_id: { type: 'string', required: true, description: 'Google Form ID.' },
      max_results: {
        type: 'number',
        required: false,
        description: 'Max responses to analyze (default: 200).',
      },
    },
  },

  // ── Quiz support ─────────────────────────────────────────────────────────────
  {
    name: 'forms_get_score_summary',
    description:
      'For a quiz form, compute score statistics across all respondents — average score, highest score, lowest score, and a score distribution.',
    category: 'forms',
    parameters: {
      form_id: { type: 'string', required: true, description: 'Google Form ID (must be a quiz).' },
      max_results: {
        type: 'number',
        required: false,
        description: 'Max responses to analyze (default: 200).',
      },
    },
  },
  {
    name: 'forms_get_quiz_leaderboard',
    description: 'For a quiz form, return the top-scoring respondents ranked by their total score.',
    category: 'forms',
    parameters: {
      form_id: { type: 'string', required: true, description: 'Google Form ID (must be a quiz).' },
      top_n: {
        type: 'number',
        required: false,
        description: 'Number of top respondents to show (default: 10).',
      },
      max_results: {
        type: 'number',
        required: false,
        description: 'Max responses to scan (default: 200).',
      },
    },
  },

  // ── Utility ──────────────────────────────────────────────────────────────────
  {
    name: 'forms_get_respondent_list',
    description:
      'List all respondent email addresses and their submission timestamps (only for forms that collect email).',
    category: 'forms',
    parameters: {
      form_id: { type: 'string', required: true, description: 'Google Form ID.' },
      max_results: {
        type: 'number',
        required: false,
        description: 'Max responses to fetch (default: 200).',
      },
    },
  },
  {
    name: 'forms_compare_responses',
    description:
      'Compare two specific responses side-by-side, showing both answers for each question.',
    category: 'forms',
    parameters: {
      form_id: { type: 'string', required: true, description: 'Google Form ID.' },
      response_id_a: {
        type: 'string',
        required: true,
        description: 'First response ID.',
      },
      response_id_b: {
        type: 'string',
        required: true,
        description: 'Second response ID.',
      },
    },
  },
  {
    name: 'forms_export_csv',
    description:
      'Export all responses for a Google Form as a CSV-formatted text block, with one row per respondent and one column per question.',
    category: 'forms',
    parameters: {
      form_id: { type: 'string', required: true, description: 'Google Form ID.' },
      max_results: {
        type: 'number',
        required: false,
        description: 'Max responses to export (default: 200).',
      },
    },
  },
  {
    name: 'forms_get_form_settings',
    description:
      'Retrieve the settings and configuration of a Google Form — quiz mode, email collection, login required, confirmation message, etc.',
    category: 'forms',
    parameters: {
      form_id: { type: 'string', required: true, description: 'Google Form ID.' },
    },
  },
  {
    name: 'forms_get_completion_rate',
    description:
      'Analyse how completely respondents fill in the form — for each question, show what percentage of respondents answered it vs. skipped it.',
    category: 'forms',
    parameters: {
      form_id: { type: 'string', required: true, description: 'Google Form ID.' },
      max_results: {
        type: 'number',
        required: false,
        description: 'Max responses to analyze (default: 200).',
      },
    },
  },
];
