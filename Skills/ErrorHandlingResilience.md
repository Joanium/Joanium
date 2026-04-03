---
name: Error Handling & Resilience
trigger: error handling, resilience, circuit breaker, retry logic, timeout, bulkhead, fallback, graceful degradation, fault tolerance, exponential backoff, dead letter queue, health check, chaos engineering, error boundary, structured errors, custom errors, error classification, Result type
description: Build systems that fail gracefully. Covers error classification, structured error types, retry with backoff, circuit breakers, timeouts, bulkheads, fallbacks, health checks, and designing APIs that communicate failure clearly.
---

# ROLE
You are a resilience engineer. Your job is to make systems that degrade gracefully under failure — not crash. Every external call will eventually fail; every database will occasionally time out; every third party will have an incident. Design for this. The difference between a production-ready system and a fragile demo is how it handles the unhappy path.

# CORE PRINCIPLES
```
FAILURE IS NORMAL:      Networks fail, services go down, databases time out — plan for it
FAIL FAST:              Return an error immediately when you know something will fail
FAIL SAFE:              When in doubt, choose the safer outcome (deny > crash)
BOUNDED RETRIES:        Unlimited retries = DDOS-ing a struggling service
COMMUNICATE CLEARLY:    Error messages should tell the caller exactly what happened and what to do
OBSERVE EVERYTHING:     An error that isn't logged never gets fixed
ISOLATE FAILURES:       One failing component shouldn't cascade to the whole system
```

# ERROR CLASSIFICATION

## The Four Categories
```
TRANSIENT:     Temporary, should retry with backoff
  HTTP 429    → Too many requests — wait for Retry-After, then retry
  HTTP 503    → Service unavailable — retry with backoff
  Network timeout → retry
  DB connection pool exhausted → retry

PERMANENT:     Do not retry — the input is wrong or the resource doesn't exist
  HTTP 400    → Bad request — retrying with same payload = same error
  HTTP 404    → Not found — retrying won't create the resource
  HTTP 422    → Validation error — fix the request, don't retry
  HTTP 401/403 → Auth failure — refresh credentials, but not automatic retry

CLIENT ERROR:  Caller's problem — surface to them with clear message
  Missing required field
  Invalid format
  Resource conflict (409)

SERVER ERROR:  Your problem — don't leak internals; log fully, respond opaquely
  Database error
  Null reference
  Unhandled exception
```

# STRUCTURED ERROR TYPES

## TypeScript Error Hierarchy
```typescript
// Base application error — all app errors extend this
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,           // Machine-readable: USER_NOT_FOUND
    public readonly statusCode: number,     // HTTP status
    public readonly isOperational = true,   // false = programmer error (crash-worthy)
    public readonly context?: Record<string, unknown>,
  ) {
    super(message)
    this.name = new.target.name
    Error.captureStackTrace(this, new.target)
  }
}

// Specific error types
export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(
      `${resource} with id '${id}' not found`,
      'NOT_FOUND',
      404,
    )
  }
}

export class ValidationError extends AppError {
  constructor(
    public readonly errors: Array<{ field: string; message: string; code: string }>,
  ) {
    super('Request validation failed', 'VALIDATION_ERROR', 422)
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code = 'CONFLICT') {
    super(message, code, 409)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 'UNAUTHORIZED', 401)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, 'FORBIDDEN', 403)
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, originalError: unknown) {
    super(
      `External service '${service}' failed`,
      'EXTERNAL_SERVICE_ERROR',
      502,
      true,  // operational — retry might work
      { service, originalError: String(originalError) },
    )
  }
}

// Usage
const user = await db.users.findUnique({ where: { id } })
if (!user) throw new NotFoundError('User', id)

if (user.role !== 'admin') throw new ForbiddenError()
```

## Global Error Handler (Express)
```typescript
// Centralized error handler — catches everything thrown in route handlers
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  // Structured logging: always log full error with context
  const requestId = req.headers['x-request-id'] as string ?? crypto.randomUUID()

  if (err instanceof AppError && err.isOperational) {
    // Expected error — log at warn level
    logger.warn('Operational error', {
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
      context: err.context,
      requestId,
      userId: req.user?.id,
      path: req.path,
    })

    // Validation error: include field-level details
    if (err instanceof ValidationError) {
      return res.status(422).json({
        error: { code: err.code, message: err.message, details: err.errors, requestId },
      })
    }

    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, requestId },
    })
  }

  // Unexpected error — log at error level with full stack trace
  logger.error('Unexpected error', {
    message: err.message,
    stack: err.stack,
    requestId,
    userId: req.user?.id,
    path: req.path,
    body: req.body,
  })

  // Never leak stack traces or internal messages to clients
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.', requestId },
  })
})
```

# RETRY PATTERNS

## Exponential Backoff with Jitter
```typescript
interface RetryOptions {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
  retryOn?: (err: unknown) => boolean
}

async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 30_000 },
): Promise<T> {
  const isRetryable = opts.retryOn ?? ((err: unknown) => {
    if (err instanceof AppError) return err.statusCode >= 500 || err.statusCode === 429
    return true  // Unknown errors: retry (network failures, etc.)
  })

  let lastError: unknown
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err

      if (attempt === opts.maxAttempts || !isRetryable(err)) {
        throw err
      }

      // Exponential backoff with full jitter
      const exponentialDelay = opts.baseDelayMs * Math.pow(2, attempt - 1)
      const cappedDelay = Math.min(exponentialDelay, opts.maxDelayMs)
      const jitteredDelay = Math.random() * cappedDelay   // Full jitter prevents thundering herd

      logger.debug('Retrying after error', { attempt, delay: jitteredDelay, error: String(err) })
      await sleep(jitteredDelay)
    }
  }
  throw lastError
}

// Respect Retry-After header from rate limit responses
async function withRateLimitAwareRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err: any) {
    if (err.response?.status === 429) {
      const retryAfter = parseInt(err.response.headers['retry-after'] ?? '60', 10)
      await sleep(retryAfter * 1000)
      return fn()  // One retry after the specified wait
    }
    throw err
  }
}
```

# CIRCUIT BREAKER

## Pattern: Stop Calling Failing Services
```
CLOSED (healthy):   Requests pass through; count failures
     ↓ (failure threshold exceeded)
OPEN (failing):     Reject all requests immediately; don't call the failing service
     ↓ (timeout elapsed)
HALF-OPEN (testing): Allow one probe request; if it succeeds → CLOSED; if it fails → OPEN again
```

```typescript
type CircuitState = 'closed' | 'open' | 'half-open'

class CircuitBreaker {
  private state: CircuitState = 'closed'
  private failureCount = 0
  private lastFailureTime?: number
  
  constructor(
    private readonly opts: {
      failureThreshold: number    // failures before opening (e.g., 5)
      recoveryTimeMs: number      // ms before trying again (e.g., 30_000)
      successThreshold: number    // successes in half-open before closing (e.g., 2)
    }
  ) {}

  async execute<T>(fn: () => Promise<T>, fallback?: () => T): Promise<T> {
    if (this.state === 'open') {
      const elapsed = Date.now() - (this.lastFailureTime ?? 0)
      if (elapsed > this.opts.recoveryTimeMs) {
        this.state = 'half-open'
      } else {
        if (fallback) return fallback()
        throw new ExternalServiceError('Circuit open', 'Circuit breaker is OPEN')
      }
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (err) {
      this.onFailure()
      if (fallback) return fallback()
      throw err
    }
  }

  private onSuccess() {
    this.failureCount = 0
    this.state = 'closed'
  }

  private onFailure() {
    this.failureCount++
    this.lastFailureTime = Date.now()
    if (this.failureCount >= this.opts.failureThreshold) {
      this.state = 'open'
      logger.warn('Circuit breaker OPENED', { failureCount: this.failureCount })
    }
  }

  getState(): CircuitState { return this.state }
}

// Usage
const paymentCircuit = new CircuitBreaker({
  failureThreshold: 5,
  recoveryTimeMs: 30_000,
  successThreshold: 2,
})

async function chargeCard(amount: number) {
  return paymentCircuit.execute(
    () => stripe.charges.create({ amount }),
    () => { throw new ExternalServiceError('Stripe', 'Temporarily unavailable') }
  )
}
```

# TIMEOUT PATTERN
```typescript
// Every external call must have a timeout — without one, one slow dependency hangs your whole server

function withTimeout<T>(promise: Promise<T>, ms: number, context: string): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout>
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new AppError(`${context} timed out after ${ms}ms`, 'TIMEOUT', 504)),
      ms
    )
  })

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutHandle))
}

// In practice — always set timeouts on:
const user = await withTimeout(db.users.findUnique({ where: { id } }), 5_000, 'DB query')
const result = await withTimeout(fetch('https://api.partner.com/data'), 10_000, 'Partner API')

// Node.js: also set DB connection timeout in connection string
// PostgreSQL: ?connect_timeout=5&statement_timeout=5000
// Redis: connectTimeout: 5000, commandTimeout: 3000
```

# BULKHEAD PATTERN
```typescript
// Isolate resources so one overloaded feature can't starve everything else
// Analogy: watertight compartments in a ship — one breach doesn't sink the whole vessel

class Bulkhead {
  private running = 0
  private queue: Array<() => void> = []
  
  constructor(
    private readonly maxConcurrent: number,
    private readonly maxQueued: number = 10,
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running >= this.maxConcurrent) {
      if (this.queue.length >= this.maxQueued) {
        throw new AppError('Service too busy', 'TOO_MANY_REQUESTS', 429)
      }
      await new Promise<void>(resolve => this.queue.push(resolve))
    }

    this.running++
    try {
      return await fn()
    } finally {
      this.running--
      const next = this.queue.shift()
      if (next) next()
    }
  }
}

// Separate bulkheads for different resource pools
const reportsBulkhead = new Bulkhead(3)     // Max 3 concurrent heavy report jobs
const emailBulkhead = new Bulkhead(10)      // Max 10 concurrent email sends
const thumbnailBulkhead = new Bulkhead(5)   // Max 5 concurrent image resizes

// Heavy operations won't block interactive requests
async function generateReport(params: ReportParams) {
  return reportsBulkhead.execute(() => buildReport(params))
}
```

# RESULT TYPE (FUNCTIONAL APPROACH)
```typescript
// Alternative to throw/catch: explicit Result type
// Callers must handle errors — they're in the type signature

type Ok<T>  = { ok: true;  value: T }
type Err<E> = { ok: false; error: E }
type Result<T, E = AppError> = Ok<T> | Err<E>

const Ok  = <T>(value: T): Ok<T>   => ({ ok: true, value })
const Err = <E>(error: E): Err<E>  => ({ ok: false, error })

async function findUser(id: string): Promise<Result<User>> {
  const user = await db.users.findUnique({ where: { id } })
  if (!user) return Err(new NotFoundError('User', id))
  return Ok(user)
}

// Caller must handle both cases — no implicit exception
const result = await findUser(userId)
if (!result.ok) {
  return res.status(result.error.statusCode).json({ error: result.error.message })
}
const user = result.value  // TypeScript knows this is User
```

# HEALTH CHECKS
```typescript
// Health check endpoint — used by load balancers, Kubernetes, monitors

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  checks: Record<string, { status: string; latencyMs?: number; error?: string }>
  version: string
  uptime: number
}

app.get('/health', async (req, res) => {
  const checks: HealthStatus['checks'] = {}
  let overallStatus: HealthStatus['status'] = 'healthy'

  // Database
  const dbStart = Date.now()
  try {
    await db.$queryRaw`SELECT 1`
    checks.database = { status: 'healthy', latencyMs: Date.now() - dbStart }
  } catch (err) {
    checks.database = { status: 'unhealthy', error: 'Connection failed' }
    overallStatus = 'unhealthy'
  }

  // Redis
  const redisStart = Date.now()
  try {
    await redis.ping()
    checks.redis = { status: 'healthy', latencyMs: Date.now() - redisStart }
  } catch (err) {
    checks.redis = { status: 'degraded', error: 'Cache unavailable' }
    if (overallStatus === 'healthy') overallStatus = 'degraded'
  }

  // External dependencies (non-critical — don't fail health check)
  try {
    await withTimeout(fetch('https://api.stripe.com/v1'), 2000, 'Stripe')
    checks.stripe = { status: 'healthy' }
  } catch {
    checks.stripe = { status: 'degraded' }  // Degraded, not unhealthy
    if (overallStatus === 'healthy') overallStatus = 'degraded'
  }

  const httpStatus = overallStatus === 'unhealthy' ? 503 : 200
  res.status(httpStatus).json({
    status: overallStatus,
    checks,
    version: process.env.npm_package_version,
    uptime: process.uptime(),
  })
})

// Separate readiness vs liveness (for Kubernetes):
// /health/live  → is the process alive? (return 200 unless process is broken)
// /health/ready → is it ready to accept traffic? (check DB, cache, etc.)
```

# GRACEFUL SHUTDOWN
```typescript
// Handle SIGTERM: finish in-flight requests before exiting
// Without this: active requests are killed mid-flight on deploy

const server = app.listen(PORT)
let isShuttingDown = false

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received — starting graceful shutdown')
  isShuttingDown = true

  // Stop accepting new requests
  server.close(async () => {
    logger.info('HTTP server closed')

    // Drain in-flight work
    await Promise.allSettled([
      db.$disconnect(),
      redis.quit(),
      queue.close(),    // Stop accepting new jobs; finish current ones
    ])

    logger.info('Graceful shutdown complete')
    process.exit(0)
  })

  // Force exit if graceful shutdown takes too long
  setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit')
    process.exit(1)
  }, 30_000)
})

// Middleware: reject new requests during shutdown
app.use((req, res, next) => {
  if (isShuttingDown) {
    res.setHeader('Connection', 'close')
    return res.status(503).json({ error: { code: 'SHUTTING_DOWN', message: 'Service restarting' } })
  }
  next()
})
```

# CHECKLIST
```
Errors:
[ ] Custom AppError hierarchy — no raw `throw new Error('message')`
[ ] Every error has a machine-readable code, HTTP status, and human message
[ ] Validation errors include field-level details
[ ] Global error handler catches everything; never crashes the process
[ ] Stack traces logged server-side; never sent to clients

Resilience:
[ ] All external calls have timeouts (DB, HTTP, cache)
[ ] Retry logic with exponential backoff + jitter for transient errors
[ ] Permanent errors (4xx) are NOT retried
[ ] Circuit breaker on critical external dependencies
[ ] Bulkheads isolate heavy operations from interactive requests

Operations:
[ ] /health endpoint checks DB, cache, and critical dependencies
[ ] Separate /health/live and /health/ready (for Kubernetes)
[ ] SIGTERM handler drains in-flight requests before exit
[ ] Every error logged with requestId, userId, and full context
[ ] Alerts on: error rate spikes, circuit breaker opens, health check failures
```
