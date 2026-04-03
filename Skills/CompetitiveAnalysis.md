---
name: Competitive Analysis
trigger: competitive analysis, competitor research, competitive intelligence, market analysis, competitor landscape, positioning, competitive moat, market positioning, compete against, win/loss analysis, battlecard, competitor comparison, analyze competitors
description: A systematic framework for researching, mapping, and deriving strategy from the competitive landscape. Use for market entry analysis, positioning decisions, competitive battlecards, product strategy, pricing benchmarking, and understanding why you win and lose deals.
---

Competitive analysis is the practice of systematically understanding your competitive environment so you can make better strategic decisions. It's not about copying competitors or obsessing over them — it's about understanding the landscape clearly enough to find and defend a differentiated position.

> "Competition is for people who don't know where they want to go." — Peter Thiel  
> That said: you still need to know what your competitors are doing.

## Competitor Taxonomy

Not all competitors are the same. Map them before analyzing.

```
Direct competitors:       Solve the same problem for the same customer
  → You lose deals to them directly; customer considers both

Indirect competitors:     Solve the same problem with a different approach
  → "We already use spreadsheets for this" is a competitor

Substitute solutions:     Customer solves the problem without your category
  → "We haven't prioritized this yet" / "We do it manually"

Adjacent competitors:     Adjacent market, could expand into yours
  → Watch list: well-funded companies expanding toward your space

Future threats:           Not a competitor today; might be in 2-3 years
  → Platform giants (AWS, Salesforce, Notion) adding features
```

## Phase 1: Competitive Landscape Mapping

**Discovery — finding competitors:**
```
Primary sources:
  - Ask customers: "What else did you consider before choosing us?"
  - Win/loss analysis: "Who did we lose this deal to?"
  - Sales team: where are they seeing competition in deals?
  - Category terms on G2, Capterra, Product Hunt, App Store
  - Google: "[your category] software", "[your category] alternative"
  - Job postings: companies hiring for roles similar to yours

Secondary sources:
  - Crunchbase: companies in your category with recent funding
  - LinkedIn: filter by industry + company size
  - Industry analyst reports (Gartner, Forrester, IDC)
  - Reddit/Hacker News: "What do you use for [problem]?"
```

**Competitive landscape matrix:**
```
Build a simple matrix to visualize positioning:

              │ Enterprise focus │ SMB focus
──────────────┼──────────────────┼──────────────
Broad feature │    Competitor A  │  Competitor B
set           │    (ServiceNow)  │  (Monday.com)
──────────────┼──────────────────┼──────────────
Narrow/       │    Competitor C  │  ← Your target
specialized   │    (Pager Duty)  │    whitespace?

Axes to use:
  - Breadth vs. depth of feature set
  - Enterprise vs. SMB focus
  - Developer-first vs. business-user-first
  - Build vs. buy (internal tools vs. SaaS)
  - Vertical focus vs. horizontal platform
  - Price point
```

## Phase 2: Deep Competitor Research

**Product research:**
```
□ Sign up for free tier / request a demo (use a personal email)
□ Complete their onboarding — what do they emphasize?
□ Document the full feature set (screenshots, notes)
□ Note what's hard or unclear — those are their weaknesses
□ Compare pricing pages (screenshot and date every capture)
□ Read their product changelog / release notes (velocity signal)
□ Follow their product blog / roadmap announcements

Key observations:
  - What is their primary value proposition?
  - Who is their hero customer persona?
  - What is their pricing model and entry point?
  - What is noticeably absent from their product?
  - What do they seem to be investing in right now?
```

**Customer voice research:**
```
G2, Capterra, Trustpilot reviews — mine for gold:
  Positive reviews → their strengths (what we need to match or acknowledge)
  Negative reviews → their weaknesses (our opportunities)
  Feature requests → what customers want that nobody is building

Analysis framework for reviews:
  1. Read 30-50 reviews for each major competitor
  2. Code themes: ease of use, pricing, support, missing features, integrations
  3. Look for patterns in the 3-star reviews (these are most honest)
  4. Note specific phrases customers use to describe value or frustration
     → These phrases are also your marketing copy goldmine

Social listening:
  - Search "[Competitor name] alternative" — see what pain points drive switching
  - Reddit: search competitor name, filter by top posts (unfiltered opinions)
  - Twitter/X: search competitor name, filter by question marks (frustration signals)
  - Hacker News: "Ask HN: alternatives to [competitor]"
```

**Positioning and messaging research:**
```
For each competitor, document:
  Tagline / hero headline: _______________
  Target audience:         _______________
  Primary differentiator:  _______________
  Category framing:        _______________
    ("The leading X for Y" — how do they define their category?)
  
  Proof points (how they back up claims):
    - Customer logos used (enterprise vs. startup vs. mixed)
    - Numbers cited ("10,000 companies", "saves 5 hours/week")
    - Certifications and trust signals

  Channels:
    - Primary acquisition (SEO, paid, community, partnerships)
    - Content strategy (what topics do they own?)
    - Community (Slack group, Discord, user forum?)
```

## Phase 3: Win/Loss Analysis

Win/loss analysis is the most reliable source of competitive intelligence — from your own deals.

**Setting up win/loss interviews:**
```
Who to interview:
  - Recent losses (within 30 days — memory is fresh)
  - Recent wins (understand why you won, not just why you lose)
  - Aim for: 10+ interviews per quarter minimum

Interview questions (for losses):
  1. "Walk me through how you evaluated solutions in this category."
  2. "What were the most important criteria for your decision?"
  3. "What did you ultimately decide on, and why?"
  4. "At what point did [our product] fall short in your evaluation?"
  5. "What would have needed to be different for us to win?"
  6. "Is there anything we should know about our competitor that we might not?"

Interview questions (for wins):
  1. "What made you choose us over the alternatives?"
  2. "Was there a moment you almost went a different direction? What happened?"
  3. "How would you describe why you chose us to a colleague?"
  4. "What could our competitors do to take your business in the future?"
```

**Win/loss tracking dashboard:**
```
Track monthly:
  Win rate overall:           ___%
  Win rate by competitor:
    vs. Competitor A:         ___%  (n=XX deals)
    vs. Competitor B:         ___%
    vs. No decision (lost to status quo): ___%
  
  Top reasons we win:
    1. [theme]  XX% of wins
    2. [theme]  XX% of wins
  
  Top reasons we lose:
    1. [theme]  XX% of losses
    2. [theme]  XX% of losses

  Win rate trend (last 6 months):
    [chart or table showing monthly win rate]
```

## Phase 4: Competitive Battlecards

Battlecards give your sales team the information they need to handle competitive objections in real time.

**Battlecard template:**
```markdown
# Battlecard: Us vs. [Competitor Name]
Last updated: [date] | Owner: [product marketing]

## Quick Summary
[2-3 sentences: who they are, their ICP, their core strength]

## When We Win
- [Scenario 1: situation where we reliably win]
- [Scenario 2]
- [Scenario 3]

## When We Lose
- [Scenario 1: situation where we often lose]
- [Scenario 2]

## Our Differentiators
| What we do better | Why it matters to the customer |
|--------------------|-------------------------------|
| [differentiator 1] | [customer value] |
| [differentiator 2] | [customer value] |

## Their Strengths (acknowledge, don't dismiss)
- [Genuine strength 1] — and here's how we respond: ___
- [Genuine strength 2] — and here's how we respond: ___

## Handling Common Objections
"[Competitor] has [specific feature] that you don't."
→ [Honest, confident response. Never trash the competitor.]

"[Competitor] is cheaper."
→ [How to reframe on value, not price]

"We already use [Competitor] for [adjacent use case]."
→ [Coexistence story or displacement angle]

## Trap Questions to Ask (surfaces our strengths)
- "How do you currently handle [thing we do uniquely well]?"
- "What happens when [scenario our competitor handles poorly]?"
- "How important is [our key differentiator] to your team?"

## Do Not Say
- [Common mistake 1 — e.g., "They're enterprise-only" when they're not]
- [Common mistake 2]

## Reference Customers
[2-3 customers who switched from this competitor — name, quote, use case]
```

## Phase 5: Positioning Against Competition

**Differentiation strategy options:**
```
1. Head-to-head differentiation
   "We do everything they do, but better"
   → High bar. Requires clear, provable superiority. Expensive to sustain.

2. Niche down
   "We're specifically built for [specific segment] they ignore"
   → Easier to win a niche than fight a broad war. Danger: niche may be small.

3. Category creation
   "We're not competing with them — we're a different category"
   → Highest upside; eliminates direct comparison. Requires substantial content investment.

4. Flank attack
   "Target the customer segment they can't/won't serve well"
   → Enterprise incumbent → go SMB. Complex product → go simple. High price → go low.

5. Integration/ecosystem
   "We work WITH their tools, not against them"
   → Sidestep competition by being complements, not substitutes. 
      Works until the platform acquires or clones you.
```

**Positioning statement structure:**
```
For [target customer]
Who [have this specific problem or goal]
[Product name] is a [category]
That [primary differentiator]
Unlike [competitive alternative]
We [specific unique capability or approach]

Example:
"For engineering teams at growth-stage SaaS companies
 who are shipping features faster than their monitoring can keep up with,
 DataScope is an observability platform
 that surfaces the signals that matter without requiring a dedicated SRE team.
 Unlike Datadog, which requires weeks of setup and expert tuning,
 we deliver automatic insights from day one."
```

## Competitive Intelligence System

```
Cadence:
  Weekly:   Scan competitor Twitter/LinkedIn, check for product updates
  Monthly:  Review new G2/Capterra reviews, update battlecards if needed
  Quarterly: Deep audit, win/loss interview synthesis, landscape update
  Annually:  Landscape map refresh, strategic implications for roadmap

Monitoring tools:
  - Google Alerts: "[competitor name]" + "[competitor name] new feature"
  - Mention.com or Brand24: track mentions across the web
  - SimilarWeb / SEMrush: traffic and keyword trends for competitors
  - LinkedIn: follow competitor product team members (see what they're building)
  - Built With / Wappalyzer: see tech stack changes on competitor site

Intelligence sharing:
  - Competitive Slack channel for real-time findings
  - Monthly competitive brief to product, sales, marketing
  - Battlecards in sales enablement tool (updated quarterly)
  - Annual competitive session in product planning
```
