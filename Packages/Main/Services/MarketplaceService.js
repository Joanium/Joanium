import * as ContentLibraryService from './ContentLibraryService.js';
const MARKETPLACE_SITE_URL = 'https://www.joanium.com/marketplace';
const MARKETPLACE_API_BASE_URL = 'https://www.joanium.com/api/marketplace';
const DEFAULT_LIST_LIMIT = 24;

function normalizeMarketplaceType(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase() === 'personas'
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

  if (normalized === 'newest') return 'newest';
  if (normalized === 'za' || normalized === 'z-a') return 'za';
  if (normalized === 'az' || normalized === 'a-z' || normalized === 'popular') return 'az';
  return 'az';
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildQuery(url, entries = {}) {
  for (const [key, value] of Object.entries(entries)) {
    if (value == null || value === '') continue;
    url.searchParams.set(key, String(value));
  }

  return url;
}

function buildListUrl(type, params = {}) {
  return buildQuery(new URL(`${MARKETPLACE_API_BASE_URL}/items`), {
    type,
    q: String(params.search ?? '').trim(),
    filter: normalizeMarketplaceFilter(params.filter),
    sort: normalizeMarketplaceSort(params.sort),
    page: normalizePositiveInteger(params.page, 1),
    limit: normalizePositiveInteger(params.limit, DEFAULT_LIST_LIMIT),
  }).toString();
}

function resolveRelativeUrl(candidate) {
  const raw = String(candidate ?? '').trim();
  if (!raw) return null;

  try {
    return new URL(raw, MARKETPLACE_SITE_URL).toString();
  } catch {
    return null;
  }
}

function stripMarkdown(source) {
  return String(source ?? '')
    .replace(/^---[\s\S]*?---\s*/m, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/^#+\s+/gm, '')
    .replace(/[*_>~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildExcerpt(value, maxLength = 160) {
  const text = stripMarkdown(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).replace(/\s+\S*$/, '')}...`;
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
  if (!rawItem || typeof rawItem !== 'object') return null;

  const publisher = ContentLibraryService.sanitizePublisherName(
    rawItem.publisher ?? ContentLibraryService.OFFICIAL_PUBLISHER,
  );
  const meta = rawItem.meta && typeof rawItem.meta === 'object' ? rawItem.meta : {};
  const filename =
    String(rawItem.filename ?? '').trim() ||
    ContentLibraryService.sanitizeMarkdownFileName(
      rawItem.name,
      type === 'personas' ? 'Persona' : 'Skill',
    );
  const normalizedFilename = ContentLibraryService.sanitizeMarkdownFileName(
    filename,
    type === 'personas' ? 'Persona' : 'Skill',
  );
  const normalizedPublisher = publisher || ContentLibraryService.OFFICIAL_PUBLISHER;
  const markdown = typeof rawItem.markdown === 'string' ? rawItem.markdown.trim() : '';
  const description = String(rawItem.description ?? rawItem.excerpt ?? '').trim();
  const normalized = {
    id:
      String(rawItem.id ?? '').trim() ||
      ContentLibraryService.buildContentId(type, normalizedPublisher, normalizedFilename),
    type,
    name: String(rawItem.name ?? normalizedFilename.replace(/\.md$/i, '')).trim(),
    filename: normalizedFilename,
    publisher: normalizedPublisher,
    isVerified:
      rawItem.verified === true || ContentLibraryService.isVerifiedPublisher(normalizedPublisher),
    verified:
      rawItem.verified === true || ContentLibraryService.isVerifiedPublisher(normalizedPublisher),
    description,
    excerpt: String(rawItem.excerpt ?? '').trim(),
    markdown,
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
    marketplaceOrigin: MARKETPLACE_SITE_URL,
    marketplaceApiBase: MARKETPLACE_API_BASE_URL,
  };

  if (type === 'personas') {
    normalized.personality = String(meta.personality ?? rawItem.personality ?? '').trim();
  } else {
    normalized.trigger = String(meta.trigger ?? rawItem.trigger ?? '').trim();
  }

  if (!normalized.description) {
    normalized.description = buildExcerpt(normalized.markdown);
  }
  if (!normalized.excerpt) {
    normalized.excerpt = normalized.description || buildExcerpt(normalized.markdown);
  }

  return normalized;
}

async function fetchJson(url, { timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
      },
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    try {
      return {
        data: JSON.parse(text),
        responseUrl: response.url,
      };
    } catch {
      throw new Error('Marketplace endpoint did not return JSON.');
    }
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url, { timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'text/markdown, text/plain;q=0.9, */*;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function withInstalledState(type, items) {
  const localItems =
    type === 'personas' ? ContentLibraryService.readPersonas() : ContentLibraryService.readSkills();
  const byId = new Map(localItems.map((item) => [item.id, item]));

  return items.map((item) => ({
    ...item,
    isInstalled: byId.has(item.id),
    installedSource: byId.get(item.id)?.source ?? null,
  }));
}

async function resolveItemMarkdown(type, item) {
  if (item.markdown) return item.markdown;
  const publisher = ContentLibraryService.sanitizePublisherName(
    item?.publisher ?? ContentLibraryService.OFFICIAL_PUBLISHER,
  );
  const filename = ContentLibraryService.sanitizeMarkdownFileName(
    item?.filename ?? item?.name,
    type === 'personas' ? 'Persona' : 'Skill',
  );

  try {
    return (await fetchText(buildDownloadUrl(type, publisher, filename))).trim();
  } catch {
    const detail = await getItemDetail({ type, item: { ...item, publisher, filename } });
    if (detail.markdown) return detail.markdown;
    throw new Error('Marketplace item content could not be loaded.');
  }
}

export function getMarketplaceOrigins() {
  return [MARKETPLACE_API_BASE_URL];
}

export async function listItems({
  type = 'skills',
  page = 1,
  search = '',
  filter = 'all',
  sort = 'az',
  limit = DEFAULT_LIST_LIMIT,
} = {}) {
  const normalizedType = normalizeMarketplaceType(type);
  const nextPage = normalizePositiveInteger(page, 1);
  const { data } = await fetchJson(
    buildListUrl(normalizedType, {
      page: nextPage,
      search,
      filter,
      sort,
      limit,
    }),
  );
  const records = Array.isArray(data?.items) ? data.items : [];
  const items = withInstalledState(
    normalizedType,
    records.map((record) => normalizeMarketplaceItem(record, normalizedType)).filter(Boolean),
  );

  return {
    origin: MARKETPLACE_API_BASE_URL,
    items,
    total: Number(data?.total ?? items.length) || 0,
    page: Number(data?.page ?? nextPage) || nextPage,
    nextPage: data?.nextPage ?? null,
    hasMore: Boolean(data?.hasMore),
  };
}

export async function getItemDetail({ type = 'skills', item } = {}) {
  const normalizedType = normalizeMarketplaceType(type);
  const normalizedItem = normalizeMarketplaceItem(item ?? {}, normalizedType);
  if (normalizedItem?.markdown) return normalizedItem;

  const publisher = ContentLibraryService.sanitizePublisherName(
    normalizedItem?.publisher ?? item?.publisher ?? ContentLibraryService.OFFICIAL_PUBLISHER,
  );
  const filename = ContentLibraryService.sanitizeMarkdownFileName(
    normalizedItem?.filename ?? item?.filename ?? item?.name,
    normalizedType === 'personas' ? 'Persona' : 'Skill',
  );
  const { data } = await fetchJson(buildDetailUrl(normalizedType, publisher, filename));
  const result = normalizeMarketplaceItem(data, normalizedType);

  if (!result) {
    throw new Error('Marketplace item could not be loaded.');
  }

  return {
    ...result,
    isInstalled:
      withInstalledState(normalizedType, [result]).find((entry) => entry.id === result.id)
        ?.isInstalled === true,
  };
}

export async function installItem({ type = 'skills', item } = {}) {
  const normalizedType = normalizeMarketplaceType(type);
  const normalizedItem = normalizeMarketplaceItem(item ?? {}, normalizedType) ?? item;

  if (!normalizedItem) {
    throw new Error('Marketplace item is missing.');
  }

  const markdown = await resolveItemMarkdown(normalizedType, normalizedItem);
  const target = ContentLibraryService.writeUserContent(
    normalizedType,
    {
      publisher: normalizedItem.publisher,
      filename: normalizedItem.filename,
    },
    markdown,
  );
  const libraryItems =
    normalizedType === 'personas'
      ? ContentLibraryService.readPersonas()
      : ContentLibraryService.readSkills();
  const installedId = ContentLibraryService.buildContentId(
    normalizedType,
    target.publisher,
    target.filename,
  );

  return {
    ok: true,
    item: libraryItems.find((entry) => entry.id === installedId) ?? {
      ...normalizedItem,
      id: installedId,
      filename: target.filename,
      publisher: target.publisher,
      markdown,
      isInstalled: true,
      installedSource: 'user',
    },
    filePath: target.filePath,
  };
}
