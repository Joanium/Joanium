---
name: Feature Flags
trigger: feature flags, feature toggles, feature switches, LaunchDarkly, gradual rollout, canary release, percentage rollout, kill switch, dark launch, A/B testing flags, feature gating, flagging, unleash, posthog flags, openfeature, flag management
description: Design and implement feature flag systems for safe deployments, gradual rollouts, A/B tests, and kill switches. Covers flag types, targeting rules, SDK integration, flag hygiene, and self-hosting vs managed services.
---

# ROLE
You are a platform engineer who designs feature flag systems that let teams ship faster and safer. Feature flags decouple deployment from release — code can be in production, invisible to users, until you're ready. Done right, they eliminate big-bang launches, enable instant rollbacks, and power experimentation.

# CORE PRINCIPLES
```
DEPLOY ≠ RELEASE:     Code in production doesn't mean users see it — flags control who does
INSTANT ROLLBACK:     Turn off a bad feature in seconds, no deploy needed
TEMPORARY BY DEFAULT: Every flag has an owner, a purpose, and a removal date
CLEAN UP RELENTLESSLY: Flag debt is technical debt — stale flags cause bugs and confusion
EVALUATE SERVER-SIDE:  Client-side flags can be tampered with; use them for UI only
AVOID FLAG HELL:       Nested flag conditionals are a code smell — design flags to be flat
```

# FLAG TYPES

## The Four Types — Use the Right One
```
TYPE 1: RELEASE FLAG (most common)
  Purpose: Hide in-progress feature until ready; kill switch after launch
  Lifetime: Short (days to weeks during development, months max after release)
  Targeting: Everyone OFF → gradual rollout → everyone ON → remove flag
  Example: new_checkout_flow, ai_assistant_enabled

TYPE 2: EXPERIMENT FLAG (A/B test)
  Purpose: Randomly split users to measure impact of a change
  Lifetime: Short (run experiment, reach significance, pick winner, remove)
  Targeting: Random % split, sticky per user (same variant across sessions)
  Example: checkout_button_color, recommendation_algorithm_v2

TYPE 3: OPS / KILL SWITCH
  Purpose: Emergency disable of a system component without deploy
  Lifetime: Permanent (these stay forever as safety levers)
  Targeting: ON by default, turned OFF in emergency
  Example: third_party_payment_gateway, background_job_enabled, rate_limiter_strict

TYPE 4: PERMISSION FLAG (entitlement)
  Purpose: Gate features by plan, role, beta access, or user segment
  Lifetime: Long-lived (tied to business logic)
  Targeting: Specific users, companies, or plan tiers
  Example: advanced_analytics, api_access, white_label_enabled
```

# TARGETING RULES

## Evaluation Order
```
FLAGS evaluate in order — first matching rule wins:

1. OVERRIDE:    Specific user IDs always get this value (QA, devs, demos)
2. SEGMENT:     Matched by user properties (plan, country, company)
3. PERCENTAGE:  Random but consistent hash-based split
4. DEFAULT:     The fallback value if no rule matches

Example targeting configuration:
  Flag: new_dashboard
  Rules:
    1. userId IN [qa_team_ids] → TRUE        (QA always sees it)
    2. plan == 'enterprise' → TRUE           (enterprise gets early access)
    3. country == 'US' → 25%                 (25% of US users)
    4. DEFAULT → FALSE                       (everyone else: off)
```

## Consistent Hashing for Percentage Rollouts
```typescript
// Users must get the SAME variant every time (sticky bucketing)
// Use deterministic hash, not random()

function getUserVariant(userId: string, flagKey: string, rolloutPercent: number): boolean {
  // Combine userId + flagKey so same user gets different buckets for different flags
  const hashInput = `${flagKey}:${userId}`
  const hash = murmurhash3(hashInput)    // or any fast deterministic hash
  const bucket = (hash % 10000) / 100   // 0.00 to 99.99
  return bucket < rolloutPercent
}

// Example: 10% rollout of "new_search"
// User "user_123": hash("new_search:user_123") % 10000 / 100 = 7.43 → bucket < 10 → TRUE
// User "user_456": hash("new_search:user_456") % 10000 / 100 = 65.2 → bucket < 10 → FALSE
// Same user always gets the same result: consistent experience
```

# IMPLEMENTATION

## Option A — LaunchDarkly (Managed, Best DX)
```typescript
import { init, LDClient } from 'launchdarkly-node-server-sdk'

// Initialize once at startup
const ldClient: LDClient = init(process.env.LAUNCHDARKLY_SDK_KEY!)
await ldClient.waitForInitialization()

// Evaluate a flag
const context = {
  kind: 'user',
  key: user.id,                  // Required: unique identifier
  email: user.email,
  plan: user.plan,               // Custom attributes for targeting
  company: user.companyId,
  country: user.country,
}

// Boolean flag
const showNewDashboard = await ldClient.variation('new_dashboard', context, false)

// String variant (for A/B tests with multiple variants)
const checkoutVariant = await ldClient.variation('checkout_layout', context, 'control')
// Returns 'control' | 'variant_a' | 'variant_b'

// Multivariate (any JSON value)
const algConfig = await ldClient.variation('recommendation_config', context, {
  algorithm: 'collaborative',
  maxResults: 10,
})
```

## Option B — Self-Hosted with Unleash
```typescript
import { initialize } from 'unleash-client'

const unleash = initialize({
  url: 'https://unleash.internal.yourapp.com/api',
  appName: 'api-server',
  customHeaders: { Authorization: process.env.UNLEASH_API_TOKEN! },
})

await new Promise(resolve => unleash.on('synchronized', resolve))

// Check flag
const context = {
  userId: user.id,
  properties: { plan: user.plan, country: user.country },
}
const enabled = unleash.isEnabled('new_checkout_flow', context)

// Variant (A/B test)
const variant = unleash.getVariant('checkout_button', context)
if (variant.enabled) {
  return variant.name  // 'blue' | 'green' | 'red'
}
```

## Option C — Lightweight Self-Built (Small Teams)
```typescript
// Store flags in DB or config; good enough for 10-50 flags
// flags table: { key, enabled, rollout_percent, allowed_user_ids, allowed_plans, metadata }

class FeatureFlags {
  private flags: Map<string, FlagConfig> = new Map()
  
  async initialize() {
    const rows = await db.featureFlags.findMany({ where: { deleted: false } })
    this.flags = new Map(rows.map(r => [r.key, r]))
    // Refresh every 30 seconds
    setInterval(() => this.refresh(), 30_000)
  }
  
  isEnabled(key: string, context: { userId: string; plan?: string }): boolean {
    const flag = this.flags.get(key)
    if (!flag || !flag.enabled) return false
    
    // Override: specific user always gets flag
    if (flag.allowedUserIds?.includes(context.userId)) return true
    
    // Plan gate
    if (flag.allowedPlans?.length && !flag.allowedPlans.includes(context.plan ?? '')) {
      return false
    }
    
    // Percentage rollout
    if (flag.rolloutPercent < 100) {
      const bucket = hash(`${key}:${context.userId}`) % 100
      return bucket < flag.rolloutPercent
    }
    
    return true
  }
  
  private async refresh() {
    const rows = await db.featureFlags.findMany({ where: { deleted: false } })
    this.flags = new Map(rows.map(r => [r.key, r]))
  }
}

export const flags = new FeatureFlags()
```

# REACT INTEGRATION

## Context Provider Pattern
```typescript
// Provider: fetch flags once for the user, make available everywhere
const FlagContext = createContext<Record<string, boolean>>({})

export function FlagProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [flags, setFlags] = useState<Record<string, boolean>>({})
  
  useEffect(() => {
    fetch(`/api/flags?userId=${userId}`)
      .then(r => r.json())
      .then(setFlags)
  }, [userId])
  
  return <FlagContext.Provider value={flags}>{children}</FlagContext.Provider>
}

export function useFlag(key: string, defaultValue = false): boolean {
  const flags = useContext(FlagContext)
  return key in flags ? flags[key] : defaultValue
}

// Server-side: resolve flags in RSC (React Server Components) — no loading state
// app/dashboard/page.tsx
export default async function DashboardPage() {
  const user = await getCurrentUser()
  const context = { key: user.id, plan: user.plan }
  const showNewDashboard = await ldClient.variation('new_dashboard', context, false)
  
  return showNewDashboard ? <NewDashboard /> : <OldDashboard />
}
```

## Usage in Components
```tsx
// Simple boolean gate
function CheckoutButton() {
  const showOneClickCheckout = useFlag('one_click_checkout')
  return showOneClickCheckout ? <OneClickButton /> : <StandardButton />
}

// Variant-based A/B test
function HeroBanner() {
  const variant = useVariant('hero_copy', 'control')
  const copies = {
    control:   { h1: 'Build faster.', cta: 'Get Started' },
    variant_a: { h1: 'Ship with confidence.', cta: 'Start Free' },
    variant_b: { h1: 'Less code. More power.', cta: 'Try It Free' },
  }
  const copy = copies[variant as keyof typeof copies] ?? copies.control
  return <section><h1>{copy.h1}</h1><Button>{copy.cta}</Button></section>
}
```

# FLAG HYGIENE — THE DISCIPLINE

## Every Flag Needs Metadata
```typescript
// At flag creation, document:
const flagSpec = {
  key: 'new_checkout_flow',
  type: 'release',                    // release | experiment | ops | permission
  owner: 'alice@yourcompany.com',
  ticket: 'ENG-1234',
  description: 'New checkout redesign with single-page flow',
  created: '2024-03-01',
  removalDeadline: '2024-04-15',      // When to clean up after full rollout
  defaultValue: false,
  notes: 'Coordinate with growth team on rollout schedule',
}
```

## Stale Flag Detection
```typescript
// Automated check: alert when flags are past their deadline
// Run in CI or as a weekly cron

async function detectStaleFlagAudit() {
  const allFlags = await getFlagsWithMetadata()
  const stale = allFlags.filter(flag => {
    if (flag.type === 'ops') return false    // Ops flags are permanent
    if (!flag.removalDeadline) return true   // No deadline = oversight
    return new Date(flag.removalDeadline) < new Date()
  })
  
  if (stale.length > 0) {
    await notifySlack(`#eng-alerts`, 
      `⚠️ ${stale.length} stale feature flags need cleanup:\n` +
      stale.map(f => `• ${f.key} (owner: ${f.owner}, deadline: ${f.removalDeadline})`).join('\n')
    )
  }
}
```

## Removing a Flag (The Hardest Part)
```
PROCESS:
  1. Set flag to 100% ON for all users for 1-2 weeks
  2. Monitor error rates and metrics — confirm nothing breaks
  3. Remove all flag checks from code (the if/else)
  4. Deploy the clean code
  5. Delete the flag from the flag management system
  6. Close the ticket

CODE CLEANUP — don't leave orphaned code:
  // WRONG: flag removed from system but code left in
  if (flags.isEnabled('old_flag')) {  // ← dead code, flag always resolves to default
    return <OldComponent />
  }
  return <NewComponent />

  // RIGHT after flag removal:
  return <NewComponent />

GREP FOR STALE FLAGS:
  git grep 'old_flag_key' --  # Find all remaining references
  # Must be zero before flag is deleted from system
```

# FLAG ANTI-PATTERNS
```
ANTI-PATTERN 1: Flag inside a flag
  if (flagA) {
    if (flagB) { ... }   ← logic explosion: 4 states to test
  }
  Fix: flatten into a single flag with clear semantics, or use variants

ANTI-PATTERN 2: Using flags as permanent config
  const maxRetries = flags.variation('max_retries', 3)  ← this is config, not a flag
  Fix: use environment variables or a proper config system

ANTI-PATTERN 3: Different behavior per environment without flags
  if (ENV === 'production') { ... }  ← same as a flag, but uncontrolled
  Fix: use an ops flag, so you can toggle it without a deploy

ANTI-PATTERN 4: Flags without owners
  Fix: require owner field at creation; block flagless creation in PR template

ANTI-PATTERN 5: Testing in production only
  Fix: test all flag variants in CI — spin up combinations as test fixtures
```

# TESTING WITH FLAGS
```typescript
// Inject flag state in tests — never depend on external flag service in tests
class MockFlagClient {
  private overrides: Map<string, boolean> = new Map()
  
  enable(key: string) { this.overrides.set(key, true); return this }
  disable(key: string) { this.overrides.set(key, false); return this }
  isEnabled(key: string) { return this.overrides.get(key) ?? false }
}

// In Jest test
describe('Checkout', () => {
  it('shows one-click button when flag is on', () => {
    const flags = new MockFlagClient().enable('one_click_checkout')
    render(<Checkout flagClient={flags} />)
    expect(screen.getByRole('button', { name: /one.click/i })).toBeInTheDocument()
  })
  
  it('shows standard button when flag is off', () => {
    const flags = new MockFlagClient().disable('one_click_checkout')
    render(<Checkout flagClient={flags} />)
    expect(screen.getByRole('button', { name: /checkout/i })).toBeInTheDocument()
  })
})
```

# CHECKLIST
```
New flag:
[ ] Name is descriptive (new_checkout_flow, not feature_123)
[ ] Type declared (release/experiment/ops/permission)
[ ] Owner assigned
[ ] Removal deadline set (for non-ops flags)
[ ] Ticket linked
[ ] Default value is the safe/old behavior

Implementation:
[ ] Flag evaluated once and passed down (not called in a loop)
[ ] Both branches tested (flag ON and flag OFF)
[ ] Server-side evaluation for logic; client-side only for UI rendering
[ ] No sensitive logic gated by client-only flags

Hygiene:
[ ] Stale flag audit runs weekly
[ ] Flags fully rolled out get removed within the deadline
[ ] grep shows zero references before deleting from flag system
[ ] PR template asks "does this PR add a flag? Is the old flag now removable?"
```
