---
name: Offline-First & Progressive Web Apps
trigger: offline-first, PWA, progressive web app, service worker, offline mode, IndexedDB, background sync, cache strategy, web app manifest, install to homescreen, push notifications web, workbox, offline support, app shell
description: A complete guide to building offline-capable, installable web applications. Use for implementing service workers, designing cache strategies, handling data sync conflicts, building PWAs, and delivering reliable app experiences on flaky or absent network connections.
---

Offline-first means designing your application to function without network connectivity as the primary use case — then treating network access as an enhancement. It's the difference between an app that says "No connection" and one that keeps working. The approach forces better architecture: explicit data ownership, sync strategies, and resilience.

## When Offline-First Matters

```
High value cases:
  ✓ Field workers (construction, healthcare, logistics) in low-signal areas
  ✓ Mobile-first products with spotty cellular coverage
  ✓ Productivity tools (notes, todos, documents)
  ✓ Games and media (playback shouldn't need a network)
  ✓ Any app where the worst moment to fail is "when the user needs it most"

Lower priority cases:
  ✗ Highly collaborative real-time tools (Google Docs live cursors)
  ✗ Financial transactions requiring instant confirmation
  ✗ Applications where stale data causes harm (stock trading, medical alerts)

The architecture decision:
  Read-heavy apps    → Offline easy (cache reads)
  Write-heavy apps   → Offline hard (sync conflicts)
  Mixed              → Cache reads + queue writes
```

## Architecture: The App Shell Pattern

```
App Shell = the minimal HTML/CSS/JS required to render the UI skeleton
Content   = data-driven parts that may be network-dependent

Load sequence for app shell pattern:
  1. Service worker serves app shell from cache IMMEDIATELY
  2. Shell renders (navigation, layout, loading states)
  3. Content loads from cache (stale) while fetching fresh data
  4. UI updates when network response arrives

Result: Near-instant perceived load; app works offline with cached content.
```

## Service Workers

The service worker is a JavaScript file that runs in a separate thread, intercepts network requests, and manages caches.

**Service worker lifecycle:**
```javascript
// sw.js — the service worker file
const CACHE_NAME = 'myapp-v1.2.3'; // Bump version to force update
const APP_SHELL = [
  '/',
  '/manifest.json',
  '/static/app.js',
  '/static/app.css',
  '/static/icons/icon-192.png',
];

// Install: cache the app shell
self.addEventListener('install', (event) => {
  console.log('SW: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()) // Activate immediately (careful: see notes)
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim()) // Take control of open pages
  );
});

// Fetch: intercept requests
self.addEventListener('fetch', (event) => {
  event.respondWith(handleFetch(event.request));
});
```

## Cache Strategies

Choose the right strategy for each type of resource.

**1. Cache First (app shell, fonts, icons):**
```javascript
// Cache first: serve from cache, fallback to network, update cache
// Best for: versioned static assets (app.js?v=abc123), fonts
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  
  const response = await fetch(request);
  const cache = await caches.open(CACHE_NAME);
  cache.put(request, response.clone()); // Cache for next time
  return response;
}
```

**2. Network First (API data, user-generated content):**
```javascript
// Network first: try network, fallback to cache on failure
// Best for: API calls where freshness matters
async function networkFirst(request, cacheName = 'api-cache') {
  try {
    const response = await fetch(request);
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone()); // Update cache with fresh data
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'Offline', cached: false }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

**3. Stale While Revalidate (news, dashboards, non-critical data):**
```javascript
// Return cache immediately, update in background
// Best for: data that's okay to be slightly stale; fast perceived loading
async function staleWhileRevalidate(request, cacheName = 'data-cache') {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  // Fetch in background regardless
  const fetchPromise = fetch(request)
    .then(response => {
      cache.put(request, response.clone());
      return response;
    });
  
  return cached ?? fetchPromise; // Cached if available, otherwise wait
}
```

**4. Strategy router (different strategies per route):**
```javascript
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // App shell — Cache First
  if (APP_SHELL.includes(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  
  // API calls — Network First  
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }
  
  // Images — Stale While Revalidate
  if (request.destination === 'image') {
    event.respondWith(staleWhileRevalidate(request, 'image-cache'));
    return;
  }
});
```

## Using Workbox (Recommended)

Workbox is Google's library that makes service worker patterns reusable and testable.

```javascript
// sw.js with Workbox
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

// Precache the app shell (list injected by build tool)
precacheAndRoute(self.__WB_MANIFEST);

// API: NetworkFirst with 5-minute cache
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 300 })
    ]
  })
);

// Images: CacheFirst with 30-day expiry
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'image-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 })
    ]
  })
);
```

## Offline Data Sync with IndexedDB

For write operations offline, queue them and sync when connectivity returns.

```javascript
// offline-queue.js — IndexedDB-backed queue for offline writes
import { openDB } from 'idb'; // idb library wraps IndexedDB with promises

const dbPromise = openDB('myapp-db', 1, {
  upgrade(db) {
    db.createObjectStore('sync-queue', { keyPath: 'id', autoIncrement: true });
    db.createObjectStore('cached-todos', { keyPath: 'id' });
  }
});

// Queue an operation to sync later
export async function queueOperation(operation) {
  const db = await dbPromise;
  await db.add('sync-queue', {
    ...operation,
    timestamp: Date.now(),
    status: 'pending'
  });
}

// Process queue when online
export async function processSyncQueue() {
  const db = await dbPromise;
  const pending = await db.getAll('sync-queue');
  
  for (const op of pending) {
    try {
      await sendToServer(op);
      await db.delete('sync-queue', op.id);
    } catch (error) {
      console.error('Sync failed for operation', op.id, error);
      // Leave in queue for retry
    }
  }
}

// Listen for connectivity restoration
window.addEventListener('online', processSyncQueue);

// Background Sync API (more reliable — browser manages retry)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-queue') {
    event.waitUntil(processSyncQueue());
  }
});
```

## Conflict Resolution

When offline writes conflict with server state, you need a strategy.

```javascript
// Conflict resolution strategies:

// 1. Last Write Wins (simplest — usually wrong)
// Whoever synced last wins. Good for: user preferences, profile updates.

// 2. Server Always Wins
// Local changes are advisory; server state is truth.
// Good for: shared/collaborative data where server enforces invariants.

// 3. Client Always Wins
// Good for: personal data only the user edits (their own notes, settings).

// 4. Merge (complex — usually worth it)
// Combine changes using operational transforms or CRDTs.
// Automatic merging where possible, prompt user for conflicts.

// Practical merge example (todo list):
async function syncTodo(localTodo) {
  try {
    const response = await fetch(`/api/todos/${localTodo.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'If-Unmodified-Since': localTodo.lastSyncedAt // Optimistic locking
      },
      body: JSON.stringify(localTodo)
    });
    
    if (response.status === 412) { // Precondition Failed — server changed
      const serverTodo = await response.json();
      // Show conflict UI to user
      return resolveConflict(localTodo, serverTodo);
    }
    
    return response.json();
  } catch { /* offline — stay queued */ }
}
```

## PWA Manifest & Installability

```json
// manifest.json
{
  "name": "My App",
  "short_name": "MyApp",
  "description": "Brief description for app stores",
  "start_url": "/?source=pwa",
  "display": "standalone",        // No browser chrome
  "background_color": "#ffffff",  // Splash screen background
  "theme_color": "#1a1a2e",       // Status bar / browser chrome color
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { 
      "src": "/icons/icon-512-maskable.png", 
      "sizes": "512x512", 
      "type": "image/png",
      "purpose": "maskable"  // Required for adaptive icons on Android
    }
  ],
  "screenshots": [              // For app store listings
    { "src": "/screenshots/desktop.png", "sizes": "1280x720", "form_factor": "wide" },
    { "src": "/screenshots/mobile.png", "sizes": "390x844", "form_factor": "narrow" }
  ]
}
```

**Install prompt handling:**
```javascript
// Capture and defer the browser's install prompt
let installPrompt = null;

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault(); // Don't show immediately
  installPrompt = event;
  showInstallButton(); // Show your own "Install App" button
});

// Trigger install when user clicks your button
async function triggerInstall() {
  if (!installPrompt) return;
  installPrompt.prompt();
  const { outcome } = await installPrompt.userChoice;
  if (outcome === 'accepted') {
    hideInstallButton();
    analytics.track('pwa_installed');
  }
  installPrompt = null;
}
```

## Testing Offline Behavior

```javascript
// In Chrome DevTools: Network tab → Offline checkbox
// In Playwright/Cypress:
await page.context().setOffline(true);
await page.click('[data-testid="save-button"]');
await expect(page.locator('.offline-badge')).toBeVisible();
await expect(page.locator('.pending-sync-count')).toHaveText('1');

await page.context().setOffline(false);
await page.waitForResponse('/api/todos');
await expect(page.locator('.pending-sync-count')).toHaveText('0');

// Things to always test:
// □ App loads completely from cache when offline
// □ User can complete key flows while offline
// □ Pending operations indicator visible when queue is non-empty
// □ Queue processes correctly when connectivity returns
// □ Conflicts are surfaced to user, not silently dropped
// □ Service worker update deploys correctly (no users stuck on stale SW)
```
