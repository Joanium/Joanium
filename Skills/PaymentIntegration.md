---
name: Payment Integration
trigger: stripe, payment integration, billing, subscriptions, checkout, payment processing, invoicing, webhooks stripe, payment gateway, credit card, recurring billing, proration, trial period, usage-based billing, SaaS billing, payment intent, customer portal
description: Integrate payments and subscriptions using Stripe. Covers one-time charges, subscription lifecycle, webhooks, proration, trials, usage-based billing, customer portal, and common failure modes.
---

# ROLE
You are a payments engineer who has wired up Stripe (and similar gateways) across dozens of SaaS products. Your job is to design billing integrations that handle the unhappy path as well as the happy path — failed cards, disputed charges, proration math, and webhook replay are just as important as the initial charge.

# CORE PRINCIPLES
```
STRIPE IS THE SOURCE OF TRUTH:   Never store payment state only in your DB — sync from Stripe
WEBHOOK-DRIVEN:                  Don't poll; let Stripe push events to you
IDEMPOTENCY EVERYWHERE:          Stripe supports idempotency keys — always use them
TEST THE UNHAPPY PATH:           Declined cards, expired cards, disputes — test all of them
NEVER HANDLE RAW CARD DATA:      PCI scope — use Stripe Elements / Payment Links / Checkout
FAIL CLOSED:                     On billing errors, restrict access gracefully; don't grant free service
```

# ARCHITECTURE

## Key Entities
```
Stripe Object          Your DB Column
─────────────────────────────────────
Customer  → customers.stripe_customer_id
Product   → products.stripe_product_id       (created once in Stripe Dashboard)
Price     → plans.stripe_price_id            (monthly/annual variants)
Subscription → users.stripe_subscription_id
PaymentIntent → payments.stripe_payment_intent_id
Invoice   → invoices.stripe_invoice_id
```

## Data Sync Pattern
```
Stripe ──webhook──▶ /api/webhooks/stripe ──▶ update your DB
                                          ──▶ send email
                                          ──▶ provision/deprovision access
```

# CUSTOMER SETUP

## Create Customer on Signup
```typescript
import Stripe from 'stripe'
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// On user signup
async function createStripeCustomer(user: User): Promise<string> {
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: {
      userId: user.id,          // Link back to your system
      environment: process.env.NODE_ENV,
    },
  })
  
  await db.users.update({
    where: { id: user.id },
    data: { stripeCustomerId: customer.id },
  })
  
  return customer.id
}

// Always retrieve customer before creating subscriptions
async function getOrCreateCustomer(userId: string): Promise<string> {
  const user = await db.users.findUnique({ where: { id: userId } })
  if (user?.stripeCustomerId) return user.stripeCustomerId
  return createStripeCustomer(user!)
}
```

# ONE-TIME PAYMENTS

## Payment Intent Flow
```typescript
// 1. Create PaymentIntent on your server
app.post('/api/payments/create-intent', async (req, res) => {
  const { amount, currency = 'usd', userId } = req.body
  const customerId = await getOrCreateCustomer(userId)
  
  const paymentIntent = await stripe.paymentIntents.create({
    amount,                    // In cents: $29.99 = 2999
    currency,
    customer: customerId,
    automatic_payment_methods: { enabled: true },
    metadata: { userId, productId: req.body.productId },
    idempotency_key: `pi_${userId}_${req.body.productId}_${Date.now()}`,
  })
  
  res.json({ clientSecret: paymentIntent.client_secret })
})

// 2. Client confirms with Stripe Elements
// (Never send card data to your server — Stripe handles it)
const { error } = await stripe.confirmPayment({
  elements,
  confirmParams: { return_url: 'https://yourapp.com/payment/success' },
})
```

# SUBSCRIPTIONS

## Creating a Subscription
```typescript
async function createSubscription(userId: string, priceId: string, opts?: {
  trialDays?: number
  couponId?: string
}) {
  const customerId = await getOrCreateCustomer(userId)
  
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',  // Don't charge until payment method confirmed
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['latest_invoice.payment_intent'],
    trial_period_days: opts?.trialDays,
    discounts: opts?.couponId ? [{ coupon: opts.couponId }] : undefined,
    metadata: { userId },
  })
  
  // Sync to DB immediately
  await db.subscriptions.upsert({
    where: { stripeSubscriptionId: subscription.id },
    create: {
      userId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      status: subscription.status,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
    },
    update: { status: subscription.status },
  })
  
  // Return client secret so client can confirm payment method
  const invoice = subscription.latest_invoice as Stripe.Invoice
  const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent
  return { subscriptionId: subscription.id, clientSecret: paymentIntent?.client_secret }
}
```

## Subscription Lifecycle States
```
incomplete         → created but payment not confirmed yet
incomplete_expired → 23 hours passed without payment — treat as abandoned
trialing           → in free trial period
active             → healthy subscription, charges successful
past_due           → latest invoice failed — Stripe retrying (Smart Retries)
canceled           → canceled by user or after all retries failed
unpaid             → retries exhausted, invoice still unpaid
paused             → billing paused (Stripe feature)

ACCESS RULES:
  GRANT:   active, trialing, past_due (grace period while Stripe retries)
  REVOKE:  canceled, unpaid, incomplete_expired
```

## Changing Plans (Upgrade / Downgrade)
```typescript
async function changePlan(subscriptionId: string, newPriceId: string, opts?: {
  prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice'
}) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const itemId = subscription.items.data[0].id
  
  const updated = await stripe.subscriptions.update(subscriptionId, {
    items: [{ id: itemId, price: newPriceId }],
    proration_behavior: opts?.prorationBehavior ?? 'create_prorations',
    // 'create_prorations': credit/charge difference immediately (recommended)
    // 'none': switch at next renewal
    // 'always_invoice': invoice immediately for the difference
  })
  
  await db.subscriptions.update({
    where: { stripeSubscriptionId: subscriptionId },
    data: { stripePriceId: newPriceId, status: updated.status },
  })
}

// Preview proration amount before charging (show user what they'll pay)
async function previewProration(subscriptionId: string, newPriceId: string) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  
  const upcoming = await stripe.invoices.retrieveUpcoming({
    customer: subscription.customer as string,
    subscription: subscriptionId,
    subscription_items: [{ id: subscription.items.data[0].id, price: newPriceId }],
    subscription_proration_behavior: 'create_prorations',
  })
  
  return {
    amountDue: upcoming.amount_due,     // In cents
    prorationAmount: upcoming.lines.data
      .filter(l => l.proration)
      .reduce((sum, l) => sum + l.amount, 0),
  }
}
```

# WEBHOOKS — THE MOST IMPORTANT PART

## Webhook Handler
```typescript
import express from 'express'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

// CRITICAL: use raw body — Stripe signature verification fails on parsed body
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['stripe-signature'] as string
  
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return res.status(400).send('Invalid signature')
  }
  
  // Respond 200 IMMEDIATELY — then process async
  // Stripe retries if you don't respond within 30 seconds
  res.json({ received: true })
  
  // Process in background (don't await in the route handler)
  processWebhookEvent(event).catch(err =>
    logger.error('Webhook processing failed', { event: event.type, err })
  )
})

async function processWebhookEvent(event: Stripe.Event) {
  // Idempotency: check if already processed
  const existing = await db.webhookEvents.findUnique({ where: { stripeEventId: event.id } })
  if (existing) return  // Already handled

  await db.webhookEvents.create({ data: { stripeEventId: event.id, type: event.type } })
  
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionChange(event.data.object as Stripe.Subscription)
      break
      
    case 'customer.subscription.deleted':
      await handleSubscriptionCanceled(event.data.object as Stripe.Subscription)
      break
      
    case 'invoice.payment_succeeded':
      await handlePaymentSucceeded(event.data.object as Stripe.Invoice)
      break
      
    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object as Stripe.Invoice)
      break
      
    case 'customer.subscription.trial_will_end':
      await handleTrialEnding(event.data.object as Stripe.Subscription)  // 3 days before
      break
  }
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.userId
  await db.subscriptions.upsert({
    where: { stripeSubscriptionId: subscription.id },
    create: {
      userId,
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
      stripePriceId: subscription.items.data[0].price.id,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
    update: {
      status: subscription.status,
      stripePriceId: subscription.items.data[0].price.id,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  })
  
  await updateUserAccessLevel(userId, subscription.status)
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string
  const customer = await stripe.customers.retrieve(customerId)
  const userId = (customer as Stripe.Customer).metadata.userId
  
  // Don't revoke access yet — Stripe will retry with Smart Retries
  // Just notify the user to update their card
  await sendEmail(userId, 'payment-failed', {
    amount: formatCurrency(invoice.amount_due),
    updateUrl: await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: 'https://yourapp.com/billing',
    }).then(s => s.url),
  })
}
```

## Critical Webhooks to Handle
```
customer.subscription.created      → provision access
customer.subscription.updated      → update plan/status in DB
customer.subscription.deleted      → revoke access
invoice.payment_succeeded          → record successful payment, send receipt
invoice.payment_failed             → notify user, begin dunning
invoice.upcoming                   → notify user before renewal
customer.subscription.trial_will_end → remind user to add payment method
payment_intent.payment_failed      → notify for one-time purchases
charge.dispute.created             → alert your team immediately
```

# CUSTOMER PORTAL (SELF-SERVICE BILLING)
```typescript
// Let Stripe handle cancel/upgrade/card update UI — don't build your own
app.post('/api/billing/portal', requireAuth, async (req, res) => {
  const user = await db.users.findUnique({ where: { id: req.user.id } })
  
  const session = await stripe.billingPortal.sessions.create({
    customer: user!.stripeCustomerId!,
    return_url: `${process.env.APP_URL}/dashboard`,
    configuration: process.env.STRIPE_PORTAL_CONFIG_ID,  // configure in Dashboard
  })
  
  res.json({ url: session.url })
})
// Frontend: redirect user to session.url — Stripe hosts the portal
```

# STRIPE CHECKOUT (HOSTED PAYMENT PAGE)
```typescript
// Alternative to custom UI — Stripe hosts the checkout form
app.post('/api/checkout', requireAuth, async (req, res) => {
  const { priceId } = req.body
  const customerId = await getOrCreateCustomer(req.user.id)
  
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: req.body.mode ?? 'subscription',   // 'payment' for one-time
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.APP_URL}/payment/success?session={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.APP_URL}/pricing`,
    allow_promotion_codes: true,
    subscription_data: {
      trial_period_days: 14,
      metadata: { userId: req.user.id },
    },
  })
  
  res.json({ url: session.url })
})
```

# TESTING
```typescript
// Stripe test card numbers
const TEST_CARDS = {
  success:          '4242 4242 4242 4242',
  declineGeneric:   '4000 0000 0000 0002',
  declineInsufficient: '4000 0000 0000 9995',
  requires3DS:      '4000 0025 0000 3155',
  disputed:         '4000 0000 0000 0259',  // triggers dispute after charge
}

// Trigger webhook events locally
// stripe listen --forward-to localhost:3000/api/webhooks/stripe
// stripe trigger customer.subscription.updated

// Test clock for subscription timing (trials, renewals)
const testClock = await stripe.testHelpers.testClocks.create({
  frozen_time: Math.floor(Date.now() / 1000),
})
// Advance time: await stripe.testHelpers.testClocks.advance(testClock.id, { frozen_time: futureTimestamp })
```

# SECURITY CHECKLIST
```
[ ] Webhook signature verified before processing any event
[ ] STRIPE_SECRET_KEY in environment variable, never in code
[ ] Separate keys for test vs production
[ ] idempotency_key on all create operations
[ ] Webhook events deduplicated (store stripeEventId)
[ ] No raw card data ever touches your server
[ ] Stripe Customer Portal for self-service (not custom cancel flow)
[ ] Amount validation: verify amount on server before charging
[ ] Logging: log every webhook received (type + id), but NOT full payload (has PII)
[ ] Restricted API keys: use restricted keys scoped to what each service needs
```
