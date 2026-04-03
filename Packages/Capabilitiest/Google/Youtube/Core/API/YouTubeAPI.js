import { getFreshCreds } from '../../../GoogleWorkspace.js';

const YT_BASE = 'https://www.googleapis.com/youtube/v3';

async function ytFetch(creds, url, options = {}) {
  const fresh = await getFreshCreds(creds);
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${fresh.accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`YouTube API error (${res.status}): ${body.error?.message ?? JSON.stringify(body)}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export function parseDuration(iso = '') {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return iso;
  const h = match[1] ? `${match[1]}h ` : '';
  const m = match[2] ? `${match[2]}m ` : '';
  const s = match[3] ? `${match[3]}s` : '';
  return `${h}${m}${s}`.trim() || '0s';
}

export function formatCount(n) {
  const num = Number(n ?? 0);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
}

export async function getMyChannel(creds) {
  const data = await ytFetch(creds, `${YT_BASE}/channels?part=snippet,statistics,brandingSettings&mine=true`);
  return data.items?.[0] ?? null;
}

export async function searchVideos(creds, query, { maxResults = 10, order = 'relevance', type = 'video' } = {}) {
  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type,
    maxResults: String(Math.min(maxResults, 50)),
    order,
  });
  const data = await ytFetch(creds, `${YT_BASE}/search?${params}`);
  return data.items ?? [];
}

export async function getVideoDetails(creds, videoId) {
  const data = await ytFetch(creds, `${YT_BASE}/videos?part=snippet,statistics,contentDetails&id=${videoId}`);
  return data.items?.[0] ?? null;
}

export async function getMultipleVideos(creds, videoIds = []) {
  if (!videoIds.length) return [];
  const data = await ytFetch(creds, `${YT_BASE}/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(',')}`);
  return data.items ?? [];
}

export async function listMyPlaylists(creds, maxResults = 20) {
  const params = new URLSearchParams({ part: 'snippet,contentDetails', mine: 'true', maxResults: String(Math.min(maxResults, 50)) });
  const data = await ytFetch(creds, `${YT_BASE}/playlists?${params}`);
  return data.items ?? [];
}

export async function getPlaylistItems(creds, playlistId, maxResults = 20) {
  const params = new URLSearchParams({
    part: 'snippet,contentDetails',
    playlistId,
    maxResults: String(Math.min(maxResults, 50)),
  });
  const data = await ytFetch(creds, `${YT_BASE}/playlistItems?${params}`);
  return data.items ?? [];
}

export async function listSubscriptions(creds, maxResults = 20) {
  const params = new URLSearchParams({
    part: 'snippet',
    mine: 'true',
    order: 'alphabetical',
    maxResults: String(Math.min(maxResults, 50)),
  });
  const data = await ytFetch(creds, `${YT_BASE}/subscriptions?${params}`);
  return data.items ?? [];
}

export async function getLikedVideos(creds, maxResults = 20) {
  const params = new URLSearchParams({
    part: 'snippet,statistics,contentDetails',
    myRating: 'like',
    maxResults: String(Math.min(maxResults, 50)),
  });
  const data = await ytFetch(creds, `${YT_BASE}/videos?${params}`);
  return data.items ?? [];
}

export async function getVideoComments(creds, videoId, maxResults = 20) {
  const params = new URLSearchParams({
    part: 'snippet',
    videoId,
    maxResults: String(Math.min(maxResults, 100)),
    order: 'relevance',
  });
  const data = await ytFetch(creds, `${YT_BASE}/commentThreads?${params}`);
  return data.items ?? [];
}

export async function rateVideo(creds, videoId, rating) {
  const validRatings = ['like', 'dislike', 'none'];
  if (!validRatings.includes(rating)) throw new Error(`Invalid rating. Must be one of: ${validRatings.join(', ')}`);
  await ytFetch(creds, `${YT_BASE}/videos/rate?id=${videoId}&rating=${rating}`, { method: 'POST' });
  return true;
}

export async function listMyVideos(creds, maxResults = 20) {
  const params = new URLSearchParams({
    part: 'snippet',
    forMine: 'true',
    type: 'video',
    maxResults: String(Math.min(maxResults, 50)),
  });
  const data = await ytFetch(creds, `${YT_BASE}/search?${params}`);
  return data.items ?? [];
}

export async function getChannelById(creds, channelId) {
  const data = await ytFetch(creds, `${YT_BASE}/channels?part=snippet,statistics&id=${channelId}`);
  return data.items?.[0] ?? null;
}
