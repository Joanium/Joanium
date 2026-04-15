const BASE = 'https://api.cloudflare.com/client/v4';

function headers(creds) {
  return { Authorization: `Bearer ${creds.token}`, 'Content-Type': 'application/json' };
}

async function cfFetch(path, creds, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...headers(creds), ...(options.headers ?? {}) },
  });
  const data = await res.json();
  if (!data.success)
    throw new Error(data.errors?.[0]?.message ?? `Cloudflare API error: ${res.status}`);
  return data.result;
}

// ─── Token & Account ──────────────────────────────────────────────────────────

export async function verifyToken(creds) {
  return cfFetch('/user/tokens/verify', creds);
}

export async function getUser(creds) {
  const u = await cfFetch('/user', creds);
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    twoFactorEnabled: u.two_factor_authentication_enabled,
  };
}

export async function listAccounts(creds) {
  const accounts = await cfFetch('/accounts?per_page=50', creds);
  return (accounts ?? []).map((a) => ({ id: a.id, name: a.name, type: a.type }));
}

// ─── Zones ────────────────────────────────────────────────────────────────────

export async function listZones(creds) {
  const zones = await cfFetch('/zones?per_page=50&status=active', creds);
  return (zones ?? []).map((z) => ({
    id: z.id,
    name: z.name,
    status: z.status,
    plan: z.plan?.name ?? 'Unknown',
    nameServers: z.name_servers ?? [],
    modifiedOn: z.modified_on,
  }));
}

export async function getZone(creds, zoneId) {
  const z = await cfFetch(`/zones/${zoneId}`, creds);
  return {
    id: z.id,
    name: z.name,
    status: z.status,
    plan: z.plan?.name ?? 'Unknown',
    nameServers: z.name_servers ?? [],
    originalNameServers: z.original_name_servers ?? [],
    createdOn: z.created_on,
    modifiedOn: z.modified_on,
    paused: z.paused,
  };
}

export async function getZoneSettings(creds, zoneId) {
  const settings = await cfFetch(`/zones/${zoneId}/settings`, creds);
  return (settings ?? []).map((s) => ({
    id: s.id,
    value: s.value,
    editable: s.editable,
    modifiedOn: s.modified_on,
  }));
}

export async function updateZoneSetting(creds, zoneId, settingId, value) {
  return cfFetch(`/zones/${zoneId}/settings/${settingId}`, creds, {
    method: 'PATCH',
    body: JSON.stringify({ value }),
  });
}

export async function getZoneAnalytics(creds, zoneId, { since, until } = {}) {
  const sinceParam = since ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const untilParam = until ?? new Date().toISOString();
  const data = await cfFetch(
    `/zones/${zoneId}/analytics/dashboard?since=${sinceParam}&until=${untilParam}&continuous=true`,
    creds,
  );
  const totals = data?.totals ?? {};
  return {
    requests: totals.requests?.all ?? 0,
    bandwidth: totals.bandwidth?.all ?? 0,
    threats: totals.threats?.all ?? 0,
    pageviews: totals.pageviews?.all ?? 0,
    uniqueVisitors: totals.uniques?.all ?? 0,
  };
}

export async function pauseZone(creds, zoneId) {
  const z = await cfFetch(`/zones/${zoneId}`, creds, {
    method: 'PATCH',
    body: JSON.stringify({ paused: true }),
  });
  return { id: z.id, name: z.name, paused: z.paused };
}

export async function unpauseZone(creds, zoneId) {
  const z = await cfFetch(`/zones/${zoneId}`, creds, {
    method: 'PATCH',
    body: JSON.stringify({ paused: false }),
  });
  return { id: z.id, name: z.name, paused: z.paused };
}

// ─── DNS Records ──────────────────────────────────────────────────────────────

export async function listDnsRecords(creds, zoneId) {
  const records = await cfFetch(`/zones/${zoneId}/dns_records?per_page=100`, creds);
  return (records ?? []).map((r) => ({
    id: r.id,
    type: r.type,
    name: r.name,
    content: r.content,
    proxied: r.proxied,
    ttl: r.ttl,
    priority: r.priority,
    createdOn: r.created_on,
    modifiedOn: r.modified_on,
  }));
}

export async function getDnsRecord(creds, zoneId, recordId) {
  const r = await cfFetch(`/zones/${zoneId}/dns_records/${recordId}`, creds);
  return {
    id: r.id,
    type: r.type,
    name: r.name,
    content: r.content,
    proxied: r.proxied,
    ttl: r.ttl,
  };
}

export async function createDnsRecord(
  creds,
  zoneId,
  { type, name, content, ttl = 1, proxied = false, priority },
) {
  const body = { type, name, content, ttl, proxied };
  if (priority !== undefined) body.priority = priority;
  const r = await cfFetch(`/zones/${zoneId}/dns_records`, creds, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return {
    id: r.id,
    type: r.type,
    name: r.name,
    content: r.content,
    proxied: r.proxied,
    ttl: r.ttl,
  };
}

export async function updateDnsRecord(creds, zoneId, recordId, fields) {
  const r = await cfFetch(`/zones/${zoneId}/dns_records/${recordId}`, creds, {
    method: 'PATCH',
    body: JSON.stringify(fields),
  });
  return {
    id: r.id,
    type: r.type,
    name: r.name,
    content: r.content,
    proxied: r.proxied,
    ttl: r.ttl,
  };
}

export async function deleteDnsRecord(creds, zoneId, recordId) {
  const r = await cfFetch(`/zones/${zoneId}/dns_records/${recordId}`, creds, { method: 'DELETE' });
  return { id: r.id, deleted: true };
}

export async function exportDnsRecords(creds, zoneId) {
  // Returns raw BIND-format text; bypass JSON parsing
  const res = await fetch(`${BASE}/zones/${zoneId}/dns_records/export`, {
    headers: headers(creds),
  });
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  return res.text();
}

// ─── Cache ────────────────────────────────────────────────────────────────────

export async function purgeCache(
  creds,
  zoneId,
  { purgeEverything = false, files = [], tags = [], hosts = [] } = {},
) {
  const body = purgeEverything
    ? { purge_everything: true }
    : {
        files: files.length ? files : undefined,
        tags: tags.length ? tags : undefined,
        hosts: hosts.length ? hosts : undefined,
      };
  return cfFetch(`/zones/${zoneId}/purge_cache`, creds, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getCachingLevel(creds, zoneId) {
  return cfFetch(`/zones/${zoneId}/settings/cache_level`, creds);
}

export async function updateCachingLevel(creds, zoneId, value) {
  // value: 'aggressive' | 'basic' | 'simplified'
  return cfFetch(`/zones/${zoneId}/settings/cache_level`, creds, {
    method: 'PATCH',
    body: JSON.stringify({ value }),
  });
}

// ─── Firewall Rules ───────────────────────────────────────────────────────────

export async function listFirewallRules(creds, zoneId) {
  const rules = await cfFetch(`/zones/${zoneId}/firewall/rules?per_page=100`, creds);
  return (rules ?? []).map((r) => ({
    id: r.id,
    description: r.description,
    action: r.action,
    expression: r.filter?.expression,
    enabled: r.paused === false,
    priority: r.priority,
  }));
}

export async function createFirewallRule(
  creds,
  zoneId,
  { expression, action, description = '', priority },
) {
  // First create the filter
  const filters = await cfFetch(`/zones/${zoneId}/filters`, creds, {
    method: 'POST',
    body: JSON.stringify([{ expression }]),
  });
  const filterId = filters[0].id;

  const body = [{ filter: { id: filterId }, action, description }];
  if (priority !== undefined) body[0].priority = priority;

  const rules = await cfFetch(`/zones/${zoneId}/firewall/rules`, creds, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const r = rules[0];
  return {
    id: r.id,
    description: r.description,
    action: r.action,
    expression: r.filter?.expression,
  };
}

export async function deleteFirewallRule(creds, zoneId, ruleId) {
  const r = await cfFetch(`/zones/${zoneId}/firewall/rules/${ruleId}`, creds, { method: 'DELETE' });
  return { id: r.id, deleted: true };
}

// ─── IP Access Rules ──────────────────────────────────────────────────────────

export async function listIPAccessRules(creds, zoneId) {
  const rules = await cfFetch(`/zones/${zoneId}/firewall/access_rules/rules?per_page=100`, creds);
  return (rules ?? []).map((r) => ({
    id: r.id,
    mode: r.mode,
    value: r.configuration?.value,
    target: r.configuration?.target,
    notes: r.notes,
    createdOn: r.created_on,
  }));
}

export async function createIPAccessRule(creds, zoneId, { mode, target, value, notes = '' }) {
  const r = await cfFetch(`/zones/${zoneId}/firewall/access_rules/rules`, creds, {
    method: 'POST',
    body: JSON.stringify({ mode, configuration: { target, value }, notes }),
  });
  return { id: r.id, mode: r.mode, value: r.configuration?.value, target: r.configuration?.target };
}

export async function deleteIPAccessRule(creds, zoneId, ruleId) {
  const r = await cfFetch(`/zones/${zoneId}/firewall/access_rules/rules/${ruleId}`, creds, {
    method: 'DELETE',
  });
  return { id: r.id, deleted: true };
}

// ─── Page Rules ───────────────────────────────────────────────────────────────

export async function listPageRules(creds, zoneId) {
  const rules = await cfFetch(
    `/zones/${zoneId}/pagerules?status=active&order=priority&direction=asc`,
    creds,
  );
  return (rules ?? []).map((r) => ({
    id: r.id,
    status: r.status,
    priority: r.priority,
    targets: r.targets?.map((t) => t.constraint?.value),
    actions: r.actions?.map((a) => ({ id: a.id, value: a.value })),
  }));
}

export async function createPageRule(
  creds,
  zoneId,
  { url, actions, priority = 1, status = 'active' },
) {
  const r = await cfFetch(`/zones/${zoneId}/pagerules`, creds, {
    method: 'POST',
    body: JSON.stringify({
      targets: [{ target: 'url', constraint: { operator: 'matches', value: url } }],
      actions,
      priority,
      status,
    }),
  });
  return { id: r.id, status: r.status, priority: r.priority };
}

export async function deletePageRule(creds, zoneId, ruleId) {
  const r = await cfFetch(`/zones/${zoneId}/pagerules/${ruleId}`, creds, { method: 'DELETE' });
  return { id: r.id, deleted: true };
}

// ─── SSL / TLS ────────────────────────────────────────────────────────────────

export async function getSSLSetting(creds, zoneId) {
  return cfFetch(`/zones/${zoneId}/settings/ssl`, creds);
}

export async function updateSSLSetting(creds, zoneId, value) {
  // value: 'off' | 'flexible' | 'full' | 'strict'
  return cfFetch(`/zones/${zoneId}/settings/ssl`, creds, {
    method: 'PATCH',
    body: JSON.stringify({ value }),
  });
}

export async function listCertificates(creds, zoneId) {
  const certs = await cfFetch(`/zones/${zoneId}/ssl/certificate_packs`, creds);
  return (certs ?? []).map((c) => ({
    id: c.id,
    type: c.type,
    status: c.status,
    hosts: c.hosts,
    primaryCertificate: c.primary_certificate,
  }));
}

// ─── Workers ─────────────────────────────────────────────────────────────────

export async function listWorkers(creds, accountId) {
  const scripts = await cfFetch(`/accounts/${accountId}/workers/scripts`, creds);
  return (scripts ?? []).map((s) => ({
    id: s.id,
    etag: s.etag,
    createdOn: s.created_on,
    modifiedOn: s.modified_on,
  }));
}

export async function listWorkerRoutes(creds, zoneId) {
  const routes = await cfFetch(`/zones/${zoneId}/workers/routes`, creds);
  return (routes ?? []).map((r) => ({
    id: r.id,
    pattern: r.pattern,
    script: r.script,
  }));
}

export async function createWorkerRoute(creds, zoneId, { pattern, script }) {
  const r = await cfFetch(`/zones/${zoneId}/workers/routes`, creds, {
    method: 'POST',
    body: JSON.stringify({ pattern, script }),
  });
  return { id: r.id, pattern: r.pattern, script: r.script };
}

export async function deleteWorkerRoute(creds, zoneId, routeId) {
  const r = await cfFetch(`/zones/${zoneId}/workers/routes/${routeId}`, creds, {
    method: 'DELETE',
  });
  return { id: r.id, deleted: true };
}

// ─── Rate Limiting ────────────────────────────────────────────────────────────

export async function listRateLimits(creds, zoneId) {
  const rules = await cfFetch(`/zones/${zoneId}/rate_limits?per_page=100`, creds);
  return (rules ?? []).map((r) => ({
    id: r.id,
    disabled: r.disabled,
    description: r.description,
    threshold: r.threshold,
    period: r.period,
    action: r.action?.mode,
    match: r.match?.request?.url_pattern,
  }));
}

export async function createRateLimit(
  creds,
  zoneId,
  { threshold, period, action, urlPattern, description = '', disabled = false },
) {
  const body = {
    disabled,
    description,
    threshold,
    period,
    match: { request: { url_pattern: urlPattern, methods: ['_ALL_'], schemes: ['_ALL_'] } },
    action: { mode: action },
  };
  const r = await cfFetch(`/zones/${zoneId}/rate_limits`, creds, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return { id: r.id, threshold: r.threshold, period: r.period, action: r.action?.mode };
}

export async function deleteRateLimit(creds, zoneId, rateLimitId) {
  const r = await cfFetch(`/zones/${zoneId}/rate_limits/${rateLimitId}`, creds, {
    method: 'DELETE',
  });
  return { id: r.id, deleted: true };
}

// ─── KV Storage ───────────────────────────────────────────────────────────────

export async function listKVNamespaces(creds, accountId) {
  const ns = await cfFetch(`/accounts/${accountId}/storage/kv/namespaces?per_page=100`, creds);
  return (ns ?? []).map((n) => ({ id: n.id, title: n.title }));
}

export async function createKVNamespace(creds, accountId, title) {
  const n = await cfFetch(`/accounts/${accountId}/storage/kv/namespaces`, creds, {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
  return { id: n.id, title: n.title };
}

export async function deleteKVNamespace(creds, accountId, namespaceId) {
  await cfFetch(`/accounts/${accountId}/storage/kv/namespaces/${namespaceId}`, creds, {
    method: 'DELETE',
  });
  return { id: namespaceId, deleted: true };
}

export async function listKVKeys(creds, accountId, namespaceId, { prefix, limit = 100 } = {}) {
  const query = new URLSearchParams({ limit });
  if (prefix) query.set('prefix', prefix);
  const result = await cfFetch(
    `/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/keys?${query}`,
    creds,
  );
  return (result ?? []).map((k) => ({ name: k.name, expiration: k.expiration }));
}

export async function getKVValue(creds, accountId, namespaceId, key) {
  // Returns raw text, not JSON
  const res = await fetch(
    `${BASE}/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`,
    { headers: headers(creds) },
  );
  if (!res.ok) throw new Error(`KV get failed: ${res.status}`);
  return res.text();
}

export async function putKVValue(
  creds,
  accountId,
  namespaceId,
  key,
  value,
  { expiration, expirationTtl } = {},
) {
  const query = new URLSearchParams();
  if (expiration) query.set('expiration', expiration);
  if (expirationTtl) query.set('expiration_ttl', expirationTtl);
  const qs = query.toString() ? `?${query}` : '';
  const res = await fetch(
    `${BASE}/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}${qs}`,
    { method: 'PUT', headers: { Authorization: `Bearer ${creds.token}` }, body: value },
  );
  if (!res.ok) throw new Error(`KV put failed: ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.errors?.[0]?.message ?? 'KV put error');
  return { key, stored: true };
}

export async function deleteKVValue(creds, accountId, namespaceId, key) {
  await cfFetch(
    `/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`,
    creds,
    { method: 'DELETE' },
  );
  return { key, deleted: true };
}

// ─── R2 Storage ───────────────────────────────────────────────────────────────

export async function listR2Buckets(creds, accountId) {
  const result = await cfFetch(`/accounts/${accountId}/r2/buckets`, creds);
  const buckets = result?.buckets ?? result ?? [];
  return buckets.map((b) => ({
    name: b.name,
    creationDate: b.creation_date,
    location: b.location,
  }));
}

export async function createR2Bucket(creds, accountId, { name, locationHint }) {
  const body = { name };
  if (locationHint) body.locationHint = locationHint;
  await cfFetch(`/accounts/${accountId}/r2/buckets`, creds, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return { name, created: true };
}

export async function deleteR2Bucket(creds, accountId, bucketName) {
  await cfFetch(`/accounts/${accountId}/r2/buckets/${bucketName}`, creds, { method: 'DELETE' });
  return { name: bucketName, deleted: true };
}

// ─── Load Balancers ───────────────────────────────────────────────────────────

export async function listLoadBalancers(creds, zoneId) {
  const lbs = await cfFetch(`/zones/${zoneId}/load_balancers`, creds);
  return (lbs ?? []).map((lb) => ({
    id: lb.id,
    name: lb.name,
    enabled: lb.enabled,
    fallbackPool: lb.fallback_pool,
    defaultPools: lb.default_pools,
    proxied: lb.proxied,
    ttl: lb.ttl,
    createdOn: lb.created_on,
    modifiedOn: lb.modified_on,
  }));
}

export async function listLoadBalancerPools(creds, accountId) {
  const pools = await cfFetch(`/accounts/${accountId}/load_balancers/pools`, creds);
  return (pools ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    enabled: p.enabled,
    healthy: p.healthy,
    minimumOrigins: p.minimum_origins,
    origins: p.origins?.map((o) => ({
      name: o.name,
      address: o.address,
      enabled: o.enabled,
      healthy: o.health,
    })),
  }));
}

export async function createLoadBalancerPool(
  creds,
  accountId,
  { name, origins, description = '', enabled = true, minimumOrigins = 1 },
) {
  const p = await cfFetch(`/accounts/${accountId}/load_balancers/pools`, creds, {
    method: 'POST',
    body: JSON.stringify({ name, origins, description, enabled, minimum_origins: minimumOrigins }),
  });
  return { id: p.id, name: p.name, enabled: p.enabled };
}

// ─── Custom Hostnames ─────────────────────────────────────────────────────────

export async function listCustomHostnames(creds, zoneId) {
  const hostnames = await cfFetch(`/zones/${zoneId}/custom_hostnames?per_page=50`, creds);
  return (hostnames ?? []).map((h) => ({
    id: h.id,
    hostname: h.hostname,
    status: h.status,
    sslStatus: h.ssl?.status,
    createdAt: h.created_at,
  }));
}

export async function createCustomHostname(
  creds,
  zoneId,
  { hostname, sslMethod = 'http', sslType = 'dv' },
) {
  const h = await cfFetch(`/zones/${zoneId}/custom_hostnames`, creds, {
    method: 'POST',
    body: JSON.stringify({
      hostname,
      ssl: { method: sslMethod, type: sslType },
    }),
  });
  return { id: h.id, hostname: h.hostname, status: h.status, sslStatus: h.ssl?.status };
}

export async function deleteCustomHostname(creds, zoneId, customHostnameId) {
  await cfFetch(`/zones/${zoneId}/custom_hostnames/${customHostnameId}`, creds, {
    method: 'DELETE',
  });
  return { id: customHostnameId, deleted: true };
}

// ─── Cloudflare Tunnels ───────────────────────────────────────────────────────

export async function listTunnels(creds, accountId) {
  const tunnels = await cfFetch(`/accounts/${accountId}/cfd_tunnel?per_page=50`, creds);
  return (tunnels ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    status: t.status,
    createdAt: t.created_at,
    deletedAt: t.deleted_at,
    connections: t.connections?.length ?? 0,
  }));
}

export async function getTunnel(creds, accountId, tunnelId) {
  const t = await cfFetch(`/accounts/${accountId}/cfd_tunnel/${tunnelId}`, creds);
  return {
    id: t.id,
    name: t.name,
    status: t.status,
    createdAt: t.created_at,
    connections: t.connections ?? [],
  };
}

// ─── Cloudflare Access ────────────────────────────────────────────────────────

export async function listAccessApplications(creds, accountId) {
  const apps = await cfFetch(`/accounts/${accountId}/access/apps`, creds);
  return (apps ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    domain: a.domain,
    type: a.type,
    sessionDuration: a.session_duration,
    createdAt: a.created_at,
    updatedAt: a.updated_at,
  }));
}

export async function listAccessPolicies(creds, accountId, appId) {
  const policies = await cfFetch(`/accounts/${accountId}/access/apps/${appId}/policies`, creds);
  return (policies ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    decision: p.decision,
    include: p.include,
    exclude: p.exclude,
    require: p.require,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }));
}

// ─── Logpush ──────────────────────────────────────────────────────────────────

export async function listLogpushJobs(creds, zoneId) {
  const jobs = await cfFetch(`/zones/${zoneId}/logpush/jobs`, creds);
  return (jobs ?? []).map((j) => ({
    id: j.id,
    name: j.name,
    enabled: j.enabled,
    dataset: j.dataset,
    destinationConf: j.destination_conf,
    lastComplete: j.last_complete,
    lastError: j.last_error,
    errorMessage: j.error_message,
  }));
}

// ─── Health Checks ────────────────────────────────────────────────────────────

export async function listHealthChecks(creds, zoneId) {
  const checks = await cfFetch(`/zones/${zoneId}/healthchecks`, creds);
  return (checks ?? []).map((h) => ({
    id: h.id,
    name: h.name,
    address: h.address,
    enabled: h.enabled,
    type: h.type,
    interval: h.interval,
    retries: h.retries,
    status: h.status,
    failureReason: h.failure_reason,
    createdOn: h.created_on,
    modifiedOn: h.modified_on,
  }));
}

export async function createHealthCheck(
  creds,
  zoneId,
  {
    name,
    address,
    type = 'HTTPS',
    path = '/',
    interval = 60,
    retries = 2,
    timeout = 5,
    enabled = true,
    description = '',
  },
) {
  const h = await cfFetch(`/zones/${zoneId}/healthchecks`, creds, {
    method: 'POST',
    body: JSON.stringify({
      name,
      address,
      type,
      enabled,
      description,
      interval,
      retries,
      timeout,
      http_config: { path },
    }),
  });
  return { id: h.id, name: h.name, address: h.address, status: h.status };
}

export async function deleteHealthCheck(creds, zoneId, healthCheckId) {
  await cfFetch(`/zones/${zoneId}/healthchecks/${healthCheckId}`, creds, { method: 'DELETE' });
  return { id: healthCheckId, deleted: true };
}
