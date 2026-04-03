import * as YouTubeAPI from '../API/YouTubeAPI.js';
import { requireGoogleCredentials } from '../../../Common.js';

function formatVideo(item, index) {
  const sn = item.snippet ?? {};
  const stats = item.statistics ?? {};
  const details = item.contentDetails ?? {};
  const videoId = item.id?.videoId ?? item.id ?? item.contentDetails?.videoId ?? '';
  const lines = [
    `${index}. **${sn.title ?? '(No title)'}**`,
    `   Channel: ${sn.channelTitle ?? 'unknown'}`,
    videoId ? `   ID: \`${videoId}\`` : '',
    sn.publishedAt ? `   Published: ${new Date(sn.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}` : '',
  ];
  if (stats.viewCount) lines.push(`   Views: ${YouTubeAPI.formatCount(stats.viewCount)}`);
  if (stats.likeCount) lines.push(`   Likes: ${YouTubeAPI.formatCount(stats.likeCount)}`);
  if (details.duration) lines.push(`   Duration: ${YouTubeAPI.parseDuration(details.duration)}`);
  if (sn.description) lines.push(`   Description: ${sn.description.slice(0, 120)}${sn.description.length > 120 ? '...' : ''}`);
  return lines.filter(Boolean).join('\n');
}

export async function executeYouTubeChatTool(ctx, toolName, params = {}) {
  const credentials = requireGoogleCredentials(ctx);

  switch (toolName) {
    case 'youtube_get_my_channel': {
      const channel = await YouTubeAPI.getMyChannel(credentials);
      if (!channel) return 'No YouTube channel found for this account.';
      const sn = channel.snippet ?? {};
      const stats = channel.statistics ?? {};
      return [
        `**${sn.title ?? 'Your Channel'}**`,
        sn.description ? `${sn.description.slice(0, 200)}${sn.description.length > 200 ? '...' : ''}` : '',
        '',
        `Channel ID: \`${channel.id}\``,
        `Subscribers: ${stats.hiddenSubscriberCount ? 'Hidden' : YouTubeAPI.formatCount(stats.subscriberCount)}`,
        `Total Views: ${YouTubeAPI.formatCount(stats.viewCount)}`,
        `Videos: ${YouTubeAPI.formatCount(stats.videoCount)}`,
        sn.country ? `Country: ${sn.country}` : '',
        sn.publishedAt ? `Created: ${new Date(sn.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}` : '',
      ].filter(Boolean).join('\n');
    }

    case 'youtube_search_videos': {
      const { query, max_results = 10, order = 'relevance' } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      const items = await YouTubeAPI.searchVideos(credentials, query, { maxResults: max_results, order });
      if (!items.length) return `No videos found for "${query}".`;
      const videoIds = items.map(item => item.id?.videoId).filter(Boolean);
      const detailed = videoIds.length ? await YouTubeAPI.getMultipleVideos(credentials, videoIds) : items;
      const map = Object.fromEntries(detailed.map(v => [v.id, v]));
      const lines = items.map((item, i) => {
        const full = map[item.id?.videoId] ?? item;
        return formatVideo(full.id ? full : { ...full, id: { videoId: item.id?.videoId } }, i + 1);
      });
      return `YouTube search "${query}" — ${items.length} result${items.length !== 1 ? 's' : ''}:\n\n${lines.join('\n\n')}`;
    }

    case 'youtube_get_video': {
      const { video_id } = params;
      if (!video_id?.trim()) throw new Error('Missing required param: video_id');
      const video = await YouTubeAPI.getVideoDetails(credentials, video_id.trim());
      if (!video) return `No video found with ID "${video_id}".`;
      const sn = video.snippet ?? {};
      const stats = video.statistics ?? {};
      const details = video.contentDetails ?? {};
      return [
        `**${sn.title ?? '(No title)'}**`,
        '',
        `Channel: ${sn.channelTitle ?? 'unknown'}`,
        `Video ID: \`${video.id}\``,
        `Published: ${sn.publishedAt ? new Date(sn.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'unknown'}`,
        `Duration: ${details.duration ? YouTubeAPI.parseDuration(details.duration) : 'unknown'}`,
        '',
        `👁  Views:    ${YouTubeAPI.formatCount(stats.viewCount)}`,
        `👍 Likes:    ${YouTubeAPI.formatCount(stats.likeCount)}`,
        `💬 Comments: ${stats.commentCount ? YouTubeAPI.formatCount(stats.commentCount) : 'disabled'}`,
        '',
        '── Description ──',
        sn.description ? sn.description.slice(0, 500) + (sn.description.length > 500 ? '...' : '') : '(none)',
      ].join('\n');
    }

    case 'youtube_list_playlists': {
      const { max_results = 20 } = params;
      const playlists = await YouTubeAPI.listMyPlaylists(credentials, max_results);
      if (!playlists.length) return 'No playlists found on your channel.';
      const lines = playlists.map((pl, i) => {
        const sn = pl.snippet ?? {};
        const count = pl.contentDetails?.itemCount ?? 0;
        return `${i + 1}. **${sn.title ?? '(Untitled)'}** — ${count} video${count !== 1 ? 's' : ''}\n   ID: \`${pl.id}\`${sn.description ? `\n   ${sn.description.slice(0, 80)}` : ''}`;
      });
      return `Your playlists (${playlists.length}):\n\n${lines.join('\n\n')}`;
    }

    case 'youtube_get_playlist_items': {
      const { playlist_id, max_results = 20 } = params;
      if (!playlist_id?.trim()) throw new Error('Missing required param: playlist_id');
      const items = await YouTubeAPI.getPlaylistItems(credentials, playlist_id.trim(), max_results);
      if (!items.length) return `Playlist \`${playlist_id}\` is empty or not found.`;
      const lines = items.map((item, i) => {
        const sn = item.snippet ?? {};
        const videoId = sn.resourceId?.videoId ?? '';
        return `${i + 1}. **${sn.title ?? '(No title)'}**${videoId ? `\n   Video ID: \`${videoId}\`` : ''}\n   Channel: ${sn.videoOwnerChannelTitle ?? 'unknown'}`;
      });
      return `Playlist items (${items.length}):\n\n${lines.join('\n\n')}`;
    }

    case 'youtube_list_subscriptions': {
      const { max_results = 20 } = params;
      const subs = await YouTubeAPI.listSubscriptions(credentials, max_results);
      if (!subs.length) return 'No subscriptions found.';
      const lines = subs.map((sub, i) => {
        const sn = sub.snippet ?? {};
        return `${i + 1}. **${sn.title ?? '(Unknown)'}**\n   Channel ID: \`${sn.resourceId?.channelId ?? ''}\`${sn.description ? `\n   ${sn.description.slice(0, 80)}` : ''}`;
      });
      return `Your subscriptions (${subs.length}):\n\n${lines.join('\n\n')}`;
    }

    case 'youtube_get_liked_videos': {
      const { max_results = 20 } = params;
      const videos = await YouTubeAPI.getLikedVideos(credentials, max_results);
      if (!videos.length) return 'No liked videos found.';
      return `Your liked videos (${videos.length}):\n\n${videos.map((v, i) => formatVideo(v, i + 1)).join('\n\n')}`;
    }

    case 'youtube_get_video_comments': {
      const { video_id, max_results = 20 } = params;
      if (!video_id?.trim()) throw new Error('Missing required param: video_id');
      const threads = await YouTubeAPI.getVideoComments(credentials, video_id.trim(), max_results);
      if (!threads.length) return `No comments found for video \`${video_id}\` (comments may be disabled).`;
      const lines = threads.map((thread, i) => {
        const top = thread.snippet?.topLevelComment?.snippet ?? {};
        const replyCount = thread.snippet?.totalReplyCount ?? 0;
        return [
          `${i + 1}. **${top.authorDisplayName ?? 'Anonymous'}**`,
          `   ${top.textDisplay?.replace(/<[^>]*>/g, '').slice(0, 200) ?? ''}`,
          `   👍 ${YouTubeAPI.formatCount(top.likeCount)}${replyCount ? ` · ${replyCount} repl${replyCount !== 1 ? 'ies' : 'y'}` : ''}`,
          `   ${top.publishedAt ? new Date(top.publishedAt).toLocaleDateString() : ''}`,
        ].join('\n');
      });
      return `Comments on \`${video_id}\` (${threads.length}):\n\n${lines.join('\n\n')}`;
    }

    case 'youtube_rate_video': {
      const { video_id, rating } = params;
      if (!video_id?.trim()) throw new Error('Missing required param: video_id');
      if (!rating?.trim()) throw new Error('Missing required param: rating');
      await YouTubeAPI.rateVideo(credentials, video_id.trim(), rating.trim().toLowerCase());
      const action = rating === 'like' ? 'Liked' : rating === 'dislike' ? 'Disliked' : 'Rating removed from';
      return `${action} video \`${video_id}\`.`;
    }

    case 'youtube_list_my_videos': {
      const { max_results = 20 } = params;
      const items = await YouTubeAPI.listMyVideos(credentials, max_results);
      if (!items.length) return 'No videos found on your channel.';
      const lines = items.map((item, i) => {
        const sn = item.snippet ?? {};
        const videoId = item.id?.videoId ?? '';
        return `${i + 1}. **${sn.title ?? '(No title)'}**${videoId ? `\n   ID: \`${videoId}\`` : ''}\n   Published: ${sn.publishedAt ? new Date(sn.publishedAt).toLocaleDateString() : 'unknown'}`;
      });
      return `Your videos (${items.length}):\n\n${lines.join('\n\n')}`;
    }

    default:
      throw new Error(`Unknown YouTube tool: ${toolName}`);
  }
}
