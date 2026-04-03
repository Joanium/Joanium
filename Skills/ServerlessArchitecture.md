---
name: Serverless Architecture
trigger: serverless, Lambda, Cloud Functions, Azure Functions, edge functions, cold start, function-as-a-service, FaaS, event-driven functions, Vercel functions, Cloudflare Workers, AWS Lambda, serverless deployment
description: A complete guide to designing, building, and optimizing serverless architectures. Use for Lambda/Cloud Functions design, cold start mitigation, event-driven patterns, cost modeling, and knowing when serverless is the wrong choice.
---

Serverless means you deploy functions, not servers. The cloud provider handles provisioning, scaling, and availability. You pay per invocation and execution time, not per idle server. This changes how you architect, debug, test, and operate systems.

## When Serverless Is Right (and Wrong)

```
✅ Good fit for serverless:
  - Event-driven workloads (file uploads, webhooks, queue consumers)
  - Variable/unpredictable traffic (spiky or bursty patterns)
  - Small, well-defined functions with clear inputs/outputs
  - Background tasks, scheduled jobs, data transformations
  - APIs with moderate traffic and latency tolerance (>50ms acceptable)
  - Prototypes and MVPs where operational overhead matters

❌ Poor fit for serverless:
  - Long-running processes (> 15 min execution)
  - WebSockets or persistent connections (use serverless WebSocket APIs carefully)
  - High-frequency, consistent traffic with < 20ms latency requirements
  - Workloads that need GPU, large memory, or specialized hardware
  - Complex stateful workflows (consider Step Functions / Durable Functions)
  - Monolithic applications with tight internal coupling
```

## Core Concepts

**Execution model:**
```
Invocation → Cold start (if no warm instance) → Execute → Return → Freeze/Terminate

Cold start: container init + runtime init + your init code
  Node.js: ~200-500ms cold start
  Python:  ~200-400ms cold start  
  Java:    ~1-3s cold start (JVM penalty — avoid for latency-sensitive)
  Go:      ~50-100ms cold start (best-in-class)

Warm invocation: ~1-5ms overhead (container already running)
```

**Billing model:**
```
AWS Lambda: $0.20 per 1M requests + $0.0000166667 per GB-second
Example: 1M requests × 256MB × 500ms avg = 128,000 GB-seconds = $2.13
Compare to t3.small: ~$15/month always-on
Breakeven: serverless wins below ~5M req/month at that profile
```

## Function Design Principles

**Single responsibility:**
```javascript
// BAD — function doing too much
export const handler = async (event) => {
  const user = await getUser(event.userId);
  await sendWelcomeEmail(user);
  await createDefaultProject(user);
  await notifySlack(user);
  await updateCRM(user);
  // Each failure kills the whole thing; hard to retry partially
};

// GOOD — decompose into events
export const handler = async (event) => {
  const user = await getUser(event.userId);
  await publishEvent('user.created', { userId: user.id });
  // Each downstream action is an independent subscriber
  // Each can fail and retry independently
};
```

**Stateless functions:**
```javascript
// BAD — state in memory (lost between cold starts, wrong with concurrency)
let cache = {};

export const handler = async (event) => {
  if (!cache[event.id]) {
    cache[event.id] = await fetchFromDB(event.id);
  }
  return cache[event.id];
};

// GOOD — external state only
export const handler = async (event) => {
  // Use Redis/DynamoDB/ElastiCache for caching
  const cached = await redis.get(`item:${event.id}`);
  if (cached) return JSON.parse(cached);
  
  const data = await fetchFromDB(event.id);
  await redis.set(`item:${event.id}`, JSON.stringify(data), 'EX', 300);
  return data;
};
```

## Cold Start Mitigation

```javascript
// 1. Move initialization OUTSIDE the handler
// BAD — re-initializes on every cold start AND every invocation
export const handler = async (event) => {
  const db = await createDatabaseConnection(); // ❌ per invocation
  return db.query('...');
};

// GOOD — initializes once per container lifetime
let db;
const getDB = async () => {
  if (!db) db = await createDatabaseConnection();
  return db;
};

export const handler = async (event) => {
  const conn = await getDB(); // ✅ reused across warm invocations
  return conn.query('...');
};

// 2. Reduce bundle size — cold start time scales with package size
// Use tree shaking, avoid heavy SDKs, import only what you need
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"; // ✅ modular
// NOT: import AWS from 'aws-sdk'; // ❌ entire SDK

// 3. Provisioned concurrency (for latency-critical functions)
// AWS: aws lambda put-provisioned-concurrency-config
// Keeps N instances warm at all times — you pay for idle time

// 4. Keep functions warm (lightweight alternative)
// Scheduled ping every 5 min — cheap but not guaranteed
```

## Event Source Patterns

**API Gateway (synchronous):**
```javascript
// Request/response — caller waits for result
export const handler = async (event) => {
  const body = JSON.parse(event.body);
  
  // Always validate input at the boundary
  if (!body.email || !body.name) {
    return { statusCode: 400, body: JSON.stringify({ error: 'email and name required' }) };
  }
  
  try {
    const result = await processRequest(body);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    };
  } catch (err) {
    console.error({ error: err.message, requestId: event.requestContext?.requestId });
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal error' }) };
  }
};
```

**SQS/Queue consumer (asynchronous):**
```javascript
// Process in batches — SQS sends up to 10 messages per invocation
export const handler = async (event) => {
  const results = await Promise.allSettled(
    event.Records.map(record => processMessage(JSON.parse(record.body)))
  );
  
  // Report failed messages back to SQS for retry
  const failures = results
    .map((result, i) => ({ result, record: event.Records[i] }))
    .filter(({ result }) => result.status === 'rejected')
    .map(({ record }) => ({ itemIdentifier: record.messageId }));
  
  return { batchItemFailures: failures }; // SQS will retry only these
};
```

**S3 trigger (event-driven):**
```javascript
export const handler = async (event) => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key);
    
    // Avoid processing the output file (infinite loop trap)
    if (key.startsWith('processed/')) return;
    
    await processFile({ bucket, key });
  }
};
```

## Error Handling & Retries

```javascript
// Idempotency is critical — serverless functions WILL be called multiple times
// Design every function to be safely re-runnable with the same input

// Pattern: idempotency key prevents duplicate processing
export const handler = async (event) => {
  const idempotencyKey = event.headers['Idempotency-Key'] || event.requestId;
  
  // Check if already processed
  const existing = await db.get(`idem:${idempotencyKey}`);
  if (existing) return existing; // Return cached result, don't reprocess
  
  const result = await doWork(event);
  
  // Cache result for 24 hours
  await db.set(`idem:${idempotencyKey}`, result, 'EX', 86400);
  return result;
};

// Dead Letter Queue — capture unprocessable messages
// Configure DLQ on every async event source (SQS, SNS, EventBridge)
// Without DLQ: failed messages disappear silently
```

## Observability in Serverless

```javascript
// Structured logging — critical for querying across invocations
const log = (level, message, context = {}) => {
  console.log(JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
    requestId: currentRequestId,
    ...context
  }));
};

export const handler = async (event, lambdaContext) => {
  currentRequestId = lambdaContext.awsRequestId;
  
  log('info', 'Function invoked', {
    eventType: event.source,
    remainingMs: lambdaContext.getRemainingTimeInMillis()
  });
  
  // Track cold starts
  if (isFirstInvocation) {
    log('info', 'Cold start detected');
    isFirstInvocation = false;
  }
};

// Use X-Ray / Cloud Trace for distributed tracing across function calls
// Powertools for Lambda (AWS) — structured logging, tracing, idempotency built-in
```

## Cost Optimization

```
Optimization levers:
  1. Memory sizing — counter-intuitively, MORE memory can be CHEAPER
     More memory → more CPU → faster execution → fewer GB-seconds billed
     Test with AWS Lambda Power Tuning tool

  2. Batch processing — fewer invocations for same work
     Process 100 records in one invocation vs 100 invocations of 1 record

  3. Right-size timeout — set timeout to 2-3x your p99 execution time
     Prevents runaway invocations from inflating costs

  4. Avoid polling patterns — use event-driven push instead of scheduled polling
     Polling Lambda every 1 min = 44k invocations/month with nothing to do

  5. Cache aggressively — DynamoDB reads cost money too
     Cache at function level (warm container) + external cache (ElastiCache/Redis)

Monthly cost estimate template:
  Requests/month:        N
  Avg duration (ms):     D
  Memory (MB):           M
  
  Compute cost: (N × D/1000 × M/1024) × $0.0000166667
  Request cost: (N / 1,000,000) × $0.20
  Total: compute + request
```

## Testing Serverless Functions

```javascript
// Unit test: pure function logic (no cloud dependencies)
describe('processOrder', () => {
  it('calculates tax correctly', () => {
    const result = processOrder({ amount: 100, state: 'CA' });
    expect(result.tax).toBe(8.25);
  });
});

// Integration test: function with real (or local) cloud services
// Use LocalStack for local AWS emulation
// Use AWS SAM local for Lambda emulation

// Contract test: verify event shape matches what source sends
// Real-world Lambda bugs are often malformed event assumptions
describe('SQS handler', () => {
  it('processes valid SQS record shape', async () => {
    const event = {
      Records: [{
        messageId: 'test-123',
        body: JSON.stringify({ userId: '456', action: 'signup' }),
        // Include all fields your handler accesses
      }]
    };
    const result = await handler(event);
    expect(result.batchItemFailures).toHaveLength(0);
  });
});
```

## Deployment Patterns

```yaml
# Serverless Framework (serverless.yml)
service: my-api

provider:
  name: aws
  runtime: nodejs20.x
  memorySize: 256
  timeout: 29 # Max for API Gateway

functions:
  api:
    handler: src/api.handler
    events:
      - httpApi:
          path: /users/{id}
          method: GET
    environment:
      DB_URL: ${ssm:/myapp/prod/db-url}  # Secrets from SSM Parameter Store
    reservedConcurrency: 100  # Prevent runaway scaling

  worker:
    handler: src/worker.handler
    events:
      - sqs:
          arn: !GetAtt OrderQueue.Arn
          batchSize: 10
          functionResponseType: ReportBatchItemFailures

# Always set reservedConcurrency to prevent Lambda from consuming all 
# account concurrency and starving other functions
```
