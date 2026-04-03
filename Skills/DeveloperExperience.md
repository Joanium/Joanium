---
name: Developer Experience (DX)
trigger: developer experience, DX, developer productivity, onboarding developers, local development, dev tooling, developer portal, internal tools, developer satisfaction, engineering productivity, dev setup, dev workflow, inner loop
description: A framework for designing and improving the experience of developers building on your platform, API, or codebase. Use for internal developer portals, API DX design, onboarding workflows, local dev setup, tooling choices, and measuring developer productivity.
---

Developer Experience (DX) is how productive, capable, and satisfied developers feel when building with your systems — whether those systems are an internal codebase, a platform, or a public API. Good DX compounds: great tooling and documentation attract contributions, reduce bugs, and shorten time-to-production. Poor DX is often invisible until developers are already frustrated — and by then, the trust is hard to recover.

## The DX Hierarchy of Needs

```
                    ┌──────────────┐
                    │  Delight     │ Fast iteration, great tooling,
                    │              │ "it just works" moments
                ┌───┴──────────────┴───┐
                │  Efficiency          │ Minimal friction, automation,
                │                      │ short feedback loops
            ┌───┴──────────────────────┴───┐
            │  Discoverability             │ Can find what you need,
            │                              │ docs are searchable & accurate
        ┌───┴──────────────────────────────┴───┐
        │  Reliability                         │ Tools work, CI passes consistently,
        │                                      │ local env matches production
    ┌───┴──────────────────────────────────────┴───┐
    │  Correctness (Foundation)                    │ The thing does what it says.
    │  Without this, nothing above matters.        │
    └──────────────────────────────────────────────┘
```

Fix correctness before optimizing for delight.

## Phase 1: Measure Current DX

You can't improve what you haven't measured. Start with a developer survey and DORA metrics.

**DORA metrics (team-level productivity signals):**
```
Deployment Frequency:   How often do you deploy to production?
  Elite: multiple times/day   High: weekly   Medium: monthly   Low: <monthly

Lead Time for Changes:  Commit to production average
  Elite: <1 hour   High: <1 day   Medium: <1 week   Low: >1 month

Change Failure Rate:    % of deploys that cause incidents
  Elite: <5%   High: <10%   Medium: <15%   Low: >15%

MTTR:                   Time to restore from incident
  Elite: <1 hour   High: <1 day   Medium: <1 week   Low: >1 month
```

**Developer experience survey (run quarterly):**
```
Score 1-5 (1=strongly disagree, 5=strongly agree):

Onboarding:
  □ I was productive within my first week
  □ The onboarding documentation was accurate and complete

Local development:
  □ My local environment reliably reflects production behavior
  □ Starting the local dev environment takes < 5 minutes
  □ I rarely lose time debugging environment-specific issues

Feedback loops:
  □ I get test results within 10 minutes of pushing code
  □ I can validate my changes before merging
  □ Flaky tests do not waste significant time

Documentation:
  □ I can find relevant documentation in < 5 minutes
  □ Documentation is usually accurate and up to date

Deployment:
  □ I feel safe deploying my changes
  □ I can deploy independently without coordinating with others

Open questions:
  □ What is the most frustrating part of your workflow?
  □ What one thing would most improve your productivity?
```

## Phase 2: Local Development Environment

The local development inner loop is where developers spend most of their time. Every minute of friction here multiplies across the whole team, every day.

**Environment setup standards:**
```bash
# Goal: one-command setup from git clone to running app
# Every project must have this

# Example: Makefile-based setup
make setup   # Install deps, copy .env.example, seed DB, start services
make dev     # Start all services with hot reload
make test    # Run test suite
make lint    # Lint and format
make check   # Everything above before opening a PR

# Document what each command does — don't make people guess
```

**Docker Compose for local parity:**
```yaml
# docker-compose.dev.yml
# Goal: exact same versions as production; developers never install postgres/redis locally

version: '3.8'
services:
  app:
    build: 
      context: .
      target: development  # Use multi-stage build for dev vs prod image
    volumes:
      - .:/app              # Mount source for hot reload
      - /app/node_modules   # Don't mount over node_modules
    environment:
      DATABASE_URL: postgres://dev:dev@postgres:5432/myapp_dev
      REDIS_URL: redis://redis:6379
    ports: ["3000:3000"]
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_started }

  postgres:
    image: postgres:16          # Pin to same version as production
    environment:
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: myapp_dev
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dev"]
      interval: 5s
      timeout: 5s
      retries: 5
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/seed.sql:/docker-entrypoint-initdb.d/seed.sql

  redis:
    image: redis:7-alpine       # Pin to same version as production

volumes:
  postgres_data:
```

**Reduce inner loop friction:**
```
Inner loop: Code → Run → See result → Repeat

Targets:
  - Hot reload: change code, see result in < 2 seconds (no manual restart)
  - Test run: run a single test file in < 5 seconds
  - Full test suite: < 5 minutes (run with confidence before PR)
  - Lint/format: run on save automatically (never a manual step)

Tools:
  Node.js: tsx --watch, nodemon, Vite HMR
  Python: uvicorn --reload, pytest-watch
  Go: air (live reload), gotestsum (better test runner)
  Format-on-save: Prettier, Black, gofmt (configured in editor)

Anti-patterns that kill inner loops:
  ✗ Requiring a full Docker rebuild to see code changes
  ✗ Running database migrations manually every time
  ✗ "Works on my machine" environment divergence
  ✗ Secrets stored in undocumented files only senior devs know about
```

## Phase 3: Documentation

**Documentation hierarchy:**
```
1. README (the front door)
   - What this project does (2 sentences)
   - Prerequisites (exact versions)
   - Setup instructions (commands, not prose)
   - How to run tests
   - How to deploy
   - Who to ask for help

2. Architecture Decision Records (ADRs)
   - Why we made significant decisions
   - Alternatives considered
   - Context at the time
   Format: /docs/adr/001-use-postgres-not-mysql.md

3. Runbooks (operational docs)
   - How to investigate/fix specific problems
   - Decision trees, not prose
   - Linked from alerts

4. API Reference (generated, not hand-written)
   - Auto-generated from code (OpenAPI, TypeDoc, godoc)
   - Always in sync because it comes from the source
   - Never let this drift from implementation

5. Guides & tutorials (task-oriented)
   - "How to add a new payment provider"
   - "How to write a database migration"
   - Concrete, end-to-end, runnable examples
```

**Documentation quality rules:**
```markdown
□ Every code example must be tested and runnable
□ Every document has a "last updated" date and owner
□ No broken links (check with automated link checker in CI)
□ Prerequisites are explicit: "Install Node 20+, not "Install Node"
□ Commands are copy-pasteable: no $ prefix that breaks paste, no line wraps
□ Screenshots have alt text (accessibility + searchable)
□ Every internal API has at least one end-to-end example

Monthly doc health check:
  - Run link checker (deadlink, lychee)
  - Review PRs from last month: did any change require undocumented knowledge?
  - Check "last updated" dates: flag docs > 6 months old in fast-moving areas
```

## Phase 4: CI/CD Developer Experience

Developers live in CI. Slow or flaky CI is one of the highest-impact DX problems.

```yaml
# CI pipeline DX principles

# 1. Fast feedback: most important checks first
name: CI
on: [pull_request]
jobs:
  quick-checks:           # Run first — <2 min
    - Lint & format
    - Type check
    - Unit tests
    
  integration-tests:      # Run after — <10 min
    - Integration tests
    - Database migration check
    
  e2e-tests:             # Run last — only on main branch or release
    - End-to-end tests

# 2. Parallelism — split test suites across runners
test:
  strategy:
    matrix:
      shard: [1, 2, 3, 4]
  steps:
    - run: npx jest --shard=${{ matrix.shard }}/4

# 3. Cache dependencies aggressively
- uses: actions/cache@v3
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('package-lock.json') }}
    restore-keys: ${{ runner.os }}-node-

# 4. Error messages that tell you exactly what to do
# BAD:  "Test failed" (what test? what file? what line?)
# GOOD: Annotate PR with inline test failure comments using GitHub annotations
```

**Eliminating flaky tests:**
```python
# Flaky tests are a DX emergency — they destroy trust in CI
# Track flakiness rate: if a test fails > 2% of runs without code changes, it's flaky

# Common causes and fixes:
flakiness_patterns = {
    "timing dependencies": {
        "symptom": "Tests pass alone but fail in parallel",
        "fix": "Use explicit waits, not sleep(). Test in isolation."
    },
    "shared state": {
        "symptom": "Tests fail depending on execution order",
        "fix": "Each test must set up and tear down its own state"
    },
    "external dependencies": {
        "symptom": "Tests fail when network is slow or external API hiccups",
        "fix": "Mock external services in unit/integration tests"
    },
    "date/time dependencies": {
        "symptom": "Tests fail at midnight, month boundaries, or in different timezones",
        "fix": "Mock system time; never use Date.now() in test-dependent code"
    }
}
```

## Phase 5: Developer Portal

For platform teams or public APIs, a developer portal is the DX front door.

```
Developer portal must-haves:
  ✅ Quickstart: working "Hello World" in < 10 minutes from zero
  ✅ Interactive API reference (Swagger UI, Readme.io)
  ✅ Code samples in the top 3-5 languages your users use
  ✅ Search (developers won't browse; they search)
  ✅ Changelog (what changed and when — developers need this for upgrades)
  ✅ Status page link (current API health)
  ✅ Community channel (Discord, Slack, GitHub Discussions)

Developer portal nice-to-haves:
  ⭐ API sandbox/playground (test without credentials)
  ⭐ SDK download and setup instructions
  ⭐ Tutorials (task-oriented, end-to-end, copyable code)
  ⭐ Video walkthroughs for complex concepts

Developer portal anti-patterns:
  ✗ Documentation that requires login to read
  ✗ No code examples (prose-only explanations of APIs)
  ✗ Stale screenshots showing old UI
  ✗ Broken code samples (test them in CI)
  ✗ No version selector (docs for which version exactly?)
```

## Measuring DX Improvement

```python
dx_metrics = {
    # Onboarding
    "time_to_first_commit_hours": "New hire → first merged PR",
    "onboarding_completion_rate": "% of new hires who complete onboarding doc without help",
    
    # Inner loop
    "local_setup_time_minutes":   "Clone repo → app running",
    "hot_reload_latency_seconds": "Code change → visible in browser",
    
    # CI/CD
    "ci_duration_minutes":        "Push → CI result",
    "ci_flakiness_rate":          "% of CI runs that fail non-deterministically",
    "deploy_duration_minutes":    "Merge → production",
    
    # Documentation  
    "doc_search_success_rate":    "Survey: 'Found what I needed in docs'",
    "doc_accuracy_issues_per_month": "PRs that fix documentation errors",
    
    # Overall
    "developer_nps":              "How likely to recommend this codebase to a peer?",
    "bottleneck_report_rate":     "# of 'I'm blocked by tooling/infra' in standups",
}
```
