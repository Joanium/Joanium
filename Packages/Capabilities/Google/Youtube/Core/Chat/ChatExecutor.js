import * as YouTubeAPI from '../API/YouTubeAPI.js';
import { requireGoogleCredentials } from '../../../Common.js';
function formatVideo(item, index) {
  const sn = item.snippet ?? {},
    stats = item.statistics ?? {},
    details = item.contentDetails ?? {},
    videoId = item.id?.videoId ?? item.id ?? item.contentDetails?.videoId ?? '',
    lines = [
      `${index}. **${sn.title ?? '(No title)'}**`,
      `   Channel: ${sn.channelTitle ?? 'unknown'}`,
      videoId ? `   ID: \`${videoId}\`` : '',
      sn.publishedAt
        ? `   Published: ${new Date(sn.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`
        : '',
    ];
  return (
    stats.viewCount && lines.push(`   Views: ${YouTubeAPI.formatCount(stats.viewCount)}`),
    stats.likeCount && lines.push(`   Likes: ${YouTubeAPI.formatCount(stats.likeCount)}`),
    details.duration && lines.push(`   Duration: ${YouTubeAPI.parseDuration(details.duration)}`),
    sn.description &&
      lines.push(
        `   Description: ${sn.description.slice(0, 120)}${sn.description.length > 120 ? '...' : ''}`,
      ),
    lines.filter(Boolean).join('\n')
  );
}
export async function executeYouTubeChatTool(ctx, toolName, params = {}) {
  const credentials = requireGoogleCredentials(ctx);
  switch (toolName) {
    case 'youtube_get_my_channel': {
      const channel = await YouTubeAPI.getMyChannel(credentials);
      if (!channel) return 'No YouTube channel found for this account.';
      const sn = channel.snippet ?? {},
        stats = channel.statistics ?? {};
      return [
        `**${sn.title ?? 'Your Channel'}**`,
        sn.description
          ? `${sn.description.slice(0, 200)}${sn.description.length > 200 ? '...' : ''}`
          : '',
        '',
        `Channel ID: \`${channel.id}\``,
        `Subscribers: ${stats.hiddenSubscriberCount ? 'Hidden' : YouTubeAPI.formatCount(stats.subscriberCount)}`,
        `Total Views: ${YouTubeAPI.formatCount(stats.viewCount)}`,
        `Videos: ${YouTubeAPI.formatCount(stats.videoCount)}`,
        sn.country ? `Country: ${sn.country}` : '',
        sn.publishedAt
          ? `Created: ${new Date(sn.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}`
          : '',
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'youtube_search_videos': {
      const { query: query, max_results: max_results = 10, order: order = 'relevance' } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      const items = await YouTubeAPI.searchVideos(credentials, query, {
        maxResults: max_results,
        order: order,
      });
      if (!items.length) return `No videos found for "${query}".`;
      const videoIds = items.map((item) => item.id?.videoId).filter(Boolean),
        detailed = videoIds.length
          ? await YouTubeAPI.getMultipleVideos(credentials, videoIds)
          : items,
        map = Object.fromEntries(detailed.map((v) => [v.id, v])),
        lines = items.map((item, i) => {
          const full = map[item.id?.videoId] ?? item;
          return formatVideo(
            full.id ? full : { ...full, id: { videoId: item.id?.videoId } },
            i + 1,
          );
        });
      return `YouTube search "${query}" — ${items.length} result${1 !== items.length ? 's' : ''}:\n\n${lines.join('\n\n')}`;
    }
    case 'youtube_get_video': {
      const { video_id: video_id } = params;
      if (!video_id?.trim()) throw new Error('Missing required param: video_id');
      const video = await YouTubeAPI.getVideoDetails(credentials, video_id.trim());
      if (!video) return `No video found with ID "${video_id}".`;
      const sn = video.snippet ?? {},
        stats = video.statistics ?? {},
        details = video.contentDetails ?? {};
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
        sn.description
          ? sn.description.slice(0, 500) + (sn.description.length > 500 ? '...' : '')
          : '(none)',
      ].join('\n');
    }
    case 'youtube_list_playlists': {
      const { max_results: max_results = 20 } = params,
        playlists = await YouTubeAPI.listMyPlaylists(credentials, max_results);
      if (!playlists.length) return 'No playlists found on your channel.';
      const lines = playlists.map((pl, i) => {
        const sn = pl.snippet ?? {},
          count = pl.contentDetails?.itemCount ?? 0;
        return `${i + 1}. **${sn.title ?? '(Untitled)'}** — ${count} video${1 !== count ? 's' : ''}\n   ID: \`${pl.id}\`${sn.description ? `\n   ${sn.description.slice(0, 80)}` : ''}`;
      });
      return `Your playlists (${playlists.length}):\n\n${lines.join('\n\n')}`;
    }
    case 'youtube_get_playlist_items': {
      const { playlist_id: playlist_id, max_results: max_results = 20 } = params;
      if (!playlist_id?.trim()) throw new Error('Missing required param: playlist_id');
      const items = await YouTubeAPI.getPlaylistItems(credentials, playlist_id.trim(), max_results);
      if (!items.length) return `Playlist \`${playlist_id}\` is empty or not found.`;
      const lines = items.map((item, i) => {
        const sn = item.snippet ?? {},
          videoId = sn.resourceId?.videoId ?? '';
        return `${i + 1}. **${sn.title ?? '(No title)'}**${videoId ? `\n   Video ID: \`${videoId}\`` : ''}\n   Channel: ${sn.videoOwnerChannelTitle ?? 'unknown'}`;
      });
      return `Playlist items (${items.length}):\n\n${lines.join('\n\n')}`;
    }
    case 'youtube_list_subscriptions': {
      const { max_results: max_results = 20 } = params,
        subs = await YouTubeAPI.listSubscriptions(credentials, max_results);
      if (!subs.length) return 'No subscriptions found.';
      const lines = subs.map((sub, i) => {
        const sn = sub.snippet ?? {};
        return `${i + 1}. **${sn.title ?? '(Unknown)'}**\n   Channel ID: \`${sn.resourceId?.channelId ?? ''}\`${sn.description ? `\n   ${sn.description.slice(0, 80)}` : ''}`;
      });
      return `Your subscriptions (${subs.length}):\n\n${lines.join('\n\n')}`;
    }
    case 'youtube_get_liked_videos': {
      const { max_results: max_results = 20 } = params,
        videos = await YouTubeAPI.getLikedVideos(credentials, max_results);
      return videos.length
        ? `Your liked videos (${videos.length}):\n\n${videos.map((v, i) => formatVideo(v, i + 1)).join('\n\n')}`
        : 'No liked videos found.';
    }
    case 'youtube_get_video_comments': {
      const { video_id: video_id, max_results: max_results = 20 } = params;
      if (!video_id?.trim()) throw new Error('Missing required param: video_id');
      const threads = await YouTubeAPI.getVideoComments(credentials, video_id.trim(), max_results);
      if (!threads.length)
        return `No comments found for video \`${video_id}\` (comments may be disabled).`;
      const lines = threads.map((thread, i) => {
        const top = thread.snippet?.topLevelComment?.snippet ?? {},
          replyCount = thread.snippet?.totalReplyCount ?? 0;
        return [
          `${i + 1}. **${top.authorDisplayName ?? 'Anonymous'}**`,
          `   ${top.textDisplay?.replace(/<[^>]*>/g, '').slice(0, 200) ?? ''}`,
          `   👍 ${YouTubeAPI.formatCount(top.likeCount)}${replyCount ? ` · ${replyCount} repl${1 !== replyCount ? 'ies' : 'y'}` : ''}`,
          `   ${top.publishedAt ? new Date(top.publishedAt).toLocaleDateString() : ''}`,
        ].join('\n');
      });
      return `Comments on \`${video_id}\` (${threads.length}):\n\n${lines.join('\n\n')}`;
    }
    case 'youtube_rate_video': {
      const { video_id: video_id, rating: rating } = params;
      if (!video_id?.trim()) throw new Error('Missing required param: video_id');
      if (!rating?.trim()) throw new Error('Missing required param: rating');
      return (
        await YouTubeAPI.rateVideo(credentials, video_id.trim(), rating.trim().toLowerCase()),
        `${'like' === rating ? 'Liked' : 'dislike' === rating ? 'Disliked' : 'Rating removed from'} video \`${video_id}\`.`
      );
    }
    case 'youtube_list_my_videos': {
      const { max_results: max_results = 20 } = params,
        items = await YouTubeAPI.listMyVideos(credentials, max_results);
      if (!items.length) return 'No videos found on your channel.';
      const lines = items.map((item, i) => {
        const sn = item.snippet ?? {},
          videoId = item.id?.videoId ?? '';
        return `${i + 1}. **${sn.title ?? '(No title)'}**${videoId ? `\n   ID: \`${videoId}\`` : ''}\n   Published: ${sn.publishedAt ? new Date(sn.publishedAt).toLocaleDateString() : 'unknown'}`;
      });
      return `Your videos (${items.length}):\n\n${lines.join('\n\n')}`;
    }
    case 'youtube_get_channel_by_id': {
      const { channel_id: channel_id } = params;
      if (!channel_id?.trim()) throw new Error('Missing required param: channel_id');
      const channel = await YouTubeAPI.getChannelById(credentials, channel_id.trim());
      if (!channel) return `No channel found with ID "${channel_id}".`;
      const sn = channel.snippet ?? {},
        stats = channel.statistics ?? {};
      return [
        `**${sn.title ?? 'Unknown Channel'}**`,
        sn.description ? sn.description.slice(0, 200) : '',
        '',
        `Channel ID: \`${channel.id}\``,
        `Subscribers: ${stats.hiddenSubscriberCount ? 'Hidden' : YouTubeAPI.formatCount(stats.subscriberCount)}`,
        `Total Views: ${YouTubeAPI.formatCount(stats.viewCount)}`,
        `Videos: ${YouTubeAPI.formatCount(stats.videoCount)}`,
        sn.country ? `Country: ${sn.country}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'youtube_get_channel_videos': {
      const { channel_id: channel_id, max_results: max_results = 20 } = params;
      if (!channel_id?.trim()) throw new Error('Missing required param: channel_id');
      const items = await YouTubeAPI.getChannelVideos(credentials, channel_id.trim(), max_results);
      if (!items.length) return `No videos found for channel \`${channel_id}\`.`;
      const lines = items.map((item, i) => {
        const sn = item.snippet ?? {},
          videoId = item.id?.videoId ?? '';
        return `${i + 1}. **${sn.title ?? '(No title)'}**${videoId ? `\n   ID: \`${videoId}\`` : ''}\n   Published: ${sn.publishedAt ? new Date(sn.publishedAt).toLocaleDateString() : 'unknown'}`;
      });
      return `Channel videos (${items.length}):\n\n${lines.join('\n\n')}`;
    }
    case 'youtube_create_playlist': {
      const {
        title: title,
        description: description,
        privacy_status: privacy_status = 'private',
      } = params;
      if (!title?.trim()) throw new Error('Missing required param: title');
      const pl = await YouTubeAPI.createPlaylist(credentials, {
        title: title,
        description: description,
        privacyStatus: privacy_status,
      });
      return `Playlist created!\nID: \`${pl.id}\`\nTitle: ${pl.snippet?.title}\nPrivacy: ${pl.status?.privacyStatus}`;
    }
    case 'youtube_update_playlist': {
      const {
        playlist_id: playlist_id,
        title: title,
        description: description,
        privacy_status: privacy_status,
      } = params;
      if (!playlist_id?.trim()) throw new Error('Missing required param: playlist_id');
      return (
        await YouTubeAPI.updatePlaylist(credentials, playlist_id.trim(), {
          title: title,
          description: description,
          privacyStatus: privacy_status,
        }),
        `Playlist \`${playlist_id}\` updated successfully.`
      );
    }
    case 'youtube_delete_playlist': {
      const { playlist_id: playlist_id } = params;
      if (!playlist_id?.trim()) throw new Error('Missing required param: playlist_id');
      return (
        await YouTubeAPI.deletePlaylist(credentials, playlist_id.trim()),
        `Playlist \`${playlist_id}\` deleted.`
      );
    }
    case 'youtube_add_video_to_playlist': {
      const { playlist_id: playlist_id, video_id: video_id } = params;
      if (!playlist_id?.trim()) throw new Error('Missing required param: playlist_id');
      if (!video_id?.trim()) throw new Error('Missing required param: video_id');
      const item = await YouTubeAPI.addVideoToPlaylist(
        credentials,
        playlist_id.trim(),
        video_id.trim(),
      );
      return `Video \`${video_id}\` added to playlist \`${playlist_id}\`.\nPlaylist item ID: \`${item.id}\``;
    }
    case 'youtube_remove_playlist_item': {
      const { playlist_item_id: playlist_item_id } = params;
      if (!playlist_item_id?.trim()) throw new Error('Missing required param: playlist_item_id');
      return (
        await YouTubeAPI.removePlaylistItem(credentials, playlist_item_id.trim()),
        `Playlist item \`${playlist_item_id}\` removed.`
      );
    }
    case 'youtube_subscribe_to_channel': {
      const { channel_id: channel_id } = params;
      if (!channel_id?.trim()) throw new Error('Missing required param: channel_id');
      const sub = await YouTubeAPI.subscribeToChannel(credentials, channel_id.trim());
      return `Subscribed to channel \`${channel_id}\`.\nSubscription ID: \`${sub.id}\``;
    }
    case 'youtube_unsubscribe_from_channel': {
      const { subscription_id: subscription_id } = params;
      if (!subscription_id?.trim()) throw new Error('Missing required param: subscription_id');
      return (
        await YouTubeAPI.unsubscribeFromChannel(credentials, subscription_id.trim()),
        `Unsubscribed. Subscription \`${subscription_id}\` removed.`
      );
    }
    case 'youtube_check_subscription': {
      const { channel_id: channel_id } = params;
      if (!channel_id?.trim()) throw new Error('Missing required param: channel_id');
      const result = await YouTubeAPI.checkSubscription(credentials, channel_id.trim());
      return result.subscribed
        ? `You are subscribed to \`${channel_id}\`.\nSubscription ID: \`${result.subscriptionId}\``
        : `You are NOT subscribed to \`${channel_id}\`.`;
    }
    case 'youtube_post_comment': {
      const { video_id: video_id, text: text } = params;
      if (!video_id?.trim()) throw new Error('Missing required param: video_id');
      if (!text?.trim()) throw new Error('Missing required param: text');
      return `Comment posted!\nComment ID: \`${(await YouTubeAPI.postComment(credentials, video_id.trim(), text.trim())).id}\`\n"${text.slice(0, 100)}"`;
    }
    case 'youtube_reply_to_comment': {
      const { parent_id: parent_id, text: text } = params;
      if (!parent_id?.trim()) throw new Error('Missing required param: parent_id');
      if (!text?.trim()) throw new Error('Missing required param: text');
      return `Reply posted!\nComment ID: \`${(await YouTubeAPI.replyToComment(credentials, parent_id.trim(), text.trim())).id}\`\n"${text.slice(0, 100)}"`;
    }
    case 'youtube_delete_comment': {
      const { comment_id: comment_id } = params;
      if (!comment_id?.trim()) throw new Error('Missing required param: comment_id');
      return (
        await YouTubeAPI.deleteComment(credentials, comment_id.trim()),
        `Comment \`${comment_id}\` deleted.`
      );
    }
    case 'youtube_get_comment_replies': {
      const { parent_id: parent_id, max_results: max_results = 20 } = params;
      if (!parent_id?.trim()) throw new Error('Missing required param: parent_id');
      const replies = await YouTubeAPI.getCommentReplies(
        credentials,
        parent_id.trim(),
        max_results,
      );
      if (!replies.length) return `No replies found for comment \`${parent_id}\`.`;
      const lines = replies.map((c, i) => {
        const sn = c.snippet ?? {};
        return [
          `${i + 1}. **${sn.authorDisplayName ?? 'Anonymous'}**`,
          `   ${sn.textDisplay?.replace(/<[^>]*>/g, '').slice(0, 200) ?? ''}`,
          `   👍 ${YouTubeAPI.formatCount(sn.likeCount)}`,
        ].join('\n');
      });
      return `Replies (${replies.length}):\n\n${lines.join('\n\n')}`;
    }
    case 'youtube_get_video_rating': {
      const { video_id: video_id } = params;
      if (!video_id?.trim()) throw new Error('Missing required param: video_id');
      const rating = await YouTubeAPI.getVideoRating(credentials, video_id.trim());
      return rating
        ? `Your rating for \`${video_id}\`: **${rating.rating ?? 'none'}**`
        : `No rating info found for \`${video_id}\`.`;
    }
    case 'youtube_get_trending_videos': {
      const {
          region_code: region_code = 'US',
          category_id: category_id = '0',
          max_results: max_results = 20,
        } = params,
        items = await YouTubeAPI.getTrendingVideos(credentials, {
          regionCode: region_code,
          categoryId: category_id,
          maxResults: max_results,
        });
      return items.length
        ? `Trending in ${region_code} (${items.length}):\n\n${items.map((v, i) => formatVideo(v, i + 1)).join('\n\n')}`
        : 'No trending videos found.';
    }
    case 'youtube_search_channels': {
      const { query: query, max_results: max_results = 10 } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      const items = await YouTubeAPI.searchChannels(credentials, query.trim(), max_results);
      if (!items.length) return `No channels found for "${query}".`;
      const lines = items.map((item, i) => {
        const sn = item.snippet ?? {};
        return `${i + 1}. **${sn.channelTitle ?? sn.title ?? '(Unknown)'}**\n   Channel ID: \`${item.id?.channelId ?? ''}\`${sn.description ? `\n   ${sn.description.slice(0, 80)}` : ''}`;
      });
      return `Channel search "${query}" — ${items.length} result${1 !== items.length ? 's' : ''}:\n\n${lines.join('\n\n')}`;
    }
    case 'youtube_search_playlists': {
      const { query: query, max_results: max_results = 10 } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      const items = await YouTubeAPI.searchPlaylists(credentials, query.trim(), max_results);
      if (!items.length) return `No playlists found for "${query}".`;
      const lines = items.map((item, i) => {
        const sn = item.snippet ?? {};
        return `${i + 1}. **${sn.title ?? '(Untitled)'}**\n   Playlist ID: \`${item.id?.playlistId ?? ''}\`\n   By: ${sn.channelTitle ?? 'unknown'}`;
      });
      return `Playlist search "${query}" — ${items.length} result${1 !== items.length ? 's' : ''}:\n\n${lines.join('\n\n')}`;
    }
    case 'youtube_get_video_categories': {
      const { region_code: region_code = 'US' } = params,
        cats = await YouTubeAPI.getVideoCategories(credentials, region_code);
      return cats.length
        ? `YouTube video categories (${region_code}):\n\`\`\`\n${cats
            .filter((c) => c.snippet?.assignable)
            .map((c) => `${c.id.padStart(3, ' ')}. ${c.snippet?.title ?? '(Unknown)'}`)
            .join('\n')}\n\`\`\``
        : 'No categories found.';
    }
    case 'youtube_report_video': {
      const {
        video_id: video_id,
        reason_id: reason_id,
        secondary_reason_id: secondary_reason_id = '',
        comments: comments = '',
      } = params;
      if (!video_id?.trim()) throw new Error('Missing required param: video_id');
      if (!reason_id?.trim()) throw new Error('Missing required param: reason_id');
      return (
        await YouTubeAPI.reportVideo(
          credentials,
          video_id.trim(),
          reason_id.trim(),
          secondary_reason_id,
          comments,
        ),
        `Video \`${video_id}\` reported with reason \`${reason_id}\`.`
      );
    }
    case 'youtube_get_disliked_videos': {
      const { max_results: max_results = 20 } = params,
        videos = await YouTubeAPI.getDislikedVideos(credentials, max_results);
      return videos.length
        ? `Your disliked videos (${videos.length}):\n\n${videos.map((v, i) => formatVideo(v, i + 1)).join('\n\n')}`
        : 'No disliked videos found.';
    }
    case 'youtube_update_comment': {
      const { comment_id: comment_id, text: text } = params;
      if (!comment_id?.trim()) throw new Error('Missing required param: comment_id');
      if (!text?.trim()) throw new Error('Missing required param: text');
      return `Comment \`${(await YouTubeAPI.updateComment(credentials, comment_id.trim(), text.trim())).id}\` updated successfully.\nNew text: "${text.slice(0, 100)}"`;
    }
    case 'youtube_get_my_activities': {
      const { max_results: max_results = 20 } = params,
        items = await YouTubeAPI.getMyActivities(credentials, max_results);
      if (!items.length) return 'No activity found on your account.';
      const lines = items.map((item, i) => {
        const sn = item.snippet ?? {},
          cd = item.contentDetails ?? {},
          typeKey = Object.keys(cd)[0] ?? 'unknown',
          resourceId =
            cd[typeKey]?.videoId ?? cd[typeKey]?.playlistId ?? cd[typeKey]?.channelId ?? '';
        return [
          `${i + 1}. **${sn.title ?? typeKey}** (${sn.type ?? typeKey})`,
          resourceId ? `   Resource ID: \`${resourceId}\`` : '',
          sn.publishedAt
            ? `   ${new Date(sn.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`
            : '',
        ]
          .filter(Boolean)
          .join('\n');
      });
      return `Your recent activities (${items.length}):\n\n${lines.join('\n\n')}`;
    }
    case 'youtube_get_channel_activities': {
      const { channel_id: channel_id, max_results: max_results = 20 } = params;
      if (!channel_id?.trim()) throw new Error('Missing required param: channel_id');
      const items = await YouTubeAPI.getChannelActivities(
        credentials,
        channel_id.trim(),
        max_results,
      );
      if (!items.length) return `No public activity found for channel \`${channel_id}\`.`;
      const lines = items.map((item, i) => {
        const sn = item.snippet ?? {},
          cd = item.contentDetails ?? {},
          typeKey = Object.keys(cd)[0] ?? 'unknown',
          resourceId = cd[typeKey]?.videoId ?? cd[typeKey]?.playlistId ?? '';
        return [
          `${i + 1}. **${sn.title ?? typeKey}** (${sn.type ?? typeKey})`,
          resourceId ? `   Resource ID: \`${resourceId}\`` : '',
          sn.publishedAt
            ? `   ${new Date(sn.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`
            : '',
        ]
          .filter(Boolean)
          .join('\n');
      });
      return `Channel \`${channel_id}\` activities (${items.length}):\n\n${lines.join('\n\n')}`;
    }
    case 'youtube_get_channel_playlists': {
      const { channel_id: channel_id, max_results: max_results = 20 } = params;
      if (!channel_id?.trim()) throw new Error('Missing required param: channel_id');
      const playlists = await YouTubeAPI.getChannelPlaylists(
        credentials,
        channel_id.trim(),
        max_results,
      );
      if (!playlists.length) return `No public playlists found for channel \`${channel_id}\`.`;
      const lines = playlists.map((pl, i) => {
        const sn = pl.snippet ?? {},
          count = pl.contentDetails?.itemCount ?? 0;
        return `${i + 1}. **${sn.title ?? '(Untitled)'}** — ${count} video${1 !== count ? 's' : ''}\n   ID: \`${pl.id}\`${sn.description ? `\n   ${sn.description.slice(0, 80)}` : ''}`;
      });
      return `Playlists for \`${channel_id}\` (${playlists.length}):\n\n${lines.join('\n\n')}`;
    }
    case 'youtube_get_video_captions': {
      const { video_id: video_id } = params;
      if (!video_id?.trim()) throw new Error('Missing required param: video_id');
      const captions = await YouTubeAPI.getVideoCaptions(credentials, video_id.trim());
      if (!captions.length) return `No caption tracks found for video \`${video_id}\`.`;
      const lines = captions.map((c, i) => {
        const sn = c.snippet ?? {},
          flags = [
            sn.isAutoSynced ? 'auto-synced' : null,
            sn.isCC ? 'CC' : null,
            sn.isDraft ? 'draft' : null,
            sn.isEasyReader ? 'easy-reader' : null,
            sn.isLarge ? 'large-text' : null,
          ].filter(Boolean);
        return `${i + 1}. **${sn.name || sn.language || '(unnamed)'}**\n   Language: \`${sn.language ?? 'unknown'}\`\n   Track kind: ${sn.trackKind ?? 'unknown'}${flags.length ? `\n   Flags: ${flags.join(', ')}` : ''}\n   Caption ID: \`${c.id}\``;
      });
      return `Caption tracks for \`${video_id}\` (${captions.length}):\n\n${lines.join('\n\n')}`;
    }
    case 'youtube_search_live_videos': {
      const { query: query, max_results: max_results = 10 } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      const items = await YouTubeAPI.searchLiveVideos(credentials, query.trim(), max_results);
      if (!items.length) return `No live streams found for "${query}".`;
      const lines = items.map((item, i) => {
        const sn = item.snippet ?? {},
          videoId = item.id?.videoId ?? '';
        return [
          `${i + 1}. **${sn.title ?? '(No title)'}** 🔴 LIVE`,
          `   Channel: ${sn.channelTitle ?? 'unknown'}`,
          videoId ? `   ID: \`${videoId}\`` : '',
          sn.description ? `   ${sn.description.slice(0, 100)}...` : '',
        ]
          .filter(Boolean)
          .join('\n');
      });
      return `Live streams for "${query}" (${items.length}):\n\n${lines.join('\n\n')}`;
    }
    case 'youtube_get_video_abuse_report_reasons': {
      const reasons = await YouTubeAPI.getVideoAbuseReportReasons(credentials);
      return reasons.length
        ? `YouTube abuse report reasons:\n\n${reasons
            .map((r) => {
              const sn = r.snippet ?? {},
                secondary = sn.secondaryReasons?.length
                  ? `\n   Secondary reasons:\n${sn.secondaryReasons.map((s) => `     · \`${s.id}\` — ${s.label}`).join('\n')}`
                  : '';
              return `**\`${r.id}\`** — ${sn.label ?? '(unknown)'}${secondary}`;
            })
            .join('\n\n')}`
        : 'No abuse report reasons found.';
    }
    case 'youtube_get_i18n_languages': {
      const langs = await YouTubeAPI.getI18nLanguages(credentials);
      if (!langs.length) return 'No languages found.';
      const lines = langs.map(
        (l) => `\`${l.snippet?.hl ?? l.id}\` — ${l.snippet?.name ?? '(unknown)'}`,
      );
      return `YouTube supported languages (${langs.length}):\n\n${lines.join('\n')}`;
    }
    case 'youtube_get_i18n_regions': {
      const regions = await YouTubeAPI.getI18nRegions(credentials);
      if (!regions.length) return 'No regions found.';
      const lines = regions.map(
        (r) => `\`${r.snippet?.gl ?? r.id}\` — ${r.snippet?.name ?? '(unknown)'}`,
      );
      return `YouTube supported regions (${regions.length}):\n\n${lines.join('\n')}`;
    }
    case 'youtube_get_videos_batch': {
      const { video_ids: video_ids } = params;
      if (!Array.isArray(video_ids) || !video_ids.length)
        throw new Error('Missing required param: video_ids (array)');
      const videos = await YouTubeAPI.getVideosBatch(credentials, video_ids);
      return videos.length
        ? `Batch video details (${videos.length}):\n\n${videos.map((v, i) => formatVideo(v, i + 1)).join('\n\n')}`
        : 'No videos found for the provided IDs.';
    }
    case 'youtube_get_channel_sections': {
      const { channel_id: channel_id } = params;
      if (!channel_id?.trim()) throw new Error('Missing required param: channel_id');
      const sections = await YouTubeAPI.getChannelSections(credentials, channel_id.trim());
      if (!sections.length) return `No channel sections found for \`${channel_id}\`.`;
      const lines = sections.map((s, i) => {
        const sn = s.snippet ?? {},
          cd = s.contentDetails ?? {},
          playlists = cd.playlists ?? [],
          channels = cd.channels ?? [];
        return [
          `${i + 1}. **${sn.title || sn.type || '(unnamed)'}**`,
          `   Style: ${sn.style ?? 'unknown'} · Type: ${sn.type ?? 'unknown'}`,
          `   Position: ${sn.position ?? 'unknown'}`,
          playlists.length ? `   Playlists: ${playlists.map((p) => `\`${p}\``).join(', ')}` : '',
          channels.length ? `   Channels: ${channels.map((c) => `\`${c}\``).join(', ')}` : '',
        ]
          .filter(Boolean)
          .join('\n');
      });
      return `Channel sections for \`${channel_id}\` (${sections.length}):\n\n${lines.join('\n\n')}`;
    }
    case 'youtube_get_comment_by_id': {
      const { comment_id: comment_id } = params;
      if (!comment_id?.trim()) throw new Error('Missing required param: comment_id');
      const comment = await YouTubeAPI.getCommentById(credentials, comment_id.trim());
      if (!comment) return `No comment found with ID \`${comment_id}\`.`;
      const sn = comment.snippet ?? {};
      return [
        `**${sn.authorDisplayName ?? 'Anonymous'}**`,
        `Comment ID: \`${comment.id}\``,
        `Text: ${sn.textDisplay?.replace(/<[^>]*>/g, '') ?? '(empty)'}`,
        `👍 Likes: ${YouTubeAPI.formatCount(sn.likeCount)}`,
        sn.publishedAt
          ? `Posted: ${new Date(sn.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`
          : '',
        sn.updatedAt && sn.updatedAt !== sn.publishedAt
          ? `Edited: ${new Date(sn.updatedAt).toLocaleDateString()}`
          : '',
        sn.videoId ? `Video ID: \`${sn.videoId}\`` : '',
        sn.parentId ? `Reply to: \`${sn.parentId}\`` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'youtube_get_channel_branding': {
      const { channel_id: channel_id } = params;
      if (!channel_id?.trim()) throw new Error('Missing required param: channel_id');
      const channel = await YouTubeAPI.getChannelBranding(credentials, channel_id.trim());
      if (!channel) return `No channel found with ID \`${channel_id}\`.`;
      const sn = channel.snippet ?? {},
        branding = channel.brandingSettings ?? {},
        ch = branding.channel ?? {},
        img = branding.image ?? {};
      return [
        `**${sn.title ?? 'Unknown Channel'}** — Branding`,
        '',
        ch.keywords ? `Keywords: ${ch.keywords}` : '',
        ch.description ? `Description: ${ch.description.slice(0, 200)}` : '',
        ch.country ? `Country: ${ch.country}` : '',
        ch.defaultLanguage ? `Default language: ${ch.defaultLanguage}` : '',
        ch.profileColor ? `Profile color: ${ch.profileColor}` : '',
        ch.unsubscribedTrailer ? `Trailer video ID: \`${ch.unsubscribedTrailer}\`` : '',
        img.bannerExternalUrl ? `Banner URL: ${img.bannerExternalUrl}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'youtube_get_playlist_by_id': {
      const { playlist_id: playlist_id } = params;
      if (!playlist_id?.trim()) throw new Error('Missing required param: playlist_id');
      const pl = await YouTubeAPI.getPlaylistById(credentials, playlist_id.trim());
      if (!pl) return `No playlist found with ID \`${playlist_id}\`.`;
      const sn = pl.snippet ?? {},
        count = pl.contentDetails?.itemCount ?? 0;
      return [
        `**${sn.title ?? '(Untitled)'}**`,
        sn.description ? sn.description.slice(0, 200) : '',
        '',
        `Playlist ID: \`${pl.id}\``,
        `Channel: ${sn.channelTitle ?? 'unknown'}`,
        `Videos: ${count}`,
        `Privacy: ${pl.status?.privacyStatus ?? 'unknown'}`,
        sn.publishedAt
          ? `Created: ${new Date(sn.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`
          : '',
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'youtube_get_video_tags': {
      const { video_id: video_id } = params;
      if (!video_id?.trim()) throw new Error('Missing required param: video_id');
      const tags = await YouTubeAPI.getVideoTags(credentials, video_id.trim());
      return tags.length
        ? `Tags for \`${video_id}\` (${tags.length}):\n\n${tags.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
        : `No tags found for video \`${video_id}\`.`;
    }
    case 'youtube_get_comment_threads_by_channel': {
      const { channel_id: channel_id, max_results: max_results = 20 } = params;
      if (!channel_id?.trim()) throw new Error('Missing required param: channel_id');
      const threads = await YouTubeAPI.getCommentThreadsByChannel(
        credentials,
        channel_id.trim(),
        max_results,
      );
      if (!threads.length) return `No comment threads found for channel \`${channel_id}\`.`;
      const lines = threads.map((thread, i) => {
        const top = thread.snippet?.topLevelComment?.snippet ?? {},
          replyCount = thread.snippet?.totalReplyCount ?? 0,
          videoId = thread.snippet?.videoId ?? '';
        return [
          `${i + 1}. **${top.authorDisplayName ?? 'Anonymous'}**${videoId ? ` on \`${videoId}\`` : ''}`,
          `   ${top.textDisplay?.replace(/<[^>]*>/g, '').slice(0, 200) ?? ''}`,
          `   👍 ${YouTubeAPI.formatCount(top.likeCount)}${replyCount ? ` · ${replyCount} repl${1 !== replyCount ? 'ies' : 'y'}` : ''}`,
        ].join('\n');
      });
      return `Recent comment threads on channel \`${channel_id}\` (${threads.length}):\n\n${lines.join('\n\n')}`;
    }
    case 'youtube_search_videos_advanced': {
      const {
        query: query,
        max_results: max_results = 10,
        order: order = 'relevance',
        video_duration: video_duration = 'any',
        video_definition: video_definition = 'any',
        published_after: published_after = null,
        published_before: published_before = null,
        region_code: region_code = null,
        relevance_language: relevance_language = null,
      } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      const items = await YouTubeAPI.searchVideosAdvanced(credentials, query.trim(), {
        maxResults: max_results,
        order: order,
        videoDuration: video_duration,
        videoDefinition: video_definition,
        publishedAfter: published_after,
        publishedBefore: published_before,
        regionCode: region_code,
        relevanceLanguage: relevance_language,
      });
      if (!items.length) return `No videos found for "${query}" with the applied filters.`;
      const activeFilters = [
          'any' !== video_duration ? `duration: ${video_duration}` : null,
          'any' !== video_definition ? `definition: ${video_definition}` : null,
          published_after ? `after: ${published_after}` : null,
          published_before ? `before: ${published_before}` : null,
          region_code ? `region: ${region_code}` : null,
          relevance_language ? `language: ${relevance_language}` : null,
        ].filter(Boolean),
        filterNote = activeFilters.length ? ` [${activeFilters.join(' · ')}]` : '',
        videoIds = items.map((item) => item.id?.videoId).filter(Boolean),
        detailed = videoIds.length ? await YouTubeAPI.getVideosBatch(credentials, videoIds) : items,
        map = Object.fromEntries(detailed.map((v) => [v.id, v])),
        lines = items.map((item, i) => {
          const full = map[item.id?.videoId] ?? item;
          return formatVideo(
            full.id ? full : { ...full, id: { videoId: item.id?.videoId } },
            i + 1,
          );
        });
      return `Advanced search "${query}"${filterNote} — ${items.length} result${1 !== items.length ? 's' : ''}:\n\n${lines.join('\n\n')}`;
    }
    case 'youtube_get_video_statistics': {
      const { video_id: video_id } = params;
      if (!video_id?.trim()) throw new Error('Missing required param: video_id');
      const stats = await YouTubeAPI.getVideoStatistics(credentials, video_id.trim());
      return stats
        ? [
            `Statistics for \`${video_id}\`:`,
            `👁  Views:    ${YouTubeAPI.formatCount(stats.viewCount)}`,
            `👍 Likes:    ${YouTubeAPI.formatCount(stats.likeCount)}`,
            `💬 Comments: ${stats.commentCount ? YouTubeAPI.formatCount(stats.commentCount) : 'disabled'}`,
            stats.favoriteCount
              ? `⭐ Favorites: ${YouTubeAPI.formatCount(stats.favoriteCount)}`
              : '',
          ]
            .filter(Boolean)
            .join('\n')
        : `No statistics found for video \`${video_id}\`.`;
    }
    case 'youtube_get_channel_statistics': {
      const { channel_id: channel_id } = params;
      if (!channel_id?.trim()) throw new Error('Missing required param: channel_id');
      const stats = await YouTubeAPI.getChannelStatistics(credentials, channel_id.trim());
      return stats
        ? [
            `Statistics for \`${channel_id}\`:`,
            `👥 Subscribers: ${stats.hiddenSubscriberCount ? 'Hidden' : YouTubeAPI.formatCount(stats.subscriberCount)}`,
            `👁  Total Views: ${YouTubeAPI.formatCount(stats.viewCount)}`,
            `🎬 Videos:      ${YouTubeAPI.formatCount(stats.videoCount)}`,
          ].join('\n')
        : `No statistics found for channel \`${channel_id}\`.`;
    }
    default:
      throw new Error(`Unknown YouTube tool: ${toolName}`);
  }
}
