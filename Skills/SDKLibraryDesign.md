---
name: SDK & Library Design
trigger: SDK design, library design, npm package, developer SDK, client library, API client, JavaScript SDK, TypeScript library, npm publish, package design, developer experience DX, library API design, fluent API, chainable API, plugin system, tree-shakeable library, package.json exports, monorepo packages
description: Design and publish SDKs and libraries that developers love. Covers API design philosophy, TypeScript types, tree-shaking, plugin systems, versioning, documentation, and the patterns that make libraries intuitive to use.
---

# ROLE
You are a library author and developer experience (DX) engineer. Your job is to design SDKs that developers adopt enthusiastically — because the API is intuitive, the types are helpful, the errors are clear, and the documentation answers their real questions. Bad SDKs get abandoned; good ones become dependencies developers trust for years.

# CORE PRINCIPLES
```
THE PIT OF SUCCESS:     Make the right thing easy; make the wrong thing hard (or impossible)
PROGRESSIVE DISCLOSURE: Simple things simple, complex things possible — don't expose complexity upfront
TYPES ARE DOCS:         TypeScript types should answer "what can I do here?" without leaving the editor
IMMUTABILITY:           Return new objects; don't mutate caller's inputs
FAIL WITH GUIDANCE:     Error messages tell the developer exactly what to fix
STABLE APIs:            Breaking changes are a betrayal of trust — deprecate, don't break
ZERO-CONFIG START:      Working example with no configuration required
```

# API DESIGN PHILOSOPHY

## The Three Layers
```
LAYER 1: High-level (80% of use cases — must be trivially simple)
  const client = new Joanium({ apiKey: 'sk_...' })
  const result = await client.analyze(text)
  console.log(result.summary)

LAYER 2: Configured (15% — common customization without complexity)
  const result = await client.analyze(text, {
    model: 'fast',
    maxLength: 500,
    language: 'fr',
  })

LAYER 3: Escape hatches (5% — power users, edge cases)
  const result = await client.request('POST', '/v1/analyze', { body: rawPayload })
  // or: client.on('request', (req) => req.headers.set('X-Custom', 'value'))

Design the API from Layer 1 outward.
Never design from the HTTP API inward — that produces SDKs that mirror REST, not solve problems.
```

## Naming Principles
```
VERBS for actions:        client.create(), client.list(), client.delete(), client.send()
NOUNS for resources:      client.users, client.orders, client.messages
CONSISTENT across resources:
  ✓ client.users.list()    client.orders.list()    client.messages.list()
  ✗ client.getUsers()      client.fetchOrders()    client.listMessages()

PREDICTABLE:
  create → returns the created resource
  list   → returns { data: T[], pagination: {...} }
  get    → returns T or throws NotFoundError
  update → returns the updated resource
  delete → returns void (or { deleted: true })

AVOID:
  Abbreviations:  usr, cfg, opts (full words)
  Hungarian notation:  strName, intCount (let types express the type)
  Negative booleans:  disabled, hidden (use isEnabled, isVisible)
```

# TYPESCRIPT DESIGN

## Complete Types from the Start
```typescript
// Types should guide the developer at the call site, not just enforce correctness

// WEAK: developer has to guess what options exist
interface AnalyzeOptions {
  model?: string
  options?: Record<string, unknown>
}

// STRONG: IDE autocomplete reveals every option
interface AnalyzeOptions {
  /**
   * The model to use for analysis.
   * - 'fast': Lower latency, good for real-time (default)
   * - 'quality': Better accuracy, ~2x slower
   * - 'mini': Lowest cost, suitable for high-volume classification
   */
  model?: 'fast' | 'quality' | 'mini'
  
  /**
   * Maximum length of the generated summary in tokens.
   * @default 500
   * @minimum 50
   * @maximum 2000
   */
  maxLength?: number
  
  /**
   * Output language as BCP 47 tag (e.g., 'en', 'fr', 'ja').
   * The model will generate output in this language regardless of input language.
   * @default 'en'
   */
  language?: string
  
  /**
   * Custom metadata attached to this request. Returned in webhooks and logs.
   * Keys must be strings; values must be strings or numbers.
   */
  metadata?: Record<string, string | number>
}

// Return types must be complete — don't use `any` anywhere
interface AnalysisResult {
  id: string
  summary: string
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
  confidence: number         // 0 to 1
  topics: string[]
  language: string
  usage: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
  createdAt: string          // ISO 8601
}
```

## Generic Utilities
```typescript
// Paginated list response — consistent across all list methods
interface Page<T> {
  data: T[]
  pagination: {
    cursor?: string
    hasMore: boolean
    total?: number
  }
}

// Auto-paginate utility — iterate without manual cursor management
async function* autoPaginate<T>(
  fetcher: (cursor?: string) => Promise<Page<T>>
): AsyncGenerator<T> {
  let cursor: string | undefined
  do {
    const page = await fetcher(cursor)
    for (const item of page.data) yield item
    cursor = page.pagination.cursor
  } while (page.pagination.hasMore)
}

// Usage: for await (const user of client.users.listAll()) { ... }
```

# CLIENT IMPLEMENTATION

## Initialization Pattern
```typescript
export interface JoaniumConfig {
  apiKey: string
  baseUrl?: string             // For self-hosted / testing
  timeout?: number             // ms, default 30_000
  maxRetries?: number          // default 3
  defaultHeaders?: Record<string, string>
  fetch?: typeof globalThis.fetch  // Allow custom fetch (for Node.js < 18, mocking)
}

export class Joanium {
  private readonly http: HttpClient
  
  // Sub-clients as properties — lazy-initialized
  private _users?: UsersClient
  private _orders?: OrdersClient
  
  constructor(config: JoaniumConfig) {
    // Validate upfront — fail fast with helpful message
    if (!config.apiKey) {
      throw new Error(
        '[Joanium] apiKey is required. Get yours at https://dashboard.joanium.com/api-keys\n' +
        'Usage: new Joanium({ apiKey: process.env.JOANIUM_API_KEY })'
      )
    }
    if (!config.apiKey.startsWith('sk_')) {
      throw new Error(
        `[Joanium] apiKey appears invalid (received: "${config.apiKey.slice(0, 8)}..."). ` +
        'API keys start with "sk_". Check for typos or extra whitespace.'
      )
    }
    
    this.http = new HttpClient({
      baseUrl: config.baseUrl ?? 'https://api.joanium.com/v1',
      apiKey: config.apiKey,
      timeout: config.timeout ?? 30_000,
      maxRetries: config.maxRetries ?? 3,
      fetch: config.fetch ?? globalThis.fetch,
    })
  }
  
  // Lazy sub-client getters
  get users(): UsersClient {
    return (this._users ??= new UsersClient(this.http))
  }
  
  get orders(): OrdersClient {
    return (this._orders ??= new OrdersClient(this.http))
  }
  
  // Top-level convenience methods for main use case
  async analyze(text: string, options?: AnalyzeOptions): Promise<AnalysisResult> {
    return this.http.post('/analyze', { text, ...options })
  }
}
```

## HTTP Client (Shared Transport)
```typescript
class HttpClient {
  constructor(private readonly config: Required<JoaniumConfig>) {}

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.config.baseUrl}${path}`
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': `joanium-sdk-js/${SDK_VERSION}`,
      ...this.config.defaultHeaders,
    }

    for (let attempt = 1; attempt <= this.config.maxRetries + 1; attempt++) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.config.timeout)

      try {
        const response = await this.config.fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        })
        clearTimeout(timeout)

        if (response.ok) {
          return await response.json() as T
        }

        const error = await this.parseError(response)
        
        // Don't retry client errors
        if (response.status < 500 && response.status !== 429) throw error
        
        // Retry server errors and rate limits
        if (attempt <= this.config.maxRetries) {
          const delay = response.status === 429
            ? parseInt(response.headers.get('retry-after') ?? '5', 10) * 1000
            : Math.min(1000 * Math.pow(2, attempt - 1), 32_000) * (0.5 + Math.random() * 0.5)
          await sleep(delay)
          continue
        }
        throw error
      } catch (err: unknown) {
        clearTimeout(timeout)
        if (err instanceof JoaniumError) throw err
        if ((err as Error).name === 'AbortError') {
          throw new JoaniumError(`Request timed out after ${this.config.timeout}ms`, 'TIMEOUT', 408)
        }
        throw new JoaniumError(`Network error: ${(err as Error).message}`, 'NETWORK_ERROR', 0)
      }
    }
    throw new Error('unreachable')
  }

  async get<T>(path: string): Promise<T> { return this.request('GET', path) }
  async post<T>(path: string, body?: unknown): Promise<T> { return this.request('POST', path, body) }
  async patch<T>(path: string, body?: unknown): Promise<T> { return this.request('PATCH', path, body) }
  async delete<T>(path: string): Promise<T> { return this.request('DELETE', path) }

  private async parseError(response: Response): Promise<JoaniumError> {
    try {
      const body = await response.json()
      return new JoaniumError(body.error?.message ?? 'Unknown error', body.error?.code, response.status, body)
    } catch {
      return new JoaniumError(response.statusText, 'UNKNOWN', response.status)
    }
  }
}
```

# STRUCTURED ERRORS
```typescript
export class JoaniumError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly raw?: unknown,
  ) {
    super(message)
    this.name = 'JoaniumError'
  }
}

// Typed subclasses for instanceof checks
export class JoaniumAuthError extends JoaniumError {}
export class JoaniumRateLimitError extends JoaniumError {
  constructor(message: string, public readonly retryAfter?: number) {
    super(message, 'RATE_LIMITED', 429)
  }
}
export class JoaniumNotFoundError extends JoaniumError {}
export class JoaniumValidationError extends JoaniumError {
  constructor(
    message: string,
    public readonly errors: Array<{ field: string; message: string }>,
  ) { super(message, 'VALIDATION_ERROR', 422) }
}

// Error messages: always actionable
// WRONG: "Request failed"
// RIGHT: "API key invalid. Check your key at https://dashboard.joanium.com/api-keys"
// RIGHT: "Rate limit exceeded. Retry after 60 seconds."
// RIGHT: "Field 'language' must be a BCP 47 tag (e.g., 'en', 'fr', 'ja'). Received: 'english'"
```

# PACKAGE STRUCTURE
```
joanium-sdk/
├── src/
│   ├── index.ts            # Public exports — only what users should use
│   ├── client.ts           # Main Joanium class
│   ├── http.ts             # HttpClient (internal)
│   ├── errors.ts           # JoaniumError hierarchy
│   ├── resources/
│   │   ├── users.ts
│   │   ├── orders.ts
│   │   └── analyze.ts
│   ├── types/
│   │   ├── api.ts          # API request/response types
│   │   └── config.ts       # Config types
│   └── utils/
│       ├── pagination.ts
│       └── validation.ts
├── dist/                   # Built output (gitignored)
├── README.md
├── CHANGELOG.md
└── package.json
```

## package.json — Modern Exports
```json
{
  "name": "joanium",
  "version": "1.0.0",
  "description": "Official JavaScript SDK for the Joanium API",
  "main": "./dist/cjs/index.js",
  "module": "./dist/esm/index.js",
  "types": "./dist/types/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/esm/index.js",
      "require": "./dist/cjs/index.js",
      "types": "./dist/types/index.d.ts"
    }
  },
  "files": ["dist", "README.md"],
  "sideEffects": false,
  "engines": { "node": ">=18" },
  "keywords": ["joanium", "api", "sdk", "ai"],
  "peerDependencies": {},
  "devDependencies": {
    "typescript": "^5.0.0",
    "tsup": "^8.0.0",
    "vitest": "^1.0.0"
  }
}
```

## Build with tsup
```typescript
// tsup.config.ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,             // Generate .d.ts files
  splitting: false,      // Single bundle per format
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,         // Don't minify libraries — debugging matters
})
```

# DOCUMENTATION STANDARDS

## README Structure
```markdown
# Joanium SDK

One-sentence description. One-line install.

```bash
npm install joanium
```

## Quick Start

```typescript
import { Joanium } from 'joanium'

const client = new Joanium({ apiKey: process.env.JOANIUM_API_KEY! })
const result = await client.analyze('Your text here')
console.log(result.summary)
```

That's it. No configuration required.

## Usage

[Most common tasks with working examples]

## Configuration

[All config options with types and defaults]

## Error Handling

[How to catch and handle errors with code example]

## TypeScript

[Types are included — no @types/ package needed]

## License
```

## JSDoc on Every Public API
```typescript
/**
 * Analyze text for sentiment, topics, and generate a summary.
 *
 * @example
 * ```typescript
 * const result = await client.analyze('Meeting notes from Q3 review...')
 * console.log(result.summary)   // "Q3 performance exceeded targets..."
 * console.log(result.sentiment) // "positive"
 * ```
 *
 * @param text - The text to analyze. Must be between 10 and 100,000 characters.
 * @param options - Optional configuration
 * @throws {JoaniumValidationError} If text is too short or too long
 * @throws {JoaniumAuthError} If the API key is invalid or expired
 * @throws {JoaniumRateLimitError} If the rate limit is exceeded
 * @see https://docs.joanium.com/analyze
 */
async analyze(text: string, options?: AnalyzeOptions): Promise<AnalysisResult>
```

# VERSIONING & COMPATIBILITY
```
SEMVER — strictly follow it:
  1.0.0 → 1.0.1: Bug fix (no API change)
  1.0.0 → 1.1.0: New feature (backwards compatible)
  1.0.0 → 2.0.0: Breaking change (rename, remove, change behavior)

WHAT IS A BREAKING CHANGE:
  ✗ Removing a method or property
  ✗ Renaming a method or property
  ✗ Changing parameter types (stricter)
  ✗ Changing return types (fewer fields)
  ✗ Changing error types thrown
  ✗ Changing default behavior

NOT BREAKING:
  ✓ Adding new optional parameters at the end
  ✓ Adding new fields to response objects
  ✓ Adding new methods
  ✓ Widening parameter types (accepting more)
  ✓ Adding new error subclasses (instanceof still works)

DEPRECATION PROCESS:
  1. Add @deprecated JSDoc tag — IDE will show strikethrough
  2. Log console.warn in dev mode: '[Joanium] .analyze() is deprecated, use .text.analyze() instead'
  3. Keep the old method working for 1 major version minimum
  4. Remove in the next major version with migration guide in CHANGELOG
```

# TESTING
```typescript
// Mock the HTTP layer — test SDK logic, not the network

import { Joanium, JoaniumError } from 'joanium'
import { vi, describe, it, expect, beforeEach } from 'vitest'

describe('Joanium SDK', () => {
  let client: Joanium
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    client = new Joanium({
      apiKey: 'sk_test_123',
      fetch: mockFetch,
    })
  })

  it('analyzes text and returns result', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'ana_123',
        summary: 'Test summary',
        sentiment: 'positive',
        confidence: 0.92,
        topics: ['technology'],
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      }),
    })
    
    const result = await client.analyze('Test text')
    expect(result.summary).toBe('Test summary')
    expect(result.sentiment).toBe('positive')
    
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/analyze'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Authorization': 'Bearer sk_test_123' }),
      })
    )
  })

  it('retries on 503 and succeeds', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ error: {} }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'ana_123', summary: 'ok' }) })
    
    const result = await client.analyze('text', { maxRetries: 1 })
    expect(result.summary).toBe('ok')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('throws on invalid API key', () => {
    expect(() => new Joanium({ apiKey: '' }))
      .toThrow('[Joanium] apiKey is required')
  })
})
```
