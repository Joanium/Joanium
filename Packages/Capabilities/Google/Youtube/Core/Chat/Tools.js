export const YOUTUBE_TOOLS = [
  {
    name: 'youtube_get_my_channel',
    description:
      "Get the authenticated user's own YouTube channel info — name, subscribers, view count, video count.",
    category: 'youtube',
    parameters: {},
  },
  {
    name: 'youtube_search_videos',
    description: 'Search YouTube for videos matching a query.',
    category: 'youtube',
    parameters: {
      query: { type: 'string', required: !0, description: 'Search query string.' },
      max_results: {
        type: 'number',
        required: !1,
        description: 'Max results to return (default: 10, max: 50).',
      },
      order: {
        type: 'string',
        required: !1,
        description: 'Sort order: relevance (default), date, viewCount, rating.',
      },
    },
  },
  {
    name: 'youtube_get_video',
    description:
      'Get full details for a YouTube video by its ID — title, description, stats, duration.',
    category: 'youtube',
    parameters: {
      video_id: {
        type: 'string',
        required: !0,
        description: 'YouTube video ID (e.g. dQw4w9WgXcQ).',
      },
    },
  },
  {
    name: 'youtube_list_playlists',
    description: "List the authenticated user's YouTube playlists.",
    category: 'youtube',
    parameters: {
      max_results: {
        type: 'number',
        required: !1,
        description: 'Max playlists to return (default: 20).',
      },
    },
  },
  {
    name: 'youtube_get_playlist_items',
    description: 'List videos inside a YouTube playlist by playlist ID.',
    category: 'youtube',
    parameters: {
      playlist_id: { type: 'string', required: !0, description: 'YouTube playlist ID.' },
      max_results: {
        type: 'number',
        required: !1,
        description: 'Max items to return (default: 20).',
      },
    },
  },
  {
    name: 'youtube_list_subscriptions',
    description: 'List the channels the authenticated user is subscribed to.',
    category: 'youtube',
    parameters: {
      max_results: {
        type: 'number',
        required: !1,
        description: 'Max subscriptions to return (default: 20).',
      },
    },
  },
  {
    name: 'youtube_get_liked_videos',
    description: 'Get videos the authenticated user has liked.',
    category: 'youtube',
    parameters: {
      max_results: {
        type: 'number',
        required: !1,
        description: 'Max liked videos to return (default: 20).',
      },
    },
  },
  {
    name: 'youtube_get_video_comments',
    description: 'Get top-level comments on a YouTube video.',
    category: 'youtube',
    parameters: {
      video_id: { type: 'string', required: !0, description: 'YouTube video ID.' },
      max_results: {
        type: 'number',
        required: !1,
        description: 'Max comments to return (default: 20).',
      },
    },
  },
  {
    name: 'youtube_rate_video',
    description: 'Like, dislike, or remove rating from a YouTube video.',
    category: 'youtube',
    parameters: {
      video_id: { type: 'string', required: !0, description: 'YouTube video ID.' },
      rating: {
        type: 'string',
        required: !0,
        description: 'Rating to apply: like, dislike, or none (to remove).',
      },
    },
  },
  {
    name: 'youtube_list_my_videos',
    description: "List videos uploaded by the authenticated user's channel.",
    category: 'youtube',
    parameters: {
      max_results: {
        type: 'number',
        required: !1,
        description: 'Max videos to return (default: 20).',
      },
    },
  },
  {
    name: 'youtube_get_channel_by_id',
    description: 'Get details for any YouTube channel by its channel ID.',
    category: 'youtube',
    parameters: {
      channel_id: { type: 'string', required: !0, description: 'YouTube channel ID.' },
    },
  },
  {
    name: 'youtube_get_channel_videos',
    description: 'List recent videos uploaded by a specific channel.',
    category: 'youtube',
    parameters: {
      channel_id: { type: 'string', required: !0, description: 'YouTube channel ID.' },
      max_results: {
        type: 'number',
        required: !1,
        description: 'Max videos to return (default: 20).',
      },
    },
  },
  {
    name: 'youtube_create_playlist',
    description: "Create a new YouTube playlist on the authenticated user's channel.",
    category: 'youtube',
    parameters: {
      title: { type: 'string', required: !0, description: 'Playlist title.' },
      description: { type: 'string', required: !1, description: 'Playlist description.' },
      privacy_status: {
        type: 'string',
        required: !1,
        description: 'Privacy: public, unlisted, or private (default).',
      },
    },
  },
  {
    name: 'youtube_update_playlist',
    description: 'Update the title, description, or privacy of an existing playlist.',
    category: 'youtube',
    parameters: {
      playlist_id: { type: 'string', required: !0, description: 'Playlist ID to update.' },
      title: { type: 'string', required: !1, description: 'New title.' },
      description: { type: 'string', required: !1, description: 'New description.' },
      privacy_status: {
        type: 'string',
        required: !1,
        description: 'New privacy: public, unlisted, or private.',
      },
    },
  },
  {
    name: 'youtube_delete_playlist',
    description: 'Delete a playlist by its ID.',
    category: 'youtube',
    parameters: {
      playlist_id: { type: 'string', required: !0, description: 'Playlist ID to delete.' },
    },
  },
  {
    name: 'youtube_add_video_to_playlist',
    description: 'Add a video to a playlist.',
    category: 'youtube',
    parameters: {
      playlist_id: { type: 'string', required: !0, description: 'Target playlist ID.' },
      video_id: { type: 'string', required: !0, description: 'Video ID to add.' },
    },
  },
  {
    name: 'youtube_remove_playlist_item',
    description: 'Remove a video from a playlist using its playlist item ID (not the video ID).',
    category: 'youtube',
    parameters: {
      playlist_item_id: {
        type: 'string',
        required: !0,
        description: 'Playlist item ID (from get_playlist_items).',
      },
    },
  },
  {
    name: 'youtube_subscribe_to_channel',
    description: 'Subscribe the authenticated user to a YouTube channel.',
    category: 'youtube',
    parameters: {
      channel_id: { type: 'string', required: !0, description: 'Channel ID to subscribe to.' },
    },
  },
  {
    name: 'youtube_unsubscribe_from_channel',
    description: 'Remove a subscription by its subscription ID.',
    category: 'youtube',
    parameters: {
      subscription_id: {
        type: 'string',
        required: !0,
        description: 'Subscription ID (from list_subscriptions or check_subscription).',
      },
    },
  },
  {
    name: 'youtube_check_subscription',
    description: 'Check whether the authenticated user is subscribed to a specific channel.',
    category: 'youtube',
    parameters: {
      channel_id: { type: 'string', required: !0, description: 'Channel ID to check.' },
    },
  },
  {
    name: 'youtube_post_comment',
    description: 'Post a new top-level comment on a YouTube video.',
    category: 'youtube',
    parameters: {
      video_id: { type: 'string', required: !0, description: 'Video ID to comment on.' },
      text: { type: 'string', required: !0, description: 'Comment text.' },
    },
  },
  {
    name: 'youtube_reply_to_comment',
    description: 'Reply to an existing top-level comment thread.',
    category: 'youtube',
    parameters: {
      parent_id: { type: 'string', required: !0, description: 'Comment thread ID to reply to.' },
      text: { type: 'string', required: !0, description: 'Reply text.' },
    },
  },
  {
    name: 'youtube_delete_comment',
    description: 'Delete one of your own comments by comment ID.',
    category: 'youtube',
    parameters: {
      comment_id: { type: 'string', required: !0, description: 'Comment ID to delete.' },
    },
  },
  {
    name: 'youtube_get_comment_replies',
    description: 'Fetch replies under a specific comment thread.',
    category: 'youtube',
    parameters: {
      parent_id: { type: 'string', required: !0, description: 'Comment thread ID.' },
      max_results: {
        type: 'number',
        required: !1,
        description: 'Max replies to return (default: 20).',
      },
    },
  },
  {
    name: 'youtube_get_video_rating',
    description: "Get the authenticated user's own rating (like/dislike/none) on a specific video.",
    category: 'youtube',
    parameters: { video_id: { type: 'string', required: !0, description: 'Video ID to check.' } },
  },
  {
    name: 'youtube_get_trending_videos',
    description: 'Fetch currently trending / most popular videos on YouTube.',
    category: 'youtube',
    parameters: {
      region_code: {
        type: 'string',
        required: !1,
        description: 'ISO 3166-1 alpha-2 country code (default: US).',
      },
      category_id: {
        type: 'string',
        required: !1,
        description: 'Video category ID to filter by (default: 0 = all).',
      },
      max_results: {
        type: 'number',
        required: !1,
        description: 'Max videos to return (default: 20).',
      },
    },
  },
  {
    name: 'youtube_search_channels',
    description: 'Search YouTube for channels matching a query.',
    category: 'youtube',
    parameters: {
      query: { type: 'string', required: !0, description: 'Search query.' },
      max_results: { type: 'number', required: !1, description: 'Max results (default: 10).' },
    },
  },
  {
    name: 'youtube_search_playlists',
    description: 'Search YouTube for playlists matching a query.',
    category: 'youtube',
    parameters: {
      query: { type: 'string', required: !0, description: 'Search query.' },
      max_results: { type: 'number', required: !1, description: 'Max results (default: 10).' },
    },
  },
  {
    name: 'youtube_get_video_categories',
    description: 'List all assignable YouTube video categories for a region.',
    category: 'youtube',
    parameters: {
      region_code: {
        type: 'string',
        required: !1,
        description: 'ISO 3166-1 alpha-2 country code (default: US).',
      },
    },
  },
  {
    name: 'youtube_report_video',
    description: 'Report a video for policy violations.',
    category: 'youtube',
    parameters: {
      video_id: { type: 'string', required: !0, description: 'Video ID to report.' },
      reason_id: {
        type: 'string',
        required: !0,
        description: 'Abuse report reason ID (from youtube_get_video_abuse_report_reasons).',
      },
      secondary_reason_id: {
        type: 'string',
        required: !1,
        description: 'Optional secondary reason ID.',
      },
      comments: {
        type: 'string',
        required: !1,
        description: 'Optional additional comments for the report.',
      },
    },
  },
  {
    name: 'youtube_get_disliked_videos',
    description: 'Get videos the authenticated user has disliked.',
    category: 'youtube',
    parameters: {
      max_results: {
        type: 'number',
        required: !1,
        description: 'Max disliked videos to return (default: 20).',
      },
    },
  },
  {
    name: 'youtube_update_comment',
    description: 'Edit / update the text of one of your own existing comments.',
    category: 'youtube',
    parameters: {
      comment_id: { type: 'string', required: !0, description: 'ID of the comment to edit.' },
      text: { type: 'string', required: !0, description: 'New text for the comment.' },
    },
  },
  {
    name: 'youtube_get_my_activities',
    description:
      "Get the authenticated user's own YouTube activity feed — uploads, likes, subscriptions, etc.",
    category: 'youtube',
    parameters: {
      max_results: {
        type: 'number',
        required: !1,
        description: 'Max activities to return (default: 20).',
      },
    },
  },
  {
    name: 'youtube_get_channel_activities',
    description: "Get a specific channel's public activity feed.",
    category: 'youtube',
    parameters: {
      channel_id: { type: 'string', required: !0, description: 'YouTube channel ID.' },
      max_results: {
        type: 'number',
        required: !1,
        description: 'Max activities to return (default: 20).',
      },
    },
  },
  {
    name: 'youtube_get_channel_playlists',
    description: 'List all public playlists belonging to any channel by its channel ID.',
    category: 'youtube',
    parameters: {
      channel_id: { type: 'string', required: !0, description: 'YouTube channel ID.' },
      max_results: {
        type: 'number',
        required: !1,
        description: 'Max playlists to return (default: 20).',
      },
    },
  },
  {
    name: 'youtube_get_video_captions',
    description:
      'List available caption/subtitle tracks for a YouTube video (language codes, auto-generated flag, etc.).',
    category: 'youtube',
    parameters: { video_id: { type: 'string', required: !0, description: 'YouTube video ID.' } },
  },
  {
    name: 'youtube_search_live_videos',
    description: 'Search for videos that are currently live-streaming on YouTube.',
    category: 'youtube',
    parameters: {
      query: { type: 'string', required: !0, description: 'Search query for live streams.' },
      max_results: {
        type: 'number',
        required: !1,
        description: 'Max results to return (default: 10).',
      },
    },
  },
  {
    name: 'youtube_get_video_abuse_report_reasons',
    description:
      'Fetch all valid abuse-report reason IDs and their labels. Use these IDs when calling youtube_report_video.',
    category: 'youtube',
    parameters: {},
  },
  {
    name: 'youtube_get_i18n_languages',
    description: 'Get the list of all languages supported by the YouTube website.',
    category: 'youtube',
    parameters: {},
  },
  {
    name: 'youtube_get_i18n_regions',
    description: 'Get the list of all geographic regions/countries supported by YouTube.',
    category: 'youtube',
    parameters: {},
  },
  {
    name: 'youtube_get_videos_batch',
    description:
      'Fetch full details (snippet, statistics, contentDetails) for multiple video IDs in one call. More efficient than calling youtube_get_video one at a time.',
    category: 'youtube',
    parameters: {
      video_ids: {
        type: 'array',
        required: !0,
        description: 'Array of YouTube video IDs (up to 50 per call).',
      },
    },
  },
  {
    name: 'youtube_get_channel_sections',
    description:
      "Get the featured sections on a YouTube channel's homepage (e.g. Featured, Popular Uploads, Playlists).",
    category: 'youtube',
    parameters: {
      channel_id: { type: 'string', required: !0, description: 'YouTube channel ID.' },
    },
  },
  {
    name: 'youtube_get_comment_by_id',
    description: 'Fetch a single comment or reply by its comment ID.',
    category: 'youtube',
    parameters: {
      comment_id: { type: 'string', required: !0, description: 'Comment ID to look up.' },
    },
  },
  {
    name: 'youtube_get_channel_branding',
    description:
      "Get a channel's branding settings including banner image URL, profile color, keywords, and country.",
    category: 'youtube',
    parameters: {
      channel_id: { type: 'string', required: !0, description: 'YouTube channel ID.' },
    },
  },
  {
    name: 'youtube_get_playlist_by_id',
    description:
      'Get full details for a single playlist by its ID — title, description, item count, privacy status.',
    category: 'youtube',
    parameters: {
      playlist_id: { type: 'string', required: !0, description: 'YouTube playlist ID.' },
    },
  },
  {
    name: 'youtube_get_video_tags',
    description: 'Get the full list of tags/keywords attached to a YouTube video.',
    category: 'youtube',
    parameters: { video_id: { type: 'string', required: !0, description: 'YouTube video ID.' } },
  },
  {
    name: 'youtube_get_comment_threads_by_channel',
    description: "Get all recent comment threads across all of a channel's videos at once.",
    category: 'youtube',
    parameters: {
      channel_id: { type: 'string', required: !0, description: 'YouTube channel ID.' },
      max_results: {
        type: 'number',
        required: !1,
        description: 'Max comment threads to return (default: 20, max: 100).',
      },
    },
  },
  {
    name: 'youtube_search_videos_advanced',
    description:
      'Advanced video search with extra filters: duration (short/medium/long), definition (hd/sd), published date range, region, and language.',
    category: 'youtube',
    parameters: {
      query: { type: 'string', required: !0, description: 'Search query string.' },
      max_results: { type: 'number', required: !1, description: 'Max results (default: 10).' },
      order: {
        type: 'string',
        required: !1,
        description: 'Sort: relevance (default), date, viewCount, rating.',
      },
      video_duration: {
        type: 'string',
        required: !1,
        description:
          'Duration filter: any (default), short (<4 min), medium (4–20 min), long (>20 min).',
      },
      video_definition: {
        type: 'string',
        required: !1,
        description: 'Definition filter: any (default), hd, sd.',
      },
      published_after: {
        type: 'string',
        required: !1,
        description:
          'ISO 8601 datetime — only return videos published after this date (e.g. 2024-01-01T00:00:00Z).',
      },
      published_before: {
        type: 'string',
        required: !1,
        description: 'ISO 8601 datetime — only return videos published before this date.',
      },
      region_code: {
        type: 'string',
        required: !1,
        description: 'ISO 3166-1 alpha-2 region code to bias results.',
      },
      relevance_language: {
        type: 'string',
        required: !1,
        description: 'ISO 639-1 language code to bias results (e.g. en, hi, ta).',
      },
    },
  },
  {
    name: 'youtube_get_video_statistics',
    description:
      'Lightweight fetch of just the view count, like count, and comment count for a video — without fetching full snippet or content details.',
    category: 'youtube',
    parameters: { video_id: { type: 'string', required: !0, description: 'YouTube video ID.' } },
  },
  {
    name: 'youtube_get_channel_statistics',
    description:
      'Lightweight fetch of just the subscriber count, total view count, and video count for a channel.',
    category: 'youtube',
    parameters: {
      channel_id: { type: 'string', required: !0, description: 'YouTube channel ID.' },
    },
  },
];
