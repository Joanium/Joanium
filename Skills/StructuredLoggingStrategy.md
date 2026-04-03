---
name: Structured Logging Strategy
trigger: logging, structured logs, log aggregation, log levels, correlation ID, trace ID, request logging, log format, JSON logs, Pino, Winston, log pipeline, ELK stack, Loki, Datadog logs, log sampling, log retention, sensitive data in logs, PII in logs, log context, log enrichment, centralized logging
description: Design a structured, observable, and secure logging strategy. Covers log format, levels, correlation IDs, context propagation, sensitive data handling, log pipeline selection, sampling, and alerting on log patterns.
---

# ROLE
You are a platform reliability engineer. Your job is to make systems observable and debuggable. Logs are your first line of defense when something breaks in production — unstructured, inconsistent, or missing logs turn a 5-minute debug into a 5-hour fire. Get logging right from the start.

# CORE PRINCIPLES
```
STRUCTURED FROM DAY ONE: JSON logs, not printf strings. Machines read logs, structure enables search.
ONE SOURCE PER LOG LINE:  Each log statement says one thing clearly. No concatenated novels.
CONTEXT, NOT DUPLICATION: Don't repeat the same fields on every logger.info() — use child loggers.
NEVER LOG PII BY DEFAULT: Email, phone, name, SSN, payment data must be explicitly masked or excluded.
LOG THE DECISION, NOT THE DATA: "payment failed: insufficient funds" not "card number 4111..."
CORRELATION IDS ARE MANDATORY: Every log line must be traceable to the originating request.
```

# LOG FORMAT STANDARD

## The Canonical Log Line
```json
{
  "timestamp": "2024-05-01T10:30:15.432Z",
  "level": "info",
  "message": "Payment processed successfully",

  // Request context — set once, inherited by all log lines in this request
  "request_id": "req_01HZABC123",
  "correlation_id": "corr_01HZ987XYZ",   // from upstream caller (X-Correlation-ID header)
  "trace_id": "4bf92f3577b34da6",         // OpenTelemetry trace ID
  "span_id": "00f067aa0ba902b7",

  // Service identity — set at logger initialization
  "service": "payment-service",
  "version": "2.4.1",
  "environment": "production",
  "host": "ip-10-0-1-45",

  // Business context — set at authentication/authorization boundary
  "tenant_id": "tenant_abc",
  "user_id": "user_456",                  // internal ID, NOT email
  "session_id": "sess_789",

  // Event-specific fields
  "payment_id": "pay_123",
  "amount_cents": 4999,
  "currency": "USD",
  "duration_ms": 142,
  "status": "success"
}
```

# LOG LEVELS — WHEN TO USE WHAT

## Level Definitions (Be Strict)
```
ERROR — Something broke and requires immediate attention.
  → Use when: an operation failed and user is impacted or data is at risk
  → Triggers: alert/page
  → Examples: database connection lost, payment processing failure, uncaught exception
  → NOT for: expected failures (user inputs wrong password), 4xx HTTP errors

WARN — Something unexpected happened but the system handled it.
  → Use when: degraded state, fallback used, approaching a limit
  → Triggers: dashboard alert (not page)
  → Examples: cache miss rate > 50%, rate limit approaching, retrying failed request, deprecated API used
  → NOT for: normal recoverable conditions

INFO — Normal operational events worth recording for audit/debugging.
  → Use when: significant business events, request completed, scheduled job ran
  → No alerting
  → Examples: user registered, order placed, payment authorized, cron job completed
  → NOT for: every function call, trivial state changes

DEBUG — Detailed information for debugging specific issues.
  → Disabled in production by default (log volume would be enormous)
  → Enable per-service or per-request when debugging
  → Examples: intermediate state, variable values, logic branches taken

TRACE — Even more granular than debug. Almost never in app code.
  → Framework/library internals, SQL queries, HTTP request/response bodies
```

## The Golden Rule for Level Selection
```
Ask: "Would I want to be woken up at 3am because of this?" 
  → Yes → ERROR
Ask: "Does this represent the system doing something unexpected but handled?"
  → Yes → WARN
Ask: "Is this a meaningful business or operational event?"
  → Yes → INFO
Ask: "Is this detail useful only when actively debugging?"
  → Yes → DEBUG or TRACE
```

# SETTING UP PINO (Node.js)

## Logger Setup
```javascript
// logger.js
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  
  // Base fields on every log line
  base: {
    service: process.env.SERVICE_NAME || 'unknown-service',
    version: process.env.APP_VERSION || '0.0.0',
    environment: process.env.NODE_ENV || 'development'
  },
  
  // Timestamp as ISO string
  timestamp: pino.stdTimeFunctions.isoTime,
  
  // Redact sensitive fields wherever they appear in log objects
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'body.password',
      'body.creditCard',
      'body.ssn',
      '*.password',
      '*.token',
      '*.secret',
      '*.apiKey',
      '*.credit_card'
    ],
    censor: '[REDACTED]'
  },
  
  // Human-readable in dev, JSON in prod
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'HH:MM:ss.l' }
  } : undefined
});
```

## Request-Scoped Child Logger (Context Propagation)
```javascript
// middleware/requestLogger.js
export function requestLoggerMiddleware(req, res, next) {
  // Generate or inherit correlation ID
  const correlationId = req.headers['x-correlation-id'] || generateId('corr');
  const requestId = generateId('req');
  
  // Create child logger with request context — all subsequent logs in this request
  // inherit these fields automatically
  req.log = logger.child({
    request_id: requestId,
    correlation_id: correlationId,
    method: req.method,
    path: req.path,
    user_agent: req.headers['user-agent']?.slice(0, 100)  // truncate, never full UA
  });
  
  // Propagate correlation ID downstream
  res.setHeader('X-Correlation-ID', correlationId);
  res.setHeader('X-Request-ID', requestId);
  
  const startTime = Date.now();
  
  // Log request received at DEBUG (not INFO — too noisy in high-traffic APIs)
  req.log.debug({ query: req.query }, 'Request received');  // query params OK, body is not
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    
    req.log[level]({
      status: res.statusCode,
      duration_ms: duration,
      bytes: res.get('content-length')
    }, 'Request completed');
    
    metrics.histogram('http.request.duration', duration, {
      method: req.method,
      path: req.route?.path || 'unknown',  // normalized path, not raw URL
      status: String(res.statusCode)
    });
  });
  
  next();
}

// After auth middleware, enrich the logger with user context
export function enrichLoggerWithUser(req, res, next) {
  if (req.user) {
    req.log = req.log.child({
      user_id: req.user.id,  // ID, never email/name
      tenant_id: req.user.tenantId,
      role: req.user.role
    });
  }
  next();
}
```

## Usage in Route Handlers
```javascript
app.post('/orders', authenticate, async (req, res) => {
  const { log } = req;
  
  // Use req.log — not the global logger — to preserve request context
  log.info({ item_count: req.body.items?.length }, 'Creating order');
  
  try {
    const order = await orderService.create(req.body, req.user);
    
    log.info({
      order_id: order.id,
      total_cents: order.totalCents,
      item_count: order.items.length
    }, 'Order created');
    
    res.status(201).json(order);
  } catch (err) {
    if (err instanceof ValidationError) {
      log.warn({ errors: err.details }, 'Order validation failed');
      return res.status(400).json({ error: 'validation_failed', details: err.details });
    }
    
    log.error({ err }, 'Unexpected error creating order');  // pino serializes Error objects
    res.status(500).json({ error: 'internal_error' });
  }
});
```

# SENSITIVE DATA HANDLING

## What Never Goes Into Logs
```
NEVER LOG:
  × Passwords (even hashed)
  × Full credit card numbers (PAN)
  × CVV / CVC
  × SSN / National ID numbers
  × Full bank account numbers
  × Authentication tokens, API keys, OAuth tokens
  × Session IDs (link to sessions that can be replayed)
  × Private keys / certificates
  × Medical/health information (HIPAA)
  × Full email addresses in high-volume logs (aggregate instead)

LOG SAFELY (transformed):
  ✓ Last 4 digits of card: "****1234"
  ✓ Masked email: "jo***@gmail.com"
  ✓ User ID (internal, not PII): "user_456"
  ✓ Order ID, not order contents
  ✓ Error codes, not error payloads from third parties (may contain PII)

// Masking utility
function maskEmail(email) {
  const [user, domain] = email.split('@');
  return `${user.slice(0, 2)}***@${domain}`;
}

function maskCard(last4) {
  return `****${last4}`;
}
```

# LOG PIPELINE & AGGREGATION

## Stack Selection
```
Self-hosted, all-in-one, cost-sensitive:
  → Grafana Loki + Promtail — optimized for log aggregation, tight Grafana integration
  → Elasticsearch (OpenSearch) + Logstash/Filebeat — powerful but resource-heavy

Managed cloud:
  → Datadog Logs — expensive but exceptional UX, tight APM integration
  → AWS CloudWatch Logs → Insights — if already on AWS, low friction
  → Google Cloud Logging — GKE native
  → Axiom — excellent price/performance, SQL queries over logs

Hybrid (cheap at scale):
  → Ship to S3 (long-term archive) + Loki (hot search) simultaneously
  → S3: $0.023/GB storage; Loki: query only what you need

Pipeline pattern:
  App → stdout (JSON) → Log shipper (Fluentd/Vector/Promtail) → Aggregator → Dashboard
  
  Do NOT write log files in containers — write to stdout, let the container runtime handle it
```

## Vector (Log Shipper) Config
```yaml
# vector.yaml — collect, transform, route logs
sources:
  app_logs:
    type: docker_logs
    
transforms:
  parse_json:
    type: remap
    inputs: [app_logs]
    source: |
      . = parse_json!(.message)
      # Drop debug logs in production to reduce volume
      if .level == "debug" {
        abort
      }

sinks:
  loki:
    type: loki
    inputs: [parse_json]
    endpoint: http://loki:3100
    labels:
      service: "{{ service }}"
      environment: "{{ environment }}"
      level: "{{ level }}"
  
  s3_archive:
    type: aws_s3
    inputs: [parse_json]
    bucket: my-log-archive
    key_prefix: "logs/{{ environment }}/{{ service }}/%Y/%m/%d/"
    compression: gzip
```

# LOG SAMPLING

## Reduce Volume for High-Traffic Services
```javascript
// Don't log every 200 OK in a service doing 10K req/sec — that's 864M logs/day
// Sample based on status code and latency

function shouldLogRequest(statusCode, durationMs) {
  if (statusCode >= 500) return true;        // always log errors
  if (statusCode >= 400) return true;        // always log client errors
  if (durationMs > 1000) return true;        // always log slow requests
  if (Math.random() < 0.01) return true;     // sample 1% of successful fast requests
  return false;
}

// Or use head-based sampling: sample entire traces, not individual logs
// This preserves trace completeness while reducing volume
```

# ALERTING ON LOG PATTERNS

## Logs → Metrics → Alerts
```
Pattern: extract metrics from log fields, alert on metrics — not raw log text

// Grafana Loki alert examples:
rate({service="payment-service", level="error"}[5m]) > 0.5
  → Alert if payment service logs more than 0.5 errors/sec

count_over_time({service="auth"} |= "authentication failed" [10m]) > 100
  → Alert on potential brute force attack

// Datadog log-based monitor:
// Filter: service:payment level:error
// Threshold: > 5 occurrences in 5 minutes → page

// AVOID alerting on raw log strings — they change, break alerts
// PREFER: error counter metrics incremented in code, alerted from metrics system
```

# PRODUCTION CHECKLIST
```
[ ] All logs are JSON / structured — no printf strings in production code
[ ] Log level configuration via environment variable (LOG_LEVEL)
[ ] Request ID generated per request, included on every log line
[ ] Correlation ID propagated from upstream via X-Correlation-ID header
[ ] Child logger created per request — no global logger.info() with manual fields
[ ] Logger enriched with user_id and tenant_id after authentication
[ ] Redaction configured for: passwords, tokens, card numbers, SSN, cookies
[ ] Request body NOT logged by default — only specific safe fields
[ ] HTTP access log includes: method, path (normalized), status, duration, user_id
[ ] Background job logs include: job_id, job_type, attempt, duration, outcome
[ ] ERROR level used only for actual failures — not validation errors (those are WARN)
[ ] Log shipper configured (Fluentd/Vector/Promtail) — not writing to disk in containers
[ ] Centralized aggregation set up (Loki, Datadog, etc.) with 30-day hot retention
[ ] S3 archive for long-term retention (90 days+) for compliance
[ ] High-traffic endpoints use sampling (1-5%) for 200 OK logs
[ ] Alerts configured on error rate, not raw log text
[ ] Log retention policy defined and compliant with regulations (GDPR etc.)
[ ] Runbook exists for "why are my logs missing?" — check shipper, aggregator, index
```
