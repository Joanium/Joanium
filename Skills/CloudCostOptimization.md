---
name: Cloud Cost Optimization
trigger: cloud cost, AWS bill, GCP cost, Azure spend, FinOps, cost reduction, cloud waste, rightsizing, reserved instances, savings plans, cloud spend, EC2 costs, S3 costs, expensive cloud, cloud budget
description: A systematic framework for auditing, reducing, and governing cloud infrastructure costs without sacrificing reliability or performance. Use for cost audits, rightsizing, commitment strategies, waste elimination, and building a FinOps culture.
---

Cloud cost optimization (FinOps) is the practice of maximizing business value from cloud spend. The goal isn't to spend the least — it's to spend efficiently. Cutting the wrong thing kills reliability. Not cutting anything kills the company. The discipline is knowing the difference.

## The Cost Optimization Flywheel

```
Visibility → Accountability → Optimization → Governance → (repeat)

You cannot optimize what you cannot see.
You cannot see what you have not tagged.
Start with tagging, not cutting.
```

## Phase 1: Establish Visibility

**Tagging strategy (do this first):**
```hcl
# Every resource must have these tags — enforce via policy
locals {
  required_tags = {
    Environment = var.environment       # prod, staging, dev
    Team        = var.team_name         # payments, platform, data
    Service     = var.service_name      # checkout-api, user-service
    CostCenter  = var.cost_center       # finance tracking code
    Owner       = var.owner_email       # who to alert on cost spike
  }
}

# AWS: Use AWS Config rule to flag untagged resources
# Terraform: Use terraform-compliance or tfsec to enforce tags in CI
# GCP: Use Organization Policy to require labels on all resources
```

**Cost allocation setup:**
```
AWS Cost Explorer → Enable by service, region, tag
  - Create cost allocation tags for Team and Service
  - Set up Cost Anomaly Detection (alerts on unexpected spikes)
  - Enable AWS Cost and Usage Report (CUR) for detailed analysis

Key dashboards to build:
  1. Monthly spend by team (accountability)
  2. Monthly spend by service (optimization target)
  3. Spend vs. budget variance (governance)
  4. Week-over-week cost trend (anomaly detection)
  5. Reserved vs. On-demand ratio (commitment opportunity)
```

## Phase 2: Find the Waste

The fastest wins come from eliminating resources nobody is using.

**Common waste patterns:**
```bash
# AWS — find idle/orphaned resources

# 1. Unattached EBS volumes (paying for storage, not attached to any EC2)
aws ec2 describe-volumes \
  --filters Name=status,Values=available \
  --query 'Volumes[*].{ID:VolumeId,Size:Size,Cost:Size}' \
  --output table

# 2. Unattached Elastic IPs ($0.005/hr per idle EIP)
aws ec2 describe-addresses \
  --query 'Addresses[?!InstanceId].[PublicIp,AllocationId]' \
  --output table

# 3. Old EBS snapshots (can accumulate years of storage cost)
aws ec2 describe-snapshots --owner-ids self \
  --query 'Snapshots[?StartTime<=`2023-01-01`].[SnapshotId,VolumeSize,StartTime]'

# 4. Load balancers with no healthy targets
aws elbv2 describe-load-balancers --query 'LoadBalancers[*].LoadBalancerArn' | \
  xargs -I {} aws elbv2 describe-target-health --target-group-arn {}

# 5. Forgotten RDS instances (dev databases running in prod account)
aws rds describe-db-instances \
  --query 'DBInstances[*].{ID:DBInstanceIdentifier,Class:DBInstanceClass,Status:DBInstanceStatus}'
```

**The 10 most common waste categories:**
```
1. Oversized EC2 instances (bought m5.4xlarge, need m5.large)
   → CPU < 10% on average = overpowered
   
2. Dev/staging running 24/7 (only needed 8 hours/day, 5 days/week)
   → Auto-shutdown schedules save 65% on dev infra
   
3. Uncompressed / unbucketed S3 storage
   → Enable Intelligent-Tiering, archive cold objects to Glacier
   
4. Over-provisioned RDS (db.r5.4xlarge when db.t3.large would work)
   → Monitor CPU, memory, connections — not "we might need it"
   
5. NAT Gateway data processing costs
   → Move traffic within same AZ; use VPC endpoints for AWS services
   
6. CloudWatch logs retention (storing 5 years of debug logs)
   → Set 30-day retention for debug, 90-day for warn, 1yr for audit
   
7. On-demand pricing for steady-state workloads
   → Commit to Reserved Instances / Savings Plans = 40-60% discount
   
8. Cross-region data transfer
   → Architect to minimize cross-region; use CloudFront to reduce origin hits
   
9. Idle Kubernetes nodes (cluster autoscaler not configured)
   → Enable cluster autoscaler; use spot instances for batch workloads
   
10. Forgotten services from old projects
    → Tag with Project; delete when project ends
```

## Phase 3: Rightsizing

Rightsizing is matching resource allocation to actual consumption — not theoretical peak.

```python
# EC2 rightsizing analysis framework
# Pull from CloudWatch Metrics API or AWS Compute Optimizer

rightsizing_rules = {
    "oversized": {
        "condition": "avg_cpu < 10% AND avg_memory < 40% over 14 days",
        "action":    "downsize one instance family size",
        "savings":   "~50% cost reduction"
    },
    "right_sized": {
        "condition": "avg_cpu 10-70% AND avg_memory 40-80%",
        "action":    "no change",
    },
    "undersized": {
        "condition": "avg_cpu > 85% OR avg_memory > 90% over 14 days",
        "action":    "upsize — performance risk",
    }
}

# Don't rightsize based on average alone — check p99 too
# A batch job that runs at 100% CPU for 10 min/day averages 0.7% — 
# but it needs that capacity when it runs

# AWS Compute Optimizer: free tool, reads CloudWatch metrics,
# provides specific rightsizing recommendations automatically
```

**Database rightsizing:**
```sql
-- PostgreSQL: find idle connections consuming RDS resources
SELECT count(*) as count, state, wait_event_type, wait_event
FROM pg_stat_activity
GROUP BY state, wait_event_type, wait_event
ORDER BY count DESC;

-- If most connections are 'idle': reduce max_connections, use PgBouncer
-- Connection pooling can allow smaller RDS instance class

-- Check actual storage usage vs provisioned
SELECT 
  pg_database.datname as db_name,
  pg_size_pretty(pg_database_size(pg_database.datname)) as db_size
FROM pg_database
ORDER BY pg_database_size(pg_database.datname) DESC;
```

## Phase 4: Commitment Strategy

On-demand pricing is the most expensive way to run steady-state workloads.

```
Commitment discount ladder:
  On-Demand:           100% of list price (baseline)
  Spot/Preemptible:    10-30% of list price (interruptible — batch/dev only)
  1yr Reserved/SP:     40% discount (moderate commitment)
  3yr Reserved/SP:     60% discount (high commitment, needs stability)

AWS Savings Plans vs Reserved Instances:
  Savings Plans:  flexible (applies to any EC2, Lambda, Fargate)
                  Best for: teams with evolving instance mix
  Reserved:       specific (applies to exact instance type + AZ)
                  Best for: stable, predictable workloads

Strategy:
  Step 1: Run on-demand for 2-3 months; gather actual usage data
  Step 2: Analyze: which services are truly steady-state?
  Step 3: Commit at 70-80% of baseline (leave room for growth)
  Step 4: Cover remaining with on-demand + some spot where possible
  Step 5: Reassess commitments quarterly; adjust before expiry

Danger: Over-committing to reserved capacity you later don't use
        → You pay for idle reservations; diversify commitment terms
```

## Phase 5: Storage Optimization

```
S3 cost levers:
  
  Storage class selection:
    Standard:           $0.023/GB    Frequently accessed
    Intelligent-Tiering: $0.023/GB   Unknown access pattern (auto-tiers)
    Standard-IA:        $0.0125/GB   Infrequently accessed (retrieval fee)
    Glacier Instant:    $0.004/GB    Archive with ms retrieval
    Glacier Deep:       $0.00099/GB  Long-term archive (hours retrieval)

  Lifecycle policies (automate this):
    - Logs older than 30 days → Standard-IA
    - Logs older than 90 days → Glacier Instant
    - Logs older than 365 days → Glacier Deep or delete
    - Old deployment artifacts → delete after 30 days

  Request cost optimization:
    - Use CloudFront in front of S3 (cache reduces origin requests)
    - Use S3 Transfer Acceleration only when actually needed (adds cost)
    - Batch small objects into larger ones where possible

  Data compression:
    - Compress logs before storing (gzip cuts size by ~80%)
    - Use columnar formats (Parquet) for analytics data vs CSV
```

## Phase 6: Governance & Accountability

Cost optimization without governance regresses. Teams need to own their spend.

```
Budget alerts (non-negotiable setup):
  - Account level: alert at 80%, 100% of monthly budget
  - Team level: alert at 100% of per-team budget
  - Anomaly detection: alert when spend > 20% above trailing 7-day average

Monthly cost review ritual:
  Who attends: Engineering leads, Finance, FinOps champion
  Duration: 30 minutes
  Agenda:
    1. Actuals vs. budget by team (5 min)
    2. Top 3 cost changes vs. last month (5 min)
    3. Waste identified this month and what was done (10 min)
    4. Upcoming spend changes (new services, scaling events) (5 min)
    5. Action items (5 min)

Cost ownership model:
  Option A: Centralized FinOps team owns cost (faster expertise, weaker accountability)
  Option B: Each team owns their cloud spend (stronger accountability, slower to skill up)
  Best: Hybrid — FinOps team sets policy, tooling, guardrails; teams own their numbers
```

**Guardrails to implement:**
```yaml
# AWS Service Control Policy — prevent expensive services in dev accounts
{
  "Statement": [{
    "Effect": "Deny",
    "Action": [
      "ec2:RunInstances"  # Block certain large instance types in dev
    ],
    "Resource": "arn:aws:ec2:*:*:instance/*",
    "Condition": {
      "StringLike": {
        "ec2:InstanceType": ["*.8xlarge", "*.16xlarge", "*.24xlarge"]
      }
    }
  }]
}

# Terraform cost estimation in CI
# Use Infracost to get cost estimate on every PR that changes infra
# infracost diff --path ./terraform --format table
```

## Typical Optimization Impact by Category

```
Category                    | Typical Savings | Effort  | Risk
----------------------------|-----------------|---------|-------
Idle resource cleanup       | 5-15%           | Low     | Low
Dev environment scheduling  | 10-20%          | Low     | Low
Rightsizing compute         | 15-30%          | Medium  | Medium
Savings Plans / Reserved    | 20-40%          | Low     | Low
Storage lifecycle policies  | 10-25%          | Low     | Low
Spot instances (batch)      | 50-80% of batch | Medium  | Medium
NAT Gateway optimization    | 5-20%           | High    | Low
Architecture changes        | 30-60%          | High    | High

Total achievable in year 1: 30-50% reduction with medium effort
```
