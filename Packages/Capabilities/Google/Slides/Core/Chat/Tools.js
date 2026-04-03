export const SLIDES_TOOLS = [
  {
    name: 'slides_get_info',
    description:
      'Get metadata about a Google Slides presentation — title, slide count, dimensions, and a direct edit link.',
    category: 'slides',
    parameters: {
      presentation_id: {
        type: 'string',
        required: true,
        description: 'Google Slides presentation ID (from the URL).',
      },
    },
  },
  {
    name: 'slides_read',
    description:
      'Read all text content from every slide in a Google Slides presentation, slide by slide.',
    category: 'slides',
    parameters: {
      presentation_id: {
        type: 'string',
        required: true,
        description: 'Google Slides presentation ID.',
      },
    },
  },
  {
    name: 'slides_create',
    description: 'Create a new blank Google Slides presentation.',
    category: 'slides',
    parameters: {
      title: { type: 'string', required: true, description: 'Title for the new presentation.' },
    },
  },
  {
    name: 'slides_add_slide',
    description: 'Add a new blank slide to an existing Google Slides presentation.',
    category: 'slides',
    parameters: {
      presentation_id: {
        type: 'string',
        required: true,
        description: 'Google Slides presentation ID.',
      },
      insertion_index: {
        type: 'number',
        required: false,
        description: 'Zero-based index to insert the slide at. Omit to append at the end.',
      },
    },
  },
  {
    name: 'slides_delete_slide',
    description:
      'Delete a slide from a presentation by its object ID. Get object IDs from slides_read.',
    category: 'slides',
    parameters: {
      presentation_id: {
        type: 'string',
        required: true,
        description: 'Google Slides presentation ID.',
      },
      slide_object_id: {
        type: 'string',
        required: true,
        description: 'Object ID of the slide to delete (from slides_read).',
      },
    },
  },
  {
    name: 'slides_duplicate_slide',
    description: 'Duplicate an existing slide within the same presentation.',
    category: 'slides',
    parameters: {
      presentation_id: {
        type: 'string',
        required: true,
        description: 'Google Slides presentation ID.',
      },
      slide_object_id: {
        type: 'string',
        required: true,
        description: 'Object ID of the slide to duplicate.',
      },
    },
  },
  {
    name: 'slides_replace_text',
    description:
      'Find and replace all occurrences of a text string across every slide in a presentation.',
    category: 'slides',
    parameters: {
      presentation_id: {
        type: 'string',
        required: true,
        description: 'Google Slides presentation ID.',
      },
      search_text: {
        type: 'string',
        required: true,
        description: 'The text to search for (case-sensitive).',
      },
      replacement: { type: 'string', required: true, description: 'The text to replace it with.' },
    },
  },
];
