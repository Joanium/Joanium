export const STACKOVERFLOW_TOOLS = [
  {
    name: 'stackoverflow_search',
    description:
      'Search Stack Overflow for questions matching a keyword, error message, or topic. Returns question titles, scores, answer counts, and links. Use this when a dev needs to find solutions to a problem.',
    category: 'stackoverflow',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description:
          'Search query — can be a keyword, error message, or tech question (e.g. "react useEffect cleanup", "TypeError: cannot read property")',
      },
      count: {
        type: 'number',
        required: !1,
        description: 'Number of results to return (default: 5, max: 10)',
      },
    },
  },
  {
    name: 'stackoverflow_question_answers',
    description:
      'Get the top-voted answers for a specific Stack Overflow question by its question ID. Returns answer scores, accepted status, and full answer text. Use this to retrieve the actual solution to a known question.',
    category: 'stackoverflow',
    parameters: {
      question_id: {
        type: 'string',
        required: !0,
        description:
          'Stack Overflow question ID (the number in the URL, e.g. "927358" from stackoverflow.com/questions/927358)',
      },
      count: {
        type: 'number',
        required: !1,
        description: 'Number of answers to return (default: 3, max: 5)',
      },
    },
  },
  {
    name: 'stackoverflow_questions_by_tag',
    description:
      'Get the highest-voted Stack Overflow questions for a specific tag or technology. Use this to find authoritative Q&As for a given language, framework, or tool (e.g. "typescript", "docker", "postgresql").',
    category: 'stackoverflow',
    parameters: {
      tag: {
        type: 'string',
        required: !0,
        description:
          'Stack Overflow tag name (e.g. "javascript", "python", "react", "docker", "git")',
      },
      count: {
        type: 'number',
        required: !1,
        description: 'Number of questions to return (default: 5, max: 10)',
      },
    },
  },
  {
    name: 'stackoverflow_hot',
    description:
      'Get the currently hot/trending questions on Stack Overflow. Optionally filter by a tag. Useful for seeing what the developer community is actively discussing right now.',
    category: 'stackoverflow',
    parameters: {
      tag: {
        type: 'string',
        required: !1,
        description: 'Optional tag to filter hot questions (e.g. "javascript", "python")',
      },
      count: {
        type: 'number',
        required: !1,
        description: 'Number of questions to return (default: 5, max: 10)',
      },
    },
  },
  {
    name: 'stackoverflow_similar',
    description:
      'Find Stack Overflow questions similar to a given error message or question title. Use this when a dev encounters an unfamiliar error — pass the error text and get related community Q&As.',
    category: 'stackoverflow',
    parameters: {
      title: {
        type: 'string',
        required: !0,
        description:
          'An error message or question title to find similar questions for (e.g. "CORS error fetch request blocked", "cannot find module after npm install")',
      },
      count: {
        type: 'number',
        required: !1,
        description: 'Number of results to return (default: 5, max: 10)',
      },
    },
  },
];
