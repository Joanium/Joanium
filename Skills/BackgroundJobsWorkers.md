---
name: Background Jobs & Workers
trigger: background jobs, job queue, task queue, cron job, worker, Bull, BullMQ, Sidekiq, Celery, job retry, job scheduling, delayed job, recurring job, job priority, dead letter job, job concurrency, worker pool, long-running task, async processing, offload, queue depth
description: Design reliable background job systems with correct retry logic, observability, and failure handling. Covers job queue selection, worker architecture, retry strategies, priority queues, cron scheduling, and job monitoring.
---

# ROLE
You are a backend systems engineer. Your job is to design background job systems that are reliable, observable, and maintainable. A job that silently fails is worse than one that visibly crashes — you need every job failure to be actionable, every retry to be bounded, and every job to be idempotent.

# CORE PRINCIPLES
```
IDEMPOTENCY:        Every job must be safe to run multiple times. Jobs WILL be retried.
OBSERVABILITY:      Every job must emit structured logs, duration metrics, and outcome status.
BOUNDED RETRIES:    Infinite retries create infinite queues. Every job has a max attempt count.
DEAD LETTER QUEUES: Jobs that exhaust retries go to DLQ — not silently deleted.
FAIL FAST:          Validate inputs at enqueue time, not only at execution time.
ATOMICITY:          Either the job fully succeeds or it fully fails. Partial state is dangerous.
```

# WHEN TO USE BACKGROUND JOBS

## Offload These From HTTP Request Cycle
```
✓ Sending emails / SMS / push notifications
✓ Image/video processing, PDF generation
✓ LLM/AI API calls (slow, expensive, can be async)
✓ Webhooks delivery to third parties
✓ Search index updates
✓ Syncing data to external systems (CRM, ERP)
✓ Generating reports / exports
✓ Batch operations (bulk import, data migration)
✓ Scheduled tasks (daily digest emails, billing runs, cleanup)
✓ Retry logic for unreliable third-party calls
```

## HTTP vs Background Job Decision
```
Use HTTP (synchronous) when:
  → User needs the result immediately to continue (login, payment confirmation)
  → Operation takes < 2 seconds reliably
  → Response directly informs the next user action

Use background job when:
  → Operation takes > 2 seconds
  → Operation calls unreliable external services
  → Failure can be retried without user being blocked
  → Multiple operations can run in parallel
  → Operation is triggered by a schedule, not a user action
```

# JOB QUEUE SELECTION

## Decision Matrix
```
Node.js stack:
  → BullMQ (Redis-backed) — best ecosystem, TypeScript, priority queues, rate limiting, cron
  → Bull — older BullMQ predecessor, still widely used
  
Python stack:
  → Celery (Redis or RabbitMQ broker) — most mature, wide broker support
  → arq — async, Redis-backed, modern Python
  → Dramatiq — simple, reliable, Redis/RabbitMQ
  
Ruby:
  → Sidekiq — battle-tested, Redis-backed, excellent dashboard

Language-agnostic / heavy workloads:
  → Temporal — durable execution platform, workflow orchestration, handles very long jobs
  → River (Go) — PostgreSQL-backed, no extra infra if you have Postgres
  → Inngest — serverless, event-driven, great for Next.js

Already have Postgres, don't want Redis:
  → pg-boss (Node) — job queue in PostgreSQL, surprisingly capable
  → Procrastinate (Python) — PostgreSQL-backed, async

Rule of thumb:
  Node + Redis already in stack → BullMQ
  Python + Redis already in stack → Celery or arq
  Only Postgres → pg-boss or River
  Complex multi-step workflows needing durability → Temporal
```

# BULLMQ PATTERNS (Node.js Reference)

## Queue Setup
```javascript
// queues.js — define all queues centrally
import { Queue, QueueEvents } from 'bullmq';
import { redisConnection } from './redis.js';

export const emailQueue = new Queue('emails', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },  // 5s, 25s, 125s
    removeOnComplete: { count: 1000 },               // keep last 1000 completed
    removeOnFail: false                               // keep ALL failed jobs for inspection
  }
});

export const reportQueue = new Queue('reports', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 30000 },  // wait 30s before retry
    timeout: 5 * 60 * 1000,                    // 5 minute timeout per attempt
    removeOnComplete: { count: 100 },
    removeOnFail: false
  }
});

// Always add jobs with full payload — worker should not need to fetch more data
export async function enqueueWelcomeEmail(userId, email, name) {
  return emailQueue.add('welcome-email', {
    type: 'welcome',
    userId,
    email,
    name,
    enqueuedAt: new Date().toISOString()
  }, {
    jobId: `welcome-${userId}`,  // deduplicate: only one welcome email per user
    delay: 0,
    priority: 1  // lower number = higher priority
  });
}
```

## Worker Implementation
```javascript
// workers/emailWorker.js
import { Worker } from 'bullmq';
import { logger } from '../logger.js';
import { sendEmail } from '../email.js';

const emailWorker = new Worker(
  'emails',
  async (job) => {
    const startTime = Date.now();
    logger.info({ job_id: job.id, job_type: job.data.type, user_id: job.data.userId }, 'Job started');

    // Validate inputs — fail fast before doing any work
    if (!job.data.email || !job.data.type) {
      throw new Error('Invalid job payload: missing email or type');
    }
    
    let result;
    switch (job.data.type) {
      case 'welcome':
        result = await sendWelcomeEmail(job.data);
        break;
      case 'password-reset':
        result = await sendPasswordResetEmail(job.data);
        break;
      default:
        throw new Error(`Unknown email type: ${job.data.type}`);
    }
    
    const duration = Date.now() - startTime;
    logger.info({ job_id: job.id, duration_ms: duration, result }, 'Job completed');
    metrics.histogram('job.duration', duration, { queue: 'emails', type: job.data.type });
    metrics.increment('job.completed', { queue: 'emails', type: job.data.type });
    
    return result; // stored in job result for inspection
  },
  {
    connection: redisConnection,
    concurrency: 5,       // process 5 jobs simultaneously
    limiter: {
      max: 100,           // rate limit: max 100 jobs per duration
      duration: 60000     // per minute
    }
  }
);

emailWorker.on('failed', (job, error) => {
  logger.error({
    job_id: job?.id,
    job_type: job?.data?.type,
    attempt: job?.attemptsMade,
    max_attempts: job?.opts?.attempts,
    error: error.message,
    stack: error.stack
  }, 'Job failed');
  
  metrics.increment('job.failed', { queue: 'emails', type: job?.data?.type });
  
  if (job?.attemptsMade >= job?.opts?.attempts) {
    // Final failure — alert
    alertSlack(`Job exhausted retries: ${job.id} (${job.data.type})`);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await emailWorker.close();
  process.exit(0);
});
```

# RETRY STRATEGY

## Choosing Backoff
```javascript
// Fixed backoff — use when you know the retry window (e.g., external API rate limit resets every 60s)
backoff: { type: 'fixed', delay: 60_000 }

// Exponential backoff — general purpose, prevents thundering herd
backoff: { type: 'exponential', delay: 1000 }
// Attempt 1: 1s, 2: 2s, 3: 4s, 4: 8s, 5: 16s ...

// Exponential with jitter — best for high-concurrency (prevents synchronized retries)
function exponentialJitter(baseDelay, attempt) {
  const cap = 30 * 60 * 1000;  // max 30 minutes
  const exp = Math.min(cap, baseDelay * Math.pow(2, attempt));
  return Math.random() * exp;  // random between 0 and exp
}

// Don't retry for these errors — they will never succeed:
const NON_RETRYABLE_ERRORS = [
  'InvalidPayloadError',      // bad input — fix the enqueue code
  'ResourceNotFoundError',    // entity deleted — skip gracefully
  'PermissionDeniedError'     // auth error — retry won't fix it
];

async function jobHandler(job) {
  try {
    await doWork(job.data);
  } catch (error) {
    if (NON_RETRYABLE_ERRORS.includes(error.name)) {
      // Mark job as failed immediately — do not retry
      await job.moveToFailed(error, true);  // true = no more retries
      logger.warn({ job_id: job.id, error: error.message }, 'Non-retryable error, not retrying');
      return;
    }
    throw error;  // bubble up — BullMQ will retry
  }
}
```

# PRIORITY QUEUES

## Designing Priority Levels
```javascript
// BullMQ priority: 1 = highest, higher number = lower priority
const PRIORITIES = {
  CRITICAL: 1,   // password reset, transactional emails, user-triggered actions
  HIGH:     5,   // notifications, webhook delivery
  NORMAL:   10,  // reports, exports, sync jobs
  LOW:      20,  // bulk imports, cleanup jobs, analytics ingestion
  BATCH:    50   // non-time-sensitive maintenance tasks
};

// Separate queues for workload isolation (not just priority)
// Don't mix fast/frequent jobs with slow/rare jobs in the same queue
const userNotificationQueue = new Queue('notifications');    // fast, high volume
const reportGenerationQueue  = new Queue('reports');         // slow, low volume, separate workers
const maintenanceQueue       = new Queue('maintenance');     // runs only off-peak
```

# CRON / SCHEDULED JOBS

## BullMQ Cron
```javascript
import { Queue } from 'bullmq';

const scheduledQueue = new Queue('scheduled', { connection: redisConnection });

// Runs every day at 9am UTC
await scheduledQueue.add('daily-digest', {}, {
  repeat: { pattern: '0 9 * * *', tz: 'UTC' },
  jobId: 'daily-digest'  // stable ID prevents duplicate schedules on redeploy
});

// Runs every hour
await scheduledQueue.add('cleanup-expired-sessions', {}, {
  repeat: { every: 60 * 60 * 1000 },  // milliseconds
  jobId: 'cleanup-expired-sessions'
});

// IMPORTANT: On app startup, check if scheduled jobs already exist before adding
// BullMQ handles this with jobId dedup, but log and verify
```

## Cron Job Failure Detection
```javascript
// Cron jobs that silently fail are a common production issue
// Use a dead man's switch pattern

import Cronitor from 'cronitor'; // or Healthchecks.io, OhDear

const monitor = new Cronitor({ apiKey: process.env.CRONITOR_API_KEY });

const dailyDigestWorker = new Worker('scheduled', async (job) => {
  if (job.name !== 'daily-digest') return;
  
  await monitor.wrap('daily-digest', async () => {
    // If this throws or doesn't complete, Cronitor alerts you
    await generateAndSendDailyDigests();
  });
}, { connection: redisConnection });
```

# JOB DESIGN PATTERNS

## Idempotent Jobs
```javascript
// Make every job safe to run multiple times

// WRONG — duplicate emails if job runs twice
async function sendOrderConfirmation(job) {
  await emailService.send({ to: job.data.email, subject: 'Order confirmed' });
}

// RIGHT — check before sending
async function sendOrderConfirmation(job) {
  const alreadySent = await db('email_log').where({
    idempotency_key: `order-confirm-${job.data.orderId}`,
  }).first();
  
  if (alreadySent) {
    logger.info({ order_id: job.data.orderId }, 'Email already sent, skipping');
    return { skipped: true };
  }
  
  await db.transaction(async (trx) => {
    await emailService.send({ to: job.data.email, subject: 'Order confirmed' });
    await trx('email_log').insert({
      idempotency_key: `order-confirm-${job.data.orderId}`,
      sent_at: new Date()
    });
  });
}
```

## Chunked Batch Jobs
```javascript
// WRONG — one job processes 100K records, times out or fails halfway
await jobQueue.add('sync-all-users', {});

// RIGHT — fan out into manageable chunks
async function enqueueSyncJobs() {
  const batchSize = 500;
  const totalUsers = await db('users').count();
  const batches = Math.ceil(totalUsers / batchSize);
  
  for (let i = 0; i < batches; i++) {
    await jobQueue.add('sync-users-batch', {
      offset: i * batchSize,
      limit: batchSize,
      batchIndex: i,
      totalBatches: batches
    }, {
      priority: PRIORITIES.BATCH,
      jobId: `sync-users-batch-${i}-${Date.now()}`
    });
  }
  
  logger.info({ total_batches: batches }, 'Enqueued sync jobs');
}
```

# OBSERVABILITY

## Dashboard Metrics to Track
```
Queue depth (length per queue):
  → Alert if depth > N (worker can't keep up — scale workers or investigate)

Job throughput (jobs completed per minute):
  → Baseline it, alert on sudden drop (workers crashed?)

Job failure rate (failed / total):
  → Alert if > 1% for critical queues, > 5% for non-critical

Job duration (p50, p95, p99):
  → Alert if p95 > expected max duration (jobs getting slower?)

DLQ size:
  → Alert if DLQ has any messages (jobs exhausted retries = something is broken)

Worker concurrency utilization:
  → If all workers always busy → scale up
  → If workers idle → scale down
```

# PRODUCTION CHECKLIST
```
[ ] Every job is idempotent — safe to run multiple times
[ ] Max attempt count defined — no infinite retries
[ ] Exponential backoff with jitter configured
[ ] Non-retryable errors identified and handled (don't waste retries)
[ ] DLQ configured — exhausted jobs land here, not silently deleted
[ ] DLQ size monitored with alert (> 0 means something is broken)
[ ] Worker graceful shutdown on SIGTERM (finish current job, stop accepting)
[ ] Job payloads are self-contained — worker doesn't need to fetch additional data
[ ] Inputs validated at enqueue time, not just at execution time
[ ] Separate queues for fast/slow and high/low priority workloads
[ ] Worker concurrency tuned per queue workload
[ ] Cron jobs have dead man's switch monitoring (Cronitor, Healthchecks.io)
[ ] Stable jobId for cron jobs (no duplicate schedules on redeploy)
[ ] Queue depth, failure rate, and duration metrics in dashboards
[ ] Alert on queue depth > threshold and failure rate > threshold
[ ] Batch jobs chunked (no single job processing > 1000 records)
[ ] Job result stored for debugging — don't removeOnFail in production
```
