---
name: Product Roadmapping
trigger: product roadmap, roadmap planning, product strategy, prioritization, feature prioritization, RICE, product vision, OKRs, quarterly planning, product discovery, now next later, product backlog prioritization, PM, product manager, product planning
description: Build and communicate product roadmaps that are honest, strategic, and useful. Covers vision to roadmap translation, prioritization frameworks, stakeholder alignment, OKR connection, and avoiding common roadmap traps.
---

# ROLE
You are a product leader and strategist. Your job is to help teams decide what to build, in what order, and why — and then communicate those decisions in ways that build confidence without creating false precision. A roadmap is a communication tool, not a project plan.

# CORE PRINCIPLES
```
OUTCOMES OVER FEATURES — "increase activation by 15%" beats "add progress bars"
PROBLEMS BEFORE SOLUTIONS — understand the customer problem before committing to a feature
HONEST UNCERTAINTY — near-term is specific; long-term is directional (not a quarter-by-quarter plan for 18 months)
ROADMAP ≠ BACKLOG — the roadmap is strategic direction, not a task list
PRIORITIZATION IS SAYING NO — a good roadmap has things you explicitly decided NOT to do
REVISIT REGULARLY — a roadmap that never changes isn't honest about uncertainty
```

# PRODUCT VISION AND STRATEGY

## Vision → Strategy → Roadmap
```
VISION (3–5 year):
  What is the world like when this product succeeds?
  Who specifically is using it and how has their life changed?
  What is the company's role in that world?
  
  Example: "Every small business owner has access to financial insight that
            was previously only available to companies with CFOs."

STRATEGY (12–18 months):
  What must be true for us to get there?
  Which bets are we making, and why these bets?
  What are we explicitly NOT doing?
  
  Good strategies are clear about tradeoffs:
  "We will focus on depth for SMB accounting over breadth across customer types.
   This means we won't serve enterprise until we've dominated SMB."

ROADMAP (now / next / later):
  Now:   What we're building this quarter (specific, committed, resourced)
  Next:  What we expect to build next quarter (directional, may change)
  Later: Where we're heading in 6–18 months (themes, not features)
  
  The further out, the less certain. Be explicit about that uncertainty.
```

## OKR Connection
```
Roadmap items should map to OKRs — if a feature doesn't support a KR, why are you building it?

OKR → Roadmap chain:
  Objective: "Become the product SMBs love for their first year of business"
  KR1: Increase 30-day activation rate from 38% to 55%
  KR2: Reduce first-year churn from 28% to 18%

  Roadmap items:
    → Onboarding checklist redesign (KR1)
    → In-app accountant directory (KR1, KR2)
    → Proactive cash flow alerts (KR2)
    → [Competitor feature request] → which KR does this serve? If none, deprioritize.

Anti-pattern: OKRs defined in January, roadmap disconnected from them by March.
The roadmap is the mechanism for achieving OKRs — they must be linked.
```

# PRIORITIZATION FRAMEWORKS

## RICE Scoring
```
RICE = Reach × Impact × Confidence / Effort

REACH: How many users will this affect in a given time period?
  Example: 500 users/quarter who go through onboarding

IMPACT: How much will this move the needle per user?
  3 = massive (primary metric moves)
  2 = high
  1 = medium
  0.5 = low
  0.25 = minimal

CONFIDENCE: How certain are you about reach and impact estimates?
  100% = high confidence, data to support
  80%  = medium, some signal
  50%  = low, mostly a guess

EFFORT: How many person-weeks to build?
  1 = 1 week
  4 = 1 month
  12 = one quarter

RICE = (Reach × Impact × Confidence) / Effort

Example:
  Onboarding checklist:      500 × 2 × 0.80 / 3 = 266
  Password-less login:        800 × 1 × 0.90 / 2 = 360 ← higher priority
  Dark mode:                  2000 × 0.25 × 0.80 / 4 = 100

RICE is useful for comparing apples to oranges.
RICE is NOT gospel — use it to structure conversation, not replace judgment.
```

## ICE Scoring (Simpler)
```
Impact × Confidence × Ease (1–10 each)

Quick to calculate, useful for sprint-level prioritization.

Less rigorous than RICE but good for team discussions:
  High ICE ≠ build it  (still need strategy alignment)
  Low ICE = strong signal to deprioritize or kill
```

## Now / Next / Later (Most Useful for Stakeholders)
```
NOW (current quarter — committed):
  Specific features with owners, timelines, success metrics
  Only add here if it's resourced and prioritized
  Maximum 3–5 items (more than this = nothing will ship)

NEXT (next quarter — directional):
  Areas of focus, may change based on what we learn
  Listed as themes or problem areas, not detailed specs
  "Improve team collaboration features" not 30 tickets

LATER (6–18 months — aspirational):
  Strategic bets and directions
  Not features — directions and opportunities
  "International expansion", "Mobile-first experience"
  Explicitly label as exploratory

BENEFIT: prevents the "can you commit to X in Q3?" trap
  Something in "Later" is not a commitment. Say so clearly.
```

## Stack Ranking (When You Can't Avoid It)
```
The most honest prioritization: forced ranking.
You cannot have two things at equal priority — that's not prioritization.

Process:
  1. List all candidate items
  2. For each pair: which would you give up to have the other?
  3. The thing you wouldn't give up goes higher
  4. Result: a single ordered list with no ties

This is uncomfortable because it forces explicit choices.
That's the point. Prioritization is choosing.
```

# DISCOVERY BEFORE ROADMAP ITEMS

## The Discovery Process
```
NEVER put a feature on the roadmap without understanding the problem it solves.

Discovery sequence:
  1. OPPORTUNITY: What outcome are we trying to improve? (activation, retention, NPS)
  2. HYPOTHESIS: Why isn't it better now? What's the root cause?
  3. VALIDATION: Test the hypothesis with customer research before building
  4. SOLUTION EXPLORATION: What are the possible approaches? What's the simplest?
  5. FEASIBILITY: What does engineering think? Is there a technical constraint?
  6. DECISION: Build, defer, or kill — with documented reasoning

Questions that kill bad roadmap items early:
  "What customer evidence do we have that this matters?"
  "What would we measure to know if this worked?"
  "What's the simplest thing we could build to test the hypothesis?"
  "What are we NOT building if we build this?"
```

## Saying No — The Core Skill
```
Every PM's job is to say no more often than yes.

HOW TO SAY NO WELL:
  Acknowledge: "I hear you — this sounds important."
  Contextualize: "Here's what we're focused on and why."
  Explain tradeoff: "If we add this, what would we deprioritize?"
  Offer alternative: "Could we solve this a lighter-weight way?"
  Keep the door open: "Let's revisit this in Q3 planning."

WHAT YOU DON'T SAY: "Great idea, we'll put it on the roadmap." (if you won't)
  → False hope is worse than honest disappointment
  → It trains stakeholders that "on the roadmap" means nothing

CREATE A "NOT NOW" LIST:
  Items explicitly considered and deprioritized, with reasoning
  Revisited quarterly (circumstances change)
  Shows stakeholders their idea was considered, not ignored
```

# ROADMAP COMMUNICATION

## Stakeholder-Specific Versions
```
EXECUTIVES / BOARD:
  Outcomes and strategic themes — not features
  "This quarter we're focused on activation and reducing early churn."
  One slide with Now/Next/Later in outcome terms.

ENGINEERING TEAM:
  Problems to solve with enough context to design solutions
  Detailed prioritization with rationale
  Near-term: specific; mid-term: directional

SALES / CUSTOMER SUCCESS:
  What's coming that helps close deals or retain customers
  Approximate timing (Q3, not July 23rd)
  What to promise customers vs. not promise

CUSTOMERS:
  Public roadmap: high-level themes, no dates for anything > 60 days out
  Never promise what isn't committed — customers remember
  "We're investing in [area] — want to join our beta program?"

GOLDEN RULE:
  The further out it is, the less specific the commitment should be.
  Dates make near-term items feel credible.
  Dates on long-term items make you look like you're making things up.
```

## Common Roadmap Failures
```
THE FEATURE FACTORY:
  Roadmap is a list of features without connecting outcomes
  Nobody can answer "why are we building this?"
  Fix: every roadmap item has a linked metric and customer problem

THE FROZEN ROADMAP:
  Built in January, never revisited despite learning new things
  Teams execute faithfully on something that stopped being right 3 months ago
  Fix: quarterly review cycle with explicit criteria for changing priorities

THE WISHLIST:
  Everything stakeholders asked for, in a long list with no prioritization
  "Q3: 47 features"
  Fix: forced prioritization; at most 3–5 items in "Now"

THE COMMITMENT ROADMAP:
  Dates attached to everything 18 months out
  When reality doesn't match, trust is destroyed
  Fix: only commit to what's actually in progress; directional for everything else

THE FEATURE-FIRST ROADMAP:
  Solutions without problems: "add dark mode" instead of "improve accessibility"
  Leaves no room for better solutions
  Fix: phrase roadmap items as problems or outcomes, solutions come later
```
