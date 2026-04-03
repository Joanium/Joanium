---
name: Rate Limiting & API Gateway
trigger: rate limiting, throttling, API gateway, rate limit, quota, token bucket, leaky bucket, sliding window, request throttling, API protection, DDoS protection, abuse prevention, API quotas, per-user limits, burst limits, NGINX rate limit, Redis rate limit, Kong, API management
description: Design and implement robust rate limiting, throttling, and API gateway patterns. Covers algorithm selection, per-user/tier quotas, distributed rate limiting with Redis, burst handling, and gateway configuration.
---

# ROLE
You are an API platform engineer. Your job is to protect services from overload, abuse, and runaway clients — while giving legitimate users a fair, transparent, and predictable experience. A rate limiter that's opaque or misconfigured is worse than useless: it creates user frustration without preventing harm.

# CORE PRINCIPLES
```
FAIL OPEN VS CLOSED:  If your rate limiter crashes, decide: block all traffic or allow all?
                      → Blocking all = safe but takes down your service too
                      → Allowing all = service exposed but stays up; fine if limits aren't safety-critical
COMMUNICATE CLEARLY:  Always return Retry-After and X-RateLimit-* headers. Silent 429s are hostile.
LIMIT BY IDENTITY:    User ID > API Key > IP. IP is the last resort (easily spoofed, unfair for NAT)
TIER YOUR LIMITS:     Free → Paid → Premium → Enterprise. Rate limits are a product decision.
OBSERVE BEFORE BLOCKING: Shadow mode first — log who would be limited before you actually limit them
```

# ALGORITHM SELECTION

## The Four Algorithms
```
TOKEN BUCKET (most common, recommended default):
  → Bucket holds N tokens. Each request consumes 1 token.
  → Refill at fixed rate (e.g., 100 tokens/sec). Bucket caps at max capacity.
  → Allows bursts up to bucket size, then smooths to refill rate.
  → Best for: APIs where bursts are acceptable (users sending a batch)

LEAKY BUCKET:
  → Requests queue up; process at fixed rate. Excess dropped.
  → Smooths traffic completely — no bursts allowed.
  → Best for: downstream services that can't handle bursts (payment processors, SMS)

FIXED WINDOW:
  → Count requests in a window (e.g., 100 per minute). Reset at window boundary.
  → Simple, cheap. Problem: 2x burst at window boundary (50 requests end + 50 start)
  → Acceptable for: loose limits, internal tools, coarse rate limiting

SLIDING WINDOW LOG:
  → Track timestamp of every request. Count requests in last N seconds.
  → Accurate, no boundary burst. Cost: O(N) memory per user (N = limit).
  → Best for: strict rate limiting where fairness is critical

SLIDING WINDOW COUNTER (hybrid, recommended):
  → Approximate sliding window using two fixed windows + weighted interpolation
  → 99% accuracy of sliding log, O(1) memory. Best of both worlds.
  → Redis implementation: two keys per user, cheap atomic operations

Pick: Token Bucket for most APIs. Sliding Window Counter for billing-critical limits.
```

## Token Bucket in Redis
```lua
-- Lua script for atomic token bucket in Redis
-- KEYS[1] = bucket key  ARGV[1] = capacity  ARGV[2] = refill_rate (tokens/sec)
-- ARGV[3] = requested_tokens  ARGV[4] = current_time (ms)

local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local requested = tonumber(ARGV[3])
local now = tonumber(ARGV[4])

local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1]) or capacity
local last_refill = tonumber(bucket[2]) or now

-- Refill tokens based on elapsed time
local elapsed = (now - last_refill) / 1000  -- convert ms to seconds
tokens = math.min(capacity, tokens + elapsed * refill_rate)

if tokens >= requested then
    -- Allow request
    tokens = tokens - requested
    redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
    redis.call('EXPIRE', key, math.ceil(capacity / refill_rate) + 1)
    return {1, math.floor(tokens)}  -- allowed, remaining
else
    -- Deny request
    redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
    local retry_after = math.ceil((requested - tokens) / refill_rate)
    return {0, retry_after}  -- denied, retry_after seconds
end
```

## Sliding Window Counter
```python
import redis
import time

class SlidingWindowRateLimiter:
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client

    def is_allowed(self, key: str, limit: int, window_seconds: int) -> tuple[bool, dict]:
        now = time.time()
        window_start = now - window_seconds
        
        current_window_key = f"rl:{key}:{int(now // window_seconds)}"
        prev_window_key = f"rl:{key}:{int(now // window_seconds) - 1}"
        
        pipe = self.redis.pipeline()
        pipe.get(prev_window_key)
        pipe.incr(current_window_key)
        pipe.expire(current_window_key, window_seconds * 2)
        prev_count, current_count, _ = pipe.execute()
        
        prev_count = int(prev_count or 0)
        current_count = int(current_count)
        
        # Weight previous window by how far through current window we are
        elapsed_fraction = (now % window_seconds) / window_seconds
        weighted_count = prev_count * (1 - elapsed_fraction) + current_count
        
        remaining = max(0, limit - int(weighted_count))
        allowed = weighted_count <= limit
        
        if not allowed:
            # Roll back the increment
            self.redis.decr(current_window_key)
        
        return allowed, {
            "limit": limit,
            "remaining": remaining,
            "reset": int(now // window_seconds + 1) * window_seconds,
            "retry_after": int((weighted_count - limit) / (limit / window_seconds)) if not allowed else 0
        }
```

# RESPONSE HEADERS (Always Return These)

## Standard Headers
```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 1000          # requests allowed in this window
X-RateLimit-Remaining: 487       # requests remaining in this window
X-RateLimit-Reset: 1714521600    # Unix timestamp when window resets
X-RateLimit-Policy: 1000;w=3600  # RFC 9110 draft: limit;window
Retry-After: 30                  # seconds to wait (on 429 ONLY)

# On 429 Too Many Requests:
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 30
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1714521600

{
  "error": "rate_limit_exceeded",
  "message": "You have exceeded the rate limit of 1000 requests per hour.",
  "retry_after": 30,
  "limit": 1000,
  "reset_at": "2024-05-01T00:00:00Z",
  "docs": "https://docs.yourapi.com/rate-limits"
}
```

# LIMIT STRATEGY BY TIER

## Tiered Quota Design
```
DIMENSION 1 — Request rate (requests/second or requests/minute):
  Prevents bursts that overload the server

DIMENSION 2 — Request quota (requests/day or requests/month):
  Controls total consumption, maps to billing

DIMENSION 3 — Concurrency (simultaneous open connections/requests):
  Prevents one user from holding all connections

DIMENSION 4 — Data rate (MB/hour for uploads/downloads):
  Controls bandwidth, not just request count

Example tier table:
┌──────────────┬──────────┬──────────────┬───────────────┬─────────────┐
│ Tier         │ Rate     │ Daily Quota  │ Burst         │ Concurrency │
├──────────────┼──────────┼──────────────┼───────────────┼─────────────┤
│ Free         │ 10 rpm   │ 100 req/day  │ 20 rpm (10s)  │ 2           │
│ Starter      │ 60 rpm   │ 5K req/day   │ 120 rpm (10s) │ 5           │
│ Pro          │ 300 rpm  │ 50K req/day  │ 600 rpm (10s) │ 10          │
│ Enterprise   │ Custom   │ Custom       │ Custom        │ 50+         │
└──────────────┴──────────┴──────────────┴───────────────┴─────────────┘

Burst = 2x rate limit sustained for 10 seconds → absorbs legitimate spikes
```

## Per-Endpoint Limits (Don't Use One Global Limit)
```
GET /search           → 30 rpm   (expensive operation)
GET /items/{id}       → 300 rpm  (cheap, cached)
POST /items           → 10 rpm   (write operations cost more)
POST /bulk-import     → 2 rpm    (very expensive)
POST /auth/login      → 5 rpm    (brute force protection)
POST /auth/register   → 2 rpm    (spam protection)
POST /ai/generate     → 5 rpm + token-based quota (LLM calls expensive)
```

# MIDDLEWARE IMPLEMENTATION

## Express.js Middleware
```javascript
// rateLimiter.js
import { createClient } from 'redis';

const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

export function createRateLimiter({ 
  windowSeconds = 60, 
  maxRequests = 100,
  keyFn = (req) => req.user?.id || req.ip,
  skip = () => false
} = {}) {
  return async function rateLimiter(req, res, next) {
    if (skip(req)) return next();
    
    const key = `rl:${keyFn(req)}`;
    const [allowed, info] = await checkLimit(redis, key, maxRequests, windowSeconds);
    
    // Always set headers
    res.set({
      'X-RateLimit-Limit': info.limit,
      'X-RateLimit-Remaining': Math.max(0, info.remaining),
      'X-RateLimit-Reset': info.reset,
    });
    
    if (!allowed) {
      res.set('Retry-After', info.retry_after);
      return res.status(429).json({
        error: 'rate_limit_exceeded',
        message: `Rate limit exceeded. Try again in ${info.retry_after} seconds.`,
        retry_after: info.retry_after,
        reset_at: new Date(info.reset * 1000).toISOString()
      });
    }
    
    next();
  };
}

// Usage
app.use('/api/search', createRateLimiter({ windowSeconds: 60, maxRequests: 30 }));
app.use('/api/', createRateLimiter({ windowSeconds: 60, maxRequests: 300 }));
```

# NGINX RATE LIMITING

## nginx.conf Pattern
```nginx
http {
    # Define limit zones (stored in shared memory)
    limit_req_zone $binary_remote_addr zone=ip_limit:10m rate=10r/s;
    limit_req_zone $http_x_api_key     zone=api_key_limit:10m rate=100r/s;
    
    # Limit connection concurrency
    limit_conn_zone $binary_remote_addr zone=conn_limit:10m;
    
    server {
        location /api/ {
            # Rate limit by API key with burst
            limit_req zone=api_key_limit burst=50 nodelay;
            
            # Fallback: also limit by IP
            limit_req zone=ip_limit burst=20 nodelay;
            
            # Max 10 concurrent connections per IP
            limit_conn conn_limit 10;
            
            # Return 429 instead of 503
            limit_req_status 429;
            limit_conn_status 429;
            
            proxy_pass http://upstream;
        }
        
        location /api/auth/login {
            # Stricter: 5 per second, no burst for login
            limit_req zone=ip_limit burst=5 nodelay;
            proxy_pass http://upstream;
        }
    }
}
```

# DISTRIBUTED RATE LIMITING

## Across Multiple App Servers
```
Problem: 3 app servers, each has local state → user gets 3x the limit

Solutions:
1. Centralized Redis (recommended):
   → All servers call same Redis instance for atomic check-and-increment
   → Adds ~1ms latency per request (acceptable)
   → Redis Cluster for HA

2. Sticky sessions:
   → Route user always to same server (consistent hashing)
   → Bad: server failures redistribute users, reset their limits
   → Only use if Redis is unavailable

3. API Gateway handles it:
   → Kong, AWS API Gateway, Nginx Plus, Envoy all support distributed rate limiting
   → Push the problem to the gateway layer; app servers are limit-unaware

4. Approximate with local + global:
   → Each server tracks local count, periodically syncs to Redis
   → Allows up to (N_servers - 1) * limit overage in race window
   → Tradeoff: much less Redis traffic, slight inaccuracy acceptable for loose limits
```

# ABUSE DETECTION BEYOND RATE LIMITS

## Complementary Signals
```python
# Rate limits catch VOLUME abuse. These catch PATTERN abuse:

signals = {
    "credential_stuffing": lambda req: failed_login_rate(req.ip) > 10 / minute,
    "scraping":            lambda req: request_interval(req.user) < 100ms,
    "automated_behavior":  lambda req: no_user_agent(req) or known_bad_ua(req),
    "impossible_travel":   lambda req: geo_distance(last_ip, req.ip) / time_delta > 1000 km/hr,
    "account_takeover":    lambda req: new_device(req) and sensitive_action(req),
}

# On detection: challenge (CAPTCHA), soft-block, or alert security team
# NEVER silently drop — tell the user something (even just "unusual activity detected")
```

# PRODUCTION CHECKLIST
```
[ ] Limit key is user ID or API key — not IP alone
[ ] Token bucket or sliding window counter — not fixed window for billing-critical limits
[ ] X-RateLimit-* and Retry-After headers on every response (especially 429s)
[ ] 429 response body includes retry_after and human-readable message
[ ] Per-endpoint limits defined — expensive endpoints have stricter limits
[ ] Burst allowance configured — 2x for 5-10 seconds for legitimate spikes
[ ] Tiered limits per subscription plan
[ ] Redis-based for distributed enforcement across multiple servers
[ ] Shadow mode / logging before enforcement (observe what would be limited first)
[ ] Alerts when >5% of requests are 429s (your limit may be too aggressive)
[ ] Abuse detection beyond volume (scraping patterns, credential stuffing)
[ ] Whitelist for internal services and monitoring (don't rate-limit your own health checks)
[ ] Graceful degradation if Redis is down (fail open or closed — explicit decision)
```
