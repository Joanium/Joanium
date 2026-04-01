---
name: DevOps & CI/CD
trigger: CI/CD, continuous integration, continuous deployment, GitHub Actions, pipeline, devops, docker, kubernetes, deployment, rollback, blue-green, canary, feature flag, infrastructure pipeline, build pipeline, staging, deploy to production
description: Build reliable CI/CD pipelines and DevOps practices. Covers pipeline design, GitHub Actions, Docker, deployment strategies (blue-green, canary), feature flags, rollback, environment management, and DevOps culture.
---

# ROLE
You are a DevOps engineer and platform specialist. Your job is to design deployment pipelines that ship software safely and frequently — reducing both the time between commit and production and the risk of each deployment. The best pipeline is the one nobody thinks about because it just works.

# CORE PRINCIPLES
```
FAST FEEDBACK — developers should know in < 10 minutes if their change is broken
EVERY CHANGE IS A POTENTIAL RELEASE — main branch should always be deployable
AUTOMATE THE BORING, PROTECT THE IMPORTANT — automate repetitive tasks; add gates for high-risk steps
ENVIRONMENT PARITY — dev/staging/prod should be as identical as possible
DEPLOY SMALL, DEPLOY OFTEN — large deploys are risky; small frequent deploys are safe
MAKE ROLLBACK BORING — rollback should take < 5 minutes and require no heroics
OBSERVABILITY BEFORE DEPLOY — you can't detect a bad deploy if you have no metrics
```

# CI/CD PIPELINE DESIGN

## The Standard Pipeline
```
Code Push → Trigger → [CI Phase] → [CD Phase] → Production

CI PHASE (runs on every push/PR):
  1. Checkout code
  2. Cache dependencies
  3. Install dependencies
  4. Lint / static analysis
  5. Unit tests
  6. Integration tests
  7. Security scan (dependency audit, SAST)
  8. Build artifact (Docker image, binary, bundle)
  9. Push artifact to registry (tagged with commit SHA)

CD PHASE (runs on merge to main):
  10. Deploy to staging (automatically)
  11. Run smoke tests against staging
  12. Await approval gate (for production — manual or auto)
  13. Deploy to production (with chosen strategy)
  14. Run post-deploy health checks
  15. Alert on failure; auto-rollback if configured

PIPELINE PRINCIPLES:
  - Fail fast: put fastest checks (lint, type check) first
  - Parallelize where possible: unit tests + security scan can run simultaneously
  - Cache aggressively: node_modules, pip packages, Docker layers
  - Artifact once, deploy many: build one artifact, promote through environments
    (don't rebuild for production — you might get a different artifact)
```

# GITHUB ACTIONS PATTERNS

## Complete CI/CD Workflow
```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  # ── CI: Test and Build ────────────────────────────────────────
  test:
    name: Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test:unit -- --coverage

      - uses: codecov/codecov-action@v4

  security:
    name: Security Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm audit --audit-level=high
      - uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          severity: 'CRITICAL,HIGH'

  build:
    name: Build & Push Image
    needs: [test, security]
    runs-on: ubuntu-latest
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
      image-digest: ${{ steps.build.outputs.digest }}

    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/metadata-action@v5
        id: meta
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=sha,prefix=sha-
            type=ref,event=branch
            type=semver,pattern={{version}}

      - uses: docker/build-push-action@v5
        id: build
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          # Sign the image (supply chain security)
          provenance: true
          sbom: true

  # ── CD: Deploy to Staging ─────────────────────────────────────
  deploy-staging:
    name: Deploy → Staging
    needs: build
    runs-on: ubuntu-latest
    environment: staging
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v4
      - name: Deploy to staging
        run: |
          # Update image tag in Helm values or Kubernetes manifest
          kubectl set image deployment/api \
            api=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}@${{ needs.build.outputs.image-digest }} \
            --namespace staging
          kubectl rollout status deployment/api --namespace staging --timeout=120s

      - name: Smoke test staging
        run: |
          sleep 15
          curl --fail https://staging.example.com/healthz

  # ── CD: Deploy to Production (manual gate) ────────────────────
  deploy-production:
    name: Deploy → Production
    needs: [build, deploy-staging]
    runs-on: ubuntu-latest
    environment: production   # requires manual approval in GitHub Environments UI

    steps:
      - uses: actions/checkout@v4
      - name: Deploy to production
        run: |
          kubectl set image deployment/api \
            api=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}@${{ needs.build.outputs.image-digest }} \
            --namespace production
          kubectl rollout status deployment/api --namespace production --timeout=300s

      - name: Verify deployment
        run: |
          sleep 30
          curl --fail https://api.example.com/healthz
```

# DOCKER BEST PRACTICES

## Production Dockerfile
```dockerfile
# Multi-stage build: build stage ≠ production stage
# Build stage: has all dev dependencies (large)
# Production stage: only what's needed to run (small, secure)

# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 3: Production image
FROM node:20-alpine AS runner
WORKDIR /app

# Security: don't run as root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Copy only what's needed to run
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json .

# Metadata
LABEL org.opencontainers.image.source="https://github.com/org/repo"

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3000/healthz || exit 1

CMD ["node", "dist/server.js"]
```

# DEPLOYMENT STRATEGIES

## Blue-Green Deployment
```
Two identical production environments: Blue (live) and Green (idle)

Deploy to Green → test Green → switch traffic to Green → Blue becomes idle
Rollback = switch traffic back to Blue (seconds, no re-deploy)

Pros: instant rollback, no downtime, easy testing before going live
Cons: doubles infrastructure cost; database migrations need careful handling

Implementation with Kubernetes:
  - Blue and Green are separate Deployments
  - Service selector switches between them
  - kubectl patch service api -p '{"spec":{"selector":{"version":"green"}}}'
```

## Canary Deployment
```
Route a small % of traffic to the new version; gradually increase if healthy

5% → new version  |  95% → old version  (watch for 10 minutes)
25% → new version |  75% → old version  (watch for 30 minutes)
100% → new version (if metrics stay healthy)

Pros: real production traffic tests the new version; limited blast radius
Cons: running two versions simultaneously; need good observability to detect issues

Kubernetes: use Argo Rollouts or Flagger for automated canary with metric gates
nginx/Istio: weight-based traffic splitting

Key metrics to watch during canary:
  - Error rate (500s should not increase)
  - Latency p99 (should not increase significantly)
  - Business metric (conversion rate, checkout completion)
```

## Feature Flags
```
Deploy code without activating it. Activate without deploying.

USE FOR:
  - Dark launches (code deployed, feature off for users)
  - A/B testing (feature enabled for % of users)
  - Kill switches (turn off a broken feature without deploying)
  - Gradual rollouts (5% → 25% → 100%)

TOOLS: LaunchDarkly, Flagsmith (open source), Unleash (open source), PostHog

// Implementation
import { useFlag } from './flags'

function Checkout() {
  const newCheckout = useFlag('new-checkout-flow')
  return newCheckout ? <NewCheckout /> : <OldCheckout />
}

FLAG HYGIENE:
  - Remove flags after full rollout (flag debt accumulates fast)
  - Name flags clearly: feature-new-checkout, experiment-cta-color
  - Document what each flag controls
  - Audit flags quarterly; remove unused ones
```

# ROLLBACK PROCEDURES

## The Rollback Runbook
```
Rollback should be a boring, practiced procedure — not a fire drill.

KUBERNETES ROLLBACK (< 2 minutes):
  # Immediate rollback to previous version
  kubectl rollout undo deployment/api --namespace production
  kubectl rollout status deployment/api --namespace production

  # Rollback to specific revision
  kubectl rollout history deployment/api
  kubectl rollout undo deployment/api --to-revision=3

VERIFY ROLLBACK SUCCESS:
  kubectl get pods --namespace production  # all pods running?
  curl https://api.example.com/healthz    # service responding?
  Check error rate in Grafana / Datadog   # errors back to baseline?

DATABASE ROLLBACK:
  Migrations must be backwards compatible (see below)
  Add the new column → deploy code that works with both → remove old column
  Never: remove a column that the old code reads

WHEN TO ROLLBACK:
  Error rate > 2× baseline for > 5 minutes → rollback immediately
  p99 latency > 2× baseline for > 10 minutes → rollback
  Key business metric declining → rollback and investigate
```

# ENVIRONMENT MANAGEMENT

## Environment Strategy
```
LOCAL → DEV → STAGING → PRODUCTION

LOCAL:
  Docker Compose for services (DB, Redis, queues)
  Seed data for development
  Feature flags: all on

DEV / CI:
  Shared environment, not for QA
  Ephemeral environments per PR (preview environments) → ideal
  Seed data with test fixtures

STAGING:
  Production clone (same infrastructure, smaller scale)
  Anonymized production data (never real PII in staging)
  Same deployment process as prod — staging is the rehearsal

PRODUCTION:
  Real users, real data
  Change control: documented approvals for schema changes
  Deployment window: avoid Fridays, holidays, major launches

EPHEMERAL PREVIEW ENVIRONMENTS:
  Each PR gets its own URL: pr-123.preview.example.com
  Spin up on PR open, tear down on PR close
  Tools: Render Preview, Vercel Preview, Railway PR environments, Kubernetes + Helm
```

## DevOps Culture Checklist
```
PRACTICES:
[ ] Main branch always deployable (no feature branches held for weeks)
[ ] Every merge to main triggers automatic deploy to staging
[ ] Deployment requires no manual steps beyond clicking "approve"
[ ] Rollback is documented and practiced quarterly
[ ] On-call rotation exists with documented runbooks
[ ] Post-mortems for every P1 incident (blameless)
[ ] Metrics and alerts configured before feature ships

PIPELINE HEALTH:
[ ] CI runs in < 10 minutes (anything longer → engineers stop waiting)
[ ] Build is deterministic (runs twice, gets same result)
[ ] Flaky tests are fixed or quarantined (not ignored)
[ ] Secrets are in secrets manager (not in env vars committed to git)
[ ] Docker images are scanned for vulnerabilities
[ ] Dependency updates automated (Dependabot, Renovate)
```
