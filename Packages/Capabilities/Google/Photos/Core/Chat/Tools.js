export const PHOTOS_TOOLS = [
  {
    name: 'photos_list_albums',
    description: "List all albums in the user's Google Photos library.",
    category: 'photos',
    parameters: {
      max_results: {
        type: 'number',
        required: !1,
        description: 'Max albums to return (default: 20, max: 50).',
      },
    },
  },
  {
    name: 'photos_get_album',
    description: 'Get details about a specific Google Photos album by its ID.',
    category: 'photos',
    parameters: {
      album_id: {
        type: 'string',
        required: !0,
        description: 'Google Photos album ID (from photos_list_albums).',
      },
    },
  },
  {
    name: 'photos_list_shared_albums',
    description: 'List shared albums visible to the user in Google Photos.',
    category: 'photos',
    parameters: {
      max_results: {
        type: 'number',
        required: !1,
        description: 'Max shared albums to return (default: 20).',
      },
    },
  },
  {
    name: 'photos_list_media',
    description:
      "List recent media items (photos and videos) from the user's Google Photos library.",
    category: 'photos',
    parameters: {
      max_results: {
        type: 'number',
        required: !1,
        description: 'Max media items to return (default: 20, max: 100).',
      },
    },
  },
  {
    name: 'photos_get_media_item',
    description: 'Get full details for a specific photo or video by its media item ID.',
    category: 'photos',
    parameters: {
      media_item_id: { type: 'string', required: !0, description: 'Google Photos media item ID.' },
    },
  },
  {
    name: 'photos_get_album_media',
    description: 'List all photos and videos inside a specific Google Photos album.',
    category: 'photos',
    parameters: {
      album_id: { type: 'string', required: !0, description: 'Album ID to list media from.' },
      max_results: {
        type: 'number',
        required: !1,
        description: 'Max items to return (default: 20).',
      },
    },
  },
  {
    name: 'photos_search_by_date',
    description: 'Search Google Photos for media items within a specific date range.',
    category: 'photos',
    parameters: {
      start_date: { type: 'string', required: !0, description: 'Start date in YYYY-MM-DD format.' },
      end_date: { type: 'string', required: !0, description: 'End date in YYYY-MM-DD format.' },
      max_results: { type: 'number', required: !1, description: 'Max results (default: 20).' },
    },
  },
  {
    name: 'photos_search_by_category',
    description:
      'Search Google Photos by content category (e.g. PEOPLE, FOOD, TRAVEL, SELFIES, PETS).',
    category: 'photos',
    parameters: {
      categories: {
        type: 'string',
        required: !0,
        description:
          'Comma-separated content categories. Options: ANIMALS, ARTS, BIRTHDAYS, CITYSCAPES, CRAFTS, DOCUMENTS, FASHION, FLOWERS, FOOD, GARDENS, HOLIDAYS, HOUSES, LANDMARKS, LANDSCAPES, NIGHT, PEOPLE, PERFORMANCES, PETS, RECEIPTS, SCREENSHOTS, SELFIES, SPORT, TRAVEL, UTILITY, WEDDINGS, WHITEBOARDS.',
      },
      max_results: { type: 'number', required: !1, description: 'Max results (default: 20).' },
    },
  },
];
