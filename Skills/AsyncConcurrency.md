---
name: Async & Concurrency
trigger: async, await, concurrency, parallelism, race condition, deadlock, thread, mutex, lock, event loop, promise, future, goroutine, Python asyncio, JavaScript async, concurrent requests, thread safe, async patterns, message queue, worker pool
description: Write correct, efficient concurrent and asynchronous code. Covers JavaScript async/await, Python asyncio, Go goroutines, common patterns (worker pools, rate limiting, fan-out/fan-in), and avoiding race conditions and deadlocks.
---

# ROLE
You are a systems engineer with deep expertise in concurrent and asynchronous programming. Your job is to help developers write code that is correct under concurrent execution — which is harder than it looks because concurrency bugs are often timing-dependent and notoriously hard to reproduce.

# CORE PRINCIPLES
```
SHARED MUTABLE STATE IS THE ROOT OF ALL CONCURRENCY EVIL
PREFER MESSAGE PASSING OVER SHARED MEMORY — communicate by sharing, don't share by communicating (Go motto)
MAKE IT CORRECT FIRST, THEN CONCURRENT — concurrency adds complexity; verify correctness first
RACE CONDITIONS HIDE — test under load, use race detectors, think adversarially
DEADLOCKS COME FROM LOCK ORDERING — establish and document lock acquisition order
ASYNC ≠ PARALLEL — single-threaded async (JS, Python asyncio) is concurrent but not parallel
```

# JAVASCRIPT ASYNC/AWAIT

## The Event Loop Model
```javascript
// JavaScript is SINGLE-THREADED but CONCURRENT via the event loop
// async/await is syntactic sugar over Promises
// Non-blocking I/O: while waiting for network/disk, other tasks run

// SEQUENTIAL (slow — each waits for the previous)
const user     = await getUser(id)      // wait 100ms
const orders   = await getOrders(id)    // wait 150ms
const wishlist = await getWishlist(id)  // wait 80ms
// Total: 330ms

// PARALLEL (fast — all start simultaneously)
const [user, orders, wishlist] = await Promise.all([
  getUser(id),      // all three kick off immediately
  getOrders(id),    // runs concurrently with user
  getWishlist(id)   // runs concurrently with user and orders
])
// Total: 150ms (the slowest one)

// WHEN NOT TO USE Promise.all:
// If operations are dependent on each other:
const user = await getUser(id)
const orders = await getOrders(user.accountId)  // needs user first — must be sequential

// WHEN ONE FAILURE SHOULD NOT CANCEL OTHERS: Promise.allSettled
const results = await Promise.allSettled([
  getUser(id),
  getOrders(id),
  getRecommendations(id)  // might fail, but we still want user and orders
])
results.forEach(r => {
  if (r.status === 'fulfilled') use(r.value)
  else handleError(r.reason)
})

// RACE: take whichever resolves first (useful for timeouts)
const result = await Promise.race([
  fetchData(url),
  new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
])
```

## Error Handling Patterns
```javascript
// PROBLEM: unhandled promise rejection (silent crash in older Node)
async function dangerousOperation() {
  throw new Error('Something went wrong')
}
dangerousOperation()  // Promise rejected, but nobody is listening

// SOLUTION: always await or catch
try {
  await dangerousOperation()
} catch (err) {
  logger.error('Operation failed', { error: err.message })
  throw err  // re-throw if callers need to handle it
}

// TOP-LEVEL: process.on('unhandledRejection') as safety net
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason })
  process.exit(1)  // crash loudly rather than run in corrupted state
})

// HELPER: timeout wrapper
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
  )
  return Promise.race([promise, timeout])
}

const data = await withTimeout(fetchData(url), 5000)
```

## Concurrency Control
```javascript
// PROBLEM: unlimited concurrency hammers downstream services
const urls = new Array(10_000).fill('https://api.example.com/item/')
const results = await Promise.all(urls.map(url => fetch(url)))
// Fires 10,000 concurrent requests → rate limit errors, connection exhaustion

// SOLUTION: controlled concurrency with p-limit
import pLimit from 'p-limit'

const limit = pLimit(10)  // max 10 concurrent

const results = await Promise.all(
  urls.map(url => limit(() => fetch(url).then(r => r.json())))
)
// Processes in batches of 10 — stays within rate limits

// SEQUENTIAL WITH DELAY (for very strict rate limits):
async function processSequentially<T>(items: T[], fn: (item: T) => Promise<void>) {
  for (const item of items) {
    await fn(item)
    await new Promise(resolve => setTimeout(resolve, 100))  // 100ms delay between each
  }
}
```

# PYTHON ASYNCIO

## Core Patterns
```python
import asyncio
import aiohttp

# SEQUENTIAL vs CONCURRENT
async def sequential():
    user    = await get_user(user_id)     # 100ms
    orders  = await get_orders(user_id)   # 150ms
    # Total: 250ms

async def concurrent():
    # gather runs all coroutines concurrently
    user, orders, wishlist = await asyncio.gather(
        get_user(user_id),
        get_orders(user_id),
        get_wishlist(user_id)
    )
    # Total: max of each = 150ms

# Handle errors in gather (return_exceptions prevents short-circuit):
results = await asyncio.gather(
    get_user(user_id),
    get_orders(user_id),
    return_exceptions=True  # exceptions returned as values, not raised
)
for result in results:
    if isinstance(result, Exception):
        logger.error(f"Task failed: {result}")
    else:
        process(result)

# SEMAPHORE for concurrency control
async def process_with_limit(urls: list[str]):
    semaphore = asyncio.Semaphore(10)  # max 10 concurrent
    
    async def fetch(url: str):
        async with semaphore:
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as response:
                    return await response.json()
    
    return await asyncio.gather(*[fetch(url) for url in urls])

# TASK CANCELLATION
async def main():
    task = asyncio.create_task(long_running_operation())
    
    try:
        result = await asyncio.wait_for(task, timeout=30.0)
    except asyncio.TimeoutError:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass  # expected — task was cancelled
        raise TimeoutError("Operation timed out")
```

## Sync vs. Async Mixing
```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

# PROBLEM: blocking code in async function blocks the event loop
async def bad_function():
    time.sleep(5)           # blocks entire event loop
    result = requests.get(url)  # blocks entire event loop

# SOLUTION: run blocking code in thread pool
executor = ThreadPoolExecutor(max_workers=4)

async def good_function():
    loop = asyncio.get_event_loop()
    
    # Run blocking I/O in thread pool
    result = await loop.run_in_executor(executor, blocking_io_operation)
    
    # CPU-bound work: use ProcessPoolExecutor instead (bypasses GIL)
    from concurrent.futures import ProcessPoolExecutor
    proc_executor = ProcessPoolExecutor()
    result = await loop.run_in_executor(proc_executor, cpu_intensive_function, data)
```

# GO CONCURRENCY (GOROUTINES AND CHANNELS)

## Core Patterns
```go
// GOROUTINE: lightweight thread (Go manages thousands of these)
go func() {
    // runs concurrently
    result, err := fetchData(url)
    // but where does the result go? → channels
}()

// CHANNEL: typed pipe for goroutine communication
results := make(chan Result, 10)  // buffered channel (non-blocking up to capacity)

go func() {
    for _, url := range urls {
        data, err := fetch(url)
        results <- Result{data: data, err: err}  // send to channel
    }
    close(results)  // signal no more results
}()

for r := range results {  // receive until channel closed
    if r.err != nil {
        log.Printf("error: %v", r.err)
        continue
    }
    process(r.data)
}

// WORKER POOL PATTERN
func workerPool(jobs <-chan Job, results chan<- Result, numWorkers int) {
    var wg sync.WaitGroup
    
    for i := 0; i < numWorkers; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            for job := range jobs {         // receive jobs until channel closed
                result := process(job)
                results <- result           // send result
            }
        }()
    }
    
    wg.Wait()
    close(results)
}

// FAN-OUT / FAN-IN
func fanOut(input <-chan Data, numWorkers int) []<-chan Result {
    channels := make([]<-chan Result, numWorkers)
    for i := 0; i < numWorkers; i++ {
        channels[i] = processWorker(input)
    }
    return channels
}

func merge(channels ...<-chan Result) <-chan Result {
    merged := make(chan Result)
    var wg sync.WaitGroup
    for _, ch := range channels {
        wg.Add(1)
        go func(c <-chan Result) {
            defer wg.Done()
            for r := range c { merged <- r }
        }(ch)
    }
    go func() { wg.Wait(); close(merged) }()
    return merged
}
```

# RACE CONDITIONS

## What They Are and How to Find Them
```
A RACE CONDITION occurs when:
  1. Multiple goroutines/threads access shared data
  2. At least one is writing
  3. Without synchronization

EXAMPLE (broken):
  // Two goroutines incrementing a counter
  var counter int

  go func() { counter++ }()  // read counter, add 1, write counter
  go func() { counter++ }()  // read counter, add 1, write counter (race!)
  
  // If both read before either writes: both read 0, both write 1 → result is 1, not 2

DETECTION:
  Go:     go test -race ./...   (built-in race detector)
  Java:   ThreadSanitizer
  Python: threading.Lock + careful design (asyncio avoids this by being single-threaded)
  C++:    ThreadSanitizer, Helgrind

FIX — OPTION 1: Mutex (mutual exclusion lock)
  var mu sync.Mutex
  var counter int

  go func() {
      mu.Lock()
      counter++
      mu.Unlock()
  }()

FIX — OPTION 2: Atomic operations (for simple values)
  var counter atomic.Int64
  go func() { counter.Add(1) }()

FIX — OPTION 3: Channels (communicate by sharing instead of sharing memory)
  results := make(chan int, 2)
  go func() { results <- 1 }()
  go func() { results <- 1 }()
  total := <-results + <-results  // collect from channel safely
```

# DEADLOCKS

## How They Happen and How to Avoid Them
```
A DEADLOCK occurs when:
  Goroutine A holds lock 1, waits for lock 2
  Goroutine B holds lock 2, waits for lock 1
  Neither can proceed → forever

PREVENTION RULE: always acquire locks in the same order.
  // If you need both mu1 and mu2: ALWAYS lock mu1 first, then mu2
  // Every goroutine that needs both must follow this order

LOCK TIMEOUT (where available):
  ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
  defer cancel()
  
  select {
  case <-mu:    // acquired lock
      defer func() { mu <- struct{}{} }()
  case <-ctx.Done():
      return fmt.Errorf("timed out waiting for lock")
  }

COMMON DEADLOCK IN GO — unbuffered channel with no reader:
  ch := make(chan int)  // unbuffered
  ch <- 42             // blocks forever: nobody is reading

  Fix: use buffered channel, or read in a goroutine first:
  ch := make(chan int, 1)  // buffer of 1
  ch <- 42                 // doesn't block
```

# PATTERNS FOR DISTRIBUTED SYSTEMS

## Queue-Based Work Distribution
```
MESSAGE QUEUE (RabbitMQ, Kafka, SQS) pattern:
  Producer → publishes jobs to queue → Workers consume jobs

  Benefits:
  - Natural backpressure: producers slow down when queue fills
  - Durable: jobs survive worker crashes (with proper ACKs)
  - Scale workers independently from producers
  - Dead letter queue: failed jobs don't disappear

EXACTLY ONCE vs. AT LEAST ONCE:
  At least once (default): message may be processed multiple times
  → Make processing IDEMPOTENT: processing twice = same result as once
  → Use idempotency keys; check if work is already done before doing it

  Exactly once: much harder; often not needed if you design for idempotency

BULKHEAD PATTERN (isolate failures):
  Don't let one slow service exhaust all your thread/goroutine pool
  Separate pools for: fast API calls, slow external API calls, file I/O
  When the slow pool is exhausted: fast API calls still work
```
