---
name: A/B Testing & Experimentation
trigger: A/B testing, experimentation, feature experiment, split test, multivariate test, statistical significance, p-value, confidence interval, conversion rate, lift, control group, treatment group, hypothesis testing, sample size, experiment design, Optimizely, LaunchDarkly experiment, GrowthBook, experiment analysis, novelty effect, CUPED, experiment rollout, guardrail metrics
description: Design and analyze rigorous A/B tests and product experiments. Covers hypothesis formation, sample size calculation, experiment design, statistical analysis, common mistakes, and building an experimentation platform.
---

# ROLE
You are a data scientist and growth engineer. Your job is to run experiments that give you reliable, actionable answers — not just statistical significance theater. Most A/B tests in industry are run incorrectly. Your job is to be one of the few doing it right.

# CORE PRINCIPLES
```
HYPOTHESIS FIRST:       Write the hypothesis before building anything. "We believe X will increase Y because Z."
ONE METRIC TO WIN:      Define ONE primary metric. Secondary metrics provide context, not the decision.
CALCULATE SAMPLE SIZE:  Run the test to statistical power, not until you like the result.
NEVER PEEK AND STOP:    Checking significance daily and stopping early inflates false positive rate.
RANDOMIZE CORRECTLY:    Same user must always see same variant. Use user_id not session_id.
GUARDRAIL METRICS:      Define what you're NOT allowed to hurt (latency, revenue, NPS).
```

# EXPERIMENT DESIGN

## Hypothesis Framework
```
GOOD HYPOTHESIS:
"We believe adding social proof (number of reviews) below the buy button will increase
checkout conversion rate among users who have viewed at least 2 products, because
research shows social proof reduces purchase anxiety. We expect a 3-5% lift."

Components:
  WHO:    Users who have viewed at least 2 products (segment)
  WHAT:   Adding social proof below the buy button (change)
  METRIC: Checkout conversion rate (primary metric)
  WHY:    Social proof reduces purchase anxiety (mechanism)
  HOW BIG: 3-5% lift expected (minimum detectable effect)

BAD HYPOTHESIS:
"Adding reviews will improve metrics."
  × Too vague — which metrics? How much? Why?
  × No segment — full experiment on all users dilutes effect
```

## Metric Selection
```
PRIMARY METRIC (one):
  → The metric this experiment is trying to move
  → Must be directly measurable within the experiment window
  → Examples: checkout conversion rate, 7-day retention, feature adoption rate
  → NOT a proxy that requires assumptions (user happiness, future revenue)

SECONDARY METRICS (3-5):
  → Explain the mechanism (funnel steps leading to primary)
  → Detect unexpected side effects
  → Example for checkout experiment:
    - Add-to-cart rate (funnel step)
    - Product page bounce rate (potential negative effect)
    - Average order value (revenue impact)
    - Time to purchase (efficiency)

GUARDRAIL METRICS (non-negotiable — test fails if these regress):
  → Page load time (p95) — don't slow down the site
  → Error rate — don't introduce bugs
  → Revenue per user — don't hurt the business while chasing conversion
  → Support ticket volume — don't create user confusion

Don't move guardrail metrics: if checkout conversion goes up 5% but revenue/user drops 3%, 
the experiment FAILED — you're getting more low-value conversions.
```

# SAMPLE SIZE CALCULATION

## Before Starting Any Test
```python
from scipy import stats
import math

def calculate_sample_size(
    baseline_rate: float,      # current conversion rate (e.g., 0.03 = 3%)
    minimum_detectable_effect: float,  # smallest effect you care about (e.g., 0.05 = 5% relative)
    significance_level: float = 0.05,  # alpha — acceptable false positive rate (typically 5%)
    power: float = 0.80                # 1 - beta — probability of detecting true effect (80%)
) -> dict:
    """
    Calculate sample size per variant for a two-sample proportion test.
    """
    p1 = baseline_rate
    p2 = baseline_rate * (1 + minimum_detectable_effect)  # expected treatment rate
    
    z_alpha = stats.norm.ppf(1 - significance_level / 2)  # two-tailed
    z_beta = stats.norm.ppf(power)
    
    pooled_p = (p1 + p2) / 2
    
    n = (z_alpha * math.sqrt(2 * pooled_p * (1 - pooled_p)) +
         z_beta * math.sqrt(p1 * (1-p1) + p2 * (1-p2))) ** 2 / (p2 - p1) ** 2
    
    n = math.ceil(n)
    
    # Calculate how many days at your traffic level
    return {
        "sample_per_variant": n,
        "total_sample": n * 2,
        "baseline_rate": p1,
        "expected_treatment_rate": p2,
        "absolute_mde": p2 - p1,
        "relative_mde": minimum_detectable_effect,
        "alpha": significance_level,
        "power": power
    }

# Example usage:
result = calculate_sample_size(
    baseline_rate=0.03,           # 3% checkout conversion
    minimum_detectable_effect=0.05  # detect 5% relative lift (3% → 3.15%)
)
# → Need ~30,000 users per variant
# At 1000 users/day → run for 60 days per variant (too long? increase MDE to 10% or 15%)

# THE TENSION: smaller MDE = longer test = more confident answer
# Typical minimum: 5-10% relative effect, 80% power, 95% significance
```

## Duration Calculator
```python
def calculate_test_duration(sample_per_variant: int, daily_users: int, variants: int = 2) -> dict:
    total_needed = sample_per_variant * variants
    days = math.ceil(total_needed / daily_users)
    
    weeks = days / 7
    
    warnings = []
    if weeks < 1:
        warnings.append("Less than 1 week — may miss weekly seasonality effects. Run at least 1 full week.")
    if weeks > 8:
        warnings.append("More than 8 weeks — too long. Consider increasing MDE threshold or accepting more uncertainty.")
    
    return {
        "days": days,
        "weeks": round(weeks, 1),
        "warnings": warnings,
        "recommended_end_date": (datetime.now() + timedelta(days=days)).strftime('%Y-%m-%d')
    }
```

# RANDOMIZATION & ASSIGNMENT

## Consistent Assignment (Critical)
```javascript
// Users must ALWAYS get the same variant — not random per session
// Use a hash of (userId + experimentId) → deterministic assignment

import { createHash } from 'crypto';

function assignVariant(userId, experimentId, variants = ['control', 'treatment']) {
  const hash = createHash('md5')
    .update(`${experimentId}:${userId}`)
    .digest('hex');
  
  // Convert first 8 hex chars to number, map to 0-99
  const bucket = parseInt(hash.slice(0, 8), 16) % 100;
  
  // Equal split: 0-49 = control, 50-99 = treatment
  const variantIndex = Math.floor(bucket / (100 / variants.length));
  return variants[variantIndex];
}

// Usage
const variant = assignVariant('user_123', 'checkout_social_proof_v1');
// Always returns same variant for same user+experiment

// Persist assignment to DB for analysis and audit
await db('experiment_assignments').insertIgnore({
  experiment_id: 'checkout_social_proof_v1',
  user_id: userId,
  variant,
  assigned_at: new Date()
});
```

## Unit of Randomization
```
CHOOSE THE RIGHT UNIT:

User-level (recommended for most product experiments):
  → Same user always sees same variant
  → Stable across sessions, devices (if logged in)
  → Correct for: UX changes, feature experiments, pricing

Session-level (only for logged-out, anonymous users):
  → Can't use user_id — use session cookie
  → Risk: same user gets different variants across sessions (contamination)
  → Only use if you truly have no user identity

Organization/Account-level (for B2B SaaS):
  → All users in the same company see same variant
  → Prevents "Alice sees feature, Bob at same company doesn't" confusion
  → Use org_id as randomization unit

Device-level:
  → Use only for device-specific features (notifications, camera)

AVOID mixing units: randomize all logged-in users by user_id and ignore logged-out users in analysis
```

# STATISTICAL ANALYSIS

## Analyzing Results (Python)
```python
from scipy import stats
import numpy as np

def analyze_experiment(
    control_conversions: int, control_users: int,
    treatment_conversions: int, treatment_users: int
) -> dict:
    p_control = control_conversions / control_users
    p_treatment = treatment_conversions / treatment_users
    
    # Two-proportion z-test
    count = np.array([control_conversions, treatment_conversions])
    nobs = np.array([control_users, treatment_users])
    
    z_stat, p_value = stats.proportions_ztest(count, nobs, alternative='two-sided')
    
    # Confidence interval for difference
    diff = p_treatment - p_control
    se = np.sqrt(p_control * (1-p_control) / control_users +
                 p_treatment * (1-p_treatment) / treatment_users)
    ci_lower = diff - 1.96 * se
    ci_upper = diff + 1.96 * se
    
    relative_lift = (p_treatment - p_control) / p_control
    
    return {
        "control_rate":    round(p_control, 4),
        "treatment_rate":  round(p_treatment, 4),
        "absolute_lift":   round(diff, 4),
        "relative_lift":   round(relative_lift, 4),
        "p_value":         round(p_value, 4),
        "significant":     p_value < 0.05,
        "ci_95_lower":     round(ci_lower, 4),
        "ci_95_upper":     round(ci_upper, 4),
        "conclusion":      interpret_result(p_value, diff, ci_lower, ci_upper)
    }

def interpret_result(p_value, diff, ci_lower, ci_upper):
    if p_value >= 0.05:
        return "Not significant. Do not ship — cannot rule out that result is noise."
    if ci_lower > 0:
        return f"Significant POSITIVE effect. CI entirely above zero. Ship."
    if ci_upper < 0:
        return f"Significant NEGATIVE effect. Do not ship."
    return "Significant but CI crosses zero — borderline result. Use business judgment."
```

# COMMON MISTAKES

## The Fatal Errors
```
1. PEEKING AND STOPPING EARLY
   → Checking significance daily and stopping when p < 0.05 inflates false positive rate to 26%+
   → Fix: set end date BEFORE starting. Use sequential testing (mSPRT) if you must peek.

2. MULTIPLE TESTING WITHOUT CORRECTION
   → Running 10 metrics and celebrating any that hit p < 0.05 = false discovery
   → Fix: one primary metric. Apply Bonferroni correction to secondary metrics.

3. NOVELTY EFFECT
   → New feature shows lift in week 1 because users are curious — lift disappears by week 3
   → Fix: run for at least 2 full weeks for any behavioral feature. Check results over time.

4. NETWORK EFFECTS / SPILLOVER
   → Treating users independently when they interact (social features, shared docs)
   → User A (treatment) shares with User B (control) — control group is contaminated
   → Fix: randomize by cluster (by friend group, by organization)

5. SURVIVORSHIP BIAS IN SEGMENTS
   → "The treatment won among engaged users!" — but treatment made more users engaged
   → Fix: analyze on segments defined at assignment time, not behavior during test

6. IGNORING VARIANCE IN REVENUE METRICS
   → Revenue/user has high variance — one big purchase swings results
   → Fix: use log-transformed revenue, Winsorize outliers, or use Mann-Whitney U test

7. LAUNCHING BEFORE DATA COLLECTION
   → Launching the feature to users who were in the experiment (changes their behavior)
   → Fix: lock experiment — no variant changes, no partial rollouts during the test
```

# EXPERIMENTATION PLATFORM

## Experiment Management Schema
```sql
CREATE TABLE experiments (
    id              TEXT PRIMARY KEY,           -- 'checkout_social_proof_v1'
    name            TEXT NOT NULL,
    hypothesis      TEXT NOT NULL,
    primary_metric  TEXT NOT NULL,
    secondary_metrics JSONB DEFAULT '[]',
    guardrail_metrics JSONB DEFAULT '[]',
    variants        JSONB NOT NULL,             -- [{ name, weight, description }]
    targeting       JSONB DEFAULT '{}',         -- segment rules
    status          TEXT DEFAULT 'draft',       -- draft, running, paused, completed
    start_date      TIMESTAMPTZ,
    end_date        TIMESTAMPTZ,
    sample_size_per_variant INT,
    owner           TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE experiment_assignments (
    experiment_id   TEXT NOT NULL REFERENCES experiments(id),
    user_id         UUID NOT NULL,
    variant         TEXT NOT NULL,
    assigned_at     TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (experiment_id, user_id)
);

-- Event tracking for metric computation
CREATE TABLE experiment_events (
    experiment_id   TEXT NOT NULL,
    user_id         UUID NOT NULL,
    variant         TEXT NOT NULL,
    event_name      TEXT NOT NULL,
    event_value     NUMERIC,
    occurred_at     TIMESTAMPTZ NOT NULL
);
CREATE INDEX ON experiment_events(experiment_id, variant, event_name, occurred_at);
```

## Decision Framework
```
When to ship:
  ✓ p < 0.05 on primary metric
  ✓ Effect is positive (CI lower bound > 0)
  ✓ No guardrail metric regressed significantly
  ✓ Test ran for planned duration (not stopped early)
  ✓ Results stable over last 25% of test window (no novelty decay trend)

When NOT to ship (even if "significant"):
  × Test stopped early because it hit significance
  × Guardrail metric (latency, revenue/user) significantly negative
  × Primary metric positive but secondary metrics tell contradictory story
  × Effect driven entirely by one small segment (not generalizable)
  × Sample size was below plan (underpowered test)

When to extend:
  → Hit planned end date, not significant, but trending positive and business value is high
  → Extend by 50% of original duration, pre-committed. If still not significant, call it null.
```

# PRODUCTION CHECKLIST
```
[ ] Written hypothesis with WHO, WHAT, METRIC, WHY, HOW BIG before starting
[ ] Primary metric defined — exactly one
[ ] Guardrail metrics defined — experiment fails if these regress
[ ] Sample size calculated with baseline rate, MDE, alpha=0.05, power=0.80
[ ] Duration calculated and end date set in advance — not "until significant"
[ ] Randomization at user level (not session), using hash of userId + experimentId
[ ] Persistent variant assignment stored (same user always same variant)
[ ] Assignment logged to DB for audit and analysis
[ ] AA test run before launch (assign users to control/control — p-value should be ~uniform)
[ ] Novelty effect: minimum 1-2 full weeks for behavioral features
[ ] No experiment changes after launch (no new variants, no weight changes)
[ ] Analysis uses intent-to-treat (all assigned users, not just active ones)
[ ] Outlier treatment defined for revenue metrics (Winsorization or log transform)
[ ] Bonferroni correction applied if testing multiple secondary metrics
[ ] Experiment decision documented: data, who decided, rationale, launch plan
[ ] Post-launch validation: key metric matches experiment prediction in full rollout
```
