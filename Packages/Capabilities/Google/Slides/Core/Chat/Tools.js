export const SLIDES_TOOLS = [
  {
    name: 'slides_get_info',
    description:
      'Get metadata about a Google Slides presentation — title, slide count, dimensions, and a direct edit link.',
    category: 'slides',
    parameters: {
      presentation_id: {
        type: 'string',
        required: !0,
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
        required: !0,
        description: 'Google Slides presentation ID.',
      },
    },
  },
  {
    name: 'slides_create',
    description: 'Create a new blank Google Slides presentation.',
    category: 'slides',
    parameters: {
      title: { type: 'string', required: !0, description: 'Title for the new presentation.' },
    },
  },
  {
    name: 'slides_add_slide',
    description: 'Add a new blank slide to an existing Google Slides presentation.',
    category: 'slides',
    parameters: {
      presentation_id: {
        type: 'string',
        required: !0,
        description: 'Google Slides presentation ID.',
      },
      insertion_index: {
        type: 'number',
        required: !1,
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
        required: !0,
        description: 'Google Slides presentation ID.',
      },
      slide_object_id: {
        type: 'string',
        required: !0,
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
        required: !0,
        description: 'Google Slides presentation ID.',
      },
      slide_object_id: {
        type: 'string',
        required: !0,
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
        required: !0,
        description: 'Google Slides presentation ID.',
      },
      search_text: {
        type: 'string',
        required: !0,
        description: 'The text to search for (case-sensitive).',
      },
      replacement: { type: 'string', required: !0, description: 'The text to replace it with.' },
    },
  },
  {
    name: 'slides_list_slides',
    description:
      'List all slides in a presentation with their object IDs, index positions, and element counts. Use this to get the slide_object_id values needed for other tools.',
    category: 'slides',
    parameters: {
      presentation_id: {
        type: 'string',
        required: !0,
        description: 'Google Slides presentation ID.',
      },
    },
  },
  {
    name: 'slides_get_slide',
    description:
      'Get the full details of a single slide by its object ID, including all page elements and their properties.',
    category: 'slides',
    parameters: {
      presentation_id: {
        type: 'string',
        required: !0,
        description: 'Google Slides presentation ID.',
      },
      slide_object_id: {
        type: 'string',
        required: !0,
        description: 'Object ID of the slide to inspect.',
      },
    },
  },
  {
    name: 'slides_reorder_slides',
    description:
      'Move one or more slides to a new position within the presentation. Provide the slide object IDs to move and the zero-based insertion index they should end up at.',
    category: 'slides',
    parameters: {
      presentation_id: {
        type: 'string',
        required: !0,
        description: 'Google Slides presentation ID.',
      },
      slide_object_ids: {
        type: 'array',
        required: !0,
        description: 'Array of slide object IDs to move, in the order they should appear.',
      },
      insertion_index: {
        type: 'number',
        required: !0,
        description: 'Zero-based index in the presentation where the slides should be placed.',
      },
    },
  },
  {
    name: 'slides_add_text_box',
    description:
      'Insert a text box containing specified text onto a slide at a given position and size. All position and size values are in points.',
    category: 'slides',
    parameters: {
      presentation_id: {
        type: 'string',
        required: !0,
        description: 'Google Slides presentation ID.',
      },
      slide_object_id: {
        type: 'string',
        required: !0,
        description: 'Object ID of the slide to add the text box to.',
      },
      text: {
        type: 'string',
        required: !1,
        description: 'Text content to place inside the text box.',
      },
      x: {
        type: 'number',
        required: !1,
        description: 'Horizontal position in points (default 100).',
      },
      y: {
        type: 'number',
        required: !1,
        description: 'Vertical position in points (default 100).',
      },
      width: { type: 'number', required: !1, description: 'Width in points (default 300).' },
      height: { type: 'number', required: !1, description: 'Height in points (default 60).' },
    },
  },
  {
    name: 'slides_update_text',
    description:
      'Replace all text inside an existing shape or text box with new text. Use slides_get_slide to find the element object ID.',
    category: 'slides',
    parameters: {
      presentation_id: {
        type: 'string',
        required: !0,
        description: 'Google Slides presentation ID.',
      },
      object_id: {
        type: 'string',
        required: !0,
        description: 'Object ID of the shape or text box to update.',
      },
      text: {
        type: 'string',
        required: !0,
        description: 'New text content to replace the existing text with.',
      },
    },
  },
  {
    name: 'slides_add_image',
    description:
      'Insert an image from a public URL onto a slide at a given position and size. All position and size values are in points.',
    category: 'slides',
    parameters: {
      presentation_id: {
        type: 'string',
        required: !0,
        description: 'Google Slides presentation ID.',
      },
      slide_object_id: {
        type: 'string',
        required: !0,
        description: 'Object ID of the slide to insert the image on.',
      },
      image_url: {
        type: 'string',
        required: !0,
        description: 'Publicly accessible URL of the image to embed.',
      },
      x: {
        type: 'number',
        required: !1,
        description: 'Horizontal position in points (default 50).',
      },
      y: { type: 'number', required: !1, description: 'Vertical position in points (default 50).' },
      width: { type: 'number', required: !1, description: 'Width in points (default 300).' },
      height: { type: 'number', required: !1, description: 'Height in points (default 200).' },
    },
  },
  {
    name: 'slides_delete_element',
    description:
      'Delete any page element (shape, image, table, text box, line, video) from a slide by its object ID.',
    category: 'slides',
    parameters: {
      presentation_id: {
        type: 'string',
        required: !0,
        description: 'Google Slides presentation ID.',
      },
      object_id: {
        type: 'string',
        required: !0,
        description: 'Object ID of the page element to delete.',
      },
    },
  },
  {
    name: 'slides_add_shape',
    description:
      'Add a geometric shape to a slide. Supported types include RECTANGLE, ELLIPSE, TRIANGLE, RIGHT_TRIANGLE, PARALLELOGRAM, TRAPEZOID, DIAMOND, PENTAGON, HEXAGON, STAR_5, ARROW_RIGHT, and more.',
    category: 'slides',
    parameters: {
      presentation_id: {
        type: 'string',
        required: !0,
        description: 'Google Slides presentation ID.',
      },
      slide_object_id: {
        type: 'string',
        required: !0,
        description: 'Object ID of the slide to add the shape to.',
      },
      shape_type: {
        type: 'string',
        required: !1,
        description: 'Shape type constant (e.g. RECTANGLE, ELLIPSE, TRIANGLE). Default RECTANGLE.',
      },
      x: {
        type: 'number',
        required: !1,
        description: 'Horizontal position in points (default 100).',
      },
      y: {
        type: 'number',
        required: !1,
        description: 'Vertical position in points (default 100).',
      },
      width: { type: 'number', required: !1, description: 'Width in points (default 200).' },
      height: { type: 'number', required: !1, description: 'Height in points (default 150).' },
    },
  },
  {
    name: 'slides_update_background',
    description: 'Set the background color of a slide using RGB values (each 0–255).',
    category: 'slides',
    parameters: {
      presentation_id: {
        type: 'string',
        required: !0,
        description: 'Google Slides presentation ID.',
      },
      slide_object_id: {
        type: 'string',
        required: !0,
        description: 'Object ID of the slide whose background to update.',
      },
      r: { type: 'number', required: !0, description: 'Red component (0–255).' },
      g: { type: 'number', required: !0, description: 'Green component (0–255).' },
      b: { type: 'number', required: !0, description: 'Blue component (0–255).' },
    },
  },
  {
    name: 'slides_update_text_style',
    description:
      'Update the text style of all text inside a shape — set bold, italic, underline, font size (pt), font family, and/or text color (RGB).',
    category: 'slides',
    parameters: {
      presentation_id: {
        type: 'string',
        required: !0,
        description: 'Google Slides presentation ID.',
      },
      object_id: {
        type: 'string',
        required: !0,
        description: 'Object ID of the shape containing the text.',
      },
      bold: { type: 'boolean', required: !1, description: 'Set text bold.' },
      italic: { type: 'boolean', required: !1, description: 'Set text italic.' },
      underline: { type: 'boolean', required: !1, description: 'Set text underline.' },
      font_size: { type: 'number', required: !1, description: 'Font size in points.' },
      font_family: {
        type: 'string',
        required: !1,
        description: 'Font family name (e.g. "Arial", "Roboto").',
      },
      r: { type: 'number', required: !1, description: 'Text color red component (0–255).' },
      g: { type: 'number', required: !1, description: 'Text color green component (0–255).' },
      b: { type: 'number', required: !1, description: 'Text color blue component (0–255).' },
    },
  },
  {
    name: 'slides_add_table',
    description: 'Insert a new table onto a slide with a specified number of rows and columns.',
    category: 'slides',
    parameters: {
      presentation_id: {
        type: 'string',
        required: !0,
        description: 'Google Slides presentation ID.',
      },
      slide_object_id: {
        type: 'string',
        required: !0,
        description: 'Object ID of the slide to add the table to.',
      },
      rows: { type: 'number', required: !1, description: 'Number of rows (default 3).' },
      columns: { type: 'number', required: !1, description: 'Number of columns (default 3).' },
      x: {
        type: 'number',
        required: !1,
        description: 'Horizontal position in points (default 50).',
      },
      y: {
        type: 'number',
        required: !1,
        description: 'Vertical position in points (default 100).',
      },
      width: { type: 'number', required: !1, description: 'Table width in points (default 450).' },
      height: {
        type: 'number',
        required: !1,
        description: 'Table height in points (default 200).',
      },
    },
  },
  {
    name: 'slides_move_element',
    description:
      'Move a page element to a new absolute position on the slide. Position values are in points.',
    category: 'slides',
    parameters: {
      presentation_id: {
        type: 'string',
        required: !0,
        description: 'Google Slides presentation ID.',
      },
      object_id: {
        type: 'string',
        required: !0,
        description: 'Object ID of the page element to move.',
      },
      x: { type: 'number', required: !0, description: 'New horizontal position in points.' },
      y: { type: 'number', required: !0, description: 'New vertical position in points.' },
    },
  },
  {
    name: 'slides_add_speaker_notes',
    description: 'Add or replace the speaker notes on a specific slide.',
    category: 'slides',
    parameters: {
      presentation_id: {
        type: 'string',
        required: !0,
        description: 'Google Slides presentation ID.',
      },
      slide_object_id: {
        type: 'string',
        required: !0,
        description: 'Object ID of the slide to set speaker notes on.',
      },
      notes: {
        type: 'string',
        required: !0,
        description: 'The speaker notes text to set (replaces any existing notes).',
      },
    },
  },
  {
    name: 'slides_update_alignment',
    description:
      'Update the paragraph alignment of all text inside a shape. Options: START, CENTER, END, JUSTIFIED.',
    category: 'slides',
    parameters: {
      presentation_id: {
        type: 'string',
        required: !0,
        description: 'Google Slides presentation ID.',
      },
      object_id: {
        type: 'string',
        required: !0,
        description: 'Object ID of the shape containing the text.',
      },
      alignment: {
        type: 'string',
        required: !0,
        description: 'Paragraph alignment: START, CENTER, END, or JUSTIFIED.',
      },
    },
  },
  {
    name: 'slides_update_shape_fill',
    description:
      'Set the fill (background) color of a shape using RGB values (each 0–255). Optionally set opacity.',
    category: 'slides',
    parameters: {
      presentation_id: {
        type: 'string',
        required: !0,
        description: 'Google Slides presentation ID.',
      },
      object_id: { type: 'string', required: !0, description: 'Object ID of the shape to fill.' },
      r: { type: 'number', required: !0, description: 'Red component (0–255).' },
      g: { type: 'number', required: !0, description: 'Green component (0–255).' },
      b: { type: 'number', required: !0, description: 'Blue component (0–255).' },
      alpha: { type: 'number', required: !1, description: 'Opacity 0.0–1.0 (default 1.0).' },
    },
  },
  {
    name: 'slides_insert_table_rows',
    description:
      'Insert one or more rows into an existing table, either above or below a specified row index.',
    category: 'slides',
    parameters: {
      presentation_id: {
        type: 'string',
        required: !0,
        description: 'Google Slides presentation ID.',
      },
      table_object_id: { type: 'string', required: !0, description: 'Object ID of the table.' },
      row_index: {
        type: 'number',
        required: !0,
        description: 'Zero-based index of the reference row.',
      },
      insert_below: {
        type: 'boolean',
        required: !1,
        description:
          'Insert rows below the reference row (default true). Set false to insert above.',
      },
      count: { type: 'number', required: !1, description: 'Number of rows to insert (default 1).' },
    },
  },
  {
    name: 'slides_delete_table_row',
    description: 'Delete a row from a table by its zero-based row index.',
    category: 'slides',
    parameters: {
      presentation_id: {
        type: 'string',
        required: !0,
        description: 'Google Slides presentation ID.',
      },
      table_object_id: { type: 'string', required: !0, description: 'Object ID of the table.' },
      row_index: {
        type: 'number',
        required: !0,
        description: 'Zero-based index of the row to delete.',
      },
    },
  },
  {
    name: 'slides_update_table_cell',
    description:
      'Set the text content of a specific cell in a table, identified by its zero-based row and column indices.',
    category: 'slides',
    parameters: {
      presentation_id: {
        type: 'string',
        required: !0,
        description: 'Google Slides presentation ID.',
      },
      table_object_id: { type: 'string', required: !0, description: 'Object ID of the table.' },
      row_index: { type: 'number', required: !0, description: 'Zero-based row index of the cell.' },
      column_index: {
        type: 'number',
        required: !0,
        description: 'Zero-based column index of the cell.',
      },
      text: {
        type: 'string',
        required: !0,
        description: 'Text to place in the cell (replaces existing content).',
      },
    },
  },
  {
    name: 'slides_add_line',
    description:
      'Draw a line on a slide. Specify the starting point (x, y) and the line dimensions (width, height) in points. Line category options: STRAIGHT, BENT, CURVED.',
    category: 'slides',
    parameters: {
      presentation_id: {
        type: 'string',
        required: !0,
        description: 'Google Slides presentation ID.',
      },
      slide_object_id: {
        type: 'string',
        required: !0,
        description: 'Object ID of the slide to draw the line on.',
      },
      line_category: {
        type: 'string',
        required: !1,
        description: 'Line style: STRAIGHT (default), BENT, or CURVED.',
      },
      x: { type: 'number', required: !1, description: 'Start X position in points (default 50).' },
      y: { type: 'number', required: !1, description: 'Start Y position in points (default 50).' },
      width: {
        type: 'number',
        required: !1,
        description: 'Horizontal span of the line in points (default 200).',
      },
      height: {
        type: 'number',
        required: !1,
        description: 'Vertical span of the line in points (default 0 for horizontal line).',
      },
    },
  },
  {
    name: 'slides_add_video',
    description:
      'Embed a YouTube video onto a slide. Provide the YouTube video ID (the part after ?v= in the URL).',
    category: 'slides',
    parameters: {
      presentation_id: {
        type: 'string',
        required: !0,
        description: 'Google Slides presentation ID.',
      },
      slide_object_id: {
        type: 'string',
        required: !0,
        description: 'Object ID of the slide to embed the video on.',
      },
      video_id: {
        type: 'string',
        required: !0,
        description: 'YouTube video ID (e.g. "dQw4w9WgXcQ" from youtube.com/watch?v=dQw4w9WgXcQ).',
      },
      x: {
        type: 'number',
        required: !1,
        description: 'Horizontal position in points (default 100).',
      },
      y: {
        type: 'number',
        required: !1,
        description: 'Vertical position in points (default 100).',
      },
      width: { type: 'number', required: !1, description: 'Width in points (default 320).' },
      height: { type: 'number', required: !1, description: 'Height in points (default 180).' },
    },
  },
];
