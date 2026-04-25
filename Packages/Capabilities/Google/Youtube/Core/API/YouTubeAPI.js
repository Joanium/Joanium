import { createGoogleJsonFetch } from '../../../Core/API/GoogleApiFetch.js';

const YT_BASE = 'https://www.googleapis.com/youtube/v3';
const ytFetch = createGoogleJsonFetch('YouTube');
export function parseDuration(iso = '') {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  return match
    ? `${match[1] ? `${match[1]}h ` : ''}${match[2] ? `${match[2]}m ` : ''}${match[3] ? `${match[3]}s` : ''}`.trim() ||
        '0s'
    : iso;
}
export function formatCount(n) {
  const num = Number(n ?? 0);
  return num >= 1e6
    ? `${(num / 1e6).toFixed(1)}M`
    : num >= 1e3
      ? `${(num / 1e3).toFixed(1)}K`
      : String(num);
}
export async function getMyChannel(creds) {
  const data = await ytFetch(
    creds,
    `${YT_BASE}/channels?part=snippet,statistics,brandingSettings&mine=true`,
  );
  return data.items?.[0] ?? null;
}
export async function searchVideos(
  creds,
  query,
  { maxResults: maxResults = 10, order: order = 'relevance', type: type = 'video' } = {},
) {
  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: type,
    maxResults: String(Math.min(maxResults, 50)),
    order: order,
  });
  return (await ytFetch(creds, `${YT_BASE}/search?${params}`)).items ?? [];
}
export async function getVideoDetails(creds, videoId) {
  const data = await ytFetch(
    creds,
    `${YT_BASE}/videos?part=snippet,statistics,contentDetails&id=${videoId}`,
  );
  return data.items?.[0] ?? null;
}
export async function getMultipleVideos(creds, videoIds = []) {
  return videoIds.length
    ? ((
        await ytFetch(
          creds,
          `${YT_BASE}/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(',')}`,
        )
      ).items ?? [])
    : [];
}
export async function listMyPlaylists(creds, maxResults = 20) {
  const params = new URLSearchParams({
    part: 'snippet,contentDetails',
    mine: 'true',
    maxResults: String(Math.min(maxResults, 50)),
  });
  return (await ytFetch(creds, `${YT_BASE}/playlists?${params}`)).items ?? [];
}
export async function getPlaylistItems(creds, playlistId, maxResults = 20) {
  const params = new URLSearchParams({
    part: 'snippet,contentDetails',
    playlistId: playlistId,
    maxResults: String(Math.min(maxResults, 50)),
  });
  return (await ytFetch(creds, `${YT_BASE}/playlistItems?${params}`)).items ?? [];
}
export async function listSubscriptions(creds, maxResults = 20) {
  const params = new URLSearchParams({
    part: 'snippet',
    mine: 'true',
    order: 'alphabetical',
    maxResults: String(Math.min(maxResults, 50)),
  });
  return (await ytFetch(creds, `${YT_BASE}/subscriptions?${params}`)).items ?? [];
}
export async function getLikedVideos(creds, maxResults = 20) {
  const params = new URLSearchParams({
    part: 'snippet,statistics,contentDetails',
    myRating: 'like',
    maxResults: String(Math.min(maxResults, 50)),
  });
  return (await ytFetch(creds, `${YT_BASE}/videos?${params}`)).items ?? [];
}
export async function getVideoComments(creds, videoId, maxResults = 20) {
  const params = new URLSearchParams({
    part: 'snippet',
    videoId: videoId,
    maxResults: String(Math.min(maxResults, 100)),
    order: 'relevance',
  });
  return (await ytFetch(creds, `${YT_BASE}/commentThreads?${params}`)).items ?? [];
}
export async function rateVideo(creds, videoId, rating) {
  const validRatings = ['like', 'dislike', 'none'];
  if (!validRatings.includes(rating))
    throw new Error(`Invalid rating. Must be one of: ${validRatings.join(', ')}`);
  return (
    await ytFetch(creds, `${YT_BASE}/videos/rate?id=${videoId}&rating=${rating}`, {
      method: 'POST',
    }),
    !0
  );
}
export async function listMyVideos(creds, maxResults = 20) {
  const params = new URLSearchParams({
    part: 'snippet',
    forMine: 'true',
    type: 'video',
    maxResults: String(Math.min(maxResults, 50)),
  });
  return (await ytFetch(creds, `${YT_BASE}/search?${params}`)).items ?? [];
}
export async function getChannelById(creds, channelId) {
  const data = await ytFetch(creds, `${YT_BASE}/channels?part=snippet,statistics&id=${channelId}`);
  return data.items?.[0] ?? null;
}
export async function getChannelVideos(creds, channelId, maxResults = 20) {
  const params = new URLSearchParams({
    part: 'snippet',
    channelId: channelId,
    type: 'video',
    maxResults: String(Math.min(maxResults, 50)),
    order: 'date',
  });
  return (await ytFetch(creds, `${YT_BASE}/search?${params}`)).items ?? [];
}
export async function createPlaylist(
  creds,
  { title: title, description: description = '', privacyStatus: privacyStatus = 'private' },
) {
  return ytFetch(creds, `${YT_BASE}/playlists?part=snippet,status`, {
    method: 'POST',
    body: JSON.stringify({
      snippet: { title: title, description: description },
      status: { privacyStatus: privacyStatus },
    }),
  });
}
export async function updatePlaylist(
  creds,
  playlistId,
  { title: title, description: description, privacyStatus: privacyStatus },
) {
  const body = { id: playlistId, snippet: {}, status: {} };
  return (
    void 0 !== title && (body.snippet.title = title),
    void 0 !== description && (body.snippet.description = description),
    void 0 !== privacyStatus && (body.status.privacyStatus = privacyStatus),
    ytFetch(creds, `${YT_BASE}/playlists?part=snippet,status`, {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  );
}
export async function deletePlaylist(creds, playlistId) {
  return (
    await ytFetch(creds, `${YT_BASE}/playlists?id=${encodeURIComponent(playlistId)}`, {
      method: 'DELETE',
    }),
    !0
  );
}
export async function addVideoToPlaylist(creds, playlistId, videoId) {
  return ytFetch(creds, `${YT_BASE}/playlistItems?part=snippet`, {
    method: 'POST',
    body: JSON.stringify({
      snippet: { playlistId: playlistId, resourceId: { kind: 'youtube#video', videoId: videoId } },
    }),
  });
}
export async function removePlaylistItem(creds, playlistItemId) {
  return (
    await ytFetch(creds, `${YT_BASE}/playlistItems?id=${encodeURIComponent(playlistItemId)}`, {
      method: 'DELETE',
    }),
    !0
  );
}
export async function subscribeToChannel(creds, channelId) {
  return ytFetch(creds, `${YT_BASE}/subscriptions?part=snippet`, {
    method: 'POST',
    body: JSON.stringify({
      snippet: { resourceId: { kind: 'youtube#channel', channelId: channelId } },
    }),
  });
}
export async function unsubscribeFromChannel(creds, subscriptionId) {
  return (
    await ytFetch(creds, `${YT_BASE}/subscriptions?id=${encodeURIComponent(subscriptionId)}`, {
      method: 'DELETE',
    }),
    !0
  );
}
export async function checkSubscription(creds, channelId) {
  const params = new URLSearchParams({ part: 'snippet', mine: 'true', forChannelId: channelId }),
    data = await ytFetch(creds, `${YT_BASE}/subscriptions?${params}`),
    item = data.items?.[0] ?? null;
  return { subscribed: !!item, subscriptionId: item?.id ?? null };
}
export async function postComment(creds, videoId, text) {
  return ytFetch(creds, `${YT_BASE}/commentThreads?part=snippet`, {
    method: 'POST',
    body: JSON.stringify({
      snippet: { videoId: videoId, topLevelComment: { snippet: { textOriginal: text } } },
    }),
  });
}
export async function replyToComment(creds, parentId, text) {
  return ytFetch(creds, `${YT_BASE}/comments?part=snippet`, {
    method: 'POST',
    body: JSON.stringify({ snippet: { parentId: parentId, textOriginal: text } }),
  });
}
export async function deleteComment(creds, commentId) {
  return (
    await ytFetch(creds, `${YT_BASE}/comments?id=${encodeURIComponent(commentId)}`, {
      method: 'DELETE',
    }),
    !0
  );
}
export async function getCommentReplies(creds, parentId, maxResults = 20) {
  const params = new URLSearchParams({
    part: 'snippet',
    parentId: parentId,
    maxResults: String(Math.min(maxResults, 100)),
  });
  return (await ytFetch(creds, `${YT_BASE}/comments?${params}`)).items ?? [];
}
export async function getVideoRating(creds, videoId) {
  const data = await ytFetch(
    creds,
    `${YT_BASE}/videos/getRating?id=${encodeURIComponent(videoId)}`,
  );
  return data.items?.[0] ?? null;
}
export async function getTrendingVideos(
  creds,
  { regionCode: regionCode = 'US', categoryId: categoryId = '0', maxResults: maxResults = 20 } = {},
) {
  const params = new URLSearchParams({
    part: 'snippet,statistics,contentDetails',
    chart: 'mostPopular',
    regionCode: regionCode,
    videoCategoryId: categoryId,
    maxResults: String(Math.min(maxResults, 50)),
  });
  return (await ytFetch(creds, `${YT_BASE}/videos?${params}`)).items ?? [];
}
export async function searchChannels(creds, query, maxResults = 10) {
  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'channel',
    maxResults: String(Math.min(maxResults, 50)),
  });
  return (await ytFetch(creds, `${YT_BASE}/search?${params}`)).items ?? [];
}
export async function searchPlaylists(creds, query, maxResults = 10) {
  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'playlist',
    maxResults: String(Math.min(maxResults, 50)),
  });
  return (await ytFetch(creds, `${YT_BASE}/search?${params}`)).items ?? [];
}
export async function getVideoCategories(creds, regionCode = 'US') {
  const params = new URLSearchParams({ part: 'snippet', regionCode: regionCode, hl: 'en' });
  return (await ytFetch(creds, `${YT_BASE}/videoCategories?${params}`)).items ?? [];
}
export async function reportVideo(creds, videoId, reasonId, secondaryReasonId = '', comments = '') {
  return (
    await ytFetch(creds, `${YT_BASE}/videos/reportAbuse`, {
      method: 'POST',
      body: JSON.stringify({
        videoId: videoId,
        reasonId: reasonId,
        secondaryReasonId: secondaryReasonId,
        comments: comments,
      }),
    }),
    !0
  );
}
export async function getDislikedVideos(creds, maxResults = 20) {
  const params = new URLSearchParams({
    part: 'snippet,statistics,contentDetails',
    myRating: 'dislike',
    maxResults: String(Math.min(maxResults, 50)),
  });
  return (await ytFetch(creds, `${YT_BASE}/videos?${params}`)).items ?? [];
}
export async function updateComment(creds, commentId, newText) {
  return ytFetch(creds, `${YT_BASE}/comments?part=snippet`, {
    method: 'PUT',
    body: JSON.stringify({ id: commentId, snippet: { textOriginal: newText } }),
  });
}
export async function getMyActivities(creds, maxResults = 20) {
  const params = new URLSearchParams({
    part: 'snippet,contentDetails',
    mine: 'true',
    maxResults: String(Math.min(maxResults, 50)),
  });
  return (await ytFetch(creds, `${YT_BASE}/activities?${params}`)).items ?? [];
}
export async function getChannelActivities(creds, channelId, maxResults = 20) {
  const params = new URLSearchParams({
    part: 'snippet,contentDetails',
    channelId: channelId,
    maxResults: String(Math.min(maxResults, 50)),
  });
  return (await ytFetch(creds, `${YT_BASE}/activities?${params}`)).items ?? [];
}
export async function getChannelPlaylists(creds, channelId, maxResults = 20) {
  const params = new URLSearchParams({
    part: 'snippet,contentDetails',
    channelId: channelId,
    maxResults: String(Math.min(maxResults, 50)),
  });
  return (await ytFetch(creds, `${YT_BASE}/playlists?${params}`)).items ?? [];
}
export async function getVideoCaptions(creds, videoId) {
  const params = new URLSearchParams({ part: 'snippet', videoId: videoId });
  return (await ytFetch(creds, `${YT_BASE}/captions?${params}`)).items ?? [];
}
export async function searchLiveVideos(creds, query, maxResults = 10) {
  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    eventType: 'live',
    maxResults: String(Math.min(maxResults, 50)),
  });
  return (await ytFetch(creds, `${YT_BASE}/search?${params}`)).items ?? [];
}
export async function getVideoAbuseReportReasons(creds) {
  const params = new URLSearchParams({ part: 'snippet', hl: 'en' });
  return (await ytFetch(creds, `${YT_BASE}/videoAbuseReportReasons?${params}`)).items ?? [];
}
export async function getI18nLanguages(creds) {
  const params = new URLSearchParams({ part: 'snippet', hl: 'en' });
  return (await ytFetch(creds, `${YT_BASE}/i18nLanguages?${params}`)).items ?? [];
}
export async function getI18nRegions(creds) {
  const params = new URLSearchParams({ part: 'snippet', hl: 'en' });
  return (await ytFetch(creds, `${YT_BASE}/i18nRegions?${params}`)).items ?? [];
}
export async function getVideosBatch(
  creds,
  videoIds = [],
  parts = 'snippet,statistics,contentDetails',
) {
  if (!videoIds.length) return [];
  const chunks = [];
  for (let i = 0; i < videoIds.length; i += 50) chunks.push(videoIds.slice(i, i + 50));
  return (
    await Promise.all(
      chunks.map(
        async (chunk) =>
          (await ytFetch(creds, `${YT_BASE}/videos?part=${parts}&id=${chunk.join(',')}`)).items ??
          [],
      ),
    )
  ).flat();
}
export async function getChannelSections(creds, channelId) {
  const params = new URLSearchParams({ part: 'snippet,contentDetails', channelId: channelId });
  return (await ytFetch(creds, `${YT_BASE}/channelSections?${params}`)).items ?? [];
}
export async function getCommentById(creds, commentId) {
  const params = new URLSearchParams({ part: 'snippet', id: commentId }),
    data = await ytFetch(creds, `${YT_BASE}/comments?${params}`);
  return data.items?.[0] ?? null;
}
export async function getChannelBranding(creds, channelId) {
  const data = await ytFetch(
    creds,
    `${YT_BASE}/channels?part=snippet,brandingSettings,statistics&id=${channelId}`,
  );
  return data.items?.[0] ?? null;
}
export async function getPlaylistById(creds, playlistId) {
  const params = new URLSearchParams({ part: 'snippet,status,contentDetails', id: playlistId }),
    data = await ytFetch(creds, `${YT_BASE}/playlists?${params}`);
  return data.items?.[0] ?? null;
}
export async function getVideoTags(creds, videoId) {
  const data = await ytFetch(creds, `${YT_BASE}/videos?part=snippet&id=${videoId}`),
    item = data.items?.[0] ?? null;
  return item?.snippet?.tags ?? [];
}
export async function getCommentThreadsByChannel(creds, channelId, maxResults = 20) {
  const params = new URLSearchParams({
    part: 'snippet',
    allThreadsRelatedToChannelId: channelId,
    maxResults: String(Math.min(maxResults, 100)),
    order: 'time',
  });
  return (await ytFetch(creds, `${YT_BASE}/commentThreads?${params}`)).items ?? [];
}
export async function searchVideosAdvanced(
  creds,
  query,
  {
    maxResults: maxResults = 10,
    order: order = 'relevance',
    videoDuration: videoDuration = 'any',
    videoDefinition: videoDefinition = 'any',
    publishedAfter: publishedAfter = null,
    publishedBefore: publishedBefore = null,
    regionCode: regionCode = null,
    relevanceLanguage: relevanceLanguage = null,
  } = {},
) {
  const p = {
    part: 'snippet',
    q: query,
    type: 'video',
    maxResults: String(Math.min(maxResults, 50)),
    order: order,
    videoDuration: videoDuration,
    videoDefinition: videoDefinition,
  };
  return (
    publishedAfter && (p.publishedAfter = publishedAfter),
    publishedBefore && (p.publishedBefore = publishedBefore),
    regionCode && (p.regionCode = regionCode),
    relevanceLanguage && (p.relevanceLanguage = relevanceLanguage),
    (await ytFetch(creds, `${YT_BASE}/search?${new URLSearchParams(p)}`)).items ?? []
  );
}
export async function getVideoStatistics(creds, videoId) {
  const data = await ytFetch(creds, `${YT_BASE}/videos?part=statistics&id=${videoId}`);
  return data.items?.[0]?.statistics ?? null;
}
export async function getChannelStatistics(creds, channelId) {
  const data = await ytFetch(creds, `${YT_BASE}/channels?part=statistics&id=${channelId}`);
  return data.items?.[0]?.statistics ?? null;
}
