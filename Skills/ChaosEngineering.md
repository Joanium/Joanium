---
name: Chaos Engineering
trigger: chaos engineering, fault injection, resilience testing, chaos monkey, game day, failure testing, Netflix chaos, simian army, resilience, blast radius, failure modes, disaster recovery test, chaos experiment
description: A systematic approach to improving system resilience by deliberately injecting failures in controlled conditions. Use for designing chaos experiments, running game days, validating recovery procedures, and building confidence in system reliability before incidents happen.
---

Chaos engineering is the discipline of experimenting on a system to build confidence in its ability to withstand turbulent conditions in production. The premise: unknown weaknesses in complex systems are unavoidable. The question is whether you discover them in a controlled experiment or during a real outage.

> "The best time to practice disaster recovery is before you have a disaster." — Werner Vogels

## Core Principles

```
1. Define steady state first
   You can't detect a deviation without knowing what normal looks like.
   
2. Hypothesize the system will maintain steady state
   Chaos experiments test whether your hypothesis is correct.
   
3. Vary real-world events
   CPU spikes, network partitions, dependency failures, traffic surges.
   
4. Run in production (eventually)
   Staging doesn't have production traffic patterns, data volumes, or dependencies.
   Start in staging; graduate to production canary.
   
5. Minimize blast radius
   Always scope carefully. Start with the smallest possible failure domain.
```

## The Chaos Experiment Framework

```
┌─────────────────────────────────────────────────────────┐
│  1. Define Steady State                                  │
│     What does "working normally" look like, in numbers?  │
├─────────────────────────────────────────────────────────┤
│  2. Form Hypothesis                                      │
│     "If X fails, the system will Y (degrade gracefully)" │
├─────────────────────────────────────────────────────────┤
│  3. Design Experiment                                    │
│     What failure to inject? Scope? Duration? Rollback?   │
├─────────────────────────────────────────────────────────┤
│  4. Run Experiment                                       │
│     Inject fault, observe metrics, halt if unexpected    │
├─────────────────────────────────────────────────────────┤
│  5. Analyze Results                                      │
│     Did steady state hold? What happened? Why?           │
├─────────────────────────────────────────────────────────┤
│  6. Learn & Fix                                          │
│     File issues, fix weaknesses, automate the experiment │
└─────────────────────────────────────────────────────────┘
```

## Phase 1: Define Steady State

Before any experiment, instrument what "healthy" means for your system.

```python
# Steady state: the measurable, observable state of a system operating normally
# These become your abort conditions during experiments

steady_state = {
    # Business metrics (most important — what users care about)
    "checkout_success_rate":    {"min": 0.98,  "unit": "ratio"},
    "api_error_rate":           {"max": 0.01,  "unit": "ratio"},
    "api_p99_latency_ms":       {"max": 500,   "unit": "ms"},
    
    # Infrastructure metrics
    "active_pod_count":         {"min": 3,     "unit": "count"},
    "queue_depth":              {"max": 1000,  "unit": "messages"},
    "db_connection_pool_usage": {"max": 0.80,  "unit": "ratio"},
    
    # Synthetic checks (canary transactions)
    "synthetic_login_success":  {"min": 1.0,   "unit": "ratio"},
}

# Automate steady state checking
def check_steady_state(metrics: dict) -> tuple[bool, list[str]]:
    violations = []
    for key, threshold in steady_state.items():
        value = metrics.get(key)
        if value is None:
            violations.append(f"Missing metric: {key}")
            continue
        if "min" in threshold and value < threshold["min"]:
            violations.append(f"{key}: {value} < min {threshold['min']}")
        if "max" in threshold and value > threshold["max"]:
            violations.append(f"{key}: {value} > max {threshold['max']}")
    return len(violations) == 0, violations
```

## Phase 2: Failure Mode Catalog

Understand what can fail before you inject failures.

**Infrastructure failures:**
```
Category: Compute
  - Pod/container crash (OOMKilled, crash loop)
  - CPU throttling / saturation
  - Node failure (EC2 termination, hardware fault)
  - Deployment rollout (rolling update kills some pods)

Category: Network
  - Latency injection (network packets delayed 100-500ms)
  - Packet loss (1-5% of requests dropped)
  - Network partition (service A cannot reach service B)
  - DNS resolution failure
  - TLS certificate expiry

Category: Dependencies
  - Database unreachable (connection refused)
  - Database slow (query latency 10x normal)
  - Cache miss storm (Redis restart → all cache cold)
  - External API down (Stripe, Twilio, SendGrid)
  - Message queue unavailable

Category: Data
  - Corrupt/malformed payload in queue
  - Unexpected null fields in request
  - Database disk full
  - Schema mismatch (consumer of old schema receives new)
```

## Phase 3: Design the Experiment

**Experiment template:**
```markdown
## Chaos Experiment: [Name]

### Hypothesis
If [specific failure] occurs, [specific system component] will [specific degraded behavior]
and steady state will be maintained for [metric] above [threshold].

Example:
"If the Redis cache cluster becomes unavailable, the checkout service will 
fall back to database reads, adding ≤200ms latency, and checkout success 
rate will remain above 95%."

### Steady State Baseline
Measured 1 hour before experiment:
  - checkout_success_rate: 99.2%
  - api_p99_latency_ms: 180ms
  - error_rate: 0.3%

### Failure to Inject
Target: Redis ElastiCache cluster (staging environment)
Method: AWS FIS: kill all Redis nodes simultaneously
Duration: 10 minutes

### Blast Radius
Environment: Staging only
Services affected: Checkout, Cart, Session services (all read from Redis)
Users affected: None (staging)
Estimated revenue impact: $0 (staging)

### Rollback Plan
Immediate: Restore Redis cluster from snapshot (3 min)
If code issue found: Roll back app deployment (5 min)
Abort condition: Checkout success rate drops below 85%

### Observability
Dashboards to watch: grafana.internal/d/checkout, grafana.internal/d/redis
Alerts enabled: Yes (silenced for expected failures, active for unexpected)
Who's watching: @platform-team in #chaos-experiment-YYYY-MM-DD

### Expected Result
System should fall back to DB reads within 1-2 seconds of Redis failure.
Expect latency increase but no failures. Checkout success > 95%.
```

## Phase 4: Tooling

**AWS Fault Injection Simulator (FIS):**
```json
{
  "description": "Kill 50% of checkout service pods",
  "actions": {
    "StopEKSPods": {
      "actionId": "aws:eks:terminate-nodegroup-instances",
      "parameters": {
        "instanceTerminationPercentage": "50"
      },
      "targets": {
        "Nodegroups": "checkoutNodegroup"
      }
    }
  },
  "targets": {
    "checkoutNodegroup": {
      "resourceType": "aws:eks:nodegroup",
      "resourceTags": { "Service": "checkout" },
      "selectionMode": "PERCENT(50)"
    }
  },
  "stopConditions": [{
    "source": "aws:cloudwatch:alarm",
    "value": "arn:aws:cloudwatch:...checkout-hard-failure-alarm"
  }]
}
```

**Chaos Toolkit (open source, language-agnostic):**
```json
{
  "title": "Verify checkout survives cache failure",
  "description": "Redis failure should not cause checkout errors",
  "steady-state-hypothesis": {
    "title": "Checkout operates normally",
    "probes": [
      {
        "name": "checkout-success-rate",
        "type": "probe",
        "provider": {
          "type": "http",
          "url": "http://metrics.internal/api/v1/query",
          "arguments": { "query": "checkout_success_rate > 0.95" }
        },
        "tolerance": true
      }
    ]
  },
  "method": [
    {
      "name": "kill-redis-pods",
      "type": "action",
      "provider": {
        "type": "python",
        "module": "chaosk8s.pod.actions",
        "func": "kill_microservice",
        "arguments": { "name": "redis", "ns": "staging" }
      },
      "pauses": { "after": 60 }
    }
  ],
  "rollbacks": [
    {
      "name": "restart-redis",
      "type": "action",
      "provider": {
        "type": "python",
        "module": "chaosk8s.deployment.actions",
        "func": "rollout_deployment",
        "arguments": { "name": "redis", "ns": "staging" }
      }
    }
  ]
}
```

**Network fault injection (tc / toxiproxy):**
```bash
# Inject 200ms latency on a specific service (Linux tc)
tc qdisc add dev eth0 root netem delay 200ms 50ms distribution normal

# Add 5% packet loss
tc qdisc change dev eth0 root netem loss 5%

# Remove after experiment
tc qdisc del dev eth0 root

# Toxiproxy — proxy-based fault injection (better for controlled testing)
# Adds named "toxics" to named proxies for specific upstream connections
toxiproxy-cli toxic add -t latency -a latency=300 -a jitter=50 postgres-proxy
toxiproxy-cli toxic remove --toxicName latency postgres-proxy
```

## Phase 5: Game Days

A game day is a structured chaos experiment event with multiple teams participating.

```
Game Day Planning Template:

1. Pre-game day (2 weeks before)
   □ Define scenarios (2-4 failure scenarios)
   □ Identify participants (platform, on-call, product manager)
   □ Ensure runbooks exist for each scenario
   □ Configure observability (dashboards, alerts ready)
   □ Set up communication channel (#gameday-YYYY-MM-DD)

2. Game day execution
   □ Morning: confirm steady state, ensure no ongoing incidents
   □ Brief all participants: objectives, timeline, abort criteria
   □ Run scenario 1: inject failure → observe → record findings
   □ 30 min break: discuss what we saw
   □ Run scenario 2
   □ Debrief: what failed to handle the fault well? What worked?

3. Post-game day (within 1 week)
   □ Write findings document
   □ File tickets for each discovered weakness
   □ Prioritize by likelihood × impact
   □ Schedule next game day
```

## Chaos Maturity Model

```
Level 1: Manual experiments (where to start)
  - Ad-hoc failure injection on staging
  - Human observers watching dashboards
  - Manual rollback
  
Level 2: Semi-automated
  - Tooling for fault injection (FIS, Chaos Toolkit)
  - Automated steady-state checks (abort if threshold crossed)
  - Quarterly game days
  
Level 3: Automated and continuous
  - Chaos experiments run in CI/CD pipeline on every deployment
  - Experiments run automatically against production canary
  - Chaos coverage tracked like test coverage
  
Level 4: Full production chaos (Netflix model)
  - Chaos Monkey randomly terminates production instances daily
  - Teams build services expecting random failure
  - High operational maturity required before this level
  
Most teams should target Level 2-3. Level 4 requires years of investment.
```

## Safety Rules

```
Before every experiment:
  □ Is there an active incident? → Stop; run experiment later
  □ Is this business-critical time (peak traffic, end-of-month close)? → Reschedule
  □ Do you have a tested rollback procedure? → Required
  □ Is monitoring healthy and dashboards populated? → Required
  □ Is someone watching dashboards during the experiment? → Required
  □ Has the experiment scope been reviewed by the on-call engineer? → Required

Abort immediately if:
  → Real user impact beyond expected parameters
  → System does not recover after fault removal
  → Cascading failure spreading beyond blast radius
  → Any member of experiment team says "abort"

The courage to abort is more important than completing the experiment.
```
