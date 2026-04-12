import path from 'path';
import { pathToFileURL } from 'url';
import { PAGE_DISCOVERY_ROOTS } from './DiscoveryManifest.js';
import { scanFilesRecursive } from './FileSystem.js';
let cachedPagePromise = null,
  cachedRootSignature = '';
function normalizePage(rawPage = {}, filePath = '') {
  return rawPage?.id && rawPage?.moduleUrl
    ? {
        ...rawPage,
        css: rawPage.css ?? null,
        label: rawPage.label ?? rawPage.id,
        order: rawPage.order ?? 999,
        section: 'bottom' === rawPage.section ? 'bottom' : 'top',
        showInSidebar: !1 !== rawPage.showInSidebar,
      }
    : (console.warn(`[PageDiscovery] Skipping invalid page manifest: ${filePath}`), null);
}
export async function discoverPages(scanRoots = PAGE_DISCOVERY_ROOTS) {
  const roots = (function (scanRoots) {
      return (Array.isArray(scanRoots) ? scanRoots : [scanRoots])
        .filter((root) => 'string' == typeof root && root.trim())
        .map((root) => path.resolve(root));
    })(scanRoots),
    rootSignature = (function (scanRoots) {
      return [...scanRoots].sort((a, b) => a.localeCompare(b)).join('|');
    })(roots);
  if (cachedPagePromise && cachedRootSignature === rootSignature) return cachedPagePromise;
  ((cachedRootSignature = rootSignature),
    (cachedPagePromise = (async () => {
      const pageFiles = [],
        pages = [],
        seenIds = new Set();
      for (const root of roots)
        pageFiles.push(...scanFilesRecursive(root, (entry) => 'Page.js' === entry.name));
      for (const filePath of pageFiles.sort((a, b) => a.localeCompare(b)))
        try {
          const page = normalizePage(
            (await import(pathToFileURL(filePath).href)).default,
            filePath,
          );
          if (!page) continue;
          if (seenIds.has(page.id))
            throw new Error(`[PageDiscovery] Duplicate page id "${page.id}" found at ${filePath}`);
          (seenIds.add(page.id), pages.push(page));
        } catch (error) {
          console.warn(`[PageDiscovery] Failed to load page manifest: ${filePath}`, error.message);
        }
      return pages.sort((a, b) => {
        const orderDelta = (a.order ?? 999) - (b.order ?? 999);
        return 0 !== orderDelta
          ? orderDelta
          : String(a.label ?? a.id).localeCompare(String(b.label ?? b.id));
      });
    })()));
  try {
    return await cachedPagePromise;
  } catch (error) {
    throw ((cachedPagePromise = null), (cachedRootSignature = ''), error);
  }
}
