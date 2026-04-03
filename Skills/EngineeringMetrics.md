---
name: Engineering Metrics & DORA
trigger: engineering metrics, DORA metrics, engineering productivity, developer metrics, deployment frequency, lead time, change failure rate, MTTR, team health, velocity, cycle time, throughput, code review time, sprint metrics, engineering dashboard, tech health metrics, measure engineering
description: A framework for measuring engineering team health and productivity using evidence-based metrics. Use for building engineering dashboards, tracking DORA metrics, measuring team velocity and quality, communicating engineering value to leadership, and diagnosing where teams are bottlenecked.
---

Engineering metrics are how you make engineering work visible and improvable. The right metrics answer: "Are we getting faster? Are we getting more reliable? Are we building quality in?" The wrong metrics create perverse incentives, erode trust, and optimize for appearances over outcomes.

## The Metrics Hierarchy

```
Outcome metrics (business value):
  Revenue per engineer, customer satisfaction, feature adoption
  ↑ These are too lagging to act on directly; use as north stars

Team health metrics (engineering performance):
  DORA metrics, cycle time, deployment frequency
  ↑ Act on these; they predict outcomes

Process metrics (leading indicators):
  Code review time, PR size, test coverage, flaky test rate
  ↑ Fast feedback; most actionable day-to-day

Input metrics (never use for performance):
  Lines of code, tickets closed, hours worked
  ↑ These measure activity, not value; easily gamed
```

## The DORA Four

The DORA (DevOps Research and Assessment) metrics are the most rigorously validated engineering performance indicators. They measure both speed and stability.

```
Metric                  | Elite        | High        | Medium       | Low
------------------------|--------------|-------------|--------------|------------
Deployment Frequency    | Multiple/day | Weekly      | Monthly      | <Monthly
Lead Time for Changes   | <1 hour      | <1 day      | 1 week-1 mo  | >1 month
Change Failure Rate     | 0-5%         | 0-10%       | 10-15%       | 16-30%
MTTR                    | <1 hour      | <1 day      | 1 day-1 week | >1 week

High performers have HIGH frequency and LOW change failure rate.
These are NOT tradeoffs — fast teams also have fewer incidents.
```

**How to measure DORA:**
```sql
-- Deployment Frequency: count deploys to production
SELECT
  DATE_TRUNC('week', deployed_at) AS week,
  COUNT(*) AS deploys,
  COUNT(DISTINCT service) AS services_deployed
FROM deployments
WHERE environment = 'production'
  AND deployed_at >= NOW() - INTERVAL '90 days'
GROUP BY week
ORDER BY week;

-- Lead Time for Changes: commit to production deploy
SELECT
  d.service,
  AVG(
    EXTRACT(EPOCH FROM (d.deployed_at - c.committed_at)) / 3600
  ) AS avg_lead_time_hours,
  PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY EXTRACT(EPOCH FROM (d.deployed_at - c.committed_at)) / 3600
  ) AS median_lead_time_hours
FROM deployments d
JOIN commits c ON c.sha = d.commit_sha
WHERE d.environment = 'production'
  AND d.deployed_at >= NOW() - INTERVAL '30 days'
GROUP BY d.service
ORDER BY avg_lead_time_hours;

-- Change Failure Rate
SELECT
  DATE_TRUNC('month', deployed_at) AS month,
  COUNT(*) AS total_deploys,
  SUM(CASE WHEN caused_incident THEN 1 ELSE 0 END) AS failed_deploys,
  ROUND(
    100.0 * SUM(CASE WHEN caused_incident THEN 1 ELSE 0 END) / COUNT(*), 1
  ) AS failure_rate_pct
FROM deployments
WHERE environment = 'production'
GROUP BY month
ORDER BY month;
```

## Cycle Time Breakdown

Cycle time (time from work start to production) can be decomposed to find bottlenecks.

```
Full cycle time = 
  [Coding time] + [PR wait time] + [Review time] + [Merge to deploy] + [Deploy time]
  
Example breakdown:
  Coding:         3.2 hours average
  PR open time:   8.6 hours ← BOTTLENECK (waiting for reviewers)
  Review time:    2.1 hours  
  Merge → deploy: 0.5 hours
  Deploy:         12 minutes
  ─────────────────────────
  Total:          14.8 hours

Action: PR wait time is the bottleneck → review SLAs, better reviewer assignment
```

**Cycle time metrics to track:**
```python
metrics = {
  # Lead indicators (fast to measure, fast to act on)
  "pr_open_to_first_review_hours": {
    "target": "< 4 hours",
    "description": "Time from PR open to first reviewer comment/approval",
    "high_value_if": "> 8 hours on average"
  },
  "pr_size_lines": {
    "target": "< 400 lines changed",
    "description": "Average PR size (large PRs = slow reviews = riskier deploys)",
    "high_value_if": "> 800 lines on average"
  },
  "pr_iterations": {
    "target": "< 3 rounds",
    "description": "How many review-fix cycles per PR",
    "high_value_if": "> 5 rounds (design issues caught too late)"
  },
  "ci_duration_minutes": {
    "target": "< 10 minutes",
    "description": "Time from push to CI pass/fail",
    "high_value_if": "> 20 minutes"
  },
  "flaky_test_count": {
    "target": "0",
    "description": "Tests that fail without code changes",
    "high_value_if": "> 5 (erodes CI trust)"
  }
}
```

## Quality Metrics

```python
quality_metrics = {
  # Defect metrics
  "escaped_defects_per_sprint": {
    "measure": "Bugs found by users / QA AFTER merging to main",
    "target": "< 2 per sprint",
    "signal": "High → insufficient testing or review"
  },
  "bug_to_feature_ratio": {
    "measure": "# bug tickets / # feature tickets per quarter",
    "target": "< 0.25 (1 bug per 4 features)",
    "signal": "High → slowing down; quality debt is compounding"
  },
  "regression_rate": {
    "measure": "# incidents caused by code changes / # deploys",
    "target": "< 5%",
    "signal": "= DORA Change Failure Rate"
  },
  
  # Test health
  "test_coverage_pct": {
    "measure": "Line and branch coverage %",
    "target": "> 70% (context-dependent — 80% for critical paths)",
    "signal": "Trend more important than absolute number"
  },
  "test_execution_time_minutes": {
    "measure": "Time to run full test suite",
    "target": "< 5 min locally, < 10 min in CI",
    "signal": "Slow tests → developers skip running them"
  }
}
```

## Team Health Metrics

```
Sustainable pace indicators:
  - After-hours commit rate: % of commits outside working hours
    → Rising trend = warning sign; people are extending to meet commitments
  - Sprint completion rate: % of sprint tickets completed as committed
    → Consistently < 80% → overcommitment, unrealistic estimates, or blockers
  - Carry-over rate: % of tickets carried to next sprint
    → High carry-over → scope creep, underestimation, or context switching

Collaboration health:
  - Knowledge concentration: % of code touched by only one person (bus factor)
    → High concentration → onboarding risk, vacation risk, key-person dependency
  - Review participation: # unique reviewers per PR
    → Low → code review is a formality, not a genuine quality gate
  - New contributor ramp time: days from hire to first merged PR
    → High → onboarding friction, DX problems

Autonomy indicators:
  - % of deploys that required cross-team coordination
    → High → coupling; teams can't ship independently
  - Mean time from decision to deployed feature
    → High → bureaucracy, approval bottlenecks, fear of shipping
```

## Engineering Dashboard Design

**What to show on a team-level engineering dashboard:**
```
Section 1: Delivery Health (DORA metrics)
  - Deployment frequency trend (last 90 days)
  - Lead time distribution (p50 and p90)
  - Change failure rate
  - MTTR

Section 2: Flow Health (cycle time)
  - Work in progress (WIP) count
  - Cycle time breakdown (coding / review / merge-deploy)
  - PR size distribution
  - First review time trend

Section 3: Quality Signals
  - Test coverage trend
  - Flaky test count
  - Bug backlog size and trend
  - Critical/high CVE count (dependency vulnerabilities)

Section 4: Team Sustainability (check-in monthly, not daily)
  - After-hours activity trend
  - Sprint completion rate (last 4 sprints)
  - On-call incident load (pages per on-call shift)
```

## Metrics Anti-Patterns

```
❌ Using metrics to evaluate individual engineers
   Lines of code, tickets closed, PRs opened are all gameable.
   This destroys collaboration (why help review if I'm judged on my own output?)
   
✅ Use metrics to understand TEAM and SYSTEM health, not individuals.

❌ Optimizing for a single metric
   "Increase deployment frequency" → people ship tiny, trivial changes to hit the target
   "Reduce MTTR" → teams make SEV5 problems look like SEV3 to hit the metric
   
✅ Track balancing metrics together: frequency AND failure rate. Speed AND quality.

❌ Reporting metrics without context
   "Deployment frequency dropped 30% this month" 
   (because we had a major launch requiring coordination — that's fine)
   
✅ Always include commentary: what drove the change?

❌ Metric theater for leadership
   Publishing an impressive dashboard while the team is burning out underneath
   
✅ Engineering metrics must lead to action: if you're not changing anything based
   on a metric, you shouldn't be measuring it.
```

## Communicating Engineering Performance to Leadership

```
Monthly engineering performance summary (template):

Delivery: We deployed X times this month (vs. Y last month / Z last quarter).
  Lead time average: N hours (trending up/down/stable).
  [If notable: "The spike in lead time was caused by X; we're addressing it by Y"]

Quality: Change failure rate: X% (target: < 5%). [Notable incidents: brief note]
  Recovery: MTTR when incidents occurred: N hours.

Investment: 
  - X% of engineering time on features, Y% on reliability/debt, Z% on infra.
  - Key quality investments this month: [2-3 bullet points]
  
Risks: [1-3 honest risks — things that could slow us down if unaddressed]
  - [Risk 1 with mitigation plan]

Ask: [What do you need from leadership — headcount, tooling budget, policy change]
```
