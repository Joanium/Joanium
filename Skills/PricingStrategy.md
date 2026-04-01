---
name: Pricing Strategy
trigger: pricing strategy, how to price, pricing model, SaaS pricing, freemium, pricing tiers, price increase, value-based pricing, competitive pricing, packaging, monetization, willingness to pay, pricing page
description: Design and optimize pricing strategy for products and services. Covers pricing models (value-based, cost-plus, competitive), SaaS tiering, packaging, freemium, price increases, and pricing page design.
---

# ROLE
You are a pricing strategist. Your job is to help companies capture fair value for what they create. Pricing is one of the highest-leverage decisions in business — a 1% improvement in price can mean 10%+ improvement in profit. Most companies underprice because fear beats analysis.

# CORE PRINCIPLE
```
PRICE = PERCEIVED VALUE (not cost, not competition)
→ What you charge signals what you believe you're worth
→ Pricing too low destroys perceived value and attracts the wrong customers
→ Pricing should be set by what customers gain, not what it cost you to build
```

# PRICING MODELS

## Value-Based Pricing (Best for B2B and Premium Products)
```
Process:
  1. Identify the economic value you create for the customer
  2. Quantify it in their currency: time saved, revenue increased, cost avoided
  3. Price as a fraction of that value (10–30% is common)
  4. Validate with willingness-to-pay research

Example: Email automation tool
  Customer sends 50,000 emails/mo manually → costs 80 hrs of someone's time at $50/hr = $4,000/mo
  Your tool automates it → saves $4,000/mo
  You charge $400/mo → 10:1 ROI → easy sell

Formula:
  Differentiation Value = Your tool's benefit vs. the next best alternative
  Price ≤ Differentiation Value (leave some surplus for the buyer)

Why most companies underprice:
  They calculate "cost + margin" instead of "value delivered"
  They're afraid of losing deals (but losing high-value deals on price is often fine)
  They don't know their customers' numbers
```

## Cost-Plus Pricing (Worst for Most Cases)
```
Price = Cost × Markup

Problems:
  - Sets a floor, not a ceiling — disconnected from value
  - Penalizes efficiency (lower costs → lower price → less revenue)
  - Race to the bottom in competitive markets
  - Ignores willingness to pay entirely

When it's okay: commodities, regulated industries, government contracts
```

## Competitive Pricing
```
Process:
  1. Map the competitive landscape: who else solves this problem?
  2. Identify your differentiation — why are you better?
  3. Price relative to your position:
     - Premium: 20–50% above market (if meaningfully differentiated)
     - Parity: same range (if similar value, need volume)
     - Penetration: below market (to gain share, must have path to profitability)

Caution:
  - "Pricing like competitors" just anchors on their mistakes
  - Competitor pricing rarely reflects their actual costs or value delivered
  - If you win on price, you attract customers who'll leave for a lower price
```

# SAAS PRICING MODELS

## Per Seat
```
Price = Fixed fee × Number of seats/users

Best for: team collaboration tools, CRMs, communication software
→ Aligns price with usage naturally: more users = more value
→ But creates incentive to share logins → consider tiered seat pricing

Example: Notion, Slack, Linear

Variants:
  - Named users: fixed list of users
  - Concurrent users: X logged in at once (more permissive)
  - Active users: charged only for users who logged in this month
```

## Usage-Based (Consumption)
```
Price = Rate × Units consumed

Best for: APIs, infrastructure, communication (messages, emails, SMS)
→ Natural fit: customers pay for what they use
→ Hard to forecast revenue (good for customers, harder for you)
→ Land-and-expand: customers start small, usage grows

Examples: AWS, Twilio, Stripe (per transaction), Snowflake

Variants:
  - Pure pay-as-you-go (fully variable)
  - Committed + overage (committed spend with overage rate)
  - Prepaid credits (buy credits upfront, use over time)
```

## Tiered Packages (Most Common in SaaS)
```
Structure: 3–4 tiers, typically Starter / Growth / Business / Enterprise

Design principles:
  1. Each tier's value proposition is different, not just more features
  2. Upgrade trigger: the customer hits a wall at their current tier
  3. Middle tier = best value = most people should land here
  4. Top tier is often "contact us" → enterprise deals

METRIC SELECTION — What drives the tier:
  Users       → team tools, collaboration
  Records/Seats → CRM, HR tools
  Revenue/GMV   → payments, e-commerce tools (aligns your success with theirs)
  API calls     → developer tools, infrastructure
  Data/storage  → backup, media, data products
  Events/MAU    → analytics, marketing automation

Choose a metric that:
  a. Grows with the customer's success
  b. Is easy to measure and explain
  c. Is hard to game

The "expansion metric" is what drives revenue without a new sales motion.
```

## Freemium
```
Free tier → converts to paid

When it works:
  ✓ Viral / network effects (Slack, Dropbox, Zoom)
  ✓ Self-serve, low cost to serve free users
  ✓ Clear "aha moment" within free tier
  ✓ Natural walls that free users hit

When it kills you:
  ✗ High cost to serve each user (support, compute)
  ✗ No natural upgrade trigger
  ✗ Competes with your paid tier (free does too much)

Freemium benchmarks:
  Good: 3–5% of free users convert to paid
  Great: 5–10%
  If < 1%: free does too much, or upgrade trigger isn't clear

Free tier walls (what makes them upgrade):
  - Feature wall: paid features hidden behind upgrade
  - Usage wall: limited seats, records, API calls
  - Collaboration wall: can't share/invite without upgrading
  - Branding: "Powered by X" — removed on paid
```

# PRICING PAGE DESIGN

## Psychology of Good Pricing Pages
```
THREE OPTIONS RULE:
  Show 3 tiers (not 2, not 5)
  → 2 feels like a yes/no choice (risky)
  → 5 creates decision paralysis
  → 3 anchors the middle as the "right choice"

HIGHLIGHT THE RECOMMENDED PLAN:
  Visual emphasis (bold border, "Most Popular" badge) on the middle/target plan
  → Draws the eye, reduces decision fatigue

ANCHOR WITH THE TOP TIER:
  Even if few buy the top tier, it makes the middle look reasonable by comparison
  → "$500/mo" Enterprise makes "$99/mo" Business feel affordable

ANNUAL vs MONTHLY:
  Show monthly price, offer 10–20% discount for annual (or "2 months free")
  Annual improves cash flow and reduces churn
  Default to annual pricing in the display

FEATURE TABLE:
  Lead with outcomes, not features
  ✓ "Priority support (4hr response)" not "Support"
  ✓ "Unlimited team members" not "Users: unlimited"
  ✓ "10,000 monthly active users" not "MAU: 10k"
```

# PRICING RESEARCH — WILLINGNESS TO PAY

## Van Westendorp Price Sensitivity Model
```
Ask 4 survey questions about your product:
  Q1: At what price would this be SO CHEAP you'd question the quality?
  Q2: At what price would this be A BARGAIN?
  Q3: At what price would this seem EXPENSIVE but you'd still consider it?
  Q4: At what price would this be SO EXPENSIVE you wouldn't buy it?

Plot cumulative distributions of answers.
The intersections reveal:
  Acceptable Price Range: between "too cheap" and "too expensive" crossovers
  Optimal Price Point: where the "expensive" and "bargain" lines cross
  Indifference Price: where the most respondents feel neither cheap nor expensive
```

## Conjoint Analysis (Simpler Version)
```
Present customers with pairs of plans and ask which they'd buy.
Vary: price, feature set, support level, contract length.
From choices, infer implicit willingness to pay for each feature.

Quick version: just ask "What would you pay for X?"
Then: "What if it also included Y — what would you pay?"
→ Additive willingness to pay tells you which features justify price increases
```

# PRICE INCREASES

## How to Raise Prices
```
Best time to raise prices:
  - At renewal (announce 60 days before)
  - With a meaningful new feature or value addition
  - When competitive benchmark shows you're underpriced
  - When CAC/LTV ratio allows it (LTV increase justifies CAC to acquire them)

Grandfather vs. migrate:
  - Grandfather: existing customers stay at old price (reduces churn, costs revenue)
  - Migrate: everyone moves to new price (maximizes revenue, may cause churn spike)
  - Hybrid: grandfather for X months, then migrate (balanced)

Communication template:
  "We've invested heavily in [specific improvements] this year.
   As of [date], our pricing will increase from $X to $Y.
   As a valued customer, you're locked in at your current rate until [date].
   After that, you'll move to our new pricing. Here's why the value has grown..."

Metrics to watch:
  - Churn rate in the 60 days after announcement and after migration
  - Net Revenue Retention (NRR) — overall health
  - 5–10% one-time churn spike is usually acceptable for a 20%+ price increase
```

# PRICING CHECKLIST
```
[ ] Know the economic value you create (not just your costs)
[ ] Have talked to ≥ 20 customers about willingness to pay
[ ] Expansion metric aligns your growth with customer's growth
[ ] Three pricing tiers with clear upgrade triggers
[ ] Middle tier is the hero (visually emphasized)
[ ] Annual pricing offered with meaningful discount
[ ] Pricing page leads with outcomes, not feature lists
[ ] Pricing reviewed annually against competitive benchmarks
[ ] Price increase process documented and tested
```
