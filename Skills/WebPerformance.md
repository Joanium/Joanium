---
name: Web Performance & Core Web Vitals
trigger: web performance, core web vitals, LCP, CLS, INP, FCP, TTFB, lighthouse, page speed, slow website, bundle size, code splitting, lazy loading, image optimization, performance audit, render blocking, font loading, performance budget, vitals, pagespeed
description: Diagnose and fix web performance problems. Covers Core Web Vitals (LCP, INP, CLS), bundle analysis, image optimization, font loading, code splitting, server response time, caching, and real-user monitoring.
---

# ROLE
You are a web performance engineer. Your job is to make pages fast enough that users don't notice loading, and to keep them that way as the product grows. Performance is a feature — slow sites lose users before they even read a word.

# CORE PRINCIPLES
```
MEASURE FIRST:         Never optimize without profiling — fix the actual bottleneck
REAL USERS OVER LAB:   Lighthouse is a diagnostic tool; RUM (Real User Monitoring) is truth
PERCEIVED > ACTUAL:    A page that loads progressively feels faster than a fast page that shows nothing
AVOID REGRESSIONS:     Budgets and CI checks prevent accidental slowdowns
LCP IS THE METRIC:     If you fix one thing, fix LCP — it correlates most with user satisfaction
```

# CORE WEB VITALS — THE THREE THAT MATTER

## LCP — Largest Contentful Paint (target: < 2.5s)
```
WHAT: Time until the largest image or text block is visible
WHY: Best proxy for "did the page load?"
ELEMENT: Usually a hero image, header image, or large h1

CAUSES OF SLOW LCP:
  1. Slow server response (TTFB) — fix hosting, CDN, or server code first
  2. Render-blocking resources (CSS/JS) — block the browser from painting
  3. Slow resource load time — large images, slow fonts
  4. Client-side rendering — blank page until JS executes

HOW TO FIND THE LCP ELEMENT:
  Chrome DevTools → Performance → expand "Timings" row → hover LCP marker
  Or: new PerformanceObserver(list => console.log(list.getEntries())).observe({ type: 'largest-contentful-paint', buffered: true })
```

## INP — Interaction to Next Paint (target: < 200ms)
```
WHAT: Time from user interaction to next visible update (replaced FID in 2024)
WHY: Measures responsiveness throughout the whole session, not just on load

CAUSES OF HIGH INP:
  1. Long JavaScript tasks blocking the main thread
  2. Heavy event handlers doing too much synchronous work
  3. Re-renders triggered by state changes in large component trees

HOW TO DIAGNOSE:
  Chrome DevTools → Performance tab → record user interactions
  Look for long tasks (red-striped blocks > 50ms)
  LoAF (Long Animation Frame) API in modern Chrome
```

## CLS — Cumulative Layout Shift (target: < 0.1)
```
WHAT: Total unexpected movement of content as the page loads
WHY: Elements shifting cause mis-clicks and are deeply frustrating

CAUSES OF HIGH CLS:
  1. Images/videos without explicit width/height attributes
  2. Ads or embeds with unknown dimensions
  3. Web fonts causing text to reflow (FOUT)
  4. Dynamically injected content above existing content

HOW TO FIND SHIFTS:
  Chrome DevTools → Performance → look for "Layout Shift" entries (purple)
  Or: new PerformanceObserver(list => console.log(list.getEntries())).observe({ type: 'layout-shift', buffered: true })
```

# DIAGNOSING PERFORMANCE PROBLEMS

## The Stack in Order of Impact
```
1. Is the server slow?         → TTFB (Time to First Byte)
2. Is there too much JS?       → Bundle size, parse time, long tasks
3. Is the LCP resource slow?   → Image size, CDN, preload
4. Are there layout shifts?    → Missing image dimensions, font swap
5. Are interactions sluggish?  → Main thread contention, React re-renders
```

## DevTools Workflow
```
NETWORK TAB:
  [ ] TTFB for HTML document (should be < 600ms)
  [ ] Large resources (sort by Size)
  [ ] Render-blocking resources (show in Waterfall as early, long bars)
  [ ] Images — are they the right size? WebP?
  [ ] Unused JS/CSS (Coverage tab: Ctrl+Shift+P → "Coverage")

PERFORMANCE TAB:
  [ ] Record page load
  [ ] Check "Timings" row: FCP, LCP, DCL, Load
  [ ] Long Tasks (red corner on main thread tasks > 50ms)
  [ ] JS execution time breakdown in Summary panel

LIGHTHOUSE (Ctrl+Shift+P → "Lighthouse"):
  [ ] Run in Incognito (disable extensions)
  [ ] Mobile + throttling preset = realistic
  [ ] Read "Opportunities" — they have specific size savings
  [ ] Read "Diagnostics" — they explain root causes
```

# LCP OPTIMIZATION

## #1: Eliminate Render-Blocking Resources
```html
<!-- WRONG: Blocking stylesheets delay FCP and LCP -->
<link rel="stylesheet" href="/large-global.css">
<script src="/analytics.js"></script>

<!-- RIGHT: inline critical CSS, defer everything else -->
<style>
  /* Critical CSS: only what's needed to paint above-the-fold */
  body { margin: 0; font-family: sans-serif; }
  .hero { height: 100vh; background: #f0f0f0; }
  .hero h1 { font-size: 3rem; }
</style>

<!-- Async/defer non-critical scripts -->
<script src="/analytics.js" defer></script>
<script src="/intercom.js" async></script>

<!-- Preconnect to critical third-party origins -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://cdn.yourapp.com" crossorigin>
```

## #2: Preload the LCP Resource
```html
<!-- Preload the hero image so it starts loading immediately -->
<!-- Without this: browser discovers image when parsing HTML, already late -->
<link rel="preload" as="image" href="/hero.webp"
      imagesrcset="/hero-400.webp 400w, /hero-800.webp 800w, /hero-1200.webp 1200w"
      imagesizes="100vw">

<!-- Preload LCP font if text is the LCP element -->
<link rel="preload" as="font" href="/fonts/Inter-Bold.woff2"
      type="font/woff2" crossorigin>
```

## #3: Image Optimization
```tsx
// Next.js — always use <Image> for automatic optimization
import Image from 'next/image'

// Hero/LCP image — eager load, no lazy, fill parent
<Image
  src="/hero.jpg"
  alt="Product hero"
  fill
  priority           // ← critical: disables lazy loading, adds preload link
  sizes="(max-width: 768px) 100vw, 50vw"
  quality={85}       // WebP quality (80-85 is visually identical to 100)
/>

// Below-fold images — lazy load (default)
<Image
  src="/feature.png"
  alt="Feature screenshot"
  width={600}
  height={400}
  // loading="lazy" is the default
/>

// Explicit dimensions ALWAYS prevent CLS
// Even for fill images: the parent must have position: relative + explicit height

// Manual optimization (non-Next.js):
// sharp: npm package for server-side image conversion
// squoosh.app: browser-based batch conversion
// Target: WebP for photos, AVIF for broad support (with WebP fallback)

// Responsive images with srcset
<img
  src="/hero-800.webp"
  srcset="/hero-400.webp 400w, /hero-800.webp 800w, /hero-1600.webp 1600w"
  sizes="(max-width: 400px) 400px, (max-width: 800px) 800px, 1600px"
  alt="Hero"
  width="800" height="500"   // Required to prevent CLS
  fetchpriority="high"       // On LCP image
>
```

# JAVASCRIPT BUNDLE OPTIMIZATION

## Analyze Before Cutting
```bash
# Next.js bundle analyzer
npm install @next/bundle-analyzer
# next.config.js: withBundleAnalyzer({ enabled: process.env.ANALYZE === 'true' })
ANALYZE=true npm run build
# Opens interactive treemap of your bundles

# Or: npx source-map-explorer dist/*.js
# Or: Webpack Bundle Analyzer
```

## Code Splitting
```typescript
// Route-level splitting (automatic in Next.js App Router)
// Each page is its own chunk — only load what's needed

// Dynamic imports for heavy components
import dynamic from 'next/dynamic'

// Heavy chart library — don't load until component is needed
const RevenueChart = dynamic(() => import('@/components/RevenueChart'), {
  loading: () => <Skeleton className="h-64 w-full" />,
  ssr: false,   // client-only libraries
})

// Modal — only load when opened
const [showModal, setShowModal] = useState(false)
const SettingsModal = dynamic(() => import('@/components/SettingsModal'))
// Only downloads SettingsModal.js when showModal becomes true

// Heavy utility libraries
const processPDF = async (file: File) => {
  const { PDFDocument } = await import('pdf-lib')  // loads on demand
  // ...
}
```

## Tree Shaking — Import Only What You Use
```typescript
// WRONG: imports entire lodash bundle (~70KB)
import _ from 'lodash'
const result = _.groupBy(items, 'category')

// RIGHT: import only the function you need
import groupBy from 'lodash/groupBy'

// WRONG: imports all icons from lucide-react
import * as Icons from 'lucide-react'

// RIGHT: named imports tree-shake correctly
import { ChevronDown, Settings, User } from 'lucide-react'

// Check your package.json "sideEffects" — libraries must declare this for tree-shaking to work
// Check library size before installing: bundlephobia.com
```

# CLS FIXES

## Always Size Images
```html
<!-- WRONG: browser doesn't know height, guesses, then shifts when image loads -->
<img src="/product.jpg" alt="Product">

<!-- RIGHT: explicit aspect ratio reserved before image loads -->
<img src="/product.jpg" alt="Product" width="400" height="300">

<!-- CSS approach: aspect-ratio prevents CLS -->
<style>
  .hero-image {
    aspect-ratio: 16 / 9;
    width: 100%;
    object-fit: cover;
  }
</style>
```

## Font CLS Prevention
```css
/* Font loading strategy — prevent FOUT (Flash of Unstyled Text) */
@font-face {
  font-family: 'Inter';
  src: url('/fonts/Inter.woff2') format('woff2');
  font-display: optional;  /* Don't swap — use fallback if font is slow */
                            /* 'swap' causes CLS; 'optional' avoids it */
}

/* Size-adjust: make fallback font match custom font metrics */
@font-face {
  font-family: 'InterFallback';
  src: local('Arial');
  ascent-override: 90%;
  descent-override: 22%;
  line-gap-override: 0%;
  size-adjust: 107%;    /* Adjust until fallback is same size as custom font */
}

body {
  font-family: 'Inter', 'InterFallback', sans-serif;
}
```

# REACT PERFORMANCE

## Prevent Unnecessary Re-renders
```typescript
// Profile first: React DevTools Profiler → record → look for unexpected renders

// Memoize expensive computations
const filteredItems = useMemo(
  () => items.filter(item => item.status === activeFilter),
  [items, activeFilter]
)

// Stable callback references (prevents child re-renders)
const handleSelect = useCallback((id: string) => {
  setSelectedId(id)
}, [])  // no deps = truly stable

// Memoize components that receive stable props
const ListItem = memo(function ListItem({ item, onSelect }: Props) {
  return <div onClick={() => onSelect(item.id)}>{item.name}</div>
})

// Avoid: creating objects/arrays inline in JSX (new reference every render)
// WRONG: <Component style={{ color: 'red' }} />
// RIGHT: const style = { color: 'red' }; <Component style={style} />
//         or move outside component if truly static

// Virtualize long lists (don't render 1000 DOM nodes)
import { useVirtualizer } from '@tanstack/react-virtual'
// Only renders visible rows + overscan buffer
```

## INP Optimization — Yield to the Main Thread
```typescript
// Break up long synchronous operations
async function processLargeDataset(items: Item[]) {
  const results = []
  for (let i = 0; i < items.length; i++) {
    results.push(processItem(items[i]))
    
    // Yield every 50 items to keep UI responsive
    if (i % 50 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0))
      // or: await scheduler.yield() (modern browsers)
    }
  }
  return results
}

// Debounce expensive state updates from rapid user input
const debouncedSearch = useMemo(
  () => debounce((query: string) => fetchResults(query), 200),
  []
)

// Use startTransition for non-urgent state updates
import { startTransition } from 'react'

const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
  setInputValue(e.target.value)    // Urgent: update input immediately
  startTransition(() => {
    setSearchQuery(e.target.value) // Non-urgent: can defer filtering
  })
}
```

# CACHING STRATEGY
```
HTTP CACHE HEADERS — static assets:
  Cache-Control: public, max-age=31536000, immutable
  → Use only with content-hashed filenames (/app.a3f2b1.js)
  → Browser never re-checks; rely on hash change for updates

HTML documents:
  Cache-Control: no-cache
  → Always re-validates; gets latest HTML; JS/CSS served from cache by hash

API responses:
  Cache-Control: private, max-age=60
  → User-specific, short TTL

CDN:
  Serve static assets from CDN edge close to users
  Configure: next.config.js assetPrefix for CDN URL
  Invalidate on deploy: most CDNs support cache-tag-based purging
```

# PERFORMANCE BUDGET & CI INTEGRATION
```javascript
// .lighthouserc.js (Lighthouse CI)
module.exports = {
  ci: {
    collect: { url: ['http://localhost:3000'], numberOfRuns: 3 },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }],
        'uses-optimized-images': 'warn',
        'uses-webp-images': 'warn',
      },
    },
    upload: { target: 'temporary-public-storage' },
  },
}
// Run in CI: npx lhci autorun
// Fails the PR if performance drops below budget
```

# REAL USER MONITORING
```typescript
// Capture Core Web Vitals from real users (not lab data)
import { onLCP, onINP, onCLS, onFCP, onTTFB } from 'web-vitals'

function sendToAnalytics(metric: Metric) {
  fetch('/api/vitals', {
    method: 'POST',
    body: JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,    // 'good' | 'needs-improvement' | 'poor'
      id: metric.id,
      navigationType: metric.navigationType,
      url: location.href,
    }),
  })
}

onLCP(sendToAnalytics)
onINP(sendToAnalytics)
onCLS(sendToAnalytics)
onFCP(sendToAnalytics)
onTTFB(sendToAnalytics)

// Also: Vercel Speed Insights, Datadog RUM, New Relic Browser — these aggregate automatically
```

# QUICK WINS CHECKLIST
```
Images (highest impact):
[ ] All images use WebP or AVIF format
[ ] Hero/LCP image has fetchpriority="high" and no lazy loading
[ ] All <img> tags have explicit width + height attributes
[ ] Images sized for their display size (not 4x larger)
[ ] Images served from CDN

JavaScript:
[ ] Bundle analyzed — no accidental large dependencies
[ ] Routes code-split (each page loads only its own JS)
[ ] Heavy components dynamically imported
[ ] No unused imports from large libraries

Fonts:
[ ] Fonts preloaded with <link rel="preload">
[ ] font-display: optional (prevents FOUT/CLS)
[ ] Self-hosted (eliminates DNS lookup latency for external font services)

Server:
[ ] TTFB < 600ms (check hosting region vs user location)
[ ] HTML compressed with gzip/brotli
[ ] CDN for static assets

Monitoring:
[ ] Lighthouse CI in your CI pipeline
[ ] Real user monitoring collecting Core Web Vitals
[ ] Performance budget documented and enforced
```
