function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}
export function formatMediaItem(item, index) {
  const meta = item.mediaMetadata ?? {},
    photo = meta.photo ?? {},
    video = meta.video ?? {},
    isVideo = Boolean(meta.video);
  return [
    `${index}. **${item.filename ?? '(unnamed)'}** [${isVideo ? 'Video' : 'Photo'}]`,
    `   ID: \`${item.id}\``,
    meta.creationTime ? `   Taken: ${formatDate(meta.creationTime)}` : '',
    meta.width && meta.height ? `   Dimensions: ${meta.width} × ${meta.height}` : '',
    photo.cameraMake ? `   Camera: ${photo.cameraMake} ${photo.cameraModel ?? ''}`.trim() : '',
    isVideo && video.fps ? `   FPS: ${video.fps}` : '',
    item.description ? `   Description: ${item.description.slice(0, 80)}` : '',
    item.productUrl ? `   Link: ${item.productUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
export function formatAlbum(album, index) {
  return [
    `${index}. **${album.title ?? '(Untitled)'}**`,
    `   ID: \`${album.id}\``,
    album.mediaItemsCount ? `   Items: ${album.mediaItemsCount}` : '',
    album.productUrl ? `   Link: ${album.productUrl}` : '',
    album.coverPhotoMediaItemId ? `   Cover photo ID: \`${album.coverPhotoMediaItemId}\`` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
