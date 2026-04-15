export const SPOTIFY_TOOLS = [
  // ─── Existing ───────────────────────────────────────────────────────────────
  {
    name: 'spotify_now_playing',
    description:
      "Get what's currently playing on the user's Spotify account — track, artist, album, and progress.",
    category: 'spotify',
    connectorId: 'spotify',
    parameters: {},
  },
  {
    name: 'spotify_top_tracks',
    description:
      "Get the user's top Spotify tracks from the last 4 weeks, ranked by listening time.",
    category: 'spotify',
    connectorId: 'spotify',
    parameters: {},
  },
  {
    name: 'spotify_list_playlists',
    description: "List the user's Spotify playlists with name, track count, and visibility.",
    category: 'spotify',
    connectorId: 'spotify',
    parameters: {},
  },

  // ─── Tool 1 ──────────────────────────────────────────────────────────────────
  {
    name: 'spotify_top_artists',
    description:
      "Get the user's top artists over a given time range (short_term = 4 weeks, medium_term = 6 months, long_term = all time). Returns genres, popularity, and follower counts.",
    category: 'spotify',
    connectorId: 'spotify',
    parameters: {
      limit: { type: 'number', description: 'Number of artists to return (1–50). Default: 10.' },
      timeRange: {
        type: 'string',
        description:
          'Time range: short_term (4 weeks), medium_term (6 months), or long_term (all time). Default: short_term.',
      },
    },
  },

  // ─── Tool 2 ──────────────────────────────────────────────────────────────────
  {
    name: 'spotify_recently_played',
    description:
      "Get the user's recently played tracks on Spotify, ordered newest-first. Includes track name, artist, album, and when it was played.",
    category: 'spotify',
    connectorId: 'spotify',
    parameters: {
      limit: { type: 'number', description: 'Number of tracks to return (1–50). Default: 20.' },
    },
  },

  // ─── Tool 3 ──────────────────────────────────────────────────────────────────
  {
    name: 'spotify_saved_tracks',
    description:
      'Get tracks the user has liked/saved in their Spotify library. Returns track name, artist, album, and date added.',
    category: 'spotify',
    connectorId: 'spotify',
    parameters: {
      limit: { type: 'number', description: 'Number of tracks to return (1–50). Default: 20.' },
      offset: { type: 'number', description: 'Pagination offset. Default: 0.' },
    },
  },

  // ─── Tool 4 ──────────────────────────────────────────────────────────────────
  {
    name: 'spotify_saved_albums',
    description:
      'Get albums the user has saved in their Spotify library. Returns album name, artist, release date, and track count.',
    category: 'spotify',
    connectorId: 'spotify',
    parameters: {
      limit: { type: 'number', description: 'Number of albums to return (1–50). Default: 20.' },
      offset: { type: 'number', description: 'Pagination offset. Default: 0.' },
    },
  },

  // ─── Tool 5 ──────────────────────────────────────────────────────────────────
  {
    name: 'spotify_followed_artists',
    description:
      'Get artists the user follows on Spotify. Returns name, genres, popularity, and follower counts.',
    category: 'spotify',
    connectorId: 'spotify',
    parameters: {
      limit: { type: 'number', description: 'Number of artists to return (1–50). Default: 20.' },
    },
  },

  // ─── Tool 6 ──────────────────────────────────────────────────────────────────
  {
    name: 'spotify_playlist_tracks',
    description:
      'Get the full track listing of a specific Spotify playlist by its ID. Returns track names, artists, albums, and who added each track.',
    category: 'spotify',
    connectorId: 'spotify',
    parameters: {
      playlistId: {
        type: 'string',
        description: 'The Spotify playlist ID (e.g. from spotify_list_playlists).',
        required: true,
      },
      limit: { type: 'number', description: 'Tracks to return (1–100). Default: 50.' },
    },
  },

  // ─── Tool 7 ──────────────────────────────────────────────────────────────────
  {
    name: 'spotify_search',
    description:
      'Search Spotify for tracks, artists, albums, and/or playlists by keyword. Returns up to 5 results per type.',
    category: 'spotify',
    connectorId: 'spotify',
    parameters: {
      query: { type: 'string', description: 'Search query string.', required: true },
      types: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Result types to include: track, artist, album, playlist. Defaults to all four.',
      },
      limit: { type: 'number', description: 'Max results per type (1–50). Default: 5.' },
    },
  },

  // ─── Tool 8 ──────────────────────────────────────────────────────────────────
  {
    name: 'spotify_get_artist',
    description:
      'Get full details about a specific Spotify artist by their ID — name, genres, popularity, and follower count.',
    category: 'spotify',
    connectorId: 'spotify',
    parameters: {
      artistId: {
        type: 'string',
        description: 'The Spotify artist ID.',
        required: true,
      },
    },
  },

  // ─── Tool 9 ──────────────────────────────────────────────────────────────────
  {
    name: 'spotify_get_album',
    description:
      'Get full details about a specific Spotify album by its ID — artist, release date, label, popularity, and full track listing.',
    category: 'spotify',
    connectorId: 'spotify',
    parameters: {
      albumId: {
        type: 'string',
        description: 'The Spotify album ID.',
        required: true,
      },
    },
  },

  // ─── Tool 10 ─────────────────────────────────────────────────────────────────
  {
    name: 'spotify_get_track',
    description:
      "Get full details about a specific Spotify track by its ID — artist, album, duration, popularity, and whether it's explicit.",
    category: 'spotify',
    connectorId: 'spotify',
    parameters: {
      trackId: {
        type: 'string',
        description: 'The Spotify track ID.',
        required: true,
      },
    },
  },

  // ─── Tool 11 ─────────────────────────────────────────────────────────────────
  {
    name: 'spotify_recommendations',
    description:
      'Get personalised track recommendations from Spotify based on seed tracks, seed artists, or seed genres. Returns up to 10 suggested tracks with preview URLs.',
    category: 'spotify',
    connectorId: 'spotify',
    parameters: {
      seedTracks: {
        type: 'array',
        items: { type: 'string' },
        description: 'Up to 5 Spotify track IDs to seed recommendations.',
      },
      seedArtists: {
        type: 'array',
        items: { type: 'string' },
        description: 'Up to 5 Spotify artist IDs to seed recommendations.',
      },
      seedGenres: {
        type: 'array',
        items: { type: 'string' },
        description: 'Up to 5 genre names (from spotify_available_genres) to seed recommendations.',
      },
      limit: { type: 'number', description: 'Tracks to return (1–100). Default: 10.' },
    },
  },

  // ─── Tool 12 ─────────────────────────────────────────────────────────────────
  {
    name: 'spotify_new_releases',
    description:
      "Get the latest album and single releases on Spotify. Useful for discovering what's new in music.",
    category: 'spotify',
    connectorId: 'spotify',
    parameters: {
      limit: { type: 'number', description: 'Number of releases to return (1–50). Default: 10.' },
    },
  },

  // ─── Tool 13 ─────────────────────────────────────────────────────────────────
  {
    name: 'spotify_featured_playlists',
    description:
      "Get Spotify's current featured playlists — the playlists Spotify is promoting on the home screen right now.",
    category: 'spotify',
    connectorId: 'spotify',
    parameters: {
      limit: { type: 'number', description: 'Number of playlists to return (1–50). Default: 10.' },
    },
  },

  // ─── Tool 14 ─────────────────────────────────────────────────────────────────
  {
    name: 'spotify_browse_categories',
    description:
      'Get the list of Spotify browse categories (e.g. Pop, Hip-Hop, Workout, Chill). Returns category IDs that can be used with spotify_category_playlists.',
    category: 'spotify',
    connectorId: 'spotify',
    parameters: {
      limit: { type: 'number', description: 'Number of categories to return (1–50). Default: 20.' },
    },
  },

  // ─── Tool 15 ─────────────────────────────────────────────────────────────────
  {
    name: 'spotify_artist_top_tracks',
    description:
      "Get an artist's top tracks on Spotify. Returns the most popular songs for that artist in the given market.",
    category: 'spotify',
    connectorId: 'spotify',
    parameters: {
      artistId: { type: 'string', description: 'The Spotify artist ID.', required: true },
      market: {
        type: 'string',
        description: 'ISO 3166-1 alpha-2 country code for market (e.g. US, GB). Default: US.',
      },
    },
  },

  // ─── Tool 16 ─────────────────────────────────────────────────────────────────
  {
    name: 'spotify_artist_albums',
    description:
      "Get an artist's discography on Spotify — their albums and singles ordered by release date.",
    category: 'spotify',
    connectorId: 'spotify',
    parameters: {
      artistId: { type: 'string', description: 'The Spotify artist ID.', required: true },
      limit: { type: 'number', description: 'Number of releases to return (1–50). Default: 10.' },
    },
  },

  // ─── Tool 17 ─────────────────────────────────────────────────────────────────
  {
    name: 'spotify_related_artists',
    description:
      'Get artists related to a given Spotify artist — useful for music discovery and finding similar acts.',
    category: 'spotify',
    connectorId: 'spotify',
    parameters: {
      artistId: { type: 'string', description: 'The Spotify artist ID.', required: true },
    },
  },

  // ─── Tool 18 ─────────────────────────────────────────────────────────────────
  {
    name: 'spotify_audio_features',
    description:
      'Get audio features for a specific Spotify track — danceability, energy, tempo, valence (positivity), acousticness, speechiness, and more.',
    category: 'spotify',
    connectorId: 'spotify',
    parameters: {
      trackId: { type: 'string', description: 'The Spotify track ID.', required: true },
    },
  },

  // ─── Tool 19 ─────────────────────────────────────────────────────────────────
  {
    name: 'spotify_playback_state',
    description:
      "Get the user's full Spotify playback state — what's playing, which device, shuffle/repeat status, and volume level.",
    category: 'spotify',
    connectorId: 'spotify',
    parameters: {},
  },

  // ─── Tool 20 ─────────────────────────────────────────────────────────────────
  {
    name: 'spotify_queue',
    description:
      "Get the user's current Spotify playback queue — the currently playing track and up to 20 upcoming tracks.",
    category: 'spotify',
    connectorId: 'spotify',
    parameters: {},
  },

  // ─── Tool 21 ─────────────────────────────────────────────────────────────────
  {
    name: 'spotify_devices',
    description:
      "List all devices currently available on the user's Spotify account — phones, computers, speakers, TVs, etc. Shows active device and volume.",
    category: 'spotify',
    connectorId: 'spotify',
    parameters: {},
  },

  // ─── Tool 22 ─────────────────────────────────────────────────────────────────
  {
    name: 'spotify_album_tracks',
    description:
      'Get the full track listing for a specific Spotify album by its ID. Returns track names, durations, and whether tracks are explicit.',
    category: 'spotify',
    connectorId: 'spotify',
    parameters: {
      albumId: { type: 'string', description: 'The Spotify album ID.', required: true },
      limit: { type: 'number', description: 'Tracks to return (1–50). Default: 50.' },
    },
  },

  // ─── Tool 23 ─────────────────────────────────────────────────────────────────
  {
    name: 'spotify_check_saved_tracks',
    description:
      "Check whether specific Spotify tracks are saved in the user's liked songs library. Pass up to 50 track IDs.",
    category: 'spotify',
    connectorId: 'spotify',
    parameters: {
      trackIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of Spotify track IDs to check (max 50).',
        required: true,
      },
    },
  },

  // ─── Tool 24 ─────────────────────────────────────────────────────────────────
  {
    name: 'spotify_user_profile',
    description:
      'Get the public Spotify profile of any user by their user ID — display name, follower count, and profile image.',
    category: 'spotify',
    connectorId: 'spotify',
    parameters: {
      userId: { type: 'string', description: "The Spotify user's ID.", required: true },
    },
  },

  // ─── Tool 25 ─────────────────────────────────────────────────────────────────
  {
    name: 'spotify_get_episode',
    description:
      'Get details about a specific Spotify podcast episode by its ID — title, show name, description, release date, and duration.',
    category: 'spotify',
    connectorId: 'spotify',
    parameters: {
      episodeId: { type: 'string', description: 'The Spotify episode ID.', required: true },
    },
  },

  // ─── Tool 26 ─────────────────────────────────────────────────────────────────
  {
    name: 'spotify_get_show',
    description:
      'Get details about a specific Spotify podcast/show by its ID — publisher, description, total episode count, and languages.',
    category: 'spotify',
    connectorId: 'spotify',
    parameters: {
      showId: { type: 'string', description: 'The Spotify show/podcast ID.', required: true },
    },
  },

  // ─── Tool 27 ─────────────────────────────────────────────────────────────────
  {
    name: 'spotify_saved_shows',
    description:
      'Get podcasts and shows the user has saved/followed in their Spotify library. Returns show name, publisher, and total episodes.',
    category: 'spotify',
    connectorId: 'spotify',
    parameters: {
      limit: { type: 'number', description: 'Number of shows to return (1–50). Default: 20.' },
    },
  },

  // ─── Tool 28 ─────────────────────────────────────────────────────────────────
  {
    name: 'spotify_available_genres',
    description:
      'Get the full list of genre seeds available for use with spotify_recommendations. Useful for seeding discovery by genre.',
    category: 'spotify',
    connectorId: 'spotify',
    parameters: {},
  },

  // ─── Tool 29 ─────────────────────────────────────────────────────────────────
  {
    name: 'spotify_audio_analysis',
    description:
      'Get a detailed structural audio analysis for a Spotify track — tempo, key, mode, sections, number of bars and beats. More detailed than spotify_audio_features.',
    category: 'spotify',
    connectorId: 'spotify',
    parameters: {
      trackId: { type: 'string', description: 'The Spotify track ID.', required: true },
    },
  },

  // ─── Tool 30 ─────────────────────────────────────────────────────────────────
  {
    name: 'spotify_category_playlists',
    description:
      "Get curated Spotify playlists for a specific browse category (e.g. 'hiphop', 'pop', 'workout'). Use spotify_browse_categories to find valid category IDs first.",
    category: 'spotify',
    connectorId: 'spotify',
    parameters: {
      categoryId: {
        type: 'string',
        description: "The Spotify category ID (from spotify_browse_categories, e.g. 'workout').",
        required: true,
      },
      limit: { type: 'number', description: 'Number of playlists to return (1–50). Default: 10.' },
    },
  },
];
