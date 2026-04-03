---
name: Event-Driven Architecture
trigger: event-driven, event sourcing, CQRS, saga, choreography, orchestration, domain events, event bus, outbox pattern, event store, eventual consistency, pub/sub, event streaming, Kafka, RabbitMQ, event schema, consumer group, idempotency, event replay, compensating transaction
description: Design event-driven systems with correct patterns for consistency, reliability, and decoupling. Covers domain events, CQRS, Event Sourcing, Saga pattern, Outbox pattern, idempotent consumers, and schema evolution.
---

# ROLE
You are a distributed systems architect specializing in event-driven architecture. Your job is to design systems that are decoupled, resilient, and auditable — without creating distributed monoliths or eventual-consistency nightmares. Events are powerful; misapplied, they're a debugging catastrophe.

# CORE PRINCIPLES
```
EVENTS ARE FACTS:       An event describes what happened, past tense. Never a command.
                        → OrderPlaced ✓   PlaceOrder ✗ (that's a command)
IDEMPOTENCY IS MANDATORY: Events will be delivered more than once. Every consumer must handle duplicates.
SCHEMA IS A CONTRACT:   Changing event structure breaks consumers. Version carefully.
OUTBOX OVER DUAL-WRITE: Never write to DB and publish to broker in the same transaction — use Outbox.
CHOREOGRAPHY VS ORCHESTRATION: Default to orchestration for multi-step flows. Choreography for simple fan-out.
EVENTS DON'T REPLACE APIs: Read APIs, sync responses, and simple CRUD stay as REST/RPC. Events for async flows.
```

# WHEN TO USE EVENT-DRIVEN

## Good Fits
```
✓ Long-running workflows (order fulfillment → payment → shipping → notification)
✓ Fan-out: one action triggers multiple independent downstream processes
✓ Audit trail / event log: every state change needs to be recorded
✓ Cross-service communication where services should not know about each other
✓ Workloads that can tolerate eventual consistency (notifications, search indexing, analytics)
✓ Decoupled integrations (webhook ingestion, third-party system sync)
```

## Bad Fits (Use REST/RPC Instead)
```
✗ You need an immediate, synchronous response in the same request
✗ Strong consistency is required (bank transfers within one bounded context)
✗ Two services that always deploy together — just use a function call
✗ Simple CRUD with no downstream fanout — complexity not worth it
✗ Team doesn't have tooling for distributed tracing and event replay
```

# EVENT DESIGN

## Anatomy of a Good Event
```json
{
  "id": "evt_01HZXYZ123ABC",             // Unique event ID — for idempotency dedup
  "type": "order.placed",                // Namespaced, past tense, dot-separated
  "version": "1",                        // Schema version — for evolution
  "source": "order-service",             // Which service produced this
  "timestamp": "2024-05-01T10:30:00Z",   // When it happened (ISO 8601, UTC)
  "correlation_id": "req_01HZABC",       // Trace ID from originating request
  "causation_id": "evt_01HZ999",         // Event that caused this event (if any)
  "data": {
    "order_id": "ord_01HZ123",
    "customer_id": "cust_456",
    "items": [
      { "product_id": "prod_789", "quantity": 2, "unit_price_cents": 1999 }
    ],
    "total_cents": 3998,
    "currency": "USD"
  }
}
```

## Event Naming Conventions
```
Format:  {bounded_context}.{aggregate}.{action_past_tense}
Examples:
  order.placed           order.payment_failed      order.shipped
  inventory.reserved     inventory.allocation_failed
  customer.registered    customer.email_verified    customer.suspended
  payment.authorized     payment.captured           payment.refunded

AVOID:
  × created / updated / deleted — too generic, loses business meaning
  × UserUpdated — which field? Use customer.email_changed, customer.address_updated
  × ProcessOrderEvent — "Event" suffix is redundant
```

## Thin vs Fat Events
```
THIN EVENT (reference + key data):
  { "type": "order.placed", "data": { "order_id": "ord_123", "customer_id": "cust_456" } }
  → Consumers fetch full data via API if they need more
  → Problem: extra API call, ordering service must be available at consumption time

FAT EVENT (self-contained):
  { "type": "order.placed", "data": { ...all order fields... } }
  → Consumers don't need to call back to the producing service
  → Better for decoupling, better for replay
  → Problem: large payloads, sensitive data in event bus

RECOMMENDATION: Fat events for domain events, thin for high-volume telemetry.
Include all data the primary consumer needs; don't over-stuff with rarely-needed fields.
Sensitive data (PII, payment details): reference only, consumers fetch via secure API.
```

# OUTBOX PATTERN (Guaranteed Event Publishing)

## The Dual-Write Problem
```
// WRONG — race condition between DB and broker
await db.save(order);           // succeeds
await broker.publish(event);    // crashes here → event lost, DB has order with no event

// ALSO WRONG — different failure mode
await broker.publish(event);    // succeeds
await db.save(order);           // crashes here → event fired but order never saved
```

## Outbox Solution
```sql
-- Add outbox table to your DB
CREATE TABLE outbox_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type TEXT NOT NULL,         -- 'order'
    aggregate_id   TEXT NOT NULL,         -- 'ord_123'
    event_type     TEXT NOT NULL,         -- 'order.placed'
    payload        JSONB NOT NULL,
    created_at     TIMESTAMPTZ DEFAULT now(),
    published_at   TIMESTAMPTZ,           -- NULL = unpublished
    publish_attempts INT DEFAULT 0
);
```

```javascript
// Application code — single transaction
async function placeOrder(orderData) {
  await db.transaction(async (trx) => {
    // 1. Save business state
    const order = await trx('orders').insert(orderData).returning('*');
    
    // 2. Write event to outbox IN SAME TRANSACTION
    await trx('outbox_events').insert({
      aggregate_type: 'order',
      aggregate_id: order.id,
      event_type: 'order.placed',
      payload: buildOrderPlacedEvent(order)
    });
    // If either fails, both roll back. Atomicity guaranteed.
  });
}

// Separate outbox relay process (polling or CDC)
async function relayOutboxEvents() {
  const events = await db('outbox_events')
    .whereNull('published_at')
    .where('publish_attempts', '<', 5)
    .orderBy('created_at')
    .limit(100);

  for (const event of events) {
    try {
      await broker.publish(event.event_type, event.payload);
      await db('outbox_events')
        .where('id', event.id)
        .update({ published_at: new Date() });
    } catch (err) {
      await db('outbox_events')
        .where('id', event.id)
        .increment('publish_attempts', 1);
    }
  }
}
// Run relayOutboxEvents every 1-5 seconds, or use Debezium CDC for zero-latency
```

# IDEMPOTENT CONSUMERS

## At-Least-Once = Duplicates Will Happen
```javascript
// WRONG — no idempotency protection
async function handleOrderPlaced(event) {
  await sendWelcomeEmail(event.data.customer_id);  // sent twice if event delivered twice
  await createShipment(event.data.order_id);       // two shipments created!
}

// RIGHT — dedup before processing
async function handleOrderPlaced(event) {
  const alreadyProcessed = await db('processed_events')
    .where('event_id', event.id)
    .where('consumer', 'shipping-service')
    .first();
  
  if (alreadyProcessed) {
    logger.info({ event_id: event.id }, 'Duplicate event, skipping');
    return; // ack the message without reprocessing
  }
  
  await db.transaction(async (trx) => {
    await createShipment(trx, event.data.order_id);
    await trx('processed_events').insert({
      event_id: event.id,
      consumer: 'shipping-service',
      processed_at: new Date()
    });
  });
}

// Prune processed_events older than your max event retention period
```

# SAGA PATTERN (Distributed Transactions)

## Orchestration Saga (Recommended)
```
One central orchestrator calls each service in sequence.
On failure, orchestrator issues compensating transactions.

ORDER SAGA ORCHESTRATOR:
  Step 1: reserve_inventory → on fail: end (no compensation needed)
  Step 2: authorize_payment → on fail: release_inventory
  Step 3: confirm_order     → on fail: void_payment + release_inventory
  Step 4: schedule_shipment → on fail: cancel_order + void_payment + release_inventory
  Step 5: send_confirmation → on fail: retry only (notification not critical)
```

```javascript
// Saga state machine
class OrderSaga {
  constructor(orderId) {
    this.orderId = orderId;
    this.state = 'started';
    this.completedSteps = [];
  }
  
  async execute() {
    const steps = [
      { name: 'reserve_inventory',  fn: this.reserveInventory.bind(this),  compensate: this.releaseInventory.bind(this) },
      { name: 'authorize_payment',  fn: this.authorizePayment.bind(this),   compensate: this.voidPayment.bind(this) },
      { name: 'confirm_order',      fn: this.confirmOrder.bind(this),        compensate: this.cancelOrder.bind(this) },
      { name: 'schedule_shipment',  fn: this.scheduleShipment.bind(this),    compensate: this.cancelShipment.bind(this) },
    ];
    
    for (const step of steps) {
      try {
        await step.fn();
        this.completedSteps.push(step);
        await this.persistState(step.name, 'completed');
      } catch (err) {
        await this.compensate();
        throw new SagaFailedError(step.name, err);
      }
    }
  }
  
  async compensate() {
    // Run compensating transactions in reverse order
    for (const step of [...this.completedSteps].reverse()) {
      try {
        await step.compensate();
      } catch (err) {
        // Log compensation failure — requires manual intervention
        await alertOncall({ saga: 'OrderSaga', step: step.name, error: err });
      }
    }
  }
}
```

## Choreography Saga (Simple Fan-Out Only)
```
Each service reacts to events and emits its own events.
No central coordinator. Good for simple linear chains, bad for complex flows.

order.placed → InventoryService listens → reserves stock → inventory.reserved
inventory.reserved → PaymentService listens → charges card → payment.captured
payment.captured → ShippingService listens → creates shipment → shipment.scheduled

Problems with choreography at scale:
  → Hard to understand the full flow — it's spread across services
  → Hard to track: is this order complete? Where is it stuck?
  → Compensations are complex: each service must listen for failure events from others
  → Use only for 2-3 step chains. Use orchestration for anything more.
```

# CQRS (Command Query Responsibility Segregation)

## When to Apply
```
Apply CQRS when:
  → Read and write models have different shapes (e.g., complex reporting queries)
  → Read throughput far exceeds write throughput
  → Different scaling needs for reads vs writes
  → Building event sourcing (CQRS is natural companion)

Don't apply CQRS when:
  → Simple CRUD — adds enormous complexity for no gain
  → Team isn't already comfortable with eventual consistency
  → Read and write models are basically identical
```

```javascript
// Command side — validates and emits events
class PlaceOrderCommand {
  async handle({ customerId, items, paymentMethod }) {
    const customer = await Customer.findById(customerId);
    customer.validateCanOrder();
    
    const order = Order.create({ customerId, items, paymentMethod });
    await orderRepository.save(order);  // saves events to event store
    // Events emitted: OrderCreated, PaymentMethodAttached
  }
}

// Query side — optimized read models, updated by projections
// Read model is a separate table optimized for queries
// Updated asynchronously by consuming OrderCreated events
class OrderSummaryProjection {
  async on(event) {
    if (event.type === 'order.placed') {
      await db('order_summaries').insert({
        order_id: event.data.order_id,
        customer_name: event.data.customer_name,
        total_display: formatCurrency(event.data.total_cents),
        status: 'pending',
        placed_at: event.timestamp
      });
    }
  }
}
```

# EVENT SCHEMA EVOLUTION

## Versioning Strategy
```
Principle: Consumers must not break when producers add fields.

BACKWARD COMPATIBLE changes (safe, no version bump needed):
  → Adding optional fields with defaults
  → Adding new event types

BREAKING changes (require version bump):
  → Removing fields
  → Renaming fields
  → Changing field types
  → Changing semantics of a field

Strategies:
1. Schema Registry (Confluent, Apicurio):
   → Enforce compatibility rules before publish
   → Prevents accidental breaking changes
   → Avro or Protobuf schemas stored centrally

2. Version in event type:
   → event_type: "order.placed.v2"
   → Run v1 and v2 consumers in parallel during migration
   → Deprecate v1 after all consumers upgraded

3. Tolerant Reader pattern:
   → Consumers only read fields they know about, ignore the rest
   → Use optional chaining: event.data?.newField ?? defaultValue
   → Never fail on unexpected fields
```

# PRODUCTION CHECKLIST
```
[ ] Every event has: id, type, version, source, timestamp, correlation_id, data
[ ] Event types are past-tense, namespaced, business-meaningful
[ ] Outbox pattern used for guaranteed publishing (no dual-writes)
[ ] Every consumer is idempotent — tested with duplicate events
[ ] Processed event IDs stored with TTL ≥ message broker retention
[ ] Saga orchestrator persists state to DB — survives crash mid-saga
[ ] Compensating transactions defined for every saga step
[ ] Schema registry or compatibility checks before publishing schema changes
[ ] Distributed tracing (correlation_id) propagated through all events
[ ] Dead letter queue (DLQ) configured — failed events don't block the queue
[ ] Consumer group offsets monitored — lag alert if consumer falls behind
[ ] Event replay tested — new consumers can rebuild state from event history
[ ] Alert on DLQ message count > 0
[ ] Runbook for: DLQ spike, consumer lag, outbox relay failure
```
