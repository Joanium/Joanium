---
name: Conversion Rate Optimization (CRO)
trigger: conversion rate, CRO, landing page optimization, funnel optimization, checkout optimization, signup conversion, reduce drop-off, increase conversions, heatmap, session recording, form optimization, call to action, above the fold, bounce rate, conversion funnel
description: A systematic framework for identifying and removing friction from user funnels to increase conversion rates. Use for landing page optimization, checkout flow improvements, onboarding funnels, signup flows, and making data-driven decisions about UI/UX changes.
---

Conversion Rate Optimization (CRO) is the practice of increasing the percentage of visitors who take a desired action — sign up, purchase, activate, upgrade. It's not guesswork or opinion; it's a scientific process of measuring, hypothesizing, testing, and learning. A 1% improvement in conversion can outperform a 10x increase in traffic.

## The CRO Mindset

```
CRO is not:
  ✗ Making buttons bigger or changing them to green
  ✗ Copying what competitors do
  ✗ Gut-feel redesigns
  ✗ Running tests on everything at once

CRO is:
  ✓ Understanding why users don't convert (research first)
  ✓ Forming specific, falsifiable hypotheses
  ✓ Testing one thing at a time (clean causality)
  ✓ Making decisions from data, not opinions
  ✓ Continuous process, not a one-time project
```

## Phase 1: Define the Funnel

Before optimizing, map what you're optimizing.

```
Macro conversion: the primary goal (purchase, signup, upgrade)
Micro conversions: steps toward the macro goal

Example — SaaS signup funnel:
  Visit landing page
     → Click "Start Free Trial"
     → Fill signup form  
     → Verify email
     → Complete onboarding (key actions)
     → Activate (see value)
     → Convert to paid

For each step, measure:
  Visits:        How many users reached this step?
  Completions:   How many progressed to next step?
  Drop rate:     % who left at this step
  Value:         Revenue or activation attributable to this step

Funnel SQL:
SELECT
  step,
  COUNT(DISTINCT user_id) AS users,
  COUNT(DISTINCT user_id) * 100.0 / FIRST_VALUE(COUNT(DISTINCT user_id)) 
    OVER (ORDER BY step_order) AS pct_of_top
FROM funnel_events
WHERE created_at >= CURRENT_DATE - 30
GROUP BY step, step_order
ORDER BY step_order;
```

## Phase 2: Research Before Testing

Most CRO programs fail because they skip research and jump straight to A/B tests. Research tells you where to look and what to test.

**Quantitative research (what is happening):**
```
Tools: Google Analytics, Mixpanel, Amplitude, PostHog

Key questions:
  □ Where do users drop off in the funnel? (highest drop-off = highest impact)
  □ Which traffic sources convert best/worst? (may need different landing pages)
  □ Which device types have the worst conversion? (mobile vs. desktop parity)
  □ Which geographic markets convert differently?
  □ What is the time-to-convert distribution? (days from first visit to purchase)

Funnel analysis: identify the biggest drop in the funnel — that's your target.
Segment analysis: same page, wildly different conversion by source? Target that.
Cohort analysis: does conversion rate change over time? Sign of product-market fit shift.
```

**Qualitative research (why it is happening):**
```
Heatmaps (Hotjar, Microsoft Clarity):
  → Click maps: where are users clicking? Clicking non-clickable elements?
  → Scroll maps: how far do users scroll? Does value proposition appear above the fold?
  → Move maps: where does the mouse go? (proxy for attention)

Session recordings:
  → Watch real sessions of users who dropped off (filter: visited page, did not convert)
  → Look for: rage clicks, confusion patterns, form abandonment, back-button spamming
  → Most important question: "What made this person give up?"

User surveys (on-page exit surveys):
  → "What almost stopped you from signing up today?" (asked after successful signup)
  → "What's holding you back from upgrading?" (asked to free tier users)
  → Tools: Hotjar surveys, Typeform popups, Intercom
  → Aim for: 50+ qualitative responses before pattern recognition

User testing:
  → Recruit 5-7 users from your target demographic
  → Ask them to complete a key flow while thinking aloud
  → Don't explain anything — observe their confusion
  → 5 users will surface ~85% of usability issues
```

**Jobs-to-be-Done interviews:**
```
Interview recent converters: "Why did you sign up / buy today — what triggered it?"
Interview churned users: "Why did you cancel / not upgrade?"

Interview questions:
  1. "Walk me through the moment you decided to look for a solution like ours."
  2. "What were you hoping this would do for you?"
  3. "Was there a moment you almost didn't sign up? What happened?"
  4. "How do you describe what we do to colleagues?"

The answer to #4 is often better marketing copy than anything your team writes.
```

## Phase 3: Form Hypotheses

A good hypothesis is specific and falsifiable. It connects research findings to expected outcomes.

```
Hypothesis template:
  "Because [research insight], if we [change], then [metric] will [direction] 
   because [mechanism]."

Example:
  "Because session recordings show 40% of users abandon the signup form at 
   the 'Company size' field (it's confusing and feels enterprise-y for indie devs),
   if we remove that field from the signup flow and collect it during onboarding,
   then signup completion rate will increase by 10-15%
   because users face less friction and less concern about being sold to."

Weaker hypotheses (avoid):
  ✗ "If we make the CTA button green, conversions will increase" (no mechanism)
  ✗ "If we redesign the landing page, more people will sign up" (too vague)
  ✗ "If we add more social proof, conversions will increase" (no specific insight)
```

## Phase 4: Prioritization Frameworks

You can't test everything. Use a scoring model.

**PIE Framework:**
```
Score each test candidate 1-10 on:
  P = Potential:   How much improvement is possible? (based on baseline conversion)
  I = Importance:  How much traffic / revenue does this page/step represent?
  E = Ease:        How easy is this to implement and test?

PIE Score = (P + I + E) / 3

Example scoring:
  Item                           | P  | I  | E  | PIE
  -------------------------------|----|----|----|----- 
  Remove company size from signup| 8  | 9  | 7  | 8.0
  Rewrite hero headline          | 7  | 9  | 8  | 8.0
  Add social proof to pricing    | 6  | 8  | 9  | 7.7
  Reduce checkout form fields    | 9  | 7  | 5  | 7.0
  Change CTA button color        | 3  | 8  | 10 | 7.0

Test the highest PIE score first.
```

## Phase 5: A/B Testing Execution

**Test design:**
```python
# Statistical power calculation — run BEFORE the test
# You need enough traffic to detect a meaningful difference reliably

from scipy.stats import norm
import numpy as np

def calculate_sample_size(baseline_rate, min_detectable_effect, 
                          alpha=0.05, power=0.80):
    """
    baseline_rate: current conversion rate (e.g. 0.05 = 5%)
    min_detectable_effect: smallest improvement worth detecting (e.g. 0.20 = 20% relative)
    alpha: false positive rate (0.05 = 5%)
    power: probability of detecting real effect (0.80 = 80%)
    """
    p1 = baseline_rate
    p2 = baseline_rate * (1 + min_detectable_effect)
    
    z_alpha = norm.ppf(1 - alpha / 2)
    z_beta = norm.ppf(power)
    
    pooled = (p1 + p2) / 2
    n = (2 * pooled * (1 - pooled) * (z_alpha + z_beta) ** 2) / (p2 - p1) ** 2
    
    return int(np.ceil(n))

# Example: 5% baseline, want to detect 15% relative improvement
n = calculate_sample_size(0.05, 0.15)
print(f"Need {n:,} users per variant = {n*2:,} total")
# → 3,507 per variant = 7,014 total

# If you have 500 visits/day → test runs for ~14 days
# If you have 50 visits/day → test runs for 140 days (not worth A/B testing)
# Rule of thumb: if test takes > 4 weeks, consider qualitative improvement instead
```

**Common testing mistakes:**
```
❌ Stopping the test early when you see a positive result
   (You'll find false positives on ~5% of peeks due to chance)
   FIX: Pre-commit to a sample size. Do not check results before completion.

❌ Running multiple tests on the same page simultaneously  
   FIX: One test per page element at a time (or use multivariate with care)

❌ Not testing on mobile and desktop separately
   A change that helps desktop may hurt mobile (different contexts)

❌ Ignoring statistical significance
   FIX: Require p < 0.05 before declaring a winner (or use Bayesian testing)

❌ Declaring victory on a 2-day test
   FIX: Run for minimum 1-2 full business cycles (1-2 weeks minimum)
```

## Phase 6: High-Impact Optimization Areas

**Landing page:**
```
Above the fold (visible without scrolling):
  □ Value proposition clear in < 5 seconds?
    Test: Show the page for 5 seconds to an unfamiliar user; ask what it does
  □ Primary CTA visible without scrolling?
  □ Social proof immediately visible? (logos, user count, reviews)

Headline testing (highest impact element):
  - Benefit-focused vs. feature-focused
  - Specific numbers vs. vague ("10x faster" vs. "much faster")
  - Problem-focused vs. solution-focused
  - Audience-specific ("For solo developers" vs. "For teams")

CTA button:
  - Copy: "Start Free Trial" vs. "Get Started" vs. "Try for Free" vs. "Sign Up"
  - Placement: is it visible without scroll on mobile?
  - Surrounding context: friction reducers near CTA ("No credit card required")
```

**Signup/onboarding forms:**
```
Form length:
  □ Remove every non-essential field — each field costs ~5-10% conversion
  □ Email + password is often enough for trial; collect the rest on day 2
  □ Use OAuth (Google/GitHub) — eliminates password friction entirely

Field design:
  □ Inline validation (show errors as user types, not only on submit)
  □ Clear error messages ("Enter a valid email" not "Invalid input")
  □ Smart defaults (pre-fill where possible)
  □ Progress indicator on multi-step forms

Trust signals:
  □ Security badges near payment fields
  □ Privacy statement near email field ("No spam, ever")
  □ Testimonial near signup CTA (reduce regret/risk perception)
```

**Pricing pages:**
```
Friction reducers:
  □ Monthly/annual toggle (with annual savings % clearly shown)
  □ "Most popular" badge on the plan you want people to choose
  □ FAQ section addressing objections below pricing
  □ Risk reversal: "30-day money-back guarantee, no questions asked"

Clarity:
  □ Avoid feature overload in the comparison table — highlight 3-5 key differences
  □ Clear upgrade paths: what do I lose by choosing the lower tier?
  □ Enterprise CTA: "Talk to us" not just empty space for high-ticket customers
```

## Tracking Your CRO Program

```
Monthly CRO dashboard:
  Funnel metric          | Last month | This month | Change
  ---------------------- |------------|------------|-------
  Landing → Signup       | 3.2%       | 3.8%       | +18.8%
  Signup → Activated     | 41%        | 44%        | +7.3%
  Activated → Paid       | 12%        | 13%        | +8.3%
  Overall (Visit → Paid) | 0.16%      | 0.22%      | +37.5%
  
  Tests running:     2
  Tests concluded:   1 (winner: removed company field from signup)
  Tests in backlog:  8
  
Quarterly review questions:
  - Where is the funnel still bleeding? (find the next target)
  - Which research finding generated the most successful tests?
  - What surprised us? (unexpected winners and losers)
  - What's our backlog health? (should have 8-12 queued tests at all times)
```
