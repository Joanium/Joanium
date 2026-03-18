---
name: System Design
trigger: design a system, architecture, scalable service, backend infrastructure, distributed system, database design, API design, microservices, high-level design
description: A comprehensive framework for designing scalable, reliable, and maintainable software systems. Use for any system design problem — from interviews to real production architecture.
---

System design is the practice of defining the architecture, components, modules, interfaces, and data flow of a system to satisfy given requirements. Great system design is driven by requirements, constrained by reality, and validated by tradeoffs.

## The Design Process

Never jump to solutions. Follow this sequence every time:

```
1. Requirements → 2. Estimation → 3. API Design → 4. Data Model → 
5. High-Level Architecture → 6. Deep Dives → 7. Bottlenecks & Tradeoffs
```

## Phase 1: Requirements Clarification

Spend time here — wrong requirements produce wrong architecture.

**Functional requirements (what the system does):**
```
- What are the core features? (MVP only — not wishlist)
- Who are the users? (consumers, businesses, internal teams)
- What actions do users take? (CRUD operations, specific workflows)
- What are the read vs. write patterns?
- Are there real-time requirements?
- What consistency guarantees are needed?
```

**Non-functional requirements (how the system behaves):**
```
- Scale: How many users? DAU/MAU?
- Throughput: Reads per second? Writes per second?
- Latency: p50/p99 targets?
- Availability: 99.9% (8.7h/year downtime) vs 99.99% (52m/year)?
- Durability: Can data ever be lost?
- Consistency: Strong, eventual, or causal?
- Geography: Single region or global?
- Security & compliance: PII handling, GDPR, HIPAA?
```

## Phase 2: Capacity Estimation

Back-of-envelope math establishes scale and shapes technology choices:

**Traffic estimation:**
```
Example: Instagram-scale photo service
- 500M DAU
- Avg 2 uploads/day, 30 views/day per user

Writes: 500M × 2 / 86,400s ≈ 11,600 writes/sec → ~12K writes/sec
Reads:  500M × 30 / 86,400s ≈ 174K reads/sec → high read:write ratio (15:1)
```

**Storage estimation:**
```
Photos: 12K writes/sec × 200KB avg = 2.4 GB/sec
Daily:  2.4GB × 86,400 = ~200TB/day
10yr:  200TB × 365 × 10 = ~730PB raw (before replication)
```

**Bandwidth:**
```
Ingress:  12K × 200KB = 2.4 GB/s
Egress:   174K × 200KB = 34.8 GB/s → CDN is non-negotiable
```

These numbers drive: storage choice, caching strategy, sharding approach, CDN necessity.

## Phase 3: API Design

Define the interface before the implementation:

**RESTful API conventions:**
```
Resource: /users, /posts, /messages
Operations:
  GET    /posts              → list posts (paginated)
  GET    /posts/{id}         → get post
  POST   /posts              → create post
  PATCH  /posts/{id}         → partial update
  DELETE /posts/{id}         → delete post

Pagination:
  Cursor-based: GET /posts?cursor=xxx&limit=20  ← prefer for real-time data
  Offset-based: GET /posts?page=2&size=20       ← simple, but inconsistent under mutations

Response envelope:
{
  "data": [...],
  "meta": { "cursor": "...", "total": 1000 },
  "errors": []
}
```

**For high-throughput internal services, consider gRPC:**
- Binary protocol (faster than JSON)
- Strongly-typed contracts via protobuf
- Native streaming support

## Phase 4: Data Model & Storage

**Storage selection matrix:**

| Use Case | Technology | Why |
|----------|-----------|-----|
| Relational/structured | PostgreSQL, MySQL | ACID, joins, complex queries |
| High-throughput key-value | Redis, DynamoDB | O(1) reads, simple access patterns |
| Flexible document store | MongoDB, Firestore | Schema flexibility, nested structures |
| Time-series data | TimescaleDB, InfluxDB | Optimized for time-ordered inserts/queries |
| Full-text search | Elasticsearch, Typesense | Inverted index, relevance ranking |
| Graph relationships | Neo4j, Amazon Neptune | Efficient graph traversal |
| Blob/object storage | S3, GCS | Cheap, durable, CDN-compatible |
| Message queue | Kafka, RabbitMQ, SQS | Async decoupling, durability |

**Schema design principles:**
```sql
-- Prefer UUIDs for distributed-safe IDs
id UUID DEFAULT gen_random_uuid() PRIMARY KEY

-- Index what you query, not everything
CREATE INDEX CONCURRENTLY idx_posts_user_created 
ON posts(user_id, created_at DESC);

-- Soft deletes over hard deletes (for auditability)
deleted_at TIMESTAMPTZ DEFAULT NULL

-- Denormalize for read performance when joins are too expensive
-- (Store username on posts table to avoid join on every read)
```

## Phase 5: High-Level Architecture

**Core architectural patterns:**

### The Standard Web Architecture
```
Client → CDN → Load Balancer → API Servers (stateless) → Cache → Database
                                                        ↘ Message Queue → Workers
```

### Microservices (when justified)
```
API Gateway → [Auth Service] [User Service] [Post Service] [Notification Service]
              ↕ Service Mesh (Istio/Envoy)
              ↕ Message Bus (Kafka)
              ↕ Shared Infrastructure (Logging, Tracing, Metrics)
```

**When NOT to use microservices:** Early stage, small team, unclear boundaries. A modular monolith is often the right first architecture.

### Key Components to Design:

**Load Balancing:**
```
L4 (TCP): Faster, less smart — use for raw throughput
L7 (HTTP): Smarter routing (by path, header, cookie) — use for applications
Sticky sessions: Needed for stateful services (websockets, server-side sessions)
Health checks: Active (ping) + passive (error rate monitoring)
```

**Caching strategy:**
```
Cache-aside (lazy):    App checks cache → miss → load DB → populate cache
Write-through:         Write to cache and DB simultaneously
Write-behind (async):  Write to cache → DB updated asynchronously
Read-through:          Cache fetches from DB on miss transparently

TTL strategy:          Short TTL (seconds-minutes) for frequently changing data
                       Long TTL + explicit invalidation for stable data
Cache keys:            Structured keys: "user:{id}:profile", "post:{id}:likes"
```

**Database scaling:**
```
Vertical scaling:      Bigger server — simple, limited
Read replicas:         Route reads to replicas — good for read-heavy workloads
Sharding:              Partition data across nodes
  - Range-based: shard by user_id range (hot spots possible)
  - Hash-based:  shard by hash(user_id) (even distribution)
  - Directory:   lookup table maps keys to shards (flexible, single point of failure)
CQRS:                  Separate read and write models (powerful, complex)
```

## Phase 6: Deep Dives — Critical Components

Pick 2-3 of the hardest problems and go deep:

### Handling Hot Spots / Celebrity Problem
```
Problem: Justin Bieber posts a photo — 100M requests hit one shard
Solutions:
1. Add a random suffix to cache key: "post:123:shard:{0-9}" — distribute reads
2. Pre-warm cache for known hot users
3. Edge caching closer to users (CDN)
4. Asynchronous fan-out: write to followers' feeds async, not on every read
```

### Unique ID Generation (Distributed)
```
Option 1: UUID v4 — simple, no coordination, but large (128-bit), not sortable
Option 2: Twitter Snowflake — 64-bit, timestamp+machine+sequence, sortable, fast
Option 3: ULID — sortable UUID alternative, URL-safe
Option 4: Database sequence — simple, but becomes bottleneck at scale
```

### Rate Limiting
```
Token bucket:   Allows burst up to bucket size, refills at constant rate
Leaky bucket:   Smooths output, no burst allowed
Fixed window:   Simple, but boundary exploitation possible
Sliding window: More accurate, higher memory cost

Storage: Redis with atomic INCR + EXPIRE for distributed rate limiting
```

## Phase 7: Reliability & Observability

**The three pillars of observability:**
```
Metrics:  What is happening? (latency, error rate, throughput) → Prometheus + Grafana
Logs:     What happened and why? (structured JSON logs) → ELK / Loki
Traces:   Where did this request go? (distributed tracing) → Jaeger / Zipkin
```

**SLIs, SLOs, SLAs:**
```
SLI (indicator):  The metric — "p99 latency of /api/posts"
SLO (objective):  The target — "p99 latency < 200ms for 99.9% of requests"
SLA (agreement):  The contract — what happens if SLO is breached
Error budget:     100% - SLO = budget for downtime. Spend it on deployment risk.
```

**Circuit breaker pattern:**
```
Closed → request passes through
Open → fail fast, don't call the failing service (after threshold of failures)
Half-open → probe with one request; if success, close; if fail, stay open
```

## Tradeoffs Reference

| Decision | Option A | Option B |
|----------|----------|----------|
| Consistency vs Availability | Strong consistency (CP) | Eventual consistency (AP) |
| SQL vs NoSQL | Structured, ACID | Flexible schema, scale |
| Monolith vs Microservices | Simple, fast to build | Independent scaling, complex |
| Push vs Pull (feeds) | Fan-out on write (fast reads) | Fan-out on read (storage efficient) |
| Sync vs Async | Simple, immediate | Resilient, decoupled, eventual |
| Cache-aside vs Write-through | Lazy, stale possible | Fresh, write overhead |
