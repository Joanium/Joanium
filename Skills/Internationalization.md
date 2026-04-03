---
name: Internationalization & Localization
trigger: i18n, l10n, internationalization, localization, translation, multi-language, multilingual, locale, RTL, right-to-left, date formatting, currency formatting, pluralization, ICU, react-intl, i18next, next-intl, language switcher, timezone, number formatting
description: Build applications that work for global users. Covers locale detection, translation systems, pluralization, date/number/currency formatting, RTL layout, dynamic content, and avoiding common i18n pitfalls.
---

# ROLE
You are an internationalization engineer. Your job is to make applications genuinely usable across languages, regions, and cultures — not just translated, but locally correct. Bad i18n breaks trust immediately; users notice when their currency is wrong or dates are American when they're Japanese.

# CORE PRINCIPLES
```
EXTERNALIZE EVERYTHING:    No hardcoded strings — every user-visible string goes in a message file
FORMAT, DON'T CONVERT:     Use platform APIs for dates/numbers; never write your own formatter
PLURALIZATION IS HARD:     "1 result" vs "2 results" — many languages have 6+ plural forms
RTL IS LAYOUT, NOT MIRROR: Arabic/Hebrew flip more than just text direction
LOCALE ≠ LANGUAGE:         en-US and en-GB differ in dates, currency, spelling
TIME IS ALWAYS UTC:        Store UTC, display in user's timezone
CONTEXT CHANGES MEANING:   "Save" means different things as a button vs a confirmation message
```

# LOCALE DETECTION STRATEGY
```
Priority order (first match wins):
  1. Explicit user preference (saved in profile/localStorage)
  2. URL prefix: /en/, /fr/, /ja/ (best for SEO and shareability)
  3. Accept-Language HTTP header
  4. Geolocation (last resort — VPN users will hate you)

Locale format: BCP 47 tags
  'en'       → English, no region
  'en-US'    → English, United States
  'en-GB'    → English, United Kingdom
  'zh-Hans'  → Chinese Simplified
  'zh-Hant'  → Chinese Traditional
  'pt-BR'    → Portuguese, Brazil
  'pt-PT'    → Portuguese, Portugal
```

# PROJECT STRUCTURE
```
/messages (or /locales)
  en.json
  fr.json
  ja.json
  ar.json
  de.json

/src
  /i18n
    config.ts       → supported locales, fallback locale
    request.ts      → locale detection logic (Next.js: middleware.ts)
  /components       → no hardcoded strings anywhere

NAMESPACE BY FEATURE (prevents one giant unmanageable file):
  en/
    common.json     → shared: Save, Cancel, Error, Loading...
    auth.json       → Login, Logout, Register, forgot-password flow
    dashboard.json  → dashboard-specific strings
    billing.json    → pricing, plans, invoices
```

# TRANSLATION FILES

## JSON Message Format (react-i18next / i18next style)
```json
// en/common.json
{
  "actions": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "confirm": "Confirm"
  },
  "errors": {
    "generic": "Something went wrong. Please try again.",
    "notFound": "Page not found.",
    "network": "Unable to connect. Check your internet connection."
  },
  "pagination": {
    "showing": "Showing {{from}}–{{to}} of {{total}} results",
    "previous": "Previous",
    "next": "Next"
  }
}

// en/dashboard.json
{
  "welcome": "Welcome back, {{name}}!",
  "stats": {
    "users": {
      "one": "{{count}} user",
      "other": "{{count}} users"
    },
    "revenue": "Revenue this month: {{amount}}"
  },
  "emptyState": "No items yet. Create your first one to get started."
}
```

## ICU Message Format (react-intl / FormatJS style — more powerful)
```json
// en/messages.json (ICU format)
{
  "inbox.count": "{count, plural, =0 {No messages} one {# message} other {# messages}}",
  "user.greeting": "Hello, {name}!",
  "file.size": "{size, number, ::compact-short} {unit}",
  "event.date": "Happening {date, date, long}",
  "payment.status": "{status, select, paid {Payment received} pending {Awaiting payment} failed {Payment failed} other {Unknown}}",
  "cart.summary": "You have {count, plural, =0 {nothing} one {# item} other {# items}} in your cart{count, plural, =0 {} other {, totaling {total, number, ::currency/USD}}}."
}
```

# REACT IMPLEMENTATION (next-intl — recommended for Next.js)

## Setup
```typescript
// middleware.ts (Next.js App Router)
import createMiddleware from 'next-intl/middleware'

export default createMiddleware({
  locales: ['en', 'fr', 'de', 'ja', 'ar'],
  defaultLocale: 'en',
  localePrefix: 'always',   // /en/dashboard, /fr/dashboard
})

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
}

// i18n/request.ts
import { getRequestConfig } from 'next-intl/server'

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`../messages/${locale}.json`)).default,
}))
```

## Using Translations in Components
```typescript
// Server component
import { useTranslations } from 'next-intl'

export default function DashboardPage() {
  const t = useTranslations('dashboard')
  return (
    <div>
      <h1>{t('welcome', { name: user.name })}</h1>
      <p>{t('stats.users', { count: userCount })}</p>
    </div>
  )
}

// Client component
'use client'
import { useTranslations, useFormatter, useLocale } from 'next-intl'

export function StatsCard({ revenue, date }: { revenue: number; date: Date }) {
  const t = useTranslations('dashboard')
  const format = useFormatter()
  const locale = useLocale()
  
  return (
    <div>
      {/* Currency: automatically formats to locale's conventions */}
      <p>{format.number(revenue, { style: 'currency', currency: 'USD' })}</p>
      {/* en-US: $12,345.67 | de: 12.345,67 $ | ja: $12,345.67 */}
      
      {/* Date: locale-aware formatting */}
      <p>{format.dateTime(date, { dateStyle: 'long' })}</p>
      {/* en-US: January 15, 2024 | de: 15. Januar 2024 | ja: 2024年1月15日 */}
      
      {/* Relative time */}
      <p>{format.relativeTime(date)}</p>
      {/* en: 3 days ago | fr: il y a 3 jours */}
    </div>
  )
}
```

# FORMATTING RULES

## Never Write Your Own Date/Number Formatter
```typescript
// WRONG — broken for non-English locales
const formatted = `$${price.toFixed(2)}`   // Wrong decimal/thousands separators for DE, FR
const dateStr = `${month}/${day}/${year}`   // MM/DD/YYYY is US-only

// RIGHT — use Intl APIs
const currencyFormatter = new Intl.NumberFormat(locale, {
  style: 'currency',
  currency: currencyCode,
})
currencyFormatter.format(price)
// en-US, USD → $1,234.56
// de-DE, EUR → 1.234,56 €
// ja-JP, JPY → ¥1,235  (JPY has no decimal)
// ar-SA, SAR → ١٬٢٣٤٫٥٦ ر.س. (Arabic numerals)

const dateFormatter = new Intl.DateTimeFormat(locale, {
  year: 'numeric', month: 'long', day: 'numeric',
})
dateFormatter.format(new Date())
// en-US → January 15, 2024
// fr-FR → 15 janvier 2024
// ar-EG → ١٥ يناير ٢٠٢٤

// Relative time
const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
rtf.format(-3, 'day')    // en: "3 days ago" | fr: "il y a 3 jours"
rtf.format(1, 'day')     // en: "tomorrow" | de: "morgen"
```

## Pluralization
```typescript
// WRONG — English-only logic
const label = count === 1 ? 'item' : 'items'

// RIGHT — use ICU or i18next plural rules
// i18next handles all CLDR plural categories automatically:
// zero, one, two, few, many, other
// Arabic has all 6; Russian has 4; Japanese has 1

// en.json: { "items": "{{count}} item" / "{{count}} items" }
// ar.json: { "items_zero": "لا عناصر", "items_one": "عنصر واحد",
//            "items_two": "عنصران", "items_few": "{{count}} عناصر",
//            "items_many": "{{count}} عنصرًا", "items_other": "{{count}} عنصر" }

t('items', { count })  // i18next picks the right form automatically
```

# RTL (RIGHT-TO-LEFT) SUPPORT

## CSS Logical Properties — Write RTL-Safe CSS Once
```css
/* WRONG — physical properties break in RTL */
.card {
  margin-left: 16px;      /* left-only: wrong in RTL */
  padding-right: 24px;
  border-left: 3px solid blue;
  text-align: left;
}

/* RIGHT — logical properties flip automatically */
.card {
  margin-inline-start: 16px;   /* left in LTR, right in RTL */
  padding-inline-end: 24px;
  border-inline-start: 3px solid blue;
  text-align: start;           /* left in LTR, right in RTL */
}

/* Also: */
/* margin-block-start (top), margin-block-end (bottom) */
/* inset-inline-start (left in LTR), inset-inline-end (right in LTR) */
/* padding-inline: 8px 24px → flips in RTL */

/* Flexbox / Grid are inherently logical — use them */
.nav {
  display: flex;
  gap: 16px;
  /* flex-direction: row already respects writing direction */
}
```

## HTML and Document Direction
```tsx
// Set direction on the html element — browsers handle the rest
// app/[locale]/layout.tsx (Next.js)
export default function RootLayout({ children, params: { locale } }) {
  const direction = ['ar', 'he', 'fa', 'ur'].includes(locale) ? 'rtl' : 'ltr'
  return (
    <html lang={locale} dir={direction}>
      <body>{children}</body>
    </html>
  )
}

// Icons that have direction: flip them in RTL
.icon-arrow-forward {
  [dir='rtl'] & {
    transform: scaleX(-1);   /* flip horizontal */
  }
}
```

# LANGUAGE SWITCHER
```tsx
'use client'
import { useRouter, usePathname } from 'next/navigation'
import { useLocale } from 'next-intl'

const LOCALES = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
]

export function LanguageSwitcher() {
  const router = useRouter()
  const pathname = usePathname()
  const currentLocale = useLocale()

  const switchLocale = (newLocale: string) => {
    // Replace current locale prefix in path
    const newPath = pathname.replace(`/${currentLocale}`, `/${newLocale}`)
    router.push(newPath)
    // Save preference for next visit
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=${60 * 60 * 24 * 365}`
  }

  return (
    <select
      value={currentLocale}
      onChange={(e) => switchLocale(e.target.value)}
      aria-label="Select language"
    >
      {LOCALES.map(({ code, label, flag }) => (
        <option key={code} value={code}>
          {flag} {label}
        </option>
      ))}
    </select>
  )
}
```

# TIMEZONE HANDLING
```typescript
// RULE: Store all times in UTC. Display in user's timezone.

// Server: always UTC
const event = await db.events.create({
  data: {
    startsAt: new Date(isoStringFromUser),  // JS Date is always UTC internally
    timezone: userTimezone,                  // Store user's IANA timezone
  },
})

// Display: convert to user's timezone
function formatInTimezone(utcDate: Date, timezone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(utcDate)
}

// Detect timezone in browser
const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
// → "America/New_York", "Europe/Berlin", "Asia/Tokyo"

// Never store timezone offsets (+05:30) — they change with DST
// Always store IANA timezone identifiers ("Asia/Kolkata")
```

# TRANSLATION WORKFLOW
```
DEVELOPER:
  1. Add English string to en/[namespace].json
  2. Use the translation key in the component
  3. Commit both together

LOCALIZATION:
  Option A — Human translators: export JSON, translate, import back
  Option B — Tool: Crowdin, Lokalise, Phrase (sync via CI/CD, auto-detect new keys)
  Option C — AI-assisted: GPT/Claude for first pass, human review for tone

MISSING TRANSLATION HANDLING:
  i18next fallback: { fallbackLng: 'en' }  → show English if locale key is missing
  Show key in dev: { fallbackLng: false }  → highlights missing keys during development

PSEUDOLOCALIZATION (catch layout bugs):
  "Save" → "Ŝàvé"    — tests accent rendering, font coverage
  "[!!!Save!!!]"       — tests string length expansion (German can be 30% longer)
  ←esrever text→       — tests RTL layout without Arabic/Hebrew strings
```

# CHECKLIST
```
Strings:
[ ] Zero hardcoded user-visible strings in components
[ ] All strings have context comments for translators
[ ] Interpolated variables named descriptively ({userName}, not {0})
[ ] Pluralization uses i18n library (no `count === 1 ? '...' : '...'`)

Formatting:
[ ] Dates formatted with Intl.DateTimeFormat, not manual string construction
[ ] Numbers formatted with Intl.NumberFormat
[ ] Currency formatted with correct locale and currency code
[ ] Relative times formatted with Intl.RelativeTimeFormat

RTL:
[ ] CSS uses logical properties (inline-start, inline-end) throughout
[ ] <html dir> set correctly per locale
[ ] Directional icons tested in RTL
[ ] Layout tested with an RTL language (Arabic or Hebrew)

Locale:
[ ] Locale detected from user preference → URL → Accept-Language
[ ] Language switcher present and working
[ ] User preference persisted
[ ] Timezone stored as IANA identifier, displayed in user's timezone

Ops:
[ ] Missing translation fallback configured
[ ] Pseudolocalization used in testing to catch expansion bugs
[ ] Translator context/screenshots provided for ambiguous strings
```
