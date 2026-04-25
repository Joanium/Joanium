import { createGoogleJsonFetch } from '../../../Core/API/GoogleApiFetch.js';

const PHOTOS_BASE = 'https://photoslibrary.googleapis.com/v1';
const photosFetch = createGoogleJsonFetch('Photos');
export async function listAlbums(
  creds,
  { maxResults: maxResults = 20, excludeNonAppCreatedData: excludeNonAppCreatedData = !1 } = {},
) {
  const params = new URLSearchParams({
    pageSize: String(Math.min(maxResults, 50)),
    excludeNonAppCreatedData: String(excludeNonAppCreatedData),
  });
  return (await photosFetch(creds, `${PHOTOS_BASE}/albums?${params}`)).albums ?? [];
}
export async function getAlbum(creds, albumId) {
  return photosFetch(creds, `${PHOTOS_BASE}/albums/${albumId}`);
}
export async function listSharedAlbums(creds, { maxResults: maxResults = 20 } = {}) {
  const params = new URLSearchParams({ pageSize: String(Math.min(maxResults, 50)) });
  return (await photosFetch(creds, `${PHOTOS_BASE}/sharedAlbums?${params}`)).sharedAlbums ?? [];
}
export async function listMediaItems(creds, { maxResults: maxResults = 20 } = {}) {
  const params = new URLSearchParams({ pageSize: String(Math.min(maxResults, 100)) });
  return (await photosFetch(creds, `${PHOTOS_BASE}/mediaItems?${params}`)).mediaItems ?? [];
}
export async function getMediaItem(creds, mediaItemId) {
  return photosFetch(creds, `${PHOTOS_BASE}/mediaItems/${mediaItemId}`);
}
export async function searchMediaItems(
  creds,
  { albumId: albumId, pageSize: pageSize = 20, filters: filters = {} } = {},
) {
  const body = { pageSize: Math.min(pageSize, 100) };
  return (
    albumId && (body.albumId = albumId),
    Object.keys(filters).length && (body.filters = filters),
    (
      await photosFetch(creds, `${PHOTOS_BASE}/mediaItems:search`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    ).mediaItems ?? []
  );
}
export async function searchByDateRange(creds, startDate, endDate, maxResults = 20) {
  const toDateFilter = (dateStr) => {
    const d = new Date(dateStr);
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  };
  return searchMediaItems(creds, {
    pageSize: maxResults,
    filters: {
      dateFilter: {
        ranges: [{ startDate: toDateFilter(startDate), endDate: toDateFilter(endDate) }],
      },
    },
  });
}
export async function searchByContentCategory(creds, categories = [], maxResults = 20) {
  const VALID = [
      'ANIMALS',
      'ARTS',
      'BIRTHDAYS',
      'CITYSCAPES',
      'CRAFTS',
      'DOCUMENTS',
      'FASHION',
      'FLOWERS',
      'FOOD',
      'GARDENS',
      'HOLIDAYS',
      'HOUSES',
      'LANDMARKS',
      'LANDSCAPES',
      'NIGHT',
      'PEOPLE',
      'PERFORMANCES',
      'PETS',
      'RECEIPTS',
      'SCREENSHOTS',
      'SELFIES',
      'SPORT',
      'TRAVEL',
      'UTILITY',
      'WEDDINGS',
      'WHITEBOARDS',
    ],
    valid = categories.map((c) => c.toUpperCase()).filter((c) => VALID.includes(c));
  if (!valid.length) throw new Error(`Invalid categories. Valid options: ${VALID.join(', ')}`);
  return searchMediaItems(creds, {
    pageSize: maxResults,
    filters: { contentFilter: { includedContentCategories: valid } },
  });
}
export async function getAlbumMediaItems(creds, albumId, maxResults = 20) {
  return searchMediaItems(creds, { albumId: albumId, pageSize: maxResults });
}
