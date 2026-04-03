export const YOUTUBE_TOOLS = [
  {
    name: 'youtube_get_my_channel',
    description: "Get the authenticated user's own YouTube channel info — name, subscribers, view count, video count.",
    category: 'youtube',
    parameters: {},
  },
  {
    name: 'youtube_search_videos',
    description: 'Search YouTube for videos matching a query.',
    category: 'youtube',
    parameters: {
      query:       { type: 'string', required: true,  description: 'Search query string.' },
      max_results: { type: 'number', required: false, description: 'Max results to return (default: 10, max: 50).' },
      order:       { type: 'string', required: false, description: 'Sort order: relevance (default), date, viewCount, rating.' },
    },
  },
  {
    name: 'youtube_get_video',
    description: 'Get full details for a YouTube video by its ID — title, description, stats, duration.',
    category: 'youtube',
    parameters: {
      video_id: { type: 'string', required: true, description: 'YouTube video ID (e.g. dQw4w9WgXcQ).' },
    },
  },
  {
    name: 'youtube_list_playlists',
    description: "List the authenticated user's YouTube playlists.",
    category: 'youtube',
    parameters: {
      max_results: { type: 'number', required: false, description: 'Max playlists to return (default: 20).' },
    },
  },
  {
    name: 'youtube_get_playlist_items',
    description: 'List videos inside a YouTube playlist by playlist ID.',
    category: 'youtube',
    parameters: {
      playlist_id: { type: 'string', required: true,  description: 'YouTube playlist ID.' },
      max_results: { type: 'number', required: false, description: 'Max items to return (default: 20).' },
    },
  },
  {
    name: 'youtube_list_subscriptions',
    description: "List the channels the authenticated user is subscribed to.",
    category: 'youtube',
    parameters: {
      max_results: { type: 'number', required: false, description: 'Max subscriptions to return (default: 20).' },
    },
  },
  {
    name: 'youtube_get_liked_videos',
    description: "Get videos the authenticated user has liked.",
    category: 'youtube',
    parameters: {
      max_results: { type: 'number', required: false, description: 'Max liked videos to return (default: 20).' },
    },
  },
  {
    name: 'youtube_get_video_comments',
    description: 'Get top-level comments on a YouTube video.',
    category: 'youtube',
    parameters: {
      video_id:    { type: 'string', required: true,  description: 'YouTube video ID.' },
      max_results: { type: 'number', required: false, description: 'Max comments to return (default: 20).' },
    },
  },
  {
    name: 'youtube_rate_video',
    description: 'Like, dislike, or remove rating from a YouTube video.',
    category: 'youtube',
    parameters: {
      video_id: { type: 'string', required: true, description: 'YouTube video ID.' },
      rating:   { type: 'string', required: true, description: 'Rating to apply: like, dislike, or none (to remove).' },
    },
  },
  {
    name: 'youtube_list_my_videos',
    description: "List videos uploaded by the authenticated user's channel.",
    category: 'youtube',
    parameters: {
      max_results: { type: 'number', required: false, description: 'Max videos to return (default: 20).' },
    },
  },
];
