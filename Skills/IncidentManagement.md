---
name: Incident Management & On-Call
trigger: incident, outage, on-call, postmortem, runbook, production down, SRE, escalation, PagerDuty, page someone, SEV1, SEV2, on-call rotation, war room, incident response
description: A complete framework for detecting, responding to, resolving, and learning from production incidents. Use for setting up on-call rotations, writing runbooks, managing live incidents, and conducting blameless postmortems.
---

Incident management is the practice of detecting, triaging, resolving, and learning from unplanned disruptions to production systems. The goal is fast recovery, not blame. A mature incident process reduces mean time to resolution (MTTR), prevents recurrence, and builds organizational knowledge.

## Incident Severity Levels

Define before an incident happens. Ambiguity during an incident wastes time.

```
SEV1 — Critical
  - Complete service outage affecting all/most users
  - Data loss or corruption occurring
  - Security breach in progress
  - Revenue-critical path down (checkout, auth, payment)
  Response: Immediate all-hands. Wake people up. Executive notification.

SEV2 — High
  - Major feature broken affecting significant % of users
  - Severe performance degradation (>3x latency spike)
  - Primary on-call + secondary notified immediately
  Response: On-call engineer + team lead. Business hours escalation.

SEV3 — Medium
  - Non-critical feature broken, workaround exists
  - Elevated error rate on non-critical path (<5% users affected)
  Response: On-call handles during business hours. Track in ticket.

SEV4 — Low
  - Cosmetic issues, minor bugs, low-traffic edge cases
  Response: Normal bug ticket. Next sprint.
```

## The Incident Response Loop

```
Detect → Triage → Communicate → Investigate → Mitigate → Resolve → Learn
```

Never skip **Communicate** — stakeholders flying blind make everything worse.

## Phase 1: Detect

Good detection = fast alerting + low noise. Both matter.

```yaml
# Alert design principles
# 1. Alert on symptoms, not causes
# BAD:  alert if CPU > 80%   (cause — might be fine)
# GOOD: alert if error_rate > 1% OR p99_latency > 2s (symptom — users hurt)

# 2. Every alert must be actionable — if you can't do anything about it, 
#    it's not an alert, it's a dashboard metric

# 3. Tiered alerts
- warning: elevated error rate (2%) → Slack notification only
- critical: error rate > 5% → Page on-call

# 4. Alert on golden signals (Google SRE model)
golden_signals:
  - latency:     p50, p95, p99 of request duration
  - traffic:     requests per second
  - errors:      error rate (5xx/total)
  - saturation:  CPU%, memory%, queue depth
```

**Runbook link in every alert:**
```
ALERT: PaymentService error rate > 5%
Current: 8.3% | Threshold: 5% | Duration: 3m
Dashboard: https://grafana.internal/d/payments
Runbook:   https://notion.so/runbooks/payment-errors
Silence:   https://alertmanager.internal/silence
```

## Phase 2: Triage (First 5 Minutes)

The first responder's job is not to fix the problem — it's to understand and size it.

```
□ Acknowledge the alert (stops escalation timer)
□ Check the dashboard: What is broken? How many users affected?
□ Open an incident channel: #incident-YYYY-MM-DD-brief-description
□ Declare severity (err toward higher severity when uncertain)
□ Post initial message to stakeholders
□ Decide: Can I handle alone or do I need to page someone?
```

**Initial stakeholder message template:**
```
🚨 INCIDENT DECLARED — SEV2
Time: 14:32 UTC
Service: Checkout API
Impact: ~15% of checkout attempts failing with 503
Symptoms: Error rate spiked from 0.2% → 12.4% starting 14:28 UTC
IC (Incident Commander): @sarah
Updates: Every 15 minutes or on status change
Status page: https://status.yourapp.com [being updated]
```

## Phase 3: Investigate

Structured investigation beats thrashing. Work the timeline.

```
1. What changed recently?
   - Deployments in last 2 hours (check deploy log)
   - Config changes (feature flags, environment variables)
   - Infra changes (scaling events, cert rotation)
   - Upstream dependency changes

2. Correlate the timeline
   - When did the alert fire?
   - When did metrics first deviate? (may predate alert)
   - What was deployed/changed closest to that inflection point?

3. Localize the blast radius
   - Which services are affected? (check service map / traces)
   - Which regions? (us-east-1 only, or global?)
   - Which user cohort? (all users, or specific plan/feature?)

4. Gather evidence before changing things
   - Pull logs from 5 min before and after incident start
   - Export metrics snapshot
   - Capture stack traces / error messages
```

**Investigation checklist:**
```bash
# Recent deployments
git log --since="2 hours ago" --oneline

# Error distribution in logs (structured logging assumed)
# Check error messages, status codes, affected endpoints

# Database health
# - Slow queries? Lock waits? Replication lag?

# External dependencies
# - Stripe status: https://status.stripe.com
# - AWS status: https://health.aws.amazon.com
# - Check 3rd party SLAs

# Resource saturation
# - Is any service at CPU/memory limit?
# - Queue depths growing?
# - Connection pool exhausted?
```

## Phase 4: Mitigate vs. Fix

**Mitigate first, fix later.** Your job during an incident is to stop the bleeding — not to write the right solution.

```
Mitigation options (fast):
  - Rollback the last deployment
  - Toggle a feature flag off
  - Increase replica count / scale up
  - Redirect traffic to healthy region
  - Disable a non-critical integration
  - Increase timeouts to prevent cascade failures
  - Add rate limiting to protect overwhelmed service
  - Restart pods / clear stuck workers

Fix options (slower, post-mitigation):
  - Root cause code fix
  - Database migration
  - Schema changes
  - External vendor engagement
```

**The rollback decision:**
```
Rollback if:
  ✓ A deployment preceded the incident by < 2 hours
  ✓ Rollback is fast (< 5 min) and low-risk
  ✓ The blast radius is large and growing

Don't rollback if:
  ✗ The deployment is unrelated to the symptoms
  ✗ Rollback itself carries significant risk (db migration)
  ✗ You've already identified the actual fix and it's faster
```

## Phase 5: Communication During Incident

**Update cadence:** Every 15 minutes for SEV1/SEV2. No update = stakeholders assume the worst.

```
Update template:
[14:47 UTC UPDATE]
Status: Investigating | Mitigating | Monitoring | Resolved
Impact: ~20% of users unable to complete checkout
Progress: Identified issue as connection pool exhaustion in payment-service.
          Deploying fix to increase pool size and add connection recycling.
ETA: Resolution expected in ~20 minutes.
Next update: 15:00 UTC

[15:03 UTC UPDATE]  
Status: Resolved ✅
Fix deployed at 14:58 UTC. Error rate returned to baseline (0.1%) at 15:01 UTC.
Total duration: 33 minutes | Users affected: ~4,200 checkout attempts
A postmortem will be scheduled within 48 hours.
```

## Phase 6: Resolution Checklist

```
□ Confirm metrics have returned to normal (not just "looks better")
□ Confirm no secondary issues introduced by the fix
□ Update status page to "All Systems Operational"
□ Send resolution message to all stakeholder channels
□ Close the incident channel with a summary
□ Schedule postmortem (within 48h for SEV1, 5 days for SEV2)
□ Create follow-up tickets for permanent fix if mitigation was a patch
□ Handoff to next on-call if needed
```

## Phase 7: Blameless Postmortem

The purpose of a postmortem is to learn, not to assign fault. Blame prevents honesty; honesty prevents recurrence.

```markdown
# Postmortem: [Service] [Brief Description] — [Date]

## Impact
- Duration: X hours Y minutes
- Users affected: ~N users / N% of traffic
- Revenue impact: $X estimated
- Severity: SEV2

## Timeline
| Time (UTC) | Event |
|------------|-------|
| 14:12      | Deployment of v2.4.1 to production |
| 14:28      | Error rate began rising (not yet at alert threshold) |
| 14:32      | Alert fired, on-call paged |
| 14:35      | On-call acknowledged, incident channel opened |
| 14:47      | Root cause identified: connection pool exhaustion |
| 14:58      | Fix deployed |
| 15:01      | Error rate returned to baseline |

## Root Cause
[Technical explanation of what actually failed and why]

## Contributing Factors
- The deployment increased connection concurrency without adjusting pool size
- No load test was run against the new connection pattern
- The alert threshold was set too high (5%) — degradation was occurring at 2%

## What Went Well
- On-call response was fast (alert → acknowledged in 3 min)
- Team communication was clear and timely
- Rollback option was ready and would have worked if needed

## What Went Poorly
- Root cause took 15 min to find; better query-level tracing would have cut this to 5
- Status page update was delayed by 10 minutes

## Action Items
| Item | Owner | Due Date | Priority |
|------|-------|----------|----------|
| Add connection pool metrics to primary dashboard | @engineer | 5/10 | P1 |
| Lower error rate alert threshold to 2% | @sre | 5/7 | P1 |
| Add connection pool load test to deployment checklist | @tech-lead | 5/14 | P2 |
| Document connection pool sizing guide in runbook | @engineer | 5/14 | P2 |
```

## Runbook Template

A runbook is a pre-written decision tree for common incidents. Write them when things are calm.

```markdown
# Runbook: Payment Service High Error Rate

## When to use this runbook
Alert: "payment-service error rate > 5%" has fired

## Diagnosis steps

### Step 1: Check the error type (2 min)
Look at error breakdown in Grafana panel "Payment Error Types"
- If 503 from Stripe → go to Step 2A (External dependency)
- If 500 with DB connection error → go to Step 2B (Database)  
- If 504 timeout → go to Step 2C (Latency)
- If 400/422 → likely bad data, check deploy log, go to Step 3

### Step 2A: Stripe dependency failure
1. Check https://status.stripe.com
2. If Stripe is down: set feature flag `payment_stripe_degraded=true`
   This switches to degraded mode (queue payments for retry)
3. Notify #payments-team and @payment-lead
4. Monitor queue depth — should not exceed 10k entries

### Step 2B: Database connection exhaustion  
1. Check connection pool dashboard: grafana.internal/d/db-pool
2. If connections at max: kubectl rollout restart deployment/payment-service
3. If restarts don't help: scale up replicas by 2x in ArgoCD
4. Page @db-oncall if issue persists > 10 min

## Escalation
- 10 min no progress: page @payment-lead
- 20 min: escalate to SEV1, notify @engineering-director
```

## On-Call Rotation Health

```
Signs of a healthy on-call rotation:
  ✓ < 2 pages per shift on average
  ✓ < 30 min average time to resolve
  ✓ Runbooks exist for > 80% of common alerts
  ✓ Every actionable alert has a linked ticket
  ✓ Engineers don't dread being on-call

Warning signs:
  ✗ Alert fatigue (engineers start ignoring pages)
  ✗ Same alert fires repeatedly with no follow-up
  ✗ No runbooks — tribal knowledge only
  ✗ Burnout, sleep disruption complaints
  ✗ "We'll fix it after the launch" (perpetual deferral)

Fix alert fatigue immediately: a paged-on engineer who doesn't trust their alerts 
is more dangerous than no alert at all.
```
