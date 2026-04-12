import * as ContentLibraryService from './ContentLibraryService.js';
const MARKETPLACE_API_BASE_URL = 'https://www.joanium.com/api/marketplace';
function normalizeMarketplaceType(value) {
  return 'personas' ===
    String(value ?? '')
      .trim()
      .toLowerCase()
    ? 'personas'
    : 'skills';
}
function normalizeMarketplaceFilter(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  return ['verified', 'community'].includes(normalized) ? normalized : 'all';
}
function normalizeMarketplaceSort(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  return 'newest' === normalized
    ? 'newest'
    : 'za' === normalized || 'z-a' === normalized
      ? 'za'
      : 'az';
}
function normalizePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function resolveRelativeUrl(candidate) {
  const raw = String(candidate ?? '').trim();
  if (!raw) return null;
  try {
    return new URL(raw, 'https://www.joanium.com/marketplace').toString();
  } catch {
    return null;
  }
}
function buildExcerpt(value, maxLength = 160) {
  const text = String(value ?? '')
    .replace(/^---[\s\S]*?---\s*/m, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/^#+\s+/gm, '')
    .replace(/[*_>~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length <= maxLength ? text : `${text.slice(0, maxLength).replace(/\s+\S*$/, '')}...`;
}
function buildDetailUrl(type, publisher, filename) {
  return new URL(
    `${MARKETPLACE_API_BASE_URL}/items/${encodeURIComponent(type)}/${encodeURIComponent(publisher)}/${encodeURIComponent(filename)}`,
  ).toString();
}
function buildDownloadUrl(type, publisher, filename) {
  return new URL(
    `${MARKETPLACE_API_BASE_URL}/download/${encodeURIComponent(type)}/${encodeURIComponent(publisher)}/${encodeURIComponent(filename)}`,
  ).toString();
}
function normalizeMarketplaceItem(rawItem, type) {
  if (!rawItem || 'object' != typeof rawItem) return null;
  const publisher = ContentLibraryService.sanitizePublisherName(
      rawItem.publisher ?? ContentLibraryService.OFFICIAL_PUBLISHER,
    ),
    meta = rawItem.meta && 'object' == typeof rawItem.meta ? rawItem.meta : {},
    filename =
      String(rawItem.filename ?? '').trim() ||
      ContentLibraryService.sanitizeMarkdownFileName(
        rawItem.name,
        'personas' === type ? 'Persona' : 'Skill',
      ),
    normalizedFilename = ContentLibraryService.sanitizeMarkdownFileName(
      filename,
      'personas' === type ? 'Persona' : 'Skill',
    ),
    normalizedPublisher = publisher || ContentLibraryService.OFFICIAL_PUBLISHER,
    markdown = 'string' == typeof rawItem.markdown ? rawItem.markdown.trim() : '',
    description = String(rawItem.description ?? rawItem.excerpt ?? '').trim(),
    normalized = {
      id:
        String(rawItem.id ?? '').trim() ||
        ContentLibraryService.buildContentId(type, normalizedPublisher, normalizedFilename),
      type: type,
      name: String(rawItem.name ?? normalizedFilename.replace(/\.md$/i, '')).trim(),
      filename: normalizedFilename,
      publisher: normalizedPublisher,
      isVerified:
        !0 === rawItem.verified || ContentLibraryService.isVerifiedPublisher(normalizedPublisher),
      verified:
        !0 === rawItem.verified || ContentLibraryService.isVerifiedPublisher(normalizedPublisher),
      description: description,
      excerpt: String(rawItem.excerpt ?? '').trim(),
      markdown: markdown,
      rawUrl: resolveRelativeUrl(rawItem.rawUrl),
      downloadUrl: buildDownloadUrl(type, normalizedPublisher, normalizedFilename),
      detailUrl: buildDetailUrl(type, normalizedPublisher, normalizedFilename),
      githubUrl: resolveRelativeUrl(rawItem.githubUrl),
      repositoryUrl: resolveRelativeUrl(rawItem.githubUrl),
      sha: String(rawItem.sha ?? '').trim() || null,
      downloads: Number(rawItem.downloads ?? 0) || 0,
      stars: Number(rawItem.stars ?? 0) || 0,
      updatedAt: rawItem.updatedAt ?? null,
      createdAt: rawItem.createdAt ?? null,
      marketplaceOrigin: 'https://www.joanium.com/marketplace',
      marketplaceApiBase: MARKETPLACE_API_BASE_URL,
    };
  return (
    'personas' === type
      ? (normalized.personality = String(meta.personality ?? rawItem.personality ?? '').trim())
      : (normalized.trigger = String(meta.trigger ?? rawItem.trigger ?? '').trim()),
    normalized.description || (normalized.description = buildExcerpt(normalized.markdown)),
    normalized.excerpt ||
      (normalized.excerpt = normalized.description || buildExcerpt(normalized.markdown)),
    normalized
  );
}
async function fetchJson(url, { timeoutMs: timeoutMs = 8e3 } = {}) {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json, text/plain;q=0.9, */*;q=0.8' },
      }),
      text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    try {
      return { data: JSON.parse(text), responseUrl: response.url };
    } catch {
      throw new Error('Marketplace endpoint did not return JSON.');
    }
  } finally {
    clearTimeout(timer);
  }
}
function withInstalledState(type, items) {
  const localItems =
      'personas' === type
        ? ContentLibraryService.readPersonas()
        : ContentLibraryService.readSkills(),
    byId = new Map(localItems.map((item) => [item.id, item]));
  return items.map((item) => ({
    ...item,
    isInstalled: byId.has(item.id),
    installedSource: byId.get(item.id)?.source ?? null,
  }));
}
export function getMarketplaceOrigins() {
  return [MARKETPLACE_API_BASE_URL];
}
export async function listItems({
  type: type = 'skills',
  page: page = 1,
  search: search = '',
  filter: filter = 'all',
  sort: sort = 'az',
  limit: limit = 24,
} = {}) {
  const normalizedType = normalizeMarketplaceType(type),
    nextPage = normalizePositiveInteger(page, 1),
    { data: data } = await fetchJson(
      (function (type, params = {}) {
        return (function (url, entries = {}) {
          for (const [key, value] of Object.entries(entries))
            null != value && '' !== value && url.searchParams.set(key, String(value));
          return url;
        })(new URL(`${MARKETPLACE_API_BASE_URL}/items`), {
          type: type,
          q: String(params.search ?? '').trim(),
          filter: normalizeMarketplaceFilter(params.filter),
          sort: normalizeMarketplaceSort(params.sort),
          page: normalizePositiveInteger(params.page, 1),
          limit: normalizePositiveInteger(params.limit, 24),
        }).toString();
      })(normalizedType, {
        page: nextPage,
        search: search,
        filter: filter,
        sort: sort,
        limit: limit,
      }),
    ),
    records = Array.isArray(data?.items) ? data.items : [],
    items = withInstalledState(
      normalizedType,
      records.map((record) => normalizeMarketplaceItem(record, normalizedType)).filter(Boolean),
    );
  return {
    origin: MARKETPLACE_API_BASE_URL,
    items: items,
    total: Number(data?.total ?? items.length) || 0,
    page: Number(data?.page ?? nextPage) || nextPage,
    nextPage: data?.nextPage ?? null,
    hasMore: Boolean(data?.hasMore),
  };
}
export async function getItemDetail({ type: type = 'skills', item: item } = {}) {
  const normalizedType = normalizeMarketplaceType(type),
    normalizedItem = normalizeMarketplaceItem(item ?? {}, normalizedType);
  if (normalizedItem?.markdown) return normalizedItem;
  const publisher = ContentLibraryService.sanitizePublisherName(
      normalizedItem?.publisher ?? item?.publisher ?? ContentLibraryService.OFFICIAL_PUBLISHER,
    ),
    filename = ContentLibraryService.sanitizeMarkdownFileName(
      normalizedItem?.filename ?? item?.filename ?? item?.name,
      'personas' === normalizedType ? 'Persona' : 'Skill',
    ),
    { data: data } = await fetchJson(buildDetailUrl(normalizedType, publisher, filename)),
    result = normalizeMarketplaceItem(data, normalizedType);
  if (!result) throw new Error('Marketplace item could not be loaded.');
  return {
    ...result,
    isInstalled:
      !0 ===
      withInstalledState(normalizedType, [result]).find((entry) => entry.id === result.id)
        ?.isInstalled,
  };
}
export async function installItem({ type: type = 'skills', item: item } = {}) {
  const normalizedType = normalizeMarketplaceType(type),
    normalizedItem = normalizeMarketplaceItem(item ?? {}, normalizedType) ?? item;
  if (!normalizedItem) throw new Error('Marketplace item is missing.');
  const markdown = await (async function (type, item) {
      if (item.markdown) return item.markdown;
      const publisher = ContentLibraryService.sanitizePublisherName(
          item?.publisher ?? ContentLibraryService.OFFICIAL_PUBLISHER,
        ),
        filename = ContentLibraryService.sanitizeMarkdownFileName(
          item?.filename ?? item?.name,
          'personas' === type ? 'Persona' : 'Skill',
        );
      try {
        return (
          await (async function (url, { timeoutMs: timeoutMs = 8e3 } = {}) {
            const controller = new AbortController(),
              timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
              const response = await fetch(url, {
                signal: controller.signal,
                headers: { Accept: 'text/markdown, text/plain;q=0.9, */*;q=0.8' },
              });
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              return await response.text();
            } finally {
              clearTimeout(timer);
            }
          })(buildDownloadUrl(type, publisher, filename))
        ).trim();
      } catch {
        const detail = await getItemDetail({
          type: type,
          item: { ...item, publisher: publisher, filename: filename },
        });
        if (detail.markdown) return detail.markdown;
        throw new Error('Marketplace item content could not be loaded.');
      }
    })(normalizedType, normalizedItem),
    target = ContentLibraryService.writeUserContent(
      normalizedType,
      { publisher: normalizedItem.publisher, filename: normalizedItem.filename },
      markdown,
    ),
    libraryItems =
      'personas' === normalizedType
        ? ContentLibraryService.readPersonas()
        : ContentLibraryService.readSkills(),
    installedId = ContentLibraryService.buildContentId(
      normalizedType,
      target.publisher,
      target.filename,
    );
  return {
    ok: !0,
    item: libraryItems.find((entry) => entry.id === installedId) ?? {
      ...normalizedItem,
      id: installedId,
      filename: target.filename,
      publisher: target.publisher,
      markdown: markdown,
      isInstalled: !0,
      installedSource: 'user',
    },
    filePath: target.filePath,
  };
}
