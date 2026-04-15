const BASE = 'https://api.spotify.com/v1';

function headers(creds) {
  return { Authorization: `Bearer ${creds.accessToken}`, 'Content-Type': 'application/json' };
}

async function spFetch(path, creds) {
  const res = await fetch(`${BASE}${path}`, { headers: headers(creds) });
  if (res.status === 204) return null;
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message ?? `Spotify API error: ${res.status}`);
  }
  return res.json();
}

// ─── Existing ────────────────────────────────────────────────────────────────

export async function getMe(creds) {
  return spFetch('/me', creds);
}

export async function getCurrentlyPlaying(creds) {
  const data = await spFetch('/me/player/currently-playing', creds);
  if (!data) return null;
  return {
    isPlaying: data.is_playing,
    track: data.item?.name ?? null,
    artist: data.item?.artists?.map((a) => a.name).join(', ') ?? null,
    album: data.item?.album?.name ?? null,
    progressMs: data.progress_ms,
    durationMs: data.item?.duration_ms ?? null,
    albumArt: data.item?.album?.images?.[0]?.url ?? null,
  };
}

export async function getTopTracks(creds, limit = 10, timeRange = 'short_term') {
  const data = await spFetch(`/me/top/tracks?limit=${limit}&time_range=${timeRange}`, creds);
  return (data.items ?? []).map((t, i) => ({
    rank: i + 1,
    name: t.name,
    artist: t.artists?.map((a) => a.name).join(', ') ?? '',
    album: t.album?.name ?? '',
    popularity: t.popularity,
  }));
}

export async function listPlaylists(creds, limit = 20) {
  const data = await spFetch(`/me/playlists?limit=${limit}`, creds);
  return (data.items ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    tracks: p.tracks?.total ?? 0,
    public: p.public,
    description: p.description ?? '',
    owner: p.owner?.display_name ?? '',
  }));
}

export async function getTopArtists(creds, limit = 10) {
  const data = await spFetch(`/me/top/artists?limit=${limit}&time_range=short_term`, creds);
  return (data.items ?? []).map((a, i) => ({
    rank: i + 1,
    name: a.name,
    genres: a.genres?.slice(0, 3) ?? [],
    popularity: a.popularity,
    followers: a.followers?.total ?? 0,
  }));
}

// ─── Tool 1: Top Artists ─────────────────────────────────────────────────────

export async function getTopArtistsFull(creds, limit = 10, timeRange = 'short_term') {
  const data = await spFetch(`/me/top/artists?limit=${limit}&time_range=${timeRange}`, creds);
  return (data.items ?? []).map((a, i) => ({
    rank: i + 1,
    name: a.name,
    genres: a.genres ?? [],
    popularity: a.popularity,
    followers: a.followers?.total ?? 0,
    imageUrl: a.images?.[0]?.url ?? null,
    id: a.id,
  }));
}

// ─── Tool 2: Recently Played ─────────────────────────────────────────────────

export async function getRecentlyPlayed(creds, limit = 20) {
  const data = await spFetch(`/me/player/recently-played?limit=${limit}`, creds);
  return (data.items ?? []).map((item) => ({
    track: item.track?.name ?? null,
    artist: item.track?.artists?.map((a) => a.name).join(', ') ?? null,
    album: item.track?.album?.name ?? null,
    playedAt: item.played_at,
    trackId: item.track?.id ?? null,
  }));
}

// ─── Tool 3: Saved Tracks (Liked Songs) ──────────────────────────────────────

export async function getSavedTracks(creds, limit = 20, offset = 0) {
  const data = await spFetch(`/me/tracks?limit=${limit}&offset=${offset}`, creds);
  return {
    total: data.total ?? 0,
    items: (data.items ?? []).map((item) => ({
      name: item.track?.name ?? null,
      artist: item.track?.artists?.map((a) => a.name).join(', ') ?? null,
      album: item.track?.album?.name ?? null,
      addedAt: item.added_at,
      trackId: item.track?.id ?? null,
      durationMs: item.track?.duration_ms ?? null,
    })),
  };
}

// ─── Tool 4: Saved Albums ─────────────────────────────────────────────────────

export async function getSavedAlbums(creds, limit = 20, offset = 0) {
  const data = await spFetch(`/me/albums?limit=${limit}&offset=${offset}`, creds);
  return {
    total: data.total ?? 0,
    items: (data.items ?? []).map((item) => ({
      name: item.album?.name ?? null,
      artist: item.album?.artists?.map((a) => a.name).join(', ') ?? null,
      releaseDate: item.album?.release_date ?? null,
      totalTracks: item.album?.total_tracks ?? null,
      addedAt: item.added_at,
      albumId: item.album?.id ?? null,
      imageUrl: item.album?.images?.[0]?.url ?? null,
    })),
  };
}

// ─── Tool 5: Followed Artists ────────────────────────────────────────────────

export async function getFollowedArtists(creds, limit = 20) {
  const data = await spFetch(`/me/following?type=artist&limit=${limit}`, creds);
  return (data.artists?.items ?? []).map((a) => ({
    name: a.name,
    genres: a.genres ?? [],
    popularity: a.popularity,
    followers: a.followers?.total ?? 0,
    artistId: a.id,
    imageUrl: a.images?.[0]?.url ?? null,
  }));
}

// ─── Tool 6: Playlist Tracks ─────────────────────────────────────────────────

export async function getPlaylistTracks(creds, playlistId, limit = 50) {
  const data = await spFetch(`/playlists/${playlistId}/tracks?limit=${limit}`, creds);
  return {
    total: data.total ?? 0,
    items: (data.items ?? []).map((item, i) => ({
      position: i + 1,
      name: item.track?.name ?? null,
      artist: item.track?.artists?.map((a) => a.name).join(', ') ?? null,
      album: item.track?.album?.name ?? null,
      addedBy: item.added_by?.id ?? null,
      addedAt: item.added_at,
      durationMs: item.track?.duration_ms ?? null,
      trackId: item.track?.id ?? null,
    })),
  };
}

// ─── Tool 7: Search ──────────────────────────────────────────────────────────

export async function search(creds, query, types = ['track', 'artist', 'album'], limit = 5) {
  const typeStr = types.join(',');
  const data = await spFetch(
    `/search?q=${encodeURIComponent(query)}&type=${typeStr}&limit=${limit}`,
    creds,
  );
  const results = {};
  if (data.tracks) {
    results.tracks = data.tracks.items.map((t) => ({
      name: t.name,
      artist: t.artists?.map((a) => a.name).join(', '),
      album: t.album?.name,
      popularity: t.popularity,
      trackId: t.id,
    }));
  }
  if (data.artists) {
    results.artists = data.artists.items.map((a) => ({
      name: a.name,
      genres: a.genres?.slice(0, 3) ?? [],
      popularity: a.popularity,
      followers: a.followers?.total ?? 0,
      artistId: a.id,
    }));
  }
  if (data.albums) {
    results.albums = data.albums.items.map((al) => ({
      name: al.name,
      artist: al.artists?.map((a) => a.name).join(', '),
      releaseDate: al.release_date,
      totalTracks: al.total_tracks,
      albumId: al.id,
    }));
  }
  if (data.playlists) {
    results.playlists = data.playlists.items.map((p) => ({
      name: p.name,
      description: p.description,
      owner: p.owner?.display_name,
      totalTracks: p.tracks?.total ?? 0,
      playlistId: p.id,
    }));
  }
  return results;
}

// ─── Tool 8: Get Artist ───────────────────────────────────────────────────────

export async function getArtist(creds, artistId) {
  const a = await spFetch(`/artists/${artistId}`, creds);
  return {
    name: a.name,
    genres: a.genres ?? [],
    popularity: a.popularity,
    followers: a.followers?.total ?? 0,
    imageUrl: a.images?.[0]?.url ?? null,
    artistId: a.id,
  };
}

// ─── Tool 9: Get Album ────────────────────────────────────────────────────────

export async function getAlbum(creds, albumId) {
  const al = await spFetch(`/albums/${albumId}`, creds);
  return {
    name: al.name,
    artist: al.artists?.map((a) => a.name).join(', ') ?? '',
    releaseDate: al.release_date,
    totalTracks: al.total_tracks,
    label: al.label ?? null,
    popularity: al.popularity,
    genres: al.genres ?? [],
    imageUrl: al.images?.[0]?.url ?? null,
    tracks: (al.tracks?.items ?? []).map((t, i) => ({
      position: i + 1,
      name: t.name,
      durationMs: t.duration_ms,
      trackId: t.id,
    })),
  };
}

// ─── Tool 10: Get Track ───────────────────────────────────────────────────────

export async function getTrack(creds, trackId) {
  const t = await spFetch(`/tracks/${trackId}`, creds);
  return {
    name: t.name,
    artist: t.artists?.map((a) => a.name).join(', ') ?? '',
    album: t.album?.name ?? null,
    releaseDate: t.album?.release_date ?? null,
    durationMs: t.duration_ms,
    popularity: t.popularity,
    explicit: t.explicit,
    trackId: t.id,
    previewUrl: t.preview_url ?? null,
  };
}

// ─── Tool 11: Recommendations ────────────────────────────────────────────────

export async function getRecommendations(
  creds,
  { seedTracks = [], seedArtists = [], seedGenres = [], limit = 10 } = {},
) {
  const params = new URLSearchParams({ limit });
  if (seedTracks.length) params.set('seed_tracks', seedTracks.slice(0, 5).join(','));
  if (seedArtists.length) params.set('seed_artists', seedArtists.slice(0, 5).join(','));
  if (seedGenres.length) params.set('seed_genres', seedGenres.slice(0, 5).join(','));
  const data = await spFetch(`/recommendations?${params}`, creds);
  return (data.tracks ?? []).map((t) => ({
    name: t.name,
    artist: t.artists?.map((a) => a.name).join(', ') ?? '',
    album: t.album?.name ?? null,
    popularity: t.popularity,
    trackId: t.id,
    previewUrl: t.preview_url ?? null,
  }));
}

// ─── Tool 12: New Releases ────────────────────────────────────────────────────

export async function getNewReleases(creds, limit = 10) {
  const data = await spFetch(`/browse/new-releases?limit=${limit}`, creds);
  return (data.albums?.items ?? []).map((al) => ({
    name: al.name,
    artist: al.artists?.map((a) => a.name).join(', ') ?? '',
    releaseDate: al.release_date,
    totalTracks: al.total_tracks,
    albumType: al.album_type,
    albumId: al.id,
    imageUrl: al.images?.[0]?.url ?? null,
  }));
}

// ─── Tool 13: Featured Playlists ─────────────────────────────────────────────

export async function getFeaturedPlaylists(creds, limit = 10) {
  const data = await spFetch(`/browse/featured-playlists?limit=${limit}`, creds);
  return {
    message: data.message ?? null,
    playlists: (data.playlists?.items ?? []).map((p) => ({
      name: p.name,
      description: p.description ?? '',
      owner: p.owner?.display_name ?? '',
      totalTracks: p.tracks?.total ?? 0,
      playlistId: p.id,
      imageUrl: p.images?.[0]?.url ?? null,
    })),
  };
}

// ─── Tool 14: Browse Categories ──────────────────────────────────────────────

export async function getBrowseCategories(creds, limit = 20) {
  const data = await spFetch(`/browse/categories?limit=${limit}`, creds);
  return (data.categories?.items ?? []).map((c) => ({
    name: c.name,
    categoryId: c.id,
    iconUrl: c.icons?.[0]?.url ?? null,
  }));
}

// ─── Tool 15: Artist Top Tracks ───────────────────────────────────────────────

export async function getArtistTopTracks(creds, artistId, market = 'US') {
  const data = await spFetch(`/artists/${artistId}/top-tracks?market=${market}`, creds);
  return (data.tracks ?? []).map((t, i) => ({
    rank: i + 1,
    name: t.name,
    album: t.album?.name ?? null,
    popularity: t.popularity,
    durationMs: t.duration_ms,
    trackId: t.id,
    previewUrl: t.preview_url ?? null,
  }));
}

// ─── Tool 16: Artist Albums ───────────────────────────────────────────────────

export async function getArtistAlbums(creds, artistId, limit = 10) {
  const data = await spFetch(
    `/artists/${artistId}/albums?limit=${limit}&include_groups=album,single`,
    creds,
  );
  return (data.items ?? []).map((al) => ({
    name: al.name,
    albumType: al.album_type,
    releaseDate: al.release_date,
    totalTracks: al.total_tracks,
    albumId: al.id,
    imageUrl: al.images?.[0]?.url ?? null,
  }));
}

// ─── Tool 17: Related Artists ─────────────────────────────────────────────────

export async function getRelatedArtists(creds, artistId) {
  const data = await spFetch(`/artists/${artistId}/related-artists`, creds);
  return (data.artists ?? []).slice(0, 10).map((a) => ({
    name: a.name,
    genres: a.genres?.slice(0, 3) ?? [],
    popularity: a.popularity,
    followers: a.followers?.total ?? 0,
    artistId: a.id,
    imageUrl: a.images?.[0]?.url ?? null,
  }));
}

// ─── Tool 18: Audio Features ──────────────────────────────────────────────────

export async function getAudioFeatures(creds, trackId) {
  const data = await spFetch(`/audio-features/${trackId}`, creds);
  if (!data) return null;
  return {
    trackId: data.id,
    danceability: data.danceability,
    energy: data.energy,
    key: data.key,
    loudness: data.loudness,
    mode: data.mode === 1 ? 'Major' : 'Minor',
    speechiness: data.speechiness,
    acousticness: data.acousticness,
    instrumentalness: data.instrumentalness,
    liveness: data.liveness,
    valence: data.valence,
    tempo: data.tempo,
    timeSignature: data.time_signature,
    durationMs: data.duration_ms,
  };
}

// ─── Tool 19: Playback State ──────────────────────────────────────────────────

export async function getPlaybackState(creds) {
  const data = await spFetch('/me/player', creds);
  if (!data) return null;
  return {
    isPlaying: data.is_playing,
    shuffleState: data.shuffle_state,
    repeatState: data.repeat_state,
    device: {
      name: data.device?.name ?? null,
      type: data.device?.type ?? null,
      volumePercent: data.device?.volume_percent ?? null,
      isActive: data.device?.is_active ?? false,
    },
    track: data.item?.name ?? null,
    artist: data.item?.artists?.map((a) => a.name).join(', ') ?? null,
    album: data.item?.album?.name ?? null,
    progressMs: data.progress_ms,
    durationMs: data.item?.duration_ms ?? null,
    context: data.context?.type ?? null,
  };
}

// ─── Tool 20: Queue ───────────────────────────────────────────────────────────

export async function getQueue(creds) {
  const data = await spFetch('/me/player/queue', creds);
  if (!data) return { currentlyPlaying: null, queue: [] };
  return {
    currentlyPlaying: data.currently_playing
      ? {
          name: data.currently_playing.name,
          artist: data.currently_playing.artists?.map((a) => a.name).join(', ') ?? null,
          album: data.currently_playing.album?.name ?? null,
          trackId: data.currently_playing.id,
        }
      : null,
    queue: (data.queue ?? []).slice(0, 20).map((t, i) => ({
      position: i + 1,
      name: t.name,
      artist: t.artists?.map((a) => a.name).join(', ') ?? null,
      album: t.album?.name ?? null,
      trackId: t.id,
    })),
  };
}

// ─── Tool 21: Available Devices ──────────────────────────────────────────────

export async function getDevices(creds) {
  const data = await spFetch('/me/player/devices', creds);
  return (data?.devices ?? []).map((d) => ({
    name: d.name,
    type: d.type,
    isActive: d.is_active,
    isPrivateSession: d.is_private_session,
    volumePercent: d.volume_percent,
    deviceId: d.id,
  }));
}

// ─── Tool 22: Album Tracks ────────────────────────────────────────────────────

export async function getAlbumTracks(creds, albumId, limit = 50) {
  const data = await spFetch(`/albums/${albumId}/tracks?limit=${limit}`, creds);
  return {
    total: data.total ?? 0,
    items: (data.items ?? []).map((t, i) => ({
      position: i + 1,
      name: t.name,
      artist: t.artists?.map((a) => a.name).join(', ') ?? null,
      durationMs: t.duration_ms,
      explicit: t.explicit,
      trackId: t.id,
      previewUrl: t.preview_url ?? null,
    })),
  };
}

// ─── Tool 23: Check Saved Tracks ─────────────────────────────────────────────

export async function checkSavedTracks(creds, trackIds) {
  const ids = trackIds.slice(0, 50).join(',');
  const data = await spFetch(`/me/tracks/contains?ids=${ids}`, creds);
  return trackIds.slice(0, 50).map((id, i) => ({ trackId: id, isSaved: data[i] ?? false }));
}

// ─── Tool 24: User Public Profile ────────────────────────────────────────────

export async function getUserProfile(creds, userId) {
  const u = await spFetch(`/users/${userId}`, creds);
  return {
    displayName: u.display_name ?? null,
    userId: u.id,
    followers: u.followers?.total ?? 0,
    imageUrl: u.images?.[0]?.url ?? null,
    profileUrl: u.external_urls?.spotify ?? null,
  };
}

// ─── Tool 25: Get Episode ─────────────────────────────────────────────────────

export async function getEpisode(creds, episodeId) {
  const e = await spFetch(`/episodes/${episodeId}`, creds);
  return {
    name: e.name,
    description: e.description ?? null,
    show: e.show?.name ?? null,
    releaseDate: e.release_date,
    durationMs: e.duration_ms,
    explicit: e.explicit,
    language: e.language ?? null,
    episodeId: e.id,
    imageUrl: e.images?.[0]?.url ?? null,
  };
}

// ─── Tool 26: Get Show (Podcast) ─────────────────────────────────────────────

export async function getShow(creds, showId) {
  const s = await spFetch(`/shows/${showId}`, creds);
  return {
    name: s.name,
    publisher: s.publisher ?? null,
    description: s.description ?? null,
    totalEpisodes: s.total_episodes ?? 0,
    languages: s.languages ?? [],
    explicit: s.explicit,
    showId: s.id,
    imageUrl: s.images?.[0]?.url ?? null,
  };
}

// ─── Tool 27: Saved Shows (Podcasts) ─────────────────────────────────────────

export async function getSavedShows(creds, limit = 20) {
  const data = await spFetch(`/me/shows?limit=${limit}`, creds);
  return {
    total: data.total ?? 0,
    items: (data.items ?? []).map((item) => ({
      name: item.show?.name ?? null,
      publisher: item.show?.publisher ?? null,
      totalEpisodes: item.show?.total_episodes ?? 0,
      addedAt: item.added_at,
      showId: item.show?.id ?? null,
      imageUrl: item.show?.images?.[0]?.url ?? null,
    })),
  };
}

// ─── Tool 28: Available Genre Seeds ──────────────────────────────────────────

export async function getAvailableGenreSeeds(creds) {
  const data = await spFetch('/recommendations/available-genre-seeds', creds);
  return data.genres ?? [];
}

// ─── Tool 29: Audio Analysis ──────────────────────────────────────────────────

export async function getAudioAnalysis(creds, trackId) {
  const data = await spFetch(`/audio-analysis/${trackId}`, creds);
  return {
    duration: data.track?.duration ?? null,
    tempo: data.track?.tempo ?? null,
    tempoConfidence: data.track?.tempo_confidence ?? null,
    timeSignature: data.track?.time_signature ?? null,
    key: data.track?.key ?? null,
    mode: data.track?.mode === 1 ? 'Major' : 'Minor',
    loudness: data.track?.loudness ?? null,
    sections: (data.sections ?? []).map((s) => ({
      startSec: s.start,
      durationSec: s.duration,
      loudness: s.loudness,
      tempo: s.tempo,
      key: s.key,
      mode: s.mode === 1 ? 'Major' : 'Minor',
    })),
    numBars: data.bars?.length ?? 0,
    numBeats: data.beats?.length ?? 0,
    numSegments: data.segments?.length ?? 0,
  };
}

// ─── Tool 30: Category Playlists ─────────────────────────────────────────────

export async function getCategoryPlaylists(creds, categoryId, limit = 10) {
  const data = await spFetch(`/browse/categories/${categoryId}/playlists?limit=${limit}`, creds);
  return (data.playlists?.items ?? []).map((p) => ({
    name: p.name,
    description: p.description ?? '',
    owner: p.owner?.display_name ?? '',
    totalTracks: p.tracks?.total ?? 0,
    playlistId: p.id,
    imageUrl: p.images?.[0]?.url ?? null,
  }));
}
