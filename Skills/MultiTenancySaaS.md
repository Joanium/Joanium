---
name: Multi-Tenancy & SaaS Architecture
trigger: multi-tenancy, multi-tenant, SaaS architecture, tenant isolation, tenant data model, row-level security, schema-per-tenant, database-per-tenant, tenant onboarding, tenant context, subdomain routing, white-label, tenant provisioning, data isolation, noisy neighbor, tenant quota
description: Design multi-tenant SaaS systems with correct isolation, scalable data models, and tenant-aware infrastructure. Covers isolation strategies, RLS, tenant routing, onboarding, quotas, and noisy-neighbor prevention.
---

# ROLE
You are a SaaS platform architect. Your job is to design multi-tenant systems where tenants are completely isolated from each other's data, can't affect each other's performance, and can be onboarded and offboarded cleanly. Get isolation wrong and you're one bug away from a catastrophic data breach.

# CORE PRINCIPLES
```
ISOLATION IS NON-NEGOTIABLE:  A tenant must never see another tenant's data — ever.
TENANT CONTEXT EVERYWHERE:    Every query, every cache key, every log line must include tenant_id.
TEST TENANT BLEEDING:         Write tests that intentionally omit tenant context and verify they fail.
NOISY NEIGHBOR IS REAL:       One tenant's heavy query will destroy everyone else's if you don't plan for it.
ONBOARDING IS A FEATURE:      Tenant provisioning must be automated, tested, and fast. Manual setup doesn't scale.
OFFBOARDING TOO:              You must be able to delete all of a tenant's data completely — GDPR requires it.
```

# ISOLATION MODEL SELECTION

## Three Models
```
1. SHARED DATABASE, SHARED SCHEMA (row-level isolation):
   Every table has tenant_id column. RLS enforces access.
   
   PROS:  Lowest infrastructure cost, easy to deploy, centralized schema migrations
   CONS:  Weakest isolation, noisy neighbor risk on DB, complex RLS bugs
   BEST FOR: Startups, SMB SaaS, <1000 tenants, when cost is primary concern
   
   ─────────────────────────────────────────────────────────────
   |            Single Database                                 |
   |  ┌────────────────────────────────────────────────────┐   |
   |  │  orders: tenant_id | order_id | customer | total   │   |
   |  │          tenant_a  |    1     | Alice    | $100    │   |
   |  │          tenant_b  |    2     | Bob      |  $50    │   |
   |  └────────────────────────────────────────────────────┘   |
   ─────────────────────────────────────────────────────────────

2. SHARED DATABASE, SCHEMA-PER-TENANT (schema isolation):
   Each tenant gets their own PostgreSQL schema (namespace).
   Tables identical in structure, data fully separated.
   
   PROS:  Strong data isolation, easy per-tenant backup/restore, good migration support
   CONS:  Schema migration must run N times (one per tenant), more DB connections
   BEST FOR: Mid-market SaaS, regulated industries, 10–10K tenants

   ─────────────────────────────────────────────────────────────
   |            Single Database                                 |
   |  schema: tenant_a         schema: tenant_b                |
   |  ┌──────────────────┐     ┌──────────────────┐           |
   |  │  orders table    │     │  orders table    │           |
   |  │  (tenant a data) │     │  (tenant b data) │           |
   |  └──────────────────┘     └──────────────────┘           |
   ─────────────────────────────────────────────────────────────

3. DATABASE-PER-TENANT (full isolation):
   Each tenant has their own database instance (or cluster).
   
   PROS:  Complete isolation, easy per-tenant scaling, compliance-friendly
   CONS:  High cost, complex provisioning, migration orchestration is hard
   BEST FOR: Enterprise SaaS, high compliance requirements (HIPAA, FedRAMP), <500 tenants paying high ACV
```

# SHARED SCHEMA: ROW-LEVEL SECURITY (PostgreSQL)

## RLS Implementation
```sql
-- Every table has tenant_id
CREATE TABLE orders (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    customer_id UUID NOT NULL,
    total_cents INT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Index on tenant_id — ALWAYS, for every table
CREATE INDEX idx_orders_tenant ON orders(tenant_id);

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;  -- applies to table owner too

-- Policy: users can only see their tenant's rows
CREATE POLICY tenant_isolation ON orders
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- In your app, set the tenant context at connection time:
-- SET LOCAL app.current_tenant_id = 'tenant-uuid-here';
-- This must happen in every transaction.
```

## Application-Level Tenant Context
```javascript
// tenantContext.js — middleware that sets tenant for every request
export async function tenantMiddleware(req, res, next) {
  const tenantId = await resolveTenantId(req);  // from subdomain, header, JWT claim
  
  if (!tenantId) {
    return res.status(401).json({ error: 'tenant_not_identified' });
  }
  
  // Verify tenant is active
  const tenant = await tenantCache.get(tenantId);
  if (!tenant || tenant.status !== 'active') {
    return res.status(403).json({ error: 'tenant_inactive' });
  }
  
  req.tenant = tenant;
  next();
}

// db.js — tenant-scoped query helper
export async function withTenantContext(tenantId, fn) {
  const client = await pool.connect();
  try {
    await client.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    return await fn(client);
  } finally {
    client.release();
  }
}

// Usage in route handler
app.get('/orders', tenantMiddleware, async (req, res) => {
  const orders = await withTenantContext(req.tenant.id, async (db) => {
    // RLS automatically filters to this tenant — no WHERE tenant_id needed
    // But you can add it anyway as defense in depth
    return db.query('SELECT * FROM orders WHERE tenant_id = $1', [req.tenant.id]);
  });
  res.json(orders);
});
```

## The Tenant ID Checklist
```javascript
// Every query layer, cache, queue, and log must be tenant-scoped

// ✓ Database: RLS + explicit tenant_id in WHERE
// ✓ Redis cache keys: `tenant:${tenantId}:user:${userId}:profile`
// ✓ File storage: S3 prefix `${tenantId}/uploads/`
// ✓ Search index: filter by tenant_id field or use separate index per tenant
// ✓ Queue messages: include tenant_id in message payload
// ✓ Log lines: structured log includes tenant_id in every entry
// ✓ Metrics: tenant_id label on all metrics
// ✓ Errors: tenant_id in Sentry/error tracking context
```

# TENANT ROUTING

## Subdomain-Based Routing
```javascript
// Extract tenant from subdomain: acme.yourapp.com → tenant = 'acme'
export async function resolveTenantId(req) {
  const hostname = req.hostname; // 'acme.yourapp.com'
  
  // Subdomain routing
  const subdomain = hostname.split('.')[0];
  if (subdomain && subdomain !== 'www' && subdomain !== 'app') {
    return tenantRepo.findBySubdomain(subdomain);
  }
  
  // Custom domain routing
  if (!hostname.endsWith('.yourapp.com')) {
    return tenantRepo.findByCustomDomain(hostname);
  }
  
  // JWT claim routing (for API clients)
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    const payload = verifyJWT(token);
    return payload.tenant_id;
  }
  
  return null;
}

// Cache tenant lookups — subdomain resolution happens on EVERY request
const tenantCache = new Map(); // or Redis with 5-min TTL
```

## Custom Domain Support
```
Flow:
  1. Tenant configures 'app.acme.com' in their settings
  2. Your system stores: { custom_domain: 'app.acme.com', tenant_id: 'tenant_abc' }
  3. Tenant creates CNAME: app.acme.com → yourapp.com
  4. Your ingress (Nginx/Caddy/CloudFront) handles wildcard SSL + routes to app
  5. App resolves tenant from Host header

SSL for custom domains:
  → AWS CloudFront + ACM → automated cert provisioning
  → Caddy with on-demand TLS → zero-config SSL for any domain
  → cert-manager on Kubernetes → automated Let's Encrypt
```

# TENANT ONBOARDING & PROVISIONING

## Automated Provisioning Pipeline
```javascript
class TenantProvisioningService {
  async provision(plan) {
    const tenant = await this.createTenantRecord(plan);
    
    try {
      await this.runInSequence([
        () => this.provisionDatabase(tenant),      // create schema or DB
        () => this.runMigrations(tenant),           // apply all migrations
        () => this.seedDefaultData(tenant),         // roles, settings, templates
        () => this.provisionStorage(tenant),        // S3 prefix or bucket
        () => this.configureSubdomain(tenant),      // DNS or nginx map
        () => this.createOwnerAccount(tenant, plan.owner),
        () => this.sendWelcomeEmail(tenant, plan.owner),
        () => this.activateTenant(tenant),          // flip status → active
      ]);
    } catch (error) {
      await this.rollbackProvisioning(tenant);
      throw error;
    }
    
    return tenant;
  }

  async provisionDatabase(tenant) {
    // Schema-per-tenant approach
    await db.query(`CREATE SCHEMA IF NOT EXISTS tenant_${tenant.slug}`);
    await db.query(`
      GRANT USAGE ON SCHEMA tenant_${tenant.slug} TO app_user;
      GRANT ALL ON ALL TABLES IN SCHEMA tenant_${tenant.slug} TO app_user;
      ALTER DEFAULT PRIVILEGES IN SCHEMA tenant_${tenant.slug}
        GRANT ALL ON TABLES TO app_user;
    `);
  }

  async rollbackProvisioning(tenant) {
    // Must be safe to run even if provisioning was partial
    await db.query(`DROP SCHEMA IF EXISTS tenant_${tenant.slug} CASCADE`);
    await s3.deleteObjects({ Prefix: `${tenant.id}/` });
    await db('tenants').where('id', tenant.id).delete();
    logger.error({ tenant_id: tenant.id }, 'Provisioning rolled back');
  }
}
```

# QUOTA & LIMITS (Noisy Neighbor Prevention)

## Per-Tenant Resource Limits
```javascript
const PLAN_QUOTAS = {
  free: {
    api_requests_per_day: 1_000,
    storage_bytes: 100 * 1024 * 1024,     // 100MB
    team_members: 3,
    records: 10_000,
    ai_tokens_per_month: 50_000
  },
  starter: {
    api_requests_per_day: 10_000,
    storage_bytes: 5 * 1024 * 1024 * 1024, // 5GB
    team_members: 10,
    records: 100_000,
    ai_tokens_per_month: 500_000
  },
  pro: {
    api_requests_per_day: 100_000,
    storage_bytes: 50 * 1024 * 1024 * 1024,
    team_members: null, // unlimited
    records: null,
    ai_tokens_per_month: 5_000_000
  }
};

async function checkQuota(tenantId, resource, amount = 1) {
  const tenant = await getTenant(tenantId);
  const quota = PLAN_QUOTAS[tenant.plan][resource];
  
  if (quota === null) return { allowed: true }; // unlimited
  
  const usage = await getUsage(tenantId, resource);
  const allowed = usage + amount <= quota;
  
  return {
    allowed,
    usage,
    quota,
    remaining: Math.max(0, quota - usage),
    overage: allowed ? 0 : (usage + amount - quota)
  };
}
```

## Database-Level Noisy Neighbor Controls
```sql
-- PostgreSQL: per-tenant connection limits
ALTER ROLE tenant_a_user CONNECTION LIMIT 10;

-- Statement timeout per tenant (prevents one tenant's slow query from blocking others)
-- Set in connection pool based on tenant plan
SET statement_timeout = '30s';   -- free tier
SET statement_timeout = '120s';  -- pro tier

-- Lock timeout
SET lock_timeout = '10s';

-- Work_mem per query (affects sort/hash join memory)
SET work_mem = '16MB';  -- free; '64MB' for pro
```

# DATA ISOLATION TESTING

## Tests You Must Write
```javascript
describe('Tenant Isolation', () => {
  let tenantA, tenantB, orderA, orderB;
  
  beforeEach(async () => {
    tenantA = await createTestTenant();
    tenantB = await createTestTenant();
    orderA = await createOrder({ tenant_id: tenantA.id });
    orderB = await createOrder({ tenant_id: tenantB.id });
  });

  it('tenant A cannot read tenant B orders', async () => {
    const orders = await OrderService.list({ tenantId: tenantA.id });
    const ids = orders.map(o => o.id);
    expect(ids).toContain(orderA.id);
    expect(ids).not.toContain(orderB.id);  // CRITICAL: this must fail if RLS is broken
  });

  it('tenant A cannot update tenant B records', async () => {
    await expect(
      OrderService.update(orderB.id, { status: 'hacked' }, { tenantId: tenantA.id })
    ).rejects.toThrow();
  });

  it('query without tenant context fails', async () => {
    // If RLS is enabled, querying without setting tenant context should return nothing
    // or throw — never return data from other tenants
    const result = await db.raw('SELECT * FROM orders WHERE id = ?', [orderA.id]);
    expect(result.rows).toHaveLength(0); // RLS blocks it
  });
});
```

# PRODUCTION CHECKLIST
```
[ ] Isolation model chosen and documented (row / schema / database)
[ ] Every table has tenant_id with NOT NULL constraint and index
[ ] RLS enabled and tested with cross-tenant access attempt tests
[ ] Tenant context set at connection pool level, not per-query
[ ] Cache keys include tenant_id prefix
[ ] S3/storage paths prefixed with tenant_id
[ ] Subdomain/custom domain routing implemented and cached
[ ] Tenant provisioning is fully automated and idempotent
[ ] Provisioning rollback implemented and tested
[ ] Offboarding deletes ALL tenant data (verify with GDPR deletion test)
[ ] Quota limits defined per plan and enforced at API layer
[ ] Statement timeout and connection limits set per tenant tier
[ ] Monitoring shows per-tenant API usage and DB query time
[ ] Alert on tenant quota > 80% (email tenant before they hit the wall)
[ ] Schema migrations tested against schema-per-tenant (run N times)
[ ] Cross-tenant bleeding tests in CI pipeline — they must pass before deploy
```
