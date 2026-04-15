import * as SpotifyAPI from '../API/SpotifyAPI.js';
import { getSpotifyCredentials, notConnected } from '../Shared/Common.js';

export async function executeSpotifyChatTool(ctx, toolName, params) {
  const creds = getSpotifyCredentials(ctx);
  if (!creds) return notConnected();

  try {
    const { getFreshCreds } = await import('../../SpotifyWorkspace.js');
    const freshCreds = await getFreshCreds(creds);

    // ─── Existing tools ────────────────────────────────────────────────────────

    if (toolName === 'spotify_now_playing') {
      const nowPlaying = await SpotifyAPI.getCurrentlyPlaying(freshCreds);
      return { ok: true, nowPlaying };
    }

    if (toolName === 'spotify_top_tracks') {
      const tracks = await SpotifyAPI.getTopTracks(freshCreds, 10);
      return { ok: true, tracks };
    }

    if (toolName === 'spotify_list_playlists') {
      const playlists = await SpotifyAPI.listPlaylists(freshCreds, 20);
      return { ok: true, playlists };
    }

    // ─── Tool 1: Top Artists ───────────────────────────────────────────────────

    if (toolName === 'spotify_top_artists') {
      const limit = params?.limit ?? 10;
      const timeRange = params?.timeRange ?? 'short_term';
      const artists = await SpotifyAPI.getTopArtistsFull(freshCreds, limit, timeRange);
      return { ok: true, artists, timeRange };
    }

    // ─── Tool 2: Recently Played ───────────────────────────────────────────────

    if (toolName === 'spotify_recently_played') {
      const limit = params?.limit ?? 20;
      const tracks = await SpotifyAPI.getRecentlyPlayed(freshCreds, limit);
      return { ok: true, tracks };
    }

    // ─── Tool 3: Saved Tracks ─────────────────────────────────────────────────

    if (toolName === 'spotify_saved_tracks') {
      const limit = params?.limit ?? 20;
      const offset = params?.offset ?? 0;
      const result = await SpotifyAPI.getSavedTracks(freshCreds, limit, offset);
      return { ok: true, ...result };
    }

    // ─── Tool 4: Saved Albums ─────────────────────────────────────────────────

    if (toolName === 'spotify_saved_albums') {
      const limit = params?.limit ?? 20;
      const offset = params?.offset ?? 0;
      const result = await SpotifyAPI.getSavedAlbums(freshCreds, limit, offset);
      return { ok: true, ...result };
    }

    // ─── Tool 5: Followed Artists ─────────────────────────────────────────────

    if (toolName === 'spotify_followed_artists') {
      const limit = params?.limit ?? 20;
      const artists = await SpotifyAPI.getFollowedArtists(freshCreds, limit);
      return { ok: true, artists };
    }

    // ─── Tool 6: Playlist Tracks ──────────────────────────────────────────────

    if (toolName === 'spotify_playlist_tracks') {
      if (!params?.playlistId) {
        return {
          ok: false,
          error: 'playlistId is required. Use spotify_list_playlists to find playlist IDs.',
        };
      }
      const limit = params?.limit ?? 50;
      const result = await SpotifyAPI.getPlaylistTracks(freshCreds, params.playlistId, limit);
      return { ok: true, ...result };
    }

    // ─── Tool 7: Search ───────────────────────────────────────────────────────

    if (toolName === 'spotify_search') {
      if (!params?.query) {
        return { ok: false, error: 'query is required for spotify_search.' };
      }
      const types = params?.types ?? ['track', 'artist', 'album', 'playlist'];
      const limit = params?.limit ?? 5;
      const results = await SpotifyAPI.search(freshCreds, params.query, types, limit);
      return { ok: true, query: params.query, results };
    }

    // ─── Tool 8: Get Artist ───────────────────────────────────────────────────

    if (toolName === 'spotify_get_artist') {
      if (!params?.artistId) {
        return { ok: false, error: 'artistId is required for spotify_get_artist.' };
      }
      const artist = await SpotifyAPI.getArtist(freshCreds, params.artistId);
      return { ok: true, artist };
    }

    // ─── Tool 9: Get Album ────────────────────────────────────────────────────

    if (toolName === 'spotify_get_album') {
      if (!params?.albumId) {
        return { ok: false, error: 'albumId is required for spotify_get_album.' };
      }
      const album = await SpotifyAPI.getAlbum(freshCreds, params.albumId);
      return { ok: true, album };
    }

    // ─── Tool 10: Get Track ───────────────────────────────────────────────────

    if (toolName === 'spotify_get_track') {
      if (!params?.trackId) {
        return { ok: false, error: 'trackId is required for spotify_get_track.' };
      }
      const track = await SpotifyAPI.getTrack(freshCreds, params.trackId);
      return { ok: true, track };
    }

    // ─── Tool 11: Recommendations ─────────────────────────────────────────────

    if (toolName === 'spotify_recommendations') {
      const seedTracks = params?.seedTracks ?? [];
      const seedArtists = params?.seedArtists ?? [];
      const seedGenres = params?.seedGenres ?? [];
      const totalSeeds = seedTracks.length + seedArtists.length + seedGenres.length;
      if (totalSeeds === 0) {
        return {
          ok: false,
          error:
            'At least one seed is required: seedTracks, seedArtists, or seedGenres. Use spotify_top_tracks or spotify_search to find IDs.',
        };
      }
      const limit = params?.limit ?? 10;
      const tracks = await SpotifyAPI.getRecommendations(freshCreds, {
        seedTracks,
        seedArtists,
        seedGenres,
        limit,
      });
      return { ok: true, tracks };
    }

    // ─── Tool 12: New Releases ────────────────────────────────────────────────

    if (toolName === 'spotify_new_releases') {
      const limit = params?.limit ?? 10;
      const releases = await SpotifyAPI.getNewReleases(freshCreds, limit);
      return { ok: true, releases };
    }

    // ─── Tool 13: Featured Playlists ──────────────────────────────────────────

    if (toolName === 'spotify_featured_playlists') {
      const limit = params?.limit ?? 10;
      const result = await SpotifyAPI.getFeaturedPlaylists(freshCreds, limit);
      return { ok: true, ...result };
    }

    // ─── Tool 14: Browse Categories ───────────────────────────────────────────

    if (toolName === 'spotify_browse_categories') {
      const limit = params?.limit ?? 20;
      const categories = await SpotifyAPI.getBrowseCategories(freshCreds, limit);
      return { ok: true, categories };
    }

    // ─── Tool 15: Artist Top Tracks ───────────────────────────────────────────

    if (toolName === 'spotify_artist_top_tracks') {
      if (!params?.artistId) {
        return { ok: false, error: 'artistId is required for spotify_artist_top_tracks.' };
      }
      const market = params?.market ?? 'US';
      const tracks = await SpotifyAPI.getArtistTopTracks(freshCreds, params.artistId, market);
      return { ok: true, tracks };
    }

    // ─── Tool 16: Artist Albums ───────────────────────────────────────────────

    if (toolName === 'spotify_artist_albums') {
      if (!params?.artistId) {
        return { ok: false, error: 'artistId is required for spotify_artist_albums.' };
      }
      const limit = params?.limit ?? 10;
      const albums = await SpotifyAPI.getArtistAlbums(freshCreds, params.artistId, limit);
      return { ok: true, albums };
    }

    // ─── Tool 17: Related Artists ─────────────────────────────────────────────

    if (toolName === 'spotify_related_artists') {
      if (!params?.artistId) {
        return { ok: false, error: 'artistId is required for spotify_related_artists.' };
      }
      const artists = await SpotifyAPI.getRelatedArtists(freshCreds, params.artistId);
      return { ok: true, artists };
    }

    // ─── Tool 18: Audio Features ──────────────────────────────────────────────

    if (toolName === 'spotify_audio_features') {
      if (!params?.trackId) {
        return { ok: false, error: 'trackId is required for spotify_audio_features.' };
      }
      const features = await SpotifyAPI.getAudioFeatures(freshCreds, params.trackId);
      return { ok: true, features };
    }

    // ─── Tool 19: Playback State ──────────────────────────────────────────────

    if (toolName === 'spotify_playback_state') {
      const state = await SpotifyAPI.getPlaybackState(freshCreds);
      return { ok: true, state };
    }

    // ─── Tool 20: Queue ───────────────────────────────────────────────────────

    if (toolName === 'spotify_queue') {
      const queue = await SpotifyAPI.getQueue(freshCreds);
      return { ok: true, ...queue };
    }

    // ─── Tool 21: Devices ─────────────────────────────────────────────────────

    if (toolName === 'spotify_devices') {
      const devices = await SpotifyAPI.getDevices(freshCreds);
      return { ok: true, devices };
    }

    // ─── Tool 22: Album Tracks ────────────────────────────────────────────────

    if (toolName === 'spotify_album_tracks') {
      if (!params?.albumId) {
        return { ok: false, error: 'albumId is required for spotify_album_tracks.' };
      }
      const limit = params?.limit ?? 50;
      const result = await SpotifyAPI.getAlbumTracks(freshCreds, params.albumId, limit);
      return { ok: true, ...result };
    }

    // ─── Tool 23: Check Saved Tracks ─────────────────────────────────────────

    if (toolName === 'spotify_check_saved_tracks') {
      if (!params?.trackIds?.length) {
        return { ok: false, error: 'trackIds array is required for spotify_check_saved_tracks.' };
      }
      const results = await SpotifyAPI.checkSavedTracks(freshCreds, params.trackIds);
      return { ok: true, results };
    }

    // ─── Tool 24: User Profile ────────────────────────────────────────────────

    if (toolName === 'spotify_user_profile') {
      if (!params?.userId) {
        return { ok: false, error: 'userId is required for spotify_user_profile.' };
      }
      const profile = await SpotifyAPI.getUserProfile(freshCreds, params.userId);
      return { ok: true, profile };
    }

    // ─── Tool 25: Get Episode ─────────────────────────────────────────────────

    if (toolName === 'spotify_get_episode') {
      if (!params?.episodeId) {
        return { ok: false, error: 'episodeId is required for spotify_get_episode.' };
      }
      const episode = await SpotifyAPI.getEpisode(freshCreds, params.episodeId);
      return { ok: true, episode };
    }

    // ─── Tool 26: Get Show ────────────────────────────────────────────────────

    if (toolName === 'spotify_get_show') {
      if (!params?.showId) {
        return { ok: false, error: 'showId is required for spotify_get_show.' };
      }
      const show = await SpotifyAPI.getShow(freshCreds, params.showId);
      return { ok: true, show };
    }

    // ─── Tool 27: Saved Shows ─────────────────────────────────────────────────

    if (toolName === 'spotify_saved_shows') {
      const limit = params?.limit ?? 20;
      const result = await SpotifyAPI.getSavedShows(freshCreds, limit);
      return { ok: true, ...result };
    }

    // ─── Tool 28: Available Genres ────────────────────────────────────────────

    if (toolName === 'spotify_available_genres') {
      const genres = await SpotifyAPI.getAvailableGenreSeeds(freshCreds);
      return { ok: true, genres };
    }

    // ─── Tool 29: Audio Analysis ──────────────────────────────────────────────

    if (toolName === 'spotify_audio_analysis') {
      if (!params?.trackId) {
        return { ok: false, error: 'trackId is required for spotify_audio_analysis.' };
      }
      const analysis = await SpotifyAPI.getAudioAnalysis(freshCreds, params.trackId);
      return { ok: true, analysis };
    }

    // ─── Tool 30: Category Playlists ─────────────────────────────────────────

    if (toolName === 'spotify_category_playlists') {
      if (!params?.categoryId) {
        return {
          ok: false,
          error:
            'categoryId is required for spotify_category_playlists. Use spotify_browse_categories to find valid IDs.',
        };
      }
      const limit = params?.limit ?? 10;
      const playlists = await SpotifyAPI.getCategoryPlaylists(freshCreds, params.categoryId, limit);
      return { ok: true, playlists, categoryId: params.categoryId };
    }

    // ─── Unknown tool ─────────────────────────────────────────────────────────

    return null;
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
